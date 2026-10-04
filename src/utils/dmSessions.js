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
import { buildLoreRegistry, linkifyLoreHtml } from "./loreLinks";

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
    .filter((s) => !s.autosave) // il salvataggio automatico non è una sessione dell'archivio
    .sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0));
}

// ── Salvataggio automatico (2026-10-04) ───────────────────────────────────
// Bozza e sessione generate finivano solo nello stato della pagina: chiudendo
// la scheda prima di "Salva" si perdeva tutto. Ora ogni bozza/sessione
// generata va SUBITO in dm_sessions/autosave-<party> (autosave: true, escluso
// dall'archivio); la pagina la ripropone finché non la salvi o la scarti.
const autosaveRef = (party) => doc(db, SESSIONS, `autosave-${String(party || "").toLowerCase()}`);

export async function saveAutosave(party, data) {
  await setDoc(autosaveRef(party), { party, autosave: true, ...data, savedAt: serverTimestamp() });
}

export async function loadAutosave(party) {
  const snap = await getDoc(autosaveRef(party));
  return snap.exists() ? snap.data() : null;
}

export async function clearAutosave(party) {
  await deleteDoc(autosaveRef(party));
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

// Riferimento del mondo condiviso: le città (geo_archive) e gli NPC (npcs) già
// esistenti, in forma COMPATTA, così il generatore può riusarli invece di
// inventarne di nuovi ed essere preciso ("nella città X c'è l'arcanista Y").
// Non è specifico per party: sono dati di mondo. Ritorna { cities, npcs }.
export async function loadWorldReference() {
  const [citySnap, npcSnap] = await Promise.all([
    getDocs(collection(db, "geo_archive")).catch(() => null),
    getDocs(collection(db, "npcs")).catch(() => null),
  ]);

  const cities = citySnap
    ? citySnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .map((c) => ({
          name: c.name || "",
          continent: c.continent || "",
          desc: stripHtml(c.description).slice(0, 400),
        }))
        .filter((c) => c.name)
        .sort((a, b) => a.name.localeCompare(b.name, "it"))
    : [];

  const npcs = npcSnap
    ? npcSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .map((n) => ({
          name: n.name || "",
          faction: n.faction || "",
          city: (n.linkedCity || n.location || "").trim(),
          desc: stripHtml(n.description).slice(0, 240),
        }))
        .filter((n) => n.name)
        .sort((a, b) => a.city.localeCompare(b.city, "it") || a.name.localeCompare(b.name, "it"))
    : [];

  return { cities, npcs };
}

// Contesto narrativo del party per la generazione (Input B):
//  1) recap REALI dalla collezione esistente `summaries` (continuità dal giorno 1)
//  2) summary delle sessioni già generate in `dm_sessions`
//  + HTML intero dell'ultima sessione generata ("dove sono ora").
export async function loadPartyContext(party, { summaryCap = 1500 } = {}) {
  // 1) recap dalla collezione `summaries` (quella dello Scriptorium), per party
  let recaps = [];
  try {
    const rsnap = await getDocs(query(collection(db, "summaries"), where("party", "==", party)));
    recaps = rsnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s, i) => ({
        sessionNumber: i + 1, // numero nel gruppo: `order` è globale fra i gruppi
        title: s.title,
        summary: stripHtml(s.content).slice(0, summaryCap),
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

// HTML → testo, senza <style>/<script> (le prep generate iniziano con decine
// di KB di CSS, che al modello non servono).
const htmlToText = (html) =>
  String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// Contesto per il generatore (bozza e sessione), riletto a OGNI richiesta:
//  - recaps: i riassunti VERI del gruppo (`summaries`), numerati 1..N nel
//    gruppo (l'`order` è globale fra i gruppi); le ultime 3 quasi per intero,
//    le altre accorciate;
//  - preps: le prep già generate (`dm_sessions`) = cosa era PREVISTO;
//  - lastPrepText: il testo dell'ultima prep, senza CSS.
export async function loadSessionContext(party) {
  let rows = [];
  try {
    const rsnap = await getDocs(query(collection(db, "summaries"), where("party", "==", party)));
    rows = rsnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  } catch { /* se la collezione non è leggibile, prosegui senza */ }
  const recaps = rows.map((s, i) => ({
    n: i + 1,
    title: s.title || "",
    date: s.date || "",
    text: htmlToText(s.content).slice(0, i >= rows.length - 3 ? 6000 : 1200),
  }));

  const gen = await loadSessions(party).catch(() => []);
  const preps = gen.map((s) => ({ sessionNumber: s.sessionNumber, title: s.title || "", summary: s.summary || {} }));
  const last = gen[gen.length - 1];

  return {
    recaps,
    preps,
    lastPrepText: last ? htmlToText(last.htmlContent).slice(0, 3000) : "",
    lastPrepNumber: last?.sessionNumber || 0,
  };
}

// Chiede a /api/generate-session la BOZZA della sessione (scaletta JSON).
export async function requestSessionDraft(payload) {
  const resp = await fetch("/api/generate-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, mode: "draft" }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  if (!data.draft) throw new Error("Nessuna bozza ricevuta.");
  return { draft: data.draft, usage: data.usage || null };
}

// "Leggi i riassunti": legge TUTTI i riassunti del party e restituisce
//   { recent: [{ sessionNumber, title, bullets }], topics: [{ label, note }] }
// - recent = fast recap delle ultime 3 sessioni;
// - topics = fili/temi importanti cliccabili (da far tornare in una nuova sessione).
export async function readPartyRecap(party) {
  // Per la lettura vogliamo il testo quasi integrale dei riassunti (non il cap
  // ristretto usato in generazione), altrimenti il modello vede solo l'inizio.
  const ctx = await loadPartyContext(party, { summaryCap: 12000 });
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
  if (summaries.length === 0) return { recent: [], topics: [] };

  const resp = await fetch("/api/recap-bullets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ party, summaries }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return {
    recent: Array.isArray(data.recent) ? data.recent : [],
    topics: Array.isArray(data.topics) ? data.topics : [],
  };
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

// Chiama /api/generate-session (sessione completa). L'endpoint accumula tutto lato server (lo
// streaming Node→browser su Vercel viene reciso dopo pochi KB) e risponde con
// un JSON unico { text }. onChunk(fullText, fullText) è chiamato una volta a
// fine generazione, per aggiornare il contatore. Ritorna { html, summary }.
export async function streamGenerateSession(payload, onChunk) {
  const resp = await fetch("/api/generate-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  const full = data.text || "";
  if (!full) throw new Error("Nessun contenuto generato.");
  if (onChunk) onChunk(full, full);
  return { ...parseGenerated(full), warning: data.warning || "", usage: data.usage || null };
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

// ── Link alle cose già esistenti ──────────────────────────────────────────
// I nomi di PG, NPC e luoghi della sessione diventano link colorati alle loro
// schede del sito, con lo stesso registro dei riassunti (utils/loreLinks).
// Li aggiunge l'app DOPO la generazione: all'AI non costano token.
export async function loadLoreRegistry() {
  const [chars, npcs, geo] = await Promise.all([
    getDocs(collection(db, "characters")).catch(() => null),
    getDocs(collection(db, "npcs")).catch(() => null),
    getDocs(collection(db, "geo_archive")).catch(() => null),
  ]);
  const list = (snap) => (snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : []);
  return buildLoreRegistry({
    characters: list(chars),
    npcs: list(npcs),
    cities: list(geo).map((g) => g.name).filter(Boolean),
  });
}

// Documento della sessione → stesso documento con i nomi linkati. I link si
// aprono in una nuova scheda (l'anteprima e il dettaglio sono iframe).
export function linkifySessionHtml(html, registry) {
  if (!html || !registry?.regex || typeof DOMParser === "undefined") return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector("main") || doc.body;
    if (!root) return html;
    root.innerHTML = linkifyLoreHtml(root.innerHTML, registry);
    root.querySelectorAll("a[data-lore]").forEach((a) => {
      a.setAttribute("href", window.location.origin + a.getAttribute("data-href"));
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  } catch {
    return html;
  }
}
