import Dexie from './libs/dexie.mjs';

const db = new Dexie('StudyDB');
db.version(1).stores({
  studyLogs: '++id, materia, data, [materia+data]',
  materie: 'nome',
  esami: '++id, materia, voto, crediti, data',
});
db.version(2).stores({ settings: 'id' }).upgrade(async transaction => {
  const categories = transaction.table('materie');
  const names = await transaction.table('studyLogs').orderBy('materia').uniqueKeys();
  const existing = new Set(await categories.toCollection().primaryKeys());
  await categories.bulkAdd(names.filter(name => !existing.has(name)).map(nome => ({ nome })));
});

export const defaultSettings = { limit: 180, sound: true };
export const getAllMaterie = () => db.materie.toArray();
export const getAllEsami = () => db.esami.toArray();
export const getStudyLogsByDay = day => db.studyLogs.where('data').equals(day).toArray();
export const getStudyLogsByMonth = month => db.studyLogs.where('data').startsWith(month + '-').toArray();

export async function getSettings() {
  const settings = await db.settings.get('timer');
  return settings ?? { ...defaultSettings };
}

export function saveSettings(settings) {
  return db.settings.put({ ...settings, id: 'timer' });
}

function matchingLogs(materia, data) {
  return db.studyLogs.where('[materia+data]').equals([materia, data]);
}

export const getActiveTimer = () => db.settings.get('active-timer');
export const saveActiveTimer = timer => db.settings.put({ ...timer, id: 'active-timer' });

export function finishActiveTimer(timer) {
  return db.transaction('rw', db.settings, db.materie, db.studyLogs, async () => {
    const current = await getActiveTimer();
    if (current?.start !== timer.start) return;
    if (timer.savedDuration > 0) {
      await saveSession(timer.category, timer.day, timer.savedDuration / 3600000);
    }
    await db.settings.delete('active-timer');
  });
}

export function saveSession(materia, data, hours, replace = false) {
  return db.transaction('rw', db.materie, db.studyLogs, async () => {
    if (!await db.materie.get(materia)) throw new Error('La categoria non è più disponibile.');
    const matches = matchingLogs(materia, data);
    const logs = await matches.toArray();
    const ore = replace ? hours : hours + logs.reduce((sum, log) => sum + log.ore, 0);
    await matches.delete();
    await db.studyLogs.add({ materia, data, ore });
  });
}

export function deleteSession(materia, data) {
  return matchingLogs(materia, data).delete();
}

export function saveCategory(previous, nome, colore) {
  return db.transaction('rw', db.materie, db.studyLogs, async () => {
    const categories = await db.materie.toArray();
    if (categories.some(category => category.nome !== previous && category.nome.toLowerCase() === nome.toLowerCase())) {
      throw new Error('Esiste già una categoria con questo nome.');
    }
    if (previous && !categories.some(category => category.nome === previous)) {
      throw new Error('La categoria non è più disponibile.');
    }
    if (previous && previous !== nome) {
      await db.studyLogs.where('materia').equals(previous).modify({ materia: nome });
      await db.materie.delete(previous);
    }
    await db.materie.put({ nome, colore });
  });
}

export function deleteCategory(nome, destination) {
  return db.transaction('rw', db.materie, db.studyLogs, async () => {
    const matches = db.studyLogs.where('materia').equals(nome);
    if (destination) {
      if (destination === nome || !await db.materie.get(destination)) {
        throw new Error('Scegli un’altra categoria disponibile.');
      }
      await matches.modify({ materia: destination });
    } else {
      await matches.delete();
    }
    await db.materie.delete(nome);
  });
}

export function saveExam(exam) {
  return exam.id === undefined ? db.esami.add(exam) : db.esami.put(exam);
}

export function deleteExam(id) {
  return db.esami.delete(id);
}

export function clearData() {
  return db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}

export function exportData() {
  return db.transaction('r', db.tables, async () => ({
    studyLogs: await db.studyLogs.toArray(),
    materie: await db.materie.toArray(),
    esami: await db.esami.toArray(),
    settings: await getSettings(),
    exportDate: new Date().toISOString(),
  }));
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function importData(data) {
  const { studyLogs, materie, esami, settings = defaultSettings } = data ?? {};
  if (!Array.isArray(studyLogs) || !Array.isArray(materie) || !Array.isArray(esami)
    || !materie.every(item => typeof item?.nome === 'string' && item.nome.trim())
    || !studyLogs.every(item => typeof item?.materia === 'string' && item.materia.trim()
      && validDate(item.data) && Number.isFinite(item.ore) && item.ore >= 0)
    || !esami.every(item => typeof item?.materia === 'string' && item.materia.trim() && validDate(item.data)
      && item.voto !== '' && +item.voto >= 18 && +item.voto <= 30
      && item.crediti !== '' && +item.crediti >= 0 && +item.crediti <= 30)
    || !Number.isInteger(settings?.limit) || settings.limit < 1 || settings.limit > 1440
    || typeof settings.sound !== 'boolean') {
    throw new Error('Il file non contiene un backup StudyLog valido.');
  }

  // Some older backups can contain sessions whose category is missing.
  const categories = new Map(materie.map(category => [category.nome, category]));
  for (const log of studyLogs) {
    if (!categories.has(log.materia)) categories.set(log.materia, { nome: log.materia });
  }

  return db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.studyLogs.bulkAdd(studyLogs);
    await db.materie.bulkAdd([...categories.values()]);
    await db.esami.bulkAdd(esami);
    await saveSettings({ limit: settings.limit, sound: settings.sound });
  });
}
