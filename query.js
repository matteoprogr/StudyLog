// Nome del DB e dello store
const DB_NAME = "StudyDB";
const DB_VERSION = 1;
const STORE_NAME = "studyLogs";
const MATERIE = "materie";

// Inizializza DB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
             if (!db.objectStoreNames.contains(MATERIE)) {
                db.createObjectStore(MATERIE, { keyPath: "nome" });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveStudyLog(log) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add(log);

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = (event) => reject(event.target.error);
        });
    } catch (err) {
        console.error("Errore salvataggio:", err);
    }
}

// Salva un oggetto
export async function saveMateria(materia) {
    try {
        const db = await openDB();
        const tx = db.transaction(MATERIE, "readwrite");
        const store = tx.objectStore(MATERIE);
        store.add(materia);

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = (event) => reject(event.target.error);
        });
    } catch (err) {
        console.error("Errore salvataggio:", err);
    }
}

export async function deleteDatabase() {
  const request = indexedDB.deleteDatabase(DB_NAME);

  request.onsuccess = () => {
  //todo aggiungere showToast
    alert("Database eliminato con successo!");
    location.reload();
  };

  request.onerror = (event) => {
  //todo aggiungere showToast
    alert("Errore durante l'eliminazione del database: " + event.target.error);
  };

  request.onblocked = () => {
    //todo aggiungere showToast
    alert("Chiusura di tutte le schede necessaria per completare l'eliminazione.");
  };
}

// Legge tutti i log
async function getAllStudyLogs() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function getStudyLogsByMonth(month) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const filteredLogs = request.result.filter(log => log.data.startsWith(month));
            resolve(filteredLogs);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}


export async function getAllMaterie() {
    const db = await openDB();
    const tx = db.transaction(MATERIE, "readonly");
    const store = tx.objectStore(MATERIE);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}



// Export (se usi moduli)
export { saveStudyLog, getAllStudyLogs };
