/* ============================================================
   TCG — ONLINE PvP  (Firestore real-time backend)
   ------------------------------------------------------------
   Real-time sync uses Firestore onSnapshot (this stack has no
   WebSocket server — Firestore IS the real-time channel).

   Collection: tcg_matches/{matchId}
   {
     status:     "open" | "active" | "ended",
     challenger: { uid, name },          // plays side "p0"
     challenged: { uid, name } | null,   // plays side "p1"
     state:      <engine state> | null,
     createdAt, updatedAt: serverTimestamp,
     seen:       { p0: ts, p1: ts },     // presence heartbeats
   }

   Field names match the ALREADY-DEPLOYED firestoreRules.txt
   (tcg_matches): any logged-in user reads; create requires
   challenger.uid == auth.uid (or master); update open to any
   logged-in user; delete by challenger/master.
   ============================================================ */

import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { createGame } from "./engine.js";
import { buildDeck } from "./cards.js";
import { notifyUser } from "../utils/notify.js";

const COL = "tcg_matches";
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // open challenges expire after 5 min
const DISCONNECT_MS = 45 * 1000; // no heartbeat for 45s => opponent gone

const tsMillis = (t) =>
  t && typeof t.toMillis === "function" ? t.toMillis() : t ? +new Date(t) : 0;

export function sideForUid(match, uid) {
  if (!match) return null;
  if (match.challenger && match.challenger.uid === uid) return "p0";
  if (match.challenged && match.challenged.uid === uid) return "p1";
  return null;
}

/* ---- lobby stream ----
   cb({ open: [...], mine: matchOrNull, online: number }) */
export function watchLobby(uid, cb) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const all = [];
      snap.forEach((d) => all.push({ id: d.id, ...d.data() }));

      const open = all.filter(
        (m) =>
          m.status === "open" &&
          m.challenger &&
          now - tsMillis(m.createdAt) < CHALLENGE_TTL_MS
      );

      // a match the current user is already part of — but ONLY a usable
      // one, so stale/broken docs (half-accepted `active` with no state,
      // or long-finished `ended` ones) never trap a player on the
      // "Connessione alla partita…" spinner. The master account, having
      // done all the testing, accumulates many of these.
      const RECENT_END_MS = 3 * 60 * 1000;
      const mine =
        all
          .filter(
            (m) =>
              sideForUid(m, uid) !== null &&
              // "active" conta come mio SOLO se lo stato è davvero giocabile
              // (ha entrambi i player). Un doc active con state rotto/parziale
              // intrappolava il giocatore in "Caricamento partita…" senza
              // mai lasciarlo tornare a creare/accettare sfide.
              ((m.status === "active" &&
                m.state &&
                m.state.players &&
                m.state.players.p0 &&
                m.state.players.p1) ||
                (m.status === "ended" &&
                  now - tsMillis(m.updatedAt || m.createdAt) < RECENT_END_MS))
          )
          .sort(
            (a, b) =>
              tsMillis(b.updatedAt || b.createdAt) -
              tsMillis(a.updatedAt || a.createdAt)
          )[0] || null;

      // approximate "online": distinct users seen in fresh docs (last 2 min)
      const onlineSet = new Set();
      for (const m of all) {
        const fresh =
          now - tsMillis(m.updatedAt || m.createdAt) < 2 * 60 * 1000;
        if (!fresh) continue;
        if (m.challenger) onlineSet.add(m.challenger.uid);
        if (m.challenged) onlineSet.add(m.challenged.uid);
      }

      cb({ open, mine, online: onlineSet.size });
    },
    () => cb({ open: [], mine: null, online: 0, error: true })
  );
}

export async function createChallenge(uid, name, deck, cover, classChoice) {
  const ref = await addDoc(collection(db, COL), {
    status: "open",
    challenger: { uid, name: name || "Sfidante" },
    challenged: null,
    covers: { p0: cover || "nature" },
    challengerDeck: Array.isArray(deck) ? deck : null,
    // class identity (fixed) + chosen via for this match. Persisted in
    // the doc so the responder & engine can build a proper game.
    classes: classChoice ? { p0: classChoice } : null,
    state: null,
    winnerUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    seen: {},
  });
  return ref.id;
}

export async function cancelChallenge(matchId) {
  try {
    await deleteDoc(doc(db, COL, matchId));
  } catch {
    /* may already be gone / accepted */
  }
}

export async function acceptChallenge(match, uid, name, deck, cover, classChoice) {
  const ref = doc(db, COL, match.id);
  const fresh = await getDoc(ref);
  if (!fresh.exists() || fresh.data().status !== "open") return null;
  const data = fresh.data();

  const starter = Math.random() < 0.5 ? "p0" : "p1";
  const p0Class = data.classes?.p0 || null;
  const p1Class = classChoice || null;
  const state = createGame({
    p0Name: match.challenger.name,
    p1Name: name || "Ospite",
    deck0: Array.isArray(data.challengerDeck) ? data.challengerDeck : buildDeck(),
    deck1: Array.isArray(deck) ? deck : buildDeck(),
    starter,
    p0Class,
    p1Class,
  });

  await updateDoc(ref, {
    status: "active",
    challenged: { uid, name: name || "Ospite" },
    covers: { p0: data.covers?.p0 || "nature", p1: cover || "nature" },
    classes: { p0: p0Class, p1: p1Class },
    state,
    // Mulligan: ciascun giocatore può rimescolare fino a 2 volte e poi
    // commit. Il GameTable resta gated finché entrambi hanno committato.
    mulligan: {
      p0: { used: 0, committed: false },
      p1: { used: 0, committed: false },
    },
    updatedAt: serverTimestamp(),
    seen: { p0: serverTimestamp(), p1: serverTimestamp() },
  });

  // Avvisa lo sfidante che la sua sfida è stata accettata: potrebbe
  // essersi allontanato dopo aver creato la sfida aperta.
  notifyUser(
    match.challenger?.uid,
    "🃏 Sfida accettata!",
    `${name || "Un avversario"} ha accettato la tua sfida a Eldoria TCG. Torna al tavolo, la partita è iniziata!`,
  );

  return match.id;
}

/* MULLIGAN — aggiorna SOLO i campi del side rimescolato (hand + deck +
   instance seq) e l'used count. Usa dot-notation così un reshuffle
   contemporaneo dell'avversario sull'altro side non si sovrascrive. */
export async function pushMulliganReshuffle(matchId, side, newState, newUsed) {
  const newHand = newState?.players?.[side]?.hand ?? [];
  const newDeck = newState?.players?.[side]?.deck ?? [];
  const newSeqInst = newState?._seq?.inst ?? 0;
  await updateDoc(doc(db, COL, matchId), {
    [`state.players.${side}.hand`]: newHand,
    [`state.players.${side}.deck`]: newDeck,
    [`state._seq.inst`]: newSeqInst,
    [`mulligan.${side}.used`]: newUsed,
    updatedAt: serverTimestamp(),
  });
}

/* MULLIGAN — il giocatore commit-a la mano attuale. Quando entrambi
   p0 e p1 sono committed, il GameTable si sblocca. */
export async function pushMulliganCommit(matchId, side) {
  await updateDoc(doc(db, COL, matchId), {
    [`mulligan.${side}.committed`]: true,
    updatedAt: serverTimestamp(),
  });
}

/* Segna l'istante di VERO inizio partita (entrambi i mulligan committati).
   Il timer dei 3h di GameTable parte da qui, NON dal createdAt del doc:
   i match del torneo vengono creati su tcg_matches quando il master avvia
   il round, anche giorni prima che i due giocatori si siedano a giocare.
   Ancorare la scadenza al createdAt espelleva all'istante chiunque
   entrasse in un match più vecchio di 3 ore. */
export async function markMatchStarted(matchId) {
  try {
    await updateDoc(doc(db, COL, matchId), {
      startedAt: serverTimestamp(),
    });
  } catch {
    /* offline / doc removed */
  }
}

/* Riporta in gioco un match torneo rimasto "ended" SENZA vincitore: è il
   relitto del bug del timer ancorato al createdAt (o di un'uscita forzata
   da un match bloccato). Rinnova anche startedAt, così il timer dei 3 ore
   riparte da ora e i giocatori possono davvero giocare la partita che il
   bracket sta ancora aspettando. */
export async function reviveMatch(matchId) {
  try {
    await updateDoc(doc(db, COL, matchId), {
      status: "active",
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* offline / doc removed */
  }
}

export function watchMatch(matchId, cb) {
  return onSnapshot(doc(db, COL, matchId), (d) => {
    if (!d.exists()) return cb(null);
    cb({ id: d.id, ...d.data() });
  });
}

export async function pushState(matchId, state) {
  const patch = { state, updatedAt: serverTimestamp() };
  if (state.winner) patch.status = "ended";
  await updateDoc(doc(db, COL, matchId), patch);
}

export async function sendEmote(matchId, side, text) {
  try {
    await updateDoc(doc(db, COL, matchId), {
      emote: { side, text, ts: Date.now() },
    });
  } catch {
    /* offline */
  }
}

/* Reazione a una carta: emoji "appiccicato" alla carta {instId} (creatura
   in campo, manufatto, o carta in mano dell'avversario). Usato il ts per
   far scattare l'animazione anche se l'utente reagisce due volte alla
   stessa carta con lo stesso emoji. */
export async function sendCardReaction(matchId, side, instId, emoji) {
  try {
    await updateDoc(doc(db, COL, matchId), {
      cardReact: { side, instId, emoji, ts: Date.now() },
    });
  } catch {
    /* offline */
  }
}

export async function heartbeat(matchId, side) {
  try {
    await updateDoc(doc(db, COL, matchId), {
      [`seen.${side}`]: serverTimestamp(),
    });
  } catch {
    /* offline / doc removed */
  }
}

/* true if the opponent's heartbeat is stale */
export function opponentGone(match, mySide) {
  if (!match || match.status !== "active" || !match.seen) return false;
  const other = mySide === "p0" ? "p1" : "p0";
  const last = tsMillis(match.seen[other]);
  if (!last) return false;
  return Date.now() - last > DISCONNECT_MS;
}

export async function deleteMatch(matchId) {
  try {
    await deleteDoc(doc(db, COL, matchId));
  } catch {
    /* not the host / already gone */
  }
}

/* Abbandona un match in modo robusto, da QUALSIASI lato.
   Lo sfidante (p0) può cancellare il doc; lo sfidato (p1) no (le regole
   Firestore permettono delete solo all'host/master), perciò se il delete
   fallisce segniamo il match come "ended". In entrambi i casi il match
   smette di essere "active" e la lobby non ri-trascina più dentro nessuno. */
export async function leaveMatch(matchId) {
  try {
    await deleteDoc(doc(db, COL, matchId));
    return;
  } catch {
    /* non sei l'host → prova a chiuderlo invece */
  }
  try {
    await updateDoc(doc(db, COL, matchId), {
      status: "ended",
      updatedAt: serverTimestamp(),
    });
  } catch {
    /* offline / permessi negati */
  }
}
