// ── La borsa del PG all'Officina (2026-09-22) ───────────────────────────────
// I materiali si pagano PRIMA di tirare: l'oro esce subito dalla borsa, così
// nessuno può mettersi al banco senza averne. Il controllo sta sia nella UI
// (bottone spento) sia DENTRO la transazione del tiro, che è quella che conta.
//
// `characters.currency` è lo SPECCHIO della scheda Foundry: la macro di
// sincronizzazione lo riscrive da capo a ogni sync, quindi il sito non lo tocca
// mai. Tiene invece un contatore a parte, `crafting.goldPending`: le monete già
// spese all'Officina e NON ancora scalate sull'attore di Foundry.
//
//     disponibile = tutte le monete (in mo) − crafting.goldPending
//
// AUTOMATICO (2026-10-03): al tiro la spesa entra DA SOLA nella coda di
// Foundry (`foundry_inbox`, `kind: "gold"`, `pendingOnSite: true`) e la voce
// del registro porta `goldInboxId` + `goldAuto: true`. Resta in `goldPending`
// finché la macro "Crea Oggetti dal sito → Foundry" non la scala davvero:
// allora la macro, nello stesso colpo, scrive su `characters/{uid}` il nuovo
// `currency.gp` e toglie l'importo da `goldPending`. Il giocatore vede l'oro
// scalato dal momento del tiro, senza salti all'indietro.
// Le spese di prima (senza `goldAuto`) seguono la vecchia regola: escono da
// `goldPending` quando il Master le manda o le segna "già pagate".

// TUTTE LE VALUTE (2026-10-27): prima contava solo `currency.gp` e chi aveva
// platino o argento risultava al verde. Ora la borsa vale la somma di tutte le
// monete (1 mp = 10 mo, 1 me = ½ mo, 1 ma = 1/10, 1 mr = 1/100) e la spesa in
// sospeso si toglie come la paga la macro "Fetch admin" (`pagaDa`): prima
// l'oro, poi argento e rame, poi elettro e platino, spezzando una moneta e
// dando il resto in mo/ma/mr. I conti si fanno in RAME, così niente decimali.
export const COINS = ["pp", "gp", "ep", "sp", "cp"];
export const COIN_CP = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
export const COIN_LABEL = { pp: "mp", gp: "mo", ep: "me", sp: "ma", cp: "mr" };
const PAY_ORDER = ["gp", "sp", "cp", "ep", "pp"];

// {pp, gp, ep, sp, cp} interi ≥ 0 da un `currency` qualsiasi.
export const coinsOf = (currency) => Object.fromEntries(COINS.map((k) => [k, Math.max(0, Math.floor(Number(currency?.[k]) || 0))]));
export const coinsCp = (coins) => COINS.reduce((a, k) => a + (coins?.[k] || 0) * COIN_CP[k], 0);
// "3 mp · 120 mo · 5 ma"
export const fmtCoins = (coins) => COINS.filter((k) => coins?.[k]).map((k) => `${coins[k]} ${COIN_LABEL[k]}`).join(" · ") || "nessuna moneta";

// Toglie `cp` rame dalle monete (copia), come la macro; `missing` = quanto non bastava.
export function payCoins(coins, cp) {
  const m = coinsOf(coins);
  let need = Math.max(0, Math.round(Number(cp) || 0));
  for (const k of PAY_ORDER) {
    const n = Math.min(m[k], Math.floor(need / COIN_CP[k]));
    m[k] -= n; need -= n * COIN_CP[k];
  }
  if (need > 0) {
    const k = ["cp", "sp", "ep", "gp", "pp"].find((x) => m[x] > 0 && COIN_CP[x] >= need);
    if (k) {
      m[k] -= 1;
      let rest = COIN_CP[k] - need;
      need = 0;
      for (const r of ["gp", "sp", "cp"]) { const n = Math.floor(rest / COIN_CP[r]); m[r] += n; rest -= n * COIN_CP[r]; }
    }
  }
  return { coins: m, missing: need };
}

// Valore della scheda in mo (tutte le valute, arrotondato per difetto).
export const sheetGp = (charData) => Math.floor(coinsCp(coinsOf(charData?.currency)) / 100);
export const goldPending = (crafting) => Math.max(0, Number(crafting?.goldPending) || 0);

// Scheda mai sincronizzata da Foundry: `currency` non c'è proprio. In quel caso
// NON si blocca nessuno (sarebbe un muro per chi non ha ancora fatto il sync):
// si avvisa e basta.
export const hasPurse = (charData) =>
  !!charData?.currency && COINS.some((k) => charData.currency[k] !== undefined && charData.currency[k] !== null);

// Le monete che restano davvero, tolta la spesa già fatta al banco.
export const availableCoins = (charData) =>
  payCoins(coinsOf(charData?.currency), goldPending(charData?.crafting) * 100).coins;

// Valore spendibile adesso in mo, al netto di quel che è già stato speso al banco.
export const availableGp = (charData) => Math.floor(coinsCp(availableCoins(charData)) / 100);

// Il PG può permettersi la spesa? Il Master non paga mai (crea a piacere).
// `unknown: true` = scheda senza oro sincronizzato: si passa, ma con avviso.
export function canAfford(charData, costMo, { isMaster = false } = {}) {
  const cost = Math.max(0, Math.round(Number(costMo) || 0));
  const have = availableGp(charData);
  const pending = goldPending(charData?.crafting);
  if (isMaster) return { ok: true, master: true, cost, have, pending, missing: 0, unknown: false };
  if (!hasPurse(charData)) return { ok: true, cost, have: 0, pending, missing: 0, unknown: true };
  return { ok: have >= cost, cost, have, pending, missing: Math.max(0, cost - have), unknown: false };
}

// Stessa verifica sui dati LETTI NELLA TRANSAZIONE (snapshot fresco), così
// due schede aperte in parallelo non spendono due volte lo stesso oro.
export function affordFromSnapshot(data, costMo) {
  if (!hasPurse(data)) return { ok: true, unknown: true, have: 0, missing: 0 };
  const have = availableGp(data);
  const cost = Math.max(0, Math.round(Number(costMo) || 0));
  return { ok: have >= cost, unknown: false, have, missing: Math.max(0, cost - have) };
}

// Chiude la spesa di UNA prova: le sue monete escono da `goldPending` una volta
// sola. Idempotente: se la voce risulta già chiusa o sparita il contatore non
// si muove.
// Spese automatiche (`goldAuto`): restano in sospeso finché la macro non le
// scala, quindi si chiudono qui SOLO se il documento è ancora in coda
// (`queued: true`, cioè lo stiamo togliendo noi: la prova viene cancellata).
// Se la macro l'ha già scalata, ci ha già pensato lei.
export function pendingAfterClose(crafting, entryId, { queued = false } = {}) {
  const log = Array.isArray(crafting?.log) ? crafting.log : [];
  const e = log.find((x) => x?.id === entryId);
  const pend = goldPending(crafting);
  if (!e) return pend;
  const cost = Math.max(0, Number(e.costMo) || 0);
  if (e.goldAuto) return queued ? Math.max(0, pend - cost) : pend;
  if (e.goldInboxId || e.goldDone) return pend;
  return Math.max(0, pend - cost);
}
