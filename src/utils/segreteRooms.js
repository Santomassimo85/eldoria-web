/* Stanze delle Segrete (dungeon_rooms/{id}), 2026-11-04.
   Doc: { name, type, hostUid, members: [{uid, name, avatar, cls, level, ready}],
          memberIds: [uid…], status: "open" | "running", weekKey, createdAt,
          updatedAt, startedAt }
   Tutto in transazione: due giocatori che entrano insieme nell'ultimo posto
   non sforano mai i 4; l'ultimo che preme Avvia fa partire il dungeon. */
import { collection, doc, runTransaction, serverTimestamp, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { currentWeekKey } from "../data/arenaWeek";
import { MAX_PARTY, allReady, mergeDungeons } from "../data/segrete";

const roomsCol = () => collection(db, "dungeon_rooms");

async function requireActiveDungeon(tx, key) {
  const snap = await tx.get(doc(db, "dungeon_types", key));
  const dungeon = mergeDungeons(snap.exists() ? [{ key, ...snap.data() }] : []).find((d) => d.key === key);
  if (!dungeon) throw new Error("Questo dungeon non è attivo. Scegli un altro dungeon.");
}

function memberFrom(uid, char, cls, level) {
  return {
    uid,
    name: char?.name || "Avventuriero",
    avatar: char?.spriteUrl || char?.image || char?.avatar || "",
    cls, level, ready: false,
  };
}

export async function createRoom(uid, char, { name, type, cls, level, difficulty = "facile" }) {
  const ref = doc(roomsCol());
  await runTransaction(db, async (tx) => {
    await requireActiveDungeon(tx, type);
    tx.set(ref, {
      name: String(name || "").trim().slice(0, 40) || `Gruppo di ${char?.name || "?"}`,
      type, difficulty, hostUid: uid,
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
    const patch = await fn(room, tx);
    if (patch?.status === "running" || (patch?.type && patch.type !== room.type)) await requireActiveDungeon(tx, patch.type || room.type);
    if (patch === "delete") { tx.delete(ref); return null; }
    if (patch) tx.update(ref, { ...patch, updatedAt: serverTimestamp() });
    return patch;
  });
}

export const joinRoom = (roomId, uid, char, cls, level) => editRoom(roomId, async (room, tx) => {
  await requireActiveDungeon(tx, room.type);
  if (room.status !== "open") throw new Error("Il gruppo è già partito.");
  if (room.memberIds.includes(uid)) return null;
  if (room.members.length >= MAX_PARTY) throw new Error(`Il gruppo è pieno (${MAX_PARTY} su ${MAX_PARTY}).`);
  // chi entra toglie le spunte: il gruppo è cambiato, tutti riconfermano
  const members = room.members.map((m) => ({ ...m, ready: false })).concat(memberFrom(uid, char, cls, level));
  return { members, memberIds: members.map((m) => m.uid), invited: (room.invited || []).filter((i) => i.uid !== uid) };
});

export const leaveRoom = (roomId, uid) => editRoom(roomId, (room) => {
  if (room.status === "running") throw new Error("Il dungeon è in corso: prima abbandona la partita.");
  if (room.status === "done") {
    // partita finita: chi esce se ne va, l'ultimo chiude la stanza
    const left = room.members.filter((m) => m.uid !== uid);
    return left.length ? { members: left, memberIds: left.map((m) => m.uid) } : "delete";
  }
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

// Notifica (campanella + push) a una lista di uid, porta alle Segrete.
function notifyMembers(uids, title, message) {
  return Promise.all([...new Set(uids)].filter(Boolean).map((userId) => addDoc(collection(db, "notifications"), {
    userId, title, message, link: "/segrete", read: false, timestamp: serverTimestamp(),
  }))).catch(() => {});
}
const nameOf = (room, uid) => room.members.find((m) => m.uid === uid)?.name || "Il capo";

/* Spunta "Avvia": quando l'hanno messa tutti il dungeon parte.
   Notifiche (2026-11-05): quando il CAPO preme Avvia gli altri ancora non pronti ricevono
   "premi Avvia"; quando la spedizione parte la ricevono tutti gli altri del gruppo. */
export async function setReady(roomId, uid, ready) {
  let room = null;
  const patch = await editRoom(roomId, (r) => {
    room = r;
    if (r.status !== "open") return null;
    const members = r.members.map((m) => (m.uid === uid ? { ...m, ready: !!ready } : m));
    const next = { ...r, members };
    return allReady(next) ? { members, status: "running", startedAt: serverTimestamp(), blocked: null } : { members, blocked: null };
  });
  if (!patch || !room) return;
  const others = room.members.filter((m) => m.uid !== uid);
  if (patch.status === "running") {
    await notifyMembers(others.map((m) => m.uid), "⚔ La spedizione è partita!",
      `Il gruppo «${room.name}» è sceso nelle Segrete: entra e combatti, tocca al gruppo.`);
  } else if (ready && room.hostUid === uid) {
    await notifyMembers(others.filter((m) => !m.ready).map((m) => m.uid), "🗝 Il capo è pronto",
      `${nameOf(room, uid)} ha premuto Avvia nel gruppo «${room.name}». Premi Avvia anche tu: si parte quando sono pronti tutti.`);
  }
}

// Il Master fa partire comunque (prova o gruppo bloccato).
export async function forceStart(roomId) {
  let room = null;
  const patch = await editRoom(roomId, (r) => { room = r; return r.status === "open" ? { status: "running", startedAt: serverTimestamp() } : null; });
  if (patch && room) {
    await notifyMembers(room.members.map((m) => m.uid), "⚔ La spedizione è partita!",
      `Il gruppo «${room.name}» è sceso nelle Segrete: entra e combatti, tocca al gruppo.`);
  }
}

// Torna alla stanza (finché il combattimento non c'è: fase 3) — capo o Master.
export const reopenRoom = (roomId) => editRoom(roomId, (room) => ({ status: "open", startedAt: null, members: room.members.map((m) => ({ ...m, ready: false })) }));

export const deleteRoom = (roomId) => deleteDoc(doc(db, "dungeon_rooms", roomId));

/* IL GRUPPO RESTA (2026-11-05): a fine dungeon la stanza torna "open" con gli stessi membri
   (e la chat vocale resta collegata). Lo fa il primo che preme "Torna al gruppo". */
export const backToRoom = (roomId, uid) => editRoom(roomId, (room) => {
  if (!(room.memberIds || []).includes(uid)) throw new Error("Non sei in questo gruppo.");
  if (room.status !== "done") return null; // già riaperto da un altro
  return { status: "open", startedAt: null, result: null, blocked: null, members: room.members.map((m) => ({ ...m, ready: false })) };
});

// Il capo (o il Master) sceglie il dungeon da avviare: le spunte di Avvia si azzerano
export const chooseDungeon = (roomId, byUid, key, isMaster = false) => editRoom(roomId, (room) => {
  if (room.hostUid !== byUid && !isMaster) throw new Error("Lo sceglie il capo del gruppo.");
  if (room.status !== "open") throw new Error("Il dungeon è già partito.");
  if (room.type === key) return null;
  return { type: key, members: room.members.map((m) => ({ ...m, ready: false })) };
});

/* Difficoltà (2026-11-06): la sceglie il capo (o il Master); il livello minimo lo controlla il server alla partenza */
export const chooseDifficulty = (roomId, byUid, key, isMaster = false) => editRoom(roomId, (room) => {
  if (room.hostUid !== byUid && !isMaster) throw new Error("La sceglie il capo del gruppo.");
  if (room.status !== "open") throw new Error("Il dungeon è già partito.");
  if ((room.difficulty || "facile") === key) return null;
  return { difficulty: key, blocked: null, members: room.members.map((m) => ({ ...m, ready: false })) };
});

/* Inviti (2026-11-04): chi è nel gruppo sceglie chi invitare. La stanza tiene
   `invited: [{uid, name, by}]` (nella lobby l'invitato la vede in cima con
   "Ti hanno invitato") e a ognuno parte una notifica (campanella + push) che
   porta alle Segrete. Entrare resta libero come per tutti i gruppi aperti. */
export async function invitePlayers(roomId, byUid, byName, targets) {
  const list = (targets || []).filter((t) => t?.uid && t.uid !== byUid);
  if (!list.length) return 0;
  let roomName = "";
  await editRoom(roomId, (room) => {
    if (room.status !== "open") throw new Error("Il gruppo è già partito.");
    if (!(room.memberIds || []).includes(byUid)) throw new Error("Puoi invitare solo dal tuo gruppo.");
    roomName = room.name;
    const prev = (room.invited || []).filter((i) => !list.some((t) => t.uid === i.uid));
    return { invited: [...prev, ...list.map((t) => ({ uid: t.uid, name: t.name || "", by: byName || "" }))].slice(-40) };
  });
  await Promise.all(list.map((t) => addDoc(collection(db, "notifications"), {
    userId: t.uid,
    title: "🗝 Invito nelle Segrete",
    message: `${byName || "Un compagno"} ti invita nel gruppo «${roomName}». Entra da Sala della Gloria → Le Segrete (serve l'eroe della classe con cui vuoi entrare).`,
    link: "/segrete",
    read: false, timestamp: serverTimestamp(),
  })));
  return list.length;
}
