import { saveStudyLog, getAllStudyLogs, saveMateria, getAllMaterie, getStudyLogsByMonth, deleteDatabase } from "./query.js";


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
const materiaInput = document.getElementById("ricerca-materie");
const minutesSlider = document.getElementById("minutes");
const minutesValue = document.getElementById("minutes-value");
const timerContainer = document.getElementById("timer-container");
const timerDisplay = document.getElementById("timer-display");
const stopBtn = document.getElementById("stop-btn");
const monthSelect = document.getElementById('month-select');
const prevBtn = document.getElementById("prev-month");
const nextBtn = document.getElementById("next-month");
const deleteBtn = document.getElementById("delete-db-btn");
const modal = document.getElementById("confirm-modal");
const confirmDelete = document.getElementById("confirm-delete");
const cancelDelete = document.getElementById("cancel-delete");
let countdown;
let remainingTime;
let startTime = null;
let durationMs = 0;
let timerInterval = null;
let materia;
let minutes;
let materie;


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
            }
            if(targetId === "registra"){
                materie = await getAllMaterie();
                materieCreateComponent(materie);
            }

            sections.forEach(section => {
                section.classList.remove("active");
                if (section.id === targetId) section.classList.add("active");
            });
        });
    });



document.addEventListener("DOMContentLoaded", async() => {

prevBtn.addEventListener("click", () => changeMonth(-1));
nextBtn.addEventListener("click", () => changeMonth(1));

    minutesSlider.addEventListener("input", () => {
        minutesValue.textContent = minutesSlider.value;
    });
    monthSelect.addEventListener('change', drawChart);
    materie = await getAllMaterie();
    materieCreateComponent(materie);



    form.addEventListener("submit", (e) => {
      e.preventDefault();
      startTimer();
      form.classList.add("hidden");
      timerContainer.classList.remove("hidden");
      materia = materiaInput.value.trim();
      minutes = parseInt(minutesValue.innerText, 10);
    });


    stopBtn.addEventListener("click", () => {
      stopTimer();
      minutesValue.textContent = 60;
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

function startTimer() {
  const minutes = parseInt(minutesSlider.value, 10);
  durationMs = minutes * 60 * 1000;
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTimer() {
  clearInterval(timerInterval);
  startTime = null;
  durationMs = 0;
  updateTimerDisplay(0);
}

async function updateTimer() {
  const elapsed = Date.now() - startTime;
  const remaining = durationMs - elapsed;

  if (remaining <= 0) {
    clearInterval(timerInterval);
    updateTimerDisplay(0);
    const audio = new Audio("assets/sounds/alarm.mp3");
    audio.play().catch(err => console.log("Errore audio:", err));
    await saveLog(materia,minutes);
    minutesValue.textContent = 60;
    resetForm();
    form.classList.remove("hidden");
    timerContainer.classList.add("hidden");
    materie = await getAllMaterie();
    materieCreateComponent(materie);
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

async function saveLog(materiaIns, minutes) {
    const today = new Date().toISOString().split("T")[0];
    const time = await getTime(minutes);
    const materiaCap = capitalizeFirstLetter(materiaIns);

    const log = {
        data: today,
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

function capitalizeFirstLetter(str) {
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
        container.innerHTML = `
          <div class="cat-header">
            <span>${materia}</span>
          </div>
        `;

            container.addEventListener("click", () => {
                const materiaEl = container.querySelector("span");
                const materiaInput = document.getElementById("ricerca-materie");
                materiaInput.value = materiaEl.innerText;
            });

        return container;
    }

function formatOreMin(oreDecimal) {
    const h = Math.floor(oreDecimal);
    const min = Math.round((oreDecimal - h) * 60);
    return `${h}h ${min}min`;
}

async function getMax(logs){
    let sum = 0.0;
    const minValue = 6;
    logs.forEach( log => {
    sum += log.ore
    })
    if(sum > minValue){
        return Math.ceil(sum);
    }else{
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
    const maxValue = await getMax(logs);
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
        datiMaterie[log.materia][idx] = (datiMaterie[log.materia][idx] || 0) + val;
    });

    const materieConDati = nomeMaterie.filter(m =>
        datiMaterie[m].some(val => val > 0)
    );

    const series = nomeMaterie.map(m => ({
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
            data: nomeMaterie,
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
            interval: 1,
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
        series: series
    };

    chart.setOption(option);

}

    function getNomeMeseItaliano(ym) {
        const [year, month] = ym.split('-').map(Number);
        const date = new Date(year, month - 1);
        return date.toLocaleString('it-IT', { month: 'long' });
    }
