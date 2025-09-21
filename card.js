import { saveEsame, showErrorToast, updateEsami} from './query.js'
import { creaEsamiPage, setDateEsami } from './main.js'

export function creaEsameComponent(esame) {

       const container = document.createElement("div");
       const btnDeleteEsame = document.getElementById('deleteEsami');

       container.classList.add("esame");
       container.setAttribute("id", esame.id);

       container.innerHTML = `
         <div class="esame-card">
            <div class="esame-content">
                 <div class="esame-body">
                      <div class="voto-data">
                          <span class="materiaEsame">${esame.materia}</span>
                          <small class="crediti">Crediti ${esame.crediti}</small>
                      </div>
                       <div class="voto-data">
                           <span class="voto">${esame.voto}</span>
                           <small class="data">${esame.data}</small>
                       </div>
                   </div>
             </div>
         </div>
       `;

         container.addEventListener("click", (e) => {
           e.stopPropagation();
           container.classList.toggle("selected");
         });

        let pressTimer;

        container.addEventListener("touchstart",async () => {
          pressTimer = setTimeout(() => {
            updateCardEsame(container, esame);
          }, 600);
        });

        container.addEventListener("touchend", () => {
          clearTimeout(pressTimer);
        });


       return container;
}

export async function creaCardInsEsame() {
    const container = document.createElement("div");
    const esamiCards = document.getElementById('esamiCards');

    container.innerHTML = `
        <div>
            <button class="add-btn">+</button>
        </div>
    `;

    const btn = container.querySelector(".add-btn");
    btn.addEventListener("click", async () => {
        container.innerHTML = `
            <form class="esame-card form-esame">
                 <div class="row">
                    <input type="text" maxlength="15" placeholder="Esame"  class="input-materia" required/>
                    <input type="number" placeholder="Crediti" class="input-crediti" min="0" max="30" required/>
                  </div>

                <div class="row">
                    <input type="date" class="input-data" id="dataEsami" required/>
                    <input type="number" placeholder="Voto" class="input-voto" min="0" max="30" required/>
                </div>

                <div class="button-row">
                    <button type="submit" class="save-btn">Salva</button>
                    <button class="cancel-btn">Annulla</button>
                </div>
            </form>
        `;

        const esamiData = document.getElementById('dataEsami');
        await setDateEsami(esamiData);
        const saveBtn = container.querySelector(".save-btn");
        const cancelBtn = container.querySelector(".cancel-btn");

        const form = container.querySelector("form");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const materia = container.querySelector(".input-materia").value;
            const data = container.querySelector(".input-data").value;
            const voto = container.querySelector(".input-voto").value;
            const crediti = container.querySelector(".input-crediti").value;

            if (materia && data && voto && voto < 31 && voto > 0) {
                const nuovoEsame = { materia, data, voto, crediti };
                await saveEsame(nuovoEsame);
                await creaEsamiPage();
            }
        });

        cancelBtn.addEventListener("click", async () => {
           container.innerHTML= "";
           const ripristinaCard = await creaCardInsEsame();
           container.replaceWith(ripristinaCard);

        });
    });

    return container;
}

export function mediaComponent(mediaText, media) {
        const container = document.createElement("div");
        container.classList.add("mediaComp");
           container.innerHTML = `
             <div class="mediaDiv">
                <span class="media"> ${mediaText} </span> <span class="media"> ${media} </span>
             </div>
           `;

               return container;
}


export async function updateCardEsame(esame, esameValue) {
    const container = document.createElement("div");
    const esamiCards = document.getElementById('esamiCards');
    const dataValue = new Date(esameValue.data).toISOString().split("T")[0];

        container.innerHTML = `
            <form class="esame-card form-esame">
             <div class="row">
                <input type="text" maxlength="15" placeholder="Esame" value="${esameValue.materia}" class="input-materia" required/>
                <input type="number" placeholder="Crediti" value="${esameValue.crediti}" class="input-crediti" min="0" max="30" required/>
              </div>

                <div class="row">
                    <input type="date" class="input-data"  value="${dataValue}" required/>
                    <input type="number" placeholder="Voto" value="${esameValue.voto}" class="input-voto" min="0" max="30" required/>
                </div>

                <div class="button-row">
                    <button type="submit" class="save-btn">Salva</button>
                    <button class="cancel-btn">Annulla</button>
                </div>
            </form>
        `;

        const saveBtn = container.querySelector(".save-btn");
        const cancelBtn = container.querySelector(".cancel-btn");

        const form = container.querySelector("form");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const materia = container.querySelector(".input-materia").value;
            const data = container.querySelector(".input-data").value;
            const voto = container.querySelector(".input-voto").value;
            const crediti = container.querySelector(".input-crediti").value;
            const id = esameValue.id;


            if (materia && data && voto && voto < 31 && voto > 0) {
                const updatedEsame = { materia, data, voto, crediti,id };
                await updateEsami(updatedEsame);
                await creaEsamiPage();
            }else{
                showErrorToast('Valore inserito non valido','error')
            }
        });

        cancelBtn.addEventListener("click", () => {
           container.innerHTML= "";
           const ripristinaCard = creaCardInsEsame();
           container.replaceWith(esame);

        });

    esame.replaceWith(container);
}


