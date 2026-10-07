// ── Bacheca: party e limite di UNA missione ogni quindicina per gruppo (2 al mese) ─────────────
// Unica fonte per Bacheca.jsx e QuestDetail.jsx (prima ognuna aveva il suo
// roster, con nomi diversi: "Garroth" vs "Garroth Tel´Arion").
import { db } from "../firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

export const PARTY_ROSTER = {
  "AMEA": ["Tanagar", "Garroth Tel´Arion", "Garroth", "Caius Maxis-Richtofen"],
  "ENOX": ["Makenna", "Temistocle Sottocolle Milo", "Lael", "Palar"],
  "LAC":  ["Horn", "Thinkle Muschioverde", "Cleofe"],
  "LEAF": ["Soran", "Zethir Nightwhisper", "Zethir", "Aksel", "Dago"],
};

export const NO_PARTY = "Senza Gruppo";

export const getPartyByCharName = (name) => {
  for (const [party, members] of Object.entries(PARTY_ROSTER)) {
    if (members.includes(name)) return party;
  }
  return NO_PARTY;
};

// ── Periodo = QUINDICINA (2026-10-07: prima era il mese) ──
// Una missione per gruppo ogni quindicina fissa di calendario, a Roma:
// giorni 1–15 → "2026-10-1", dal 16 a fine mese → "2026-10-2". Quindi 2 al mese.
// (I nomi questMonthKey/nextMonthLabel restano per non toccare chi li usa.)
const romeYMD = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get("year"), m: get("month"), d: get("day") };
};

export const questMonthKey = (date = new Date()) => {
  const { y, m, d } = romeYMD(date);
  return `${y}-${String(m).padStart(2, "0")}-${d <= 15 ? 1 : 2}`;
};

// Inizio della prossima quindicina: "16 ottobre" oppure "1 novembre".
export const nextMonthLabel = (date = new Date()) => {
  const { y, m, d } = romeYMD(date);
  const next = d <= 15
    ? new Date(Date.UTC(y, m - 1, 16, 12))
    : new Date(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1, 12));
  return next.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "Europe/Rome" });
};

// Chi "consuma" la missione del mese: il gruppo, o il singolo se non ha gruppo.
export const questSlotOf = (charName, party) =>
  party && party !== NO_PARTY ? `party:${party}` : `char:${charName}`;

// Il sigillo del mese vive in quest_month_locks/{slot}_{mese}, NON sulla missione:
// se il Master cancella la missione finita, il gruppo non si ritrova il posto
// libero a metà mese. Lo toglie solo il "Rilascia" di quella stessa missione.
export const questLockId = (slot, month = questMonthKey()) =>
  `${slot}_${month}`.replace(/[\/\s]+/g, "-");

export const questLockRef = (slot, month) => doc(db, "quest_month_locks", questLockId(slot, month));

export class QuestLimitError extends Error {
  constructor(code, lock) {
    super(code === "limit"
      ? `Il gruppo ha già preso la missione di questa quindicina: "${lock?.questTitle || "?"}". La prossima dal ${nextMonthLabel()}.`
      : "Questa missione è già stata presa da qualcun altro.");
    this.code = code;
    this.lock = lock;
  }
}

// Accetta in transazione: rifiuta se la missione è già presa o se il gruppo ha
// già il sigillo del mese su un'altra missione. Il Master non consuma il sigillo.
export async function acceptQuest({ questId, charName, isMaster }) {
  const party = getPartyByCharName(charName);
  const slot  = questSlotOf(charName, party);
  const month = questMonthKey();
  const questRef = doc(db, "quests", questId);
  const lockRef  = questLockRef(slot, month);

  await runTransaction(db, async (tx) => {
    const qSnap = await tx.get(questRef);
    const lSnap = isMaster ? null : await tx.get(lockRef);
    if (!qSnap.exists()) throw new QuestLimitError("taken");
    const quest = qSnap.data();
    if (quest.acceptedBy) throw new QuestLimitError("taken");
    if (lSnap?.exists() && lSnap.data().questId !== questId) {
      throw new QuestLimitError("limit", lSnap.data());
    }
    tx.update(questRef, {
      acceptedBy:    charName,
      acceptedParty: party,
      status:        "in_progress",
      acceptedAt:    serverTimestamp(),
      acceptedMonth: isMaster ? null : month,
      acceptedSlot:  isMaster ? null : slot,
    });
    if (!isMaster) {
      tx.set(lockRef, {
        slot, month, party, questId,
        questTitle: quest.title || "",
        by: charName,
        at: serverTimestamp(),
      });
    }
  });
  return { party, slot };
}

// Rilascia: libera la missione e, se era lei a tenere il sigillo del mese, lo toglie.
export async function releaseQuest(quest) {
  const questRef = doc(db, "quests", quest.id);
  const lockRef  = quest.acceptedSlot && quest.acceptedMonth
    ? questLockRef(quest.acceptedSlot, quest.acceptedMonth) : null;

  await runTransaction(db, async (tx) => {
    const lSnap = lockRef ? await tx.get(lockRef) : null;
    tx.update(questRef, {
      acceptedBy: null, acceptedParty: null, status: "available",
      acceptedAt: null, acceptedMonth: null, acceptedSlot: null,
    });
    if (lSnap?.exists() && lSnap.data().questId === quest.id) tx.delete(lockRef);
  });
}
