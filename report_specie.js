(() => {
  const SPECIES_CSV = './speciefunghi.csv';
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const RELEASE = 'Rel. 03-D-002';

  const els = {
    app: document.getElementById('app'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    speciesCount: document.getElementById('speciesCount'),
    statusText: document.getElementById('statusText'),
    errorBox: document.getElementById('errorBox'),
    lastUpdate: document.getElementById('lastUpdate'),
    createPdfBtn: document.getElementById('createPdfBtn'),
    sidebarToggleInside: document.getElementById('sidebarToggleInside'),
    sidebarToggleMini: document.getElementById('sidebarToggleMini')
  };

  let currentSpeciesList = [];
  let currentHeaders = [];

  // Mappa delle intestazioni dal CSV originale a Italiano leggibile
  const headerMap = {
    nome: 'Nome Scientifico',
    nomeComune: 'Nome Comune',
    habitat: 'Habitat',
    altMin: 'Alt Min (m)',
    altMax: 'Alt Max (m)',
    mesiInizio: 'Inizio (Mese)',
    mesiFine: 'Fine (Mese)',
    zeroFinoAlMese: 'Zero Mese',
    rainReq: 'Pioggia Req. (mm)',
    rainWindowDays: 'Finestra Pioggia (gg)',
    eventThresholdFactor: 'Fattore Soglia',
    growthStartDays: 'Inizio Crescita (gg)',
    growthPeakStartDays: 'Inizio Picco (gg)',
    growthPeakEndDays: 'Fine Picco (gg)',
    growthEndDays: 'Fine Crescita (gg)',
    giorniMinDopoPioggia: 'Min gg Dopo Pioggia',
    giorniMaxDopoPioggia: 'Max gg Dopo Pioggia',
    tempMin: 'T. Min (°C)',
    tempOttimale: 'T. Ottimale (°C)',
    tempMax: 'T. Max (°C)',
    termofilo: 'Termofilo',
    pesoEvento: 'Peso Evento',
    pesoTemperatura: 'Peso Temp.',
    pesoAltitudine: 'Peso Altitudine',
    pesoStagione: 'Peso Stagione',
    note: 'Note'
  };

  function delimiter(text) {
    const candidates = [';', ',', '\t', '|'];
    return candidates.map(character => ({
      character,
      count: (text.match(new RegExp('\\' + character, 'g')) || []).length
    })).sort((a, b) => b.count - a.count)[0].character;
  }

  function parseCsv(text) {
    return Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter(text),
      transformHeader: header => header.trim(),
      transform: value => String(value).trim()
    });
  }

  function setError(message) {
    els.errorBox.style.display = message ? 'block' : 'none';
    els.errorBox.textContent = message || '';
  }

  function toggleSidebar() {
    els.app.classList.toggle('sidebar-collapsed');
  }

  function updateLastUpdateFromWeather(weatherText) {
    try {
      const parsed = parseCsv(weatherText);
      const rows = parsed.data || [];
      let maxDateStr = "";
      let maxTimestamp = -1;

      rows.forEach(row => {
        const rawVal = row.DataRilevamento || row.datarilevamento || row.DATA_RILEVAMENTO || row.data;
        if (!rawVal) return;

        const strVal = String(rawVal).trim();
        let timestamp = NaN;

        if (strVal.includes('/')) {
          const [datePart, timePart = "00:00:00"] = strVal.split(' ');
          const [d, m, y] = datePart.split('/').map(Number);
          const [hh, mm, ss] = timePart.split(':').map(Number);
          timestamp = new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0).getTime();
        } else {
          timestamp = new Date(strVal).getTime();
        }

        if (!isNaN(timestamp) && timestamp > maxTimestamp) {
          maxTimestamp = timestamp;
          maxDateStr = strVal;
        }
      });

      if (maxDateStr && els.lastUpdate) {
        els.lastUpdate.textContent = maxDateStr;
      } else {
        els.lastUpdate.textContent = 'Non disponibile';
      }
    } catch (e) {
      els.lastUpdate.textContent = 'Errore lettura data';
    }
  }

  function renderTable() {
    // Intestazione
    let headHtml = '<tr>';
    currentHeaders.forEach(key => {
      const displayName = headerMap[key] || key;
      headHtml += `<th>${displayName}</th>`;
    });
    headHtml += '</tr>';
    els.tableHead.innerHTML = headHtml;

    // Righe
    const rowsHtml = currentSpeciesList.map(species => {
      let rowHtml = '<tr>';
      currentHeaders.forEach(key => {
        let val = species[key] || '-';
        if (val === 'true') val = 'Sì';
        if (val === 'false') val = 'No';
        
        let cellClass = '';
        if (key === 'habitat') cellClass = ' class="habitat-cell"';
        if (key === 'note') cellClass = ' class="notes-cell"';

        rowHtml += `<td${cellClass}>${val}</td>`;
      });
      rowHtml += '</tr>';
      return rowHtml;
    }).join('');

    els.tableBody.innerHTML = rowsHtml;
  }

  function makePdf() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a3');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Dati Specie Funghi - Report Completo', 14, 14);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(
      `${RELEASE} · Generato il ${new Date().toLocaleString('it-IT')}`,
      14,
      20
    );

    const head = [ currentHeaders.map(key => headerMap[key] || key) ];

    const body = currentSpeciesList.map(species => {
      return currentHeaders.map(key => {
        let val = species[key] || '';
        if (val === 'true') val = 'Sì';
        if (val === 'false') val = 'No';
        return val;
      });
    });

    const habitatIdx = currentHeaders.indexOf('habitat');
    const noteIdx = currentHeaders.indexOf('note');

    const colStyles = {
      0: { cellWidth: 28, fontStyle: 'italic' }, // Nome Scientifico
      1: { cellWidth: 28, fontStyle: 'bold' }    // Nome Comune
    };
    if (habitatIdx !== -1) colStyles[habitatIdx] = { cellWidth: 35 };
    if (noteIdx !== -1) colStyles[noteIdx] = { cellWidth: 35 };

    pdf.autoTable({
      startY: 26,
      head: head,
      body: body,
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.5,
        overflow: 'linebreak',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [223, 243, 246],
        textColor: [22, 51, 56],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: colStyles,
      margin: { left: 8, right: 8 }
    });

    return pdf;
  }

  function openPdf() {
    if (!currentSpeciesList.length) return;
    const pdf = makePdf();
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function init() {
    try {
      const [speciesText, weatherText] = await Promise.all([
        fetch(`${SPECIES_CSV}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()),
        fetch(`${WEATHER_CSV}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()).catch(() => '')
      ]);

      if (weatherText) {
        updateLastUpdateFromWeather(weatherText);
      } else {
        els.lastUpdate.textContent = 'n/d';
      }

      const speciesParsed = parseCsv(speciesText);
      const rawHeaders = speciesParsed.meta.fields || [];

      // Escludi espressamente id, attivo e ordine
      const excludedKeys = ['id', 'attivo', 'ordine'];
      currentHeaders = rawHeaders.filter(key => !excludedKeys.includes(key));
      currentSpeciesList = speciesParsed.data || [];

      // Ordina per colonna "ordine" se disponibile
      currentSpeciesList.sort((a, b) => {
        const orderA = Number(a.ordine) || 999;
        const orderB = Number(b.ordine) || 999;
        return orderA - orderB;
      });

      els.speciesCount.textContent = String(currentSpeciesList.length);
      renderTable();

      els.statusText.textContent = `${RELEASE} · Dati caricati con successo.`;
      setError('');

    } catch (error) {
      els.statusText.textContent = `${RELEASE} · Errore caricamento dati.`;
      setError(String(error?.stack || error));
    }
  }

  els.createPdfBtn.addEventListener('click', openPdf);
  els.sidebarToggleInside.addEventListener('click', toggleSidebar);
  els.sidebarToggleMini.addEventListener('click', toggleSidebar);

  init();
})();