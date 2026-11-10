(() => {
  const WEATHER_CSV = './dati_meteo_30g.csv';
  const STATIONS_CSV = './dati_stazioni_30g.csv';
  const RELEASE = 'Rel. 02-WB-014';

  const els = {
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),
    daySelect: document.getElementById('daySelect'),
    sortSelect: document.getElementById('sortSelect'),
    executeBtn: document.getElementById('executeBtn'),
    savePdfBtn: document.getElementById('savePdfBtn'),
    savePdfField: document.getElementById('savePdfField'),
    rifAttivoText: document.getElementById('rifAttivoText'),
    ordAttivoText: document.getElementById('ordAttivoText'),
    errorBox: document.getElementById('errorBox'),
    dynamicReportSubtitle: document.getElementById('dynamicReportSubtitle')
  };

  let weatherRawData = [];
  let stationsMetaMap = new Map();
  let uniqueDates = [];
  let stationMatrix = new Map();
  let selectedDateIndex = 0;

  if (!document.getElementById('professionalReportStyle')) {
    const style = document.createElement('style');
    style.id = 'professionalReportStyle';
    style.textContent = `
      .offline-cell { 
        background-color: #f1f5f9 !important; 
        color: #64748b !important; 
        font-weight: 600 !important; 
        font-style: italic;
      }
      .selected-column { 
        background-color: #e6f0fa !important; 
        color: #00539F !important; 
        font-weight: 600;
      }
      thead th.selected-column { 
        background-color: #d0e4f7 !important; 
        color: #00539F !important; 
        font-weight: 700 !important; 
      }
      .table-scroll-container { 
        max-height: calc(100vh - 240px) !important; 
        overflow: auto !important; 
        border: 1px solid #d0d7de !important; 
        border-radius: 0.375rem; 
        background-color: #ffffff;
      }
      table { 
        border-collapse: separate !important; 
        border-spacing: 0 !important; 
        width: 100% !important; 
        font-family: 'Figtree', system-ui, -apple-system, sans-serif;
      }
      th, td { 
        white-space: nowrap !important; 
        padding: 5px 8px !important; 
        text-align: center; 
        border-right: 1px solid #cbd5e1 !important; 
        border-bottom: 1px solid #e2e8f0 !important; 
        font-size: 0.76rem;
        color: #111827;
        font-weight: 500;
      }
      thead th { 
        position: sticky !important; 
        top: 0 !important; 
        z-index: 20 !important; 
        background-color: #f8fafc !important; 
        color: #111827 !important; 
        font-weight: 700;
        border-bottom: 2px solid #00539F !important;
        font-size: 0.76rem;
        padding: 6px 8px !important;
      }
      .name-cell { 
        position: sticky !important; 
        left: 0 !important; 
        z-index: 10 !important; 
        cursor: pointer; 
        width: 220px !important; 
        min-width: 220px !important; 
        text-align: left !important; 
        padding-left: 10px !important; 
        border-right: 2px solid #cbd5e1 !important; 
        font-weight: 700;
        color: #111827;
        font-size: 0.76rem;
      }
      .name-cell:hover { background-color: #e6f0fa !important; color: #00539F !important; }
      thead th.name-cell { z-index: 30 !important; background-color: #f8fafc !important; }
      
      .station-group-even td { background-color: #ffffff; }
      .station-group-odd td { background-color: #f8fafc; }
      
      .station-group-even .name-cell { background-color: #ffffff !important; }
      .station-group-odd .name-cell { background-color: #f8fafc !important; }

      .cum-row td { 
        font-weight: 700 !important; 
        color: #334155 !important; 
        border-bottom: 2.5px solid #94a3b8 !important; 
      }
      .cum-row .name-cell {
        color: #475569 !important;
        font-weight: 600;
      }

      .station-modal-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(17, 24, 39, 0.6); display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 16px; backdrop-filter: blur(2px);
      }
      .station-modal-box {
        background: #ffffff; padding: 20px; border-radius: 0.375rem; width: 100%; max-width: 520px; max-height: 85vh;
        display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        font-family: inherit; border: 1px solid #d0d7de;
      }
      .station-modal-box h3 {
        margin-top: 0; font-size: 1.15rem; color: #00539F; border-bottom: 2px solid #00539F; padding-bottom: 8px; font-weight: 800; text-transform: uppercase;
      }
      .station-modal-content { overflow-y: auto; -webkit-overflow-scrolling: touch; margin-top: 8px; margin-bottom: 16px; }
      .station-modal-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 4px; }
      .station-modal-table th, .station-modal-table td { border: 1px solid #d0d7de; padding: 6px 6px; text-align: center; color: #111827; }
      .station-modal-table th { background-color: #f8fafc; color: #111827; font-weight: 700; }
      .station-modal-close {
        background: #00539F; color: #ffffff; border: none; padding: 10px; border-radius: 0.375rem;
        cursor: pointer; font-weight: 700; width: 100%; font-size: 0.9rem; text-transform: uppercase;
      }
      .station-modal-close:hover { background: #003d78; }
    `;
    document.head.appendChild(style);
  }

  function updateActiveIndicators() {
    const selDateObj = uniqueDates[selectedDateIndex];
    const dateStr = selDateObj ? selDateObj.display : '—';
    if (els.rifAttivoText) {
      els.rifAttivoText.textContent = `Rif. attivo: ${dateStr}`;
    }

    if (els.ordAttivoText && els.sortSelect) {
      const opt = els.sortSelect.options[els.sortSelect.selectedIndex];
      const sortText = opt ? opt.text : 'ID Stazione';
      els.ordAttivoText.textContent = `Ord. attivo: ${sortText}`;
    }

    if (els.savePdfBtn) {
      els.savePdfBtn.innerHTML = '&#128196; Genera Report';
    }
  }

  function showStationPopup(stName) {
    const rawStData = stationMatrix.get(stName);
    let rowsHtml = '';
    if (uniqueDates.length > 0 && rawStData) {
      uniqueDates.forEach((d, i) => {
        const dayRecord = rawStData.get(d.display);
        const rain = dayRecord ? (dayRecord.offline ? 'OFF' : `${dayRecord.rain.toFixed(1)} mm`) : '-';
        rowsHtml += `
          <tr>
            <td>${d.display} (-${i})</td>
            <td><strong>${rain}</strong></td>
          </tr>
        `;
      });
    } else {
      rowsHtml = `<tr><td colspan="2">Nessun dato dettagliato disponibile.</td></tr>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'station-modal-overlay';
    overlay.innerHTML = `
      <div class="station-modal-box">
        <h3>${stName}</h3>
        <div class="station-modal-content">
          <table class="station-modal-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Pioggia Giornaliera</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <button class="station-modal-close" id="closeModalBtn">Chiudi Finestra</button>
      </div>
    `;

    document.body.appendChild(overlay);
    const closeModal = () => overlay.remove();
    overlay.querySelector('#closeModalBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  function setError(message) {
    if (els.errorBox) {
      els.errorBox.style.display = message ? 'block' : 'none';
      els.errorBox.textContent = message || '';
    }
  }

  function parseDateStr(strVal) {
    if (!strVal) return null;
    const str = String(strVal).trim();
    const [datePart] = str.split('T')[0].split(' ');
    
    if (datePart && datePart.includes('/')) {
      const parts = datePart.split('/').map(Number);
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    if (datePart && datePart.includes('-')) {
      const parts = datePart.split('-').map(Number);
      if (parts.length === 3) {
        if (parts[0] > 1000) {
          return new Date(parts[0], parts[1] - 1, parts[2]);
        }
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

  const fetchText = async path => {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} per ${path}`);
    return response.text();
  };

  const delimiter = text => {
    return [';',',','\t','|'].map(character => ({
      character,
      count:(text.split(/\r?\n/).slice(0,10).join('\n').match(new RegExp('\\' + character, 'g')) || []).length
    })).sort((a,b) => b.count - a.count)[0].character;
  };

  const num = value => {
    const result = parseFloat(String(value ?? '').replace(',','.').trim());
    return Number.isFinite(result) ? result : 0;
  };

  const get = (row, ...keys) => {
    if (!row) return '';
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[\s_]/g, '');
      const found = rowKeys.find(k => k.toLowerCase().replace(/[\s_]/g, '') === cleanKey);
      if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
        return String(row[found]).trim();
      }
    }
    return '';
  };

  function processData(stationsRows, weatherRows) {
    const stationsMap = new Map();
    stationsMetaMap.clear();

    stationsRows.forEach(r => {
      const id = String(get(r, 'Id', 'ID', 'IdStazione') || '').trim();
      const name = String(get(r, 'StazioneMeteo', 'Stazione', 'Nome', 'Name') || '').trim();
      const lat = num(get(r, 'Lat', 'Latitudine'));
      const lon = num(get(r, 'Long', 'Lon', 'Longitude'));

      if (id && name) {
        stationsMap.set(id, name);
        stationsMetaMap.set(name, {
          id: parseInt(id, 10) || id,
          lat: Number.isFinite(lat) ? lat : 0,
          lon: Number.isFinite(lon) ? lon : 0,
          zone: (lat >= 42.10) ? 0 : 1
        });
      }
    });

    const dateMap = new Map();
    const stations = new Map();

    weatherRows.forEach(r => {
      const rawDate = get(r, 'DataRilevamento', 'Data', 'data');
      const dObj = parseDateStr(rawDate);
      if (!dObj) return;

      const dateStr = formatDateDisplay(dObj);
      const timeKey = dObj.getTime();

      if (!dateMap.has(timeKey)) {
        dateMap.set(timeKey, { time: timeKey, dateObj: dObj, display: dateStr });
      }

      const stId = String(get(r, 'Id', 'ID', 'id_stazione') || '').trim();
      const stName = stationsMap.get(stId) || get(r, 'StazioneMeteo', 'Stazione') || `Stazione #${stId}`;

      const rainVal = num(get(r, 'PioggiaGiornaliera', 'pioggia_totale'));
      const statoStr = String(get(r, 'Stato', 'stato') || 'online').trim().toLowerCase();
      const isOffline = (statoStr === 'offline' || statoStr === '0' || statoStr === 'false' || statoStr === 'off');

      if (!stations.has(stName)) stations.set(stName, new Map());
      stations.get(stName).set(dateStr, { rain: rainVal, offline: isOffline });
    });

    uniqueDates = Array.from(dateMap.values()).sort((a, b) => b.time - a.time);
    stationMatrix = stations;
  }

  function populateDaySelect() {
    if (!els.daySelect) return;
    els.daySelect.innerHTML = '';
    uniqueDates.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${d.display} (giorno -${idx})`;
      els.daySelect.appendChild(opt);
    });
    
    if (uniqueDates.length > 0 && els.daySelect.value === "") {
      els.daySelect.value = "0";
      selectedDateIndex = 0;
    }
  }

  function getSortedStationsList(visibleDates) {
    const sortMode = els.sortSelect ? els.sortSelect.value : 'id_asc';
    const stationsList = Array.from(stationMatrix.entries());
    const targetDateObj = visibleDates && visibleDates[selectedDateIndex] ? visibleDates[selectedDateIndex] : (visibleDates ? visibleDates[0] : null);
    const targetDateStr = targetDateObj ? targetDateObj.display : null;

    stationsList.sort((a, b) => {
      const nameA = a[0];
      const nameB = b[0];
      const metaA = stationsMetaMap.get(nameA) || { id: 0, zone: 0, lat: 0 };
      const metaB = stationsMetaMap.get(nameB) || { id: 0, zone: 0, lat: 0 };

      if (sortMode === 'rain_desc') {
        const dataA = targetDateStr ? a[1].get(targetDateStr) : null;
        const rainA = (dataA && !dataA.offline) ? dataA.rain : 0;
        const dataB = targetDateStr ? b[1].get(targetDateStr) : null;
        const rainB = (dataB && !dataB.offline) ? dataB.rain : 0;
        if (rainB !== rainA) return rainB - rainA;
        return nameA.localeCompare(nameB);
      } 
      else if (sortMode === 'geo') {
        if (metaA.zone !== metaB.zone) return metaA.zone - metaB.zone;
        if (metaB.lat !== metaA.lat) return metaB.lat - metaA.lat;
        return metaA.id - metaB.id;
      } 
      else {
        if (metaA.id !== metaB.id) return metaA.id - metaB.id;
        return nameA.localeCompare(nameB, 'it');
      }
    });
    return stationsList;
  }

  function renderMatrixTable() {
    if (!document.querySelector('table')) return;
    const tableEl = document.querySelector('table');
    if (!tableEl.parentElement.classList.contains('table-scroll-container')) {
      const parent = tableEl.parentNode;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll-container';
      parent.insertBefore(wrapper, tableEl);
      wrapper.appendChild(tableEl);
    }

    if (!els.tableHead || !els.tableBody || uniqueDates.length === 0) return;

    const visibleDates = uniqueDates.slice(0, Math.min(uniqueDates.length, 31));
    const sortedStations = getSortedStationsList(visibleDates);

    const headersData = visibleDates.map((d, i) => ({
      display: d.display,
      relDay: -i,
      isSel: (i === selectedDateIndex)
    }));

    els.tableHead.innerHTML = `
      <tr>
        <th class="name-cell" rowspan="2" style="vertical-align:middle;">Stazione Meteorologica</th>
        ${headersData.map(h => `<th class="${h.isSel ? 'selected-column' : ''}"><span>${h.relDay}</span></th>`).join('')}
        <th rowspan="2" style="vertical-align:middle; background:#f8fafc; color:#111827;" title="Giorni Offline">G.O.</th>
      </tr>
      <tr>
        ${headersData.map(h => `<th class="${h.isSel ? 'selected-column' : ''}" style="font-weight:700; font-size:0.72rem;">${h.display.slice(0, 5)}</th>`).join('')}
      </tr>
    `;

    let bodyHtml = '';
    sortedStations.forEach(([stName, rainByDate], index) => {
      let dailyRains = [];
      let offlineDaysCount = 0;

      visibleDates.forEach(d => {
        const dayData = rainByDate.get(d.display);
        const rain = dayData ? dayData.rain : 0;
        const isOff = dayData ? dayData.offline : !dayData;
        if (isOff) offlineDaysCount++;
        dailyRains.push({ rain, isOff });
      });

      let cumRains = [];
      let runningSum = 0;
      for (let i = dailyRains.length - 1; i >= 0; i--) {
        if (!dailyRains[i].isOff) runningSum += dailyRains[i].rain;
        cumRains[i] = { rain: runningSum, isOff: dailyRains[i].isOff };
      }

      const groupClass = index % 2 === 0 ? 'station-group-even' : 'station-group-odd';

      bodyHtml += `
        <tr class="rain-row ${groupClass}">
          <td class="name-cell" data-station="${stName}" title="${stName}">
            <span class="station-name">${stName}</span>
          </td>
          ${dailyRains.map((d, i) => {
            const h = headersData[i];
            return `
              <td class="${h.isSel ? 'selected-column' : ''} ${d.isOff ? 'offline-cell' : ''}">
                ${d.isOff ? 'OFF' : (d.rain > 0 ? d.rain.toFixed(1) : '-')}
              </td>
            `;
          }).join('')}
          <td rowspan="2" style="font-weight:700; text-align:center; vertical-align:middle; color:#111827; border-left: 2px solid #cbd5e1;">
            ${offlineDaysCount}
          </td>
        </tr>
        <tr class="cum-row ${groupClass}">
          <td class="name-cell" data-station="${stName}">
            <span style="font-size:0.72rem; font-weight:700; color:#6b7280;">&bull; Cumulativo</span>
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

  function exportPdfReport() {
    try {
      if (typeof window.jspdf === 'undefined') {
        alert("Libreria jsPDF non ancora caricata. Riprova tra qualche istante.");
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('landscape', 'pt', 'a3');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0, 83, 159);
      doc.text("REPORT PIOGGE GIORNALIERE E CUMULATE", 40, 35);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const selObj = uniqueDates[selectedDateIndex];
      doc.text(`Riferimento attivo: ${selObj ? selObj.display : 'N/D'} | Generato il: ${new Date().toLocaleString()}`, 40, 50);

      try {
        const img = new Image();
        img.src = 'logo_330.png';
        doc.addImage(img, 'PNG', 1040, 15, 95, 30);
      } catch (imgErr) {
        console.warn("Impossibile caricare il logo nel PDF:", imgErr);
      }

      const visibleDates = uniqueDates.slice(0, Math.min(uniqueDates.length, 31));
      const sortedStations = getSortedStationsList(visibleDates);

      const tableHead = [
        "Stazione",
        ...visibleDates.map(d => d.display.slice(0, 5)),
        "G.O."
      ];

      const tableRows = [];
      sortedStations.forEach(([stName, rainByDate]) => {
        let rowRain = [stName];
        let rowCum = ["• Cumulativo"];
        let offCount = 0;

        visibleDates.forEach(d => {
          const dayData = rainByDate.get(d.display);
          const rain = dayData ? dayData.rain : 0;
          const isOff = dayData ? dayData.offline : !dayData;
          if (isOff) offCount++;
          rowRain.push(isOff ? "OFF" : (rain > 0 ? rain.toFixed(1) : "-"));
        });

        let runningSum = 0;
        for (let i = visibleDates.length - 1; i >= 0; i--) {
          const dayData = rainByDate.get(visibleDates[i].display);
          const rain = (dayData && !dayData.offline) ? dayData.rain : 0;
          runningSum += rain;
          rowCum.push(rain > 0 || runningSum > 0 ? runningSum.toFixed(1) : "-");
        }

        rowRain.push(offCount.toString());
        rowCum.push("");

        tableRows.push(rowRain);
        tableRows.push(rowCum);
      });

      doc.autoTable({
        head: [tableHead],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        styles: { 
          fontSize: 7.5, 
          cellPadding: { top: 4, bottom: 4, left: 2, right: 2 }, 
          halign: 'center', 
          valign: 'middle',
          textColor: [30, 41, 59], 
          fillColor: [255, 255, 255],
          lineColor: [203, 213, 225],
          lineWidth: 0.4
        },
        columnStyles: { 
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 150 } 
        },
        headStyles: { 
          fillColor: [0, 83, 159], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 6, bottom: 6, left: 2, right: 2 }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.row.index % 2 !== 0) {
            data.cell.styles.fillColor = [248, 250, 252];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawCell: function(data) {
          if (data.section === 'body' && data.row.index % 2 !== 0) {
            const docPdf = data.doc;
            docPdf.setDrawColor(100, 116, 139);
            docPdf.setLineWidth(1.2);
            docPdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
          }
        }
      });

      const fileName = `Report_Piogge_${selObj ? selObj.display.replace(/\//g, '-') : 'data'}.pdf`;
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      const newTab = window.open('', '_blank');
      if (newTab) {
        newTab.document.write(`
          <!DOCTYPE html>
          <html>
            <head><title>${fileName}</title></head>
            <body style="margin:0; padding:0;">
              <iframe src="${blobUrl}" style="width:100vw; height:100vh; border:none;"></iframe>
            </body>
          </html>
        `);
      } else {
        window.open(blobUrl, '_blank');
      }

    } catch (err) {
      console.error("Errore generazione Report PDF:", err);
      alert("Si è verificato un errore durante la generazione del report PDF.");
    }
  }

  function executeCalculation() {
    setError('');
    if (els.daySelect && els.daySelect.value !== '') {
      selectedDateIndex = parseInt(els.daySelect.value, 10);
    } else if (els.daySelect && els.daySelect.value === '' && uniqueDates.length > 0) {
      selectedDateIndex = 0;
      els.daySelect.value = "0";
    }

    updateActiveIndicators();
    if (els.savePdfField) els.savePdfField.classList.remove('hidden');
    renderMatrixTable();
  }

  async function init() {
    try {
      const [weatherText, stationsText] = await Promise.all([
        fetchText(WEATHER_CSV),
        fetchText(STATIONS_CSV).catch(() => '')
      ]);

      const weatherParsed = Papa.parse(weatherText, {
        header: true, skipEmptyLines: true, delimiter: delimiter(weatherText), transformHeader: h => h.trim().replace(/^\ufeff/, ''), transform: v => String(v).trim()
      });

      const stationsParsed = stationsText ? Papa.parse(stationsText, {
        header: true, skipEmptyLines: true, delimiter: delimiter(stationsText), transformHeader: h => h.trim().replace(/^\ufeff/, ''), transform: v => String(v).trim()
      }) : { data: [] };

      processData(stationsParsed.data || [], weatherParsed.data || []);

      if (uniqueDates.length > 0) {
        populateDaySelect();
        selectedDateIndex = 0;
        if (els.daySelect) els.daySelect.value = "0";
        updateActiveIndicators();
        renderMatrixTable();
      } else {
        throw new Error("Nessuna data o dato meteo trovato nei file CSV.");
      }
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  }

  if (els.executeBtn) els.executeBtn.addEventListener('click', executeCalculation);
  if (els.sortSelect) els.sortSelect.addEventListener('change', () => {
    updateActiveIndicators();
    if (uniqueDates.length > 0) renderMatrixTable();
  });
  if (els.savePdfBtn) els.savePdfBtn.addEventListener('click', exportPdfReport);

  init();
})();