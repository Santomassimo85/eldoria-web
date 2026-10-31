/* ============================================================
   SFIDE FRA GIOCATORI (2026-10-31) — pet_matches/{id}
   { a, b (uid), aName, bName, status: pending|active|done|declined|cancelled,
     teams: {p: [pet…], e: [pet…]}   (p = chi sfida, e = lo sfidato),
     battle (stato del motore, senza log), events (righe dell'ultimo turno),
     seq (turni risolti), actions: {p, e} (scelte in attesa), seed,
     winner: "p" | "e", forfeit, createdAt, updatedAt }
   Ognuno manda la sua azione; chi completa la coppia risolve il turno
   DENTRO la transazione con dadi a seme (seed + seq): lo stesso turno dà
   lo stesso esito ovunque e due schede non lo risolvono due volte.
   I cambi forzati (pet a terra) li manda solo chi deve cambiare.
   I premi li ritira ognuno per sé (recordPvpResult in petDen.js).
   ============================================================ */

import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { newBattle, playTurn, withSeed } from "../data/petEngine";
import { denOf } from "./petDen";

const ref = (id) => doc(db, "pet_matches", id);
const clean = (o) => JSON.parse(JSON.stringify(o)); // Firestore non vuole undefined
const teamOf = (den) => den.team.map((id) => den.pets.find((p) => p.id === id)).filter(Boolean).map(clean);
const notify = (userId, title, message) =>
  addDoc(collection(db, "notifications"), { userId, title, message, read: false, timestamp: serverTimestamp() }).catch(() => {});

// Lati che devono ancora scegliere in questo momento.
export function neededSides(m) {
  if (m?.status !== "active" || !m.battle || m.battle.over) return [];
  return m.battle.needSwitch ? m.battle.needSwitch.split("") : ["p", "e"];
}
export const sidesOf = (m, uid) => [m.a === uid && "p", m.b === uid && "e"].filter(Boolean);
// Lato per cui questo utente deve scegliere adesso (null = tocca all'altro).
export function pendingSide(m, uid) {
  const mine = sidesOf(m, uid);
  return neededSides(m).find((sd) => mine.includes(sd) && !m.actions?.[sd]) || null;
}

export async function createChallenge({ uid, name, den, foeUid, foeName }) {
  const team = teamOf(den);
  if (!team.length) throw new Error("Metti almeno un pet in squadra.");
  const r = await addDoc(collection(db, "pet_matches"), {
    a: uid, b: foeUid, aName: name, bName: foeName, status: "pending",
    teams: { p: team, e: [] }, actions: {}, seq: 0, seed: Math.floor(Math.random() * 1e9),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  if (foeUid !== uid) notify(foeUid, "🐾 Sfida al Rifugio dei Pet", `${name} ti sfida a una lotta fra pet! Accetta dal Rifugio → Sfide.`);
  return r.id;
}

export function acceptChallenge(id, uid) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref(id));
    const m = s.data();
    if (!m || m.status !== "pending") throw new Error("La sfida non è più in attesa.");
    if (m.b !== uid) throw new Error("Questa sfida non è per te.");
    const cs = await tx.get(doc(db, "characters", uid));
    const team = teamOf(denOf(cs.data()));
    if (!team.length) throw new Error("Metti almeno un pet in squadra.");
    const battle = newBattle(m.teams.p, team, { pvp: true, names: { p: m.aName, e: m.bName } });
    const start = [{ kind: "info", text: `${m.aName} manda in campo ${battle.sides.p.team[0].name}!` }, { kind: "info", text: `${m.bName} manda in campo ${battle.sides.e.team[0].name}!` }];
    delete battle.log;
    tx.update(ref(id), clean({ status: "active", teams: { p: m.teams.p, e: team }, battle, events: start, seq: 0, actions: {}, updatedAt: serverTimestamp() }));
    return m;
  }).then((m) => { if (m.a !== m.b) notify(m.a, "🐾 Sfida accettata", `${m.bName} ha accettato la tua sfida: tocca a voi!`); });
}

export const declineChallenge = (id) => updateDoc(ref(id), { status: "declined", updatedAt: serverTimestamp() });
export const cancelChallenge = (id) => updateDoc(ref(id), { status: "cancelled", updatedAt: serverTimestamp() });

export function submitAction(id, side, action) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref(id));
    const m = s.data();
    if (!m || m.status !== "active") throw new Error("La lotta non è in corso.");
    const need = neededSides(m);
    if (!need.includes(side)) throw new Error("Non tocca a te.");
    const actions = { ...(m.actions || {}), [side]: action };
    if (!need.every((sd) => actions[sd])) {
      tx.update(ref(id), { [`actions.${side}`]: clean(action), updatedAt: serverTimestamp() });
      return null;
    }
    const { battle, events } = withSeed(m.seed + (m.seq + 1) * 7919, () => playTurn({ ...m.battle, log: [] }, actions.p || null, actions.e || null));
    delete battle.log;
    const patch = { battle, events, seq: m.seq + 1, actions: {}, updatedAt: serverTimestamp() };
    if (battle.over) Object.assign(patch, { status: "done", winner: battle.over });
    tx.update(ref(id), clean(patch));
    return battle.over ? m : null;
  }).then((m) => {
    if (m && m.a !== m.b) [m.a, m.b].forEach((u) => notify(u, "🐾 Sfida conclusa", `La lotta fra ${m.aName} e ${m.bName} è finita: guarda com'è andata nel Rifugio.`));
  });
}

export function forfeit(id, side) {
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref(id));
    const m = s.data();
    if (!m || m.status !== "active") throw new Error("La lotta non è in corso.");
    tx.update(ref(id), { status: "done", winner: side === "p" ? "e" : "p", forfeit: side, updatedAt: serverTimestamp() });
  });
}

/* Vista dal lato "e": la lotta si mostra girata (il proprio pet sempre in
   basso a sinistra). Si girano le parti, le righe e le istantanee. */
const SW = { p: "e", e: "p" };
const flipNeed = (n) => (n ? n.split("").map((c) => SW[c]).sort((x) => (x === "p" ? -1 : 1)).join("") : n);
export function flipBattle(b) {
  if (!b) return b;
  return { ...b, sides: { p: b.sides.e, e: b.sides.p }, needSwitch: flipNeed(b.needSwitch), over: b.over ? SW[b.over] : b.over,
    names: b.names ? { p: b.names.e, e: b.names.p } : b.names };
}
export function flipEvent(ev) {
  if (!ev) return ev;
  return { ...ev, side: ev.side ? SW[ev.side] : ev.side, target: ev.target ? SW[ev.target] : ev.target,
    snap: ev.snap ? { p: ev.snap.e, e: ev.snap.p } : ev.snap };
}
