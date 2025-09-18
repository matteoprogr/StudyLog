import Dexie from './libs/dexie.mjs';
import { capitalizeFirstLetter } from "./main.js";

const DB_NAME = "StudyDB";
const DB_VERSION = 1;
const STORE_NAME = "studyLogs";
const MATERIE = "materie";

let db; // variabile globale per il database

// Inizializza il DB con Dexie
export function openDB() {
  db = new Dexie(DB_NAME);

  // Definizione versioni e store
  db.version(DB_VERSION).stores({
    [STORE_NAME]: '++id, materia',
    [MATERIE]: 'nome'
  });

  return db.open()
    .then(() => db)
    .catch((err) => {
      console.error("Errore apertura DB:", err);
      throw err;
    });
}


export async function saveStudyLog(log) {
  try {
    const db = await openDB();
    await db.studyLogs.add(log);
    return true;
  } catch (err) {
    showErrorToast("Errore salvataggio","error")
    console.error("Errore salvataggio StudyLog:", err);
    throw err;
  }
}


// Salva un oggetto
export async function saveMateria(materia) {
  try {
    const db = await openDB();
    await db.materie.add(materia);
    return true;
  } catch (err) {
    showErrorToast("Errore salvataggio","error")
    console.error("Errore salvataggio Materia:", err);
    throw err;
  }
}



export async function deleteDatabase() {
  try {
    await db.delete();
    db = null;
    const esiste = await Dexie.exists(DB_NAME);

    if (!esiste) {
      showToast("Database eliminato con successo!");
    } else {
      showErrorToast("Attenzione: il database non è stato eliminato correttamente!", "error");
    }
  } catch (error) {
    showErrorToast("Errore durante l'eliminazione del database", "error");
  }
}


// Legge tutti i log
export async function getAllStudyLogs() {
  try {
    const db = await openDB();
    return await db.studyLogs.toArray();
  } catch (err) {
    console.error("Errore lettura StudyLogs:", err);
    throw err;
  }
}

async function getLogsByNome(nomeValue) {
  try {
    const db = await openDB();
    const logs = await db.studyLogs
      .where('materia')
      .equals(nomeValue)
      .toArray();
    return logs;
  } catch (err) {
    console.error("Errore recupero logs per nome:", err);
    throw err;
  }
}

export async function getStudyLogsByMonth(month) {
  try {
    const db = await openDB();
    const allLogs = await db.studyLogs.toArray();
    return allLogs.filter(log => log.data.startsWith(month));
  } catch (err) {
    console.error("Errore lettura StudyLogs per mese:", err);
    throw err;
  }
}

export async function getAllMaterie() {
  try {
    const db = await openDB();
    return await db.materie.toArray();
  } catch (err) {
    console.error("Errore lettura Materie:", err);
    throw err;
  }
}

export async function updateMateria(oldMat, newMat) {
    try{
        const record = await db.materie.get(oldMat);
        let recordNew;
        if(isValid(newMat)){
            recordNew = await db.materie.get(newMat);
            newMat = capitalizeFirstLetter(newMat);
        }

        if (oldMat === newMat) return;
        if (!isValid(record)) return;
        await db.materie.delete(oldMat);
        if (!isValid(recordNew)) await db.materie.put({ ...record, nome: newMat});
        updateMatInLogs(oldMat, newMat);

    }catch(err){
        showErrorToast("Errore durante l'update","error")
    }
}

export function isValid(value) {
    return value != null && !Number.isNaN(value) && value !== "" && value != undefined;
}

async function updateMatInLogs(oldMat, newMat){
    const logs = await getLogsByNome(oldMat)
    if(logs.length !== 0){
        for(const log of logs){
            log.materia = newMat;
            await updateLogsByNome(log);
        }
    }
}

async function updateLogsByNome(log) {
  try {
    const db = await openDB();
    const data = {
          data: log.data,
          materia: log.materia,
          ore: log.ore,
          id: log.id
        };
    const count = await db.studyLogs.put(data);
    return count;
  } catch (err) {
    console.error("Errore aggiornamento logs per nome:", err);
    throw err;
  } finally{
    showToast("Materia modificata con successo", "success");
  }
}

export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

export function showErrorToast(message,type = "error") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

document.getElementById('btnExportDB').addEventListener('click', esportaDB);

async function esportaDB() {
  const overlaySpinner = document.getElementById('spinnerOverlay');
  try {
    overlaySpinner.style.display = 'flex';
    const db = await openDB();
    const studyLogs = await db.studyLogs.toArray();
    const materie = await db.materie.toArray();

    const result = {
      studyLogs: studyLogs,
      materie: materie,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studylog_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Esportazione completata con successo", "success");
  } catch (err) {
    console.error("Errore esportazione DB:", err);
    showErrorToast("Errore nell'esportazione dei dati", "error");
  } finally {
    overlaySpinner.style.display = 'none';
  }
}



const fileInput = document.getElementById('fileImport');
const btnImport = document.getElementById('btnImportDB');

fileInput.addEventListener('change', () => {
  btnImport.disabled = fileInput.files.length === 0;
});

btnImport.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (file) {
    importaDB(file);
    fileInput.value = "";
  }
});

async function importaDB(file) {
  const overlaySpinner = document.getElementById('spinnerOverlay');
  try {
    overlaySpinner.style.display = 'flex';

    const text = await file.text();
    const data = JSON.parse(text);
    const db = await openDB();
    await db.studyLogs.clear();
    await db.materie.clear();

    if (data.studyLogs) await db.studyLogs.bulkAdd(data.studyLogs);
    if (data.materie) await db.materie.bulkAdd(data.materie);

    showToast("Importazione completata con successo", "success");
  } catch (err) {
    console.error("Errore importazione DB:", err);
    showErrorToast("Errore nell'importazione dei dati", "error");
  } finally {
    overlaySpinner.style.display = 'none';
  }
}
