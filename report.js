(() => {
  const STATIONS_CSV =
    './stazioni_meteo.csv';

  const WEATHER_CSV =
    './dati_meteo_30g.csv';

  const RELEASE =
    'Rel. 02-A-041';

  const RAIN_KEYS = [
    'pioggia',
    'rain',
    'precipitazione',
    'precipitation',
    'precip'
  ];

  const TEMPERATURE_KEYS = [
    'temperatura',
    'temperature',
    'temp',
    'tmin',
    'tmax',
    'minima',
    'massima',
    'umidita',
    'humidity',
    'vento',
    'wind',
    'pressione',
    'pressure'
  ];

  const DATE_KEYS = [
    'datarilevamento',
    'dataaggiornamento',
    'data',
    'timestamp',
    'datetime',
    'date',
    'ora',
    'time'
  ];

  const ID_KEYS = [
    'id',
    'idstazione',
    'stationid',
    'stazioneid',
    'codice'
  ];

  const STATION_NAME_KEYS = [
    'stazionemeteo',
    'stazione',
    'nome',
    'nomestazione',
    'name'
  ];

  const els = {
    app:
      document.getElementById('app'),

    daySelect:
      document.getElementById('daySelect'),

    executeBtn:
      document.getElementById('executeBtn'),

    savePdfField:
      document.getElementById('savePdfField'),

    savePdfBtn:
      document.getElementById('savePdfBtn'),

    tableHead:
      document.getElementById('tableHead'),

    tableBody:
      document.getElementById('tableBody'),

    stationsCount:
      document.getElementById('stationsCount'),

    recordsCount:
      document.getElementById('recordsCount'),

    selectedDayLabel:
      document.getElementById('selectedDayLabel'),

    statusText:
      document.getElementById('statusText'),

    errorBox:
      document.getElementById('errorBox'),

    lastUpdate:
      document.getElementById('lastUpdate'),

    sidebarToggleInside:
      document.getElementById('sidebarToggleInside'),

    sidebarToggleMini:
      document.getElementById('sidebarToggleMini')
  };

  let stations = [];
  let rawWeatherCount = 0;
  let detectedRainField = '';
  let detectedDateField = '';
  let tableGenerated = false;

  const normalizeKey = value =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  function num(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    let text =
      String(value)
        .trim()
        .replace(/\s/g, '');

    if (!text) {
      return null;
    }

    if (
      text.includes(',') &&
      text.includes('.')
    ) {
      if (
        text.lastIndexOf(',') >
        text.lastIndexOf('.')
      ) {
        text =
          text
            .replace(/\./g, '')
            .replace(',', '.');
      } else {
        text =
          text.replace(/,/g, '');
      }
    } else if (
      text.includes(',')
    ) {
      text =
        text.replace(',', '.');
    }

    const result =
      parseFloat(text);

    return Number.isFinite(result)
      ? result
      : null;
  }

  function delimiter(text) {
    const candidates =
      [';', ',', '\t', '|'];

    return candidates
      .map(character => ({
        character,

        count:
          (
            text.match(
              new RegExp(
                '\\' + character,
                'g'
              )
            ) || []
          ).length
      }))
      .sort(
        (a, b) =>
          b.count - a.count
      )[0].character;
  }

  function parseCsv(text) {
    return Papa.parse(
      text,
      {
        header: true,
        skipEmptyLines: true,
        delimiter:
          delimiter(text),

        transformHeader:
          header => header.trim(),

        transform:
          value => String(value).trim()
      }
    );
  }

  function localDate(
    year,
    month,
    day
  ) {
    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );
  }

  function today() {
    const now =
      new Date();

    return localDate(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    );
  }

  function addDays(
    date,
    offset
  ) {
    const result =
      localDate(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );

    result.setDate(
      result.getDate() + Number(offset)
    );

    return result;
  }

  function dateKey(
    year,
    month,
    day
  ) {
    return (
      `${String(year).padStart(4, '0')}-` +
      `${String(month).padStart(2, '0')}-` +
      `${String(day).padStart(2, '0')}`
    );
  }

  function dateKeyFromValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const text =
      String(value).trim();

    if (!text) {
      return null;
    }

    let match =
      text.match(
        /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
      );

    if (match) {
      return dateKey(
        Number(match[3]),
        Number(match[2]),
        Number(match[1])
      );
    }

    match =
      text.match(
        /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/
      );

    if (match) {
      return dateKey(
        Number(match[1]),
        Number(match[2]),
        Number(match[3])
      );
    }

    return null;
  }

  function parseDate(value) {
    const key =
      dateKeyFromValue(value);

    if (!key) {
      return null;
    }

    const [
      year,
      month,
      day
    ] =
      key.split('-').map(Number);

    return localDate(
      year,
      month,
      day
    );
  }

  function formatDay(date) {
    return (
      `${String(date.getDate()).padStart(2, '0')}/` +
      `${String(date.getMonth() + 1).padStart(2, '0')}/` +
      `${date.getFullYear()}`
    );
  }

  function formatShortDay(date) {
    return (
      `${String(date.getDate()).padStart(2, '0')}/` +
      `${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  }

  function formatDateTime(date) {
    if (!date) {
      return 'n/d';
    }

    return (
      `${formatDay(date)} ` +
      `${String(date.getHours()).padStart(2, '0')}:` +
      `${String(date.getMinutes()).padStart(2, '0')}:` +
      `${String(date.getSeconds()).padStart(2, '0')}`
    );
  }

  function setError(message) {
    els.errorBox.style.display =
      message
        ? 'block'
        : 'none';

    els.errorBox.textContent =
      message || '';
  }

  function resetPdfButton() {
    tableGenerated =
      false;

    els.savePdfField.classList.add(
      'hidden'
    );
  }

  function showPdfButton() {
    tableGenerated =
      true;

    els.savePdfField.classList.remove(
      'hidden'
    );
  }

  function findDateField(fields) {
    const exact =
      fields.find(field =>
        DATE_KEYS.some(key =>
          normalizeKey(field) ===
          normalizeKey(key)
        )
      );

    if (exact) {
      return exact;
    }

    return fields.find(field => {
      const key =
        normalizeKey(field);

      return (
        key.includes('data') ||
        key.includes('date') ||
        key.includes('time')
      );
    }) || '';
  }

  function findRainField(fields) {
    const valid =
      fields.filter(field => {
        const key =
          normalizeKey(field);

        const rain =
          RAIN_KEYS.some(candidate =>
            key.includes(
              normalizeKey(candidate)
            )
          );

        const temperature =
          TEMPERATURE_KEYS.some(candidate =>
            key.includes(
              normalizeKey(candidate)
            )
          );

        return rain && !temperature;
      });

    return valid[0] || '';
  }

  function makeSeries(
    weatherRows,
    rainField,
    dateField
  ) {
    const currentDay =
      today();

    const currentTime =
      Date.UTC(
        currentDay.getFullYear(),
        currentDay.getMonth(),
        currentDay.getDate()
      );

    const rainByOffset =
      new Map();

    for (
      let offset = -30;
      offset <= 0;
      offset++
    ) {
      rainByOffset.set(
        offset,
        0
      );
    }

    weatherRows.forEach(row => {
      const rowDate =
        parseDate(
          row[dateField]
        );

      if (!rowDate) {
        return;
      }

      const rowTime =
        Date.UTC(
          rowDate.getFullYear(),
          rowDate.getMonth(),
          rowDate.getDate()
        );

      const offset =
        Math.round(
          (
            rowTime - currentTime
          ) /
          86400000
        );

      if (
        offset < -30 ||
        offset > 0
      ) {
        return;
      }

      const rain =
        num(
          row[rainField]
        );

      if (
        !Number.isFinite(rain)
      ) {
        return;
      }

      rainByOffset.set(
        offset,
        (
          rainByOffset.get(offset) || 0
        ) + rain
      );
    });

    const cumulativeByOffset =
      new Map();

    let total =
      rainByOffset.get(0) || 0;

    cumulativeByOffset.set(
      0,
      total
    );

    for (
      let offset = -1;
      offset >= -30;
      offset--
    ) {
      total +=
        rainByOffset.get(offset) || 0;

      cumulativeByOffset.set(
        offset,
        total
      );
    }

    const series =
      [];

    for (
      let offset = -30;
      offset <= 0;
      offset++
    ) {
      const date =
        addDays(
          currentDay,
          offset
        );

      series.push({
        offset,
        date,

        rain:
          rainByOffset.get(offset) || 0,

        cumulative:
          cumulativeByOffset.get(offset) || 0
      });
    }

    return series;
  }

  function buildDaySelect() {
    const select =
      els.daySelect;

    select.replaceChildren();

    const placeholder =
      document.createElement('option');

    placeholder.value =
      '';

    placeholder.textContent =
      'Seleziona un giorno';

    select.appendChild(
      placeholder
    );

    const currentDay =
      today();

    for (
      let offset = -30;
      offset <= 0;
      offset++
    ) {
      const date =
        addDays(
          currentDay,
          offset
        );

      const option =
        document.createElement('option');

      option.value =
        String(offset);

      option.textContent =
        `${offset} ${formatDay(date)}`;

      select.appendChild(
        option
      );
    }

    select.value =
      '';

    select.classList.add(
      'placeholder'
    );
  }

  function parseData(
    stationsText,
    weatherText
  ) {
    const stationResult =
      parseCsv(stationsText);

    const weatherResult =
      parseCsv(weatherText);

    const stationRows =
      stationResult.data || [];

    const weatherRows =
      weatherResult.data || [];

    const stationFields =
      stationResult.meta.fields || [];

    const weatherFields =
      weatherResult.meta.fields || [];

    rawWeatherCount =
      weatherRows.length;

    detectedRainField =
      findRainField(weatherFields);

    detectedDateField =
      findDateField(weatherFields);

    if (!detectedRainField) {
      throw new Error(
        'Colonna pioggia non trovata:\n' +
        weatherFields.join(' | ')
      );
    }

    if (!detectedDateField) {
      throw new Error(
        'Colonna data non trovata:\n' +
        weatherFields.join(' | ')
      );
    }

    const stationIdField =
      stationFields.find(field =>
        ID_KEYS.some(key =>
          normalizeKey(field) ===
          normalizeKey(key)
        )
      ) || stationFields[0];

    const weatherIdField =
      weatherFields.find(field =>
        ID_KEYS.some(key =>
          normalizeKey(field) ===
          normalizeKey(key)
        )
      ) || stationFields[0];

    const stationNameField =
      stationFields.find(field =>
        STATION_NAME_KEYS.some(key =>
          normalizeKey(field) ===
          normalizeKey(key)
        )
      ) || stationFields[1];

    const weatherById =
      new Map();

    let latestDate =
      null;

    weatherRows.forEach(row => {
      const date =
        parseDate(
          row[detectedDateField]
        );

      if (
        date &&
        (
          !latestDate ||
          date > latestDate
        )
      ) {
        latestDate =
          date;
      }

      const id =
        String(
          row[weatherIdField] ?? ''
        ).trim();

      if (!id) {
        return;
      }

      if (!weatherById.has(id)) {
        weatherById.set(id, []);
      }

      weatherById.get(id).push(row);
    });

    stations =
      stationRows
        .map(row => {
          const id =
            String(
              row[stationIdField] ?? ''
            ).trim();

          const name =
            String(
              row[stationNameField] ?? ''
            ).trim();

          return {
            id,
            name,

            series:
              makeSeries(
                weatherById.get(id) || [],
                detectedRainField,
                detectedDateField
              )
          };
        })
        .filter(station =>
          station.id &&
          station.name
        );

    return latestDate;
  }

  function selectedOffset() {
    if (
      els.daySelect.value === ''
    ) {
      return null;
    }

    return Number(
      els.daySelect.value
    );
  }

  function dayByOffset(
    station,
    offset
  ) {
    return station.series.find(
      day =>
        Number(day.offset) ===
        Number(offset)
    );
  }

  function selectedCumulative(
    station,
    offset
  ) {
    return (
      dayByOffset(station, offset)
        ?.cumulative ?? 0
    );
  }

  function stationLabel(
    station,
    offset
  ) {
    const value =
      selectedCumulative(
        station,
        offset
      );

    return `
      <span class="station-name">
        ${station.name}
      </span>

      <span class="selected-cumulative">
        Cumulativo ${offset}:
        ${value.toFixed(1)} mm
      </span>
    `;
  }

  function selectedClass(
    columnOffset,
    selectedOffsetValue
  ) {
    return Number(columnOffset) ===
      Number(selectedOffsetValue)
      ? 'selected-column'
      : '';
  }

  function renderTable() {
    const offset =
      selectedOffset();

    if (
      offset === null
    ) {
      resetPdfButton();

      els.tableHead.innerHTML =
        '';

      els.tableBody.innerHTML =
        '';

      return false;
    }

    const columns =
      stations.length
        ? stations[0].series
        : [];

    const sorted =
      [...stations].sort(
        (a, b) =>
          selectedCumulative(b, offset) -
          selectedCumulative(a, offset)
      );

    const headerTop = [
      '<th style="min-width:280px">Stazione meteo</th>'
    ];

    const headerBottom = [
      '<th style="min-width:280px"></th>'
    ];

    columns.forEach(column => {
      const className =
        selectedClass(
          column.offset,
          offset
        );

      headerTop.push(
        `
          <th
            class="${className}"
            data-offset="${column.offset}">
            ${column.offset}
          </th>
        `
      );

      headerBottom.push(
        `
          <th
            class="${className}"
            data-offset="${column.offset}">
            ${formatShortDay(column.date)}
          </th>
        `
      );
    });

    els.tableHead.innerHTML =
      `
        <tr>
          ${headerTop.join('')}
        </tr>

        <tr>
          ${headerBottom.join('')}
        </tr>
      `;

    const rows =
      [];

    sorted.forEach(station => {
      const rainRow = [
        `
          <td
            class="name-cell"
            rowspan="2">

            ${stationLabel(
              station,
              offset
            )}
          </td>
        `
      ];

      const cumulativeRow =
        [];

      columns.forEach(column => {
        const day =
          dayByOffset(
            station,
            column.offset
          );

        const className =
          selectedClass(
            column.offset,
            offset
          );

        rainRow.push(
          `
            <td
              class="${className}"
              data-offset="${column.offset}">
              ${(day?.rain ?? 0).toFixed(1)}
            </td>
          `
        );

        cumulativeRow.push(
          `
            <td
              class="${className}"
              data-offset="${column.offset}">
              ${
                column.offset === 0
                  ? ''
                  : (day?.cumulative ?? 0).toFixed(1)
              }
            </td>
          `
        );
      });

      rows.push(
        `
          <tr class="rain-row">
            ${rainRow.join('')}
          </tr>
        `
      );

      rows.push(
        `
          <tr class="cum-row">
            ${cumulativeRow.join('')}
          </tr>
        `
      );
    });

    els.tableBody.innerHTML =
      rows.join('');

    els.stationsCount.textContent =
      String(stations.length);

    els.recordsCount.textContent =
      String(rawWeatherCount);

    els.selectedDayLabel.textContent =
      `${offset} · ${
        formatDay(
          addDays(today(), offset)
        )
      }`;

    els.statusText.textContent =
      `${RELEASE} · Tabella aggiornata.`;

    showPdfButton();

    return true;
  }

  function buildPdfData() {
    const offset =
      selectedOffset();

    const columns =
      stations.length
        ? stations[0].series
        : [];

    const sorted =
      [...stations].sort(
        (a, b) =>
          selectedCumulative(b, offset) -
          selectedCumulative(a, offset)
      );

    const head =
      [
        [
          {
            content: 'Stazione meteo',

            styles: {
              halign: 'left',
              fillColor: [223, 243, 246],
              textColor: [22, 51, 56],
              fontStyle: 'bold'
            }
          },

          ...columns.map(column => ({
            content: String(column.offset),

            styles: {
              fillColor:
                Number(column.offset) ===
                Number(offset)
                  ? [242, 215, 51]
                  : [234, 247, 251],

              textColor:
                Number(column.offset) ===
                Number(offset)
                  ? [59, 48, 0]
                  : [22, 72, 78],

              fontStyle: 'bold'
            }
          }))
        ],

        [
          {
            content: 'Data',

            styles: {
              halign: 'left',
              fillColor: [240, 248, 249],
              textColor: [13, 47, 51],
              fontStyle: 'bold'
            }
          },

          ...columns.map(column => ({
            content:
              formatShortDay(column.date),

            styles: {
              fillColor:
                Number(column.offset) ===
                Number(offset)
                  ? [242, 215, 51]
                  : [240, 248, 249],

              textColor:
                Number(column.offset) ===
                Number(offset)
                  ? [59, 48, 0]
                  : [13, 47, 51],

              fontStyle: 'bold'
            }
          }))
        ]
      ];

    const body =
      [];

    sorted.forEach(station => {
      const selectedValue =
        selectedCumulative(
          station,
          offset
        );

      const rainRow = [
        {
          content:
            `${station.name} · ` +
            `Cumulativo ${offset}: ` +
            `${selectedValue.toFixed(1)} mm`,

          styles: {
            halign: 'left',
            valign: 'middle',
            fillColor: [252, 252, 252],
            textColor: [18, 79, 30],
            fontStyle: 'bold'
          }
        }
      ];

      const cumulativeRow = [
        {
          content:
            'Cumulativo',

          styles: {
            halign: 'left',
            valign: 'middle',
            fillColor: [249, 245, 255],
            textColor: [106, 29, 134],
            fontStyle: 'bold'
          }
        }
      ];

      columns.forEach(column => {
        const day =
          dayByOffset(
            station,
            column.offset
          ) || {
            rain: 0,
            cumulative: 0
          };

        const isSelected =
          Number(column.offset) ===
          Number(offset);

        const rainCellStyles =
          isSelected
            ? {
                fillColor: [255, 230, 106],
                textColor: [59, 48, 0],
                fontStyle: 'bold'
              }
            : {
                fillColor: [252, 252, 252],
                textColor: [18, 79, 30],
                fontStyle: 'bold'
              };

        const cumulativeCellStyles =
          isSelected
            ? {
                fillColor: [255, 230, 106],
                textColor: [59, 48, 0],
                fontStyle: 'bold'
              }
            : {
                fillColor: [249, 245, 255],
                textColor: [106, 29, 134],
                fontStyle: 'bold'
              };

        rainRow.push({
          content:
            day.rain.toFixed(1),

          styles:
            rainCellStyles
        });

        cumulativeRow.push({
          content:
            column.offset === 0
              ? ''
              : day.cumulative.toFixed(1),

          styles:
            cumulativeCellStyles
        });
      });

      body.push(rainRow);
      body.push(cumulativeRow);
    });

    return {
      head,
      body,
      offset
    };
  }

  function makePdf() {
    const {
      jsPDF
    } =
      window.jspdf;

    const {
      head,
      body,
      offset
    } =
      buildPdfData();

    const pdf =
      new jsPDF(
        'l',
        'mm',
        'a4'
      );

    pdf.setFont(
      'helvetica',
      'bold'
    );

    pdf.setFontSize(14);

    pdf.text(
      'Piogge Giornaliere/Cumulate - Report stazioni',
      14,
      12
    );

    pdf.setFont(
      'helvetica',
      'normal'
    );

    pdf.setFontSize(9);

    pdf.text(
      `${RELEASE} · Giorno selezionato: ${
        offset
      } · Data: ${
        formatDay(
          addDays(today(), offset)
        )
      } · Generato il ${
        new Date().toLocaleString('it-IT')
      }`,
      14,
      18
    );

    pdf.autoTable({
      startY: 24,

      head,
      body,

      theme: 'grid',

      styles: {
        fontSize: 6.2,
        cellPadding: 1.1,
        overflow: 'linebreak',
        halign: 'center',
        valign: 'middle'
      },

      columnStyles: {
        0: {
          cellWidth: 48,
          halign: 'left'
        }
      },

      margin: {
        left: 6,
        right: 6
      }
    });

    return pdf;
  }

  function openPdf() {
    const pdf =
      makePdf();

    const blob =
      pdf.output('blob');

    const url =
      URL.createObjectURL(blob);

    const popup =
      window.open(
        url,
        '_blank'
      );

    if (!popup) {
      window.location.href =
        url;
    }

    setTimeout(
      () => URL.revokeObjectURL(url),
      60000
    );
  }

  async function savePdf() {
    if (
      !tableGenerated ||
      selectedOffset() === null
    ) {
      return;
    }

    const pdf =
      makePdf();

    const blob =
      pdf.output('blob');

    const offset =
      selectedOffset();

    const filename =
      `piogge_giornaliere_cumulate_${
        offset
      }.pdf`;

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href =
      url;

    anchor.download =
      filename;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      60000
    );

    els.statusText.textContent =
      'Download PDF avviato.';
  }

  function executeReport() {
    if (
      selectedOffset() === null
    ) {
      window.alert(
        'Seleziona il giorno per calcolare la pioggia cumulata e premi Esegui'
      );

      return;
    }

    if (
      renderTable()
    ) {
      openPdf();
    }
  }

  function toggleSidebar() {
    els.app.classList.toggle(
      'sidebar-collapsed'
    );
  }

  async function init() {
    try {
      const [
        stationsText,
        weatherText
      ] =
        await Promise.all([
          fetch(
            `${STATIONS_CSV}?v=${Date.now()}`,
            {
              cache: 'no-store'
            }
          ).then(response => {
            if (!response.ok) {
              throw new Error(
                `Errore ${response.status}: ${STATIONS_CSV}`
              );
            }

            return response.text();
          }),

          fetch(
            `${WEATHER_CSV}?v=${Date.now()}`,
            {
              cache: 'no-store'
            }
          ).then(response => {
            if (!response.ok) {
              throw new Error(
                `Errore ${response.status}: ${WEATHER_CSV}`
              );
            }

            return response.text();
          })
        ]);

      const latestDate =
        parseData(
          stationsText,
          weatherText
        );

      buildDaySelect();

      els.stationsCount.textContent =
        String(stations.length);

      els.recordsCount.textContent =
        String(rawWeatherCount);

      els.lastUpdate.textContent =
        formatDateTime(latestDate);

      els.statusText.textContent =
        `${RELEASE} · Dati caricati.`;

      setError('');
    } catch (error) {
      els.lastUpdate.textContent =
        'errore lettura CSV';

      els.statusText.textContent =
        `${RELEASE} · Errore caricamento dati.`;

      setError(
        String(
          error?.stack ||
          error
        )
      );
    }
  }

  els.daySelect.addEventListener(
    'change',
    () => {
      els.daySelect.classList.toggle(
        'placeholder',
        els.daySelect.value === ''
      );

      resetPdfButton();

      els.tableHead.innerHTML =
        '';

      els.tableBody.innerHTML =
        '';

      els.selectedDayLabel.textContent =
        '—';
    }
  );

  els.executeBtn.addEventListener(
    'click',
    executeReport
  );

  els.savePdfBtn.addEventListener(
    'click',
    savePdf
  );

  els.sidebarToggleInside.addEventListener(
    'click',
    toggleSidebar
  );

  els.sidebarToggleMini.addEventListener(
    'click',
    toggleSidebar
  );

  init();
})();