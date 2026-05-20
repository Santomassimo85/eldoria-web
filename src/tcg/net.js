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
              ((m.status === "active" && m.state) ||
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

export async function createChallenge(uid, name, deck, cover) {
  const ref = await addDoc(collection(db, COL), {
    status: "open",
    challenger: { uid, name: name || "Sfidante" },
    challenged: null,
    covers: { p0: cover || "nature" },
    challengerDeck: Array.isArray(deck) ? deck : null,
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

export async function acceptChallenge(match, uid, name, deck, cover) {
  const ref = doc(db, COL, match.id);
  const fresh = await getDoc(ref);
  if (!fresh.exists() || fresh.data().status !== "open") return null;
  const data = fresh.data();

  const starter = Math.random() < 0.5 ? "p0" : "p1";
  const state = createGame({
    p0Name: match.challenger.name,
    p1Name: name || "Ospite",
    deck0: Array.isArray(data.challengerDeck) ? data.challengerDeck : buildDeck(),
    deck1: Array.isArray(deck) ? deck : buildDeck(),
    starter,
  });

  await updateDoc(ref, {
    status: "active",
    challenged: { uid, name: name || "Ospite" },
    covers: { p0: data.covers?.p0 || "nature", p1: cover || "nature" },
    state,
    updatedAt: serverTimestamp(),
    seen: { p0: serverTimestamp(), p1: serverTimestamp() },
  });
  return match.id;
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
