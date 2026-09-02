(() => {
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const STATIONS_CSV = './dati_stazioni_30g.csv';
  const RELEASE = 'Rel. 01-GH-004';

  const els = {
    app: document.getElementById('app'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    daySelect: document.getElementById('daySelect'),
    sortSelect: document.getElementById('sortSelect'),
    executeBtn: document.getElementById('executeBtn'),
    savePdfBtn: document.getElementById('savePdfBtn'),
    savePdfField: document.getElementById('savePdfField'),
    stationsCount: document.getElementById('stationsCount'),
    recordsCount: document.getElementById('recordsCount'),
    selectedDayLabel: document.getElementById('selectedDayLabel'),
    statusText: document.getElementById('statusText'),
    errorBox: document.getElementById('errorBox'),
    lastUpdate: document.getElementById('lastUpdate'),
    sidebarToggleInside: document.getElementById('sidebarToggleInside'),
    sidebarToggleMini: document.getElementById('sidebarToggleMini')
  };

  let weatherRawData = [];
  let stationsMetaMap = new Map();
  let uniqueDates = [];
  let stationMap = new Map();
  let selectedDateIndex = 0;

  if (!document.getElementById('offlineStyle')) {
    const style = document.createElement('style');
    style.id = 'offlineStyle';
    style.textContent = `
      .offline-cell {
        background-color: transparent !important;
        color: #dc2626 !important;
        font-weight: 700 !important;
        font-style: normal !important;
      }
      .selected-column {
        background-color: #7dd3fc !important;
        color: #000000 !important;
      }
      thead th.selected-column {
        background-color: #7dd3fc !important;
        color: #00008B !important;
        font-weight: bold !important;
      }
      td.offline-cell.selected-column, td.selected-column.offline-cell {
        background-color: #7dd3fc !important;
        color: #dc2626 !important;
      }
      .top-scroll-container {
        display: none;
      }
      .table-scroll-container {
        max-height: 68vh !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
        position: relative !important;
        border: 2px solid #64748b !important;
        border-radius: 6px;
        background-color: #ffffff;
      }
      table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        width: 100% !important;
        table-layout: auto !important;
      }
      th, td {
        white-space: nowrap !important;
        padding: 6px 10px !important;
        text-align: center;
        border-right: 1px solid #94a3b8 !important;
        border-bottom: 1px solid #94a3b8 !important;
      }
      th:not(.name-cell), td:not(.name-cell) {
        min-width: 68px !important;
      }
      thead th {
        position: sticky !important;
        top: 0 !important;
        z-index: 20 !important;
        background-color: #00FFFF !important;
        color: #00008B !important;
        box-shadow: none !important;
        border-bottom: 2px solid #64748b !important;
      }
      .name-cell {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        background-color: #ffffff !important;
        box-shadow: none !important;
        cursor: pointer;
        width: 220px !important;
        min-width: 220px !important;
        max-width: 220px !important;
        text-align: left !important;
        padding-left: 12px !important;
        border-right: 2px solid #64748b !important;
      }
      .name-cell:hover {
        background-color: #7dd3fc !important;
      }
      thead th.name-cell {
        z-index: 30 !important;
        background-color: #00FFFF !important;
        color: #00008B !important;
        cursor: default;
        width: 220px !important;
        min-width: 220px !important;
        max-width: 220px !important;
        text-align: left !important;
        box-shadow: none !important;
        border-right: 2px solid #64748b !important;
      }
      .rain-row td.name-cell { background-color: #ffffff !important; }
      .cum-row td.name-cell { 
        background-color: #cbd5e1 !important;
        font-weight: bold !important;
        font-size: 1rem !important;
        color: #00008B !important;
        border-top: 2px solid #64748b !important;
        border-bottom: 2px solid #64748b !important;
      }
      .cum-row td {
        background-color: #cbd5e1 !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        color: #00008B !important;
        border-top: 2px solid #64748b !important;
        border-bottom: 2px solid #64748b !important;
      }
      .cum-row td.selected-column {
        background-color: #7dd3fc !important;
        color: #00008B !important;
      }
      .station-modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        padding: 12px;
      }
      .station-modal-box {
        background: #ffffff;
        padding: 16px;
        border-radius: 12px;
        width: 100%;
        max-width: 500px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        font-family: inherit;
      }
      .station-modal-box h3 {
        margin-top: 0;
        font-size: 1.1rem;
        color: #00008B;
        border-bottom: 2px solid #00FFFF;
        padding-bottom: 6px;
      }
      .station-modal-content {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        margin-top: 8px;
        margin-bottom: 12px;
      }
      .station-modal-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
        margin-top: 6px;
      }
      .station-modal-table th, .station-modal-table td {
        border: 1px solid #94a3b8;
        padding: 6px 4px;
        text-align: center;
      }
      .station-modal-table th {
        background-color: #f1f5f9;
        color: #1e293b;
      }
      .station-modal-close {
        background: #00008B;
        color: #ffffff;
        border: none;
        padding: 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
        font-size: 1rem;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTableWrapper() {
    const tableEl = document.querySelector('table');
    if (tableEl && !tableEl.parentElement.classList.contains('table-scroll-container')) {
      const parent = tableEl.parentNode;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll-container';
      wrapper.id = 'mainTableScrollContainer';
      parent.insertBefore(wrapper, tableEl);
      wrapper.appendChild(tableEl);
    }
  }

  function showStationPopup(stName) {
    const meta = getStationMetaByName(stName) || { name: stName, id: 'N/D', ref: 'N/D', code: 'N/D', lat: 'N/D', long: 'N/D', zona: 'N/D' };
    const rawStData = stationMap.get(stName);

    let rowsHtml = '';
    if (uniqueDates.length > 0 && rawStData) {
      uniqueDates.forEach((d, i) => {
        const dayRecord = rawStData.get(d.display);
        const rain = dayRecord ? (dayRecord.offline ? 'OFF' : `${dayRecord.rain.toFixed(1)} mm`) : '-';
        const tmin = dayRecord && !dayRecord.offline && dayRecord.tmin !== null ? `${dayRecord.tmin.toFixed(1)} °C` : '-';
        const tmax = dayRecord && !dayRecord.offline && dayRecord.tmax !== null ? `${dayRecord.tmax.toFixed(1)} °C` : '-';
        const tmed = dayRecord && !dayRecord.offline && dayRecord.tmed !== null ? `${dayRecord.tmed.toFixed(1)} °C` : '-';

        rowsHtml += `
          <tr>
            <td>${d.display} (-${i})</td>
            <td>${rain}</td>
            <td>${tmin}</td>
            <td>${tmax}</td>
            <td>${tmed}</td>
          </tr>
        `;
      });
    } else {
      rowsHtml = `<tr><td colspan="5">Nessun dato dettagliato disponibile.</td></tr>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'station-modal-overlay';
    overlay.innerHTML = `
      <div class="station-modal-box">
        <h3>${meta.name || stName}</h3>
        <p style="margin:4px 0; font-size:0.8rem; color:#475569;">
          <strong>ID:</strong> ${meta.id ?? 'N/D'} | <strong>ZonaGeo:</strong> ${meta.zona ?? 'N/D'}
        </p>
        <div class="station-modal-content">
          <table class="station-modal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pioggia</th>
                <th>Min</th>
                <th>Max</th>
                <th>Media</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <button class="station-modal-close" id="closeModalBtn">Chiudi</button>
      </div>
    `;

    document.body.appendChild(overlay);
    const closeModal = () => overlay.remove();
    overlay.querySelector('#closeModalBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  function delimiter(text) {
    const candidates = [';', ',', '\t', '|'];
    return candidates.map(character => ({
      character,
      count: (text.match(new RegExp('\\' + character, 'g')) || []).length
    })).sort((a, b) => b.count - a.count)[0].character;
  }

  function parseCsv(text) {
    if (typeof Papa === 'undefined') {
      throw new Error("Libreria PapaParse non trovata.");
    }
    return Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: delimiter(text),
      transformHeader: header => header ? header.trim() : '',
      transform: value => typeof value === 'string' ? value.trim() : value
    });
  }

  function setError(message) {
    if (els.errorBox) {
      els.errorBox.style.display = message ? 'block' : 'none';
      els.errorBox.textContent = message || '';
    }
  }

  function toggleSidebar() {
    if (els.app) els.app.classList.toggle('sidebar-collapsed');
  }

  function normalizeKey(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function parseDateStr(strVal) {
    if (!strVal) return null;
    const str = String(strVal).trim();
    const [datePart] = str.split(' ');

    if (datePart.includes('/')) {
      const [d, m, y] = datePart.split('/').map(Number);
      if (!d || !m || !y) return null;
      return new Date(y, m - 1, d);
    }
    if (datePart.includes('-')) {
      const parts = datePart.split('-').map(Number);
      if (parts[0] > 1000) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateDisplay(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${d}/${m}/${y}`;
  }

  async function fetchCsvFile(url) {
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`File non trovato o errore HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (window.location.protocol === 'file:') {
        throw new Error(`I file CSV non possono essere letti tramite file://. Utilizzare un web server locale.`);
      }
      throw err;
    }
  }

  function getRowValue(row, possibleKeys) {
    if (!row) return null;
    const rowKeys = Object.keys(row);
    for (const pKey of possibleKeys) {
      const targetNorm = normalizeKey(pKey);
      const foundKey = rowKeys.find(k => normalizeKey(k) === targetNorm);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return row[foundKey];
      }
    }
    return null;
  }

  function ensureSortSelect() {
    let sortSelect = document.getElementById('sortSelect');
    if (!sortSelect) {
      const daySelectField = els.daySelect ? els.daySelect.closest('.field') : null;
      if (daySelectField && daySelectField.parentNode) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        fieldDiv.innerHTML = `
          <label for="sortSelect">Ordinamento</label>
          <select id="sortSelect">
            <option value="rain_desc">Pioggia decrescente</option>
            <option value="id_asc" selected>Id Stazione</option>
            <option value="geo">ZonaGeo</option>
          </select>
        `;
        daySelectField.parentNode.insertBefore(fieldDiv, daySelectField.nextSibling);
        sortSelect = document.getElementById('sortSelect');
      }
    }
    els.sortSelect = sortSelect;
    if (els.sortSelect) {
      els.sortSelect.addEventListener('change', () => renderMatrixTable());
    }
    if (els.savePdfBtn) els.savePdfBtn.textContent = 'Genera PDF';
  }

  function processStationsMeta(stationsRows, weatherRows) {
    const map = new Map();

    if (stationsRows && stationsRows.length > 0) {
      stationsRows.forEach(r => {
        const id = parseInt(getRowValue(r, ['id', 'idstazione', 'codice', 'codicestazione']), 10) || null;
        // Cerca esplicitamente le varianti per il nome stazione (inclusa la combinazione stazionemeteo)
        const name = getRowValue(r, ['stazionemeteo', 'stazione', 'nome', 'nomestazione', 'nome_stazione', 'descrizione']);
        const ref = getRowValue(r, ['riferimento']);
        const code = getRowValue(r, ['codicestazione', 'codice']);
        const lat = parseFloat(getRowValue(r, ['lat', 'latitude'])) || null;
        const long = parseFloat(getRowValue(r, ['long', 'longitude', 'lng'])) || null;
        const zona = getRowValue(r, ['zonageo', 'zona_geo', 'zona', 'zonageografica', 'ordinegeo', 'ordine_geo', 'area']);

        const displayName = name || ref || code || (id ? `Stazione #${id}` : null);
        if (!displayName) return;

        const stationInfo = { id, name: displayName, ref, code, lat, long, zona };
        [id, name, ref, code, displayName].forEach(val => {
          if (val !== null && val !== undefined) {
            const key = normalizeKey(val);
            if (key) map.set(key, stationInfo);
          }
        });
      });
    }

    if (weatherRows && weatherRows.length > 0) {
      weatherRows.forEach(r => {
        const id = parseInt(getRowValue(r, ['id', 'idstazione', 'codice', 'codicestazione']), 10) || null;
        const name = getRowValue(r, ['stazionemeteo', 'stazione', 'nome', 'nomestazione', 'nome_stazione', 'descrizione']);
        const ref = getRowValue(r, ['riferimento']);
        const code = getRowValue(r, ['codicestazione', 'codice']);
        const lat = parseFloat(getRowValue(r, ['lat', 'latitude'])) || null;
        const long = parseFloat(getRowValue(r, ['long', 'longitude', 'lng'])) || null;
        const zona = getRowValue(r, ['zonageo', 'zona_geo', 'zona', 'zonageografica', 'ordinegeo', 'ordine_geo', 'area']);

        const displayName = name || ref || code || (id ? `Stazione #${id}` : null);
        if (!displayName) return;

        const existingKey = normalizeKey(displayName);
        const existing = map.get(existingKey) || (id ? map.get(normalizeKey(id)) : null);

        if (!existing) {
          const stationInfo = { id, name: displayName, ref, code, lat, long, zona };
          [id, name, ref, code, displayName].forEach(val => {
            if (val !== null && val !== undefined) {
              const key = normalizeKey(val);
              if (key && !map.has(key)) map.set(key, stationInfo);
            }
          });
        } else {
          if (!existing.zona && zona) existing.zona = zona;
          if (existing.name.startsWith('Stazione #') && name) existing.name = name;
        }
      });
    }

    return map;
  }

  function getStationMetaByName(stName) {
    return stationsMetaMap.get(normalizeKey(stName)) || null;
  }

  function resolveStationName(rawVal, row) {
    if (!rawVal) {
      // Prova a recuperare direttamente dalla riga se l'ID manca ma c'è il nome
      const directName = getRowValue(row, ['stazionemeteo', 'stazione', 'nome', 'nomestazione', 'nome_stazione']);
      if (directName) return directName;
      return 'Stazione Sconosciuta';
    }
    const key = normalizeKey(rawVal);
    if (stationsMetaMap.has(key)) return stationsMetaMap.get(key).name;
    
    const rowId = getRowValue(row, ['id', 'idstazione', 'codice', 'codicestazione']);
    if (rowId !== null && stationsMetaMap.has(normalizeKey(rowId))) {
      return stationsMetaMap.get(normalizeKey(rowId)).name;
    }
    
    // Se non trovato nelle mappe, restituisce il valore pulito se è una stringa descrittiva
    return String(rawVal).trim();
  }

  function processWeatherData(rows) {
    const dateMap = new Map();
    const stations = new Map();

    rows.forEach(r => {
      const rawDate = getRowValue(r, ['datarilevamento', 'data', 'dataril', 'date', 'giorno']);
      const dObj = parseDateStr(rawDate);
      if (!dObj) return;

      const dateStr = formatDateDisplay(dObj);
      const timeKey = dObj.getTime();

      if (!dateMap.has(timeKey)) {
        dateMap.set(timeKey, { time: timeKey, dateObj: dObj, display: dateStr });
      }

      // Estrae prioritariamente il nome della stazione dal campo dedicato nel meteo o nei metadati
      const rawStId = getRowValue(r, ['stazionemeteo', 'stazione', 'nome', 'nomestazione', 'nome_stazione']) || 
                      getRowValue(r, ['idstazione', 'codicestazione', 'id']);
      const stName = resolveStationName(rawStId, r);
      
      const rawRain = getRowValue(r, ['pioggiagiornaliera', 'pioggia', 'precipitazione', 'rain', 'mm', 'precipitazioni']);
      const rainVal = parseFloat(String(rawRain || '0').replace(',', '.')) || 0;

      const rawTMin = getRowValue(r, ['tempmin', 'temperaturaminima', 'tmin', 'minima']);
      const tMinVal = rawTMin !== null ? parseFloat(String(rawTMin).replace(',', '.')) : null;

      const rawTMax = getRowValue(r, ['tempmax', 'temperaturamassima', 'tmax', 'massima']);
      const tMaxVal = rawTMax !== null ? parseFloat(String(rawTMax).replace(',', '.')) : null;

      const rawTMed = getRowValue(r, ['tempmed', 'temperaturamedia', 'tmed', 'media', 'temperatura']);
      const tMedVal = rawTMed !== null ? parseFloat(String(rawTMed).replace(',', '.')) : null;

      const rawOffline = getRowValue(r, ['offline', 'stato', 'status', 'online', 'funzionante']);
      let isOffline = false;
      if (rawOffline !== null && rawOffline !== undefined) {
        if (['true', '1', 'off', 'offline', 'no', 'guasto', 'nd'].includes(String(rawOffline).toLowerCase().trim())) {
          isOffline = true;
        }
      }
      const rawRainText = String(rawRain || '').toUpperCase();
      if (rawRainText.includes('N/D') || rawRainText.includes('OFF') || rawRainText === '-') {
        isOffline = true;
      }

      if (!stations.has(stName)) stations.set(stName, new Map());
      stations.get(stName).set(dateStr, { 
        rain: rainVal, 
        tmin: isNaN(tMinVal) ? null : tMinVal, 
        tmax: isNaN(tMaxVal) ? null : tMaxVal, 
        tmed: isNaN(tMedVal) ? null : tMedVal, 
        offline: isOffline 
      });
    });

    uniqueDates = Array.from(dateMap.values()).sort((a, b) => b.time - a.time);
    stationMap = stations;
  }

  function populateDaySelect() {
    if (!els.daySelect) return;
    els.daySelect.innerHTML = '';
    uniqueDates.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${d.display} (-${idx})`;
      els.daySelect.appendChild(opt);
    });
    els.daySelect.classList.remove('placeholder');
    
    els.daySelect.addEventListener('change', () => {
      if (els.daySelect.value !== '') {
        selectedDateIndex = parseInt(els.daySelect.value, 10);
        renderMatrixTable();
      }
    });
  }

  function cleanStationName(stName) {
    return String(stName || '').replace(/\s*\(gg\)/gi, '').trim();
  }

  function getSortedStationsList(visibleDates) {
    const sortMode = els.sortSelect ? els.sortSelect.value : 'id_asc';
    const stationsList = Array.from(stationMap.entries());
    const targetDateStr = visibleDates && visibleDates.length > 0 ? visibleDates[0].display : null;

    stationsList.sort((a, b) => {
      const nameA = cleanStationName(a[0]);
      const nameB = cleanStationName(b[0]);
      const metaA = getStationMetaByName(a[0]);
      const metaB = getStationMetaByName(b[0]);

      if (sortMode === 'rain_desc') {
        const dataA = targetDateStr ? a[1].get(targetDateStr) : null;
        const rainA = (dataA && !dataA.offline) ? dataA.rain : 0;
        const dataB = targetDateStr ? b[1].get(targetDateStr) : null;
        const rainB = (dataB && !dataB.offline) ? dataB.rain : 0;
        if (rainB !== rainA) return rainB - rainA;
        return nameA.localeCompare(nameB);
      } else if (sortMode === 'geo') {
        const zonaA = metaA?.zona ? String(metaA.zona).trim() : '';
        const zonaB = metaB?.zona ? String(metaB.zona).trim() : '';
        if (zonaA !== zonaB) {
          if (!zonaA) return 1;
          if (!zonaB) return -1;
          return zonaA.localeCompare(zonaB, 'it', { sensitivity: 'base' });
        }
        return nameA.localeCompare(nameB);
      } else {
        const idA = metaA?.id ?? 999999;
        const idB = metaB?.id ?? 999999;
        if (idA !== idB) return idA - idB;
        return nameA.localeCompare(nameB);
      }
    });
    return stationsList;
  }

  function renderMatrixTable() {
    if (!els.tableHead || !els.tableBody || uniqueDates.length === 0) return;
    ensureTableWrapper();

    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }

    const visibleDates = uniqueDates.slice(0, Math.min(uniqueDates.length, 31));
    const sortedStations = getSortedStationsList(visibleDates);

    const headersData = visibleDates.map((d, i) => ({
      display: d.display,
      relDay: -i,
      isSel: (i === selectedDateIndex)
    }));

    els.tableHead.innerHTML = `
      <tr>
        <th class="name-cell" rowspan="2" style="vertical-align:middle;">Stazione meteo</th>
        ${headersData.map(h => `<th class="${h.isSel ? 'selected-column' : ''}"><span>${h.relDay}</span></th>`).join('')}
        <th rowspan="2" style="vertical-align:middle; background-color:#00FFFF !important; color:#00008B !important;" title="Giorni Offline">G.O.</th>
      </tr>
      <tr>
        ${headersData.map(h => `<th class="${h.isSel ? 'selected-column' : ''}" style="font-weight:bold; font-size:0.75rem;">${h.display.slice(0, 5)}</th>`).join('')}
      </tr>
    `;

    let bodyHtml = '';
    sortedStations.forEach(([stName, rainByDate]) => {
      let dailyRains = [];
      let offlineDaysCount = 0;

      visibleDates.forEach(d => {
        const dayData = rainByDate.get(d.display);
        const rain = dayData ? dayData.rain : 0;
        const isOff = dayData ? dayData.offline : true;
        if (isOff) offlineDaysCount++;
        dailyRains.push({ rain, isOff });
      });

      let cumRains = [];
      let runningSum = 0;
      for (let i = dailyRains.length - 1; i >= 0; i--) {
        if (!dailyRains[i].isOff) runningSum += dailyRains[i].rain;
        cumRains[i] = { rain: runningSum, isOff: dailyRains[i].isOff };
      }

      const displayName = cleanStationName(stName);

      bodyHtml += `
        <tr class="rain-row">
          <td class="name-cell" data-station="${stName}" title="${displayName}">
            <span class="station-name">${displayName}</span>
          </td>
          ${dailyRains.map((d, i) => {
            const h = headersData[i];
            return `
              <td class="${h.isSel ? 'selected-column' : ''} ${d.isOff ? 'offline-cell' : ''}">
                ${d.isOff ? 'OFF' : (d.rain > 0 ? d.rain.toFixed(1) : '-')}
              </td>
            `;
          }).join('')}
          <td rowspan="2" style="font-weight:800; background:#f9fafb; text-align:center; vertical-align:middle; border-left:1px solid #94a3b8; border-bottom:2px solid #64748b;">
            ${offlineDaysCount}
          </td>
        </tr>
        <tr class="cum-row">
          <td class="name-cell" data-station="${stName}">
            <span class="selected-cumulative">Cumulativo</span>
          </td>
          ${cumRains.map((c, i) => {
            const h = headersData[i];
            return `
              <td class="${h.isSel ? 'selected-column' : ''}">
                ${c.rain > 0 ? c.rain.toFixed(1) : '-'}
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    els.tableBody.innerHTML = bodyHtml;

    els.tableBody.querySelectorAll('.name-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const stationKey = cell.getAttribute('data-station');
        if (stationKey) showStationPopup(stationKey);
      });
    });
  }

  function generatePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setError('Libreria jsPDF non disponibile.');
      return;
    }
    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }
    setError('');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a3');
    const visibleDates = uniqueDates.slice(0, Math.min(uniqueDates.length, 31));
    const sortedStations = getSortedStationsList(visibleDates);

    const headersData = visibleDates.map((d, i) => ({
      display: d.display,
      relDay: -i,
      isSel: (i === selectedDateIndex)
    }));

    const selDateObj = uniqueDates[selectedDateIndex];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`Report Piogge - Giorno evidenziato: ${selDateObj ? selDateObj.display : '-'} · ${RELEASE}`, 14, 12);

    const head = [
      ['Stazione meteo', ...headersData.map(h => String(h.relDay)), 'G.O.'],
      ['Data', ...headersData.map(h => h.display.slice(0, 5)), '']
    ];

    const body = [];
    sortedStations.forEach(([stName, rainByDate]) => {
      let dailyRains = [];
      let offlineDaysCount = 0;

      visibleDates.forEach(d => {
        const dayData = rainByDate.get(d.display);
        const rain = dayData ? dayData.rain : 0;
        const isOff = dayData ? dayData.offline : true;
        if (isOff) offlineDaysCount++;
        dailyRains.push({ rain, isOff });
      });

      let cumRains = [];
      let runningSum = 0;
      for (let i = dailyRains.length - 1; i >= 0; i--) {
        if (!dailyRains[i].isOff) runningSum += dailyRains[i].rain;
        cumRains[i] = { rain: runningSum, isOff: dailyRains[i].isOff };
      }

      body.push([
        { content: cleanStationName(stName), styles: { valign: 'middle', fontStyle: 'bold' } },
        ...dailyRains.map((d, i) => {
          const h = headersData[i];
          if (h.isSel) {
            return { content: d.isOff ? 'OFF' : (d.rain > 0 ? d.rain.toFixed(1) : '-'), styles: { fillColor: [125, 211, 252], fontSize: 6, textColor: d.isOff ? [220, 38, 38] : [0, 0, 0], fontStyle: d.isOff ? 'bold' : 'normal' } };
          }
          if (d.isOff) {
            return { content: 'OFF', styles: { textColor: [220, 38, 38], fontStyle: 'bold', fontSize: 6 } };
          }
          return { content: d.rain > 0 ? d.rain.toFixed(1) : '-' };
        }),
        { content: String(offlineDaysCount), rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      body.push([
        { content: 'Cumulativo', styles: { fontStyle: 'bold', textColor: [0, 0, 139], fillColor: [203, 213, 225], fontSize: 7 } },
        ...cumRains.map((c, i) => ({
          content: c.rain > 0 ? c.rain.toFixed(1) : '-',
          styles: { fillColor: headersData[i].isSel ? [125, 211, 252] : [203, 213, 225], fontStyle: 'bold', textColor: [0, 0, 139] }
        }))
      ]);
    });

    pdf.autoTable({
      startY: 18,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle', lineColor: [148, 163, 184], lineWidth: 0.2 },
      headStyles: { fillColor: [0, 255, 255], textColor: [0, 0, 139], fontStyle: 'bold', fontSize: 6, lineColor: [100, 116, 139], lineWidth: 0.3 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 } }
    });

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function executeCalculation() {
    setError('');
    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }
    const selDateObj = uniqueDates[selectedDateIndex];
    if (selDateObj && els.selectedDayLabel) els.selectedDayLabel.textContent = selDateObj.display;
    if (els.statusText) els.statusText.textContent = `${RELEASE} · Report generato.`;
    if (els.savePdfField) els.savePdfField.classList.remove('hidden');
    renderMatrixTable();
  }

  async function init() {
    try {
      ensureSortSelect();
      ensureTableWrapper();

      const [weatherText, stationsText] = await Promise.all([
        fetchCsvFile(WEATHER_CSV),
        fetchCsvFile(STATIONS_CSV).catch(() => '')
      ]);

      weatherRawData = parseCsv(weatherText).data || [];
      const stationsRawData = stationsText ? (parseCsv(stationsText).data || []) : [];

      stationsMetaMap = processStationsMeta(stationsRawData, weatherRawData);
      processWeatherData(weatherRawData);

      if (uniqueDates.length > 0) {
        if (els.lastUpdate) els.lastUpdate.textContent = uniqueDates[0].display;
        populateDaySelect();
        renderMatrixTable();
      } else {
        throw new Error("Nessuna data valida estratta dal file meteo.");
      }

      if (els.stationsCount) els.stationsCount.textContent = String(stationMap.size);
      if (els.recordsCount) els.recordsCount.textContent = String(weatherRawData.length);
      if (els.statusText) els.statusText.textContent = `${RELEASE} · Pronto.`;
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  }

  if (els.executeBtn) els.executeBtn.addEventListener('click', executeCalculation);
  if (els.savePdfBtn) els.savePdfBtn.addEventListener('click', generatePdf);
  if (els.sidebarToggleInside) els.sidebarToggleInside.addEventListener('click', toggleSidebar);
  if (els.sidebarToggleMini) els.sidebarToggleMini.addEventListener('click', toggleSidebar);

  init();
})();