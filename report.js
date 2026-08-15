(() => {
  const SPECIES_CSV = './speciecrescita.csv';
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const STATIONS_CSV = './stazioni_meteo.csv';
  const RELEASE = 'Rel. 03-A-018';

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
  let speciesData = [];
  let stationsMetaMap = new Map();
  let uniqueDates = [];
  let stationMap = new Map();
  let selectedDateIndex = 0;

  // Iniezione stili CSS per Barra Orizzontale in Alto, Scroll, Padding destra e Modal Popup Completo
  if (!document.getElementById('offlineStyle')) {
    const style = document.createElement('style');
    style.id = 'offlineStyle';
    style.textContent = `
      .offline-cell {
        background-color: #fca5a5 !important;
        color: #7f1d1d !important;
        font-weight: 600;
        font-style: italic;
      }
      .selected-column {
        background-color: #fef08a !important;
        color: #000000 !important;
      }
      td.offline-cell.selected-column, td.selected-column.offline-cell {
        background-color: #fef08a !important;
        color: #000000 !important;
      }
      .top-scroll-container {
        overflow-x: auto !important;
        overflow-y: hidden !important;
        height: 16px !important;
        margin-bottom: 4px !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 4px;
        background-color: #f8fafc;
      }
      .top-scroll-dummy {
        height: 1px;
      }
      .table-scroll-container {
        max-height: 68vh !important;
        overflow-y: auto !important;
        overflow-x: auto !important;
        position: relative !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 6px;
        background-color: #ffffff;
        padding-right: 24px !important; /* Evita copertura ultima colonna */
      }
      table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
        width: max-content !important;
        min-width: 100% !important;
      }
      thead th {
        position: sticky !important;
        top: 0 !important;
        z-index: 20 !important;
        background-color: #00FFFF !important;
        color: #00008B !important;
        box-shadow: inset 0 -1px 0 #cbd5e1;
      }
      .name-cell {
        position: sticky !important;
        left: 0 !important;
        z-index: 10 !important;
        background-color: #ffffff !important;
        box-shadow: inset -1px 0 0 #cbd5e1;
        cursor: pointer;
      }
      .name-cell:hover {
        background-color: #e0f2fe !important;
      }
      thead th.name-cell {
        z-index: 30 !important;
        background-color: #00FFFF !important;
        color: #00008B !important;
        cursor: default;
      }
      .rain-row td.name-cell {
        background-color: #ffffff !important;
      }
      .cum-row td.name-cell {
        background-color: #7fffd4 !important;
      }
      .cum-row td {
        background-color: #7fffd4 !important;
        font-weight: 600 !important;
        color: #ff0000 !important;
        border-top: 1px solid #cbd5e1 !important;
        border-bottom: 1px solid #cbd5e1 !important;
      }
      .cum-row td.selected-column {
        background-color: #fef08a !important;
        color: #ff0000 !important;
      }
      /* Stili Popup Modal Completo (Piogge e Temperature) */
      .station-modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
      }
      .station-modal-box {
        background: #ffffff;
        padding: 24px;
        border-radius: 8px;
        width: 700px;
        max-width: 95%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        font-family: inherit;
      }
      .station-modal-box h3 {
        margin-top: 0;
        color: #00008B;
        border-bottom: 2px solid #00FFFF;
        padding-bottom: 8px;
      }
      .station-modal-content {
        overflow-y: auto;
        margin-top: 12px;
        margin-bottom: 16px;
        padding-right: 4px;
      }
      .station-modal-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        margin-top: 10px;
      }
      .station-modal-table th, .station-modal-table td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
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
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        width: 100%;
      }
      .station-modal-close:hover {
        background: #000066;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTableWrapper() {
    const tableEl = document.querySelector('table');
    if (tableEl && !tableEl.parentElement.classList.contains('table-scroll-container')) {
      const parent = tableEl.parentNode;

      const topScroll = document.createElement('div');
      topScroll.className = 'top-scroll-container';
      topScroll.id = 'topScrollContainer';
      const topDummy = document.createElement('div');
      topDummy.className = 'top-scroll-dummy';
      topDummy.id = 'topScrollDummy';
      topScroll.appendChild(topDummy);

      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll-container';
      wrapper.id = 'mainTableScrollContainer';

      parent.insertBefore(topScroll, tableEl);
      parent.insertBefore(wrapper, tableEl);
      wrapper.appendChild(tableEl);

      topScroll.addEventListener('scroll', () => {
        if (wrapper.scrollLeft !== topScroll.scrollLeft) {
          wrapper.scrollLeft = topScroll.scrollLeft;
        }
      });
      wrapper.addEventListener('scroll', () => {
        if (topScroll.scrollLeft !== wrapper.scrollLeft) {
          topScroll.scrollLeft = wrapper.scrollLeft;
        }
      });
    }
  }

  function updateTopScrollWidth() {
    const tableEl = document.querySelector('table');
    const topDummy = document.getElementById('topScrollDummy');
    if (tableEl && topDummy) {
      topDummy.style.width = (tableEl.scrollWidth + 30) + 'px';
    }
  }

  function showStationPopup(stName) {
    const meta = getStationMetaByName(stName) || { name: stName, id: 'N/D', ref: 'N/D', code: 'N/D', lat: 'N/D', long: 'N/D', zona: 'N/D' };
    const rawStData = stationMap.get(stName); // Map di date -> { rain, tmin, tmax, tmed, offline }

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
      rowsHtml = `<tr><td colspan="5">Nessun dato dettagliato disponibile per questa stazione.</td></tr>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'station-modal-overlay';
    overlay.innerHTML = `
      <div class="station-modal-box">
        <h3>Dettagli Stazione: ${meta.name || stName}</h3>
        <p style="margin:4px 0; font-size:0.85rem; color:#475569;">
          <strong>ID:</strong> ${meta.id ?? 'N/D'} | <strong>Zona:</strong> ${meta.zona ?? 'N/D'} | <strong>Coord:</strong> Lat ${meta.lat ?? 'N/D'}, Lon ${meta.long ?? 'N/D'}
        </p>
        <div class="station-modal-content">
          <table class="station-modal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pioggia</th>
                <th>Temp. Min</th>
                <th>Temp. Max</th>
                <th>Temp. Media</th>
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
      throw new Error("Libreria PapaParse non trovata. Verificare il caricamento nell'HTML.");
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
    setTimeout(() => updateTopScrollWidth(), 300);
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
      if (!res.ok) {
        throw new Error(`File non trovato o errore HTTP ${res.status} su ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (window.location.protocol === 'file:') {
        throw new Error(`I file CSV non possono essere letti tramite file://. Avviare la pagina con un web server locale.`);
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
            <option value="geo">Zona Geografica</option>
          </select>
        `;
        daySelectField.parentNode.insertBefore(fieldDiv, daySelectField.nextSibling);
        sortSelect = document.getElementById('sortSelect');
      }
    }
    els.sortSelect = sortSelect;
    if (els.sortSelect) {
      els.sortSelect.addEventListener('change', () => {
        renderMatrixTable();
      });
    }

    if (els.savePdfBtn) {
      els.savePdfBtn.textContent = 'Genera PDF';
    }
  }

  function processStationsMeta(rows) {
    const map = new Map();
    rows.forEach(r => {
      const id = parseInt(getRowValue(r, ['id', 'idstazione', 'codice']), 10) || null;
      const name = getRowValue(r, ['stazionemeteo', 'stazione', 'nome', 'nomestazione']);
      const ref = getRowValue(r, ['riferimento']);
      const code = getRowValue(r, ['codicestazione', 'codice']);
      const lat = parseFloat(getRowValue(r, ['lat', 'latitude'])) || null;
      const long = parseFloat(getRowValue(r, ['long', 'longitude', 'lng'])) || null;
      const zona = getRowValue(r, ['zonageo', 'zona', 'zonageografica', 'ordinegeo', 'ordine_geo', 'area']);

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
    return map;
  }

  function getStationMetaByName(stName) {
    const key = normalizeKey(stName);
    return stationsMetaMap.get(key) || null;
  }

  function resolveStationName(rawVal, row) {
    if (!rawVal) return 'Stazione Sconosciuta';

    const key = normalizeKey(rawVal);
    if (stationsMetaMap.has(key)) {
      return stationsMetaMap.get(key).name;
    }

    const rowId = getRowValue(row, ['id', 'idstazione']);
    if (rowId !== null) {
      const idKey = normalizeKey(rowId);
      if (stationsMetaMap.has(idKey)) {
        return stationsMetaMap.get(idKey).name;
      }
    }

    return String(rawVal).trim();
  }

  function processWeatherData(rows) {
    const dateMap = new Map();
    const stations = new Map();

    const dateKeys = ['datarilevamento', 'data', 'dataril', 'date', 'giorno'];
    const stationKeys = ['idstazione', 'codicestazione', 'stazionemeteo', 'stazione', 'id', 'nome', 'nomestazione', 'riferimento'];
    const rainKeys = ['pioggiagiornaliera', 'pioggia', 'precipitazione', 'rain', 'mm', 'precipitazioni'];
    const offlineKeys = ['offline', 'stato', 'status', 'online', 'funzionante'];
    const tMinKeys = ['tempmin', 'temperaturaminima', 'tmin', 'minima'];
    const tMaxKeys = ['tempmax', 'temperaturamassima', 'tmax', 'massima'];
    const tMedKeys = ['tempmed', 'temperaturamedia', 'tmed', 'media', 'temperatura'];

    rows.forEach(r => {
      const rawDate = getRowValue(r, dateKeys);
      const dObj = parseDateStr(rawDate);
      if (!dObj) return;

      const dateStr = formatDateDisplay(dObj);
      const timeKey = dObj.getTime();

      if (!dateMap.has(timeKey)) {
        dateMap.set(timeKey, { time: timeKey, dateObj: dObj, display: dateStr });
      }

      const rawStId = getRowValue(r, ['idstazione', 'codicestazione', 'id']) || getRowValue(r, stationKeys);
      const stName = resolveStationName(rawStId, r);
      
      const rawRain = getRowValue(r, rainKeys);
      const rainVal = parseFloat(String(rawRain || '0').replace(',', '.')) || 0;

      const rawTMin = getRowValue(r, tMinKeys);
      const tMinVal = rawTMin !== null ? parseFloat(String(rawTMin).replace(',', '.')) : null;

      const rawTMax = getRowValue(r, tMaxKeys);
      const tMaxVal = rawTMax !== null ? parseFloat(String(rawTMax).replace(',', '.')) : null;

      const rawTMed = getRowValue(r, tMedKeys);
      const tMedVal = rawTMed !== null ? parseFloat(String(rawTMed).replace(',', '.')) : null;

      const rawOffline = getRowValue(r, offlineKeys);
      let isOffline = false;
      if (rawOffline !== null && rawOffline !== undefined) {
        const valStr = String(rawOffline).toLowerCase().trim();
        if (['true', '1', 'off', 'offline', 'no', 'guasto', 'nd'].includes(valStr)) {
          isOffline = true;
        }
      }
      const rawRainText = String(rawRain || '').toUpperCase();
      if (rawRainText.includes('N/D') || rawRainText.includes('OFF') || rawRainText === '-') {
        isOffline = true;
      }

      if (!stations.has(stName)) {
        stations.set(stName, new Map());
      }

      const stData = stations.get(stName);
      stData.set(dateStr, { 
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
      const relNum = -idx;
      opt.textContent = `${d.display} (${relNum})`;
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

        const latA = metaA?.lat ?? -999;
        const latB = metaB?.lat ?? -999;
        if (latB !== latA) return latB - latA;

        const longA = metaA?.long ?? 999;
        const longB = metaB?.long ?? 999;
        if (longA !== longB) return longA - longB;

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
    if (!els.tableHead || !els.tableBody) return;
    if (uniqueDates.length === 0) return;

    ensureTableWrapper();

    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }

    const startIdx = 0;
    const endIdx = Math.min(uniqueDates.length - 1, 30);
    const visibleDates = uniqueDates.slice(startIdx, endIdx + 1); 
    const sortedStations = getSortedStationsList(visibleDates);

    const headersData = visibleDates.map((d, i) => {
      const relDay = -i;
      const isSel = (i === selectedDateIndex);
      return { display: d.display, relDay, isSel };
    });

    let headHtml = `
      <tr>
        <th class="name-cell" rowspan="2" style="vertical-align:middle;">Stazione meteo</th>
        ${headersData.map(h => `
          <th class="${h.isSel ? 'selected-column' : ''}" style="font-size:0.7rem; padding: 4px 1px; width:34px; min-width:34px; text-align:center;">
            ${h.relDay}
          </th>
        `).join('')}
        <th rowspan="2" style="font-size:0.7rem; padding: 4px 2px; width:36px; min-width:36px; vertical-align:middle; background-color:#00FFFF !important; color:#00008B !important;" title="Giorni Offline nel periodo">G.O.</th>
      </tr>
      <tr>
        ${headersData.map(h => `
          <th class="${h.isSel ? 'selected-column' : ''}" style="font-size:0.65rem; padding: 4px 1px; width:34px; min-width:34px; text-align:center; font-weight:normal;">
            ${h.display.slice(0, 5)}
          </th>
        `).join('')}
      </tr>
    `;
    els.tableHead.innerHTML = headHtml;

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
        if (!dailyRains[i].isOff) {
          runningSum += dailyRains[i].rain;
        }
        cumRains[i] = { rain: runningSum, isOff: dailyRains[i].isOff };
      }

      const displayName = cleanStationName(stName);

      bodyHtml += `
        <tr class="rain-row">
          <td class="name-cell" data-station="${stName}">
            <span class="station-name">${displayName}</span>
          </td>
          ${dailyRains.map((d, i) => {
            const h = headersData[i];
            return `
              <td class="${h.isSel ? 'selected-column' : ''} ${d.isOff && !h.isSel ? 'offline-cell' : ''}" style="font-size:0.75rem; padding:4px 1px; width:34px; min-width:34px; text-align:center;">
                ${d.isOff ? 'OFF' : (d.rain > 0 ? d.rain.toFixed(1) : '-')}
              </td>
            `;
          }).join('')}
          <td rowspan="2" style="font-size:0.75rem; font-weight:800; background:#f9fafb; text-align:center; vertical-align:middle;">
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
              <td class="${h.isSel ? 'selected-column' : ''}" style="font-size:0.75rem; padding:4px 1px; width:34px; min-width:34px; text-align:center; color:#ff0000;">
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
        if (stationKey) {
          showStationPopup(stationKey);
        }
      });
    });

    updateTopScrollWidth();
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

    const startIdx = 0;
    const endIdx = Math.min(uniqueDates.length - 1, 30);
    const visibleDates = uniqueDates.slice(startIdx, endIdx + 1);
    const sortedStations = getSortedStationsList(visibleDates);

    const headersData = visibleDates.map((d, i) => {
      const relDay = -i;
      const isSel = (i === selectedDateIndex);
      return { display: d.display, relDay, isSel };
    });

    const selDateObj = uniqueDates[selectedDateIndex];
    const dateDisplayStr = selDateObj ? selDateObj.display : '-';
    const sortText = els.sortSelect && els.sortSelect.options[els.sortSelect.selectedIndex]
      ? els.sortSelect.options[els.sortSelect.selectedIndex].text
      : 'Id Stazione';
    const genDateStr = new Date().toLocaleString('it-IT');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`Piogge Giornaliere/Cumulate - Report per ${sortText} · Giorno evidenziato: ${dateDisplayStr} · ${RELEASE} · Generato il ${genDateStr}`, 14, 12);

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
        if (!dailyRains[i].isOff) {
          runningSum += dailyRains[i].rain;
        }
        cumRains[i] = { rain: runningSum, isOff: dailyRains[i].isOff };
      }

      const displayName = cleanStationName(stName);

      body.push([
        { content: displayName, styles: { valign: 'middle', fontStyle: 'bold' } },
        ...dailyRains.map((d, i) => {
          const h = headersData[i];
          if (h.isSel) {
            return {
              content: d.isOff ? 'OFF' : (d.rain > 0 ? d.rain.toFixed(1) : '-'),
              styles: {
                fillColor: [254, 240, 138],
                textColor: [0, 0, 0],
                fontStyle: d.isOff ? 'italic' : 'normal',
                fontSize: 6
              }
            };
          }
          if (d.isOff) {
            return {
              content: 'OFF',
              styles: {
                fillColor: [252, 165, 165],
                textColor: [127, 29, 29],
                fontStyle: 'italic',
                fontSize: 6
              }
            };
          }
          return {
            content: d.rain > 0 ? d.rain.toFixed(1) : '-'
          };
        }),
        { content: String(offlineDaysCount), rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      body.push([
        { content: 'Cumulativo', styles: { fontStyle: 'bold', textColor: [255, 0, 0], fillColor: [127, 255, 212] } },
        ...cumRains.map((c, i) => {
          const h = headersData[i];
          return {
            content: c.rain > 0 ? c.rain.toFixed(1) : '-',
            styles: {
              fillColor: h.isSel ? [254, 240, 138] : [127, 255, 212],
              fontStyle: 'bold',
              textColor: [255, 0, 0]
            }
          };
        })
      ]);
    });

    pdf.autoTable({
      startY: 18,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [0, 255, 255], textColor: [0, 0, 139], fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 } },
      didDrawPage: () => {
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        pdf.text('Legenda: G.O. = giorni offline nel periodo; OFF = stazione offline / nessun dato (sfondo rosso tenue).', 14, pageHeight - 8);
      }
    });

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function executeCalculation() {
    setError('');
    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }
    const selDateObj = uniqueDates[selectedDateIndex];

    if (selDateObj && els.selectedDayLabel) {
      els.selectedDayLabel.textContent = selDateObj.display;
    }

    if (els.statusText) {
      els.statusText.textContent = `${RELEASE} · Report generato correttamente per il giorno evidenziato ${selDateObj ? selDateObj.display : ''}.`;
    }

    if (els.savePdfField) {
      els.savePdfField.classList.remove('hidden');
    }

    renderMatrixTable();
  }

  async function init() {
    try {
      ensureSortSelect();
      ensureTableWrapper();

      const [speciesText, weatherText, stationsText] = await Promise.all([
        fetchCsvFile(SPECIES_CSV),
        fetchCsvFile(WEATHER_CSV),
        fetchCsvFile(STATIONS_CSV).catch(() => null)
      ]);

      if (stationsText) {
        const stationsParsed = parseCsv(stationsText);
        stationsMetaMap = processStationsMeta(stationsParsed.data || []);
      }

      const speciesParsed = parseCsv(speciesText);
      speciesData = (speciesParsed.data || [])
        .filter(s => s.id && (s.attivo === true || String(s.attivo).toLowerCase() === 'true'));

      const weatherParsed = parseCsv(weatherText);
      weatherRawData = weatherParsed.data || [];

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

      if (els.statusText) {
        els.statusText.textContent = `${RELEASE} · Caricati ${weatherRawData.length} record per ${stationMap.size} stazioni. Pronto.`;
      }

    } catch (error) {
      if (els.statusText) els.statusText.textContent = `${RELEASE} · Errore caricamento dati.`;
      setError(String(error?.message || error));
    }
  }

  if (els.executeBtn) els.executeBtn.addEventListener('click', executeCalculation);
  if (els.savePdfBtn) els.savePdfBtn.addEventListener('click', generatePdf);
  if (els.sidebarToggleInside) els.sidebarToggleInside.addEventListener('click', toggleSidebar);
  if (els.sidebarToggleMini) els.sidebarToggleMini.addEventListener('click', toggleSidebar);

  init();
})();
