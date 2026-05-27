/* ============================================================
   TCG — Tournament mode (single elimination)
   ------------------------------------------------------------
   Singolo documento globale `tcg_tournament/global`:

   {
     status:        "closed" | "open" | "running" | "ended",
     name:          string,
     participants:  { [uid]: { uid, name, deck, cover, classChoice, joinedAt } },
     rounds:        [
       {
         round: 1,
         matches: [
           { id, a, b, winnerUid, matchId, byeFor }
         ]
       }, ...
     ],
     currentRound:  number,           // 0 = non iniziato, ≥1 = round in corso
     champion:      { uid, name }|null,
     createdAt, updatedAt
   }

   Flow:
   - status "closed"  → torneo nascosto per i player (solo master vede)
   - status "open"    → iscrizioni aperte: i player possono iscriversi / ritirarsi
   - status "running" → master ha avviato: bracket generato, partite in corso
   - status "ended"   → c'è un campione

   Le partite del torneo riusano `tcg_matches` (lo stesso doc PvP);
   ogni entry del bracket tiene il matchId della partita corrispondente.
   ============================================================ */

import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp,
  addDoc, collection,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { createGame } from "./engine.js";
import { buildDeck } from "./cards.js";

const TCOL = "tcg_tournament";
const TDOC = "global";
const MCOL = "tcg_matches";

const tref = () => doc(db, TCOL, TDOC);

/* ---------- helpers ---------- */
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function defaultTournamentDoc() {
  return {
    status: "closed",
    name: "Torneo dei Regni",
    participants: {},
    rounds: [],
    currentRound: 0,
    champion: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/* ---------- read / subscribe ---------- */
export function watchTournament(cb) {
  return onSnapshot(tref(), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    cb({ id: snap.id, ...snap.data() });
  }, () => cb(null));
}

export async function getTournamentOnce() {
  const s = await getDoc(tref());
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/* ---------- visibility for players ---------- */
/* When "closed", nasconde l'intera modalità ai giocatori (solo il
   master vede il pulsante). Aperto / in corso / finito → visibile a
   tutti i loggati. */
export function isTournamentVisibleFor(t, isMaster) {
  if (isMaster) return true;
  if (!t) return false;
  return t.status !== "closed";
}

/* ---------- master controls ---------- */
export async function ensureTournamentDoc() {
  const s = await getDoc(tref());
  if (!s.exists()) {
    await setDoc(tref(), defaultTournamentDoc());
  }
}

export async function openRegistration(name) {
  await ensureTournamentDoc();
  await updateDoc(tref(), {
    status: "open",
    name: name || "Torneo dei Regni",
    participants: {},
    rounds: [],
    currentRound: 0,
    champion: null,
    updatedAt: serverTimestamp(),
  });
}

export async function closeRegistration() {
  await ensureTournamentDoc();
  await updateDoc(tref(), {
    status: "closed",
    participants: {},
    rounds: [],
    currentRound: 0,
    champion: null,
    updatedAt: serverTimestamp(),
  });
}

/* Genera bracket round 1 e crea le partite tcg_matches per ogni
   coppia non-bye. Avviabile solo se ci sono ≥ 2 iscritti. */
export async function startTournament() {
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non inizializzato");
  if (t.status !== "open") throw new Error("Le iscrizioni non sono aperte");
  const ids = Object.keys(t.participants || {});
  if (ids.length < 2) throw new Error("Servono almeno 2 iscritti");

  const shuffled = shuffle(ids);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1] || null;
    if (b == null) {
      matches.push({
        id: `R1M${matches.length}`,
        a, b: null,
        winnerUid: a,                // bye → passa il turno
        matchId: null,
        byeFor: a,
      });
    } else {
      const matchId = await createTournamentMatchDoc(
        t.participants[a], t.participants[b], 1
      );
      matches.push({
        id: `R1M${matches.length}`,
        a, b,
        winnerUid: null,
        matchId,
        byeFor: null,
      });
    }
  }

  await updateDoc(tref(), {
    status: "running",
    rounds: [{ round: 1, matches }],
    currentRound: 1,
    champion: null,
    updatedAt: serverTimestamp(),
  });
}

/* Genera il round successivo a partire dai vincitori del round
   corrente. Richiede che TUTTE le match del round corrente abbiano
   un vincitore (o siano bye). Se rimane un solo vincitore →
   chiusura torneo. */
export async function advanceRound() {
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non trovato");
  if (t.status !== "running") throw new Error("Il torneo non è in corso");
  const cur = t.rounds[t.currentRound - 1];
  if (!cur) throw new Error("Round corrente mancante");
  const allDone = cur.matches.every((m) => !!m.winnerUid);
  if (!allDone) throw new Error("Ci sono ancora partite da concludere");

  const winners = cur.matches.map((m) => m.winnerUid);

  if (winners.length === 1) {
    const champUid = winners[0];
    const champ = t.participants[champUid];
    await updateDoc(tref(), {
      status: "ended",
      champion: { uid: champUid, name: champ?.name || "Campione" },
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const nextRoundNo = t.currentRound + 1;
  const ordered = shuffle(winners);
  const matches = [];
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1] || null;
    if (b == null) {
      matches.push({
        id: `R${nextRoundNo}M${matches.length}`,
        a, b: null,
        winnerUid: a,
        matchId: null,
        byeFor: a,
      });
    } else {
      const matchId = await createTournamentMatchDoc(
        t.participants[a], t.participants[b], nextRoundNo
      );
      matches.push({
        id: `R${nextRoundNo}M${matches.length}`,
        a, b,
        winnerUid: null,
        matchId,
        byeFor: null,
      });
    }
  }

  const rounds = t.rounds.slice();
  rounds.push({ round: nextRoundNo, matches });

  await updateDoc(tref(), {
    rounds,
    currentRound: nextRoundNo,
    updatedAt: serverTimestamp(),
  });
}

export async function endTournament() {
  await updateDoc(tref(), {
    status: "ended",
    updatedAt: serverTimestamp(),
  });
}

export async function resetTournament() {
  await setDoc(tref(), defaultTournamentDoc());
}

/* ---------- player actions ---------- */
export async function registerPlayer(uid, name, deck, cover, classChoice) {
  if (!uid) throw new Error("Devi essere loggato");
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non disponibile");
  if (t.status !== "open") throw new Error("Le iscrizioni non sono aperte");
  const entry = {
    uid,
    name: name || "Sfidante",
    deck: Array.isArray(deck) ? deck : null,
    cover: cover || "nature",
    classChoice: classChoice || null,
    joinedAt: Date.now(),
  };
  await updateDoc(tref(), {
    [`participants.${uid}`]: entry,
    updatedAt: serverTimestamp(),
  });
}

export async function withdrawPlayer(uid) {
  const t = await getTournamentOnce();
  if (!t) return;
  if (t.status !== "open") throw new Error("Non puoi ritirarti: il torneo è già iniziato");
  const next = { ...(t.participants || {}) };
  delete next[uid];
  await updateDoc(tref(), {
    participants: next,
    updatedAt: serverTimestamp(),
  });
}

/* ---------- match creation (riusa tcg_matches) ---------- */
async function createTournamentMatchDoc(a, b, roundNo) {
  if (!a || !b) return null;
  const starter = Math.random() < 0.5 ? "p0" : "p1";
  const aClass = a.classChoice || null;
  const bClass = b.classChoice || null;
  const state = createGame({
    p0Name: a.name || "P1",
    p1Name: b.name || "P2",
    deck0: Array.isArray(a.deck) ? a.deck : buildDeck(),
    deck1: Array.isArray(b.deck) ? b.deck : buildDeck(),
    starter,
    p0Class: aClass,
    p1Class: bClass,
  });
  const ref = await addDoc(collection(db, MCOL), {
    status: "active",
    challenger: { uid: a.uid, name: a.name || "P1" },
    challenged: { uid: b.uid, name: b.name || "P2" },
    covers: { p0: a.cover || "nature", p1: b.cover || "nature" },
    classes: { p0: aClass, p1: bClass },
    challengerDeck: Array.isArray(a.deck) ? a.deck : null,
    state,
    tournament: { id: TDOC, round: roundNo },
    winnerUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    seen: {},
  });
  return ref.id;
}

/* Chiamato dal GameTable al termine di una partita-torneo: marca il
   vincitore nel bracket. Idempotente. */
export async function reportMatchResult(matchId, winnerUid) {
  if (!matchId || !winnerUid) return;
  const t = await getTournamentOnce();
  if (!t || t.status !== "running") return;
  const rounds = t.rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) =>
      m.matchId === matchId && !m.winnerUid ? { ...m, winnerUid } : m
    ),
  }));
  await updateDoc(tref(), { rounds, updatedAt: serverTimestamp() });
}

/* ---------- utility per la UI ---------- */
export function isRegistered(t, uid) {
  return !!(t && t.participants && t.participants[uid]);
}

export function currentRoundOf(t) {
  if (!t || !t.rounds || !t.currentRound) return null;
  return t.rounds[t.currentRound - 1] || null;
}

/* Trova il match (nel round corrente) in cui gioca uid; null se nessuno. */
export function myCurrentMatch(t, uid) {
  const r = currentRoundOf(t);
  if (!r) return null;
  return r.matches.find((m) => (m.a === uid || m.b === uid) && !m.winnerUid && m.matchId) || null;
}

/* Tutte le partite passate (vinte/perse) dell'utente. */
export function myHistory(t, uid) {
  if (!t || !t.rounds) return [];
  const out = [];
  for (const r of t.rounds) {
    for (const m of r.matches) {
      if (m.a === uid || m.b === uid) {
        out.push({ round: r.round, ...m });
      }
    }
  }
  return out;
}

export function roundLabel(roundNo, totalRounds) {
  if (!totalRounds || totalRounds <= 0) return `Round ${roundNo}`;
  const remaining = totalRounds - roundNo;
  if (remaining === 0) return "Finale";
  if (remaining === 1) return "Semifinale";
  if (remaining === 2) return "Quarti";
  if (remaining === 3) return "Ottavi";
  return `Round ${roundNo}`;
}

/* Numero totale di round previsti dato il count iniziale di iscritti. */
export function totalRoundsFor(playerCount) {
  if (!playerCount || playerCount < 2) return 0;
  return Math.ceil(Math.log2(playerCount));
}
