import * as data from './query.js';
import { createCharts } from './charts.js';
import { createEditors } from './card.js';

const byId = id => document.getElementById(id);
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const categorySelect = byId('category');
const minutes = byId('minutes');
const slider = byId('minutes-slider');
const studyForm = byId('study-form');
const dateSelect = byId('day-select');
const audio = new Audio('assets/sounds/alarm.mp3');
const alarmButton = byId('set-alarm');
const alarmStatus = byId('alarm-status');
const alarmFallback = '#registra-sveglia-non-disponibile';
let alarmCheck;

let categories = [];
let settings = data.defaultSettings;
let activeTimer;
let timerInterval;
let busy = false;
let statusTimeout;

function notify(message) {
  const status = byId('status');
  status.hidden = false;
  status.textContent = message;
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => { status.hidden = true; }, 4500);
}

function report(error) {
  console.error(error);
  notify(error.message || 'Non è stato possibile completare l’operazione.');
}

const charts = createCharts(byId, data);
const editors = createEditors(byId, data, today, refresh);

function option(label, value) {
  return new Option(label, value);
}

async function refresh() {
  const selected = categorySelect.value;
  categories = (await data.getAllMaterie()).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  categorySelect.replaceChildren(option(categories.length ? 'Scegli una categoria' : 'Nessuna categoria', ''));
  for (const category of categories) categorySelect.add(option(category.nome, category.nome));
  if (categories.some(category => category.nome === selected)) categorySelect.value = selected;
  editors.renderCategories(categories, Boolean(activeTimer));
  syncDuration();
  if (!byId('registra').hidden) await charts.day(categories);
  if (!byId('grafici').hidden) await charts.overview(categories);
  if (!byId('esami').hidden) await editors.renderExams();
}

async function navigate() {
  if (location.hash.startsWith(alarmFallback + '=')) {
    const time = location.hash.slice(alarmFallback.length + 1);
    history.replaceState(history.state, '', '#registra');
    clearTimeout(alarmCheck);
    const manual = /^\d{2}:\d{2}$/.test(time)
      ? ' Imposta manualmente la sveglia per le ' + time + ' in Orologio.'
      : ' Imposta la sveglia manualmente in Orologio.';
    showAlarmStatus('Orologio non raggiungibile dal browser [INTENT_NON_DISPONIBILE].' + manual);
  }
  const pages = [...document.querySelectorAll('#app > section')];
  const requested = location.hash.slice(1);
  const page = pages.find(section => section.id === requested) ?? pages[0];
  for (const section of pages) section.hidden = section !== page;
  for (const link of document.querySelectorAll('.navigation a')) {
    if (link.hash === '#' + page.id) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  await refresh();
}

function syncDuration() {
  const value = minutes.valueAsNumber;
  if (Number.isFinite(value)) slider.value = Math.min(value, settings.limit);
  const countdown = Number.isFinite(value) && value > 0;
  minutes.setCustomValidity(countdown && value > settings.limit
    ? 'Per avviare il timer, inserisci al massimo ' + settings.limit + ' minuti.'
    : '');
  byId('start').textContent = countdown ? 'Avvia timer' : 'Avvia cronometro';
  byId('start').disabled = busy || !categories.length;
  byId('add-log').disabled = busy || !categories.length;
}

function applySettings() {
  byId('timer-limit').value = settings.limit;
  byId('timer-sound').checked = settings.sound;
  slider.max = settings.limit;
  syncDuration();
}

function timeLabel(ms, roundUp = false) {
  const seconds = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

function tick() {
  if (!activeTimer || busy) return;
  const elapsed = Math.max(0, Date.now() - activeTimer.start);
  const remaining = Math.max(0, activeTimer.duration - elapsed);
  byId('timer-display').textContent = timeLabel(activeTimer.duration ? remaining : elapsed, Boolean(activeTimer.duration));
  if (activeTimer.duration && remaining === 0) finishTimer(true);
}

async function finishTimer(expired) {
  if (!activeTimer || busy) return;
  const timer = activeTimer;
  const elapsed = Math.max(0, Date.now() - timer.start);
  timer.savedDuration ??= timer.duration ? Math.min(elapsed, timer.duration) : elapsed;
  timer.expired ??= expired || (timer.duration > 0 && elapsed >= timer.duration);
  busy = true;
  byId('stop').disabled = true;
  clearInterval(timerInterval);
  if (timer.expired && settings.sound && !timer.alerted) {
    timer.alerted = true;
    audio.play().catch(() => notify('Timer terminato. Il browser ha bloccato il suono.'));
  }
  try {
    if (timer.savedDuration > 0) {
      await data.saveSession(timer.category, timer.day, timer.savedDuration / 3600000);
    }
  } catch (error) {
    busy = false;
    byId('stop').disabled = false;
    byId('stop').textContent = 'Riprova salvataggio';
    report(error);
    return;
  }
  activeTimer = undefined;
  clearTimeout(alarmCheck);
  busy = false;
  byId('stop').disabled = false;
  byId('stop').textContent = 'Interrompi';
  byId('timer').hidden = true;
  studyForm.hidden = false;
  minutes.value = 0;
  dateSelect.value = timer.day;
  syncDuration();
  const savedTime = timeLabel(timer.savedDuration);
  const completion = timer.expired ? 'Timer terminato.' : 'Sessione terminata.';
  notify(timer.savedDuration > 0 ? completion + ' Aggiunto ' + savedTime + '.' : completion);
  await refresh().catch(report);
}

studyForm.addEventListener('submit', event => {
  event.preventDefault();
  if (activeTimer || busy) return;
  activeTimer = {
    category: categorySelect.value,
    day: today(),
    start: Date.now(),
    duration: minutes.valueAsNumber * 60000,
  };
  byId('timer-category').textContent = activeTimer.category;
  studyForm.hidden = true;
  byId('timer').hidden = false;
  alarmButton.hidden = activeTimer.duration === 0;
  alarmStatus.hidden = true;
  editors.renderCategories(categories, true);
  tick();
  timerInterval = setInterval(tick, 250);
});

byId('stop').addEventListener('click', () => finishTimer(false));

function showAlarmStatus(message) {
  alarmStatus.textContent = message;
  alarmStatus.hidden = false;
  if (byId('timer').hidden) notify(message);
}

alarmButton.addEventListener('click', () => {
  clearTimeout(alarmCheck);
  if (!/Android/i.test(navigator.userAgent)) {
    showAlarmStatus('Dispositivo non supportato [ANDROID_RICHIESTO]. Prova da Chrome su Android.');
    return;
  }
  const deadline = activeTimer?.start + activeTimer?.duration;
  const now = new Date();
  if (!activeTimer?.duration || busy || deadline <= now.getTime()) {
    showAlarmStatus('Conto alla rovescia terminato [TIMER_SCADUTO]. Avvia un nuovo timer.');
    return;
  }
  const alarm = new Date(Math.ceil(deadline / 60000) * 60000);
  const next = new Date(now);
  next.setHours(alarm.getHours(), alarm.getMinutes(), 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  if (next.getTime() !== alarm.getTime()) {
    showAlarmStatus('Data della sveglia non univoca [ORARIO_NON_DISPONIBILE]. Impostala manualmente in Orologio.');
    return;
  }
  const time = alarm.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fallback = encodeURIComponent(new URL(alarmFallback + '=' + time, location.href).href);
  const intent = 'intent:#Intent;action=android.intent.action.SET_ALARM;'
    + 'category=android.intent.category.BROWSABLE;'
    + 'i.android.intent.extra.alarm.HOUR=' + alarm.getHours() + ';'
    + 'i.android.intent.extra.alarm.MINUTES=' + alarm.getMinutes() + ';'
    + 'S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent('StudyLog · Timer scaduto') + ';'
    + 'S.browser_fallback_url=' + fallback + ';end';
  showAlarmStatus('Richiesta per le ' + time + '. Verifica in Orologio che la sveglia sia attiva.');
  alarmCheck = setTimeout(() => {
    if (!document.hidden) {
      showAlarmStatus('Apertura non rilevata [NESSUNA_CONFERMA]. Verifica in Orologio la sveglia delle ' + time + '.');
    }
  }, 2500);
  try {
    location.href = intent;
  } catch (error) {
    clearTimeout(alarmCheck);
    console.warn('Android alarm intent failed', error);
    showAlarmStatus('Impossibile aprire Orologio [ERRORE_COLLEGAMENTO]. Prova da Chrome su Android.');
  }
});

byId('add-log').addEventListener('click', async () => {
  if (busy) return;
  // Manual entries can exceed the configured countdown limit.
  minutes.setCustomValidity('');
  const valid = studyForm.reportValidity();
  syncDuration();
  if (!valid || !dateSelect.reportValidity()) return;
  const value = minutes.valueAsNumber;
  if (value < 1 || value > 1440) {
    notify('Inserisci una durata tra 1 e 1.440 minuti.');
    return;
  }
  busy = true;
  syncDuration();
  try {
    await data.saveSession(categorySelect.value, dateSelect.value, value / 60);
    minutes.value = 0;
    await charts.day(categories);
    notify('Sessione aggiunta.');
  } catch (error) {
    report(error);
  } finally {
    busy = false;
    syncDuration();
  }
});

minutes.max = 1440;
minutes.addEventListener('input', syncDuration);
slider.addEventListener('input', () => {
  minutes.value = slider.value;
  syncDuration();
});
dateSelect.addEventListener('change', () => charts.day(categories).catch(report));
for (const id of ['month-select', 'chart-view']) {
  byId(id).addEventListener('change', () => charts.overview(categories).catch(report));
}

byId('edit-log').addEventListener('click', async () => {
  const day = dateSelect.value;
  const category = byId('day-category').value;
  try {
    const logs = await data.getStudyLogsByDay(day);
    const hours = logs.filter(log => log.materia === category).reduce((sum, log) => sum + log.ore, 0);
    editors.editSession(category, day, hours);
  } catch (error) {
    report(error);
  }
});

byId('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const values = { limit: byId('timer-limit').valueAsNumber, sound: byId('timer-sound').checked };
  try {
    await data.saveSettings(values);
    settings = values;
    applySettings();
    notify('Impostazioni salvate.');
  } catch (error) {
    report(error);
  }
});

byId('btnExportDB').addEventListener('click', async () => {
  try {
    const backup = await data.exportData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'studylog_export.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    report(error);
  }
});

const file = byId('fileImport');
file.addEventListener('change', () => { byId('btnImportDB').disabled = !file.files.length; });

async function refreshSettings() {
  settings = await data.getSettings();
  applySettings();
}

function changeData(title, message, label, change) {
  if (activeTimer) {
    notify('Interrompi il timer prima di modificare i dati.');
    return;
  }
  editors.confirm(title, message, label, async () => {
    await change();
    await refreshSettings();
  });
}

byId('btnImportDB').addEventListener('click', () => {
  const backup = file.files[0];
  if (!backup) return;
  changeData('Importa dati', 'Sostituire i dati locali con quelli di questo backup?', 'Importa', async () => {
    await data.importData(JSON.parse(await backup.text()));
    file.value = '';
    byId('btnImportDB').disabled = true;
    notify('Backup importato.');
  });
});
byId('clear-data').addEventListener('click', () => {
  changeData('Cancella tutti i dati', 'Eliminare sessioni, categorie, esami e impostazioni da questo dispositivo?', 'Cancella dati', async () => {
    await data.clearData();
    notify('Dati cancellati.');
  });
});

dateSelect.value = today();
byId('month-select').value = today().slice(0, 7);
window.addEventListener('hashchange', () => navigate().catch(report));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(alarmCheck);
  if (!document.hidden && activeTimer && timerInterval) tick();
});

window.lucide?.createIcons();
refreshSettings().then(navigate).catch(report);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./OneSignalSDKWorker.js').catch(error => console.warn(error));
}
