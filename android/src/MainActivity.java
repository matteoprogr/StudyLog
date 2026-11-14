package it.studylog.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String HOST = "studylog.local";
    private static final int IMPORT = 1;
    private static final int EXPORT = 2;
    private static final int NOTIFICATIONS = 3;
    private WebView web;
    private ValueCallback<Uri[]> filePicker;
    private String backup;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        backup = state == null ? null : state.getString("backup");
        String stage = "NOTIFICHE";
        try {
            TimerNotification.createChannels(getSystemService(NotificationManager.class));
            stage = "WEBVIEW";
            openStudyLog();
        } catch (RuntimeException | LinkageError error) {
            web = null;
            showStartupError(stage, error);
        }
    }

    private void showStartupError(String stage, Throwable error) {
        Log.e("StudyLogStartup", "Startup failed at " + stage, error);
        TextView message = new TextView(this);
        message.setTextIsSelectable(true);
        message.setTextSize(16);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        message.setPadding(padding, padding, padding, padding);
        message.setText("StudyLog · v.1.0.5\n\n[AVVIO_" + stage + "]\n"
            + error.getClass().getSimpleName() + "\n"
            + (error.getMessage() == null ? "" : error.getMessage()));
        ScrollView screen = new ScrollView(this);
        screen.addView(message);
        setContentView(screen);
    }

    private void openStudyLog() {
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.addJavascriptInterface(new TimerBridge(), "StudyLogAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onReceivedError(WebView view, WebResourceRequest request,
                    android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    showStartupError("PAGINA", new IllegalStateException(
                        error.getErrorCode() + " " + error.getDescription()));
                }
            }

            @Override public boolean onRenderProcessGone(WebView view,
                    android.webkit.RenderProcessGoneDetail detail) {
                web = null;
                showStartupError("RENDERER", new IllegalStateException(
                    detail.didCrash() ? "Il processo WebView si è arrestato." : "Android ha interrotto il processo WebView."));
                view.destroy();
                return true;
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !local(request.getUrl());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if (local(url) && path != null && path.startsWith("/") && !path.contains("..")) {
                    String extension = MimeTypeMap.getFileExtensionFromUrl(url.toString());
                    String mime = extension.equals("js") || extension.equals("mjs")
                        ? "text/javascript" : MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    try {
                        return new WebResourceResponse(mime == null ? "application/octet-stream" : mime,
                            mime != null && (mime.startsWith("text/") || mime.equals("application/json")) ? "UTF-8" : null,
                            getAssets().open(path.substring(1)));
                    } catch (IOException ignored) {}
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found",
                    java.util.Collections.emptyMap(), null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePicker != null) filePicker.onReceiveValue(null);
                filePicker = callback;
                startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE).setType("*/*"), IMPORT);
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private static boolean local(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.evaluateJavascript(
            "window.dispatchEvent(new Event('android-notification-status'))", null);
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        if (backup != null) state.putString("backup", backup);
        super.onSaveInstanceState(state);
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == IMPORT && filePicker != null) {
            filePicker.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            filePicker = null;
        }
        if (request == EXPORT) {
            if (result == RESULT_OK && data != null && data.getData() != null && backup != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream == null) throw new IOException();
                    stream.write(backup.getBytes(StandardCharsets.UTF_8));
                    android.widget.Toast.makeText(this, "Backup esportato.", android.widget.Toast.LENGTH_SHORT).show();
                } catch (IOException | SecurityException error) {
                    android.widget.Toast.makeText(this, "Impossibile salvare il backup.", android.widget.Toast.LENGTH_LONG).show();
                }
            }
            backup = null;
        }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == NOTIFICATIONS) web.evaluateJavascript(
            "window.dispatchEvent(new Event('android-notification-status'))", null);
    }

    public final class TimerBridge {
        @JavascriptInterface public String status() {
            if (!getSystemService(NotificationManager.class).areNotificationsEnabled()) return "notifications";
            if (Build.VERSION.SDK_INT >= 31 && !getSystemService(AlarmManager.class).canScheduleExactAlarms()) return "exact";
            return "scheduled";
        }

        @JavascriptInterface public String diagnostic() {
            return TimerNotification.diagnostic(MainActivity.this);
        }

        @JavascriptInterface public void configure() {
            runOnUiThread(() -> {
                String status = status();
                if (status.equals("notifications")) {
                    if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                        && !getPreferences(0).getBoolean("asked", false)) {
                        getPreferences(0).edit().putBoolean("asked", true).apply();
                        requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS);
                    } else {
                        startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
                    }
                } else if (status.equals("exact")) {
                    startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getPackageName())));
                }
            });
        }

        @JavascriptInterface public String schedule(long start, long duration, boolean sound) {
            String status = status();
            if (!status.equals("scheduled")) {
                TimerNotification.record(MainActivity.this, status.equals("exact")
                    ? "[PERMESSO_AVVISI_ESATTI] Android non consente di programmare avvisi esatti."
                    : "[NOTIFICHE_DISATTIVATE] Abilita le notifiche Android di StudyLog.");
                return status;
            }
            long remaining = start + duration - System.currentTimeMillis();
            if (remaining <= 0 || duration <= 0 || duration > 86400000) {
                TimerNotification.record(MainActivity.this, "[SCADENZA_NON_VALIDA] L’avviso non è stato programmato.");
                return "invalid";
            }
            try {
                TimerNotification.schedule(MainActivity.this, start, remaining, sound);
                String time = java.text.DateFormat.getDateTimeInstance().format(new java.util.Date(start + duration));
                TimerNotification.record(MainActivity.this, "[PROGRAMMATO] Scadenza prevista: " + time);
                return "scheduled";
            } catch (SecurityException error) {
                TimerNotification.record(MainActivity.this, "[PERMESSO_AVVISI_ESATTI] Android ha rifiutato la programmazione.");
                return "exact";
            } catch (RuntimeException error) {
                android.util.Log.e("StudyLogTimer", "Scheduling failed", error);
                TimerNotification.record(MainActivity.this, "[ERRORE_PROGRAMMAZIONE] " + error.getClass().getSimpleName());
                return "error";
            }
        }

        @JavascriptInterface public void cancel(long start) {
            TimerNotification.cancel(MainActivity.this, start);
            TimerNotification.record(MainActivity.this, "[INTERROTTO] Richiesta di annullamento inviata ad Android.");
        }

        @JavascriptInterface public void exportBackup(String json) {
            runOnUiThread(() -> {
                backup = json;
                startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE).setType("application/json")
                    .putExtra(Intent.EXTRA_TITLE, "studylog_export.json"), EXPORT);
            });
        }
    }
}
