import { doc, runTransaction, deleteField } from 'firebase/firestore';
import { db } from '../firebase';

// Prima dell'importazione annulla anche le prenotazioni, insieme alla voce di coda.
export async function cancelCraftInbox(id) {
  if (!id) return;
  await runTransaction(db, async (tx) => {
    const queueRef = doc(db, 'foundry_inbox', id);
    const queued = await tx.get(queueRef);
    if (!queued.exists()) return;
    const job = queued.data();
    const uses = Array.isArray(job.materialUses) ? job.materialUses : [];
    if (uses.length) {
      if (job.materialLeaseUntil) throw new Error('Foundry ha già iniziato questo consumo. Completa la sincronizzazione prima di eliminare la voce.');
      const charRef = doc(db, 'characters', job.targetUid);
      const character = await tx.get(charRef);
      if (character.exists()) {
        const reservations = character.data().crafting?.materialReservations || {};
        const patch = {};
        for (const use of uses) if (reservations[use.reservationId]?.status === 'pending') {
          patch[`crafting.materialReservations.${use.reservationId}`] = deleteField();
        }
        if (Object.keys(patch).length) tx.update(charRef, patch);
      }
    }
    tx.delete(queueRef);
  });
}
