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
  addDoc, collection, runTransaction,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { createGame } from "./engine.js";
import { buildDeck, buildClassDeck } from "./cards.js";
import { CLASSES, CLASS_VIE } from "./classes.js";
import { notifyUsers, notifyUser } from "../utils/notify.js";

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

/* ---------- AI participants (filler per numeri dispari) ----------
   L'AI è un participant "sintetico" con uid prefisso "ai_". Quando
   viene accoppiato a un umano, il match non viene creato su Firestore:
   la bracket-entry ha matchId=null e vsAi=true. Il giocatore umano
   apre una partita LOCALE in mode="ai" e il risultato viene poi
   propagato al bracket via reportMatchResult (la match key è
   l'id della bracket entry, prefisso "br_"). */

const AI_NAMES = [
  "Stivalone d'Ottone", "Brivido di Granito", "Sussurro del Vento",
  "Sir Pidocchio", "Tordo Ridens", "Granduca delle Galline",
  "Pugnoduro", "Magus Pettegolo", "Schianta-Sassi",
  "Bibitona Magica", "Drago Pasticcione", "Nano Brillante",
  "Ranocchio Magico", "Plasmaombre", "Ciaccia del Bosco",
  "Forgia-Spiriti", "Spadante Goffo", "Strappazampe",
  "Vento Ululante", "Tom Bombadillo", "Boldo lo Sgualcito",
  "Pupazzone di Burro", "Capitan Tarallo", "Lord Polpetta",
  "Madama Sgrafignosa", "Bardo Stonato", "Cavallone Spelacchiato",
  "Rospo del Mago", "Conte di Cipolla", "Padron Salsiccia",
];

export function randomAiName() {
  return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
}

function randomClassChoice() {
  const klass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
  const vie = Object.keys(CLASS_VIE[klass] || {});
  const via = vie.length > 0 ? vie[Math.floor(Math.random() * vie.length)] : null;
  return { klass, via };
}

function classColorsFor(klass) {
  // mapping minimo classe→colori, coerente con buildClassDeck. Se
  // l'AI gioca classless va comunque bene (deck random colori vari).
  const COLOR_MAP = {
    mago:       ["U", "R"],
    guerriero:  ["W", "R"],
    chierico:   ["W", "G"],
    ladro:      ["B", "U"],
    druido:     ["G", "W"],
  };
  return COLOR_MAP[klass] || ["G", "R"];
}

/* Genera un participant AI completo (deck class-themed, cover, classe). */
export function buildAiParticipant(opts = {}) {
  const cls = opts.classChoice || randomClassChoice();
  const name = opts.name || randomAiName();
  const colors = classColorsFor(cls.klass);
  let deck;
  try {
    deck = buildClassDeck(colors, cls.klass);
  } catch {
    deck = buildDeck();
  }
  const uid = `ai_${Math.random().toString(36).slice(2, 10)}`;
  return {
    uid,
    name,
    deck: Array.isArray(deck) ? deck : null,
    cover: opts.cover || "darkness",
    classChoice: cls,
    isAi: true,
    joinedAt: Date.now(),
  };
}

/* Aggiunge un AI participant al torneo (utilizzabile dal master in
   stato "open"). Restituisce il participant creato. */
export async function addAiParticipant(opts = {}) {
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non disponibile");
  if (t.status !== "open") throw new Error("Le iscrizioni non sono aperte");
  const p = buildAiParticipant(opts);
  await updateDoc(tref(), {
    [`participants.${p.uid}`]: p,
    updatedAt: serverTimestamp(),
  });
  return p;
}

/* Rimuove un AI participant (solo master, solo in open). */
export async function removeAiParticipant(aiUid) {
  const t = await getTournamentOnce();
  if (!t) return;
  if (t.status !== "open") throw new Error("Non puoi rimuovere AI: torneo già avviato");
  if (!aiUid || !aiUid.startsWith("ai_")) throw new Error("UID non AI");
  const next = { ...(t.participants || {}) };
  delete next[aiUid];
  await updateDoc(tref(), {
    participants: next,
    updatedAt: serverTimestamp(),
  });
}

/* True se un participant è un AI bot. */
export function isAiUid(uid) {
  return typeof uid === "string" && uid.startsWith("ai_");
}

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

/* Se il numero di fighter è dispari aggiunge un AI participant
   in coda così le coppie sono sempre pari. Ritorna il nuovo array
   di uid (eventualmente con un uid AI in fondo) + il participants
   map aggiornato. */
async function ensureEvenWithAi(t, ids) {
  if (ids.length % 2 === 0) return { ids, participants: t.participants };
  const ai = buildAiParticipant();
  const newParts = { ...(t.participants || {}), [ai.uid]: ai };
  await updateDoc(tref(), {
    [`participants.${ai.uid}`]: ai,
    updatedAt: serverTimestamp(),
  });
  return { ids: [...ids, ai.uid], participants: newParts };
}

/* Costruisce una bracket-entry per una coppia. Se uno dei due è AI,
   NON crea un documento su tcg_matches: il match si gioca in locale
   sul client umano (mode="ai") e il risultato viene riportato al
   bracket via reportMatchResult con la entry-id. */
async function buildBracketEntry(roundNo, idx, partsMap, a, b) {
  const baseId = `R${roundNo}M${idx}`;
  if (b == null) {
    return { id: baseId, a, b: null, winnerUid: a, matchId: null, byeFor: a, vsAi: false };
  }
  const aIsAi = isAiUid(a);
  const bIsAi = isAiUid(b);
  // edge case: AI vs AI → nessun umano può giocare, sorteggia subito
  // un vincitore così il bracket non si blocca.
  if (aIsAi && bIsAi) {
    const winnerUid = Math.random() < 0.5 ? a : b;
    return {
      id: baseId,
      a, b,
      winnerUid,
      matchId: null,
      byeFor: null,
      vsAi: true,
      aiOnly: true,
    };
  }
  if (aIsAi || bIsAi) {
    // partita umano vs AI: solo locale, niente doc su tcg_matches
    return {
      id: baseId,
      a, b,
      winnerUid: null,
      matchId: null,
      byeFor: null,
      vsAi: true,
      aiUid: aIsAi ? a : b,
      humanUid: aIsAi ? b : a,
    };
  }
  const matchId = await createTournamentMatchDoc(partsMap[a], partsMap[b], roundNo);
  return {
    id: baseId,
    a, b,
    winnerUid: null,
    matchId,
    byeFor: null,
    vsAi: false,
  };
}

/* Notifica i giocatori UMANI che il loro match di un round è pronto.
   Salta i bye (passaggio gratuito), gli AI e i match già conclusi.
   Crea un doc `notifications` per ciascuno → log in-app + push. */
async function notifyRoundReady(matches, roundNo, totalRounds, partsMap) {
  const label = roundLabel(roundNo, totalRounds);
  const nameOf = (uid) => partsMap?.[uid]?.name || "un avversario";
  const entries = [];
  for (const m of matches) {
    if (m.winnerUid) continue; // già risolto (bye/AI-vs-AI)
    const humans = [m.a, m.b].filter((u) => u && !isAiUid(u));
    for (const uid of humans) {
      const oppUid = uid === m.a ? m.b : m.a;
      const oppName = oppUid ? nameOf(oppUid) : null;
      entries.push({
        uid,
        title: "🃏 Torneo TCG — Il tuo match è pronto!",
        message: oppName
          ? `${label}: sfidi ${oppName}. Entra nel torneo e gioca la tua partita!`
          : `${label}: la tua partita ti aspetta. Entra nel torneo!`,
      });
    }
  }
  await notifyUsers(entries);
}

/* Genera bracket round 1 e crea le partite tcg_matches per ogni
   coppia umano-vs-umano. Avviabile solo se ci sono ≥ 2 iscritti.
   Se gli iscritti sono dispari, aggiunge automaticamente un AI bot. */
export async function startTournament() {
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non inizializzato");
  if (t.status !== "open") throw new Error("Le iscrizioni non sono aperte");
  let ids = Object.keys(t.participants || {});
  if (ids.length < 2) throw new Error("Servono almeno 2 iscritti");

  // dispari → aggiungi AI prima di accoppiare
  const evened = await ensureEvenWithAi(t, ids);
  ids = evened.ids;
  const partsMap = evened.participants;

  const shuffled = shuffle(ids);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i];
    const b = shuffled[i + 1] || null;
    const entry = await buildBracketEntry(1, matches.length, partsMap, a, b);
    matches.push(entry);
  }

  await updateDoc(tref(), {
    status: "running",
    rounds: [{ round: 1, matches }],
    currentRound: 1,
    champion: null,
    updatedAt: serverTimestamp(),
  });

  // Avvisa i giocatori che il loro primo match è pronto.
  const totalRounds = totalRoundsFor(ids.length);
  await notifyRoundReady(matches, 1, totalRounds, partsMap);
}

/* Genera il round successivo a partire dai vincitori del round
   corrente. Richiede che TUTTE le match del round corrente abbiano
   un vincitore (o siano bye). Se rimane un solo vincitore →
   chiusura torneo. Se il numero di vincitori è dispari aggiunge
   un nuovo AI participant come filler. */
export async function advanceRound() {
  const t = await getTournamentOnce();
  if (!t) throw new Error("Torneo non trovato");
  if (t.status !== "running") throw new Error("Il torneo non è in corso");
  const cur = t.rounds[t.currentRound - 1];
  if (!cur) throw new Error("Round corrente mancante");
  const allDone = cur.matches.every((m) => !!m.winnerUid);
  if (!allDone) throw new Error("Ci sono ancora partite da concludere");

  let winners = cur.matches.map((m) => m.winnerUid);

  if (winners.length === 1) {
    const champUid = winners[0];
    const champ = t.participants[champUid];
    await updateDoc(tref(), {
      status: "ended",
      champion: { uid: champUid, name: champ?.name || "Campione" },
      updatedAt: serverTimestamp(),
    });
    // Notifica personale al campione (il broadcast "X è campione" a tutti
    // è gestito dalla Cloud Function pushOnTcgTournamentUpdate).
    await notifyUser(
      champUid,
      "🏆 Campione del Torneo TCG!",
      `${champ?.name || "Campione"}, hai vinto il ${t.name || "Torneo dei Regni"}! La tua leggenda è scritta.`,
    );
    return;
  }

  // dispari → aggiungi AI come filler così le coppie sono sempre pari
  let partsMap = t.participants;
  if (winners.length % 2 !== 0) {
    const ai = buildAiParticipant();
    partsMap = { ...partsMap, [ai.uid]: ai };
    await updateDoc(tref(), {
      [`participants.${ai.uid}`]: ai,
      updatedAt: serverTimestamp(),
    });
    winners = [...winners, ai.uid];
  }

  const nextRoundNo = t.currentRound + 1;
  const ordered = shuffle(winners);
  const matches = [];
  for (let i = 0; i < ordered.length; i += 2) {
    const a = ordered[i];
    const b = ordered[i + 1] || null;
    const entry = await buildBracketEntry(nextRoundNo, matches.length, partsMap, a, b);
    matches.push(entry);
  }

  const rounds = t.rounds.slice();
  rounds.push({ round: nextRoundNo, matches });

  await updateDoc(tref(), {
    rounds,
    currentRound: nextRoundNo,
    updatedAt: serverTimestamp(),
  });

  // Avvisa i giocatori che il loro match del nuovo round è pronto.
  const round1 = t.rounds[0]?.matches || [];
  const initialSlots = round1.reduce((n, m) => n + 1 + (m.b != null ? 1 : 0), 0);
  const totalRounds = totalRoundsFor(initialSlots);
  await notifyRoundReady(matches, nextRoundNo, totalRounds, partsMap);
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
    // Mulligan: ciascuno fino a 2 reshuffle, poi commit. GameTable
    // gated finché entrambi committano.
    mulligan: {
      p0: { used: 0, committed: false },
      p1: { used: 0, committed: false },
    },
    tournament: { id: TDOC, round: roundNo },
    winnerUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    seen: {},
  });
  return ref.id;
}

/* Ricrea il doc tcg_matches di una entry del bracket il cui doc è stato
   CANCELLATO (relitto del bug del timer 3h ancorato al createdAt: allo
   scadere, il client del challenger cancellava il doc e il bracket restava
   con un matchId che punta nel vuoto → rimbalzo immediato fuori dal match).
   setDoc con lo STESSO id della entry, così il bracket resta coerente.
   Il chiamante diventa challenger: le regole Firestore richiedono
   challenger.uid == auth.uid per la create (i lati p0/p1 possono quindi
   risultare invertiti rispetto al doc originale — irrilevante). */
export async function recreateTournamentMatchDoc(matchId, uid) {
  if (!matchId || !uid) return false;
  const t = await getTournamentOnce();
  if (!t || t.status !== "running") return false;
  const cur = t.rounds?.[t.currentRound - 1];
  if (!cur) return false;
  const entry = cur.matches.find(
    (m) => m.matchId === matchId && !m.winnerUid && !m.vsAi
  );
  if (!entry) return false;
  if (entry.a !== uid && entry.b !== uid) return false;
  const foeUid = entry.a === uid ? entry.b : entry.a;
  const me = t.participants?.[uid];
  const foe = t.participants?.[foeUid];
  if (!me || !foe) return false;

  const mref = doc(db, MCOL, matchId);
  // già ricreato dall'avversario nel frattempo? non sovrascrivere.
  const existing = await getDoc(mref);
  if (existing.exists()) return true;

  const starter = Math.random() < 0.5 ? "p0" : "p1";
  const state = createGame({
    p0Name: me.name || "P1",
    p1Name: foe.name || "P2",
    deck0: Array.isArray(me.deck) ? me.deck : buildDeck(),
    deck1: Array.isArray(foe.deck) ? foe.deck : buildDeck(),
    starter,
    p0Class: me.classChoice || null,
    p1Class: foe.classChoice || null,
  });
  await setDoc(mref, {
    status: "active",
    challenger: { uid: me.uid, name: me.name || "P1" },
    challenged: { uid: foe.uid, name: foe.name || "P2" },
    covers: { p0: me.cover || "nature", p1: foe.cover || "nature" },
    classes: { p0: me.classChoice || null, p1: foe.classChoice || null },
    challengerDeck: Array.isArray(me.deck) ? me.deck : null,
    state,
    mulligan: {
      p0: { used: 0, committed: false },
      p1: { used: 0, committed: false },
    },
    tournament: { id: TDOC, round: cur.round },
    winnerUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    seen: {},
  });
  return true;
}

/* Chiamato al termine di una partita-torneo: marca il vincitore nel
   bracket. Idempotente.
   - Per match PvP: matchOrEntryId è il doc id su tcg_matches.
   - Per match vs AI (locale): matchOrEntryId è l'entry.id del bracket
     (es: "R1M2"), perché non esiste un doc su Firestore. */
export async function reportMatchResult(matchOrEntryId, winnerUid) {
  if (!matchOrEntryId || !winnerUid) return;
  // Transazione: rilegge il torneo DENTRO la transaction e scrive solo se
  // la entry non ha ancora un vincitore. Senza questo, due client che
  // segnalano in concorrenza (o in disaccordo dopo un "Reclama vittoria"/
  // disconnessione incrociata) generavano una lost-update race: l'ultima
  // updateDoc riscriveva l'INTERO array rounds partendo da uno snapshot
  // stale e poteva RIBALTARE il vincitore già registrato → il bracket
  // sembrava "dare la vittoria a entrambi". Ora il PRIMO risultato
  // registrato è definitivo e idempotente.
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tref());
    if (!snap.exists()) return;
    const t = snap.data();
    if (t.status !== "running") return;
    let matched = false;
    let alreadyDecided = false;
    const rounds = (t.rounds || []).map((r) => ({
      ...r,
      matches: (r.matches || []).map((m) => {
        // È la entry giusta? (PvP per matchId Firestore, AI per entry id)
        const isThis =
          (m.matchId && m.matchId === matchOrEntryId) ||
          (!m.matchId && m.vsAi && m.id === matchOrEntryId);
        if (!isThis) return m;
        matched = true;
        // Già deciso (dall'avversario o dal master): NON sovrascrivere.
        if (m.winnerUid) {
          alreadyDecided = true;
          return m;
        }
        return { ...m, winnerUid };
      }),
    }));
    // Nessuna scrittura se non ho trovato la entry o era già decisa:
    // evita conflitti/aborti di transazione inutili.
    if (!matched || alreadyDecided) return;
    tx.update(tref(), { rounds, updatedAt: serverTimestamp() });
  }).catch(() => {});
}

/* MASTER ONLY: forza un vincitore su un match del round corrente.
   Utile quando un giocatore non si presenta o il client si pianta:
   il torneo non si blocca aspettando un risultato che non arriva.
   - bracketEntryId: l'id dell'entry (es. "R1M2")
   - winnerUid: chi vince fra m.a e m.b
   - se la entry ha matchId, anche il doc tcg_matches viene marcato
     come "finished" così il giocatore vede uscire il match. */
export async function forceFinishMatch(bracketEntryId, winnerUid) {
  if (!bracketEntryId || !winnerUid) throw new Error("Parametri mancanti");
  const t = await getTournamentOnce();
  if (!t || t.status !== "running") throw new Error("Torneo non in corso");

  let touched = false;
  let firestoreMatchId = null;
  let matchPlayers = null;
  const rounds = t.rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => {
      if (m.id !== bracketEntryId) return m;
      if (m.winnerUid) return m;
      if (winnerUid !== m.a && winnerUid !== m.b) {
        throw new Error("Il vincitore deve essere uno dei due partecipanti");
      }
      touched = true;
      firestoreMatchId = m.matchId || null;
      matchPlayers = { a: m.a, b: m.b };
      return { ...m, winnerUid, forcedByMaster: true };
    }),
  }));
  if (!touched) throw new Error("Match non trovato o già concluso");

  await updateDoc(tref(), { rounds, updatedAt: serverTimestamp() });

  // Avvisa i giocatori umani del verdetto del master (specie il perdente,
  // che potrebbe essere ancora in attesa della partita).
  if (matchPlayers) {
    const nameOf = (uid) => t.participants?.[uid]?.name || "il tuo avversario";
    const entries = [matchPlayers.a, matchPlayers.b]
      .filter((u) => u && !isAiUid(u))
      .map((uid) => {
        const won = uid === winnerUid;
        return {
          uid,
          title: won ? "🃏 Torneo TCG — Passi il turno!" : "🃏 Torneo TCG — Match assegnato",
          message: won
            ? "Il Master ti ha assegnato la vittoria del match. Avanzi nel torneo!"
            : `Il Master ha assegnato il match a ${nameOf(winnerUid)}. La tua corsa nel torneo finisce qui.`,
        };
      });
    await notifyUsers(entries);
  }

  // Se la entry aveva un doc su tcg_matches, chiudilo così l'avversario
  // viene buttato fuori dalla partita e non resta in limbo.
  if (firestoreMatchId) {
    try {
      const mref = doc(db, MCOL, firestoreMatchId);
      await updateDoc(mref, {
        status: "finished",
        winnerUid,
        forcedByMaster: true,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // se la rule non lo permette o il doc non esiste pace, il bracket è
      // già stato aggiornato e basta per progredire il torneo.
    }
  }
}

/* MASTER ONLY: risolve tutti i match pendenti del round corrente
   sorteggiando un vincitore. Utile quando metà player ha mollato. */
export async function forceFinishAllPending() {
  const t = await getTournamentOnce();
  if (!t || t.status !== "running") throw new Error("Torneo non in corso");
  const cur = t.rounds[t.currentRound - 1];
  if (!cur) throw new Error("Round corrente mancante");

  const pending = cur.matches.filter((m) => !m.winnerUid);
  if (pending.length === 0) return 0;

  for (const m of pending) {
    if (!m.a || !m.b) continue;
    const winnerUid = Math.random() < 0.5 ? m.a : m.b;
    try {
      await forceFinishMatch(m.id, winnerUid);
    } catch {
      // continua con gli altri se uno fallisce
    }
  }
  return pending.length;
}

/* ---------- utility per la UI ---------- */
export function isRegistered(t, uid) {
  return !!(t && t.participants && t.participants[uid]);
}

export function currentRoundOf(t) {
  if (!t || !t.rounds || !t.currentRound) return null;
  return t.rounds[t.currentRound - 1] || null;
}

/* Trova il match (nel round corrente) in cui gioca uid; null se nessuno.
   Include sia i match PvP (con matchId Firestore) che quelli vs AI
   (vsAi=true, matchId=null, si gioca localmente). */
export function myCurrentMatch(t, uid) {
  const r = currentRoundOf(t);
  if (!r) return null;
  return r.matches.find((m) =>
    (m.a === uid || m.b === uid) &&
    !m.winnerUid &&
    (m.matchId || m.vsAi)
  ) || null;
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
