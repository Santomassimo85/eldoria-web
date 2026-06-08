/* ============================================================
   NOTIFICHE — helper condiviso
   ------------------------------------------------------------
   Crea documenti nella collection `notifications`:
     { userId, title, message, read:false, timestamp }

   Ogni doc creato qui fa scattare automaticamente anche la PUSH
   (Cloud Function `pushOnNotification` in functions/index.js), quindi
   il giocatore riceve sia la voce nel log /notifications sia la
   notifica push sulla webapp/OS. Usare per gli eventi MIRATI di cui
   conosciamo gli uid (sfida accettata, match del torneo pronto, ecc.).

   I broadcast a TUTTI i giocatori (es. "iscrizioni aperte") restano
   gestiti via Cloud Function push-only, per non intasare il log di
   ognuno con decine di voci.
   ============================================================ */

import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

const isRealUid = (uid) =>
  typeof uid === "string" && uid.length > 0 && !uid.startsWith("ai_");

/* Notifica un singolo giocatore. No-op per uid AI / vuoti. */
export async function notifyUser(uid, title, message) {
  if (!isRealUid(uid)) return;
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "notifications")), {
    userId: uid,
    title: title || "Notifica",
    message: message || "",
    read: false,
    timestamp: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (e) {
    console.warn("[notify] notifyUser fallita:", e);
  }
}

/* Notifica più giocatori in un'unica scrittura batch.
   `entries` può essere:
     - un array di uid  → stesso title/message per tutti (passa title/message)
     - un array di { uid, title, message } → messaggi personalizzati */
export async function notifyUsers(entries, title, message) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  const batch = writeBatch(db);
  let count = 0;
  for (const e of entries) {
    const uid = typeof e === "string" ? e : e?.uid;
    if (!isRealUid(uid)) continue;
    batch.set(doc(collection(db, "notifications")), {
      userId: uid,
      title: (typeof e === "object" && e.title) || title || "Notifica",
      message: (typeof e === "object" && e.message) || message || "",
      read: false,
      timestamp: serverTimestamp(),
    });
    count++;
  }
  if (count === 0) return;
  try {
    await batch.commit();
  } catch (e) {
    console.warn("[notify] notifyUsers fallita:", e);
  }
}
