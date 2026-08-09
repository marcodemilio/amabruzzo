let stazioni = [];
let specieSelezionata = "Boletus edulis";

const specieFunghi = [
    { nome: "Boletus edulis", altMin: 900, altMax: 1800, rainReq: 60, piccoGiorno: 6 },
    { nome: "Boletus aestivalis", altMin: 600, altMax: 1400, rainReq: 40, piccoGiorno: 4 },
    { nome: "Boletus aereus", altMin: 200, altMax: 1000, rainReq: 35, piccoGiorno: 3 },
    { nome: "Agaricus campestris", altMin: 0, altMax: 2000, rainReq: 25, piccoGiorno: 2 },
    { nome: "Agaricus arvensis", altMin: 300, altMax: 1600, rainReq: 30, piccoGiorno: 4 },
    { nome: "Macrolepiota procera", altMin: 0, altMax: 1800, rainReq: 35, piccoGiorno: 5 },
    { nome: "Cantharellus cibarius", altMin: 700, altMax: 1600, rainReq: 70, piccoGiorno: 7 }
];

function parseCSV(text) {
    if (!text) return [];
    let lines = text.split(/\r?\n/);
    return lines.map(line => {
        let result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            let char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }).filter(row => row.length > 0 && row[0] !== "");
}

async function caricaFileAutomaticamente() {
    const statusEl = document.getElementById('status-text');
    try {
        statusEl.innerText = "Download dei dati meteorologici in corso...";
        
        // Utilizziamo Promise.all per scaricare i file in parallelo in modo sicuro su GitHub Pages
        const [resStazioni, resMeteo] = await Promise.all([
            fetch('stazioni_meteo.csv'),
            fetch('dati_meteo_30g.csv')
        ]);

        if (!resStazioni.ok) throw new Error(`Impossibile scaricare stazioni_meteo.csv (Stato: ${resStazioni.status})`);
        if (!resMeteo.ok) throw new Error(`Impossibile scaricare dati_meteo_30g.csv (Stato: ${resMeteo.status})`);

        statusEl.innerText = "Elaborazione dei dataset AMAbruzzo...";
        
        const textStazioni = await resStazioni.text();
        const textMeteo = await resMeteo.text();

        let rawStazioni = parseCSV(textStazioni);
        let rawMeteo = parseCSV(textMeteo);

        if (rawStazioni.length <= 1) throw new Error("Il file stazioni_meteo.csv non contiene righe di dati valide.");
        if (rawMeteo.length <= 1) throw new Error("Il file dati_meteo_30g.csv non contiene righe di dati valide.");

        elaboraDati(rawStazioni, rawMeteo);

    } catch (error) {
        statusEl.innerHTML = 
            `<span style="color: #b91c1c; font-size: 1.1rem; font-weight: bold;">⚠️ Errore di Sincronizzazione</span><br>` +
            `<p style="color: #374151; font-weight: normal; margin: 10px 0;">Dettaglio: ${error.message}</p>` +
            `<small style="color: #6b7280; font-weight: normal;">Controlla la console del browser (tasto F12) per maggiori informazioni sul tracciamento.</small>`;
        console.error("Errore Sincronizzazione Repository:", error);
    }
}

function elaboraDati(rawStazioni, rawMeteo) {
    const statusEl = document.getElementById('status-text');
    stazioni = [];

    // Pulizia e normalizzazione indici intestazioni
    let headerStazioni = rawStazioni[0].map(h => h.toLowerCase().replace(/\s+/g, '').replace(/"/g, ''));
    let idxIdStaz = headerStazioni.indexOf('id');
    let idxNomeStaz = headerStazioni.findIndex(h => h.includes('stazione'));
    let idxLink = headerStazioni.findIndex(h => h.includes('link') || h.includes('indirizzo'));
    let idxAlt = headerStazioni.findIndex(h => h.includes('altitudine'));

    let headerMeteo = rawMeteo[0].map(h => h.toLowerCase().replace(/\s+/g, '').replace(/"/g, ''));
    let idxMeteoId = headerMeteo.indexOf('id');
    let idxPioggia = headerMeteo.findIndex(h => h.includes('pioggia'));

    if(idxIdStaz === -1 || idxNomeStaz === -1 || idxMeteoId === -1 || idxPioggia === -1) {
        statusEl.innerHTML = `<b>Errore Mappatura Colonne CSV:</b><br>` +
            `Colonne Stazioni: [${headerStazioni.join(', ')}]<br>` +
            `Colonne Meteo: [${headerMeteo.join(', ')}]<br>` +
            `<small>Verifica i nomi delle intestazioni nella prima riga dei tuoi file excel.</small>`;
        return;
    }

    // Calcolo cumulativo delle piogge degli ultimi 30 giorni per ID stazione
    let mappaPioggia = {};
    for (let i = 1; i < rawMeteo.length; i++) {
        let riga = rawMeteo[i];
        if (!riga || riga.length <= Math.max(idxMeteoId, idxPioggia)) continue;
        
        let id = riga[idxMeteoId].trim();
        let pioggiaVal = parseFloat(riga[idxPioggia]);
        if (!isNaN(pioggiaVal) && id) {
            if (!mappaPioggia[id]) mappaPioggia[id] = 0;
            mappaPioggia[id] += pioggiaVal;
        }
    }

    // Aggregazione dati anagrafici stazioni abruzzesi
    for (let i = 1; i < rawStazioni.length; i++) {
        let riga = rawStazioni[i];
        if (!riga || riga.length <= Math.max(idxIdStaz, idxNomeStaz, idxAlt)) continue;
        
        let id = riga[idxIdStaz].trim();
        if (!id) continue;

        let nome = riga[idxNomeStaz] || "Stazione " + id;
        let link = riga[idxLink] || "#";
        let altitudine = parseInt(riga[idxAlt]);
        if (isNaN(altitudine)) altitudine = 0;
        
        let totalePioggia = mappaPioggia[id] || 0;

        stazioni.push({
            id: id,
            nome: nome,
            link: link,
            alt: altitudine,
            rain30g: totalePioggia
        });
    }

    if (stazioni.length === 0) {
        statusEl.innerText = "Errore: Impossibile accoppiare i record dei file CSV.";
        return;
    }

    // Sblocco dell'interfaccia grafica
    statusEl.style.display = "none";
    document.getElementById('tabs').style.display = "flex";
    document.getElementById('table-area').style.display = "block";
    
    costruisciBottoni();
    renderTabella(specieSelezionata);
}

function calcolaProbabilita(stazione, fungo, giorno) {
    if (!stazione || !fungo) return 0;
    
    let score = 100;
    let rain = parseFloat(stazione.rain30g);
    let alt = parseInt(stazione.alt);
    
    if (isNaN(rain)) rain = 0;
    if (isNaN(alt)) alt = 0;

    if (rain < fungo.rainReq) {
        score -= ((fungo.rainReq - rain) / fungo.rainReq) * 60; 
    }
    
    if (alt < fungo.altMin || alt > fungo.altMax) {
        let distanza = Math.min(Math.abs(alt - fungo.altMin), Math.abs(alt - fungo.altMax));
        score -= (distanza / 2);
    }
    
    score -= (Math.abs(giorno - fungo.piccoGiorno) * 7);
    score = Math.max(0, Math.min(95, Math.round(score)));

    if (rain < 30 && (fungo.nome === "Boletus edulis" || fungo.nome === "Cantharellus cibarius")) {
        score = Math.round(score * 0.1);
    }
    
    return isNaN(score) ? 0 : score;
}

function ottieniClasseStile(prob) {
    let p = parseInt(prob);
    if (isNaN(p) || p < 15) return 'prob-none';
    if (p >= 75) return 'prob-high';
    if (p >= 40) return 'prob-medium';
    return 'prob-low';
}

function renderTabella(fungoNome) {
    specieSelezionata = fungoNome;
    const fungo = specieFunghi.find(f => f.nome === fungoNome);
    if (!fungo) return;
    
    document.getElementById('current-mushroom-title').innerText = `Probabilità di nascita per: ${fungo.nome}`;
    
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    stazioni.forEach(stazione => {
        const tr = document.createElement('tr');
        let pioggiaMostrata = 0;
        if (stazione.rain30g && !isNaN(parseFloat(stazione.rain30g))) {
            pioggiaMostrata = parseFloat(stazione.rain30g).toFixed(1);
        }
        
        tr.innerHTML = `
            <td><a class="station-link" href="${stazione.link}" target="_blank">🔗 ${stazione.nome}</a></td>
            <td>${stazione.alt} m</td>
            <td style="font-weight: 500;">${pioggiaMostrata} mm</td>
        `;

        for (let g = 1; g <= 10; g++) {
            let prob = calcolaProbabilita(stazione, fungo, g);
            let classe = ottieniClasseStile(prob);
            tr.innerHTML += `<td class="${classe}">${prob}%</td>`;
        }
        tbody.appendChild(tr);
    });
}

function costruisciBottoni() {
    const tabsContainer = document.getElementById('tabs');
    tabsContainer.innerHTML = '';
    specieFunghi.forEach((fungo) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${fungo.nome === specieSelezionata ? 'active' : ''}`;
        btn.innerText = fungo.nome;
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTabella(fungo.nome);
        };
        tabsContainer.appendChild(btn);
    });
}

window.onload = function() {
    caricaFileAutomaticamente();
};
