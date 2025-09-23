import { saveStudyLog, getAllStudyLogs, saveMateria, getAllMaterie, getStudyLogsByMonth, deleteDatabase,
updateMateria, deleteMaterie, isValid, updateOreInLogs, getStudyLogsByDay, showErrorToast, getAllEsami, deleteEsame, deleteLogByMateriaData } from "./query.js";

import { creaEsameComponent, creaCardInsEsame, mediaComponent } from "./card.js";

/////////  SERVICE WORKER ////////////////
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered:', reg))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}


/////////////  VARIABILi GLOBALI ///////////////////
const form = document.getElementById("study-form");
document.getElementById("addReg").addEventListener('click', aggiungiRegistrazione);
const materiaInput = document.getElementById("ricerca-materie");
const minutesSlider = document.getElementById("minutes");
const minutesValue = document.getElementById("minutes-value");
const timerContainer = document.getElementById("timer-container");
const timerDisplay = document.getElementById("timer-display");
const stopBtn = document.getElementById("stop-btn");
const daySelect = document.getElementById('day-select');
const monthSelect = document.getElementById('month-select');
const prevBtn = document.getElementById("prev-month");
const nextBtn = document.getElementById("next-month");
const deleteBtn = document.getElementById("delete-db-btn");
const modal = document.getElementById("confirm-modal");
const confirmDelete = document.getElementById("confirm-delete");
const cancelDelete = document.getElementById("cancel-delete");
const audioFile = new Audio("assets/sounds/alarm.mp3");
const carousel = document.querySelector('.chart-carousel');
document.getElementById('deleteEsami').addEventListener('click', deleteEsami);
let countdown;
let remainingTime;
let startTime = null;
let durationMs = 0;
let timerInterval = null;
let materia;
let minutes;
let materie;
let time;


    const links = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll(".page-section");

    lucide.createIcons();

    // --- Navigation ---
    links.forEach(link => {
        link.addEventListener("click", async (e) => {
            e.preventDefault();
            links.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            const targetId = link.getAttribute("data-target");
            if(targetId === "grafici"){
                await setDate();
                drawChart();
                drawPieChart();
            }
            if(targetId === "registra"){
                materie = await getAllMaterie();
                materieCreateComponent(materie);
                drawDayChart();
            }
            if(targetId === "esami"){
                creaEsamiPage();
            }

            sections.forEach(section => {
                section.classList.remove("active");
                if (section.id === targetId) section.classList.add("active");
            });
        });
    });



document.addEventListener("DOMContentLoaded", async () => {

prevBtn.addEventListener("click", () => changeMonth(-1));
nextBtn.addEventListener("click", () => changeMonth(1));

await setDay();


    minutesSlider.addEventListener("input", () => {
        minutesValue.textContent = minutesSlider.value;
    });
    monthSelect.addEventListener('change', drawChart);
    daySelect.addEventListener('change', drawDayChart);
    materie = await getAllMaterie();
    materieCreateComponent(materie);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      minutes = parseInt(minutesValue.innerText, 10);
      if(minutes === 0){
        startInfiniteTimer();
      }else{
        startTimer();
      }

      form.classList.add("hidden");
      timerContainer.classList.remove("hidden");
      materia = materiaInput.value.trim();
    });

    stopBtn.addEventListener("click", async () => {
      await stopTimer();
      resetForm();
      form.classList.remove("hidden");
      timerContainer.classList.add("hidden");
    });

deleteBtn.addEventListener("click", () => {
  modal.classList.remove("hidden");
});

cancelDelete.addEventListener("click", () => {
  modal.classList.add("hidden");
});

confirmDelete.addEventListener("click", () => {
  modal.classList.add("hidden");
  deleteDatabase();
});

});


///////////  FUNZIONI //////////////////////

async function aggiungiRegistrazione(){
    const minutes = parseInt(minutesSlider.value, 10);
    materia = materiaInput.value.trim();
    if(minutes !== 0 && isValid(materia) && isValid(daySelect.value)){
         await saveLog(materia,minutes,daySelect.value);
         resetForm();
         drawDayChart();
         minutesValue.textContent = 0;
    }else{
        showErrorToast("Valori non validi","error");
        return;
    }
    return;
}

async function deleteEsami(){
    const selectedCards = document.querySelectorAll(".selected");
    if(selectedCards.length === 0){
        showErrorToast("Selezionare almeno un esame", "error");
        return;
    }

    for(const card of selectedCards){
         await deleteEsame(parseInt(card.id,10));
    }
    await creaEsamiPage()
}

function startTimer() {
  const minutes = parseInt(minutesSlider.value, 10);
  durationMs = minutes * 60 * 1000;
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
  dayChart.classList.add('hidden');
  daySelect.classList.add("hidden");
}

function startInfiniteTimer() {
  startTime = Date.now();
  timerInterval = setInterval(updateInfiniteTimer, 1000);
  updateInfiniteTimer();
  dayChart.classList.add('hidden');
  daySelect.classList.add("hidden");
}

function updateInfiniteTimer() {
  const elapsed = Date.now() - startTime;
  updateTimerDisplay(elapsed);
  time = elapsed;
}

async function stopTimer() {
    clearInterval(timerInterval);
    startTime = null;
    durationMs = 0;
    updateTimerDisplay(0);
    minutesValue.textContent = 0;
    const audio = audioFile;
    audio.play().catch(err => console.log("Errore audio:", err));
    const minutiPassati = time / (1000 * 60);
    await saveLog(materia, minutiPassati);
    minutesValue.textContent = 0;
    form.classList.remove("hidden");
    timerContainer.classList.add("hidden");
    materie = await getAllMaterie();
    materieCreateComponent(materie);
    daySelect.classList.remove("hidden");
    drawDayChart();
}


async function updateTimer() {
  const elapsed = Date.now() - startTime;
  const remaining = durationMs - elapsed;
  time = elapsed;

  if (remaining <= 0) {
    clearInterval(timerInterval);
    updateTimerDisplay(0);
    const audio = audioFile;
    audio.play().catch(err => console.log("Errore audio:", err));
    await saveLog(materia,minutes);
    minutesValue.textContent = 0;
    resetForm();
    form.classList.remove("hidden");
    timerContainer.classList.add("hidden");
    materie = await getAllMaterie();
    materieCreateComponent(materie);
    daySelect.classList.remove("hidden");
    drawDayChart();
    return;
  }
  updateTimerDisplay(remaining);
}

function updateTimerDisplay(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  timerDisplay.textContent =
    `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

async function getTime(minutes){
    return minutes / 60;
}


function changeMonth(offset) {
try{
    let [year, month] = monthSelect.value.split("-").map(Number);
    if(month === 12 || month === 1){
        if(offset < 0 && month === 1){
            year += offset;
            month = 13;
        }
        if(offset > 0 && month === 12){
            year += offset;
            month = 0;
        }
    }
    const newAnno =  year;
    const newMese = String(month + offset).padStart(2, "0");
    monthSelect.value = `${newAnno}-${newMese}`;
    drawChart();
    drawPieChart();
    }catch(err){
        console.log(err)
    }
}

async function setDate(){
        const oggi = new Date();
        const anno = oggi.getFullYear();
        const mese = String(oggi.getMonth() + 1).padStart(2, "0");
        monthSelect.value = `${anno}-${mese}`;
}

async function setDay(){
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() +1).padStart(2,'0');
        const d = String(today.getDate()).padStart(2,'0');
        const formatted = `${y}-${m}-${d}`;
        daySelect.value = formatted;
        drawDayChart();
}

export async function setDateEsami(dataEsami){
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() +1).padStart(2,'0');
        const d = String(today.getDate()).padStart(2,'0');
        const formatted = `${y}-${m}-${d}`;
        dataEsami.value = formatted;
}

async function saveLog(materiaIns, minutes, data) {
    let formatted;
    if(!isValid(data)){
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        formatted = `${yyyy}-${mm}-${dd}`;
    }else{
        formatted = data;
    }

    const time = await getTime(minutes);
    const materiaCap = capitalizeFirstLetter(materiaIns);
    const existLog = await updateOreInLogs(time, formatted, materiaCap)
    if(!existLog){
        const log = {
            data: formatted,
            materia: materiaCap,
            ore: time
        };
        const materia ={
            nome: materiaCap
        }
        let matExist = false;
        for(const mat of materie){
            if(mat.nome === materiaCap){
                matExist = true;
            }
        }
        if(!matExist) await saveMateria(materia);
        await saveStudyLog(log);
    }
}

export function capitalizeFirstLetter(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function resetForm() {
    form.reset();
    form.classList.remove("hidden");
    timerContainer.classList.add("hidden");
    timerDisplay.textContent = "00:00";
}

async function materieCreateComponent(mats) {
    const materieList = document.getElementById('categorieCardsEntrata');
    materieList.innerHTML = "";
    for(const materia of mats){
        const nodo = await materiaComponent(materia.nome);
        materieList.appendChild(nodo);
    }
}

async function materiaComponent(materia) {
    const container = document.createElement("div");
    container.classList.add("cat");
    let pressTimer;
    container.innerHTML = `
        <span class="mat-name">${materia}</span>
    `;

    container.addEventListener("click", () => {
        const materiaEl = container.querySelector("span");
        const materiaInput = document.getElementById("ricerca-materie");
        if(isValid(materiaEl)) materiaInput.value = materiaEl.innerText;
    });

    const span = container.querySelector('.mat-name');
    container.addEventListener("touchstart", () => {
    pressTimer = setTimeout(() => {
        const input = document.createElement("input");
        const btnDelete = document.createElement("button");
        input.type = "text";
        const oldValue = span.textContent.trim();
        input.value = oldValue
        input.maxLength = 20;
        input.id = "updateMat";
        btnDelete.textContent = "❌";
        btnDelete.id = "delMat";
        btnDelete.classList.add("btn-delete");
        btnDelete.setAttribute("tabindex", "-1");
        if (!container.querySelector(".btn-delete")) {
          container.appendChild(btnDelete);
          btnDelete.addEventListener("click",async () => {
            container.remove();
            deleteMaterie(oldValue);
            materie = await getAllMaterie();
            materieCreateComponent(materie);
            drawDayChart();
          });
        }

        span.replaceWith(input);
        input.focus();

        const confirm = async () => {
            const newValue = input.value.trim() || materia;
            span.textContent = newValue;
            try{ input.replaceWith(span); }catch{}
            if (oldValue !== newValue) {
                await updateMateria(oldValue, newValue);
            }
            materie = await getAllMaterie();
            materieCreateComponent(materie);

        };


        const notConfirm = async () => {
            btnDelete.remove();
            span.textContent = oldValue;
            try{ input.replaceWith(span); }catch{}
        };

        input.addEventListener("blur",(ev) => {
          if (ev.relatedTarget === btnDelete) return;
          notConfirm(); },{ once: true } );

        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                confirm();
            }
        });
    }, 600);
});

    container.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
    });

    return container;
}

export async function creaEsamiPage(){
    const newCardDiv = document.getElementById('newEsamiCard');
    const esamiCards = document.getElementById('esamiCards');
    const mediaDiv = document.getElementById('media');
    let prodottoVotiCrediti = 0;
    let totCrediti = 0;
    newCardDiv.innerHTML = "";
    esamiCards.innerHTML = "";
    media.innerHTML = "";

    const newCardComp = await creaCardInsEsame();
    newCardDiv.appendChild(newCardComp);

    const cards = await getAllEsami();
    cards.forEach(card => {
        const esame = creaEsameComponent(card);
        esamiCards.appendChild(esame);
        const creditiParse = parseInt(card.crediti, 10);
        prodottoVotiCrediti += (parseInt(card.voto, 10) * creditiParse);
        totCrediti += creditiParse;
    });
    if(cards.length !== 0){
        const media = prodottoVotiCrediti / totCrediti;
        const mediaComp = mediaComponent("Crediti: " + totCrediti ,"Media: " + media.toFixed(2));
        mediaDiv.appendChild(mediaComp);
    }else{
        const mediaComp = mediaComponent("Nessun esame inserito","");
        mediaDiv.appendChild(mediaComp);
    }

}


function formatOreMin(oreDecimal) {
    const h = Math.floor(oreDecimal);
    const min = Math.round((oreDecimal - h) * 60);
    return `${h}h ${min}min`;
}

async function getMaxMonth(logs){
    const minValue = 4;
    let max = 0.0;
    logs.forEach( log => {
        const date = log.data;
        let sum = 0.0;
        for(const l of logs){
            if(date === l.data){
                sum += l.ore;
            }
        }
        if(sum > max){
            max = sum;
        }
    })
    if(max > minValue){
        return Math.ceil(max);
    }else{
        return minValue;
    }
}

async function getMaxDay(logs){
    const minValue = 4;
    let max = 0.0;
    logs.forEach( log => {
    const mat = log.materia;
        let sum = 0.0;
        for(const l of logs){
            if(mat === l.materia){
                sum += l.ore;
            }
        }
        if(sum > max){
            max = sum;
        }
    })
    if(max > minValue){
        return Math.ceil(max) + Math.ceil(max/5) + 2;
    }else{
        if(max > 3) return 5;
        return minValue;
    }
}

async function drawChart() {
    const echarts = window.echarts;
    const chart = echarts.init(document.getElementById('myChart'));
    const selectedMonth = monthSelect.value;
    const nomeMese = await capitalizeFirstLetter(await getNomeMeseItaliano(selectedMonth));
    let logs = await getStudyLogsByMonth(selectedMonth);
    materie = await getAllMaterie();
    const nomeMaterie = materie.map(m => m.nome);
    const maxValue = await getMaxMonth(logs);
    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const giorniDelMese = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const datiMaterie = {};
    nomeMaterie.forEach(m => {
        datiMaterie[m] = Array(daysInMonth).fill(0);
    });

    logs.forEach(log => {
        const giorno = new Date(log.data).getDate();
        const idx = giorno - 1;
        const val = parseFloat(log.ore) || 0;
        if(val > 0){
            datiMaterie[log.materia][idx] = (datiMaterie[log.materia][idx] || 0) + val;
        }
    });

    const materieConDati = nomeMaterie.filter(m =>
        datiMaterie[m].some(val => val > 0)
    );


    const series = materieConDati.map(m => ({
        name: m,
        type: 'bar',
        stack: 'total',
        emphasis: { focus: 'series' },
        data: datiMaterie[m]
    }));

    // Configurazione grafico
    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: params => {
                let str = `${params[0].axisValue}<br/>`;
                params.forEach(p => {
                if(p.value !== 0){
                    str += `${p.seriesName}: ${formatOreMin(p.value)}<br/>`;
                }

                });
                return str;
            }
        },
        legend: {
            data: materieConDati,
            orient: 'horizontal',
            type: 'scroll',
            right: 10,
            top: 10,
            pageButtonGap: 5,
            pageIconColor: '#2f4554',
            pageIconInactiveColor: '#aaa',
            pageTextStyle: { color: '#333' }
        },

        xAxis: {
            type: 'value',
            min: 0,
            max: maxValue,
            axisLabel: {
                formatter: val => `${val}h`
            }
        },
        yAxis: {
            type: 'category',
            data: giorniDelMese.map(g => `${g}`),
            name: nomeMese,
            nameGap: 5
        },
        grid: { bottom: '5%'},
        series: series
    };
    chart.clear();
    chart.setOption(option);

}

async function drawPieChart(){
    const echarts = window.echarts;
    const pieChart = echarts.init(document.getElementById('myChartPie'));

    const aggregate = {};
    const selectedMonth = monthSelect.value;
    const nameMese = getNomeMeseItaliano(selectedMonth);
    let logs = await getStudyLogsByMonth(selectedMonth);
    logs.forEach(item =>{
        const materia = item.materia;
        if(!aggregate[materia]){
            aggregate[materia] = 0;
        }
        aggregate[materia] += item.ore;
    });

    const data = Object.entries(aggregate).map(([name, value]) => ({name, value})).sort((a, b) => a.name.localeCompare(b.name));
    const totale = data.reduce((acc, item) => acc + item.value, 0);

    const option = {
        tooltip: {
        trigger: 'item',
        formatter: function (params) {
                return `${params.name}: ${formatOreMin(params.value)}`
            }
        },

        legend: {
            orient: 'horizontal',
            type: 'scroll',
            right: 10,
            top: 10,
            pageButtonGap: 5,
            pageIconColor: '#2f4554',
            pageIconInactiveColor: '#aaa',
            pageTextStyle: { color: '#333' }
        },
        series: [
            {
                name: nameMese,
                type: 'pie',
                radius: ['50%','90%'],
                center: ['48%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    position: 'center',
                    formatter: ()=> `${formatOreMin(totale)}`,
                    fontSize: 18,
                    fontWeight: 'bold',
                    lineHeight: 22
                },
                labelLine: {
                    show:false
                },
                data: data
            }
          ],
          grid: { left: '2.5%', right: '2.5%', top: '10%', bottom: '0%'}
    }

    pieChart.setOption(option);
    attachLegendHandler(pieChart);

}

function attachLegendHandler(chart){
    chart.on('legendselectchanged', function (params){
        const option = chart.getOption();
        const selected = params.selected;
        const data = option.series[0].data;
        const newTotal = data.reduce((acc, item) => {return selected[item.name] ? acc + item.value : acc; }, 0);
        option.series[0].label.formatter = () => `${formatOreMin(newTotal)}`;
        chart.setOption(option);
    });

}


function getNomeMeseItaliano(ym) {
    const [year, month] = ym.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleString('it-IT', { month: 'long' });
}

async function drawDayChart() {
    const echarts = window.echarts;
    const chart = echarts.init(document.getElementById('dayChart'));
    const selectedDay = daySelect.value;
    let logs = await getStudyLogsByDay(selectedDay);
    materie = await getAllMaterie();
    const nomeMaterie = materie.map(m => m.nome);
    const maxValue = await getMaxDay(logs);

    const dati = nomeMaterie.reduce((acc, m) => {
        acc[m] = 0;
        return acc;
    }, {});

    logs.forEach(log => {
       const val = parseFloat(log.ore) || 0;
       if(dati[log.materia] !== undefined){
        dati[log.materia] += val;
       } else{
        dati[log.materia] = val;
       }
    });

    const colorPalette  = [
    '#5470C6', '#91CC75', '#EE6666', '#73C0DE', '#FAC858',
        '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC'
    ];

    const filteredMaterie = nomeMaterie.filter(m => dati[m] > 0);
    let zeroLog = '';
    if(filteredMaterie.length === 0) zeroLog = 'Nessuna sessione registrata'
    const series = [{
        name: '',
        type: 'bar',
        data: filteredMaterie.map((m, idx) => {
            const valueForMateria = dati[m] || 0;
            return{
                value: valueForMateria,
                itemStyle: {
                    color: colorPalette [idx % colorPalette .length]
                }
            }
        }),
        label: {
            show: true,
            position: 'right',
            formatter: params => formatOreMin(params.value)
        }
    }];

    // Configurazione grafico
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: params => `${params.name}: ${formatOreMin(params.value)}`
        },

        xAxis: {
            type: 'value',
            min: 0,
            max: maxValue,
            axisLabel: {
                formatter: val => `${val}h`
            }
        },
        yAxis: {
            type: 'category',
            name: zeroLog,
            nameLocation: 'middle',
            nameRotate: 0,
            nameGap: -250,
            nameTextStyle: {
                fontSize: 14,
                fontWeight: 'bold',
                color: '#333'
            },
            data: filteredMaterie,
            axisLabel: { show: false }
        },
        grid: { left: '2.5%', right: '2.5%', top: '10%', bottom: '9%'},
        series: series
    };
    chart.clear();
    chart.setOption(option);
    dayChart.classList.remove('hidden');


let pressTimer;
const pressDuration = 700;

chart.on('mousedown', function(params) {
  pressTimer = setTimeout(() => {
        const materia = params.name;
        const giorno = selectedDay;
        const valoreAttuale = params.value;
        const ore = Math.floor(valoreAttuale);
        const minuti = Math.round((valoreAttuale - ore) * 60);
        document.getElementById('materiaDisplay').textContent = `${materia}`;
        document.getElementById('giornoDisplay').textContent = `${giorno}`;
        document.getElementById('nuoveOre').value = ore;
        document.getElementById('nuoviMinuti').value = minuti;

        const form = document.getElementById('editform');
        form.classList.remove('hidden')
        document.getElementById('saveBtn').onclick = async function() {
        const nuoveOre = parseFloat(document.getElementById('nuoveOre').value);
        const nuoviMinuti = parseFloat(document.getElementById('nuoviMinuti').value) / 60;
        const oreDecimale = nuoveOre + nuoviMinuti;
            if(isValid(nuoveOre) && nuoviMinuti < 0.999 && nuoveOre < 24){
                await updateOreInLogs(oreDecimale - valoreAttuale, giorno, materia);
                drawDayChart();
            }else{
                showErrorToast('Valore inserito non valido','error')
            }
            form.classList.add('hidden');
        }

        document.getElementById('cancelBtn').onclick = function() {
            form.classList.add('hidden');
        }
        document.getElementById('deleteBtn').onclick = async function() {
            await deleteLogByMateriaData(giorno, materia);
            await drawDayChart();
            form.classList.add('hidden');
        }
     }, pressDuration);
    });

    chart.on('mouseup', function() {
      clearTimeout(pressTimer);
    });

    chart.on('mouseleave', function() {
      clearTimeout(pressTimer);
    });

}


