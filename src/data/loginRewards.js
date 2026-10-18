// ── Premi del login quotidiano (2026-10-18) ──────────────────────────────────
// Copia delle tappe di functions/loginRewards.js (il server decide e paga):
// tenerle allineate. Qui servono solo per mostrare cosa si è vinto e cosa manca.
const STEPS = [
  { n: 1, amount: 2 },
  { n: 3, amount: 2 },
  { n: 5, amount: 3 },
  { n: 7, amount: 3 },
  { n: 10, amount: 6, nice: true },
  { n: 14, amount: 3 },
  { n: 18, amount: 4 },
  { n: 22, amount: 4 },
  { n: 25, amount: 5 },
];
const BIG_AMOUNT = 15;
const BIG_SLACK = 2;

export const MONTHS_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

export const daysInMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
export function milestones(month) {
  return [...STEPS, { n: daysInMonth(month) - BIG_SLACK, amount: BIG_AMOUNT, big: true }];
}
export const monthLabel = (month) => MONTHS_IT[Number(month.split("-")[1]) - 1] || month;
/** Mese (YYYY-MM) di oggi a Roma, dall'ora che gli passi. */
export function romeMonthKey(t = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" }).format(new Date(t)).slice(0, 7);
}
/** Stato del mese dai dati del personaggio: login fatti e tappe. */
export function loginState(lr, month) {
  const count = lr?.month === month ? (lr.count || 0) : 0;
  const steps = milestones(month).map((s) => ({ ...s, done: count >= s.n }));
  const next = steps.find((s) => !s.done) || null;
  return { count, steps, next, won: steps.filter((s) => s.done).reduce((a, s) => a + s.amount, 0) };
}
