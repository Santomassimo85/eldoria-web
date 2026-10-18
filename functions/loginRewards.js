// ── Premi del login quotidiano (2026-10-18) ──────────────────────────────────
// Ogni giorno (Europe/Rome) in cui il giocatore apre l'app conta come un login
// del MESE. A certe tappe il server paga Corone (`characters.platinum`).
// Il conto lo tiene SOLO il server in `login_days/{mese}_{uid}` (regole: nessun
// client lo scrive), così orologio del telefono o `characters.loginRewards`
// ritoccato a mano non danno premi in più.
// TAPPE = copia di src/data/loginRewards.js: tenerle allineate.
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
const BIG_SLACK = 2; // "un mese intero, o anche 2 giorni di meno"

const daysInMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
function milestones(month) {
  return [...STEPS, { n: daysInMonth(month) - BIG_SLACK, amount: BIG_AMOUNT, big: true }];
}

module.exports = { milestones, daysInMonth };
