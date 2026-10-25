import { db } from "../firebase";
import { collection, doc, getDocs, increment, runTransaction, serverTimestamp } from "firebase/firestore";
import { isHiddenChar } from "./hiddenPlayers";
import { marketItemToFoundryPayload } from "../utils/foundryMap";
import { PARTY_MEMBERS } from "./partyMembers";
import { cleanRewards } from "../pages/WorldBossRewards";

/* ============================================================
   Consegna dei premi del World Boss (2026-10-21)
   - PE, monete (mo) e Corone a TUTTI i PG attivi che stanno in un gruppo
     (AMEA, LEAF, ENOX…), anche a chi non ha attaccato (2026-10-25,
     scelta dell'utente). Inattivi (hiddenPlayers) e senza gruppo no.
   - ATTACCANTE = chi ha attaccato il boss almeno MIN_ATTACKS volte
     (`battle_meta/turn_tracker.attackCounts[bossId][uid]`, colpi e mancati).
   - Ogni OGGETTO del bottino esce in UNA copia per gruppo e la prende un
     attaccante a caso di quel gruppo. Un attaccante senza gruppo finisce in
     "Altri", che conta come un gruppo.
   Tutto in UNA transazione che segna `rewardsDelivered` sul boss: due
   schede del Master o il bottone del pannello non consegnano due volte.
   Oggetti, monete e PE vanno in `foundry_inbox` (li porta "Fetch admin");
   le Corone sono `characters.platinum`, solo sul sito.
   ============================================================ */

export const MIN_ATTACKS = 2;
export const NO_PARTY = "ALTRI";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Nome proprio → gruppo, da partyMembers.js (lo stesso elenco della pagina Party).
const PARTY_BY_FIRST_NAME = Object.entries(PARTY_MEMBERS).reduce((acc, [party, list]) => {
  if (party === "Unico") return acc;
  list.forEach((m) => { acc[norm(m.name)] = party; });
  return acc;
}, {});
const KNOWN_PARTIES = Object.keys(PARTY_MEMBERS).filter((p) => p !== "Unico");

// Gruppo di un personaggio: campo `party` sulla scheda (es. "Leaf"), altrimenti il primo nome.
export const partyOfChar = (c) => {
  const p = String(c?.party || "").toUpperCase();
  if (KNOWN_PARTIES.includes(p)) return p;
  return PARTY_BY_FIRST_NAME[norm(String(c?.name || "").split(/\s+/)[0])] || NO_PARTY;
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Piano della consegna (puro: niente scritture). counts = attackCounts[bossId],
// charsById = tutte le schede. participants = chi prende PE/mo/Corone.
export function planBossRewards(rewardsData, counts, charsById) {
  const r = cleanRewards(rewardsData || {});
  const hero = (uid) => {
    const c = charsById[uid];
    return { uid, name: c.name || "Eroe", party: partyOfChar(c), attacks: Number(counts?.[uid]) || 0 };
  };
  const attackers = Object.entries(counts || {})
    .filter(([uid, n]) => (Number(n) || 0) >= MIN_ATTACKS && charsById[uid])
    .map(([uid]) => hero(uid));
  const members = Object.keys(charsById)
    .filter((uid) => !isHiddenChar({ id: uid, ...charsById[uid] }) && partyOfChar(charsById[uid]) !== NO_PARTY)
    .map(hero);
  const participants = [...members, ...attackers.filter((a) => !members.some((m) => m.uid === a.uid))];
  const byParty = attackers.reduce((acc, p) => { (acc[p.party] = acc[p.party] || []).push(p); return acc; }, {});
  const items = [];
  r.items.forEach((item) => {
    Object.entries(byParty).forEach(([party, members]) => {
      const w = pickRandom(members);
      items.push({ item, party, uid: w.uid, name: w.name });
    });
  });
  return { rewards: r, participants, items, parties: Object.keys(byParty) };
}

/**
 * Consegna i premi di un boss. Ritorna il riepilogo, oppure
 * { already: true } se erano già stati consegnati, { empty: true } se nessuno
 * ha attaccato abbastanza.
 */
export async function deliverBossRewards(bossId, createdBy = "") {
  // Tutte le schede (le transazioni web non leggono query): servono per
  // sapere chi sta in un gruppo. Le Corone usano increment, quindi una
  // lettura fuori dalla transazione non fa perdere niente.
  const allChars = {};
  (await getDocs(collection(db, "characters"))).forEach((s) => { allChars[s.id] = s.data(); });
  return runTransaction(db, async (tx) => {
    const bossRef = doc(db, "bosses", bossId);
    const bossSnap = await tx.get(bossRef);
    if (!bossSnap.exists()) throw new Error("Boss non trovato.");
    const boss = bossSnap.data();
    if (boss.rewardsDelivered) return { already: true, ...boss.rewardsDelivered };

    const rr = cleanRewards(boss.rewardsData || {});
    if (!rr.xp && !rr.gp && !rr.corone && !rr.items.length) return { nothing: true };

    const turnSnap = await tx.get(doc(db, "battle_meta", "turn_tracker"));
    const counts = turnSnap.data()?.attackCounts?.[bossId] || {};
    const plan = planBossRewards(boss.rewardsData, counts, allChars);
    if (!plan.participants.length) return { empty: true };

    const r = plan.rewards;
    const why = `Vittoria su ${boss.name || "il World Boss"}`;
    const base = { status: "pending", origin: "worldboss", bossId, bossName: boss.name || "", createdBy, createdAt: serverTimestamp() };
    const put = (data) => tx.set(doc(collection(db, "foundry_inbox")), { ...base, ...data });

    plan.participants.forEach((p) => {
      if (r.gp > 0) put({
        kind: "gold", op: "add", currency: "gp", amount: r.gp,
        name: `+${r.gp} mo · ${why}`, reason: why,
        target: "player", targetUid: p.uid, targetName: p.name,
      });
      if (r.xp > 0) put({
        // stato a parte: le "Fetch admin" vecchie (solo "pending") lo scambierebbero per un oggetto
        kind: "xp", status: "pending_xp", amount: r.xp,
        name: `+${r.xp} PE · ${why}`, reason: why,
        target: "player", targetUid: p.uid, targetName: p.name,
      });
      if (r.corone > 0) tx.update(doc(db, "characters", p.uid), { platinum: increment(r.corone) });
    });

    plan.items.forEach(({ item, uid, name, party }) => {
      const payload = marketItemToFoundryPayload({ ...item, price: item.price }, { target: "player", targetUid: uid, targetName: name });
      payload.description = `${payload.description || ""}\n\n${why} · bottino del gruppo ${party === NO_PARTY ? "" : party}`.trim();
      put({ ...payload, party });
    });

    const summary = {
      at: new Date().toISOString(),
      by: createdBy,
      xp: r.xp, gp: r.gp, corone: r.corone,
      participants: plan.participants.map(({ uid, name, party, attacks }) => ({ uid, name, party, attacks })),
      items: plan.items.map(({ item, uid, name, party }) => ({ item: item.name, uid, name, party })),
    };
    tx.update(bossRef, { rewardsDelivered: summary });
    return summary;
  });
}

// Testo per chat/notifica: chi ha preso cosa.
export function deliverySummaryText(s) {
  if (!s || s.nothing) return "";
  if (s.empty) return "Nessun eroe nei gruppi: niente premi da consegnare.";
  const who = (s.participants || []).map((p) => p.name.split(" ")[0]).join(", ");
  const coins = [s.xp && `${s.xp} PE`, s.gp && `${s.gp} mo`, s.corone && `${s.corone} Corone`].filter(Boolean).join(", ");
  const loot = (s.items || []).map((i) => `${i.item} → ${i.name.split(" ")[0]}${i.party && i.party !== NO_PARTY ? ` (${i.party})` : ""}`).join(" · ");
  return [coins && `${coins} a: ${who}.`, loot && `Bottino: ${loot}.`].filter(Boolean).join(" ");
}
