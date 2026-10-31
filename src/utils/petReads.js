/* ============================================================
   Punti pet delle letture e visite (2026-10-31) — lato sito.
   `claimRead(kind, id)` chiede al server (callable petReadReward) di
   pagare la lettura: è il SERVER che decide se è la prima volta (registro
   pet_reads), quindi ricaricare, cambiare telefono o ritoccare il doc del
   personaggio non fa riprendere i punti. Qui c'è solo un promemoria in
   memoria/localStorage per non richiamare il server a vuoto.
   `useReadAfter(kind, id, active)` aspetta READ_DWELL_MS prima di chiedere.
   ============================================================ */

import { useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";
import { READ_DWELL_MS } from "../data/petReads";

const sent = new Set();
const storeKey = (uid) => `pet_reads_done_${uid}`;
function doneSet(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey(uid)) || "[]")); } catch { return new Set(); }
}
function remember(uid, key) {
  try {
    const s = doneSet(uid); s.add(key);
    localStorage.setItem(storeKey(uid), JSON.stringify([...s].slice(-2000)));
  } catch { /* storage bloccato: pazienza, chiederà di nuovo al server */ }
}

export async function claimRead(kind, id) {
  const uid = auth.currentUser?.uid;
  if (!uid || !kind || !id) return null;
  const key = `${kind}:${id}`;
  if (sent.has(`${uid}:${key}`) || doneSet(uid).has(key)) return null;
  sent.add(`${uid}:${key}`);
  try {
    const { data } = await httpsCallable(functions, "petReadReward")({ kind, id: String(id) });
    remember(uid, key);
    return data;
  } catch {
    sent.delete(`${uid}:${key}`); // rete o server giù: si riprova alla prossima apertura
    return null;
  }
}

export function useReadAfter(kind, id, active = true) {
  useEffect(() => {
    if (!active || !id) return undefined;
    const t = setTimeout(() => { claimRead(kind, id); }, READ_DWELL_MS[kind] || 4000);
    return () => clearTimeout(t);
  }, [kind, id, active]);
}
