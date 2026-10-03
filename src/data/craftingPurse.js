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
//     oro disponibile = currency.gp − crafting.goldPending
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

// Si ragiona in MONETE D'ORO come la macro (`system.currency.gp`): platino,
// argento e rame non entrano nel conto, si cambiano al tavolo.

export const sheetGp = (charData) => Math.max(0, Number(charData?.currency?.gp) || 0);
export const goldPending = (crafting) => Math.max(0, Number(crafting?.goldPending) || 0);

// Scheda mai sincronizzata da Foundry: `currency` non c'è proprio. In quel caso
// NON si blocca nessuno (sarebbe un muro per chi non ha ancora fatto il sync):
// si avvisa e basta.
export const hasPurse = (charData) =>
  !!charData?.currency && charData.currency.gp !== undefined && charData.currency.gp !== null;

// Oro spendibile adesso, al netto di quel che è già stato speso al banco.
export const availableGp = (charData) =>
  Math.max(0, sheetGp(charData) - goldPending(charData?.crafting));

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
  const cur = data?.currency || null;
  if (!cur || cur.gp === undefined || cur.gp === null) return { ok: true, unknown: true, have: 0, missing: 0 };
  const have = Math.max(0, (Number(cur.gp) || 0) - goldPending(data?.crafting));
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
