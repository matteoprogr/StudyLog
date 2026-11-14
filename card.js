const dateFormat = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'UTC' });
const decimal = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const fallbackColors = ['#28786b', '#4167a9', '#ac4a45', '#8256a6', '#976016', '#24789d'];

export function categoryColor(name, categories) {
  const saved = categories.find(category => category.nome === name)?.colore;
  if (/^#[0-9a-f]{6}$/i.test(saved ?? '')) return saved;
  let hash = 0;
  for (const character of name) hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0;
  return fallbackColors[hash % fallbackColors.length];
}

export function createEditors(byId, data, today, refresh) {
  const dialog = byId('editor');
  const form = byId('editor-form');
  const fields = byId('editor-fields');
  const save = byId('save-editor');
  const error = byId('editor-error');
  const cancel = byId('close-editor');
  let action;

  function open(title, label, submit, destructive = false) {
    byId('editor-title').textContent = title;
    error.hidden = true;
    save.textContent = label;
    save.classList.toggle('danger', destructive);
    action = submit;
    dialog.showModal();
  }

  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    if (save.disabled) event.preventDefault();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    cancel.disabled = true;
    error.hidden = true;
    try {
      await action(new FormData(form));
      dialog.close();
      await refresh();
    } catch (failure) {
      if (dialog.open) {
        error.textContent = failure.message || 'Operazione non riuscita.';
        error.hidden = false;
      } else {
        const status = byId('status');
        status.textContent = 'Dati salvati. Riapri la sezione per aggiornare la vista.';
        status.hidden = false;
        console.error(failure);
      }
    } finally {
      save.disabled = false;
      cancel.disabled = false;
    }
  });

  function field(label, control) {
    const wrapper = document.createElement('label');
    wrapper.className = 'field';
    wrapper.append(label, control);
    fields.append(wrapper);
  }

  function input(label, name, type, value, attributes = {}) {
    const control = document.createElement('input');
    Object.assign(control, { name, type, value, required: true }, attributes);
    field(label, control);
  }

  function paragraph(message) {
    const text = document.createElement('p');
    text.textContent = message;
    fields.append(text);
  }

  function button(label, click, className = 'secondary') {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = className;
    control.textContent = label;
    control.addEventListener('click', click);
    return control;
  }

  function confirm(title, message, label, submit) {
    fields.replaceChildren();
    paragraph(message);
    open(title, label, submit, true);
  }

  function editCategory(category, categories) {
    fields.replaceChildren();
    input('Nome', 'name', 'text', category?.nome ?? '', { maxLength: Math.max(60, category?.nome.length ?? 0) });
    input('Colore nei grafici', 'color', 'color', categoryColor(category?.nome ?? '', categories));
    open(category ? 'Modifica categoria' : 'Nuova categoria', 'Salva categoria', values => {
      const name = values.get('name').trim();
      if (!name) throw new Error('Inserisci un nome per la categoria.');
      return data.saveCategory(category?.nome, name, values.get('color'));
    });
  }

  function removeCategory(category, categories) {
    fields.replaceChildren();
    paragraph('Scegli cosa fare con le sessioni di ' + category.nome + '.');
    const select = document.createElement('select');
    select.name = 'destination';
    select.required = true;
    select.add(new Option('Scegli un’azione', ''));
    select.add(new Option('Elimina anche le sessioni', 'delete'));
    for (const item of categories) {
      if (item.nome !== category.nome) select.add(new Option('Sposta in ' + item.nome, 'move:' + item.nome));
    }
    field('Sessioni associate', select);
    open('Elimina categoria', 'Elimina categoria', values => {
      const destination = values.get('destination');
      return data.deleteCategory(category.nome, destination.startsWith('move:') ? destination.slice(5) : '');
    }, true);
  }

  function listItem(title, subtitle, actions, color) {
    const item = document.createElement('li');
    item.className = 'panel list-item';
    if (color) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = color;
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch);
    }
    const text = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = title;
    text.append(heading);
    if (subtitle) {
      const detail = document.createElement('p');
      detail.className = 'muted';
      detail.textContent = subtitle;
      text.append(detail);
    }
    const buttons = document.createElement('div');
    buttons.className = 'actions';
    buttons.append(...actions);
    item.append(text, buttons);
    return item;
  }

  function renderCategories(categories, timerRunning) {
    byId('add-category').onclick = () => editCategory(undefined, categories);
    byId('category-empty').hidden = categories.length > 0;
    byId('category-list').replaceChildren(...categories.map(category => {
      const edit = button('Modifica', () => editCategory(category, categories));
      const remove = button('Elimina', () => removeCategory(category, categories), 'quiet-danger');
      edit.disabled = timerRunning;
      remove.disabled = timerRunning;
      return listItem(category.nome, '', [edit, remove], categoryColor(category.nome, categories));
    }));
  }

  function editExam(exam) {
    fields.replaceChildren();
    input('Nome esame', 'materia', 'text', exam?.materia ?? '', { maxLength: Math.max(100, exam?.materia.length ?? 0) });
    input('Data', 'data', 'date', exam?.data ?? today());
    input('Voto in trentesimi', 'voto', 'number', exam?.voto ?? '', { min: 18, max: 30, step: 1 });
    input('Crediti (CFU)', 'crediti', 'number', exam?.crediti ?? '', { min: 0, max: 30, step: 1 });
    open(exam ? 'Modifica esame' : 'Aggiungi esame', 'Salva esame', values => {
      const materia = values.get('materia').trim();
      if (!materia) throw new Error('Inserisci il nome dell’esame.');
      return data.saveExam({
        ...(exam ? { id: exam.id } : {}),
        materia,
        data: values.get('data'),
        voto: Number(values.get('voto')),
        crediti: Number(values.get('crediti')),
      });
    });
  }

  async function renderExams() {
    const exams = (await data.getAllEsami()).sort((a, b) => b.data.localeCompare(a.data));
    const credits = exams.reduce((sum, exam) => sum + Number(exam.crediti), 0);
    const average = credits ? exams.reduce((sum, exam) => sum + exam.voto * exam.crediti, 0) / credits : null;
    const summary = byId('exam-summary');
    summary.replaceChildren();
    for (const [label, value] of [
      ['Crediti', credits],
      ['Media ponderata', average === null ? '—' : decimal.format(average) + ' / 30'],
      ['Stima di laurea', average === null ? '—' : decimal.format(average * 110 / 30) + ' / 110'],
    ]) {
      const metric = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      metric.append(term, description);
      summary.append(metric);
    }
    byId('exam-empty').hidden = exams.length > 0;
    byId('exam-list').replaceChildren(...exams.map(exam => listItem(
      exam.materia,
      dateFormat.format(new Date(exam.data)) + ' · ' + exam.voto + '/30 · ' + exam.crediti + ' CFU',
      [
        button('Modifica', () => editExam(exam)),
        button('Elimina', () => confirm('Elimina esame', 'Eliminare ' + exam.materia + '?', 'Elimina esame', () => data.deleteExam(exam.id)), 'quiet-danger'),
      ],
    )));
  }

  function editSession(category, day, hours) {
    fields.replaceChildren();
    paragraph(category + ' · ' + dateFormat.format(new Date(day)));
    const totalMinutes = Math.max(1, Math.round(hours * 60));
    input('Durata totale (minuti)', 'minutes', 'number', totalMinutes, { min: 1, step: 1 });
    fields.append(button('Elimina registrazione', () => {
      dialog.close();
      confirm('Elimina registrazione', 'Eliminare il tempo registrato per ' + category + ' in questo giorno?', 'Elimina', () => data.deleteSession(category, day));
    }, 'quiet-danger'));
    open('Modifica registrazione', 'Salva durata', values => data.saveSession(category, day, Number(values.get('minutes')) / 60, true));
  }

  byId('add-exam').addEventListener('click', () => editExam());
  return { confirm, editSession, renderCategories, renderExams };
}
