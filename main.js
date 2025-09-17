import { saveStudyLog, getAllStudyLogs, saveMateria, getAllMaterie, getStudyLogsByMonth, deleteDatabase } from "./query.js";


/////////  SERVICE WORKER ////////////////
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered:', reg))
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}



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
const chartDom = document.getElementById('myChart');
const myChart = echarts.init(chartDom);
const deleteBtn = document.getElementById("delete-db-btn");
const modal = document.getElementById("confirm-modal");
const confirmDelete = document.getElementById("confirm-delete");
const cancelDelete = document.getElementById("cancel-delete");

document.addEventListener("DOMContentLoaded", async() => {
    const links = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll(".page-section");
    document.getElementById("ricerca-materie").addEventListener("input", materieCreateComponent);

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

            sections.forEach(section => {
                section.classList.remove("active");
                if (section.id === targetId) section.classList.add("active");
            });
        });
    });


async function setDate(){
        const oggi = new Date();
        const anno = oggi.getFullYear();
        const mese = String(oggi.getMonth() + 1).padStart(2, "0");
        monthSelect.value = `${anno}-${mese}`;
}

function changeMonth(offset) {
try{
    let [year, month] = monthSelect.value.split("-").map(Number);
    if(month === 12 || month === 1){
        if(offset < 0 && month === 1){
            year = year + offset;
        }
        if(offset > 0 && month === 12){
            year = year + offset;
        }
    }
    const newAnno = year;
    const newMese = String(month + offset).padStart(2, "0");
    monthSelect.value = `${newAnno}-${newMese}`;
    drawChart();
    }catch(err){
        console.log(err)
    }
}

prevBtn.addEventListener("click", () => changeMonth(-1));
nextBtn.addEventListener("click", () => changeMonth(1));

    minutesSlider.addEventListener("input", () => {
        minutesValue.textContent = minutesSlider.value;
    });
    monthSelect.addEventListener('change', drawChart);

    let countdown;
    let remainingTime;
    const materie = await getAllMaterie();
    materieCreateComponent(materie)

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const materia = materiaInput.value.trim();
        const minutes = parseInt(minutesValue.innerText, 10);

        if (!materia || minutes <= 0) return;

        remainingTime = minutes * 60;
        updateDisplay();

        timerContainer.classList.remove("hidden");
        form.classList.add("hidden");

        countdown = setInterval(() => {
            remainingTime--;
            updateDisplay();

            if (remainingTime <= 0) {
                clearInterval(countdown);
                saveLog(materia, minutes);
                minutesValue.textContent = 60;
                resetForm();
            }
        }, 1000);
    });

    stopBtn.addEventListener("click", () => {
        clearInterval(countdown);
        resetForm();
    });

    function updateDisplay() {
        const mins = Math.floor(remainingTime / 60);
        const secs = remainingTime % 60;
        timerDisplay.textContent =
            `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

async function getTime(minutes){
    return minutes / 60;
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

    async function materieCreateComponent(materie) {
        const catInput = document.getElementById("ricerca-materie").value;
        const materieList = document.getElementById('categorieCardsEntrata');
        materieList.innerHTML = "";
        for(const materia of materie){
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
        const minValue = 8;
        logs.forEach( log => {
        sum += log.ore
        })
        if(sum > 8){
            return Math.ceil(sum);
        }else{
            return minValue;
        }
    }

async function drawChart() {
    const selectedMonth = monthSelect.value;
    const nomeMese = await capitalizeFirstLetter(await getNomeMeseItaliano(selectedMonth));
    let logs = await getStudyLogsByMonth(selectedMonth);
    const materie = await getAllMaterie();
    const nomeMaterie = materie.map(m => m.nome);
    const mavValue = await getMax(logs);

    const filteredLogs = logs.filter(l => l.data.startsWith(selectedMonth));

    const year = parseInt(selectedMonth.split('-')[0]);
    const month = parseInt(selectedMonth.split('-')[1]) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const giorniDelMese = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const datiMaterie = {};
    nomeMaterie.forEach(m => {
        datiMaterie[m] = Array(daysInMonth).fill(0);
    });

    filteredLogs.forEach(log => {
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
            max: mavValue,
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

    myChart.setOption(option);

}

    function getNomeMeseItaliano(ym) {
        const [year, month] = ym.split('-').map(Number);
        const date = new Date(year, month - 1);
        return date.toLocaleString('it-IT', { month: 'long' });
    }

});


