#!/usr/bin/env node
/**
 * obsidian-sync.mjs
 * ------------------------------------------------------------------
 * Ponte Firestore (eldoria-web)  →  vault Obsidian (locale).
 *
 * Legge i dati del mondo dal cloud e genera note Markdown con [[wikilink]]
 * DENTRO la sottocartella `_Auto/` della vault. NON tocca MAI nulla fuori
 * da `_Auto/`: le tue note scritte a mano restano intatte e vengono usate
 * solo come bersaglio dei link.
 *
 * Idempotente: rilancialo quante volte vuoi, ricostruisce `_Auto/` da capo.
 * Niente si perde a PC spento: Firestore conserva tutto, lo script recupera
 * i riassunti mancanti alla prima esecuzione utile.
 *
 *   node tools/obsidian-sync.mjs
 *
 * Opzioni:
 *   --vault "C:\\percorso\\vault"   override del percorso vault
 *   --dry                            non scrive nulla, stampa solo cosa farebbe
 * ------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
} from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

/* ───────────────────────── CONFIG ───────────────────────── */

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const DUMP = args.includes("--dump"); // estrae i testi sessione in _sessions-dump.json
const GRAPH = args.includes("--graph"); // (ri)scrive i gruppi di colore del grafo Obsidian
const vaultArgIdx = args.indexOf("--vault");
const DEFAULT_VAULT = "C:\\Users\\KalEl\\Documents\\Obsidian Vault";
const VAULT = vaultArgIdx >= 0 ? args[vaultArgIdx + 1] : DEFAULT_VAULT;
const AUTO_DIR = path.join(VAULT, "_Auto");

// Party canonici (chiavi usate nel campo `party` dei riassunti).
// Allineati a SummaryAdmin.jsx.
const PARTIES = [
  { key: "AMEA",  label: "AMEA",              roster: "Garroth, Tanagar, Caius, Sylva" },
  { key: "LAC",   label: "LAC",               roster: "Horn, Thoki, Cleofe" },
  { key: "LEAF",  label: "LEAF",              roster: "Soran, Zethir, Aksel, Dago" },
  { key: "ENOX",  label: "ENOX",              roster: "Makenna, Temistocle, Alaric, Lael" },
  { key: "ECO",   label: "ECO",               roster: "Aksel, Dago, Ismael" },
  { key: "Unico", label: "Storia del Mondo",  roster: "Cronache globali" },
];
const partyByKey = Object.fromEntries(PARTIES.map((p) => [p.key, p]));

// Riassunti brevi "In breve" scritti dall'AI (Claude), per source_id.
// Formato file: { "<source_id>": ["punto 1", "punto 2", ...] }
function loadDigests() {
  const p = path.join(__dirname, "session-digests.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { console.warn(`  ⚠ session-digests.json illeggibile: ${e.message}`); return {}; }
}

// Ordina i riassunti in modo STABILE (stesso ordine per dump e note → numeri allineati).
function sortSessions(list) {
  return [...list].sort((a, b) => {
    const oa = Number(a.order), ob = Number(b.order);
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob;
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
}

/* ───────────────────────── ENV ───────────────────────── */

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`✖ Manca ${envPath}`);
    process.exit(1);
  }
  const out = {};
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/* ───────────────────── UTIL: testo / nomi ───────────────────── */

// Normalizza per il confronto fra nomi: minuscolo, accenti tipografici → ',
// spazi compattati.
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[´`’‘ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Parte "principale" di un titolo: ciò che viene prima del primo " - ".
//   "Garroth Tel´Arion - MATTEO" → "Garroth Tel´Arion"
//   "Tanagar - clan dei dentati - AXEL" → "Tanagar"
function primaryOf(title) {
  return title.split(/\s+[-–—]\s+/)[0].trim();
}

// Caratteri non ammessi nei nomi file Windows → '-'.
function safeFile(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120) || "senza-nome";
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&agrave;/gi, "à").replace(/&egrave;/gi, "è").replace(/&eacute;/gi, "é")
    .replace(/&igrave;/gi, "ì").replace(/&ograve;/gi, "ò").replace(/&ugrave;/gi, "ù");
}

// HTML dei riassunti → Markdown leggibile (mantiene immagini e link).
function htmlToMd(html) {
  let s = String(html ?? "");
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\s*\/\s*(p|div|section|article|figure|figcaption)\s*>/gi, "\n\n");
  s = s.replace(/<\s*li[^>]*>/gi, "\n- ");
  s = s.replace(/<\s*\/\s*li\s*>/gi, "");
  s = s.replace(/<\s*\/?\s*(ul|ol)[^>]*>/gi, "\n");
  s = s.replace(/<\s*h[1-6][^>]*>/gi, "\n\n### ");
  s = s.replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n");
  s = s.replace(/<\s*(strong|b)\s*>/gi, "**").replace(/<\s*\/\s*(strong|b)\s*>/gi, "**");
  s = s.replace(/<\s*(em|i)\s*>/gi, "*").replace(/<\s*\/\s*(em|i)\s*>/gi, "*");
  // Solo testo: niente immagini in Obsidian (né embed né riquadri vuoti).
  s = s.replace(/<\s*picture[^>]*>[\s\S]*?<\s*\/\s*picture\s*>/gi, "");
  s = s.replace(/<\s*img[^>]*>/gi, "");
  s = s.replace(/<\s*a[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, "[$2]($1)");
  s = s.replace(/<[^>]+>/g, ""); // tag residui
  s = decodeEntities(s);
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function yamlEscape(s) {
  const v = String(s ?? "");
  if (/[:#"'\n]/.test(v)) return JSON.stringify(v);
  return v;
}

/* ───────────────────── AI: riassunti "In breve" ───────────────────── */

// La chiave Anthropic è già sul PC (usata da "Lo Scriba"): la cerchiamo lì.
function readAnthropicKey() {
  const candidates = [
    path.join(PROJECT_ROOT, "functions", ".env.eldoria-web"),
    path.join(PROJECT_ROOT, ".env.local"),
    path.join(PROJECT_ROOT, ".env"),
  ];
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = raw.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (v) return v;
      }
    }
  }
  return process.env.ANTHROPIC_API_KEY || "";
}

// Chiede a Claude (Haiku, come il resto del progetto) i punti "In breve".
async function generateDigest(apiKey, s) {
  const text = htmlToMd(s.content || "").slice(0, 9000);
  const label = partyByKey[s.party]?.label || s.party || "";
  const prompt = `Sei un assistente che riassume sessioni di D&D in italiano.
Riassumi la sessione seguente in punti "In breve": cosa è successo, semplice e asciutto, per aiutare il master a ricordare al volo.
Regole:
- 4-6 punti, ognuno UNA frase breve.
- Italiano semplice e concreto: CHI ha fatto COSA, DOVE, cosa è cambiato.
- Metti in **grassetto** i nomi propri importanti (personaggi, luoghi, NPC).
- Niente prosa fiorita, niente citazioni, solo i fatti utili.
- L'ultimo punto, se utile, indica il gancio lasciato aperto (es. "→ nuovo incarico: ...").
Rispondi SOLO con un array JSON di stringhe (i punti, SENZA trattino), niente backtick, niente testo prima o dopo.

Titolo: ${s.title || ""}
Gruppo: ${label}

Testo della sessione:
${text}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "errore API");
  const testo = (data.content || []).map((b) => b.text || "").join("");
  const clean = testo.replace(/```json|```/g, "").trim();
  const arr = JSON.parse(clean);
  if (!Array.isArray(arr)) throw new Error("la risposta non è un array JSON");
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

/* ───────────────────── INDICE NOTE ESISTENTI ───────────────────── */

// Cammina la vault (esclude _Auto e .obsidian) e raccoglie i titoli delle
// tue note, così possiamo linkarle invece di duplicarle.
function indexExistingNotes() {
  const notes = []; // { title, normTitle, normPrimary, firstToken }
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === ".obsidian" || e.name === "_Auto" || e.name === ".trash") continue;
        walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        const title = e.name.replace(/\.md$/i, "");
        const primary = primaryOf(title);
        const np = norm(primary);
        notes.push({
          title,
          normTitle: norm(title),
          normPrimary: np,
          firstToken: np.split(" ")[0],
        });
      }
    }
  }
  walk(VAULT);
  return notes;
}

/* ───────────────────── FETCH FIRESTORE ───────────────────── */

async function fetchAll(db, name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn(`  ⚠ impossibile leggere "${name}": ${e.message}`);
    return [];
  }
}

/* ───────────────────── SCRITTURA SICURA ───────────────────── */

let written = 0;
function writeAuto(relPath, content) {
  const full = path.join(AUTO_DIR, relPath);
  // Guardia di sicurezza: mai scrivere fuori da _Auto/.
  const rel = path.relative(AUTO_DIR, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`RIFIUTO scrittura fuori da _Auto: ${full}`);
  }
  if (DRY) { console.log(`  [dry] ${path.join("_Auto", relPath)}`); written++; return; }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  written++;
}

/* ───────────────────────── MAIN ───────────────────────── */

async function main() {
  console.log("📜  Obsidian sync — Eldoria");
  console.log(`    vault : ${VAULT}`);
  console.log(`    auto  : ${AUTO_DIR}${DRY ? "   (DRY RUN)" : ""}`);

  if (!fs.existsSync(VAULT)) {
    console.error(`✖ Vault non trovata: ${VAULT}\n  Passa il percorso con --vault "..."`);
    process.exit(1);
  }

  // 1) indicizza le tue note
  const existing = indexExistingNotes();
  console.log(`    tue note esistenti: ${existing.length}`);

  // Risolve un nome a una TUA nota esistente; ritorna il titolo o null.
  function existingLinkFor(name) {
    const nq = norm(name);
    if (!nq) return null;
    return (
      existing.find((n) => n.normTitle === nq) ||
      existing.find((n) => n.normPrimary === nq) ||
      existing.find((n) => n.firstToken === nq) ||
      existing.find((n) => n.normPrimary.startsWith(nq + " ")) ||
      null
    )?.title ?? null;
  }

  // 2) leggi il cloud
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log("    leggo Firestore…");
  const [summaries, npcs, locations, quests] = await Promise.all([
    fetchAll(db, "summaries"),
    fetchAll(db, "npcs"),
    fetchAll(db, "geo_archive"),
    fetchAll(db, "quests"),
  ]);
  console.log(
    `    summaries:${summaries.length}  npcs:${npcs.length}  luoghi:${locations.length}  quests:${quests.length}`
  );

  // ── Modalità --dump: estrae i testi delle sessioni per farli riassumere ──
  if (DUMP) {
    const dump = sortSessions(summaries).map((s, i) => ({
      source_id: s.id,
      num: i + 1,
      title: (s.title || "Senza titolo").trim(),
      party: partyByKey[s.party]?.label || s.party || "",
      date: s.date || "",
      text: htmlToMd(s.content || ""),
    }));
    const out = path.join(__dirname, "_sessions-dump.json");
    fs.writeFileSync(out, JSON.stringify(dump, null, 2), "utf8");
    console.log(`📤  Dump scritto: ${out}  (${dump.length} sessioni)`);
    process.exit(0);
  }

  const DIGESTS = loadDigests();
  const digestCount = Object.keys(DIGESTS).length;
  console.log(`    riassunti brevi disponibili: ${digestCount}`);

  /* ── Registro dei bersagli per i link nelle sessioni ──
     name → titolo nota da linkare (tua nota se esiste, altrimenti la nota
     _Auto che generiamo qui). length>=4 per ridurre falsi positivi. */
  const linkTargets = new Map(); // norm(name) -> { name, title }
  function registerTarget(name, title) {
    const k = norm(name);
    if (!k || k.length < 4) return;
    if (!linkTargets.has(k)) linkTargets.set(k, { name, title });
  }

  // le tue note esistenti sono bersagli (per nome principale e titolo intero)
  for (const n of existing) {
    registerTarget(primaryOf(n.title), n.title);
    registerTarget(n.title, n.title);
  }

  /* ── PARTY (hub) ── */
  const sessionsByParty = {};
  for (const p of PARTIES) sessionsByParty[p.key] = [];

  /* ── NPC ── */
  let npcCreated = 0, npcLinkedToYours = 0;
  for (const npc of npcs) {
    const name = (npc.name || "").trim();
    if (!name) continue;
    const mine = existingLinkFor(name);
    if (mine) {
      registerTarget(name, mine);
      npcLinkedToYours++;
      continue; // non duplico: linko la tua
    }
    const title = safeFile(name);
    registerTarget(name, title);
    const fm = [
      "---",
      "generato: auto",
      `tipo: npc`,
      `source_id: ${npc.id}`,
      `nome: ${yamlEscape(name)}`,
      npc.faction ? `fazione: ${yamlEscape(npc.faction)}` : null,
      npc.location ? `ruolo: ${yamlEscape(npc.location)}` : null,
      npc.linkedCity ? `citta: ${yamlEscape(npc.linkedCity)}` : null,
      "---",
    ].filter(Boolean).join("\n");
    const body = [
      `# ${name}`,
      [npc.faction, npc.location].filter(Boolean).join(" · "),
      npc.linkedCity ? `**Luogo:** ${linkOrText(npc.linkedCity)}` : "",
      "",
      npc.description ? htmlToMd(npc.description) : "_Nessuna descrizione._",
      "",
      "---",
      "> [!info] Nota generata automaticamente da Firestore (`npcs`). Non modificarla a mano: viene riscritta a ogni sync.",
    ].filter((x) => x !== "").join("\n");
    writeAuto(path.join("NPC", `${title}.md`), `${fm}\n\n${body}\n`);
    npcCreated++;
  }

  /* ── LUOGHI ── */
  let locCreated = 0;
  for (const loc of locations) {
    const name = (loc.name || "").trim();
    if (!name) continue;
    const mine = existingLinkFor(name);
    if (mine) { registerTarget(name, mine); continue; }
    const title = safeFile(name);
    registerTarget(name, title);
    const fm = [
      "---",
      "generato: auto",
      "tipo: luogo",
      `source_id: ${loc.id}`,
      `nome: ${yamlEscape(name)}`,
      loc.continent ? `continente: ${yamlEscape(loc.continent)}` : null,
      "---",
    ].filter(Boolean).join("\n");
    const body = [
      `# ${name}`,
      loc.continent ? `*${loc.continent}*` : "",
      "",
      loc.description ? htmlToMd(loc.description) : "_Nessuna descrizione._",
      "",
      "---",
      "> [!info] Nota generata automaticamente da Firestore (`geo_archive`).",
    ].filter((x) => x !== "").join("\n");
    writeAuto(path.join("Luoghi", `${title}.md`), `${fm}\n\n${body}\n`);
    locCreated++;
  }

  /* ── INCARICHI (quests) ── */
  let questCreated = 0;
  for (const q of quests) {
    const title0 = (q.title || "").trim();
    if (!title0) continue;
    const title = safeFile(title0);
    const fm = [
      "---",
      "generato: auto",
      "tipo: incarico",
      `source_id: ${q.id}`,
      `titolo: ${yamlEscape(title0)}`,
      q.reward ? `ricompensa: ${yamlEscape(q.reward)}` : null,
      "---",
    ].filter(Boolean).join("\n");
    const body = [
      `# ${title0}`,
      q.reward ? `**Ricompensa:** ${q.reward}` : "",
      "",
      q.description ? htmlToMd(q.description) : "_Nessuna descrizione._",
      "",
      "---",
      "> [!info] Nota generata automaticamente da Firestore (`quests`).",
    ].filter((x) => x !== "").join("\n");
    writeAuto(path.join("Incarichi", `${title}.md`), `${fm}\n\n${body}\n`);
    questCreated++;
  }

  // Helper: trasforma un nome in [[wikilink]] (alla tua nota se esiste).
  function linkOrText(name) {
    const mine = existingLinkFor(name);
    return mine ? `[[${mine}]]` : `[[${safeFile(name)}]]`;
  }

  /* ── SESSIONI (il cuore: una nota per riassunto) ── */
  // ordina per `order` (numerico se possibile), poi per data.
  const ordered = sortSessions(summaries);

  // ── genera via AI i "In breve" mancanti (la chiave è già sul PC) ──
  const NO_AI = args.includes("--no-ai");
  const apiKey = NO_AI ? "" : readAnthropicKey();
  const toSummarize = ordered.filter(
    (s) => !Array.isArray(DIGESTS[s.id]) || DIGESTS[s.id].length === 0
  );
  if (!DRY && !NO_AI && apiKey && toSummarize.length) {
    console.log(`    🤖 genero ${toSummarize.length} riassunti brevi mancanti via Claude…`);
    let ok = 0, fail = 0;
    for (const s of toSummarize) {
      try {
        const bullets = await generateDigest(apiKey, s);
        if (bullets.length) { DIGESTS[s.id] = bullets; ok++; }
        else fail++;
      } catch (e) {
        console.warn(`      ⚠ "${(s.title || "").slice(0, 40)}": ${e.message}`);
        fail++;
      }
    }
    // salva la cache così non li rigeneriamo (e non li ripaghiamo) al prossimo sync
    try {
      fs.writeFileSync(
        path.join(__dirname, "session-digests.json"),
        JSON.stringify(DIGESTS, null, 2),
        "utf8"
      );
    } catch (e) { console.warn("      ⚠ salvataggio cache: " + e.message); }
    console.log(`    🤖 generati:${ok}  falliti:${fail}`);
  } else if (!DRY && toSummarize.length) {
    const why = NO_AI ? "(--no-ai)" : apiKey ? "" : "(nessuna chiave AI trovata)";
    console.log(`    ⏭  ${toSummarize.length} riassunti brevi restano col placeholder ${why}`);
  }

  // bersagli ordinati dal più lungo al più corto (match preferenziale ai nomi lunghi)
  const targetsSorted = [...linkTargets.values()].sort(
    (a, b) => b.name.length - a.name.length
  );

  function findMentions(plainText, partyKey) {
    const hayNorm = norm(plainText);
    const found = new Map(); // title -> displayName
    for (const t of targetsSorted) {
      const k = norm(t.name);
      // confine "morbido": niente lettere/numeri attorno
      const re = new RegExp(
        `(^|[^\\p{L}\\p{N}'])${escapeRe(k)}([^\\p{L}\\p{N}']|$)`,
        "u"
      );
      if (re.test(hayNorm)) {
        if (!found.has(t.title)) found.set(t.title, t.name);
      }
    }
    return [...found.entries()].map(([title]) => title);
  }

  let sesCreated = 0;
  ordered.forEach((s, i) => {
    const num = String(i + 1).padStart(3, "0");
    const rawTitle = (s.title || "Senza titolo").trim();
    const fileTitle = safeFile(`${num} - ${rawTitle}`);
    const party = partyByKey[s.party];
    const plain = htmlToMd(s.content || "");

    if (party && sessionsByParty[party.key]) {
      sessionsByParty[party.key].push({ fileTitle, rawTitle, num });
    }

    // collegamenti: party + entità nominate nel testo
    const mentioned = findMentions(`${rawTitle} ${s.subTitle || ""} ${plain}`, s.party);
    const links = [];
    if (party) links.push(`[[${party.label}]]`);
    for (const t of mentioned) links.push(`[[${t}]]`);
    const uniqLinks = [...new Set(links)];

    const fm = [
      "---",
      "generato: auto",
      "tipo: sessione",
      `source_id: ${s.id}`,
      `numero: ${i + 1}`,
      `titolo: ${yamlEscape(rawTitle)}`,
      party ? `party: ${yamlEscape(party.label)}` : null,
      s.date ? `data: ${yamlEscape(s.date)}` : null,
      s.order != null && s.order !== "" ? `order: ${yamlEscape(String(s.order))}` : null,
      "---",
    ].filter(Boolean).join("\n");

    const digest = DIGESTS[s.id];
    const breve = Array.isArray(digest) && digest.length
      ? digest.map((b) => `- ${b}`).join("\n")
      : "_(riassunto breve non ancora generato — chiedi a Claude: «aggiorna i riassunti Obsidian»)_";

    const body = [
      `# ${rawTitle}`,
      s.subTitle ? `*${s.subTitle.trim()}*` : "",
      [party ? `**Gruppo:** [[${party.label}]]` : "", s.date ? `**Data:** ${s.date}` : ""]
        .filter(Boolean).join("  ·  "),
      "",
      "## In breve",
      breve,
      "",
      "## Collegamenti",
      uniqLinks.length ? uniqLinks.join(" · ") : "_Nessun collegamento rilevato._",
      "",
      "## Resoconto completo",
      plain || "_Vuoto._",
      "",
      "---",
      "> [!info] Nota generata automaticamente dai riassunti del sito (`summaries`). «In breve» è scritto dall'AI; il «Resoconto completo» è il testo originale. I [[link]] sono dedotti dal testo. Il corpo viene riscritto a ogni sync.",
    ].filter((x) => x !== "").join("\n");

    writeAuto(path.join("Sessioni", `${fileTitle}.md`), `${fm}\n\n${body}\n`);
    sesCreated++;
  });

  /* ── ora che conosco le sessioni per party, scrivo gli hub ── */
  for (const p of PARTIES) {
    const members = p.roster.split(",").map((x) => x.trim()).filter(Boolean);
    const memberLinks = members
      .map((m) => (m.toLowerCase() === "cronache globali" ? m : linkOrText(m)))
      .join(" · ");
    const ses = sessionsByParty[p.key] || [];
    const sesList = ses.length
      ? ses.map((x) => `- [[${x.fileTitle}|${x.num} · ${x.rawTitle}]]`).join("\n")
      : "_Nessuna sessione registrata._";
    const fm = [
      "---",
      "generato: auto",
      "tipo: party",
      `chiave: ${p.key}`,
      `nome: ${yamlEscape(p.label)}`,
      "---",
    ].join("\n");
    const body = [
      `# ${p.label}`,
      p.key !== "Unico" ? `**Membri:** ${memberLinks}` : "_Cronache globali del mondo._",
      "",
      `## Sessioni (${ses.length})`,
      sesList,
      "",
      "---",
      "> [!info] Hub di gruppo generato automaticamente.",
    ].filter((x) => x !== "").join("\n");
    writeAuto(path.join("Party", `${safeFile(p.label)}.md`), `${fm}\n\n${body}\n`);
  }

  /* ── indice (MOC) ── */
  const moc = [
    "---",
    "generato: auto",
    "tipo: indice",
    "---",
    "",
    "# 🗺️ Indice automatico — Eldoria",
    "",
    "_Tutto ciò che sta qui sotto è generato da Firestore. Le tue note restano fuori da `_Auto/` e vengono linkate, non toccate._",
    "",
    "## Gruppi",
    PARTIES.map((p) => `- [[${safeFile(p.label)}]]`).join("\n"),
    "",
    "## Sessioni",
    ordered.map((s, i) => {
      const num = String(i + 1).padStart(3, "0");
      return `- [[${safeFile(`${num} - ${(s.title || "Senza titolo").trim()}`)}|${num} · ${(s.title || "Senza titolo").trim()}]]`;
    }).join("\n") || "_Nessuna._",
    "",
    `> Ultimo sync: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
    "",
  ].join("\n");
  writeAuto("_Indice.md", moc);

  /* ── --graph: imposta i gruppi di colore del grafo Obsidian ── */
  if (GRAPH) {
    // note dei giocatori = tue note che corrispondono ai roster dei party
    const playerTitles = new Set();
    for (const p of PARTIES) {
      for (const m of p.roster.split(",").map((x) => x.trim())) {
        if (!m || m.toLowerCase() === "cronache globali") continue;
        const t = existingLinkFor(m);
        if (t) playerTitles.add(t);
      }
    }
    const grp = (query, hex) => ({ query, color: { a: 1, rgb: parseInt(hex, 16) } });
    const groups = [];
    if (playerTitles.size) {
      const q = [...playerTitles].map((t) => `file:"${t}"`).join(" OR ");
      groups.push(grp(q, "9b6bd1")); // Giocatori — viola
    }
    groups.push(grp('path:"_Auto/Sessioni"', "5b8fd6"));  // Sessioni — blu
    groups.push(grp('path:"_Auto/NPC"', "5bb98c"));       // NPC — verde
    groups.push(grp('path:"_Auto/Luoghi"', "d99a3c"));    // Luoghi — arancio
    groups.push(grp('path:"_Auto/Party"', "c0432b"));     // Gruppi — rosso
    groups.push(grp('path:"_Auto/Incarichi"', "d4b13a")); // Incarichi — oro
    groups.push(grp('file:"_Indice"', "8a8a8a"));         // Indice — grigio

    const graphPath = path.join(VAULT, ".obsidian", "graph.json");
    let cfg = {};
    if (fs.existsSync(graphPath)) {
      try { cfg = JSON.parse(fs.readFileSync(graphPath, "utf8")); } catch { cfg = {}; }
      const bak = graphPath + ".bak";
      if (!fs.existsSync(bak)) fs.copyFileSync(graphPath, bak); // backup una tantum
    }
    cfg.colorGroups = groups;
    cfg["collapse-color-groups"] = false; // tieni aperta la legenda dei colori
    // forze per separare meglio i grappoli
    cfg.repelStrength = 15;
    cfg.linkDistance = 120;
    cfg.centerStrength = 0.3;
    cfg.linkStrength = 0.8;
    if (!DRY) {
      fs.mkdirSync(path.dirname(graphPath), { recursive: true });
      fs.writeFileSync(graphPath, JSON.stringify(cfg, null, 2), "utf8");
      console.log(`    🎨 graph.json: ${groups.length} gruppi di colore (giocatori riconosciuti: ${playerTitles.size}).`);
    } else {
      console.log(`    [dry] aggiornerei graph.json con ${groups.length} gruppi di colore.`);
    }
  }

  console.log("\n✅  Fatto.");
  console.log(`    Party hub : ${PARTIES.length}`);
  console.log(`    Sessioni  : ${sesCreated}`);
  console.log(`    NPC creati: ${npcCreated}   (linkati alle tue note: ${npcLinkedToYours})`);
  console.log(`    Luoghi    : ${locCreated}`);
  console.log(`    Incarichi : ${questCreated}`);
  console.log(`    File scritti in _Auto/: ${written}`);
  if (DRY) console.log("    (DRY RUN: nessun file scritto davvero)");
  process.exit(0);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((e) => {
  console.error("✖ Errore:", e);
  process.exit(1);
});
