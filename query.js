import Dexie from './libs/dexie.mjs';

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
    [STORE_NAME]: '++id',
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

