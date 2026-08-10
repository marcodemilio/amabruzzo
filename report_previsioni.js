(() => {
  "use strict";

  const RELEASE = "Rel. 03-C-025";

  const GIORNI_PREVISIONE = 10;
  const GIORNI_STORICO = 30;
  const MASSIMO_PROBABILITA = 98;
  const GIORNI_PROFILO_INIZIALE = 3;

  const SOGLIA_RESET_PRATO = 20;
  const SOGLIA_RESET_BOSCO = 35;

  let stazioni = [];
  let specieFunghi = [];
  let specieAttive = [];
  let profiliCrescita = {};
  let datiPrevisioniMeteo = {};

  let giornoSelezionato = null;
  let giornoDataSelezionato = null;
  let specieSelezionata = "";
  let stazioneSelezionata = "";
  let filtroProbabilita = null;

  const els = {};

  function el(id) {
    return document.getElementById(id);
  }

  function inizializzaElementi() {
    els.app = el("app");
    els.statusText = el("status-text");
    els.lastUpdate = el("lastUpdate");
    els.dataLastUpdate = el("data-last-update");

    els.controlsPanel = el("controls-panel");
    els.forecastPanel = el("forecast-panel");

    els.stationsCount = el("stations-count");
    els.recordsCount = el("records-count");

    els.daySelect = el("day-select");
    els.speciesSelect = el("species-select");
    els.stationSelect = el("station-select");
    els.probabilityFilter =
      el("probability-filter");
    els.dateDaySelect = el("date-day-select");

    els.generateButton =
      el("generate-button");

    els.generateStationButton =
      el("generate-station-button");

    els.generateDateButton =
      el("generate-date-button");

    els.selectionStatus =
      el("selection-status");

    els.stationSelectionStatus =
      el("station-selection-status");

    els.dateSelectionStatus =
      el("date-selection-status");

    els.forecastThead =
      el("forecast-thead");

    els.tableBody =
      el("table-body");

    els.currentMushroomTitle =
      el("current-mushroom-title");

    els.currentSelectionDescription =
      el("current-selection-description");

    els.speciesPopupOverlay =
      el("species-popup-overlay");

    els.speciesPopupClose =
      el("species-popup-close");

    els.speciesPopupContent =
      el("species-popup-content");

    els.stationPopupOverlay =
      el("station-popup-overlay");

    els.stationPopupClose =
      el("station-popup-close");

    els.stationPopupContent =
      el("station-popup-content");

    els.sidebarToggleInside =
      el("sidebarToggleInside");

    els.sidebarToggleMini =
      el("sidebarToggleMini");

    els.modeSpeciesButton =
      el("mode-species-button");

    els.modeStationButton =
      el("mode-station-button");

    els.modeDateButton =
      el("mode-date-button");

    els.speciesReportControls =
      el("species-report-controls");

    els.stationReportControls =
      el("station-report-controls");

    els.dateReportControls =
      el("date-report-controls");
  }

  function numero(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return null;
    }

    const risultato = Number.parseFloat(
      String(value)
        .trim()
        .replace(",", ".")
    );

    return Number.isFinite(risultato)
      ? risultato
      : null;
  }

  function booleano(value) {
    return [
      "true",
      "1",
      "si",
      "sì",
      "yes",
      "on"
    ].includes(
      String(value ?? "")
        .trim()
        .toLowerCase()
    );
  }

  function normalizzaChiave(value) {
    return String(value ?? "")
      .replace(/^\uFEFF/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function trovaCampo(fields, candidati) {
    const normalizzati =
      candidati.map(normalizzaChiave);

    return (
      fields.find(campo =>
        normalizzati.includes(
          normalizzaChiave(campo)
        )
      ) ||
      fields.find(campo =>
        normalizzati.some(nome =>
          normalizzaChiave(campo)
            .includes(nome)
        )
      ) ||
      ""
    );
  }

  function parseCSV(testo) {
    if (
      typeof Papa === "undefined"
    ) {
      throw new Error(
        "PapaParse non è stato caricato."
      );
    }

    const primaRiga =
      String(testo)
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .find(riga => riga.trim()) || "";

    const delimitatore =
      primaRiga.includes(";")
        ? ";"
        : ",";

    const risultato = Papa.parse(
      String(testo),
      {
        header: true,
        skipEmptyLines: true,
        delimiter: delimitatore,
        transformHeader: header =>
          String(header)
            .replace(/^\uFEFF/, "")
            .trim(),
        transform: value =>
          String(value ?? "").trim()
      }
    );

    return {
      rows: Array.isArray(
        risultato.data
      )
        ? risultato.data
        : [],

      fields: Array.isArray(
        risultato.meta?.fields
      )
        ? risultato.meta.fields
        : []
    };
  }

  async function caricaCSV(percorso) {
    const risposta =
      await fetch(
        percorso,
        {
          cache: "no-store"
        }
      );

    if (!risposta.ok) {
      throw new Error(
        `Impossibile caricare ${percorso}.`
      );
    }

    return parseCSV(
      await risposta.text()
    );
  }

  function estraiData(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return null;
    }

    const testo = String(value).trim();

    let match = testo.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
    );

    if (match) {
      return new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1])
      );
    }

    match = testo.match(
      /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/
    );

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );
    }

    const data = new Date(testo);

    return Number.isNaN(data.getTime())
      ? null
      : data;
  }

  function giornoLocale(data) {
    return new Date(
      data.getFullYear(),
      data.getMonth(),
      data.getDate()
    );
  }

  function oggiLocale() {
    return giornoLocale(new Date());
  }

  function chiaveGiorno(data) {
    const giorno =
      giornoLocale(data);

    return [
      giorno.getFullYear(),
      String(giorno.getMonth() + 1)
        .padStart(2, "0"),
      String(giorno.getDate())
        .padStart(2, "0")
    ].join("-");
  }

  function dataPrevisione(indice) {
    const data =
      oggiLocale();

    data.setDate(
      data.getDate() +
        indice +
        1
    );

    return data;
  }

  function differenzaGiorni(prima, dopo) {
    return Math.round(
      (
        giornoLocale(dopo) -
        giornoLocale(prima)
      ) / 86400000
    );
  }

  function media(valori) {
    const validi =
      valori.filter(valore =>
        Number.isFinite(valore)
      );

    if (!validi.length) {
      return null;
    }

    return validi.reduce(
      (somma, valore) =>
        somma + valore,
      0
    ) / validi.length;
  }

  function formattaNumero(
    value,
    decimali = 1
  ) {
    if (!Number.isFinite(value)) {
      return "n/d";
    }

    return value.toLocaleString(
      "it-IT",
      {
        minimumFractionDigits:
          decimali,

        maximumFractionDigits:
          decimali
      }
    );
  }

  function etichettaGiorno(indice) {
    const data =
      dataPrevisione(indice);

    const dataBreve = [
      String(data.getDate())
        .padStart(2, "0"),

      String(data.getMonth() + 1)
        .padStart(2, "0")
    ].join("/");

    return `Giorno ${indice + 1} - (${dataBreve})`;
  }

  function etichettaGiornoBreve(indice) {
    const data =
      dataPrevisione(indice);

    const dataBreve = [
      String(data.getDate())
        .padStart(2, "0"),

      String(data.getMonth() + 1)
        .padStart(2, "0")
    ].join("/");

    return `${indice + 1} (${dataBreve})`;
  }

  function costruisciStorico(
    righe,
    fields
  ) {
    const campoID =
      trovaCampo(
        fields,
        [
          "id",
          "idstazione",
          "stationid",
          "stazioneid"
        ]
      );

    const campoData =
      trovaCampo(
        fields,
        [
          "data",
          "date",
          "giorno",
          "datetime",
          "timestamp"
        ]
      );

    const campoPioggia =
      trovaCampo(
        fields,
        [
          "rain_sum",
          "rain",
          "pioggia",
          "rainmm",
          "precipitazione",
          "precipitation_sum"
        ]
      );

    const campoTMin =
      trovaCampo(
        fields,
        [
          "tmin",
          "tempmin",
          "temperaturemin",
          "temperaturamin",
          "temperaturaminima"
        ]
      );

    const campoTMax =
      trovaCampo(
        fields,
        [
          "tmax",
          "tempmax",
          "temperaturemax",
          "temperaturamax",
          "temperaturamassima"
        ]
      );

    if (
      !campoID ||
      !campoData
    ) {
      throw new Error(
        "Nel CSV meteo mancano le colonne ID o data."
      );
    }

    const perStazione = {};

    righe.forEach(riga => {
      const id = String(
        riga[campoID] ?? ""
      ).trim();

      const data =
        estraiData(
          riga[campoData]
        );

      if (!id || !data) {
        return;
      }

      if (!perStazione[id]) {
        perStazione[id] = {};
      }

      const chiave =
        chiaveGiorno(data);

      if (
        !perStazione[id][chiave]
      ) {
        perStazione[id][chiave] = {
          data: giornoLocale(data),
          pioggia: 0,
          tmin: null,
          tmax: null
        };
      }

      const giorno =
        perStazione[id][chiave];

      const pioggia =
        numero(
          campoPioggia
            ? riga[campoPioggia]
            : null
        );

      const tmin =
        numero(
          campoTMin
            ? riga[campoTMin]
            : null
        );

      const tmax =
        numero(
          campoTMax
            ? riga[campoTMax]
            : null
        );

      if (
        Number.isFinite(pioggia)
      ) {
        giorno.pioggia += pioggia;
      }

      if (Number.isFinite(tmin)) {
        giorno.tmin =
          giorno.tmin === null
            ? tmin
            : Math.min(
                giorno.tmin,
                tmin
              );
      }

      if (Number.isFinite(tmax)) {
        giorno.tmax =
          giorno.tmax === null
            ? tmax
            : Math.max(
                giorno.tmax,
                tmax
              );
      }
    });

    const risultato = {};

    Object.entries(
      perStazione
    ).forEach(
      ([id, valori]) => {
        const giorni =
          Object.values(valori)
            .sort(
              (a, b) =>
                a.data - b.data
            )
            .slice(-GIORNI_STORICO);

        risultato[id] = {
          giorni,

          mediaTMin: media(
            giorni.map(
              giorno =>
                giorno.tmin
            )
          ),

          mediaTMax: media(
            giorni.map(
              giorno =>
                giorno.tmax
            )
          ),

          records: giorni.length
        };
      }
    );

    return risultato;
  }

  function costruisciStazioni(
    righe,
    fields,
    storico
  ) {
    const campoID =
      trovaCampo(
        fields,
        [
          "id",
          "idstazione",
          "stationid",
          "stazioneid"
        ]
      );

    const campoNome =
      trovaCampo(
        fields,
        [
          "nome",
          "stazione",
          "nomestazione",
          "localita"
        ]
      );

    const campoAlt =
      trovaCampo(
        fields,
        [
          "altitudine",
          "altitude",
          "quota"
        ]
      );

    const campoLat =
      trovaCampo(
        fields,
        [
          "lat",
          "latitudine",
          "latitude"
        ]
      );

    const campoLon =
      trovaCampo(
        fields,
        [
          "lon",
          "long",
          "longitudine",
          "longitude"
        ]
      );

    const campoLink =
      trovaCampo(
        fields,
        [
          "link",
          "url"
        ]
      );

    if (!campoID) {
      throw new Error(
        "Nel CSV stazioni manca la colonna ID."
      );
    }

    return righe
      .map(riga => {
        const id = String(
          riga[campoID] ?? ""
        ).trim();

        if (!id) {
          return null;
        }

        const dati =
          storico[id] || {
            giorni: [],
            mediaTMin: null,
            mediaTMax: null,
            records: 0
          };

        const temperaturaMedia =
          Number.isFinite(
            dati.mediaTMin
          ) &&
          Number.isFinite(
            dati.mediaTMax
          )
            ? (
                dati.mediaTMin +
                dati.mediaTMax
              ) / 2
            : 15;

        return {
          id,

          nome:
            String(
              campoNome
                ? riga[campoNome]
                : ""
            ).trim() || id,

          alt:
            numero(
              campoAlt
                ? riga[campoAlt]
                : null
            ) ?? 0,

          lat:
            numero(
              campoLat
                ? riga[campoLat]
                : null
            ) ?? 42.35,

          lon:
            numero(
              campoLon
                ? riga[campoLon]
                : null
            ) ?? 13.4,

          link:
            campoLink
              ? String(
                  riga[campoLink] ?? ""
                ).trim()
              : "",

          storicoGiorni:
            dati.giorni,

          mediaTMin:
            dati.mediaTMin,

          mediaTMax:
            dati.mediaTMax,

          storicoTMedia:
            temperaturaMedia,

          records:
            dati.records
        };
      })
      .filter(Boolean);
  }

  function costruisciSpecie(
    righe
  ) {
    return righe
      .map(riga => ({
        id:
          String(
            riga.id ?? ""
          ).trim(),

        nome:
          String(
            riga.nome ?? ""
          ).trim(),

        nomeComune:
          String(
            riga.nomeComune ?? ""
          ).trim(),

        attivo:
          riga.attivo === undefined ||
          riga.attivo === ""
            ? true
            : booleano(
                riga.attivo
              ),

        ordine:
          numero(
            riga.ordine
          ) ?? 999,

        habitat:
          String(
            riga.habitat ?? ""
          ).trim(),

        altMin:
          numero(
            riga.altMin
          ) ?? 0,

        altMax:
          numero(
            riga.altMax
          ) ?? 3000,

        mesiInizio:
          numero(
            riga.mesiInizio
          ) ?? 1,

        mesiFine:
          numero(
            riga.mesiFine
          ) ?? 12,

        rainReq:
          numero(
            riga.rainReq
          ) ?? 0,

        rainWindowDays:
          numero(
            riga.rainWindowDays
          ) ?? 3,

        eventThresholdFactor:
          numero(
            riga.eventThresholdFactor
          ) ?? 1,

        giorniMinDopoPioggia:
          numero(
            riga.giorniMinDopoPioggia
          ) ?? 3,

        giorniMaxDopoPioggia:
          numero(
            riga.giorniMaxDopoPioggia
          ) ?? 12,

        tempMin:
          numero(
            riga.tempMin
          ) ?? 5,

        tempOttimale:
          numero(
            riga.tempOttimale
          ) ?? 18,

        tempMax:
          numero(
            riga.tempMax
          ) ?? 30,

        termofilo:
          booleano(
            riga.termofilo
          ),

        pesoEvento:
          numero(
            riga.pesoEvento
          ) ?? 0.65,

        pesoTemperatura:
          numero(
            riga.pesoTemperatura
          ) ?? 0.55,

        pesoAltitudine:
          numero(
            riga.pesoAltitudine
          ) ?? 0.4,

        pesoStagione:
          numero(
            riga.pesoStagione
          ) ?? 1,

        note:
          String(
            riga.note ?? ""
          ).trim(),

        raw: riga
      }))
      .filter(fungo =>
        fungo.id &&
        fungo.nome
      )
      .sort(
        (a, b) =>
          a.ordine - b.ordine
      );
  }

  function eFungoDiPrato(fungo) {
    const habitat =
      fungo.habitat
        .toLowerCase();

    return [
      "prat",
      "pascol",
      "radur",
      "margin",
      "campo"
    ].some(parola =>
      habitat.includes(parola)
    );
  }

  function sogliaReset(fungo) {
    return eFungoDiPrato(fungo)
      ? SOGLIA_RESET_PRATO
      : SOGLIA_RESET_BOSCO;
  }

  async function caricaSpecie() {
    const csv =
      await caricaCSV(
        "speciefunghi.csv"
      );

    specieFunghi =
      costruisciSpecie(
        csv.rows
      );

    specieAttive =
      specieFunghi.filter(
        fungo =>
          fungo.attivo
      );

    if (!specieAttive.length) {
      throw new Error(
        "Nessuna specie attiva trovata."
      );
    }
  }

  async function caricaProfili() {
    const csv =
      await caricaCSV(
        "speciecrescita.csv"
      );

    const campoID =
      trovaCampo(
        csv.fields,
        [
          "id",
          "specie",
          "specieid"
        ]
      );

    if (!campoID) {
      throw new Error(
        "Nel CSV profili manca la colonna ID."
      );
    }

    profiliCrescita = {};

    csv.rows.forEach(riga => {
      const id =
        String(
          riga[campoID] ?? ""
        ).trim();

      if (!id) {
        return;
      }

      profiliCrescita[id] = {};

      csv.fields.forEach(
        campo => {
          if (campo === campoID) {
            return;
          }

          const giorno =
            Number(campo);

          const valore =
            numero(riga[campo]);

          if (
            Number.isInteger(giorno) &&
            Number.isFinite(valore)
          ) {
            profiliCrescita[id][
              String(giorno)
            ] = Math.max(
              0,
              Math.min(
                100,
                valore
              )
            );
          }
        }
      );
    });
  }

  async function caricaPrevisioni() {
    const risultati =
      await Promise.allSettled(
        stazioni.map(
          async stazione => {
            const parametri =
              new URLSearchParams({
                latitude:
                  String(
                    stazione.lat
                  ),

                longitude:
                  String(
                    stazione.lon
                  ),

                daily:
                  "temperature_2m_max,temperature_2m_min",

                timezone:
                  "Europe/Rome",

                forecast_days:
                  String(
                    GIORNI_PREVISIONE + 1
                  )
              });

            const risposta =
              await fetch(
                "https://api.open-meteo.com/v1/forecast?" +
                  parametri.toString()
              );

            if (!risposta.ok) {
              throw new Error(
                `Previsione non disponibile per ${stazione.nome}.`
              );
            }

            const json =
              await risposta.json();

            return {
              id: stazione.id,
              daily: json.daily
            };
          }
        )
      );

    datiPrevisioniMeteo = {};

    risultati.forEach(
      risultato => {
        if (
          risultato.status ===
          "fulfilled"
        ) {
          datiPrevisioniMeteo[
            risultato.value.id
          ] =
            risultato.value.daily;
        } else {
          console.warn(
            risultato.reason
          );
        }
      }
    );
  }

  function valoreProfilo(
    fungo,
    giorno
  ) {
    const profilo =
      profiliCrescita[fungo.id] || {};

    const valore =
      profilo[String(giorno)];

    if (
      Number.isFinite(valore)
    ) {
      return Math.max(
        0,
        Math.min(
          100,
          valore
        )
      );
    }

    return 0;
  }

  function trovaEventi(
    stazione,
    fungo
  ) {
    const giorni =
      stazione.storicoGiorni
        .slice()
        .sort(
          (a, b) =>
            a.data - b.data
        );

    if (!giorni.length) {
      return [];
    }

    const eventi = [];

    const pioggiaMinima =
      Math.max(
        0,
        fungo.rainReq *
          fungo.eventThresholdFactor
      );

    const finestra =
      Math.max(
        1,
        Math.round(
          fungo.rainWindowDays
        )
      );

    const reset =
      sogliaReset(fungo);

    let eventoAttivo = null;

    giorni.forEach(
      (giorno, indice) => {
        const inizio =
          Math.max(
            0,
            indice -
              finestra +
              1
          );

        const giorniFinestra =
          giorni.slice(
            inizio,
            indice + 1
          );

        const pioggiaCumulata =
          giorniFinestra.reduce(
            (totale, elemento) =>
              totale +
              (
                Number.isFinite(
                  elemento.pioggia
                )
                  ? elemento.pioggia
                  : 0
              ),
            0
          );

        const raggiunta =
          pioggiaCumulata >=
          pioggiaMinima;

        if (
          !eventoAttivo &&
          raggiunta
        ) {
          eventoAttivo = {
            startDate:
              giornoLocale(
                giorno.data
              ),

            rainAmount:
              pioggiaCumulata
          };

          eventi.push(
            eventoAttivo
          );

          return;
        }

        if (
          eventoAttivo &&
          giorno.pioggia > reset
        ) {
          eventoAttivo = {
            startDate:
              giornoLocale(
                giorno.data
              ),

            rainAmount:
              pioggiaCumulata
          };

          eventi.push(
            eventoAttivo
          );
        }
      }
    );

    return eventi;
  }

  function eventoPerData(
    stazione,
    fungo,
    data
  ) {
    const eventi =
      trovaEventi(
        stazione,
        fungo
      );

    const validi =
      eventi
        .filter(
          evento =>
            evento.startDate <=
            data
        )
        .sort(
          (a, b) =>
            b.startDate -
            a.startDate
        );

    return validi[0] || null;
  }

  function giornoProfilo(
    evento,
    data
  ) {
    return Math.max(
      GIORNI_PROFILO_INIZIALE,
      GIORNI_PROFILO_INIZIALE +
        differenzaGiorni(
          evento.startDate,
          data
        )
    );
  }

  function fattoreEvento(
    stazione,
    fungo,
    data
  ) {
    const evento =
      eventoPerData(
        stazione,
        fungo,
        data
      );

    if (!evento) {
      return 0;
    }

    const giorno =
      giornoProfilo(
        evento,
        data
      );

    return valoreProfilo(
      fungo,
      giorno
    ) / 100;
  }

  function fattoreStagione(
    fungo,
    data
  ) {
    const mese =
      data.getMonth() + 1;

    const inStagione =
      fungo.mesiInizio <=
      fungo.mesiFine
        ? (
            mese >=
              fungo.mesiInizio &&
            mese <=
              fungo.mesiFine
          )
        : (
            mese >=
              fungo.mesiInizio ||
            mese <=
              fungo.mesiFine
          );

    return inStagione
      ? 1
      : 0;
  }

  function fattoreTemperatura(
    temperatura,
    fungo
  ) {
    if (
      !Number.isFinite(
        temperatura
      )
    ) {
      return 0.55;
    }

    if (
      temperatura <=
        fungo.tempMin ||
      temperatura >=
        fungo.tempMax
    ) {
      return 0.12;
    }

    if (
      temperatura ===
      fungo.tempOttimale
    ) {
      return 1;
    }

    const distanza =
      Math.abs(
        temperatura -
          fungo.tempOttimale
      );

    const ampiezza =
      temperatura <
      fungo.tempOttimale
        ? fungo.tempOttimale -
          fungo.tempMin
        : fungo.tempMax -
          fungo.tempOttimale;

    return Math.max(
      0.2,
      1 -
        (
          0.8 *
          (
            distanza /
            Math.max(
              1,
              ampiezza
            )
          )
        )
    );
  }

  function fattoreAltitudine(
    stazione,
    fungo
  ) {
    if (
      stazione.alt >=
        fungo.altMin &&
      stazione.alt <=
        fungo.altMax
    ) {
      return 1;
    }

    const distanza =
      stazione.alt <
      fungo.altMin
        ? fungo.altMin -
          stazione.alt
        : stazione.alt -
          fungo.altMax;

    const ampiezza =
      Math.max(
        100,
        fungo.altMax -
          fungo.altMin
      );

    return Math.max(
      0.25,
      1 -
        (
          0.75 *
          Math.min(
            1,
            distanza /
              ampiezza
          )
        )
    );
  }

  function temperaturaPrevisione(
    stazione,
    indice
  ) {
    const daily =
      datiPrevisioniMeteo[
        stazione.id
      ];

    const posizione =
      indice + 1;

    const tmin =
      daily?.temperature_2m_min?.[
        posizione
      ];

    const tmax =
      daily?.temperature_2m_max?.[
        posizione
      ];

    if (
      Number.isFinite(tmin) &&
      Number.isFinite(tmax)
    ) {
      return (
        tmin +
        tmax
      ) / 2;
    }

    return stazione.storicoTMedia;
  }

  function calcolaProbabilita(
    stazione,
    fungo,
    indice
  ) {
    const data =
      dataPrevisione(indice);

    const evento =
      fattoreEvento(
        stazione,
        fungo,
        data
      );

    /*
     * Nessun evento significa
     * pioggia minima non raggiunta.
     * In questo caso: S = S × 0
     * e la probabilità finale è 0%.
     */
    if (evento === 0) {
      return 0;
    }

    const stagione =
      fattoreStagione(
        fungo,
        data
      );

    /*
     * Fuori dal periodo di crescita (mesiInizio - mesiFine).
     * In questo caso la probabilità diventa 0%.
     */
    if (stagione === 0) {
      return 0;
    }

    const temperatura =
      temperaturaPrevisione(
        stazione,
        indice
      );

    const temperaturaFattore =
      fattoreTemperatura(
        temperatura,
        fungo
      );

    const altitudine =
      fattoreAltitudine(
        stazione,
        fungo
      );

    const pesoEvento =
      Math.max(
        0.05,
        fungo.pesoEvento
      );

    const pesoTemperatura =
      Math.max(
        0.05,
        fungo.pesoTemperatura
      );

    const pesoAltitudine =
      Math.max(
        0.05,
        fungo.pesoAltitudine
      );

    const pesoStagione =
      Math.max(
        0.05,
        fungo.pesoStagione
      );

    const sommaPesi =
      pesoEvento +
      pesoTemperatura +
      pesoAltitudine +
      pesoStagione;

    let score =
      (
        evento *
          pesoEvento +

        temperaturaFattore *
          pesoTemperatura +

        altitudine *
          pesoAltitudine +

        stagione *
          pesoStagione
      ) / sommaPesi;

    if (
      fungo.termofilo &&
      temperatura <
        fungo.tempOttimale
    ) {
      score *= 0.88;
    }

    if (
      !fungo.termofilo &&
      temperatura >
        fungo.tempMax
    ) {
      score *= 0.82;
    }

    if (
      evento >= 0.8 &&
      temperaturaFattore >= 0.8 &&
      altitudine >= 0.8 &&
      stagione >= 0.9
    ) {
      score += 0.08;
    }

    return Math.max(
      0,
      Math.min(
        MASSIMO_PROBABILITA,
        Math.round(
          score * 100
        )
      )
    );
  }

  function classeProbabilita(
    probabilita
  ) {
    if (probabilita >= 75) {
      return "prob-high";
    }

    if (probabilita >= 40) {
      return "prob-medium";
    }

    if (probabilita >= 15) {
      return "prob-low";
    }

    return "prob-none";
  }

  function aggiornaUltimoAggiornamento() {
    const testo =
      new Date().toLocaleString(
        "it-IT"
      );

    if (els.lastUpdate) {
      els.lastUpdate.textContent =
        testo;
    }

    if (els.dataLastUpdate) {
      els.dataLastUpdate.textContent =
        testo;
    }
  }

  function aggiornaRiepilogo() {
    if (els.stationsCount) {
      els.stationsCount.textContent =
        String(stazioni.length);
    }

    if (els.recordsCount) {
      els.recordsCount.textContent =
        String(
          stazioni.reduce(
            (totale, stazione) =>
              totale +
              stazione.records,
            0
          )
        );
    }

    const summary =
      el("data-summary");

    if (summary) {
      summary.style.display =
        "flex";
    }
  }

  function aggiornaPlaceholder(select) {
    if (!select) {
      return;
    }

    select.classList.toggle(
      "placeholder",
      select.value === ""
    );
  }

  function popolaSelettoriGiorni() {
    const selettori = [
      els.daySelect,
      els.dateDaySelect
    ];

    selettori.forEach(select => {
      if (!select) {
        return;
      }

      const valoreCorrente =
        select.value;

      select.innerHTML =
        `<option value="">
          Seleziona un giorno
        </option>`;

      for (
        let i = 0;
        i < GIORNI_PREVISIONE;
        i++
      ) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(i + 1);

        option.textContent =
          etichettaGiorno(i);

        select.appendChild(
          option
        );
      }

      select.value =
        valoreCorrente;

      aggiornaPlaceholder(select);
    });
  }

  function popolaSpecie() {
    if (!els.speciesSelect) {
      return;
    }

    els.speciesSelect.innerHTML =
      `<option value="">
        Seleziona una specie
      </option>`;

    specieAttive.forEach(
      fungo => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          fungo.id;

        option.textContent =
          fungo.nomeComune
            ? `${fungo.nome} - ${fungo.nomeComune}`
            : fungo.nome;

        els.speciesSelect.appendChild(
          option
        );
      }
    );
  }

  function popolaStazioni() {
    if (!els.stationSelect) {
      return;
    }

    els.stationSelect.innerHTML =
      `<option value="">
        Seleziona una stazione
      </option>`;

    stazioni
      .slice()
      .sort(
        (a, b) =>
          a.nome.localeCompare(
            b.nome,
            "it",
            {
              sensitivity: "base"
            }
          )
      )
      .forEach(
        stazione => {
          const option =
            document.createElement(
              "option"
            );

          option.value =
            stazione.id;

          option.textContent =
            stazione.nome;

          els.stationSelect.appendChild(
            option
          );
        }
      );
  }

  function aggiornaStatoSpecie() {
    aggiornaPlaceholder(
      els.daySelect
    );

    aggiornaPlaceholder(
      els.speciesSelect
    );

    const valido =
      els.daySelect &&
      els.speciesSelect &&
      els.daySelect.value !== "" &&
      els.speciesSelect.value !== "";

    if (els.generateButton) {
      els.generateButton.disabled =
        !valido;
    }

    if (els.selectionStatus) {
      els.selectionStatus.textContent =
        valido
          ? "Parametri completi."
          : "Seleziona giorno e specie.";
    }
  }

  function aggiornaStatoStazione() {
    aggiornaPlaceholder(
      els.stationSelect
    );

    aggiornaPlaceholder(
      els.probabilityFilter
    );

    const valido =
      els.stationSelect &&
      els.probabilityFilter &&
      els.stationSelect.value !== "" &&
      els.probabilityFilter.value !== "";

    if (els.generateStationButton) {
      els.generateStationButton.disabled =
        !valido;
    }

    if (els.stationSelectionStatus) {
      els.stationSelectionStatus.textContent =
        valido
          ? "Parametri completi."
          : "Seleziona stazione e soglia.";
    }
  }

  function aggiornaStatoData() {
    aggiornaPlaceholder(
      els.dateDaySelect
    );

    const valido =
      els.dateDaySelect &&
      els.dateDaySelect.value !== "";

    if (els.generateDateButton) {
      els.generateDateButton.disabled =
        !valido;
    }

    if (els.dateSelectionStatus) {
      els.dateSelectionStatus.textContent =
        valido
          ? "Parametri completi."
          : "Seleziona un giorno.";
    }
  }

  function cambiaModalita(modalita) {
    const specie =
      modalita === "species";

    const stazione =
      modalita === "station";

    const data =
      modalita === "date";

    if (els.modeSpeciesButton) {
      els.modeSpeciesButton.classList.toggle(
        "active",
        specie
      );
    }

    if (els.modeStationButton) {
      els.modeStationButton.classList.toggle(
        "active",
        stazione
      );
    }

    if (els.modeDateButton) {
      els.modeDateButton.classList.toggle(
        "active",
        data
      );
    }

    if (els.speciesReportControls) {
      els.speciesReportControls.classList.toggle(
        "hidden",
        !specie
      );
    }

    if (els.stationReportControls) {
      els.stationReportControls.classList.toggle(
        "hidden",
        !stazione
      );
    }

    if (els.dateReportControls) {
      els.dateReportControls.classList.toggle(
        "hidden",
        !data
      );
    }

    if (els.forecastPanel) {
      els.forecastPanel.classList.add(
        "hidden"
      );
    }
  }

  function creaCella(
    testo,
    classe = ""
  ) {
    const td =
      document.createElement(
        "td"
      );

    td.textContent =
      String(testo);

    if (classe) {
      td.className =
        classe;
    }

    return td;
  }

  function renderReportSpecie() {
    const fungo =
      specieAttive.find(
        elemento =>
          elemento.id ===
          specieSelezionata
      );

    const indice =
      Number(giornoSelezionato) - 1;

    if (
      !fungo ||
      indice < 0 ||
      indice >= GIORNI_PREVISIONE
    ) {
      return;
    }

    const data =
      dataPrevisione(indice);

    if (els.currentMushroomTitle) {
      els.currentMushroomTitle.textContent =
        `Previsione · ${fungo.nome}`;
    }

    if (
      els.currentSelectionDescription
    ) {
      els.currentSelectionDescription.textContent =
        `${etichettaGiorno(indice)} · stazioni ordinate per probabilità.`;
    }

    if (els.forecastThead) {
      els.forecastThead.innerHTML = `
        <tr>
          <th class="rank-cell">
            Pos.
          </th>

          <th>
            Stazione
          </th>

          <th>
            Altitudine
          </th>

          <th>
            Evento pioggia
          </th>

          <th>
            Profilo
          </th>

          <th>
            Probabilità
          </th>
        </tr>
      `;
    }

    if (!els.tableBody) {
      return;
    }

    els.tableBody.innerHTML =
      "";

    const righe =
      stazioni
        .map(stazione => {
          const evento =
            eventoPerData(
              stazione,
              fungo,
              data
            );

          const probabilita =
            calcolaProbabilita(
              stazione,
              fungo,
              indice
            );

          return {
            stazione,
            evento,
            probabilita
          };
        })
        .sort(
          (a, b) =>
            b.probabilita -
            a.probabilita
        );

    righe.forEach(
      (riga, posizione) => {
        const tr =
          document.createElement(
            "tr"
          );

        tr.appendChild(
          creaCella(
            posizione + 1,
            "rank-cell"
          )
        );

        const tdNome =
          document.createElement(
            "td"
          );

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "station-name-button";

        button.textContent =
          riga.stazione.nome;

        button.addEventListener(
          "click",
          () =>
            mostraPopupStazione(
              riga.stazione
            )
        );

        tdNome.appendChild(
          button
        );

        tr.appendChild(
          tdNome
        );

        tr.appendChild(
          creaCella(
            `${formattaNumero(
              riga.stazione.alt,
              0
            )} m`
          )
        );

        tr.appendChild(
          creaCella(
            riga.evento
              ? `${formattaNumero(
                  riga.evento.rainAmount,
                  1
                )} mm`
              : "Nessun evento",

            riga.evento
              ? "growth-event"
              : "growth-no-event"
          )
        );

        tr.appendChild(
          creaCella(
            riga.evento
              ? String(
                  giornoProfilo(
                    riga.evento,
                    data
                  )
                )
              : "—",

            riga.evento
              ? "growth-event"
              : "growth-no-event"
          )
        );

        tr.appendChild(
          creaCella(
            `${riga.probabilita}%`,
            `probability-cell ${classeProbabilita(
              riga.probabilita
            )}`
          )
        );

        els.tableBody.appendChild(
          tr
        );
      }
    );

    if (els.forecastPanel) {
      els.forecastPanel.classList.remove(
        "hidden"
      );
    }
  }

  function renderReportStazione() {
    const stazione =
      stazioni.find(
        elemento =>
          elemento.id ===
          stazioneSelezionata
      );

    if (!stazione) {
      return;
    }

    const soglia =
      Number(
        filtroProbabilita
      );

    const righe =
      specieAttive
        .map(fungo => ({
          fungo,

          valori:
            Array.from(
              {
                length:
                  GIORNI_PREVISIONE
              },
              (_, indice) =>
                calcolaProbabilita(
                  stazione,
                  fungo,
                  indice
                )
            )
        }))
        .filter(riga =>
          riga.valori.some(
            valore =>
              valore > soglia
          )
        );

    if (els.currentMushroomTitle) {
      els.currentMushroomTitle.textContent =
        `Previsione stazione · ${stazione.nome}`;
    }

    if (
      els.currentSelectionDescription
    ) {
      els.currentSelectionDescription.textContent =
        `Specie con almeno un valore superiore a ${soglia}%.`;
    }

    if (els.forecastThead) {
      const colonne =
        Array.from(
          {
            length:
              GIORNI_PREVISIONE
          },
          (_, indice) =>
            `<th>${etichettaGiornoBreve(
              indice
            )}</th>`
        ).join("");

      els.forecastThead.innerHTML = `
        <tr>
          <th class="species-name-cell">
            Specie
          </th>

          ${colonne}
        </tr>
      `;
    }

    if (!els.tableBody) {
      return;
    }

    els.tableBody.innerHTML =
      "";

    if (!righe.length) {
      const tr =
        document.createElement(
          "tr"
        );

      const td =
        document.createElement(
          "td"
        );

      td.colSpan =
        GIORNI_PREVISIONE + 1;

      td.textContent =
        "Nessuna specie supera la soglia selezionata.";

      tr.appendChild(td);

      els.tableBody.appendChild(
        tr
      );
    }

    righe.forEach(
      riga => {
        const tr =
          document.createElement(
            "tr"
          );

        const tdSpecie =
          document.createElement(
            "td"
          );

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "species-name-button";

        button.textContent =
          riga.fungo.nome;

        button.addEventListener(
          "click",
          () =>
            mostraPopupSpecie(
              riga.fungo
            )
        );

        tdSpecie.appendChild(
          button
        );

        tr.appendChild(
          tdSpecie
        );

        riga.valori.forEach(
          probabilita => {
            tr.appendChild(
              creaCella(
                `${probabilita}%`,
                `probability-cell ${classeProbabilita(
                  probabilita
                )}`
              )
            );
          }
        );

        els.tableBody.appendChild(
          tr
        );
      }
    );

    if (els.forecastPanel) {
      els.forecastPanel.classList.remove(
        "hidden"
      );
    }
  }

  function renderReportData() {
    const indice =
      Number(giornoDataSelezionato) - 1;

    if (
      indice < 0 ||
      indice >= GIORNI_PREVISIONE
    ) {
      return;
    }

    const data =
      dataPrevisione(indice);

    if (els.currentMushroomTitle) {
      els.currentMushroomTitle.textContent =
        `Previsione per data · ${etichettaGiorno(indice)}`;
    }

    if (els.currentSelectionDescription) {
      els.currentSelectionDescription.textContent =
        `${etichettaGiorno(indice)} · specie e stazioni ordinate per probabilità decrescente.`;
    }

    if (els.forecastThead) {
      els.forecastThead.innerHTML = `
        <tr>
          <th class="rank-cell">
            Pos.
          </th>

          <th>
            Specie
          </th>

          <th>
            Stazione
          </th>

          <th>
            Evento pioggia
          </th>

          <th>
            Profilo
          </th>

          <th>
            Probabilità
          </th>
        </tr>
      `;
    }

    if (!els.tableBody) {
      return;
    }

    els.tableBody.innerHTML = "";

    const righe = [];

    specieAttive.forEach(fungo => {
      stazioni.forEach(stazione => {
        const evento =
          eventoPerData(
            stazione,
            fungo,
            data
          );

        const probabilita =
          calcolaProbabilita(
            stazione,
            fungo,
            indice
          );

        righe.push({
          fungo,
          stazione,
          evento,
          probabilita
        });
      });
    });

    righe.sort(
      (a, b) =>
        b.probabilita -
        a.probabilita
    );

    righe.forEach((riga, posizione) => {
      const tr =
        document.createElement("tr");

      tr.appendChild(
        creaCella(
          posizione + 1,
          "rank-cell"
        )
      );

      const tdSpecie =
        document.createElement("td");

      const buttonSpecie =
        document.createElement("button");

      buttonSpecie.type = "button";
      buttonSpecie.className = "species-name-button";
      buttonSpecie.textContent = riga.fungo.nome;

      buttonSpecie.addEventListener(
        "click",
        () => mostraPopupSpecie(riga.fungo)
      );

      tdSpecie.appendChild(buttonSpecie);
      tr.appendChild(tdSpecie);

      const tdStazione =
        document.createElement("td");

      const buttonStazione =
        document.createElement("button");

      buttonStazione.type = "button";
      buttonStazione.className = "station-name-button";
      buttonStazione.textContent = riga.stazione.nome;

      buttonStazione.addEventListener(
        "click",
        () => mostraPopupStazione(riga.stazione)
      );

      tdStazione.appendChild(buttonStazione);
      tr.appendChild(tdStazione);

      tr.appendChild(
        creaCella(
          riga.evento
            ? `${formattaNumero(
                riga.evento.rainAmount,
                1
              )} mm`
            : "Nessun evento",
          riga.evento
            ? "growth-event"
            : "growth-no-event"
        )
      );

      tr.appendChild(
        creaCella(
          riga.evento
            ? String(
                giornoProfilo(
                  riga.evento,
                  data
                )
              )
            : "—",
          riga.evento
            ? "growth-event"
            : "growth-no-event"
        )
      );

      tr.appendChild(
        creaCella(
          `${riga.probabilita}%`,
          `probability-cell ${classeProbabilita(
            riga.probabilita
          )}`
        )
      );

      els.tableBody.appendChild(tr);
    });

    if (els.forecastPanel) {
      els.forecastPanel.classList.remove("hidden");
    }
  }

  function mostraPopupSpecie(fungo) {
    if (
      !els.speciesPopupOverlay ||
      !els.speciesPopupContent
    ) {
      return;
    }

    const campi = [
      ["ID", "id"],
      ["Nome scientifico", "nome"],
      ["Nome comune", "nomeComune"],
      ["Attivo", "attivo"],
      ["Habitat", "habitat"],
      ["Altitudine minima", "altMin"],
      ["Altitudine massima", "altMax"],
      ["Mese iniziale", "mesiInizio"],
      ["Mese finale", "mesiFine"],
      ["Pioggia richiesta", "rainReq"],
      ["Finestra pioggia", "rainWindowDays"],
      [
        "Fattore soglia evento",
        "eventThresholdFactor"
      ],
      [
        "Giorni minimi dopo pioggia",
        "giorniMinDopoPioggia"
      ],
      [
        "Giorni massimi dopo pioggia",
        "giorniMaxDopoPioggia"
      ],
      ["Temperatura minima", "tempMin"],
      ["Temperatura ottimale", "tempOttimale"],
      ["Temperatura massima", "tempMax"],
      ["Termofilo", "termofilo"],
      ["Peso evento", "pesoEvento"],
      ["Peso temperatura", "pesoTemperatura"],
      ["Peso altitudine", "pesoAltitudine"],
      ["Peso stagione", "pesoStagione"],
      ["Note", "note"]
    ];

    const campiHTML =
      campi
        .filter(
          ([, chiave]) =>
            Object.prototype.hasOwnProperty.call(
              fungo,
              chiave
            )
        )
        .map(
          ([etichetta, chiave]) => `
            <div class="species-field">
              <strong>
                ${escapeHTML(etichetta)}
              </strong>

              <span>
                ${escapeHTML(
                  String(
                    fungo[chiave] ?? "—"
                  )
                )}
              </span>
            </div>
          `
        )
        .join("");

    els.speciesPopupContent.innerHTML = `
      <h3
        id="species-popup-title"
        class="species-popup-title">

        ${escapeHTML(fungo.nome)}
      </h3>

      <p class="species-popup-subtitle">
        Caratteristiche della specie.
      </p>

      <div class="species-fields">
        ${campiHTML}
      </div>
    `;

    els.speciesPopupOverlay.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "popup-open"
    );
  }

  function chiudiPopupSpecie() {
    if (
      !els.speciesPopupOverlay
    ) {
      return;
    }

    els.speciesPopupOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "popup-open"
    );
  }

  function mostraPopupStazione(stazione) {
    if (
      !els.stationPopupOverlay ||
      !els.stationPopupContent
    ) {
      return;
    }

    const giorni =
      stazione.storicoGiorni
        .slice()
        .reverse()
        .slice(0, 30);

    const righe =
      giorni.map(
        giorno => `
          <tr>
            <td>
              ${giorno.data.toLocaleDateString(
                "it-IT"
              )}
            </td>

            <td class="popup-rain-day">
              ${formattaNumero(
                giorno.pioggia,
                1
              )} mm
            </td>

            <td class="popup-temp-min">
              ${
                Number.isFinite(
                  giorno.tmin
                )
                  ? `${formattaNumero(
                      giorno.tmin,
                      1
                    )} °C`
                  : "n/d"
              }
            </td>

            <td class="popup-temp-max">
              ${
                Number.isFinite(
                  giorno.tmax
                )
                  ? `${formattaNumero(
                      giorno.tmax,
                      1
                    )} °C`
                  : "n/d"
              }
            </td>
          </tr>
        `
      )
      .join("");

    els.stationPopupContent.innerHTML = `
      <div
        id="station-popup-title"
        class="popup-title">

        ${escapeHTML(stazione.nome)}
      </div>

      <div class="popup-meta">
        Altitudine:
        ${formattaNumero(
          stazione.alt,
          0
        )} m
      </div>

      <div class="popup-table-wrap">
        <table class="popup-weather-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Pioggia</th>
              <th>T min</th>
              <th>T max</th>
            </tr>
          </thead>

          <tbody>
            ${righe}
          </tbody>
        </table>
      </div>
    `;

    els.stationPopupOverlay.classList.remove(
      "hidden"
    );

    document.body.classList.add(
      "popup-open"
    );
  }

  function chiudiPopupStazione() {
    if (
      !els.stationPopupOverlay
    ) {
      return;
    }

    els.stationPopupOverlay.classList.add(
      "hidden"
    );

    document.body.classList.remove(
      "popup-open"
    );
  }

  function toggleSidebar() {
    if (!els.app) {
      return;
    }

    els.app.classList.toggle(
      "sidebar-collapsed"
    );
  }

  function inizializzaEventi() {
    if (els.modeSpeciesButton) {
      els.modeSpeciesButton.addEventListener(
        "click",
        () =>
          cambiaModalita(
            "species"
          )
      );
    }

    if (els.modeStationButton) {
      els.modeStationButton.addEventListener(
        "click",
        () =>
          cambiaModalita(
            "station"
          )
      );
    }

    if (els.modeDateButton) {
      els.modeDateButton.addEventListener(
        "click",
        () =>
          cambiaModalita(
            "date"
          )
      );
    }

    if (els.daySelect) {
      els.daySelect.addEventListener(
        "change",
        aggiornaStatoSpecie
      );
    }

    if (els.speciesSelect) {
      els.speciesSelect.addEventListener(
        "change",
        aggiornaStatoSpecie
      );
    }

    if (els.stationSelect) {
      els.stationSelect.addEventListener(
        "change",
        aggiornaStatoStazione
      );
    }

    if (els.probabilityFilter) {
      els.probabilityFilter.addEventListener(
        "change",
        aggiornaStatoStazione
      );
    }

    if (els.dateDaySelect) {
      els.dateDaySelect.addEventListener(
        "change",
        aggiornaStatoData
      );
    }

    if (els.generateButton) {
      els.generateButton.addEventListener(
        "click",
        () => {
          giornoSelezionato =
            Number(
              els.daySelect.value
            );

          specieSelezionata =
            els.speciesSelect.value;

          renderReportSpecie();
        }
      );
    }

    if (
      els.generateStationButton
    ) {
      els.generateStationButton.addEventListener(
        "click",
        () => {
          stazioneSelezionata =
            els.stationSelect.value;

          filtroProbabilita =
            Number(
              els.probabilityFilter
                .value
            );

          renderReportStazione();
        }
      );
    }

    if (els.generateDateButton) {
      els.generateDateButton.addEventListener(
        "click",
        () => {
          giornoDataSelezionato =
            Number(
              els.dateDaySelect.value
            );

          renderReportData();
        }
      );
    }

    if (
      els.sidebarToggleInside
    ) {
      els.sidebarToggleInside.addEventListener(
        "click",
        () =>
          els.app.classList.add(
            "sidebar-collapsed"
          )
      );
    }

    if (
      els.sidebarToggleMini
    ) {
      els.sidebarToggleMini.addEventListener(
        "click",
        () =>
          els.app.classList.remove(
            "sidebar-collapsed"
          )
      );
    }

    if (
      els.speciesPopupClose
    ) {
      els.speciesPopupClose.addEventListener(
        "click",
        chiudiPopupSpecie
      );
    }

    if (
      els.speciesPopupOverlay
    ) {
      els.speciesPopupOverlay.addEventListener(
        "click",
        evento => {
          if (
            evento.target ===
            els.speciesPopupOverlay
          ) {
            chiudiPopupSpecie();
          }
        }
      );
    }

    if (
      els.stationPopupClose
    ) {
      els.stationPopupClose.addEventListener(
        "click",
        chiudiPopupStazione
      );
    }

    if (
      els.stationPopupOverlay
    ) {
      els.stationPopupOverlay.addEventListener(
        "click",
        evento => {
          if (
            evento.target ===
            els.stationPopupOverlay
          ) {
            chiudiPopupStazione();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      evento => {
        if (
          evento.key !== "Escape"
        ) {
          return;
        }

        chiudiPopupSpecie();
        chiudiPopupStazione();
      }
    );
  }

  async function caricaDataset() {
    const csvStazioni =
      await caricaCSV(
        "stazioni_meteo.csv"
      );

    const csvMeteo =
      await caricaCSV(
        "dati_meteo_30g.csv"
      );

    const storico =
      costruisciStorico(
        csvMeteo.rows,
        csvMeteo.fields
      );

    stazioni =
      costruisciStazioni(
        csvStazioni.rows,
        csvStazioni.fields,
        storico
      );

    await caricaSpecie();
    await caricaProfili();
    await caricaPrevisioni();

    aggiornaRiepilogo();
    aggiornaUltimoAggiornamento();
    popolaSelettoriGiorni();
    popolaSpecie();
    popolaStazioni();

    if (els.controlsPanel) {
      els.controlsPanel.classList.remove(
        "hidden"
      );
    }
  }

  function mostraErrore(errore) {
    if (!els.statusText) {
      return;
    }

    els.statusText.textContent =
      errore?.message ||
      String(errore);

    els.statusText.classList.add(
      "error"
    );
  }

  async function init() {
    inizializzaElementi();
    inizializzaEventi();

    try {
      await caricaDataset();

      if (els.statusText) {
        els.statusText.textContent =
          `Dataset caricati correttamente · ${RELEASE}`;
      }
    } catch (errore) {
      mostraErrore(errore);
      console.error(errore);
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();