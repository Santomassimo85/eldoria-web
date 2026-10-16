// ── La Ruota di Exanthia (2026-10-16) ─────────────────────────────────────────
// Un giro al giorno (giorno di calendario, ora italiana). La ruota è ONESTA:
// si pesca uno spicchio a caso fra i 24 e ogni spicchio vale uguale, quindi le
// probabilità sono esattamente quelle che si vedono sulla ruota.
//   1d4 Corone  4/24 ≈ 17%      1d6 Corone  2/24 ≈ 8%
//   2d4 Corone  1/24 ≈ 4%       1d8 Corone  1/24 ≈ 4%
//   niente     16/24 ≈ 67%  (soprattutto "Riprova domani")
// Media ≈ 1,1 Corone al giorno. Le Corone sono `characters.platinum` (Mercato Nero).

export const PRIZES = {
  d4:   { key: "d4",   dice: [1, 4], label: "1d4 Corone", short: "1d4 👑", tier: 1 },
  d6:   { key: "d6",   dice: [1, 6], label: "1d6 Corone", short: "1d6 👑", tier: 2 },
  d2x4: { key: "d2x4", dice: [2, 4], label: "2d4 Corone", short: "2d4 👑", tier: 3 },
  d8:   { key: "d8",   dice: [1, 8], label: "1d8 Corone", short: "1d8 👑", tier: 3 },
};

const R = { key: "riprova", short: "Riprova domani", tier: 0 };
const N = { key: "nulla", short: "Nulla", tier: 0 };
const Q = { key: "quasi", short: "Quasi!", tier: 0 };

// Ordine sulla ruota, in senso orario dall'alto: un premio ogni tre spicchi,
// i "Quasi!" accanto ai premi migliori.
export const SEGMENTS = [
  PRIZES.d4, R, R,
  PRIZES.d6, N, R,
  PRIZES.d4, R, R,
  PRIZES.d2x4, Q, R,
  PRIZES.d4, N, R,
  PRIZES.d6, N, R,
  PRIZES.d4, R, Q,
  PRIZES.d8, R, N,
];

export const SEG_DEG = 360 / SEGMENTS.length;

// Riepilogo per la tabella dei premi (dal raro al comune).
export function prizeOdds() {
  const count = (k) => SEGMENTS.filter((s) => s.key === k).length;
  const n = SEGMENTS.length;
  const rows = [PRIZES.d8, PRIZES.d2x4, PRIZES.d6, PRIZES.d4].map((p) => ({ ...p, slots: count(p.key) }));
  const empty = SEGMENTS.filter((s) => !s.dice).length;
  return { n, rows, empty };
}

// Numero casuale vero (non Math.random) in [0, max).
export function randInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

export function rollDice([count, faces]) {
  const rolls = Array.from({ length: count }, () => randInt(faces) + 1);
  return { rolls, total: rolls.reduce((s, x) => s + x, 0) };
}

// Frasi per gli spicchi vuoti: la ruota ti prende in giro.
export const EMPTY_LINES = [
  "La ruota cigola, rallenta… e si ferma sul niente. Riprova domani.",
  "Exanthia oggi non ha voglia di regalare nulla. Riprova domani.",
  "Un corvo si posa sulla ruota e ride. Riprova domani.",
  "Le dita del destino ti hanno sfiorato e se ne sono andate. Riprova domani.",
  "Il banco vince sempre. Quasi sempre. Riprova domani.",
  "Niente Corone, ma almeno hai fatto girare il braccio. Riprova domani.",
  "Lo spicchio era vuoto come le tasche di un bardo. Riprova domani.",
  "La fortuna ti ha visto arrivare e ha cambiato strada. Riprova domani.",
];

export const WIN_LINES = {
  1: "Qualche Corona tintinna nella tua borsa.",
  2: "Un bel mucchietto di Corone: il Mercato Nero ti aspetta.",
  3: "La ruota si inchina: oggi Exanthia sorride proprio a te!",
};

// Millisecondi alla prossima mezzanotte italiana (nuovo giro).
export function msToRomeMidnight(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const done = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
  return Math.max(0, (86400 - done) * 1000);
}
