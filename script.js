let stazioni = [];
let specieSelezionata = "Boletus edulis";
let datiPrevisioniMeteo = {}; // Salverà le previsioni live delle stazioni

const specieFunghi = [
    { nome: "Boletus edulis", altMin: 1000, altMax: 1800, rainReq: 60, tempOttimale: 15, termofilo: false },
    { nome: "Boletus aestivalis", altMin: 700, altMax: 1400, rainReq: 40, tempOttimale: 22, termofilo: true },
    { nome: "Boletus aereus", altMin: 200, altMax: 1000, rainReq: 35, tempOttimale: 24, termofilo: true },
    { nome: "Agaricus campestris", altMin: 0, altMax: 2000, rainReq: 25, tempOttimale: 18, termofilo: false },
    { nome: "Agaricus arvensis", altMin: 300, altMax: 1600, rainReq: 30, tempOttimale: 16, termofilo: false },
    { nome: "Macrolepiota procera", altMin: 0, altMax: 1800, rainReq: 35, tempOttimale: 19, termofilo: false },
    { nome: "Cantharellus cibarius", altMin: 800, altMax: 1600, rainReq: 70, tempOttimale: 18, termofilo: false }
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
    }).filter(row => row.length > 0 && row !== "");
}

async function caricaFileAutomaticamente() {
    const statusEl = document.getElementById('status-text');
    try {
        statusEl.innerText = "Download dei dati meteorologici locali...";
        const [resStazioni, resMeteo] = await Promise.all([
            fetch('stazioni_meteo.csv'),
            fetch('dati_meteo_30g.csv')
        ]);

        if (!resStazioni.ok || !resMeteo.ok) throw new Error("File CSV non trovati nella repository.");

        const textStazioni = await resStazioni.text();
        const textMeteo = await resMeteo.text();

        let rawStazioni = parseCSV(textStazioni);
        let rawMeteo = parseCSV(textMeteo);

        await elaboraDati(rawStazioni, rawMeteo);

    } catch (error) {
        statusEl.innerHTML = `<span style="color: #b91c1c; font-weight: bold;">⚠️ Errore: ${error.message}</span>`;
        console.error(error);
    }
}

async function elaboraDati(rawStazioni, rawMeteo) {
    const statusEl = document.getElementById('status-text');
    stazioni = [];

    let headerStazioni = rawStazioni.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/"/g, ''));
    let idxIdStaz = headerStazioni.indexOf('id');
    let idxNomeStaz = headerStazioni.findIndex(h => h.includes('stazione'));
    let idxLink = headerStazioni.findIndex(h => h.includes('link') || h.includes('indirizzo'));
    let idxAlt = headerStazioni.findIndex(h => h.includes('altitudine'));
    let idxLat = headerStazioni.indexOf('lat');
    let idxLong = headerStazioni.indexOf('long');

    let headerMeteo = rawMeteo.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/"/g, ''));
    let idxMeteoId = headerMeteo.indexOf('id');
    let idxPioggia = headerMeteo.findIndex(h => h.includes('pioggia'));
    let idxTMin = headerMeteo.findIndex(h => h.includes('temperaturamin'));
    let idxTMax = headerMeteo.findIndex(h => h.includes('temperaturamax'));

    // 1. Analisi Storica (Pioggia cumulata e medie termiche dell'ultima settimana)
    let mappaMeteoStorico = {};
    for (let i = rawMeteo.length - 1; i >= 1; i--) {
        let riga = rawMeteo[i];
        if (!riga || riga.length <= Math.max(idxMeteoId, idxPioggia)) continue;
        
        let id = riga[idxMeteoId].trim();
        if (!id) continue;

        if (!mappaMeteoStorico[id]) {
            mappaMeteoStorico[id] = { rainTotal: 0, tempMinSum: 0, tempMaxSum: 0, tempGiorni: 0 };
        }

        let p = parseFloat(riga[idxPioggia]);
        let tMin = parseFloat(riga[idxTMin]);
        let tMax = parseFloat(riga[idxTMax]);

        if (!isNaN(p)) mappaMeteoStorico[id].rainTotal += p;
        
        // Prendiamo gli ultimi 7 record disponibili nel CSV per fare la media termica recente
        if (!isNaN(tMin) && !isNaN(tMax) && tMin !== 0 && tMax !== 0 && mappaMeteoStorico[id].tempGiorni < 7) {
            mappaMeteoStorico[id].tempMinSum += tMin;
            mappaMeteoStorico[id].tempMaxSum += tMax;
            mappaMeteoStorico[id].tempGiorni++;
        }
    }

    // 2. Costruzione del Dataset Stazioni
    for (let i = 1; i < rawStazioni.length; i++) {
        let riga = rawStazioni[i];
        if (!riga || riga.length <= Math.max(idxIdStaz, idxNomeStaz, idxAlt)) continue;
        
        let id = riga[idxIdStaz].trim();
        if (!id) continue;

        let storico = mappaMeteoStorico[id] || { rainTotal: 0, tempMinSum: 0, tempMaxSum: 0, tempGiorni: 1 };
        let mediaTMin = storico.tempMinSum / (storico.tempGiorni || 1);
        let mediaTMax = storico.tempMaxSum / (storico.tempGiorni || 1);

        stazioni.push({
            id: id,
            nome: riga[idxNomeStaz] || "Stazione " + id,
            link: riga[idxLink] || "#",
            alt: parseInt(riga[idxAlt]) || 0,
            lat: parseFloat(riga[idxLat]) || 42.35,
            lon: parseFloat(riga[idxLong]) || 13.40,
            rain30g: storico.rainTotal,
            storicoTMedia: (mediaTMin + mediaTMax) / 2 || 20 // Fallback se mancano i dati
        });
    }

    // 3. Interrogazione API Open-Meteo per le previsioni reali dei prossimi 10 giorni
    statusEl.innerText = "Interrogazione API Open-Meteo per le previsioni a 10 giorni...";
    for (let stazione of stazioni) {
        try {
            let url = `https://open-meteo.com{stazione.lat}&longitude=${stazione.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FRome&forecast_days=10`;
            let response = await fetch(url);
            if (response.ok) {
                let data = await response.json();
                datiPrevisioniMeteo[stazione.id] = data.daily; 
            }
        } catch (e) {
            console.warn(`Impossibile scaricare il meteo previsionale per la stazione ${stazione.nome}`);
        }
    }

    statusEl.style.display = "none";
    document.getElementById('tabs').style.display = "flex";
    document.getElementById('table-area').style.display = "block";
    
    costruisciBottoni();
    renderTabella(specieSelezionata);
}

function calcolaProbabilitaReale(stazione, fungo, indiceGiorno) {
    let score = 100;
    
    // VARIABILI STORICHE (CSV)
    let rainStorica = stazione.rain30g;
    let tMediaStorica = stazione.storicoTMedia;

    // VARIABILI PREVISIONALI LIVE (Se disponibili dall'API)
    let meteoFuturo = datiPrevisioniMeteo[stazione.id];
    let tMaxPrevista = meteoFuturo ? meteoFuturo.temperature_2m_max[indiceGiorno] : tMediaStorica + 2;
    let tMinPrevista = meteoFuturo ? meteoFuturo.temperature_2m_min[indiceGiorno] : tMediaStorica - 2;
    let pioggiaPrevista = meteoFuturo ? meteoFuturo.precipitation_sum[indiceGiorno] : 0;
    let tMediaPrevista = (tMaxPrevista + tMinPrevista) / 2;

    // 1. Valutazione Idrica (Storico + Pioggia cumulativa del giorno previsto)
    let acquaDisponibile = rainStorica + pioggiaPrevista;
    if (acquaDisponibile < fungo.rainReq) {
        score -= ((fungo.rainReq - acquaDisponibile) / fungo.rainReq) * 50;
    }

    // 2. Vincolo Altitudinale Ecologico
    if (stazione.alt < fungo.altMin || stazione.alt > fungo.altMax) {
        let distanza = Math.min(Math.abs(stazione.alt - fungo.altMin), Math.abs(stazione.alt - fungo.altMax));
        score -= (distanza / 3);
    }

    // 3. Analisi Termica dell'Aria (Fattore Stagionale di Agosto)
    // Se fa troppo caldo o troppo freddo rispetto alla temperatura ottimale della specie
    let scostamentoTermico = Math.abs(tMediaPrevista - fungo.tempOttimale);
    score -= (scostamentoTermico * 4);

    // Guardrail Agosto: Specie termofile (Aereus/Aestivalis) amano il caldo estivo di bassa quota.
    // Specie fredde (Edulis) soffrono il caldo agostano sotto i 1000-1200m.
    if (fungo.termofilo && tMediaPrevista < 18) score -= 30; // Penalizza i porcini neri se fa troppo freddo
    if (!fungo.termofilo && stazione.alt < 1000 && tMaxPrevista > 28) score -= 40; // Brucia i Boletus edulis in bassa quota ad agosto

    // Normalizzazione finale
    score = Math.max(0, Math.min(98, Math.round(score)));
    
    // Se non c'è stata pioggia sufficiente nel mese (<25mm), la fruttificazione estiva è impossibile
    if (acquaDisponibile < 25) score = Math.round(score * 0.05);

    return score;
}

function ottieniClasseStile(prob) {
    if (prob >= 75) return 'prob-high';
    if (prob >= 40) return 'prob-medium';
    if (prob >= 15) return 'prob-low';
    return 'prob-none';
}

function renderTabella(fungoNome) {
    specieSelezionata = fungoNome;
    const fungo = specieFunghi.find(f => f.nome === fungoNome);
    document.getElementById('current-mushroom-title').innerText = `Previsione di Nascita Reale: ${fungo.nome}`;
    
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    stazioni.forEach(stazione => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a class="station-link" href="${stazione.link}" target="_blank">🔗 ${stazione.nome}</a></td>
            <td>${stazione.alt} m</td>
            <td style="font-weight: 500;">${stazione.rain30g.toFixed(1)} mm</td>
        `;

              // Genera i dati reali basati sull'indice del giorno previsionale (0 = Oggi, 9 = Tra 10 giorni)
        for (let g = 0; g < 10; g++) {
            let prob = calcolaProbabilitaReale(stazione, fungo, g);
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

