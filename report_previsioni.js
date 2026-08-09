"use strict";

/*
  File richiesti nella stessa cartella:

  report_previsioni.html
  report_previsioni.js
  stazioni_meteo.csv
  dati_meteo_30g.csv
*/

let stazioni = [];
let datiPrevisioniMeteo = {};

let giornoSelezionato = null;
let specieSelezionata = "";

const RELEASE =
    "Rel. 03-C-007";

const GIORNI_PREVISIONE =
    10;

const MESI_ITALIANI = [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre"
];

const GIORNI_SETTIMANA_ITALIANI = [
    "domenica",
    "luned\u00EC",
    "marted\u00EC",
    "mercoled\u00EC",
    "gioved\u00EC",
    "venerd\u00EC",
    "sabato"
];

const specieFunghi = [
    {
        nome: "Boletus edulis",
        altMin: 700,
        altMax: 2000,
        rainReq: 60,
        tempOttimale: 15,
        termofilo: false,
        mesiInizio: 8,
        mesiFine: 11,
        habitat:
            "boschi di latifoglie e conifere"
    },

    {
        nome: "Boletus aestivalis",
        altMin: 500,
        altMax: 1600,
        rainReq: 40,
        tempOttimale: 22,
        termofilo: true,
        mesiInizio: 5,
        mesiFine: 9,
        habitat:
            "boschi caldi di latifoglie"
    },

    {
        nome: "Boletus aereus",
        altMin: 200,
        altMax: 1200,
        rainReq: 35,
        tempOttimale: 24,
        termofilo: true,
        mesiInizio: 5,
        mesiFine: 10,
        habitat:
            "boschi termofili di latifoglie"
    },

    {
        nome: "Agaricus campestris",
        altMin: 0,
        altMax: 1500,
        rainReq: 25,
        tempOttimale: 18,
        termofilo: false,
        mesiInizio: 4,
        mesiFine: 11,
        habitat:
            "prati e pascoli"
    },

    {
        nome: "Agaricus arvensis",
        altMin: 200,
        altMax: 1600,
        rainReq: 30,
        tempOttimale: 16,
        termofilo: false,
        mesiInizio: 5,
        mesiFine: 11,
        habitat:
            "prati e radure"
    },

    {
        nome: "Macrolepiota procera",
        altMin: 0,
        altMax: 1800,
        rainReq: 35,
        tempOttimale: 19,
        termofilo: false,
        mesiInizio: 6,
        mesiFine: 11,
        habitat:
            "radure, prati e margini boschivi"
    },

    {
        nome: "Cantharellus cibarius",
        altMin: 500,
        altMax: 1800,
        rainReq: 70,
        tempOttimale: 18,
        termofilo: false,
        mesiInizio: 6,
        mesiFine: 10,
        habitat:
            "boschi di latifoglie e conifere"
    },

    {
        nome: "Tricholoma terreum",
        altMin: 400,
        altMax: 1800,
        rainReq: 45,
        tempOttimale: 12,
        termofilo: false,
        mesiInizio: 9,
        mesiFine: 12,
        zeroFinoAlMese: 8,
        habitat:
            "pinete e boschi di conifere"
    }
];

function elemento(id) {
    return document.getElementById(id);
}

function normalizzaChiave(value) {
    return String(value ?? "")
        .replace(/^\uFEFF/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function numero(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    let testo =
        String(value)
            .trim()
            .replace(/\s/g, "");

    if (!testo) {
        return null;
    }

    if (
        testo.includes(",") &&
        testo.includes(".")
    ) {
        if (
            testo.lastIndexOf(",") >
            testo.lastIndexOf(".")
        ) {
            testo =
                testo
                    .replace(/\./g, "")
                    .replace(",", ".");
        } else {
            testo =
                testo.replace(/,/g, "");
        }
    } else if (
        testo.includes(",")
    ) {
        testo =
            testo.replace(",", ".");
    }

    const risultato =
        Number.parseFloat(testo);

    return Number.isFinite(risultato)
        ? risultato
        : null;
}

function rilevaDelimitatore(testo) {
    const delimitatori = [
        ";",
        ",",
        "\t",
        "|"
    ];

    const anteprima =
        String(testo)
            .split(/\r?\n/)
            .slice(0, 10)
            .join("\n");

    const conteggi =
        delimitatori.map(delimitatore => {
            return {
                delimitatore,
                conteggio:
                    anteprima
                        .split(delimitatore)
                        .length - 1
            };
        });

    conteggi.sort(
        (a, b) =>
            b.conteggio - a.conteggio
    );

    if (
        conteggi[0].conteggio <= 0
    ) {
        return ",";
    }

    return conteggi[0].delimitatore;
}

function parseCSV(testo) {
    if (
        typeof Papa ===
        "undefined"
    ) {
        throw new Error(
            "Papa Parse non \u00E8 stato caricato."
        );
    }

    const risultato =
        Papa.parse(
            String(testo),
            {
                header: true,
                skipEmptyLines: "greedy",
                delimiter:
                    rilevaDelimitatore(
                        testo
                    ),
                transformHeader:
                    intestazione =>
                        String(
                            intestazione
                        )
                            .replace(
                                /^\uFEFF/,
                                ""
                            )
                            .trim(),
                transform:
                    valore =>
                        String(
                            valore ?? ""
                        ).trim()
            }
        );

    if (
        risultato.errors &&
        risultato.errors.length > 0
    ) {
        console.warn(
            "Avvisi del parsing CSV:",
            risultato.errors
        );
    }

    const fields =
        Array.isArray(
            risultato.meta?.fields
        )
            ? risultato.meta.fields
            : [];

    const rows =
        Array.isArray(
            risultato.data
        )
            ? risultato.data.filter(
                riga =>
                    riga &&
                    typeof riga ===
                    "object" &&
                    !Array.isArray(riga)
            )
            : [];

    return {
        rows,
        fields
    };
}

function trovaCampo(
    fields,
    candidati
) {
    const elencoCampi =
        Array.isArray(fields)
            ? fields
            : [];

    const campiNormalizzati =
        elencoCampi.map(campo => ({
            originale:
                String(campo),

            normalizzato:
                normalizzaChiave(campo)
        }));

    const candidatiNormalizzati =
        candidati.map(candidato =>
            normalizzaChiave(candidato)
        );

    const esatto =
        campiNormalizzati.find(campo =>
            candidatiNormalizzati.includes(
                campo.normalizzato
            )
        );

    if (esatto) {
        return esatto.originale;
    }

    const parziale =
        campiNormalizzati.find(campo =>
            candidatiNormalizzati.some(
                candidato =>
                    candidato.length > 0 &&
                    campo.normalizzato.includes(
                        candidato
                    )
            )
        );

    return parziale
        ? parziale.originale
        : "";
}

function trovaCampoID(fields) {
    return trovaCampo(
        fields,
        [
            "id",
            "idstazione",
            "stationid",
            "stazioneid",
            "codice",
            "codicestazione"
        ]
    );
}

function trovaCampoNomeStazione(fields) {
    return trovaCampo(
        fields,
        [
            "stazione",
            "stazionemeteo",
            "nomestazione",
            "nome",
            "name"
        ]
    );
}

function trovaCampoLink(fields) {
    return trovaCampo(
        fields,
        [
            "link",
            "indirizzo",
            "url",
            "sito",
            "website"
        ]
    );
}

function trovaCampoAltitudine(fields) {
    return trovaCampo(
        fields,
        [
            "altitudine",
            "altitude",
            "quota",
            "elevazione"
        ]
    );
}

function trovaCampoLatitudine(fields) {
    return trovaCampo(
        fields,
        [
            "lat",
            "latitudine",
            "latitude"
        ]
    );
}

function trovaCampoLongitudine(fields) {
    return trovaCampo(
        fields,
        [
            "long",
            "lon",
            "longitudine",
            "longitude"
        ]
    );
}

function trovaCampoPioggia(fields) {
    return trovaCampo(
        fields,
        [
            "pioggia",
            "pioggiagiornaliera",
            "rain",
            "rainmm",
            "precipitazione",
            "precipitation",
            "precipitationsum"
        ]
    );
}

function trovaCampoTemperaturaMinima(fields) {
    return trovaCampo(
        fields,
        [
            "temperaturaminima",
            "temperaturamin",
            "tempmin",
            "tmin",
            "minima"
        ]
    );
}

function trovaCampoTemperaturaMassima(fields) {
    return trovaCampo(
        fields,
        [
            "temperaturamassima",
            "temperaturamax",
            "tempmax",
            "tmax",
            "massima"
        ]
    );
}

function trovaCampoData(fields) {
    return trovaCampo(
        fields,
        [
            "data",
            "date",
            "giorno",
            "datarilevamento",
            "dataaggiornamento",
            "timestamp",
            "datetime"
        ]
    );
}

function estraiData(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const testo =
        String(value).trim();

    if (!testo) {
        return null;
    }

    let corrispondenza =
        testo.match(
            /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/
        );

    if (corrispondenza) {
        const giorno =
            Number(corrispondenza[1]);

        const mese =
            Number(corrispondenza[2]);

        const anno =
            Number(corrispondenza[3]);

        const data =
            new Date(
                anno,
                mese - 1,
                giorno
            );

        return Number.isNaN(
            data.getTime()
        )
            ? null
            : data;
    }

    corrispondenza =
        testo.match(
            /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/
        );

    if (corrispondenza) {
        const anno =
            Number(corrispondenza[1]);

        const mese =
            Number(corrispondenza[2]);

        const giorno =
            Number(corrispondenza[3]);

        const data =
            new Date(
                anno,
                mese - 1,
                giorno
            );

        return Number.isNaN(
            data.getTime()
        )
            ? null
            : data;
    }

    const data =
        new Date(testo);

    return Number.isNaN(
        data.getTime()
    )
        ? null
        : data;
}

function media(valori) {
    const validi =
        valori.filter(valore =>
            Number.isFinite(valore)
        );

    if (!validi.length) {
        return null;
    }

    const somma =
        validi.reduce(
            (totale, valore) =>
                totale + valore,
            0
        );

    return somma / validi.length;
}

function costruisciStorico(
    righeMeteo,
    campoID,
    campoPioggia,
    campoTMin,
    campoTMax,
    campoData
) {
    const storico = {};

    const righeConData =
        righeMeteo
            .map(riga => ({
                riga,

                data:
                    estraiData(
                        riga[campoData]
                    )
            }))
            .filter(elementoRiga =>
                elementoRiga.data
            )
            .sort(
                (a, b) =>
                    a.data - b.data
            );

    righeConData.forEach(elementoRiga => {
        const riga =
            elementoRiga.riga;

        const id =
            String(
                riga[campoID] ?? ""
            ).trim();

        if (!id) {
            return;
        }

        if (!storico[id]) {
            storico[id] = {
                giorni: [],
                temperatureMinime: [],
                temperatureMassime: []
            };
        }

        const pioggia =
            numero(
                riga[campoPioggia]
            );

        const temperaturaMinima =
            numero(
                riga[campoTMin]
            );

        const temperaturaMassima =
            numero(
                riga[campoTMax]
            );

        storico[id].giorni.push({
            data:
                elementoRiga.data,

            pioggia:
                Number.isFinite(pioggia)
                    ? pioggia
                    : 0
        });

        if (
            Number.isFinite(
                temperaturaMinima
            )
        ) {
            storico[id]
                .temperatureMinime
                .push(
                    temperaturaMinima
                );
        }

        if (
            Number.isFinite(
                temperaturaMassima
            )
        ) {
            storico[id]
                .temperatureMassime
                .push(
                    temperaturaMassima
                );
        }
    });

    Object.values(storico).forEach(dati => {
        dati.giorni =
            dati.giorni.slice(-30);

        dati.temperatureMinime =
            dati.temperatureMinime
                .slice(-7);

        dati.temperatureMassime =
            dati.temperatureMassime
                .slice(-7);

        dati.rainTotal =
            dati.giorni.reduce(
                (totale, giorno) =>
                    totale + giorno.pioggia,
                0
            );

        dati.mediaTMin =
            media(
                dati.temperatureMinime
            );

        dati.mediaTMax =
            media(
                dati.temperatureMassime
            );
    });

    return storico;
}

function costruisciStazioni(
    righeStazioni,
    campiStazioni,
    storico
) {
    const campoID =
        trovaCampoID(
            campiStazioni
        );

    const campoNome =
        trovaCampoNomeStazione(
            campiStazioni
        );

    const campoLink =
        trovaCampoLink(
            campiStazioni
        );

    const campoAltitudine =
        trovaCampoAltitudine(
            campiStazioni
        );

    const campoLatitudine =
        trovaCampoLatitudine(
            campiStazioni
        );

    const campoLongitudine =
        trovaCampoLongitudine(
            campiStazioni
        );

    if (!campoID) {
        throw new Error(
            "Colonna ID non trovata nel CSV delle stazioni."
        );
    }

    if (!campoNome) {
        throw new Error(
            "Colonna nome stazione non trovata nel CSV delle stazioni."
        );
    }

    return righeStazioni
        .map(riga => {
            const id =
                String(
                    riga[campoID] ?? ""
                ).trim();

            if (!id) {
                return null;
            }

            const datiStorici =
                storico[id] || {
                    rainTotal: 0,
                    mediaTMin: null,
                    mediaTMax: null
                };

            let temperaturaMedia =
                20;

            if (
                Number.isFinite(
                    datiStorici.mediaTMin
                ) &&
                Number.isFinite(
                    datiStorici.mediaTMax
                )
            ) {
                temperaturaMedia =
                    (
                        datiStorici.mediaTMin +
                        datiStorici.mediaTMax
                    ) / 2;
            }

            return {
                id,

                nome:
                    String(
                        riga[campoNome] ?? ""
                    ).trim() ||
                    `Stazione ${id}`,

                link:
                    campoLink
                        ? String(
                            riga[campoLink] ?? ""
                        ).trim()
                        : "#",

                alt:
                    numero(
                        campoAltitudine
                            ? riga[campoAltitudine]
                            : null
                    ) ?? 0,

                lat:
                    numero(
                        campoLatitudine
                            ? riga[campoLatitudine]
                            : null
                    ) ?? 42.35,

                lon:
                    numero(
                        campoLongitudine
                            ? riga[campoLongitudine]
                            : null
                    ) ?? 13.40,

                rain30g:
                    Number.isFinite(
                        datiStorici.rainTotal
                    )
                        ? datiStorici.rainTotal
                        : 0,

                storicoTMedia:
                    temperaturaMedia
            };
        })
        .filter(stazione =>
            stazione !== null
        );
}

function dataSenzaOra(data) {
    return new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate()
    );
}

/*
  Il Giorno 1 è domani.
  Il file storico continua a usare anche
  il record meteorologico di oggi.
*/

function dataGiornoPrevisione(
    indiceGiorno
) {
    const oggi =
        dataSenzaOra(
            new Date()
        );

    const domani =
        new Date(oggi);

    domani.setDate(
        domani.getDate() + 1
    );

    const data =
        new Date(domani);

    data.setDate(
        data.getDate() + indiceGiorno
    );

    return data;
}

function formattaDataPrevisione(
    indiceGiorno
) {
    const data =
        dataGiornoPrevisione(
            indiceGiorno
        );

    const giorno =
        data.getDate();

    const mese =
        MESI_ITALIANI[
            data.getMonth()
        ];

    const settimana =
        GIORNI_SETTIMANA_ITALIANI[
            data.getDay()
        ];

    return (
        `${giorno} ${mese} ${settimana}`
    );
}

function formattaGiornoCompleto(
    numeroGiorno,
    indiceGiorno
) {
    return (
        `Giorno ${numeroGiorno} - ` +
        formattaDataPrevisione(
            indiceGiorno
        )
    );
}

function aggiornaEtichetteGiorni() {
    const daySelect =
        elemento(
            "day-select"
        );

    if (!daySelect) {
        return;
    }

    Array.from(
        daySelect.options
    ).forEach(option => {
        const numeroGiorno =
            Number(option.value);

        if (
            !Number.isInteger(
                numeroGiorno
            ) ||
            numeroGiorno < 1 ||
            numeroGiorno > GIORNI_PREVISIONE
        ) {
            return;
        }

        option.textContent =
            formattaGiornoCompleto(
                numeroGiorno,
                numeroGiorno - 1
            );
    });
}

function costruisciURLPrevisioni(
    stazione
) {
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
                [
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "precipitation_sum"
                ].join(","),

            timezone:
                "Europe/Rome",

            forecast_days:
                String(
                    GIORNI_PREVISIONE
                )
        });

    return (
        "https://api.open-meteo.com/v1/forecast?" +
        parametri.toString()
    );
}

async function caricaPrevisioneOpenMeteo(
    stazione
) {
    const url =
        costruisciURLPrevisioni(
            stazione
        );

    const risposta =
        await fetch(url);

    if (!risposta.ok) {
        throw new Error(
            `Open-Meteo HTTP ${risposta.status}`
        );
    }

    const dati =
        await risposta.json();

    if (
        !dati.daily ||
        !Array.isArray(
            dati.daily.temperature_2m_max
        ) ||
        !Array.isArray(
            dati.daily.temperature_2m_min
        ) ||
        !Array.isArray(
            dati.daily.precipitation_sum
        )
    ) {
        throw new Error(
            "Risposta Open-Meteo incompleta."
        );
    }

    return dati.daily;
}

async function caricaPrevisioniStazioni(
    statusEl
) {
    statusEl.textContent =
        "Interrogazione Open-Meteo per le previsioni a 10 giorni...";

    const risultati =
        await Promise.allSettled(
            stazioni.map(async stazione => {
                const previsione =
                    await caricaPrevisioneOpenMeteo(
                        stazione
                    );

                return {
                    id:
                        stazione.id,

                    previsione
                };
            })
        );

    let riuscite = 0;

    risultati.forEach(risultato => {
        if (
            risultato.status ===
            "fulfilled"
        ) {
            datiPrevisioniMeteo[
                risultato.value.id
            ] =
                risultato.value.previsione;

            riuscite++;
        } else {
            console.warn(
                "Previsione non disponibile:",
                risultato.reason
            );
        }
    });

    if (!riuscite) {
        throw new Error(
            "Nessuna previsione Open-Meteo è disponibile."
        );
    }

    return riuscite;
}

function distanzaMese(
    mese,
    inizio,
    fine
) {
    if (
        inizio <= fine &&
        mese >= inizio &&
        mese <= fine
    ) {
        return 0;
    }

    if (
        inizio > fine &&
        (
            mese >= inizio ||
            mese <= fine
        )
    ) {
        return 0;
    }

    const distanzaInizio =
        Math.min(
            Math.abs(mese - inizio),
            12 -
            Math.abs(mese - inizio)
        );

    const distanzaFine =
        Math.min(
            Math.abs(mese - fine),
            12 -
            Math.abs(mese - fine)
        );

    return Math.min(
        distanzaInizio,
        distanzaFine
    );
}

function penalitaStagionale(
    fungo,
    data
) {
    const mese =
        data.getMonth() + 1;

    const inizio =
        fungo.mesiInizio;

    const fine =
        fungo.mesiFine;

    const stagioneValida =
        inizio <= fine
            ? (
                mese >= inizio &&
                mese <= fine
            )
            : (
                mese >= inizio ||
                mese <= fine
            );

    if (stagioneValida) {
        return 1;
    }

    const distanza =
        distanzaMese(
            mese,
            inizio,
            fine
        );

    if (distanza === 1) {
        return 0.65;
    }

    if (distanza === 2) {
        return 0.30;
    }

    return 0.08;
}

function probabilitaZeroPerStagione(
    fungo,
    data
) {
    if (
        fungo.nome ===
        "Tricholoma terreum"
    ) {
        const mese =
            data.getMonth() + 1;

        if (
            mese <=
            fungo.zeroFinoAlMese
        ) {
            return true;
        }
    }

    return false;
}

function calcolaProbabilitaReale(
    stazione,
    fungo,
    indiceGiorno
) {
    const dataPrevisione =
        dataGiornoPrevisione(
            indiceGiorno
        );

    if (
        probabilitaZeroPerStagione(
            fungo,
            dataPrevisione
        )
    ) {
        return 0;
    }

    let punteggio =
        100;

    const pioggiaStorica =
        Number.isFinite(
            stazione.rain30g
        )
            ? stazione.rain30g
            : 0;

    const temperaturaStorica =
        Number.isFinite(
            stazione.storicoTMedia
        )
            ? stazione.storicoTMedia
            : 20;

    const previsione =
        datiPrevisioniMeteo[
            stazione.id
        ];

    const temperaturaMassima =
        previsione &&
        Number.isFinite(
            previsione
                .temperature_2m_max[
                    indiceGiorno
                ]
        )
            ? previsione
                .temperature_2m_max[
                    indiceGiorno
                ]
            : temperaturaStorica + 2;

    const temperaturaMinima =
        previsione &&
        Number.isFinite(
            previsione
                .temperature_2m_min[
                    indiceGiorno
                ]
        )
            ? previsione
                .temperature_2m_min[
                    indiceGiorno
                ]
            : temperaturaStorica - 2;

    const pioggiaPrevista =
        previsione &&
        Number.isFinite(
            previsione
                .precipitation_sum[
                    indiceGiorno
                ]
        )
            ? previsione
                .precipitation_sum[
                    indiceGiorno
                ]
            : 0;

    const temperaturaMedia =
        (
            temperaturaMassima +
            temperaturaMinima
        ) / 2;

    const acquaDisponibile =
        pioggiaStorica +
        pioggiaPrevista;

    if (
        acquaDisponibile <
        fungo.rainReq
    ) {
        punteggio -=
            (
                (
                    fungo.rainReq -
                    acquaDisponibile
                ) /
                fungo.rainReq
            ) * 50;
    }

    if (
        stazione.alt <
        fungo.altMin ||
        stazione.alt >
        fungo.altMax
    ) {
        const distanza =
            Math.min(
                Math.abs(
                    stazione.alt -
                    fungo.altMin
                ),
                Math.abs(
                    stazione.alt -
                    fungo.altMax
                )
            );

        punteggio -=
            distanza / 3;
    }

    const scostamentoTermico =
        Math.abs(
            temperaturaMedia -
            fungo.tempOttimale
        );

    punteggio -=
        scostamentoTermico * 4;

    if (
        fungo.termofilo &&
        temperaturaMedia < 18
    ) {
        punteggio -= 30;
    }

    if (
        !fungo.termofilo &&
        stazione.alt < 1000 &&
        temperaturaMassima > 28
    ) {
        punteggio -= 40;
    }

    const fattoreStagionale =
        penalitaStagionale(
            fungo,
            dataPrevisione
        );

    punteggio *=
        fattoreStagionale;

    if (
        acquaDisponibile < 25
    ) {
        punteggio *= 0.05;
    }

    punteggio =
        Math.max(
            0,
            Math.min(
                98,
                Math.round(
                    punteggio
                )
            )
        );

    return punteggio;
}

function ottieniClasseStile(
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

function creaLinkSicuro(url) {
    const link =
        document.createElement(
            "a"
        );

    link.className =
        "station-link";

    link.target =
        "_blank";

    link.rel =
        "noopener noreferrer";

    link.textContent =
        "\uD83D\uDD17 ";

    if (
        !url ||
        url === "#"
    ) {
        link.href =
            "#";

        return link;
    }

    try {
        const urlValido =
            new URL(
                url,
                window.location.href
            );

        if (
            urlValido.protocol ===
                "http:" ||
            urlValido.protocol ===
                "https:"
        ) {
            link.href =
                urlValido.href;
        } else {
            link.href =
                "#";
        }
    } catch {
        link.href =
            "#";
    }

    return link;
}

function aggiornaRiepilogo(
    numeroStazioni,
    numeroRecordMeteo
) {
    const stazioniCount =
        elemento(
            "stations-count"
        );

    const recordsCount =
        elemento(
            "records-count"
        );

    const dataSummary =
        elemento(
            "data-summary"
        );

    if (stazioniCount) {
        stazioniCount.textContent =
            String(
                numeroStazioni
            );
    }

    if (recordsCount) {
        recordsCount.textContent =
            String(
                numeroRecordMeteo
            );
    }

    if (dataSummary) {
        dataSummary.style.display =
            "flex";
    }
}

function popolaSpecie() {
    const speciesSelect =
        elemento(
            "species-select"
        );

    if (!speciesSelect) {
        return;
    }

    speciesSelect.innerHTML =
        `
        <option value="">
            Seleziona una specie
        </option>
        `;

    specieFunghi.forEach(fungo => {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            fungo.nome;

        option.textContent =
            fungo.nome;

        speciesSelect.appendChild(
            option
        );
    });
}

function aggiornaStatoSelezione() {
    const daySelect =
        elemento(
            "day-select"
        );

    const speciesSelect =
        elemento(
            "species-select"
        );

    const generateButton =
        elemento(
            "generate-button"
        );

    const selectionStatus =
        elemento(
            "selection-status"
        );

    if (
        !daySelect ||
        !speciesSelect ||
        !generateButton
    ) {
        return;
    }

    const giorno =
        Number(
            daySelect.value
        );

    const specie =
        speciesSelect.value;

    const valido =
        Number.isInteger(giorno) &&
        giorno >= 1 &&
        giorno <= GIORNI_PREVISIONE &&
        specie !== "";

    generateButton.disabled =
        !valido;

    daySelect.classList.toggle(
        "placeholder",
        daySelect.value === ""
    );

    speciesSelect.classList.toggle(
        "placeholder",
        speciesSelect.value === ""
    );

    if (!selectionStatus) {
        return;
    }

    if (
        !daySelect.value &&
        !specie
    ) {
        selectionStatus.textContent =
            "Seleziona giorno e specie.";
    } else if (
        !daySelect.value
    ) {
        selectionStatus.textContent =
            "Seleziona il giorno della previsione.";
    } else if (
        !specie
    ) {
        selectionStatus.textContent =
            "Seleziona la specie fungina.";
    } else {
        selectionStatus.textContent =
            "Parametri completi: premi “Genera previsione”.";
    }
}

function inizializzaControlli() {
    const daySelect =
        elemento(
            "day-select"
        );

    const speciesSelect =
        elemento(
            "species-select"
        );

    const generateButton =
        elemento(
            "generate-button"
        );

    if (
        !daySelect ||
        !speciesSelect ||
        !generateButton
    ) {
        throw new Error(
            "Controlli giorno/specie non trovati nella pagina HTML."
        );
    }

    aggiornaEtichetteGiorni();
    popolaSpecie();

    daySelect.addEventListener(
        "change",
        aggiornaStatoSelezione
    );

    speciesSelect.addEventListener(
        "change",
        aggiornaStatoSelezione
    );

    generateButton.addEventListener(
        "click",
        generaPrevisioneSelezionata
    );

    aggiornaStatoSelezione();
}

function generaPrevisioneSelezionata() {
    const daySelect =
        elemento(
            "day-select"
        );

    const speciesSelect =
        elemento(
            "species-select"
        );

    if (
        !daySelect ||
        !speciesSelect
    ) {
        return;
    }

    const giorno =
        Number(
            daySelect.value
        );

    const nomeSpecie =
        speciesSelect.value;

    if (
        !Number.isInteger(giorno) ||
        giorno < 1 ||
        giorno > GIORNI_PREVISIONE ||
        !nomeSpecie
    ) {
        aggiornaStatoSelezione();
        return;
    }

    giornoSelezionato =
        giorno;

    specieSelezionata =
        nomeSpecie;

    renderTabellaSelezionata(
        nomeSpecie,
        giorno - 1
    );
}

function renderTabellaSelezionata(
    nomeSpecie,
    indiceGiorno
) {
    const fungo =
        specieFunghi.find(
            specie =>
                specie.nome ===
                nomeSpecie
        );

    const tbody =
        elemento(
            "table-body"
        );

    const forecastPanel =
        elemento(
            "forecast-panel"
        );

    const titolo =
        elemento(
            "current-mushroom-title"
        );

    const descrizione =
        elemento(
            "current-selection-description"
        );

    if (
        !fungo ||
        !tbody ||
        !forecastPanel
    ) {
        return;
    }

    const righe =
        stazioni.map(stazione => {
            const probabilita =
                calcolaProbabilitaReale(
                    stazione,
                    fungo,
                    indiceGiorno
                );

            return {
                stazione,
                probabilita
            };
        });

    righe.sort(
        (a, b) =>
            b.probabilita -
            a.probabilita
    );

    tbody.innerHTML =
        "";

    if (!righe.length) {
        const rigaVuota =
            document.createElement(
                "tr"
            );

        rigaVuota.innerHTML =
            `
            <td
                colspan="5"
                class="empty-row">
                Nessuna stazione disponibile.
            </td>
            `;

        tbody.appendChild(
            rigaVuota
        );
    }

    righe.forEach(
        (elementoRiga, indice) => {
            const riga =
                document.createElement(
                    "tr"
                );

            const classe =
                ottieniClasseStile(
                    elementoRiga.probabilita
                );

            const cellaPosizione =
                document.createElement(
                    "td"
                );

            cellaPosizione.className =
                "rank-cell";

            cellaPosizione.textContent =
                String(
                    indice + 1
                );

            const cellaStazione =
                document.createElement(
                    "td"
                );

            const link =
                creaLinkSicuro(
                    elementoRiga.stazione.link
                );

            link.append(
                document.createTextNode(
                    elementoRiga.stazione.nome
                )
            );

            cellaStazione.appendChild(
                link
            );

            const cellaAltitudine =
                document.createElement(
                    "td"
                );

            cellaAltitudine.textContent =
                `${elementoRiga.stazione.alt} m`;

            const cellaPioggia =
                document.createElement(
                    "td"
                );

            cellaPioggia.textContent =
                `${elementoRiga.stazione.rain30g.toFixed(1)} mm`;

            const cellaProbabilita =
                document.createElement(
                    "td"
                );

            cellaProbabilita.className =
                `probability-cell ${classe}`;

            cellaProbabilita.textContent =
                `${elementoRiga.probabilita}%`;

            riga.appendChild(
                cellaPosizione
            );

            riga.appendChild(
                cellaStazione
            );

            riga.appendChild(
                cellaAltitudine
            );

            riga.appendChild(
                cellaPioggia
            );

            riga.appendChild(
                cellaProbabilita
            );

            tbody.appendChild(
                riga
            );
        }
    );

    const dataFormattata =
        formattaDataPrevisione(
            indiceGiorno
        );

    if (titolo) {
        titolo.textContent =
            `Giorno ${giornoSelezionato} - ` +
            `${dataFormattata} · ${fungo.nome}`;
    }

    if (descrizione) {
        const periodo =
            fungo.nome ===
            "Tricholoma terreum"
                ? "settembre–dicembre"
                : `mesi ${fungo.mesiInizio}–${fungo.mesiFine}`;

        descrizione.textContent =
            "Stazioni ordinate per probabilità di crescita decrescente · " +
            "prima posizione = probabilità maggiore · " +
            `altitudine considerata: ${fungo.altMin}–${fungo.altMax} m · ` +
            `periodo principale: ${periodo}`;
    }

    forecastPanel.classList.remove(
        "hidden"
    );
}

async function leggiTestoUTF8(
    risposta
) {
    const buffer =
        await risposta.arrayBuffer();

    const decoder =
        new TextDecoder(
            "utf-8",
            {
                fatal: false
            }
        );

    return decoder.decode(buffer);
}

async function elaboraDati(
    datiStazioni,
    datiMeteo
) {
    const statusEl =
        elemento(
            "status-text"
        );

    const righeStazioni =
        Array.isArray(
            datiStazioni.rows
        )
            ? datiStazioni.rows
            : [];

    const righeMeteo =
        Array.isArray(
            datiMeteo.rows
        )
            ? datiMeteo.rows
            : [];

    const campiStazioni =
        Array.isArray(
            datiStazioni.fields
        )
            ? datiStazioni.fields
            : [];

    const campiMeteo =
        Array.isArray(
            datiMeteo.fields
        )
            ? datiMeteo.fields
            : [];

    if (!campiStazioni.length) {
        throw new Error(
            "Il CSV delle stazioni non contiene intestazioni."
        );
    }

    if (!campiMeteo.length) {
        throw new Error(
            "Il CSV meteorologico non contiene intestazioni."
        );
    }

    const campoMeteoID =
        trovaCampoID(
            campiMeteo
        );

    const campoPioggia =
        trovaCampoPioggia(
            campiMeteo
        );

    const campoTMin =
        trovaCampoTemperaturaMinima(
            campiMeteo
        );

    const campoTMax =
        trovaCampoTemperaturaMassima(
            campiMeteo
        );

    const campoData =
        trovaCampoData(
            campiMeteo
        );

    if (!campoMeteoID) {
        throw new Error(
            "Colonna ID non trovata in dati_meteo_30g.csv."
        );
    }

    if (!campoPioggia) {
        throw new Error(
            "Colonna pioggia non trovata in dati_meteo_30g.csv."
        );
    }

    if (!campoTMin) {
        throw new Error(
            "Colonna temperatura minima non trovata in dati_meteo_30g.csv."
        );
    }

    if (!campoTMax) {
        throw new Error(
            "Colonna temperatura massima non trovata in dati_meteo_30g.csv."
        );
    }

    if (!campoData) {
        throw new Error(
            "Colonna data non trovata in dati_meteo_30g.csv."
        );
    }

    const storico =
        costruisciStorico(
            righeMeteo,
            campoMeteoID,
            campoPioggia,
            campoTMin,
            campoTMax,
            campoData
        );

    stazioni =
        costruisciStazioni(
            righeStazioni,
            campiStazioni,
            storico
        );

    if (!stazioni.length) {
        throw new Error(
            "Nessuna stazione valida trovata nel CSV."
        );
    }

    aggiornaRiepilogo(
        stazioni.length,
        righeMeteo.length
    );

    await caricaPrevisioniStazioni(
        statusEl
    );

    inizializzaControlli();

    const controlsPanel =
        elemento(
            "controls-panel"
        );

    if (controlsPanel) {
        controlsPanel.classList.remove(
            "hidden"
        );
    }

    statusEl.style.display =
        "none";
}

async function caricaFileAutomaticamente() {
    const statusEl =
        elemento(
            "status-text"
        );

    try {
        if (!statusEl) {
            throw new Error(
                "Elemento status-text non trovato nella pagina."
            );
        }

        statusEl.classList.remove(
            "error"
        );

        statusEl.style.display =
            "block";

        statusEl.textContent =
            "Download dei dati meteorologici locali...";

        const [
            rispostaStazioni,
            rispostaMeteo
        ] =
            await Promise.all([
                fetch(
                    "./stazioni_meteo.csv",
                    {
                        cache: "no-store"
                    }
                ),

                fetch(
                    "./dati_meteo_30g.csv",
                    {
                        cache: "no-store"
                    }
                )
            ]);

        if (!rispostaStazioni.ok) {
            throw new Error(
                `stazioni_meteo.csv non trovato: HTTP ${rispostaStazioni.status}`
            );
        }

        if (!rispostaMeteo.ok) {
            throw new Error(
                `dati_meteo_30g.csv non trovato: HTTP ${rispostaMeteo.status}`
            );
        }

        const [
            testoStazioni,
            testoMeteo
        ] =
            await Promise.all([
                leggiTestoUTF8(
                    rispostaStazioni
                ),

                leggiTestoUTF8(
                    rispostaMeteo
                )
            ]);

        if (!testoStazioni.trim()) {
            throw new Error(
                "stazioni_meteo.csv è vuoto."
            );
        }

        if (!testoMeteo.trim()) {
            throw new Error(
                "dati_meteo_30g.csv è vuoto."
            );
        }

        const datiStazioni =
            parseCSV(
                testoStazioni
            );

        const datiMeteo =
            parseCSV(
                testoMeteo
            );

        await elaboraDati(
            datiStazioni,
            datiMeteo
        );

    } catch (errore) {
        console.error(
            "Errore caricamento dati:",
            errore
        );

        if (!statusEl) {
            return;
        }

        statusEl.classList.add(
            "error"
        );

        statusEl.style.display =
            "block";

        statusEl.textContent =
            `⚠️ Errore: ${
                errore.message ||
                errore
            }`;
    }
}

window.addEventListener(
    "load",
    () => {
        caricaFileAutomaticamente();
    }
);