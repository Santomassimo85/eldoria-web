/* Stanze delle Segrete (dungeon_rooms/{id}), 2026-11-04.
   Doc: { name, type, hostUid, members: [{uid, name, avatar, cls, level, ready}],
          memberIds: [uid…], status: "open" | "running", weekKey, createdAt,
          updatedAt, startedAt }
   Tutto in transazione: due giocatori che entrano insieme nell'ultimo posto
   non sforano mai i 4; l'ultimo che preme Avvia fa partire il dungeon. */
import { collection, doc, runTransaction, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { currentWeekKey } from "../data/arenaWeek";
import { MAX_PARTY, allReady } from "../data/segrete";

const roomsCol = () => collection(db, "dungeon_rooms");

function memberFrom(uid, char, cls, level) {
  return {
    uid,
    name: char?.name || "Avventuriero",
    avatar: char?.spriteUrl || char?.image || char?.avatar || "",
    cls, level, ready: false,
  };
}

export async function createRoom(uid, char, { name, type, cls, level }) {
  const ref = doc(roomsCol());
  await runTransaction(db, async (tx) => {
    tx.set(ref, {
      name: String(name || "").trim().slice(0, 40) || `Gruppo di ${char?.name || "?"}`,
      type, hostUid: uid,
      members: [memberFrom(uid, char, cls, level)], memberIds: [uid],
      status: "open", weekKey: currentWeekKey(),
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), startedAt: null,
    });
  });
  return ref.id;
}

async function editRoom(roomId, fn) {
  const ref = doc(db, "dungeon_rooms", roomId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error("La stanza non esiste più.");
    const room = s.data();
    const patch = fn(room);
    if (patch === "delete") { tx.delete(ref); return null; }
    if (patch) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
    return patch;
  });
}

export const joinRoom = (roomId, uid, char, cls, level) => editRoom(roomId, (room) => {
  if (room.status !== "open") throw new Error("Il gruppo è già partito.");
  if (room.memberIds.includes(uid)) return null;
  if (room.members.length >= MAX_PARTY) throw new Error(`Il gruppo è pieno (${MAX_PARTY} su ${MAX_PARTY}).`);
  // chi entra toglie le spunte: il gruppo è cambiato, tutti riconfermano
  const members = room.members.map((m) => ({ ...m, ready: false })).concat(memberFrom(uid, char, cls, level));
  return { members, memberIds: members.map((m) => m.uid) };
});

export const leaveRoom = (roomId, uid) => editRoom(roomId, (room) => {
  if (room.status !== "open") throw new Error("Il dungeon è partito: non puoi più uscire.");
  const members = room.members.filter((m) => m.uid !== uid).map((m) => ({ ...m, ready: false }));
  if (!members.length) return "delete";
  return { members, memberIds: members.map((m) => m.uid), hostUid: room.hostUid === uid ? members[0].uid : room.hostUid };
});

// Il capo (o il Master) toglie qualcuno dal gruppo.
export const kickMember = (roomId, byUid, uid, isMaster) => editRoom(roomId, (room) => {
  if (room.hostUid !== byUid && !isMaster) throw new Error("Solo il capo del gruppo può farlo.");
  if (room.status !== "open") throw new Error("Il dungeon è già partito.");
  const members = room.members.filter((m) => m.uid !== uid).map((m) => ({ ...m, ready: false }));
  if (!members.length) return "delete";
  return { members, memberIds: members.map((m) => m.uid), hostUid: room.hostUid === uid ? members[0].uid : room.hostUid };
});

// Cambia classe nella stanza (toglie la propria spunta).
export const setMemberClass = (roomId, uid, cls, level) => editRoom(roomId, (room) => {
  if (room.status !== "open") throw new Error("Il dungeon è già partito.");
  return { members: room.members.map((m) => (m.uid === uid ? { ...m, cls, level, ready: false } : m)) };
});

// Spunta "Avvia": quando l'hanno messa tutti il dungeon parte.
export const setReady = (roomId, uid, ready) => editRoom(roomId, (room) => {
  if (room.status !== "open") return null;
  const members = room.members.map((m) => (m.uid === uid ? { ...m, ready: !!ready } : m));
  const next = { ...room, members };
  return allReady(next) ? { members, status: "running", startedAt: serverTimestamp() } : { members };
});

// Il Master fa partire comunque (prova o gruppo bloccato).
export const forceStart = (roomId) => editRoom(roomId, (room) => (room.status === "open" ? { status: "running", startedAt: serverTimestamp() } : null));

// Torna alla stanza (finché il combattimento non c'è: fase 3) — capo o Master.
export const reopenRoom = (roomId) => editRoom(roomId, (room) => ({ status: "open", startedAt: null, members: room.members.map((m) => ({ ...m, ready: false })) }));

export const deleteRoom = (roomId) => deleteDoc(doc(db, "dungeon_rooms", roomId));
