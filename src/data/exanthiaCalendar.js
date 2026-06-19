// src/data/exanthiaCalendar.js
//
// Calendario del mondo di EXANTHIA (versione ESM per il frontend). 12 mesi da 30
// giorni, settimana di 5 giorni → 360 giorni/anno. Le date de "Lo Scriba" NON
// seguono il tempo reale: ogni numero avanza di 2 giorni in-world, dal Numero 1
// = 10 di Solleone.
//
// NB: gemellato con functions/scriba/calendar.js (versione CommonJS).
// Se cambi la logica qui, cambiala anche là.

export const MESI_EXANTHIA = [
  "Gelalba", "Lungombra", "Disgelo", "Piovano", "Germoglino", "Solchiaro",
  "Solleone", "Mascherata", "Brumaria", "Granaio", "Fogliabruna", "Lamafredda",
];

export const GIORNI_SETTIMANA = ["Aelen", "Voren", "Tarsen", "Doren", "Muren"];

const GIORNI_PER_MESE = 30;
const SETTIMANA = GIORNI_SETTIMANA.length;                  // 5
const GIORNI_PER_ANNO = MESI_EXANTHIA.length * GIORNI_PER_MESE; // 360

export const GIORNO_TESTATA = "Voren";
export const SOTTOTITOLO_TESTATA = `La Gazzetta del ${GIORNO_TESTATA}`;

const ANNO_BASE = 1023;
const MESE_ANCORA = 6;   // Solleone (0-based)
const GIORNO_ANCORA = 10;
const PASSO_GIORNI = 2;

const startDayOfYear = () => MESE_ANCORA * GIORNI_PER_MESE + (GIORNO_ANCORA - 1); // 189

/** number (1-based) → { day, monthIndex, month, year, weekdayIndex, weekday } */
export function exanthiaDate(number) {
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
export function exanthiaDateLabel(number) {
  const d = exanthiaDate(number);
  return `${d.day} di ${d.month} · Anno ${d.year}`;
}

/** Per il raggruppamento dell'archivio: { key ordinabile, label mese }. */
export function exanthiaMonthKey(number) {
  const d = exanthiaDate(number);
  return {
    key: `${String(d.year).padStart(4, "0")}-${String(d.monthIndex + 1).padStart(2, "0")}`,
    label: `${d.month} · Anno ${d.year}`,
  };
}
