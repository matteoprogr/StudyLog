param(
    [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$Jdk = $env:JAVA_HOME
)

$ErrorActionPreference = 'Stop'
if (!$Jdk) { $Jdk = Join-Path $env:ProgramFiles 'Java\jdk-17' }
$env:JAVA_HOME = $Jdk
$env:Path = "$(Join-Path $Jdk 'bin');$env:Path"
$tools = Join-Path $Sdk 'build-tools\35.0.1'
$platform = Join-Path $Sdk 'platforms\android-35\android.jar'
$root = Split-Path $PSScriptRoot
$build = Join-Path $PSScriptRoot 'build'
$assets = Join-Path $build 'assets'
$classes = Join-Path $build 'classes'
$drawable = Join-Path $build 'res\drawable'

function Invoke-BuildTool {
    param([string]$Executable, [string[]]$ToolArguments)
    & $Executable @ToolArguments
    if ($LASTEXITCODE -ne 0) { throw "Build tool failed: $Executable ($LASTEXITCODE)" }
}

foreach ($path in @($platform, "$tools\aapt2.exe", "$tools\d8.bat", "$Jdk\bin\javac.exe")) {
    if (!(Test-Path -LiteralPath $path)) { throw "Required Android build tool missing: $path" }
}
New-Item -ItemType Directory -Force -Path $assets, $classes, $drawable | Out-Null
foreach ($name in @('index.html','main.js','query.js','card.js','charts.js','manifest.json','css','libs','assets','icons')) {
    Copy-Item -LiteralPath (Join-Path $root $name) -Destination $assets -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $root 'icons\icon-192.png') -Destination "$drawable\studylog_icon.png" -Force

$compiled = "$build\resources.zip"
$unsigned = "$build\unsigned.apk"
$aligned = "$build\aligned.apk"
$apk = "$build\StudyLog-debug.apk"
$key = "$build\debug.jks"
$sources = @(Get-ChildItem "$PSScriptRoot\src" -Filter '*.java' | ForEach-Object FullName)

Invoke-BuildTool "$tools\aapt2.exe" @('compile','--dir',"$build\res",'-o',$compiled)
Invoke-BuildTool "$tools\aapt2.exe" @('link','-I',$platform,'--manifest',"$PSScriptRoot\AndroidManifest.xml",'-A',$assets,'-o',$unsigned,$compiled)
Invoke-BuildTool "$Jdk\bin\javac.exe" (@('--release','8','-encoding','UTF-8','-classpath',$platform,'-d',$classes) + $sources)
Invoke-BuildTool "$Jdk\bin\jar.exe" @('cf',"$build\classes.jar",'-C',$classes,'.')
Invoke-BuildTool "$tools\d8.bat" @('--min-api','26','--lib',$platform,'--output',$build,"$build\classes.jar")
# Some Windows SDK builds write backslashes in nested asset entries.
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archive = [IO.Compression.ZipFile]::Open($unsigned, [IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($entry in @($archive.Entries | Where-Object { $_.FullName.Contains('\') })) {
        $bytes = New-Object IO.MemoryStream
        $source = $entry.Open()
        try { $source.CopyTo($bytes) }
        finally { $source.Dispose() }
        $renamed = $archive.CreateEntry($entry.FullName.Replace('\', '/'))
        $destination = $renamed.Open()
        try { $bytes.WriteTo($destination) }
        finally { $destination.Dispose(); $bytes.Dispose() }
        $entry.Delete()
    }
} finally { $archive.Dispose() }
# Add DEX as a stored entry after the archive edits so ART can map it directly.
Invoke-BuildTool "$Jdk\bin\jar.exe" @('u0f',$unsigned,'-C',$build,'classes.dex')
Invoke-BuildTool "$tools\zipalign.exe" @('-f','4',$unsigned,$aligned)

if (!(Test-Path -LiteralPath $key)) {
    Invoke-BuildTool "$Jdk\bin\keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Android Debug,O=StudyLog,C=IT')
}
Invoke-BuildTool "$tools\apksigner.bat" @('sign','--ks',$key,'--ks-pass','pass:android','--key-pass','pass:android','--out',$apk,$aligned)
Invoke-BuildTool "$tools\apksigner.bat" @('verify','--verbose',$apk)
Invoke-BuildTool "$tools\zipalign.exe" @('-c','4',$apk)
$signed = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    $dex = $signed.GetEntry('classes.dex')
    if ($null -eq $dex -or $dex.Length -ne $dex.CompressedLength) {
        throw 'APK must contain an uncompressed classes.dex.'
    }
    $verifiedDex = "$build\verified-classes.dex"
    [IO.Compression.ZipFileExtensions]::ExtractToFile($dex, $verifiedDex, $true)
    if ((Get-FileHash $verifiedDex).Hash -ne (Get-FileHash "$build\classes.dex").Hash) {
        throw 'Packaged classes.dex differs from the D8 output.'
    }
    $dexDump = Invoke-BuildTool "$tools\dexdump.exe" @($verifiedDex)
    if (!($dexDump | Select-String "Class descriptor.*Lit/studylog/app/MainActivity;")) {
        throw 'MainActivity is missing from the packaged DEX.'
    }
} finally { $signed.Dispose() }
Write-Output $apk
