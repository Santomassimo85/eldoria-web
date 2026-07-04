// ── Settimana Arena (vetrina del market) ─────────────────────────────────────
// La settimana va da lunedì 00:00 a domenica 24:00, ora italiana (Europe/Rome).
// Gli acquisti del market valgono dal momento dell'acquisto fino alla fine
// della settimana in cui sono stati fatti: la chiave della settimana è la data
// del lunedì ("YYYY-MM-DD"). Non serve nessun job di svuotamento: a lunedì la
// chiave cambia e gli acquisti della settimana precedente smettono di contare.

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

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
  const { y, m, d, weekday } = romeParts(now);
  const monday = new Date(Date.UTC(y, m - 1, d) - weekday * 86400000);
  return monday.toISOString().slice(0, 10);
}

// Domenica (ultimo giorno valido) della settimana data, es. "2026-07-05".
export function weekSunday(weekKey = currentWeekKey()) {
  const monday = new Date(`${weekKey}T00:00:00Z`);
  return new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);
}

// Etichetta leggibile della scadenza: "domenica 5 luglio, ore 24:00".
export function weekEndLabel(weekKey = currentWeekKey()) {
  const sunday = new Date(`${weekSunday(weekKey)}T12:00:00Z`);
  const txt = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long",
  }).format(sunday);
  return `${txt}, ore 24:00`;
}
