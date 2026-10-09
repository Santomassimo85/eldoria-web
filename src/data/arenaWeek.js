// ── Settimana Arena (vetrina del market) ─────────────────────────────────────
// La settimana dell'Arena CHIUDE LA DOMENICA ALLE 23:00, ora italiana
// (Europe/Rome; 2026-10-09, prima era domenica 24:00). A quell'ora la funzione
// `arenaSundayReset` (functions/index.js) azzera acquisti, iscrizioni e torneo
// e riporta le Monete Arena a 60. La chiave della settimana è la data del
// lunedì ("YYYY-MM-DD") calcolata con un'ora di anticipo: dalle 23:00 di
// domenica si è già nella settimana nuova, quindi gli acquisti vecchi smettono
// di contare anche se la funzione arrivasse in ritardo.
// TENERE ALLINEATO con `arenaWeekKey` in functions/index.js.

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const CLOSE_SHIFT_MS = 60 * 60 * 1000; // domenica 23:00 = "lunedì 00:00" spostato di 1 h

// Data corrente in Europe/Rome come { y, m, d, weekday 0=lun..6=dom }.
function romeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    y: +get("year"), m: +get("month"), d: +get("day"),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

// Chiave della settimana corrente = data del lunedì, es. "2026-06-29".
export function currentWeekKey(now = new Date()) {
  const { y, m, d, weekday } = romeParts(new Date(new Date(now).getTime() + CLOSE_SHIFT_MS));
  const monday = new Date(Date.UTC(y, m - 1, d) - weekday * 86400000);
  return monday.toISOString().slice(0, 10);
}

// Domenica (ultimo giorno valido) della settimana data, es. "2026-07-05".
export function weekSunday(weekKey = currentWeekKey()) {
  const monday = new Date(`${weekKey}T00:00:00Z`);
  return new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
}

// Etichetta leggibile della scadenza: "domenica 5 luglio, ore 23:00".
export function weekEndLabel(weekKey = currentWeekKey()) {
  const sunday = new Date(`${weekSunday(weekKey)}T12:00:00Z`);
  const txt = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long",
  }).format(sunday);
  return `${txt}, ore 23:00`;
}

// Monete Arena date a TUTTI a ogni inizio torneo dal 2° della settimana in poi.
export const ARENA_TOURNAMENT_BONUS = 20;
