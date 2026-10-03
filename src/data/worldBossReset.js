// ── Azzeramento del World Boss Fight (2026-10-03) ───────────────────────────
// I minion evocati vivono in `world_boss_minions`, i turni in
// `battle_meta/turn_tracker`, il racconto in `world_boss_chat`: nessuno li
// svuotava quando il Master cambiava boss, e nel fight nuovo restavano le
// tombe dei servi del boss vecchio. Questa funzione riporta la battaglia a
// zero. La chiamano l'admin (Nascondi / Elimina / Risveglia un boss) e il
// bottone "Azzera battaglia" del pannello Master nel fight.
//
// Cosa NON tocca: i PV degli eroi (sono lo specchio della scheda Foundry, li
// rimette a posto la sync) e lo sfondo scelto per la battaglia.
import { collection, deleteField, doc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// writeBatch regge al massimo 500 operazioni: si spezza in blocchi.
async function deleteAll(colName) {
  const snap = await getDocs(collection(db, colName));
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const b = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => b.delete(r));
    await b.commit();
  }
  return refs.length;
}

// `boss` (facoltativo) = il boss che si risveglia: torna a PV pieni, senza
// scudo né condizioni rimaste dal giro prima, e con la CA di partenza
// (`baseAc`, salvata dal primo "+CA" che si è dato in battaglia).
export async function resetWorldBossFight({ boss = null, clearChat = true } = {}) {
  const minions = await deleteAll("world_boss_minions");
  const chat = clearChat ? await deleteAll("world_boss_chat") : 0;

  await setDoc(doc(db, "battle_meta", "turn_tracker"), {
    fightStarted: false, phase: "players", actedPlayers: [], turnNumber: 1,
    attackCounts: {}, quorumTurn: deleteField(), lastSwitchedAt: serverTimestamp(),
  }, { merge: true });

  // Gli eroi perdono gli strascichi della battaglia vecchia: scudo, vantaggio/
  // svantaggio sul prossimo tiro, buff di CA.
  const chars = await getDocs(collection(db, "characters"));
  const touched = chars.docs.filter((d) => {
    const c = d.data();
    return c.nextTurnCondition || c.debuffSource || Number(c.stats?.shield) > 0 || Number(c.selfAcBonus) > 0;
  });
  for (let i = 0; i < touched.length; i += 450) {
    const b = writeBatch(db);
    touched.slice(i, i + 450).forEach((d) => {
      const c = d.data();
      const patch = { nextTurnCondition: null, debuffSource: null };
      if (Number(c.stats?.shield) > 0) patch["stats.shield"] = 0;
      if (Number(c.selfAcBonus) > 0) Object.assign(patch, { selfAcBonus: 0, selfAcSource: null, selfAcAppliedAt: null });
      b.update(d.ref, patch);
    });
    await b.commit();
  }

  if (boss?.id) {
    const b = writeBatch(db);
    b.update(doc(db, "bosses", boss.id), {
      hp: Number(boss.maxHp) || Number(boss.hp) || 1, shield: 0,
      nextTurnCondition: null, debuffSource: null,
      ...(boss.baseAc != null ? { ac: Number(boss.baseAc) || boss.ac, baseAc: deleteField() } : {}),
    });
    await b.commit();
  }
  return { minions, chat, heroes: touched.length };
}
