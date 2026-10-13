#!/usr/bin/env node
/**
 * obsidian-ascolto.mjs — "Orecchio del Master"
 * ------------------------------------------------------------------
 * Durante la sessione ascolta il microfono (riconoscimento vocale di
 * Chrome/Edge, in italiano) e apre da solo le note giuste in Obsidian:
 *
 *   "npc" / "personaggi"           → _Auto/Indici/Indice NPC
 *   "taverna" / "locanda" / "oste" → _Auto/Indici/Indice Taverne
 *   "luogo" / "luoghi"             → _Auto/Indici/Indice Luoghi
 *   "incarico" / "missione"        → _Auto/Indici/Indice Incarichi
 *   "ultima sessione"              → la sessione più recente
 *   il NOME di un NPC, luogo o incarico → la sua nota
 *
 * Il server gira su 127.0.0.1 (localhost = contesto sicuro, il microfono
 * funziona) e apre le note col protocollo obsidian:// dal PC stesso:
 * niente blocchi del browser sui link aperti senza clic.
 *
 *   node tools/obsidian-ascolto.mjs            (o doppio clic su orecchio-obsidian.bat)
 *   --port 5199   --vault "C:\\percorso\\vault"   --no-browser
 *
 * Le note-indice le scrive obsidian-sync.mjs (le tiene aggiornate il sorvegliante).
 * ------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const PORT = Number(argOf("--port")) || 5199;
const COOLDOWN_MS = 45_000; // la stessa nota non si riapre prima di così

function findVault() {
  try {
    const cfg = path.join(process.env.APPDATA || "", "obsidian", "obsidian.json");
    const vaults = Object.values(JSON.parse(fs.readFileSync(cfg, "utf8")).vaults || {})
      .filter((v) => v.path && fs.existsSync(v.path))
      .sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0) || (b.ts || 0) - (a.ts || 0));
    if (vaults.length) return vaults[0].path;
  } catch { /* Obsidian mai aperto su questo PC */ }
  return path.join(process.env.USERPROFILE || "", "Documents", "Obsidian Vault");
}
const VAULT = argOf("--vault") || findVault();
const AUTO = path.join(VAULT, "_Auto");

/* ───────────── testo ───────────── */

// minuscolo, senza accenti né punteggiatura: "Thelén Dhir," → "thelen dhir"
function norm(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[´`’‘ʼ']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Parole che non devono mai far scattare un nome da sole.
const STOP = new Set(("della delle dello degli dei del nella nelle sulla sotto sopra dove come quando " +
  "questo questa quello quella mentre allora ancora sempre tutti tutte molto poco prima dopo " +
  "capitano signore signora maestro mastro padre madre fratello sorella vecchio vecchia grande " +
  "piccolo nero nera bianco bianca rosso rossa foresta montagne montagna villaggio clan torre " +
  "fucine lago porto isola regno citta castello tempio bosco valle passo ponte").split(" "));

/* ───────────── categorie ───────────── */

const CATEGORIES = [
  { key: "npc", label: "NPC", re: /\b(npc|n p c|enne pi ci|png|personaggi|personaggio)\b/, file: "Indici/Indice NPC.md" },
  { key: "taverne", label: "Taverne", re: /\b(tavern\w*|locand\w*|osteri\w*|oste|ostessa|bettol\w*)\b/, file: "Indici/Indice Taverne.md" },
  { key: "luoghi", label: "Luoghi", re: /\b(luogo|luoghi)\b/, file: "Indici/Indice Luoghi.md" },
  { key: "incarichi", label: "Incarichi", re: /\b(incaric\w*|mission\w*|quest)\b/, file: "Indici/Indice Incarichi.md" },
  { key: "sessione", label: "Ultima sessione", re: /\b(ultima sessione|sessione precedente|scorsa sessione)\b/, file: null },
];

/* ───────────── indice delle note (riletto dal disco ogni 30 s) ───────────── */

let cache = { at: 0, names: [], lastSession: null };

function readFrontName(full) {
  try {
    const head = fs.readFileSync(full, "utf8").slice(0, 600);
    const m = head.match(/^(?:nome|titolo):\s*"?(.+?)"?\s*$/m);
    return m ? m[1] : null;
  } catch { return null; }
}

// Le tue note scritte a mano (fuori da _Auto/) che non hanno un nome utile a voce.
const SKIP_OWN = /^(untitled|link|calendario|crafting|\d)/i;

function buildIndex() {
  if (Date.now() - cache.at < 30_000) return cache;
  const entries = []; // { name, rel (dalla radice della vault), label, kind }
  for (const [dir, kind] of [["NPC", "NPC"], ["Luoghi", "Luogo"], ["Incarichi", "Incarico"]]) {
    const abs = path.join(AUTO, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith(".md")) continue;
      const title = f.slice(0, -3);
      const name = readFrontName(path.join(abs, f)) || title;
      entries.push({ name, rel: `_Auto/${dir}/${f}`, label: title, kind });
    }
  }
  // le tue note nella radice della vault ("Khorvash", "Tanagar - clan dei dentati - AXEL"…)
  for (const f of fs.existsSync(VAULT) ? fs.readdirSync(VAULT) : []) {
    if (!f.endsWith(".md") || SKIP_OWN.test(f)) continue;
    const title = f.slice(0, -3);
    entries.push({ name: title, rel: f, label: title, kind: "Nota tua" });
  }
  // chiavi: nome intero, parte prima della virgola, primo nome (se lungo, non comune e unico)
  const keys = [];
  const firstCount = new Map();
  for (const e of entries) {
    const first = norm(e.name).split(" ")[0];
    firstCount.set(first, (firstCount.get(first) || 0) + 1);
  }
  for (const e of entries) {
    const full = norm(e.name);
    const variants = new Set([full, norm(e.name.split(",")[0]), norm(e.name.split(/\s+[-–—]\s+/)[0])]);
    const first = full.split(" ")[0];
    if (first.length >= 4 && !STOP.has(first) && firstCount.get(first) === 1) variants.add(first);
    for (const k of variants) if (k.length >= 3 && !STOP.has(k)) keys.push({ key: k, ...e });
  }
  keys.sort((a, b) => b.key.length - a.key.length); // prima i nomi lunghi

  let lastSession = null;
  const ses = path.join(AUTO, "Sessioni");
  if (fs.existsSync(ses)) {
    const files = fs.readdirSync(ses).filter((f) => /^\d+ - .*\.md$/.test(f)).sort();
    if (files.length) lastSession = `_Auto/Sessioni/${files[files.length - 1]}`;
  }
  cache = { at: Date.now(), names: keys, lastSession };
  return cache;
}

/* ───────────── cosa aprire per una frase ───────────── */

function matchText(text) {
  const t = ` ${norm(text)} `;
  const idx = buildIndex();
  const hits = [];
  for (const c of CATEGORIES) {
    if (!c.re.test(t)) continue;
    const rel = c.file ? `_Auto/${c.file}` : idx.lastSession;
    if (rel) hits.push({ rel, label: c.label, kind: "Categoria" });
  }
  let rest = t;
  for (const n of idx.names) {
    const k = ` ${n.key} `;
    if (!rest.includes(k)) continue;
    rest = rest.replace(k, " ¦ "); // "thelen dhir" non fa scattare anche "thelen"
    if (!hits.some((h) => h.rel === n.rel)) hits.push({ rel: n.rel, label: n.label, kind: n.kind });
  }
  return hits;
}

/* ───────────── apertura in Obsidian ───────────── */

// Le note le apre il plugin "Eldoria · Orecchio" dentro Obsidian (API vere,
// pannello coi link): chiede /events ogni secondo. Se il plugin non si fa
// sentire da 5 s si ripiega sul link obsidian:// (che apre, ma senza pannello).
const lastOpened = new Map(); // rel -> ms
const events = [];
let eventSeq = 0;
let pluginSeenAt = 0;
const pluginAlive = () => Date.now() - pluginSeenAt < 5000;

function openInObsidian(hit, { newTab = true, force = false, heard = "" } = {}) {
  const rel = hit.rel;
  const abs = path.join(VAULT, rel);
  const relCheck = path.relative(VAULT, abs);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck) || !fs.existsSync(abs)) return "missing";
  const now = Date.now();
  if (!force && now - (lastOpened.get(rel) || 0) < COOLDOWN_MS) return "cooldown";
  lastOpened.set(rel, now);
  if (pluginAlive()) {
    events.push({ id: ++eventSeq, path: rel.replace(/\\/g, "/"), label: hit.label, kind: hit.kind, heard, newTab });
    if (events.length > 50) events.shift();
    return "opened";
  }
  const uri = `obsidian://open?path=${encodeURIComponent(abs)}`;
  if (process.platform === "win32") {
    spawn("rundll32", ["url.dll,FileProtocolHandler", uri], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [uri], { detached: true, stdio: "ignore" }).unref();
  }
  return "opened";
}

/* ───────────── installazione del plugin nella vault ───────────── */

function installPlugin() {
  const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "obsidian-plugin", "eldoria-orecchio");
  const cfgDir = path.join(VAULT, ".obsidian");
  if (!fs.existsSync(src) || !fs.existsSync(cfgDir)) return "skip";
  const dst = path.join(cfgDir, "plugins", "eldoria-orecchio");
  fs.mkdirSync(dst, { recursive: true });
  let changed = false;
  for (const f of ["manifest.json", "main.js", "styles.css"]) {
    const a = fs.readFileSync(path.join(src, f), "utf8");
    const target = path.join(dst, f);
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== a) { fs.writeFileSync(target, a, "utf8"); changed = true; }
  }
  const listFile = path.join(cfgDir, "community-plugins.json");
  let list = [];
  try { list = JSON.parse(fs.readFileSync(listFile, "utf8")); } catch { /* nessun plugin ancora */ }
  if (!list.includes("eldoria-orecchio")) {
    list.push("eldoria-orecchio");
    fs.writeFileSync(listFile, JSON.stringify(list, null, 2), "utf8");
    changed = true;
  }
  return changed ? "updated" : "ok";
}

/* ───────────── server ───────────── */

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 20_000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}

const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(PAGE);
  }
  if (req.method === "POST" && url.pathname === "/hear") {
    const { text = "", newTab = true, dry = false } = await readBody(req);
    const heard = String(text).trim();
    const hits = matchText(text).map((h) => ({ ...h, result: dry ? "dry" : openInObsidian(h, { newTab, heard }) }));
    for (const h of hits) if (h.result === "opened") console.log(`🔊 "${heard}" → ${h.label}`);
    return json(res, 200, { hits, plugin: pluginAlive() });
  }
  if (req.method === "POST" && url.pathname === "/open") {
    const { rel = "", label = "", kind = "", newTab = true } = await readBody(req);
    return json(res, 200, { result: openInObsidian({ rel, label: label || path.basename(rel, ".md"), kind }, { newTab, force: true }) });
  }
  if (req.method === "GET" && url.pathname === "/events") {
    pluginSeenAt = Date.now();
    const since = Number(url.searchParams.get("since")) || 0;
    // since più grande del contatore = il programma è stato riavviato
    return json(res, 200, { reset: since > eventSeq, events: events.filter((e) => e.id > since) });
  }
  if (req.method === "GET" && url.pathname === "/status") {
    return json(res, 200, { plugin: pluginAlive() });
  }
  json(res, 404, { error: "non trovato" });
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`L'Orecchio è già acceso: apro http://localhost:${PORT}`);
    if (!args.includes("--no-browser")) openBrowser();
    setTimeout(() => process.exit(0), 500);
  } else { console.error(e); process.exit(1); }
});

function openBrowser() {
  const u = `http://localhost:${PORT}`;
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", u], { detached: true, stdio: "ignore" }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [u], { detached: true, stdio: "ignore" }).unref();
}

server.listen(PORT, "127.0.0.1", () => {
  const idx = buildIndex();
  const inst = installPlugin();
  console.log("👂  Orecchio del Master");
  if (inst === "updated") console.log("    🔌 plugin \"Eldoria · Orecchio\" installato/aggiornato nella vault: riavvia Obsidian una volta (o Ctrl+P → \"Reload app without saving\").");
  console.log(`    vault : ${VAULT}`);
  console.log(`    nomi riconoscibili: ${new Set(idx.names.map((n) => n.rel)).size}`);
  console.log(`    pagina: http://localhost:${PORT}   (Chrome o Edge; Ctrl+C per spegnere)`);
  if (!fs.existsSync(path.join(AUTO, "Indici"))) console.log("    ⚠ mancano le note-indice: lancia una volta tools/sync-obsidian.bat");
  if (!args.includes("--no-browser")) openBrowser();
});

/* ───────────── pagina ───────────── */

const PAGE = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orecchio del Master</title>
<style>
:root{--bg:#0d0a0a;--card:#1a1517;--line:#3a2f2f;--ink:#ece5d6;--muted:#a89d8c;--el:#e0703a;--ok:#6fbf73;--warn:#d9a43c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,Segoe UI,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:1.5rem;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 20px}
.mic{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}
#btn{width:120px;height:120px;border-radius:50%;border:3px solid var(--el);background:var(--card);color:var(--ink);font-size:2.6rem;cursor:pointer}
#btn.on{background:var(--el);animation:pulse 1.6s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(224,112,58,.55)}100%{box-shadow:0 0 0 22px rgba(224,112,58,0)}}
#state{font-weight:600}#live{color:var(--muted);font-style:italic;min-height:1.4em;margin-top:4px}
label{color:var(--muted);font-size:.92rem;display:flex;gap:6px;align-items:center}
.box{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 14px;margin:14px 0}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips button,form button{background:#241d20;border:1px solid var(--line);color:var(--ink);border-radius:4px;padding:8px 12px;cursor:pointer;font:inherit}
.chips button:hover,form button:hover{border-color:var(--el)}
form{display:flex;gap:8px}input{flex:1;min-width:0;background:#120e0f;border:1px solid var(--line);color:var(--ink);border-radius:4px;padding:8px 10px;font:inherit}
ul{list-style:none;margin:0;padding:0}li{padding:8px 0;border-top:1px solid var(--line);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
li:first-child{border-top:0}.t{color:var(--muted);font-size:.85rem;min-width:3.5em}.heard{color:var(--muted);font-style:italic;flex-basis:100%}
li a{color:var(--el);cursor:pointer;text-decoration:underline}.kind{font-size:.75rem;color:var(--muted);border:1px solid var(--line);padding:0 5px;border-radius:3px}
.cool{color:var(--warn);font-size:.8rem}.err{color:#e06060}
h2{font-size:1rem;margin:0 0 8px;color:var(--muted);font-weight:600}
</style></head><body><main>
<h1>👂 Orecchio del Master</h1>
<p class="sub">Parla normalmente: quando sente <b>npc</b>, <b>taverna</b>, <b>luoghi</b>, <b>incarichi</b>, <b>ultima sessione</b> o il nome di un NPC, luogo o incarico, apre la nota in Obsidian.</p>
<div class="mic">
  <button id="btn" title="Ascolta / pausa (barra spaziatrice)">🎙</button>
  <div><div id="state">In pausa</div><div id="live"></div>
  <label><input type="checkbox" id="newtab" checked> apri in una nuova scheda di Obsidian</label>
  <div id="plug" class="t"></div></div>
</div>
<div class="box"><h2>Apri subito</h2><div class="chips">
  <button data-say="npc">🧑 NPC</button><button data-say="taverna">🍺 Taverne</button>
  <button data-say="luoghi">🗺️ Luoghi</button><button data-say="incarichi">📜 Incarichi</button>
  <button data-say="ultima sessione">📖 Ultima sessione</button></div>
  <form id="f" style="margin-top:10px"><input id="q" placeholder="oppure scrivi un nome…"><button>Apri</button></form>
</div>
<div class="box"><h2>Aperte finora</h2><ul id="log"><li class="t">Ancora niente.</li></ul></div>
</main><script>
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const btn = document.getElementById("btn"), state = document.getElementById("state"), live = document.getElementById("live");
const log = document.getElementById("log"), newtab = document.getElementById("newtab");
let on = false, rec = null, empty = true;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now = () => new Date().toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"});

async function hear(text, manual) {
  const r = await fetch("/hear", {method:"POST", body: JSON.stringify({text, newTab: newtab.checked})}).then((x) => x.json()).catch(() => null);
  if (!r) { addRow(text, [], "Il programma sul PC non risponde: è ancora acceso?"); return; }
  if (r.hits.length || manual) addRow(text, r.hits, r.hits.length ? "" : "Nessuna nota corrisponde.");
}
function addRow(text, hits, err) {
  if (empty) { log.innerHTML = ""; empty = false; }
  const li = document.createElement("li");
  li.innerHTML = '<span class="t">' + now() + '</span>' +
    hits.map((h) => '<span><a data-rel="' + esc(h.rel) + '">' + esc(h.label) + '</a> <span class="kind">' + esc(h.kind) + '</span>' +
      (h.result === "cooldown" ? ' <span class="cool">già aperta da poco</span>' : h.result === "missing" ? ' <span class="err">nota mancante</span>' : '') + '</span>').join("") +
    (err ? '<span class="err">' + esc(err) + '</span>' : '') + '<span class="heard">“' + esc(text) + '”</span>';
  log.prepend(li);
}
log.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-rel]"); if (!a) return;
  fetch("/open", {method:"POST", body: JSON.stringify({rel: a.dataset.rel, label: a.textContent, newTab: newtab.checked})});
});
document.querySelectorAll("[data-say]").forEach((b) => b.onclick = () => hear(b.dataset.say, true));
document.getElementById("f").onsubmit = (e) => { e.preventDefault(); const q = document.getElementById("q"); if (q.value.trim()) hear(q.value, true); q.value = ""; };

const plug = document.getElementById("plug");
async function checkPlugin() {
  const r = await fetch("/status").then((x) => x.json()).catch(() => null);
  plug.innerHTML = !r ? '<span class="err">Il programma sul PC è spento.</span>'
    : r.plugin ? '🟢 Obsidian collegato: le note si aprono e finiscono nel pannello «Orecchio».'
    : '🟡 Obsidian non collegato: apro col link (riavvia Obsidian una volta per attivare il plugin).';
}
checkPlugin(); setInterval(checkPlugin, 5000);

function start() {
  if (!SR) { state.textContent = "Questo browser non sa ascoltare: usa Chrome o Edge."; return; }
  rec = new SR(); rec.lang = "it-IT"; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) hear(res[0].transcript, false); else interim += res[0].transcript;
    }
    live.textContent = interim;
  };
  rec.onerror = (ev) => {
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { stop(); state.textContent = "Microfono negato: consentilo dall'icona nella barra degli indirizzi."; }
  };
  rec.onend = () => { if (on) { try { rec.start(); } catch {} } };
  on = true; btn.classList.add("on"); state.textContent = "In ascolto…";
  try { rec.start(); } catch {}
}
function stop() { on = false; btn.classList.remove("on"); state.textContent = "In pausa"; live.textContent = ""; try { rec && rec.stop(); } catch {} }
btn.onclick = () => on ? stop() : start();
document.addEventListener("keydown", (e) => { if (e.code === "Space" && e.target.tagName !== "INPUT") { e.preventDefault(); btn.click(); } });
</script></body></html>`;
