import { categoryColor } from './card.js';

const dateFormat = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'UTC' });
const decimal = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const timeAxis = { type: 'value', min: 0, axisLabel: { formatter: '{value} h', hideOverlap: true } };
const tooltip = { renderMode: 'richText', confine: true };

function formatHours(hours) {
  const totalSeconds = Math.floor(hours * 3600 + 0.000001);
  const wholeHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  const parts = [];
  if (wholeHours) parts.push(wholeHours + ' h');
  if (minutes) parts.push(minutes + ' min');
  if (seconds || !parts.length) parts.push(seconds + ' s');
  return parts.join(' ');
}

function sumBy(logs, field) {
  const totals = new Map();
  for (const log of logs) totals.set(log[field], (totals.get(log[field]) ?? 0) + log.ore);
  return totals;
}

function chart(element, opts, description) {
  element.hidden = false;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', description);
  const instance = echarts.getInstanceByDom(element) ?? echarts.init(element);
  instance.resize();
  instance.setOption({ textStyle: { fontFamily: 'system-ui' }, ...opts }, { notMerge: true });
}

export function createCharts(byId, data) {
  const dayElement = byId('day-chart');
  const overviewElement = byId('overview-chart');
  const resize = new ResizeObserver(entries => {
    for (const { target, contentRect } of entries) {
      if (contentRect.width && contentRect.height) echarts.getInstanceByDom(target)?.resize();
    }
  });
  resize.observe(dayElement);
  resize.observe(overviewElement);

  async function day(categories) {
    const date = byId('day-select').value;
    const logs = date ? await data.getStudyLogsByDay(date) : [];
    if (date !== byId('day-select').value || byId('registra').hidden) return;
    const sums = [...sumBy(logs, 'materia')].sort(([a], [b]) => a.localeCompare(b, 'it'));
    const select = byId('day-category');
    const selected = select.value;
    select.replaceChildren(...sums.map(([name, hours]) => new Option(name + ' · ' + formatHours(hours), name)));
    if (sums.some(([name]) => name === selected)) select.value = selected;
    byId('day-actions').hidden = !sums.length;
    byId('day-empty').hidden = Boolean(sums.length);
    if (!sums.length) {
      dayElement.hidden = true;
      return;
    }
    const names = sums.map(([name]) => name);
    const selectedIndex = Math.max(0, names.indexOf(select.value));
    const capacity = Math.max(1, Math.floor((dayElement.parentElement.clientHeight - 102) / 28));
    const zoom = sums.length > capacity;
    const startValue = Math.min(selectedIndex, Math.max(0, sums.length - capacity));
    chart(dayElement, {
      grid: { left: 0, top: 4, right: zoom ? 29 : 16, bottom: 25 },
      tooltip: { ...tooltip, formatter: item => item.name + ' · ' + formatHours(item.value) },
      xAxis: {
        ...timeAxis,
        axisLabel: { formatter: formatHours, hideOverlap: true, showMinLabel: false },
      },
      yAxis: {
        type: 'category',
        data: names,
        inverse: true,
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      dataZoom: zoom ? [{ type: 'slider', yAxisIndex: 0, width: 12, right: 3, startValue, endValue: startValue + capacity - 1, showDetail: false, showDataShadow: false }] : [],
      series: [{
        type: 'bar',
        barMaxWidth: 22,
        data: sums.map(([name, value]) => ({ value, itemStyle: { color: categoryColor(name, categories), borderRadius: [0, 4, 4, 0] } })),
      }],
    }, 'Tempo di studio per categoria. Durate disponibili nel campo Sessione.');
  }

  byId('day-category').addEventListener('change', () => {
    const instance = echarts.getInstanceByDom(dayElement);
    const zoom = instance?.getOption().dataZoom?.[0];
    if (zoom) {
      const size = zoom.endValue - zoom.startValue;
      const select = byId('day-category');
      const startValue = Math.min(select.selectedIndex, select.length - size - 1);
      instance.dispatchAction({ type: 'dataZoom', startValue, endValue: startValue + size });
    }
  });

  function renderTable(headers, rows) {
    const row = (values, tag) => {
      const tr = document.createElement('tr');
      for (const value of values) {
        const cell = document.createElement(tag);
        if (tag === 'th') cell.scope = 'col';
        cell.textContent = value;
        tr.append(cell);
      }
      return tr;
    };
    byId('chart-head').replaceChildren(row(headers, 'th'));
    byId('chart-rows').replaceChildren(...rows.map(values => row(values, 'td')));
  }

  function monthly(logs, categories, byCategory) {
    if (byCategory) {
      const totals = [...sumBy(logs, 'materia')].sort((a, b) => b[1] - a[1]);
      return {
        headers: ['Categoria', 'Tempo'],
        rows: totals.map(([name, hours]) => [name, formatHours(hours)]),
        options: {
          tooltip: { ...tooltip, formatter: item => item.name + ' · ' + formatHours(item.value) },
          legend: { type: 'scroll', bottom: 0, selectedMode: false },
          graphic: [{ type: 'text', left: 'center', top: '44%', style: { text: formatHours(totals.reduce((sum, [, hours]) => sum + hours, 0)), font: 'bold 16px system-ui', fill: '#192c29' } }],
          series: [{ type: 'pie', radius: ['45%', '72%'], center: ['50%', '47%'], label: { show: false },
            data: totals.map(([name, value]) => ({ name, value, itemStyle: { color: categoryColor(name, categories) } })) }],
        },
      };
    }
    const days = [...new Set(logs.map(log => log.data))].sort();
    const names = [...new Set(logs.map(log => log.materia))].sort((a, b) => a.localeCompare(b, 'it'));
    const byDay = sumBy(logs, 'data');
    return {
      headers: ['Data', 'Tempo totale'],
      rows: days.map(date => [dateFormat.format(new Date(date)), formatHours(byDay.get(date))]),
      options: {
        grid: { left: 49, right: 15, bottom: 59, top: 15 },
        legend: { type: 'scroll', bottom: 0, selectedMode: false },
        tooltip: { ...tooltip, trigger: 'axis', formatter: items => items[0].axisValue + '\n' + items
          .filter(item => item.value > 0).map(item => item.seriesName + ' · ' + formatHours(item.value)).join('\n') },
        xAxis: { type: 'category', data: days.map(date => date.slice(8)), axisLabel: { hideOverlap: true } },
        yAxis: timeAxis,
        series: names.map(name => {
          const hours = sumBy(logs.filter(log => log.materia === name), 'data');
          return { name, type: 'bar', stack: 'study', itemStyle: { color: categoryColor(name, categories) },
            data: days.map(date => hours.get(date) ?? 0) };
        }),
      },
    };
  }

  function grades(exams) {
    const totals = new Map();
    let credits = 0;
    let points = 0;
    for (const exam of exams.sort((a, b) => a.data.localeCompare(b.data))) {
      credits += Number(exam.crediti);
      points += exam.voto * exam.crediti;
      if (credits > 0) totals.set(exam.data, points / credits);
    }
    const labels = [...totals.keys()].map(date => dateFormat.format(new Date(date)));
    const averages = [...totals.values()];
    return {
      headers: ['Data', 'Media / 30'],
      rows: labels.map((label, index) => [label, decimal.format(averages[index])]),
      options: {
        grid: { left: 39, right: 20, bottom: 33, top: 15 },
        tooltip: { ...tooltip, trigger: 'axis', formatter: ([item]) => item.name + ' · ' + decimal.format(item.value) + '/30' },
        xAxis: { type: 'category', data: labels, axisLabel: { hideOverlap: true } },
        yAxis: { type: 'value', min: Math.max(0, Math.floor(Math.min(...averages)) - 1), max: 30 },
        series: [{ type: 'line', data: averages, color: '#28786b', symbolSize: 8 }],
      },
    };
  }

  async function overview(categories) {
    const view = byId('chart-view').value;
    const month = byId('month-select').value;
    const showGrades = view === 'grades';
    const byCategory = view === 'categories';
    const result = showGrades
      ? grades(await data.getAllEsami())
      : monthly(month ? await data.getStudyLogsByMonth(month) : [], categories, byCategory);
    if (byId('grafici').hidden || view !== byId('chart-view').value || month !== byId('month-select').value) return;
    const label = byId('chart-view').selectedOptions[0].text;
    const description = showGrades
      ? 'Media cumulativa dei voti, ponderata per i CFU, fino a ciascuna data.'
      : byCategory
        ? 'Quota del tempo di studio mensile per categoria. Al centro è indicato il totale.'
        : 'Tempo di studio nei giorni con registrazioni. Ogni colore indica una categoria.';
    byId('month-field').hidden = showGrades;
    byId('chart-title').textContent = label;
    byId('chart-description').textContent = description;
    const empty = !result.rows.length;
    byId('chart-empty').hidden = !empty;
    byId('chart-empty').textContent = showGrades ? 'Nessun esame con crediti per calcolare la media.' : 'Nessuna sessione nel mese selezionato.';
    byId('chart-details').hidden = empty;
    if (empty) {
      overviewElement.hidden = true;
      return;
    }
    chart(overviewElement, result.options, label + '. ' + description);
    renderTable(result.headers, result.rows);
  }
  return { day, overview };
}
