// functions/scriba/calendar.js
//
// Calendario del mondo di EXANTHIA. 12 mesi da 30 giorni, settimana di 5 giorni
// → 360 giorni/anno. Le date de "Lo Scriba" NON seguono il tempo reale: ogni
// numero avanza di 2 giorni in-world, a partire dal Numero 1 = 10 di Solleone.
// Così le cronache restano coerenti col mondo, non con la data di spedizione.
//
// NB: questo file è gemellato con src/data/exanthiaCalendar.js (versione ESM).
// Se cambi la logica qui, cambiala anche là.

const MESI_EXANTHIA = [
  "Gelalba",   // ❄️ Inverno  — Ny'El
  "Lungombra", // ❄️ Inverno  — Ouh'Noct
  "Disgelo",   // 🌱 Primavera — Vulkar
  "Piovano",   // 🌱 Primavera — Nysia
  "Germoglino",// 🌱 Primavera — Syrael
  "Solchiaro", // ☀️ Estate   — Drokhan
  "Solleone",  // ☀️ Estate   — Enoia
  "Mascherata",// ☀️ Estate   — Lirael
  "Brumaria",  // 🍂 Autunno  — Myrhal
  "Granaio",   // 🍂 Autunno  — Zenara
  "Fogliabruna",//🍂 Autunno  — Kal Durr
  "Lamafredda",// ❄️ Inverno  — Naavir
];

// Stagione, festa/clima e divinità tutelare di ciascun mese (materia stagionale
// per la gazzetta). Indice allineato a MESI_EXANTHIA.
const MESI_INFO = [
  { stagione: "Inverno",   festa: "Festa delle Lanterne",   clima: "notti lunghissime, cieli gelidi e limpidi; una lanterna a ogni finestra", divinita: "Ny'El" },
  { stagione: "Inverno",   festa: "Le Veglie del Focolare", clima: "il mese più buio, ci si chiude in casa per notti di racconti",           divinita: "Ouh'Noct" },
  { stagione: "Primavera", festa: "Fiera del Primo Fuoco",  clima: "il ghiaccio si rompe, riaprono fucine e mercati",                        divinita: "Vulkar" },
  { stagione: "Primavera", festa: "",                       clima: "piogge e fiumi gonfi, fango ovunque; i viaggiatori aspettano",           divinita: "Nysia" },
  { stagione: "Primavera", festa: "Festa della Semina",     clima: "semina e primi verdi",                                                   divinita: "Syrael" },
  { stagione: "Estate",    festa: "",                       clima: "giornate lunghe e tiepide; il mese dei tribunali all'aperto",            divinita: "Drokhan" },
  { stagione: "Estate",    festa: "",                       clima: "caldo torrido, notti passate sotto le stelle",                           divinita: "Enoia" },
  { stagione: "Estate",    festa: "Carnevale delle Maschere", clima: "primi raccolti e baldoria, ci si traveste",                            divinita: "Lirael" },
  { stagione: "Autunno",   festa: "",                       clima: "nebbie del mattino, l'aria cambia; il mese degli enigmi e dei misteri",  divinita: "Myrhal" },
  { stagione: "Autunno",   festa: "Festa del Granaio",      clima: "il grande raccolto, tavolate e abbondanza",                              divinita: "Zenara" },
  { stagione: "Autunno",   festa: "La Notte delle Anime",   clima: "le foglie cadono, si ricordano i morti",                                 divinita: "Kal Durr" },
  { stagione: "Inverno",   festa: "Le Provviste",           clima: "vento tagliente, macellazione, si fa scorta per l'inverno",              divinita: "Naavir" },
];

const GIORNI_SETTIMANA = ["Aelen", "Voren", "Tarsen", "Doren", "Muren"];

const GIORNI_PER_MESE = 30;
const SETTIMANA = GIORNI_SETTIMANA.length;                 // 5
const GIORNI_PER_ANNO = MESI_EXANTHIA.length * GIORNI_PER_MESE; // 360

// Giorno editoriale FISSO: la testata è "del Voren" come insegna (al pari del
// nome di un giornale), indipendente dal giorno reale di uscita.
const GIORNO_TESTATA = "Voren";
const SOTTOTITOLO_TESTATA = `La Gazzetta del ${GIORNO_TESTATA}`;

// Ancora: il Numero 1 esce il 10 di Solleone dell'Anno BASE; +2 giorni a numero.
const ANNO_BASE = 1023;       // (cambialo se il mondo ha un'altra era)
const MESE_ANCORA = 6;        // Solleone (indice 0-based)
const GIORNO_ANCORA = 10;
const PASSO_GIORNI = 2;

const startDayOfYear = () => MESE_ANCORA * GIORNI_PER_MESE + (GIORNO_ANCORA - 1); // 189

/** number (1-based) → { day, monthIndex, month, year, weekdayIndex, weekday } */
function exanthiaDate(number) {
  const n = Math.max(1, Math.floor(Number(number) || 1));
  const total = startDayOfYear() + (n - 1) * PASSO_GIORNI;
  const year = ANNO_BASE + Math.floor(total / GIORNI_PER_ANNO);
  const doy = ((total % GIORNI_PER_ANNO) + GIORNI_PER_ANNO) % GIORNI_PER_ANNO;
  const monthIndex = Math.floor(doy / GIORNI_PER_MESE);
  const day = (doy % GIORNI_PER_MESE) + 1;
  const weekdayIndex = ((total % SETTIMANA) + SETTIMANA) % SETTIMANA;
  return {
    day, monthIndex, month: MESI_EXANTHIA[monthIndex], year,
    weekdayIndex, weekday: GIORNI_SETTIMANA[weekdayIndex],
  };
}

/** "10 di Solleone · Anno 1023" */
function exanthiaDateLabel(number) {
  const d = exanthiaDate(number);
  return `${d.day} di ${d.month} · Anno ${d.year}`;
}

/** Per il raggruppamento dell'archivio: { key ordinabile, label mese }. */
function exanthiaMonthKey(number) {
  const d = exanthiaDate(number);
  return {
    key: `${String(d.year).padStart(4, "0")}-${String(d.monthIndex + 1).padStart(2, "0")}`,
    label: `${d.month} · Anno ${d.year}`,
  };
}

/** Stagione/festa/clima/divinità del mese del numero (per la materia stagionale). */
function exanthiaMonthInfo(number) {
  const d = exanthiaDate(number);
  const info = MESI_INFO[d.monthIndex] || {};
  return {
    giorno: d.day, mese: d.month, anno: d.year,
    stagione: info.stagione || "", festa: info.festa || "",
    clima: info.clima || "", divinita: info.divinita || "",
  };
}

module.exports = {
  MESI_EXANTHIA, MESI_INFO, GIORNI_SETTIMANA, GIORNO_TESTATA, SOTTOTITOLO_TESTATA, ANNO_BASE,
  exanthiaDate, exanthiaDateLabel, exanthiaMonthKey, exanthiaMonthInfo,
};
