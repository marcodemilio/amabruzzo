(() => {
  const SPECIES_CSV = './speciecrescita.csv';
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const STATIONS_CSV = './stazioni_meteo.csv';
  const RELEASE = 'Rel. 02-A-043';

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
  let selectedDateIndex = -1;

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
      dynamicTyping: true,
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
      if (!res.ok) {
        throw new Error(`File non trovato o errore HTTP ${res.status} su ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (window.location.protocol === 'file:') {
        throw new Error(`I file CSV non possono essere letti tramite file://. Avviare la pagina con un web server locale (es. Live Server in VS Code).`);
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
        if (selectedDateIndex >= 0) {
          renderMatrixTable();
        }
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
    const stationKeys = ['stazionemeteo', 'stazione', 'codicestazione', 'idstazione', 'stazioneid', 'id', 'nome', 'nomestazione', 'riferimento'];
    const rainKeys = ['pioggiagiornaliera', 'pioggia', 'precipitazione', 'rain', 'mm', 'precipitazioni'];

    rows.forEach(r => {
      const rawDate = getRowValue(r, dateKeys);
      const dObj = parseDateStr(rawDate);
      if (!dObj) return;

      const dateStr = formatDateDisplay(dObj);
      const timeKey = dObj.getTime();

      if (!dateMap.has(timeKey)) {
        dateMap.set(timeKey, { time: timeKey, dateObj: dObj, display: dateStr });
      }

      const rawStName = getRowValue(r, stationKeys);
      const stName = resolveStationName(rawStName, r);
      const rainVal = parseFloat(getRowValue(r, rainKeys) || 0) || 0;

      if (!stations.has(stName)) {
        stations.set(stName, new Map());
      }

      const stData = stations.get(stName);
      stData.set(dateStr, (stData.get(dateStr) || 0) + rainVal);
    });

    uniqueDates = Array.from(dateMap.values()).sort((a, b) => b.time - a.time);
    stationMap = stations;
  }

  function populateDaySelect() {
    if (!els.daySelect) return;
    els.daySelect.innerHTML = '<option value="">Seleziona un giorno</option>';

    uniqueDates.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${d.display} (Giorno ${idx === 0 ? '0' : '-' + idx})`;
      els.daySelect.appendChild(opt);
    });

    els.daySelect.classList.remove('placeholder');

    // Sincronizza immediatamente selectedDateIndex al cambio opzione
    els.daySelect.addEventListener('change', () => {
      if (els.daySelect.value !== '') {
        selectedDateIndex = parseInt(els.daySelect.value, 10);
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
        const rainA = targetDateStr ? (a[1].get(targetDateStr) || 0) : 0;
        const rainB = targetDateStr ? (b[1].get(targetDateStr) || 0) : 0;
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

    if (selectedDateIndex < 0 && els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }

    if (selectedDateIndex < 0) return;

    const visibleDates = uniqueDates.slice(selectedDateIndex, selectedDateIndex + 31);
    const sortedStations = getSortedStationsList(visibleDates);

    let headHtml = `
      <tr>
        <th class="name-cell">Stazione / Data</th>
        ${visibleDates.map((d, i) => `
          <th class="${i === 0 ? 'selected-column' : ''}" style="font-size:0.72rem; padding: 6px 2px; width:48px; min-width:48px;">
            ${d.display.slice(0, 5)}
          </th>
        `).join('')}
      </tr>
    `;
    els.tableHead.innerHTML = headHtml;

    let bodyHtml = '';

    sortedStations.forEach(([stName, rainByDate]) => {
      let dailyRains = visibleDates.map(d => rainByDate.get(d.display) || 0);

      let cumRains = [];
      let runningSum = 0;
      for (let i = dailyRains.length - 1; i >= 0; i--) {
        runningSum += dailyRains[i];
        cumRains[i] = runningSum;
      }

      const displayName = cleanStationName(stName);

      bodyHtml += `
        <tr class="rain-row">
          <td class="name-cell">
            <span class="station-name">${displayName}</span>
          </td>
          ${dailyRains.map((r, i) => `
            <td class="${i === 0 ? 'selected-column' : ''}" style="font-size:0.78rem; padding:6px 2px; width:48px; min-width:48px;">
              ${r > 0 ? r.toFixed(1) : '-'}
            </td>
          `).join('')}
        </tr>
        <tr class="cum-row">
          <td class="name-cell">
            <span class="selected-cumulative">  └ Pioggia Cumulata</span>
          </td>
          ${cumRains.map((c, i) => `
            <td class="${i === 0 ? 'selected-column' : ''}" style="font-size:0.78rem; padding:6px 2px; width:48px; min-width:48px;">
              ${c > 0 ? c.toFixed(1) : '-'}
            </td>
          `).join('')}
        </tr>
      `;
    });

    els.tableBody.innerHTML = bodyHtml;
  }

  function generatePdf() {
    // Forziamo sempre la lettura della data attualmente selezionata nel dropdown
    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    }

    if (selectedDateIndex < 0 || !uniqueDates[selectedDateIndex]) {
      setError('Seleziona prima un giorno dal menu.');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      setError('Libreria jsPDF non disponibile.');
      return;
    }

    setError('');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');

    const selDateObj = uniqueDates[selectedDateIndex];
    const visibleDates = uniqueDates.slice(selectedDateIndex, selectedDateIndex + 31);
    const sortedStations = getSortedStationsList(visibleDates);

    // Recupera l'etichetta dell'ordinamento selezionato
    const sortText = els.sortSelect && els.sortSelect.options[els.sortSelect.selectedIndex]
      ? els.sortSelect.options[els.sortSelect.selectedIndex].text
      : 'Id Stazione';

    // Testata PDF con Ordinamento Selezionato e Rel. 02-A-043
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(`Report Piogge Giornaliere e Pioggia Cumulata - Ordinamento: ${sortText}`, 14, 10);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`${RELEASE} · Data Riferimento: ${selDateObj.display} · Ordinamento: ${sortText} · Generato il ${new Date().toLocaleString('it-IT')}`, 14, 15);

    const head = [
      ['Stazione / Tipo', ...visibleDates.map(d => d.display.slice(0, 5))]
    ];

    const body = [];
    sortedStations.forEach(([stName, rainByDate]) => {
      let dailyRains = visibleDates.map(d => rainByDate.get(d.display) || 0);
      let cumRains = [];
      let runningSum = 0;
      for (let i = dailyRains.length - 1; i >= 0; i--) {
        runningSum += dailyRains[i];
        cumRains[i] = runningSum;
      }

      const displayName = cleanStationName(stName);

      // Riga 1: Nome Stazione (pulito da "(gg)")
      body.push([
        displayName,
        ...dailyRains.map(r => r > 0 ? r.toFixed(1) : '-')
      ]);

      // Riga 2: Pioggia Cumulata
      body.push([
        `  └ Pioggia Cumulata`,
        ...cumRains.map(c => c > 0 ? c.toFixed(1) : '-')
      ]);
    });

    pdf.autoTable({
      startY: 18,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [223, 243, 246], textColor: [22, 51, 56], fontStyle: 'bold', fontSize: 6 },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 42 } }
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
    const val = els.daySelect ? els.daySelect.value : '';
    if (val === '') {
      setError('Seleziona un giorno dal menu prima di eseguire.');
      return;
    }

    setError('');
    selectedDateIndex = parseInt(val, 10);
    const selDateObj = uniqueDates[selectedDateIndex];

    if (els.selectedDayLabel) {
      els.selectedDayLabel.textContent = selDateObj.display;
    }

    if (els.statusText) {
      els.statusText.textContent = `${RELEASE} · Calcolo completato per il giorno ${selDateObj.display}.`;
    }

    if (els.savePdfField) {
      els.savePdfField.classList.remove('hidden');
    }

    renderMatrixTable();
  }

  async function init() {
    try {
      ensureSortSelect();

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
      } else {
        throw new Error("Nessuna data valida estratta dal file meteo.");
      }

      if (els.stationsCount) els.stationsCount.textContent = String(stationMap.size);
      if (els.recordsCount) els.recordsCount.textContent = String(weatherRawData.length);

      if (els.statusText) {
        els.statusText.textContent = `${RELEASE} · Caricati ${weatherRawData.length} record per ${stationMap.size} stazioni. Seleziona un giorno e premi Esegui.`;
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