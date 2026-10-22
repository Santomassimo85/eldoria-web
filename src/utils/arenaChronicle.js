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
  doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, orderBy, limit, arrayRemove,
} from "firebase/firestore";
import { db } from "../firebase";

export const CHRONICLE_KEEP = 8; // il match + altri 7
const COLL = "arena_chronicles";
const isBotId = (id) => typeof id === "string" && id.startsWith("AI_BOT_");

// Gli id dei match del torneo si RIPETONO ogni settimana (GA_R1_M0, FINAL_M0…):
// usati come id della cronaca, il primo torneo restava salvato per sempre e i
// successivi venivano saltati ("esiste già"). L'id della cronaca aggiunge quindi
// l'istante d'inizio del match (prima riga con orario, o readyAt/createdAt) e i
// giocatori, così ogni match ha la sua.
const firstLogTs = (m) => (m.logs || []).reduce((mn, l) => {
  const t = l && typeof l === "object" && l.ts ? Date.parse(l.ts) : NaN;
  return Number.isFinite(t) && (!mn || t < mn) ? t : mn;
}, 0);
export function chronicleId(m) {
  if (!m?.matchId) return null;
  if (String(m.matchId).startsWith("FUN_")) return m.matchId; // già unico
  const start = Date.parse(m.readyAt || m.fightStartAt || m.createdAt || "") || firstLogTs(m);
  const who = (m.players || []).map(p => String(p.id || "").slice(0, 6)).join("-");
  return `${m.matchId}__${start || "x"}__${who}`;
}

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
    chronicleId: chronicleId(m),
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
  const id = chronicleId(m);
  if (!id) return false;
  const ref = doc(db, COLL, id);
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

// Il giocatore tiene le sue ultime 8; il documento NON si cancella più, perché il
// Master deve poter rileggere ogni match per cercare errori (vista "Tutte").
export async function pruneChronicles(uid) {
  const list = await loadChronicles(uid);
  for (const c of list.slice(CHRONICLE_KEEP)) {
    await updateDoc(doc(db, COLL, c.id), { keepFor: arrayRemove(uid) });
  }
}

// Il Master le vede tutte (anche i match dove non ha combattuto), le più recenti prima.
export const CHRONICLE_ALL_MAX = 300;
export async function loadAllChronicles() {
  const snap = await getDocs(query(collection(db, COLL), orderBy("finishedAt", "desc"), limit(CHRONICLE_ALL_MAX)));
  // una cronaca col vecchio id (= matchId) e la stessa col nuovo: si tiene la nuova
  const fresh = new Set(snap.docs.filter(d => d.data().chronicleId).map(d => `${d.data().matchId}|${d.data().finishedAt}`));
  return snap.docs.filter(d => d.data().chronicleId || !fresh.has(`${d.data().matchId}|${d.data().finishedAt}`))
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.finishedAt || "").localeCompare(String(a.finishedAt || "")));
}
