(() => {
  const SPECIES_CSV = './speciefunghi.csv';
  const GROWTH_CSV = './speciecrescita.csv';
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const RELEASE = 'Rel. 03-D-003';

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
  let currentGrowthMap = new Map();
  let currentDayColumns = [];

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

  function getProbabilityClass(value) {
    const val = Number(value) || 0;
    if (val === 0) return 'p-0';
    if (val <= 30) return 'p-low';
    if (val <= 60) return 'p-mid';
    if (val < 100) return 'p-high';
    return 'p-peak';
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

  function formatWindowText(species) {
    const start = species.growthStartDays || '-';
    const peakStart = species.growthPeakStartDays || '-';
    const peakEnd = species.growthPeakEndDays || '-';
    const end = species.growthEndDays || '-';

    const peakText = (peakStart === peakEnd || !peakEnd) ? peakStart : `${peakStart}-${peakEnd}`;
    return `${start} | ${peakText} | ${end} gg`;
  }

  function renderTable(speciesList, growthMap, dayColumns) {
    // Genera Header
    let headHtml = `
      <tr>
        <th>Specie Funghi</th>
        <th>Finestra Crescita<br><small style="font-weight:normal; font-size:0.7rem;">(inizio | picco | fine)</small></th>
        ${dayColumns.map(day => `<th>Gg ${day}</th>`).join('')}
      </tr>
    `;
    els.tableHead.innerHTML = headHtml;

    // Genera Righe
    const rowsHtml = speciesList.map(species => {
      const id = species.id;
      const growthData = growthMap.get(id) || {};
      const windowText = formatWindowText(species);

      const dayCells = dayColumns.map(day => {
        const prob = growthData[day] !== undefined ? growthData[day] : '0';
        const cssClass = getProbabilityClass(prob);
        return `<td class="${cssClass}">${prob}${prob !== '0' ? '%' : ''}</td>`;
      }).join('');

      return `
        <tr>
          <td class="species-cell">
            ${species.nomeComune || species.nome}
            <span class="scientific-name">${species.nome || ''}</span>
          </td>
          <td class="window-cell">${windowText}</td>
          ${dayCells}
        </tr>
      `;
    }).join('');

    els.tableBody.innerHTML = rowsHtml;
  }

  function makePdf() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Probabilità di Crescita Specie - Report', 14, 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(
      `${RELEASE} · Generato il ${new Date().toLocaleString('it-IT')}`,
      14,
      18
    );

    const head = [
      [
        { content: 'Specie Funghi', styles: { halign: 'left', fillColor: [223, 243, 246], textColor: [22, 51, 56], fontStyle: 'bold' } },
        { content: 'Finestra Crescita\n(inizio | picco | fine)', styles: { halign: 'center', fillColor: [227, 241, 244], textColor: [22, 51, 56], fontStyle: 'bold' } },
        ...currentDayColumns.map(day => ({
          content: `Gg ${day}`,
          styles: { halign: 'center', fillColor: [234, 247, 251], textColor: [22, 72, 78], fontStyle: 'bold' }
        }))
      ]
    ];

    const body = currentSpeciesList.map(species => {
      const id = species.id;
      const growthData = currentGrowthMap.get(id) || {};
      const windowText = formatWindowText(species);

      const speciesName = `${species.nomeComune || species.nome}\n(${species.nome || ''})`;

      const dayCells = currentDayColumns.map(day => {
        const prob = growthData[day] !== undefined ? growthData[day] : '0';
        const val = Number(prob) || 0;

        let fillColor = [252, 252, 252];
        let textColor = [180, 180, 180];

        if (val > 0 && val <= 30) {
          fillColor = [232, 245, 233]; textColor = [46, 125, 50];
        } else if (val > 30 && val <= 60) {
          fillColor = [165, 214, 167]; textColor = [27, 94, 32];
        } else if (val > 60 && val < 100) {
          fillColor = [102, 187, 106]; textColor = [255, 255, 255];
        } else if (val >= 100) {
          fillColor = [46, 125, 50]; textColor = [255, 255, 255];
        }

        return {
          content: prob !== '0' ? `${prob}%` : '0',
          styles: {
            fillColor,
            textColor,
            fontStyle: val > 60 ? 'bold' : 'normal',
            halign: 'center'
          }
        };
      });

      return [
        { content: speciesName, styles: { halign: 'left', fontStyle: 'bold' } },
        { content: windowText, styles: { halign: 'center' } },
        ...dayCells
      ];
    });

    pdf.autoTable({
      startY: 24,
      head,
      body,
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.2,
        overflow: 'linebreak',
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 28 }
      },
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
      const [speciesText, growthText, weatherText] = await Promise.all([
        fetch(`${SPECIES_CSV}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()),
        fetch(`${GROWTH_CSV}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()),
        fetch(`${WEATHER_CSV}?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text()).catch(() => '')
      ]);

      if (weatherText) {
        updateLastUpdateFromWeather(weatherText);
      } else {
        els.lastUpdate.textContent = 'n/d';
      }

      const speciesParsed = parseCsv(speciesText);
      const growthParsed = parseCsv(growthText);

      currentSpeciesList = (speciesParsed.data || []).filter(s => s.id && (s.attivo === undefined || s.attivo === 'true'));
      const growthRows = growthParsed.data || [];

      const growthFields = growthParsed.meta.fields || [];
      currentDayColumns = growthFields.filter(f => !isNaN(Number(f))).sort((a, b) => Number(a) - Number(b));

      currentGrowthMap = new Map();
      growthRows.forEach(row => {
        if (row.id) {
          currentGrowthMap.set(row.id.trim(), row);
        }
      });

      currentSpeciesList.sort((a, b) => {
        const orderA = Number(a.ordine) || 999;
        const orderB = Number(b.ordine) || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.nomeComune || '').localeCompare(b.nomeComune || '');
      });

      els.speciesCount.textContent = String(currentSpeciesList.length);
      renderTable(currentSpeciesList, currentGrowthMap, currentDayColumns);

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