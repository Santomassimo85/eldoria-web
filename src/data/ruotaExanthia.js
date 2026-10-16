// ── La Ruota di Exanthia (2026-10-16) ─────────────────────────────────────────
// Un giro al giorno (giorno di calendario, ora italiana). La ruota è ONESTA:
// ogni spicchio è largo quanto il suo peso (`w`, normale = 4) e si pesca in
// proporzione al peso, quindi le probabilità sono esattamente quelle che si vedono.
//   1d4 Corone  16/93 ≈ 17%     1d6 Corone   8/93 ≈ 9%
//   2d4 Corone   4/93 ≈ 4%      1d8 Corone   4/93 ≈ 4%
//   📸 Foto con il Master  1/93 ≈ 1%  (spicchio sottile: il premio più raro)
//   niente      60/93 ≈ 65%  (soprattutto "Riprova domani")
// Media ≈ 1,1 Corone al giorno. Le Corone sono `characters.platinum` (Mercato Nero).

export const PRIZES = {
  d4:   { key: "d4",   dice: [1, 4], label: "1d4 Corone", short: "1d4 👑", tier: 1 },
  d6:   { key: "d6",   dice: [1, 6], label: "1d6 Corone", short: "1d6 👑", tier: 2 },
  d2x4: { key: "d2x4", dice: [2, 4], label: "2d4 Corone", short: "2d4 👑", tier: 3 },
  d8:   { key: "d8",   dice: [1, 8], label: "1d8 Corone", short: "1d8 👑", tier: 3 },
  // Niente Corone: si riscuote al tavolo, dal Master.
  foto: { key: "foto", label: "Foto con il Master", short: "📸", tier: 4, w: 1, special: true },
};

const W = 4; // peso di uno spicchio normale
const weight = (s) => s.w ?? W;

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
  PRIZES.d8, R, PRIZES.foto,
];

const TOTAL_W = SEGMENTS.reduce((t, s) => t + weight(s), 0);
const DEG_PER_W = 360 / TOTAL_W;

// Geometria degli spicchi in gradi (dall'alto, senso orario): il primo è
// centrato in cima, gli altri seguono ognuno largo quanto il suo peso.
export const SEG_GEOM = SEGMENTS.reduce((acc, s) => {
  const start = acc.length ? acc[acc.length - 1].end : -(weight(SEGMENTS[0]) * DEG_PER_W) / 2;
  const span = weight(s) * DEG_PER_W;
  acc.push({ start, span, center: start + span / 2, end: start + span });
  return acc;
}, []);

// Riepilogo per la tabella dei premi (dal raro al comune).
export function prizeOdds() {
  const pct = (sel) => (SEGMENTS.filter(sel).reduce((t, s) => t + weight(s), 0) / TOTAL_W) * 100;
  const isEmpty = (s) => !s.dice && !s.special;
  const rows = [PRIZES.foto, PRIZES.d8, PRIZES.d2x4, PRIZES.d6, PRIZES.d4].map((p) => ({
    ...p,
    slots: SEGMENTS.filter((s) => s.key === p.key).length,
    pct: pct((s) => s.key === p.key),
  }));
  return { n: SEGMENTS.length, rows, emptySlots: SEGMENTS.filter(isEmpty).length, emptyPct: pct(isEmpty) };
}

// Pesca uno spicchio in proporzione al suo peso.
export function pickSegment() {
  let r = randInt(TOTAL_W);
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= weight(SEGMENTS[i]);
    if (r < 0) return i;
  }
  return SEGMENTS.length - 1;
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
  4: "Lo spicchio più sottile della ruota! Hai vinto una foto con il Master: reclamala al prossimo tavolo.",
};

// Millisecondi alla prossima mezzanotte italiana (nuovo giro).
export function msToRomeMidnight(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now).map((x) => [x.type, x.value]));
  const done = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second);
  return Math.max(0, (86400 - done) * 1000);
}
