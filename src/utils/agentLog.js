// src/utils/agentLog.js
// Diario + contatori degli agenti AI (letti da "Il Concilio").
//
//  - agent_logs      → una riga per azione/ragionamento (cronaca dettagliata)
//  - agent_counters  → UN documento per agente con aggregati economici:
//        { total, byDay:{ "YYYY-MM-DD": n }, lastAt, lastText }
//    Così "quante cose finora / oggi / l'ultima" si legge con 1 documento,
//    senza contare i log (che costerebbe letture). 1 mini-scrittura per evento.
//
// Tutto è "fire-and-forget": un log non deve MAI rompere il flusso dell'agente.
// level: "info" | "reason" | "action" | "success" | "error"

import { collection, addDoc, doc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC, basta per i bucket)
}

/**
 * Scrive una riga nel diario di un agente.
 * @param {object} [opts]  { count?: boolean }  se true incrementa anche i contatori
 *                         (usalo SOLO sull'evento "cosa generata", non su ogni passo).
 */
export function logAgent(agent, level, text, meta = {}, opts = {}) {
  try {
    addDoc(collection(db, "agent_logs"), {
      agent, level,
      text: String(text || "").slice(0, 1000),
      meta,
      ts: serverTimestamp(),
    }).catch(() => {});
    if (opts.count) countAgent(agent, text);
  } catch (_) { /* mai bloccare l'agente per un log */ }
}

/** Incrementa i contatori aggregati di un agente. `summary` = "ultima cosa generata". */
export function countAgent(agent, summary = "") {
  try {
    setDoc(doc(db, "agent_counters", agent), {
      total: increment(1),
      byDay: { [today()]: increment(1) },
      lastAt: serverTimestamp(),
      lastText: String(summary || "").slice(0, 160),
    }, { merge: true }).catch(() => {});
  } catch (_) { /* idem */ }
}
