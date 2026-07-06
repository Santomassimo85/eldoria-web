// Accesso Firestore per il Generatore Sessioni DM (collezione `dm_sessions`) e
// per la config `parties`. Tutte le query di sessione filtrano SEMPRE per party
// — le storie dei gruppi non si mescolano mai.
import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { PARTIES, sessionDocId } from "../data/parties";

const SESSIONS = "dm_sessions";
const PARTIES_COL = "parties";

// Upsert idempotente della config party su Firestore. Va chiamato da un master
// (le regole permettono la scrittura solo a isMaster()). Non sovrascrive campi
// eventualmente editati a mano: usa merge.
export async function ensureParties() {
  await Promise.all(
    PARTIES.map((p) =>
      setDoc(
        doc(db, PARTIES_COL, p.id),
        {
          name: p.name,
          world: p.world,
          characters: p.characters,
          closingChronicle: p.closingChronicle,
          color: p.color,
          active: p.active,
        },
        { merge: true }
      )
    )
  );
}

// Tutte le sessioni di UN party, ordinate per numero crescente.
export async function loadSessions(party) {
  const q = query(collection(db, SESSIONS), where("party", "==", party));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0));
}

// Elimina definitivamente una sessione generata (party + numero).
export async function deleteSession(party, sessionNumber) {
  await deleteDoc(doc(db, SESSIONS, sessionDocId(party, sessionNumber)));
}

// Una singola sessione per party + numero.
export async function loadSession(party, sessionNumber) {
  const ref = doc(db, SESSIONS, sessionDocId(party, sessionNumber));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// Contesto narrativo del party per la generazione (Input B):
//  1) recap REALI dalla collezione esistente `summaries` (continuità dal giorno 1)
//  2) summary delle sessioni già generate in `dm_sessions`
//  + HTML intero dell'ultima sessione generata ("dove sono ora").
export async function loadPartyContext(party) {
  // 1) recap dalla collezione `summaries` (quella dello Scriptorium), per party
  let recaps = [];
  try {
    const rsnap = await getDocs(query(collection(db, "summaries"), where("party", "==", party)));
    recaps = rsnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => ({
        sessionNumber: s.order,
        title: s.title,
        summary: stripHtml(s.content).slice(0, 1500),
      }));
  } catch { /* se la collezione non è leggibile, prosegui senza */ }

  // 2) sessioni generate (dm_sessions)
  const gen = await loadSessions(party);
  const genSummaries = gen.map((s) => ({
    sessionNumber: s.sessionNumber,
    title: s.title,
    summary: s.summary,
  }));
  const last = gen[gen.length - 1];

  return {
    pastSummaries: [...recaps, ...genSummaries],
    lastSessionHtml: last?.htmlContent || "",
  };
}

// "Leggi i riassunti": prende il contesto del party (gli stessi riassunti usati per
// generare) e li condensa in bullet point brevi, per sessione, in ordine cronologico.
// Ritorna [{ sessionNumber, title, bullets: [...] }].
export async function readPartyRecap(party) {
  const ctx = await loadPartyContext(party);
  const summaries = (ctx.pastSummaries || []).map((s) => {
    const text =
      typeof s.summary === "string"
        ? s.summary
        : [
            s.summary?.panoramica,
            s.summary?.bottino && `Bottino: ${s.summary.bottino}`,
            s.summary?.ganciAperti && `Ganci aperti: ${s.summary.ganciAperti}`,
          ]
            .filter(Boolean)
            .join(" — ");
    return { sessionNumber: s.sessionNumber, title: s.title || "", text };
  });
  if (summaries.length === 0) return [];

  const resp = await fetch("/api/recap-bullets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ party, summaries }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return Array.isArray(data.recap) ? data.recap : [];
}

// Divide l'output del modello nei marker ---HTML--- / ---SUMMARY---.
export function parseGenerated(text) {
  const t = String(text || "");
  const h = t.indexOf("---HTML---");
  const s = t.indexOf("---SUMMARY---");
  let html = "";
  let summaryRaw = "";
  if (h >= 0 && s > h) {
    html = t.slice(h + "---HTML---".length, s).trim();
    summaryRaw = t.slice(s + "---SUMMARY---".length).trim();
  } else if (h >= 0) {
    html = t.slice(h + "---HTML---".length).trim();
  } else {
    html = t.trim();
  }
  let summary = { panoramica: "", bottino: "", ganciAperti: "" };
  if (summaryRaw) {
    const a = summaryRaw.indexOf("{");
    const z = summaryRaw.lastIndexOf("}");
    if (a >= 0 && z > a) {
      try { summary = { ...summary, ...JSON.parse(summaryRaw.slice(a, z + 1)) }; }
      catch { /* JSON non valido: tieni i default */ }
    }
  }
  return { html, summary };
}

// Chiama /api/generate-session in streaming. onChunk(chunkText, fullText) per
// l'avanzamento live. Ritorna { html, summary }.
export async function streamGenerateSession(payload, onChunk) {
  const resp = await fetch("/api/generate-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok || !resp.body) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); if (j.error) msg = j.error; } catch { /* noop */ }
    throw new Error(msg);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    if (onChunk) onChunk(chunk, full);
  }
  const errIdx = full.indexOf("[[STREAM_ERROR]]");
  if (errIdx >= 0) throw new Error(full.slice(errIdx + "[[STREAM_ERROR]]".length).trim() || "Errore di streaming");
  return parseGenerated(full);
}

// Salva/aggiorna una sessione generata.
export async function saveSession({ party, sessionNumber, title, htmlContent, summary, durata }) {
  const id = sessionDocId(party, sessionNumber);
  const ref = doc(db, SESSIONS, id);
  const existed = (await getDoc(ref)).exists();
  await setDoc(
    ref,
    {
      party,
      sessionNumber: Number(sessionNumber),
      title: title || "",
      htmlContent: htmlContent || "",
      summary: summary || { panoramica: "", bottino: "", ganciAperti: "" },
      durata: durata || "",
      ...(existed ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}
