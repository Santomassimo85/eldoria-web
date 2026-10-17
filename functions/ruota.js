// ── La Ruota di Exanthia, lato server (2026-10-17) ───────────────────────────
// Il giro lo decide SOLO il server: ora, giorno (Europe/Rome), spicchio e dadi.
// Un giro al giorno per account = doc `ruota_spins/{giorno}_{uid}` creato in
// transazione (regole: nessuno lo scrive dal client), quindi orologio del
// telefono, logout, ricarica, due schede o `characters.ruota` ritoccato a mano
// non fanno rigirare. Solo il Master principale gira senza limiti.
// SPICCHI = copia di SEGMENTS in src/data/ruotaExanthia.js: tenerli allineati
// (stesso ordine, stessi pesi, stessi dadi) — il client controlla la `key`.
const crypto = require("crypto");

const MAIN_MASTER_EMAIL = "santomassimo85@gmail.com";

const P = {
  d4: { key: "d4", dice: [1, 4], label: "1d4 Corone" },
  d6: { key: "d6", dice: [1, 6], label: "1d6 Corone" },
  d2x4: { key: "d2x4", dice: [2, 4], label: "2d4 Corone" },
  d8: { key: "d8", dice: [1, 8], label: "1d8 Corone" },
  foto: { key: "foto", label: "Foto con il Master", w: 1, special: true },
};
const R = { key: "riprova", label: "Riprova domani" };
const N = { key: "nulla", label: "Nulla" };
const Q = { key: "quasi", label: "Quasi!" };

const SEGMENTS = [
  P.d4, R, R,
  P.d6, N, R,
  P.d4, R, R,
  P.d2x4, Q, R,
  P.d4, N, R,
  P.d6, N, R,
  P.d4, R, Q,
  P.d8, R, P.foto,
];
const weight = (s) => s.w ?? 4;
const TOTAL_W = SEGMENTS.reduce((t, s) => t + weight(s), 0);

const randInt = (max) => crypto.randomInt(max);

function pickSegment() {
  let r = randInt(TOTAL_W);
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= weight(SEGMENTS[i]);
    if (r < 0) return i;
  }
  return SEGMENTS.length - 1;
}

// "2026-10-17" nel giorno di calendario italiano (come craftDayKey).
function romeDayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function spinResult() {
  const idx = pickSegment();
  const seg = SEGMENTS[idx];
  const rolls = seg.dice ? Array.from({ length: seg.dice[0] }, () => randInt(seg.dice[1]) + 1) : [];
  const amount = rolls.reduce((s, x) => s + x, 0);
  return {
    idx,
    key: seg.key,
    label: seg.label,
    dice: seg.dice ? seg.label.replace(" Corone", "") : null,
    rolls,
    amount,
    special: !!seg.special,
    win: amount > 0 || !!seg.special,
  };
}

module.exports = { MAIN_MASTER_EMAIL, SEGMENTS, romeDayKey, spinResult };
