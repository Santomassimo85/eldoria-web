// ── Settimana del Crafting ───────────────────────────────────────────────────
// Le prove di crafting dell'Officina valgono 1 al giorno e al massimo 3 a settimana.
// La settimana si azzera OGNI DOMENICA ALLE 22:00 (ora italiana, Europe/Rome):
// la chiave della settimana è la data della domenica in cui è iniziata (alle 22:00).
// Il "giorno" invece è il giorno di calendario italiano (mezzanotte → mezzanotte).
// Niente job di svuotamento: quando la chiave cambia, i contatori vecchi non valgono più.

export const CRAFT_MAX_PER_DAY = 1;
export const CRAFT_MAX_PER_WEEK = 3;
export const CRAFT_RESET_HOUR = 22; // domenica, ore 22:00

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Componenti della data in Europe/Rome.
function romeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    y: +get("year"), m: +get("month"), d: +get("day"),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    h: +get("hour") % 24, min: +get("minute"),
  };
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Giorno corrente ("YYYY-MM-DD", ora italiana).
export function craftDayKey(now = new Date()) {
  const { y, m, d } = romeParts(now);
  return iso(Date.UTC(y, m - 1, d));
}

// Settimana corrente: la domenica (ore 22:00) in cui è iniziata, es. "2026-09-13".
// Domenica prima delle 22:00 si è ancora nella settimana precedente.
export function craftWeekKey(now = new Date()) {
  const { y, m, d, weekday, h } = romeParts(now);
  const today = Date.UTC(y, m - 1, d);
  let back = weekday; // giorni dalla domenica
  if (weekday === 0 && h < CRAFT_RESET_HOUR) back = 7; // domenica prima delle 22 → domenica scorsa
  return iso(today - back * 86400000);
}

// Istante del prossimo reset (domenica successiva alle 22:00, ora italiana) come Date.
export function craftNextReset(now = new Date()) {
  const wk = craftWeekKey(now);
  const sunday = new Date(`${wk}T00:00:00Z`);
  const next = new Date(sunday.getTime() + 7 * 86400000); // domenica successiva (UTC 00:00)
  // 22:00 di Roma: calcolo l'offset di Roma in quel giorno.
  const probe = new Date(`${next.toISOString().slice(0, 10)}T22:00:00Z`);
  const romeHour = +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(probe) % 24;
  const offsetH = (romeHour - 22 + 24) % 24; // 1 o 2 ore avanti rispetto a UTC
  return new Date(probe.getTime() - offsetH * 3600000);
}

// Etichetta: "domenica 20 settembre, ore 22:00".
export function craftResetLabel(now = new Date()) {
  const t = craftNextReset(now);
  const txt = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long",
  }).format(t);
  return `${txt}, ore 22:00`;
}

// Stato dei limiti a partire dal sotto-oggetto `crafting` del personaggio.
export function craftAllowance(crafting = {}, now = new Date()) {
  const weekKey = craftWeekKey(now);
  const dayKey = craftDayKey(now);
  const weekCount = crafting.weekKey === weekKey ? (Number(crafting.weekCount) || 0) : 0;
  const usedToday = crafting.lastDayKey === dayKey;
  const weekLeft = Math.max(0, CRAFT_MAX_PER_WEEK - weekCount);
  return {
    weekKey, dayKey, weekCount, weekLeft, usedToday,
    can: !usedToday && weekLeft > 0,
    reason: usedToday ? "Hai già creato oggi: torna domani."
      : weekLeft <= 0 ? `Hai usato le ${CRAFT_MAX_PER_WEEK} prove della settimana: si azzerano ${craftResetLabel(now)}.`
      : "",
  };
}
