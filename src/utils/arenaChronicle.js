// ── Arena · cronache dei match ───────────────────────────────────────────────
// Ogni match concluso (torneo, finale, sfide libere, contro l'IA) viene salvato
// per intero in `arena_chronicles/{matchId}`: giocatori, esito e TUTTE le righe
// della cronaca (con la versione per attaccante e difensore e la traccia dei PF).
// Così si rilegge anche quando il match sparisce da arena_meta (pulizia delle
// sfide libere, reset del torneo).
// Conservazione: ognuno tiene la cronaca di un match per altri 7 match, cioè le
// sue ultime CHRONICLE_KEEP. `keepFor` = giocatori umani che la tengono ancora;
// quando esce dalle ultime 8 di tutti, si cancella.
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";

export const CHRONICLE_KEEP = 8; // il match + altri 7
const COLL = "arena_chronicles";
const isBotId = (id) => typeof id === "string" && id.startsWith("AI_BOT_");

const lastLogTs = (m) => (m.logs || []).reduce((mx, l) => {
  const t = l && typeof l === "object" && l.ts ? Date.parse(l.ts) : NaN;
  return Number.isFinite(t) ? Math.max(mx, t) : mx;
}, 0);

export function chronicleFromMatch(m, snaps = {}) {
  const humans = (m.players || []).map(p => p.id).filter(id => id && !isBotId(id) && id !== m.aiId);
  const finishedTs = lastLogTs(m) || Date.now();
  const winnerP = (m.players || []).find(p => p.id === m.winner);
  return {
    matchId: m.matchId,
    kind: m.kind || "tournament",
    group: m.group ?? null,
    ai: !!m.ai,
    winner: m.winner || null,
    winnerName: winnerP?.name || snaps[m.winner]?.name || null,
    players: (m.players || []).map(p => {
      const s = snaps[p.id] || {};
      return {
        id: p.id,
        name: p.name || s.name || "?",
        class: p.class || s.class || "",
        image: s.image || null,
        maxHp: s.stats?.maxHp ?? p.maxHp ?? null,
        hpEnd: Number.isFinite(Number(p.hp)) ? Number(p.hp) : null,
      };
    }),
    participantIds: (m.players || []).map(p => p.id).filter(Boolean),
    keepFor: humans,
    startedAt: m.fightStartAt || m.createdAt || null,
    finishedAt: new Date(finishedTs).toISOString(),
    logs: m.logs || [],
  };
}

// Salva (una volta) e poi sfoltisce le cronache dei partecipanti.
export async function saveChronicle(m, snaps) {
  if (!m?.matchId) return false;
  const ref = doc(db, COLL, m.matchId);
  const ex = await getDoc(ref);
  if (ex.exists()) return false;
  const data = chronicleFromMatch(m, snaps);
  await setDoc(ref, data);
  for (const uid of data.keepFor) {
    try { await pruneChronicles(uid); } catch (e) { console.warn("[arena] pulizia cronache:", e); }
  }
  return true;
}

export async function loadChronicles(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, COLL), where("keepFor", "array-contains", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
}

export async function pruneChronicles(uid) {
  const list = await loadChronicles(uid);
  for (const c of list.slice(CHRONICLE_KEEP)) {
    const rest = (c.keepFor || []).filter(x => x !== uid);
    if (rest.length === 0) await deleteDoc(doc(db, COLL, c.id));
    else await updateDoc(doc(db, COLL, c.id), { keepFor: arrayRemove(uid) });
  }
}

// Il Master le vede tutte (anche i match dove non ha combattuto).
export async function loadAllChronicles() {
  const snap = await getDocs(collection(db, COLL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
}
