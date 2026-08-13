// TRIS Rel. 03-D-017 - Gestione errori robusta per il comando Genera PDF
"use strict";

const RELEASE = "Rel. 03-D-017";

const PATHS = {
  STATIONS: "stazioni_meteo.csv",
  WEATHER: "dati_meteo_30g.csv",
  SPECIES: "speciefunghi.csv",
  GROWTH: "speciecrescita.csv"
};

const FORECAST_DAYS_AHEAD = 10;
const STATION_SPECIES_DAYS_BACK = 30;

const MESI_NOMI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

let state = {
  stations: [],
  weatherRecords: [],
  species: [],
  growthProfiles: {},
  weatherByStationDate: new Map(),
  speciesMap: new Map(),
  stationsMap: new Map(),
  referenceTodayStr: ''
};

function initSidebarToggle() {
  const app = document.getElementById('app');
  const miniBtn = document.getElementById('sidebarToggleMini');
  const insideBtn = document.getElementById('sidebarToggleInside');
  if (miniBtn) miniBtn.addEventListener('click', () => app.classList.remove('sidebar-collapsed'));
  if (insideBtn) insideBtn.addEventListener('click', () => app.classList.add('sidebar-collapsed'));
}

function delimiter(text) {
  const candidates = [';', ',', '\t', '|'];
  return candidates.map(character => ({
    character,
    count: (text.match(new RegExp('\\' + character, 'g')) || []).length
  })).sort((a, b) => b.count - a.count)[0].character;
}

function parseCSV(text) {
  if (typeof Papa === "undefined") throw new Error("PapaParse non è caricato.");
  const cleanedText = String(text).replace(/^\uFEFF/, "");
  const result = Papa.parse(cleanedText, {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter(cleanedText),
    transformHeader: header => header.trim(),
    transform: value => String(value ?? "").trim()
  });
  return { rows: Array.isArray(result.data) ? result.data : [], fields: Array.isArray(result.meta?.fields) ? result.meta.fields : [] };
}

async function fetchCSV(path) {
  const res = await fetch(`${path}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Impossibile caricare il file ${path}`);
  return parseCSV(await res.text());
}

function setError(message) {
  const errorBox = document.getElementById('errorBox');
  if (errorBox) {
    errorBox.style.display = message ? 'block' : 'none';
    errorBox.textContent = message || '';
  }
}

function numero(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const res = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(res) ? res : null;
}

function estraiData(value) {
  if (!value) return null;
  const testo = String(value).trim();
  let match = testo.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = testo.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return testo.split('T')[0];
}

async function loadDatasets() {
  const statusEl = document.getElementById('status-text');
  try {
    const [stCSV, weCSV, spCSV, grCSV] = await Promise.all([
      fetchCSV(PATHS.STATIONS),
      fetchCSV(PATHS.WEATHER),
      fetchCSV(PATHS.SPECIES),
      fetchCSV(PATHS.GROWTH)
    ]);

    processStations(stCSV);
    processWeather(weCSV);
    processSpecies(spCSV);
    processGrowth(grCSV);

    statusEl.classList.add('hidden');
    document.getElementById('data-summary')?.style.setProperty('display', 'flex');
    document.getElementById('controls-panel').classList.remove('hidden');

    populateControls();
    setError('');
  } catch (err) {
    statusEl.classList.add('error');
    statusEl.textContent = `${RELEASE} · Errore caricamento dati.`;
    setError(String(err?.stack || err));
    console.error(err);
  }
}

function trovaCampo(fields, candidati) {
  const normalizzaChiave = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizzati = candidati.map(normalizzaChiave);
  return fields.find(campo => normalizzati.includes(normalizzaChiave(campo))) || fields.find(campo => normalizzati.some(nome => normalizzaChiave(campo).includes(nome))) || "";
}

function processStations(csv) {
  const campoID = trovaCampo(csv.fields, ["id", "idstazione", "stationid", "codicestatione"]);
  const campoNome = trovaCampo(csv.fields, ["nome", "stazionemeteo", "nomestazione", "localita", "riferimento"]);
  const campoAlt = trovaCampo(csv.fields, ["altitudine", "quota", "altitude"]);

  csv.rows.forEach(riga => {
    const id = String(riga[campoID] || "").trim();
    if (!id) return;
    const nome = String(riga[campoNome] || id).trim();
    const quota = numero(riga[campoAlt]) || 0;

    const stObj = { id, nome, quota };
    state.stations.push(stObj);
    state.stationsMap.set(id, stObj);
  });

  const countEl = document.getElementById('stations-count');
  if (countEl) countEl.textContent = state.stations.length;
}

function processWeather(csv) {
  const campoID = trovaCampo(csv.fields, ["id", "idstazione", "stationid", "stazionemeteo"]);
  const campoData = trovaCampo(csv.fields, ["datarilevamento", "data", "date"]);
  const campoPioggia = trovaCampo(csv.fields, ["pioggiagiornaliera", "pioggia", "rain"]);
  const campoTMin = trovaCampo(csv.fields, ["temperaturamin", "tmin", "tempmin"]);
  const campoTMax = trovaCampo(csv.fields, ["temperaturamax", "tmax", "tempmax"]);

  let maxDate = "2026-01-01";

  csv.rows.forEach(riga => {
    const id = String(riga[campoID] || "").trim();
    const dataRaw = riga[campoData];
    const data = estraiData(dataRaw);
    if (!id || !data) return;

    const rain = numero(riga[campoPioggia]) || 0;
    const tmin = numero(riga[campoTMin]);
    const tmax = numero(riga[campoTMax]);
    const tavg = (Number.isFinite(tmin) && Number.isFinite(tmax)) ? (tmin + tmax) / 2 : 15;

    const key = `${id}_${data}`;
    state.weatherByStationDate.set(key, { rain, tmin, tmax, tavg });
    state.weatherRecords.push({ id, data, rain });

    if (data > maxDate) maxDate = data;
  });

  state.referenceTodayStr = maxDate;
  const updateEl = document.getElementById('lastUpdate');
  if (updateEl) updateEl.textContent = maxDate;
  const dataUpdateEl = document.getElementById('data-last-update');
  if (dataUpdateEl) dataUpdateEl.textContent = maxDate;
  const recCountEl = document.getElementById('records-count');
  if (recCountEl) recCountEl.textContent = state.weatherRecords.length;
}

function processSpecies(csv) {
  csv.rows.forEach(riga => {
    const id = String(riga.id || "").trim();
    if (!id) return;
    if (riga.attivo !== undefined && riga.attivo === 'false') return;

    const spObj = {
      id: id,
      nomeComune: String(riga.nomeComune || "").trim(),
      nomeScientifico: String(riga.nome || "").trim(),
      tempMin: numero(riga.tempMin) || 5,
      tempMax: numero(riga.tempMax) || 30,
      altMin: numero(riga.altMin) || 0,
      altMax: numero(riga.altMax) || 3000,
      mesiInizio: parseInt(riga.mesiInizio) || 1,
      mesiFine: parseInt(riga.mesiFine) || 12,
      growthStartDays: numero(riga.growthStartDays) || 1,
      growthPeakStartDays: numero(riga.growthPeakStartDays) || 5,
      growthPeakEndDays: numero(riga.growthPeakEndDays) || 15,
      growthEndDays: numero(riga.growthEndDays) || 25,
      pioggiaTrigger: numero(riga.rainReq) || 10,
      habitat: String(riga.habitat || "").trim(),
      note: String(riga.note || "").trim()
    };
    state.species.push(spObj);
    state.speciesMap.set(id, spObj);
  });

  const spCountEl = document.getElementById('speciesCount');
  if (spCountEl) spCountEl.textContent = state.species.length;
}

function processGrowth(csv) {
  const campoID = trovaCampo(csv.fields, ["id", "specie", "specieid"]);
  if (!campoID) return;

  csv.rows.forEach(riga => {
    const spId = String(riga[campoID] || "").trim();
    if (!spId) return;
    if (!state.growthProfiles[spId]) state.growthProfiles[spId] = new Map();

    Object.keys(riga).forEach(col => {
      const giorno = parseInt(col);
      const perc = numero(riga[col]);
      if (Number.isInteger(giorno) && Number.isFinite(perc)) {
        state.growthProfiles[spId].set(giorno, perc);
      }
    });
  });
}

function populateControls() {
  state.stations.sort((a, b) => a.nome.localeCompare(b.nome));

  const spSelect = document.getElementById('species-select');
  const ssSpSelect = document.getElementById('ss-species-select');
  state.species.forEach(sp => {
    const opt = document.createElement('option');
    opt.value = sp.id;
    opt.textContent = sp.nomeComune ? `${sp.nomeComune} (${sp.nomeScientifico || sp.id})` : sp.id;
    spSelect?.appendChild(opt.cloneNode(true));
    ssSpSelect?.appendChild(opt);
  });

  const stSelect = document.getElementById('station-select');
  const ssStSelect = document.getElementById('ss-station-select');
  state.stations.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id;
    opt.textContent = `${st.nome} (${st.quota}m)`;
    stSelect?.appendChild(opt.cloneNode(true));
    ssStSelect?.appendChild(opt);
  });

  const daySelect = document.getElementById('day-select');
  const dateDaySelect = document.getElementById('date-day-select');
  const dates = getForecastDateRange(state.referenceTodayStr, FORECAST_DAYS_AHEAD);
  dates.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d === state.referenceTodayStr ? `${d} (Oggi)` : d;
    daySelect?.appendChild(opt.cloneNode(true));
    dateDaySelect?.appendChild(opt);
  });

  document.getElementById('mode-species-button').addEventListener('click', () => switchTab('species'));
  document.getElementById('mode-station-button').addEventListener('click', () => switchTab('station'));
  document.getElementById('mode-date-button').addEventListener('click', () => switchTab('date'));
  document.getElementById('mode-station-species-button').addEventListener('click', () => switchTab('station-species'));

  document.getElementById('generate-button').addEventListener('click', generateSpeciesReport);
  document.getElementById('generate-station-button').addEventListener('click', generateStationReport);
  document.getElementById('generate-date-button').addEventListener('click', generateDateReport);
  document.getElementById('generate-station-species-button').addEventListener('click', generateStationSpeciesReport);

  ['day-select', 'species-select'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      const d = document.getElementById('day-select').value;
      const s = document.getElementById('species-select').value;
      document.getElementById('generate-button').disabled = !(d && s);
    });
  });

  ['station-select', 'probability-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      const st = document.getElementById('station-select').value;
      const p = document.getElementById('probability-filter').value;
      document.getElementById('generate-station-button').disabled = !(st && p !== "");
    });
  });

  document.getElementById('date-day-select')?.addEventListener('change', () => {
    const d = document.getElementById('date-day-select').value;
    document.getElementById('generate-date-button').disabled = !d;
  });

  ['ss-station-select', 'ss-species-select'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      const st = document.getElementById('ss-station-select').value;
      const sp = document.getElementById('ss-species-select').value;
      document.getElementById('generate-station-species-button').disabled = !(st && sp);
    });
  });
}

window.goToStationSpecies = (stationId, speciesId) => {
  const modeBtn = document.getElementById('mode-station-species-button');
  if (modeBtn) modeBtn.click();
  
  const stationSelect = document.getElementById('ss-station-select');
  const speciesSelect = document.getElementById('ss-species-select');
  
  if (stationSelect) stationSelect.value = stationId;
  if (speciesSelect) speciesSelect.value = speciesId;
  
  const execBtn = document.getElementById('generate-station-species-button');
  if (execBtn) {
    execBtn.disabled = false;
    execBtn.click();
  }
};

function switchTab(tab) {
  const tabs = {
    'species': { btn: 'mode-species-button', ctrl: 'species-report-controls' },
    'station': { btn: 'mode-station-button', ctrl: 'station-report-controls' },
    'date': { btn: 'mode-date-button', ctrl: 'date-report-controls' },
    'station-species': { btn: 'mode-station-species-button', ctrl: 'station-species-report-controls' }
  };

  Object.keys(tabs).forEach(k => {
    document.getElementById(tabs[k].btn).classList.toggle('active', k === tab);
    document.getElementById(tabs[k].ctrl).classList.toggle('hidden', k !== tab);
  });

  document.getElementById('forecast-panel').classList.add('hidden');
}

function getForecastDateRange(baseDateStr, daysAhead) {
  const dates = [];
  const base = new Date(baseDateStr);
  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getDateRange(baseDateStr, daysBack, daysAhead) {
  const dates = [];
  const base = new Date(baseDateStr);
  for (let i = -daysBack; i <= daysAhead; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getOffsetDate(baseStr, offset) {
  const d = new Date(baseStr);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function getMesiNome(inizio, fine) {
  const mIni = MESI_NOMI[inizio] || inizio;
  const mFin = MESI_NOMI[fine] || fine;
  return `${mIni} - ${mFin}`;
}

function calculateTRISMetrics(stationId, speciesId, targetDateStr) {
  const station = state.stationsMap.get(stationId);
  const species = state.speciesMap.get(speciesId);
  if (!station || !species) return null;

  const quotaValid = (station.quota >= species.altMin && station.quota <= species.altMax);
  const month = new Date(targetDateStr).getMonth() + 1;
  const seasonValid = (month >= species.mesiInizio && month <= species.mesiFine);

  const curWeather = state.weatherByStationDate.get(`${stationId}_${targetDateStr}`) || { rain: 0, tavg: 15 };
  const d1 = getOffsetDate(targetDateStr, -1);
  const d2 = getOffsetDate(targetDateStr, -2);
  const w1 = state.weatherByStationDate.get(`${stationId}_${d1}`) || { rain: 0 };
  const w2 = state.weatherByStationDate.get(`${stationId}_${d2}`) || { rain: 0 };
  const rain3d = curWeather.rain + w1.rain + w2.rain;

  let tempScore = 0;
  const t = curWeather.tavg;
  if (t >= species.tempMin && t <= species.tempMax) {
    tempScore = 100;
  } else if (t < species.tempMin) {
    tempScore = Math.max(0, 100 - (species.tempMin - t) * 20);
  } else {
    tempScore = Math.max(0, 100 - (t - species.tempMax) * 20);
  }

  let growthDay = null;
  let growthPerc = 0;
  let activeStart = null;

  for (let offset = -30; offset <= 0; offset++) {
    const checkDate = getOffsetDate(targetDateStr, offset);
    const dC0 = getOffsetDate(checkDate, 0);
    const dC1 = getOffsetDate(checkDate, -1);
    const dC2 = getOffsetDate(checkDate, -2);
    const wC0 = state.weatherByStationDate.get(`${stationId}_${dC0}`) || { rain: 0 };
    const wC1 = state.weatherByStationDate.get(`${stationId}_${dC1}`) || { rain: 0 };
    const wC2 = state.weatherByStationDate.get(`${stationId}_${dC2}`) || { rain: 0 };
    const rain3dCheck = wC0.rain + wC1.rain + wC2.rain;

    if (rain3dCheck >= species.pioggiaTrigger) {
      activeStart = checkDate;
    }
  }

  if (activeStart) {
    const startD = new Date(activeStart);
    const targetD = new Date(targetDateStr);
    const diffDays = Math.round((targetD - startD) / (1000 * 3600 * 24));
    if (diffDays >= species.growthStartDays && diffDays <= species.growthEndDays) {
      growthDay = diffDays;
      const profileMap = state.growthProfiles[speciesId];
      growthPerc = profileMap ? (profileMap.get(diffDays) || 0) : 0;
    }
  }

  let finalProb = 0;
  if (quotaValid && seasonValid && growthPerc > 0) {
    finalProb = (growthPerc * tempScore * 0.98) / 100;
  }

  return {
    rain: curWeather.rain,
    rain3d: rain3d,
    growthDay: growthDay,
    growthPerc: growthPerc,
    tempScore: Math.round(tempScore),
    quotaValid: quotaValid,
    seasonValid: seasonValid,
    finalProb: Math.round(finalProb)
  };
}

function generatePdf() {
  try {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      setError('Libreria jsPDF non disponibile o non caricata correttamente nell\'HTML.');
      return;
    }

    setError('');
    const title = document.getElementById('current-mushroom-title')?.innerText || 'Report TRIS';
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(title, 14, 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Alcolisti Micologici Analcolici - TRIS (${RELEASE}) · Generato il ${new Date().toLocaleString('it-IT')}`, 14, 15);

    const tableEl = document.querySelector('#previsioniTable');
    if (tableEl && typeof pdf.autoTable === 'function') {
      pdf.autoTable({
        html: tableEl,
        startY: 18,
        theme: 'grid',
        styles: { fontSize: 5.5, cellPadding: 1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [1, 105, 111], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
    } else {
      pdf.text('Tabella non disponibile per l\'export PDF diretto.', 14, 25);
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    setError('Errore durante la generazione del PDF: ' + err.message);
    console.error(err);
  }
}

function generateStationSpeciesReport() {
  const stationId = document.getElementById('ss-station-select').value;
  const speciesId = document.getElementById('ss-species-select').value;
  if (!stationId || !speciesId) return;

  const station = state.stationsMap.get(stationId);
  const species = state.speciesMap.get(speciesId);
  const mesiStr = getMesiNome(species.mesiInizio, species.mesiFine);

  document.getElementById('current-mushroom-title').textContent = `Report Stazione-Specie: ${station.nome} — ${species.nomeComune} [${RELEASE}]`;
  
  const descEl = document.getElementById('current-selection-description');
  descEl.innerHTML = `
    <div style="font-size: 0.9rem; color: var(--text); line-height: 1.6;">
      Analisi incrociata dal ${getOffsetDate(state.referenceTodayStr, -30)} al ${getOffsetDate(state.referenceTodayStr, 10)} (Oggi: ${state.referenceTodayStr}).
    </div>
    <div style="margin-top: 10px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; line-height: 1.6;">
      <div>🌲 <strong>Habitat:</strong> ${species.habitat || 'N/D'} | 💧 <strong>Pioggia Trigger (3g):</strong> ${species.pioggiaTrigger} mm | 📅 <strong>Mesi:</strong> ${mesiStr}</div>
      <div style="margin-top: 4px;">🌱 <strong>Periodo di crescita:</strong> da ${species.growthStartDays} a ${species.growthEndDays} giorni con Picco da ${species.growthPeakStartDays} a ${species.growthPeakEndDays} giorni</div>
      <div style="margin-top: 4px;">📝 <strong>Note:</strong> ${species.note || 'Nessuna nota'}</div>
    </div>
    <button id="pdf-btn" class="btn-esegui" style="margin-top: 12px; font-size: 0.85rem; min-height: 36px;">Genera PDF</button>
  `;
  document.getElementById('pdf-btn').addEventListener('click', generatePdf);

  const thead = document.getElementById('forecast-thead');
  thead.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Pioggia (mm)</th>
      <th>Pioggia 3g (mm)</th>
      <th>Giorno Crescita (%)</th>
      <th>% Temp.</th>
      <th>Stagione</th>
      <th>Quota</th>
      <th style="text-align:center">Probabilità</th>
    </tr>
  `;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const dateList = getDateRange(state.referenceTodayStr, STATION_SPECIES_DAYS_BACK, FORECAST_DAYS_AHEAD);
  dateList.sort((a, b) => new Date(b) - new Date(a));

  dateList.forEach(dateStr => {
    const res = calculateTRISMetrics(stationId, speciesId, dateStr);
    const tr = document.createElement('tr');

    if (dateStr === state.referenceTodayStr) tr.className = 'row-today';
    const probClass = getProbabilityClass(res.finalProb);

    tr.innerHTML = `
      <td><strong>${dateStr}${dateStr === state.referenceTodayStr ? ' (Oggi)' : ''}</strong></td>
      <td>${res.rain.toFixed(1)}</td>
      <td><strong>${res.rain3d.toFixed(1)}</strong></td>
      <td>${res.growthDay ? `Giorno ${res.growthDay} (${res.growthPerc}%)` : '—'}</td>
      <td>${res.tempScore}%</td>
      <td>${res.seasonValid ? '✔️' : '❌'}</td>
      <td>${res.quotaValid ? '✔️' : '❌'}</td>
      <td class="probability-cell ${probClass}">${res.finalProb}%</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('forecast-panel').classList.remove('hidden');
}

function generateSpeciesReport() {
  const dateStr = document.getElementById('day-select').value;
  const speciesId = document.getElementById('species-select').value;
  if (!dateStr || !speciesId) return;

  const species = state.speciesMap.get(speciesId);
  const mesiStr = getMesiNome(species.mesiInizio, species.mesiFine);

  document.getElementById('current-mushroom-title').textContent = `Previsione per ${species.nomeComune} (${dateStr}) [${RELEASE}]`;
  
  const descEl = document.getElementById('current-selection-description');
  descEl.innerHTML = `
    <div style="font-size: 0.9rem; color: var(--text); line-height: 1.6;">
      Analisi per la specie su tutte le stazioni meteorologiche monitorate in data ${dateStr}.
    </div>
    <div style="margin-top: 10px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; line-height: 1.6;">
      <div>🌲 <strong>Habitat:</strong> ${species.habitat || 'N/D'} | 💧 <strong>Pioggia Trigger (3g):</strong> ${species.pioggiaTrigger} mm | 📅 <strong>Mesi:</strong> ${mesiStr}</div>
      <div style="margin-top: 4px;">🌱 <strong>Periodo di crescita:</strong> da ${species.growthStartDays} a ${species.growthEndDays} giorni con Picco da ${species.growthPeakStartDays} a ${species.growthPeakEndDays} giorni</div>
      <div style="margin-top: 4px;">📝 <strong>Note:</strong> ${species.note || 'Nessuna nota'}</div>
    </div>
    <button id="pdf-btn" class="btn-esegui" style="margin-top: 12px; font-size: 0.85rem; min-height: 36px;">Genera PDF</button>
  `;
  document.getElementById('pdf-btn').addEventListener('click', generatePdf);

  const thead = document.getElementById('forecast-thead');
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Stazione</th>
      <th>Quota</th>
      <th>Pioggia 3g</th>
      <th>Giorno Crescita</th>
      <th>% Temp</th>
      <th style="text-align:center">Probabilità</th>
    </tr>
  `;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const results = [];
  state.stations.forEach(st => {
    const res = calculateTRISMetrics(st.id, speciesId, dateStr);
    if (res.finalProb > 0) {
      results.push({ station: st, res: res });
    }
  });

  results.sort((a, b) => b.res.finalProb - a.res.finalProb);

  results.forEach((item, index) => {
    const tr = document.createElement('tr');
    const probClass = getProbabilityClass(item.res.finalProb);
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.station.nome}</td>
      <td>${item.station.quota} m</td>
      <td>${item.res.rain3d.toFixed(1)} mm</td>
      <td>${item.res.growthDay ? `Giorno ${item.res.growthDay} (${item.res.growthPerc}%)` : '—'}</td>
      <td>${item.res.tempScore}%</td>
      <td class="probability-cell ${probClass}">${item.res.finalProb}%</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('forecast-panel').classList.remove('hidden');
}

function formatDateDDMM(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function generateStationReport() {
  const stationId = document.getElementById('station-select').value;
  const minProb = parseFloat(document.getElementById('probability-filter').value) || 0;
  if (!stationId) return;

  const station = state.stationsMap.get(stationId);

  document.getElementById('current-mushroom-title').textContent = `Report Previsionale Stazione: ${station.nome} [${RELEASE}]`;
  
  const descEl = document.getElementById('current-selection-description');
  descEl.innerHTML = `
    <div style="font-size: 0.9rem; color: var(--text); line-height: 1.6;">
      Specie con probabilità ≥ ${minProb}% per i prossimi 10 giorni.
    </div>
    <button id="pdf-btn" class="btn-esegui" style="margin-top: 10px; font-size: 0.85rem; min-height: 36px;">Genera PDF</button>
  `;
  document.getElementById('pdf-btn').addEventListener('click', generatePdf);

  const thead = document.getElementById('forecast-thead');
  thead.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Specie Fungina</th>
      <th>Giorno Crescita</th>
      <th>% Temp</th>
      <th>Stagione</th>
      <th>Quota</th>
      <th style="text-align:center">Probabilità</th>
    </tr>
  `;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  const dateList = getForecastDateRange(state.referenceTodayStr, FORECAST_DAYS_AHEAD);
  const results = [];

  dateList.forEach(dateStr => {
    state.species.forEach(sp => {
      const res = calculateTRISMetrics(stationId, sp.id, dateStr);
      if (res.finalProb >= minProb) {
        results.push({ species: sp, res: res, date: dateStr });
      }
    });
  });

  results.sort((a, b) => new Date(a.date) - new Date(b.date) || b.res.finalProb - a.res.finalProb);

  results.forEach((item) => {
    const tr = document.createElement('tr');
    if (item.date === state.referenceTodayStr) tr.className = 'row-today';
    
    const probClass = getProbabilityClass(item.res.finalProb);

    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateDDMM(item.date);
    tr.appendChild(tdDate);

    const tdSpecie = document.createElement('td');
    const spBtn = document.createElement('button');
    spBtn.type = 'button';
    spBtn.className = 'species-name-button';
    spBtn.title = "Clicca per aprire la vista incrociata Stazione-Specie";
    spBtn.textContent = `${item.species.nomeComune} (${item.species.nomeScientifico})`;
    spBtn.addEventListener('click', () => {
      window.goToStationSpecies(stationId, item.species.id);
    });
    tdSpecie.appendChild(spBtn);
    tr.appendChild(tdSpecie);

    const tdGrowth = document.createElement('td');
    tdGrowth.textContent = item.res.growthDay ? `Giorno ${item.res.growthDay} (${item.res.growthPerc}%)` : '—';
    tr.appendChild(tdGrowth);

    const tdTemp = document.createElement('td');
    tdTemp.textContent = `${item.res.tempScore}%`;
    tr.appendChild(tdTemp);

    const tdSeason = document.createElement('td');
    tdSeason.textContent = item.res.seasonValid ? '✔️' : '❌';
    tr.appendChild(tdSeason);

    const tdQuota = document.createElement('td');
    tdQuota.textContent = item.res.quotaValid ? '✔️' : '❌';
    tr.appendChild(tdQuota);

    const tdProb = document.createElement('td');
    tdProb.className = `probability-cell ${probClass}`;
    tdProb.textContent = `${item.res.finalProb}%`;
    tr.appendChild(tdProb);

    tbody.appendChild(tr);
  });

  document.getElementById('forecast-panel').classList.remove('hidden');
}

function generateDateReport() {
  const dateStr = document.getElementById('date-day-select').value;
  if (!dateStr) return;

  document.getElementById('current-mushroom-title').textContent = `Report Panoramico Data: ${dateStr} [${RELEASE}]`;
  
  const descEl = document.getElementById('current-selection-description');
  descEl.innerHTML = `
    <div style="font-size: 0.9rem; color: var(--text); line-height: 1.6;">
      Matrice riassuntiva Stazioni (solo stazioni con probabilità > 0) vs Specie (colonne) per la data ${dateStr}.
    </div>
    <button id="pdf-btn" class="btn-esegui" style="margin-top: 10px; font-size: 0.85rem; min-height: 36px;">Genera PDF</button>
  `;
  document.getElementById('pdf-btn').addEventListener('click', generatePdf);

  const thead = document.getElementById('forecast-thead');
  let headerHTML = `<tr><th style="min-width: 160px; text-align: left; padding-left: 8px; vertical-align: bottom;">Stazione</th>`;
  
  state.species.forEach(sp => {
    headerHTML += `<th class="vertical-th" title="${sp.nomeComune} (${sp.nomeScientifico})">${sp.nomeComune || sp.id}</th>`;
  });
  headerHTML += `</tr>`;
  thead.innerHTML = headerHTML;

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  state.stations.forEach(st => {
    let hasValidSpecies = false;
    const rowProbs = {};

    state.species.forEach(sp => {
      const res = calculateTRISMetrics(st.id, sp.id, dateStr);
      const prob = res ? res.finalProb : 0;
      rowProbs[sp.id] = prob;
      if (prob > 0) {
        hasValidSpecies = true;
      }
    });

    if (hasValidSpecies) {
      const tr = document.createElement('tr');

      const tdSt = document.createElement('td');
      tdSt.style.textAlign = 'left';
      tdSt.style.fontWeight = 'bold';
      tdSt.style.paddingLeft = '8px';
      tdSt.textContent = `${st.nome} (${st.quota}m)`;
      tr.appendChild(tdSt);

      state.species.forEach(sp => {
        const prob = rowProbs[sp.id];
        const tdSp = document.createElement('td');
        const probClass = getProbabilityClass(prob);

        tdSp.className = `probability-cell ${probClass}`;
        tdSp.textContent = prob > 0 ? `${prob}%` : '—';
        tr.appendChild(tdSp);
      });

      tbody.appendChild(tr);
    }
  });

  document.getElementById('forecast-panel').classList.remove('hidden');
}

function openCalcPopup(station, species, dateStr, res) {
  const overlay = document.getElementById('calc-popup-overlay');
  const content = document.getElementById('calc-popup-content');

  content.innerHTML = `
    <button id="calc-popup-close" class="popup-close" type="button">×</button>
    <h3 style="color:var(--primary); margin-top:0;">Dettaglio Calcolo TRIS</h3>
    <p style="font-size:0.85rem; color:var(--muted);">${station.nome} — ${species.nomeComune} (${dateStr})</p>
    <div style="background:#f8fafc; padding:10px; border-radius:8px; font-size:0.88rem; line-height:1.5;">
      <p style="margin:0 0 6px 0; font-weight:bold;">Formula: Crescita × Temperatura × 0.98</p>
      <ul>
        <li>Crescita: Giorno ${res.growthDay || 'N/D'} (${res.growthPerc}%)</li>
        <li>Temperatura: ${res.tempScore}%</li>
        <li>Fattore Correttivo: 0.98</li>
        <li>Filtro Quota (${station.quota}m): <strong>${res.quotaValid ? 'Superato (1)' : 'Escluso (0)'}</strong></li>
        <li>Filtro Stagione: <strong>${res.seasonValid ? 'Superato (1)' : 'Escluso (0)'}</strong></li>
      </ul>
      <p style="margin:8px 0 0; text-align:right; font-weight:bold; font-size:1rem;">Totale: ${res.finalProb}%</p>
    </div>
  `;
  document.getElementById('calc-popup-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
    document.body.classList.remove('popup-open');
  });

  overlay.classList.remove('hidden');
  document.body.classList.add('popup-open');
}

function getProbabilityClass(value) {
  const val = Number(value) || 0;
  if (val === 0) return 'p-0';
  if (val <= 30) return 'p-low';
  if (val <= 60) return 'p-mid';
  if (val < 100) return 'p-high';
  return 'p-peak';
}

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  loadDatasets();
});