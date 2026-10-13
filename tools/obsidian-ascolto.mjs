#!/usr/bin/env node
/**
 * obsidian-ascolto.mjs — "Orecchio del Master"
 * ------------------------------------------------------------------
 * Durante la sessione ascolta il microfono (riconoscimento vocale di
 * Chrome/Edge, in italiano) e apre da solo le note giuste in Obsidian.
 * Non bada alla frase: pesca solo le PAROLE GIUSTE.
 *
 *   categorie   npc · personaggi/eroi · luoghi · taverne · incarichi ·
 *               sessioni · ultima sessione · sessione 12 · gruppo AMEA…
 *   nomi        ogni nota della vault: NPC, luoghi, incarichi, personaggi
 *               dei giocatori (_Auto) e le tue note, cartelle comprese,
 *               anche per alias e solo nome proprio ("Garroth", "Elarwyn").
 *               Tollera i nomi storpiati dal riconoscimento vocale
 *               ("corvash" → Khorvash, "telarion" → Tel'Arion).
 *
 * Le note le apre il plugin di Obsidian "Eldoria · Orecchio" (si installa da
 * solo nella vault), che le raccoglie anche nel pannello laterale.
 *
 *   node tools/obsidian-ascolto.mjs            (o doppio clic su orecchio-obsidian.bat)
 *   --port 5199   --vault "C:\\percorso\\vault"   --no-browser
 *
 * Le note-indice e le schede dal sito le scrive obsidian-sync.mjs (le tiene
 * aggiornate il sorvegliante).
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

// Forma "fonetica": il riconoscimento vocale scrive i nomi fantasy come li
// sente, quindi Khorvash ≈ corvash ≈ korvas, Garroth ≈ garrot, Sylva ≈ silva.
function phon(w) {
  return w
    .replace(/ph/g, "f").replace(/sch/g, "sk").replace(/sh/g, "s")
    .replace(/c(?=[ei])/g, "C").replace(/c|q/g, "k").replace(/C/g, "c")
    .replace(/y/g, "i").replace(/w/g, "v").replace(/j/g, "i").replace(/x/g, "ks").replace(/z/g, "s")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
}

// "Scheletro" ancora più largo, per la R moscia e le pronunce diverse:
// niente R (la moscia il riconoscimento la perde o la cambia), finali
// all'inglese ("-dale" detto "del"), vocali doppie, vocale finale troncata.
//   Tirrendale ≈ tirrendel ≈ tiendel · Nolborg ≈ nolbog ≈ nolbo
function skel(w) {
  return phon(w)
    .replace(/ale$/, "el").replace(/ae|ai|ei/g, "e").replace(/ou|oo/g, "u").replace(/ee|ea/g, "i")
    .replace(/r/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/[aeiou]+$/, "");
}

// Quanto somiglia una parola detta a una parola del nome (0 = per niente).
function wordScore(spoken, keyWord) {
  const a = phon(spoken), b = phon(keyWord);
  if (a === b) return 1;
  const tolP = tolerance(Math.min(a.length, b.length));
  if (tolP > 0 && lev(a, b, tolP) <= tolP) return 0.9;
  const sa = skel(spoken), sb = skel(keyWord);
  if (sa.length < 3 || sb.length < 3) return 0;
  if (sa === sb) return 0.85;
  const tolS = tolerance(Math.min(sa.length, sb.length)); // "tivendel" ≈ "tiendel", ma "velen" ≠ "telen"
  if (tolS > 0 && lev(sa, sb, tolS) <= tolS) return 0.75;
  // nome troncato a voce: "nolbo" → Nolborg (almeno 4 lettere e due terzi del nome)
  if (sa.length >= 4 && sb.length >= 6 && sb.startsWith(sa) && sa.length / sb.length >= 0.65) return 0.7;
  return 0;
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Quanto può sbagliare il riconoscimento su un nome lungo n lettere.
const tolerance = (n) => (n >= 9 ? 2 : n >= 6 ? 1 : 0);

// Parole comuni: non fanno MAI scattare un nome da sole e non vengono mai
// "corrette" in un nome (danno ≠ Ganno, ferro ≠ Montagne di Ferro).
const COMMON = new Set((
  "il lo la i gli le un uno una di da in con su per tra fra a e o ma se che chi non si ci vi ne mi ti " +
  "del della dello dei degli delle al allo alla ai agli alle dal dalla dai dalle nel nella nei nelle " +
  "sul sulla sui sulle col coi questo questa questi queste quello quella quelli quelle dove come quando " +
  "mentre allora ancora sempre tutti tutte tutto molto poco prima dopo sotto sopra dentro fuori vicino " +
  "lontano davanti dietro qui qua li la poi gia mai piu meno bene male cosa casa cose fatto fare dire " +
  "vedere andare venire stare avere essere sono sei siamo siete era erano sara voi noi loro lui lei " +
  "ecco eco anno anni danno danni dado dadi tiro tiri turno turni punto punti vita morte morto morti " +
  "capitano signore signora maestro mastro padre madre fratello sorella figlio figlia re regina " +
  "principe principessa lord lady sir vecchio vecchia grande grandi piccolo piccola nuovo nuova antico " +
  "antica nero nera neri bianco bianca rosso rossa verde blu grigio grigia oro argento ferro pietra " +
  "foresta montagne montagna monte villaggio citta clan torre torri fucine fucina lago porto isola " +
  "regno castello tempio bosco valle passo ponte mare fiume strada piazza mercato casa porta muro " +
  "mano mani occhio occhi sangue neve fuoco acqua aria terra luce ombra notte giorno sole luna stelle " +
  "cielo vento drago draghi lupo lupi orco orchi elfo elfi nano nani demone demoni angelo dio dei dea " +
  "spada spade arco scudo ascia magia incantesimo pozione libro tomo chiave anello corona trono " +
  "secco salata salato spezzata spezzato melodia boccafuoco caldovino contanote " +
  "parlate parlare entrate entrare arrivate arrivare andate guardate sentite trovate vedete dite " +
  "ragazzi allora okay ok va bene si no forse adesso ora subito momento attenzione " +
  "giocatori giocatore personaggio personaggi npc png luogo luoghi taverna taverne locanda incarico " +
  "incarichi missione missioni sessione sessioni gruppo party compagnia indice ultima ultimo scorsa"
).split(" "));

// Il resto dell'italiano lo impara dalla vault: una parola che nelle tue
// cronache compare scritta minuscola in mezzo alla frase è una parola comune
// ("senza", "veleno", "campo"); i nomi propri compaiono con la maiuscola.
let DICT = new Set();
const isCommon = (w) => COMMON.has(w) || DICT.has(w);
function learnDict(texts) {
  const low = new Map(), cap = new Map();
  for (const txt of texts) {
    const body = txt
      .replace(/^---[\s\S]*?\n---/, " ")   // proprietà
      .replace(/\[\[[^\]]*\]\]/g, " ")      // [[link]]: sono nomi di note
      .replace(/\]\([^)]*\)/g, "] ");       // indirizzi dei link
    for (const sentence of body.split(/[.!?:;\n"«»#>*_()[\]|-]+/)) {
      const ws = sentence.match(/[A-Za-zÀ-ÿ]{3,}/g) || [];
      for (let i = 1; i < ws.length; i++) { // la prima parola della frase ha la maiuscola comunque
        const w = ws[i];
        const n = norm(w);
        if (w[0] === w[0].toLowerCase()) low.set(n, (low.get(n) || 0) + 1);
        else cap.set(n, (cap.get(n) || 0) + 1);
      }
    }
  }
  const d = new Set();
  for (const [w, c] of low) if (c >= 2 && c >= (cap.get(w) || 0)) d.add(w);
  return d;
}

/* ───────────── numeri a voce ("sessione dodici") ───────────── */

const NUMBERS = (() => {
  const u = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
  const teens = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
  const tens = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
  const m = new Map();
  u.forEach((w, i) => i && m.set(w, i));
  teens.forEach((w, i) => m.set(w, 10 + i));
  for (let t = 2; t <= 9; t++) for (let k = 0; k <= 9; k++) {
    const base = k === 1 || k === 8 ? tens[t].slice(0, -1) : tens[t];
    m.set(base + u[k], t * 10 + k);
  }
  m.set("primo", 1); m.set("prima", 1);
  return m;
})();
const numOf = (w) => (/^\d+$/.test(w) ? Number(w) : NUMBERS.get(w) || null);

/* ───────────── categorie ───────────── */

const CATEGORIES = [
  { label: "NPC", re: /\b(npc|n p c|enne pi ci|png)\b/, file: "_Auto/Indici/Indice NPC.md" },
  { label: "Personaggi", re: /\b(personaggi|eroi|giocatori|pg|pi gi)\b/, file: "_Auto/Indici/Indice Personaggi.md" },
  { label: "Taverne", re: /\b(tavern\w*|locand\w*|osteri\w*|oste|ostessa|bettol\w*)\b/, file: "_Auto/Indici/Indice Taverne.md" },
  { label: "Luoghi", re: /\b(luogo|luoghi)\b/, file: "_Auto/Indici/Indice Luoghi.md" },
  { label: "Incarichi", re: /\b(incaric\w*|mission\w*|quest)\b/, file: "_Auto/Indici/Indice Incarichi.md" },
  { label: "Sessioni", re: /\b(sessioni|cronache)\b/, file: "_Auto/_Indice.md" },
  { label: "Ultima sessione", re: /\b(ultima sessione|sessione precedente|scorsa sessione|sessione scorsa)\b/, last: true },
];

/* ───────────── indice di TUTTA la vault (riletto dal disco ogni 30 s) ───────────── */

let cache = { at: 0, keys: [], sessions: new Map(), lastSession: null, parties: new Map() };

const KIND_BY_DIR = { NPC: "NPC", Luoghi: "Luogo", Incarichi: "Incarico", Personaggi: "Personaggio", Sessioni: "Sessione", Party: "Gruppo" };
const SKIP_OWN = /^(untitled|link|calendario|\d)/i; // note tue senza un nome utile a voce

function readFront(full) {
  try {
    const txt = fs.readFileSync(full, "utf8");
    if (!txt.startsWith("---")) return {};
    const fm = txt.slice(3, txt.indexOf("\n---", 3));
    const one = (k) => fm.match(new RegExp(`^${k}:\\s*"?(.+?)"?\\s*$`, "m"))?.[1] || null;
    let aliases = [];
    const inline = fm.match(/^(?:aliases|alias):\s*\[(.*)\]\s*$/m);
    if (inline) aliases = inline[1].split(",");
    else {
      const block = fm.match(/^(?:aliases|alias):\s*\n((?:\s*-\s*.+\n?)+)/m);
      if (block) aliases = block[1].split("\n").map((l) => l.replace(/^\s*-\s*/, ""));
      else if (one("aliases")) aliases = [one("aliases")];
    }
    return { nome: one("nome") || one("titolo"), aliases: aliases.map((a) => a.trim().replace(/^["']|["']$/g, "")).filter(Boolean) };
  } catch { return {}; }
}

function walkVault(dir, out) {
  let list;
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of list) {
    if (e.name.startsWith(".")) continue; // .obsidian, .trash
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkVault(full, out);
    else if (e.name.toLowerCase().endsWith(".md")) out.push(full);
  }
}

// "Tanagar - clan dei dentati - AXEL" → ["tanagar clan dei dentati axel", "tanagar"]
const PERSONE = new Set(["NPC", "Personaggio", "Nota tua"]);
function nameVariants(name, kind) {
  const v = new Set();
  const add = (s) => { const n = norm(s); if (n.length >= 3 && !isCommon(n)) v.add(n); };
  add(name);
  add(name.split(",")[0]);
  add(name.split(/\s+[-–—]\s+/)[0]);
  add(name.replace(/\([^)]*\)/g, ""));
  const toks = norm(name.split(/\s+[-–—]\s+|,/)[0]).split(" ");
  const proper = toks.filter((t) => t.length >= 4 && !isCommon(t));
  // il primo nome ("Garroth"), o l'ultimo se il primo è un titolo ("Foresta di Elarwyn" → elarwyn)
  // gli incarichi solo per la prima parola che conta ("il mulino che macina al buio" → mulino, mai "buio")
  if (proper.length) { add(proper[0]); if (isCommon(toks[0]) && kind !== "Incarico") add(proper[proper.length - 1]); }
  // per le persone anche il cognome: "Rojas", "Nightwhisper", "Tel'Arion"
  if (PERSONE.has(kind) && toks.length >= 2 && toks.length <= 4) {
    const last = toks[toks.length - 1];
    if (last.length >= 4 && !isCommon(last)) add(last);
    const two = toks.slice(-2);
    if (toks.length >= 3 && two.join("").length >= 6 && !two.some((t) => isCommon(t))) add(two.join(" "));
  }
  return [...v];
}

function buildIndex() {
  if (Date.now() - cache.at < 30_000) return cache;
  const files = [];
  walkVault(VAULT, files);
  const texts = [];
  for (const f of files) { try { texts.push(fs.readFileSync(f, "utf8")); } catch { /* file sparito */ } }
  DICT = learnDict(texts);
  const raw = []; // { variant, rel, label, kind }
  const sessions = new Map();
  const parties = new Map();
  for (const full of files) {
    const rel = path.relative(VAULT, full).split(path.sep).join("/");
    const label = path.basename(full, ".md");
    const parts = rel.split("/");
    const inAuto = parts[0] === "_Auto";
    if (inAuto && (parts[1] === "Indici" || parts.length === 2)) continue; // indici e _Indice
    const kind = inAuto ? KIND_BY_DIR[parts[1]] || "Nota" : "Nota tua";
    if (kind === "Sessione") { const n = Number(label.match(/^(\d+)/)?.[1]); if (n) sessions.set(n, rel); continue; }
    if (kind === "Gruppo") { parties.set(norm(label), rel); continue; }
    if (!inAuto && SKIP_OWN.test(label)) continue;
    const fm = readFront(full);
    const names = [label, fm.nome, ...(fm.aliases || [])].filter(Boolean);
    const seen = new Set();
    for (const n of names) for (const variant of nameVariants(n, kind)) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      raw.push({ variant, rel, label, kind });
    }
  }
  // stessa chiave su più note (Caius sul sito + la tua nota su Caius): le apre tutte, fino a 3
  const byVariant = new Map();
  for (const r of raw) {
    if (!byVariant.has(r.variant)) byVariant.set(r.variant, []);
    byVariant.get(r.variant).push(r);
  }
  const keys = [];
  for (const [variant, all] of byVariant) {
    // "Emberwood" apre Emberwood, non anche "Le candele di Emberwood";
    // "Lael" apre Lael e la scheda "Lael Alliata" (stesso nome all'inizio)
    const exact = all.some((n) => norm(n.label) === variant);
    const notes = exact ? all.filter((n) => norm(n.label).startsWith(variant)) : all;
    if (notes.length > 3) continue;
    keys.push(makeKey(variant, notes));
  }
  keys.sort((a, b) => b.toks.length - a.toks.length || b.variant.length - a.variant.length);
  // le pronunce insegnate a mano vincono su tutto
  const taught = [];
  for (const [heard, rels] of Object.entries(loadTaught())) {
    const notes = rels.filter((r) => fs.existsSync(path.join(VAULT, r)))
      .map((r) => ({ rel: r, label: path.basename(r, ".md"), kind: kindOf(r) }));
    if (notes.length) taught.push({ ...makeKey(heard, notes), taught: true });
  }
  const nums = [...sessions.keys()].sort((a, b) => a - b);
  cache = { at: Date.now(), keys: [...taught, ...keys], sessions, parties, lastSession: nums.length ? sessions.get(nums[nums.length - 1]) : null };
  return cache;
}

function makeKey(variant, notes) {
  const toks = variant.split(" ");
  return { variant, toks, joined: toks.join(""), notes };
}

function kindOf(rel) {
  const parts = rel.split("/");
  return parts[0] === "_Auto" ? KIND_BY_DIR[parts[1]] || "Nota" : "Nota tua";
}

// Quale nota è "la pagina" di un nome: prima quella che si chiama così
// (o comincia così: "Garroth Tel'Arion"), poi la tua nota su quella cosa,
// poi luoghi/NPC/personaggi; incarichi e note che lo citano solo nel titolo per ultimi.
const KIND_RANK = { "Luogo": 1, "NPC": 1, "Nota tua": 1, "Personaggio": 2, "Gruppo": 3, "Incarico": 4, "Nota": 5 };
function rankNotes(notes, variant) {
  const score = (n) => {
    const l = norm(n.label);
    // la tua nota su un PG ("Tanagar - clan dei dentati - AXEL") vince sulla scheda dal sito
    const head = l.startsWith(variant) ? 0 : 20;
    return head + (KIND_RANK[n.kind] || 5) + (l === variant ? 0 : 0.5);
  };
  return [...notes].sort((a, b) => score(a) - score(b));
}

/* ───────────── pronunce insegnate ("quando dico nolbo apri Nolborg") ─────────────
   Stanno nella cartella del plugin dentro la vault: viaggiano con la vault. */

const TAUGHT_FILE = path.join(VAULT, ".obsidian", "plugins", "eldoria-orecchio", "pronunce.json");
function loadTaught() {
  try { return JSON.parse(fs.readFileSync(TAUGHT_FILE, "utf8")); } catch { return {}; }
}
function teach(heard, rel) {
  const h = norm(heard);
  if (!h || !fs.existsSync(path.join(VAULT, rel))) return false;
  const all = loadTaught();
  all[h] = [...new Set([...(all[h] || []), rel])];
  fs.mkdirSync(path.dirname(TAUGHT_FILE), { recursive: true });
  fs.writeFileSync(TAUGHT_FILE, JSON.stringify(all, null, 2), "utf8");
  cache.at = 0;
  return true;
}
function unteach(heard) {
  const all = loadTaught();
  delete all[norm(heard)];
  fs.writeFileSync(TAUGHT_FILE, JSON.stringify(all, null, 2), "utf8");
  cache.at = 0;
}

/* ───────────── cosa aprire: solo le parole giuste ───────────── */

// Una parola detta somiglia a una parola del nome? Le parole comuni mai
// ("danno" non diventa Ganno); lo scheletro largo solo sui nomi lunghi.
let LOOSE = false; // seconda passata: anche R persa, finali troncate, pronunce diverse
function wordOk(spoken, keyWord, taught) {
  if (isCommon(spoken)) return false;
  if (taught) return phon(spoken) === phon(keyWord);
  const sc = wordScore(spoken, keyWord);
  if (sc >= 0.9) return true;
  return LOOSE && sc > 0 && skel(keyWord).length >= 5;
}

function matchOne(text, idx, push) {
  const words = norm(text).split(" ").filter(Boolean);
  const t = ` ${words.join(" ")} `;

  for (const c of CATEGORIES) {
    if (!c.re.test(t)) continue;
    if (c.last) push(idx.lastSession, c.label, "Sessione");
    else push(c.file, c.label, "Categoria", { list: true });
  }
  // "sessione 12", "sessione numero dodici"
  for (const m of t.matchAll(/session[ei] (?:numero |n )?(w+)/g)) {
    const n = numOf(m[1]);
    if (n && idx.sessions.has(n)) push(idx.sessions.get(n), `Sessione ${n}`, "Sessione");
  }
  // "gruppo AMEA", "party enox", "compagnia leaf"
  for (const m of t.matchAll(/(?:gruppo|party|compagnia) (w+)/g)) {
    const rel = idx.parties.get(m[1]);
    if (rel) push(rel, path.basename(rel, ".md"), "Gruppo", { list: true });
  }

  // nomi: prima le pronunce insegnate, poi i nomi più lunghi; le parole usate
  // da un nome non servono a un altro
  const used = new Array(words.length).fill(false);
  const free = (i, m) => i + m <= words.length && !used.slice(i, i + m).some(Boolean);
  for (const pass of [false, true]) {
  LOOSE = pass;
  for (const k of idx.keys) {
    const n = k.toks.length;
    for (let i = 0; i < words.length; i++) {
      let ok = false, span = n;
      // parola per parola ("thelen dhir"); le parole comuni dentro un nome vanno dette uguali
      if (free(i, n)) {
        ok = k.toks.every((kw, j) => (n > 1 && isCommon(kw) ? phon(words[i + j]) === phon(kw) : wordOk(words[i + j], kw, k.taught)));
      }
      // nome spezzato o attaccato dal riconoscimento ("tel arion" ↔ "telarion", "tirren del")
      if (!ok) {
        for (const m of [n - 1, n + 1, n + 2]) {
          if (m < 1 || m === n || !free(i, m)) continue;
          const chunk = words.slice(i, i + m);
          // "tel arion" sì, "volta sola" no: al più una parolina comune, mai in testa
          if (!k.taught && (isCommon(chunk[0]) || chunk.filter(isCommon).length > 1)) continue;
          if (wordOk(chunk.join(""), k.joined, k.taught)) { ok = true; span = m; break; }
        }
      }
      if (!ok) continue;
      for (let j = i; j < i + span; j++) used[j] = true;
      // si apre UNA pagina, quella della cosa nominata; le altre note col nome restano come link
      const [main, ...others] = rankNotes(k.notes, k.variant);
      push(main.rel, main.label, main.kind, { heardAs: words.slice(i, i + span).join(" "), related: others.map((o) => o.rel) });
      break;
    }
  }
  }
  LOOSE = false;
}

// Il riconoscimento propone più trascrizioni della stessa frase: si guardano tutte.
function matchText(text, alts = []) {
  const idx = buildIndex();
  const hits = [];
  const push = (rel, label, kind, extra = {}) => {
    if (rel && !hits.some((h) => h.rel === rel)) hits.push({ rel, label, kind, ...extra });
  };
  for (const t of [text, ...alts].filter(Boolean).slice(0, 5)) matchOne(t, idx, push);
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
    events.push({ id: ++eventSeq, path: rel.replace(/\\/g, "/"), label: hit.label, kind: hit.kind, list: !!hit.list, related: hit.related || [], heard, newTab });
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

const PLUGIN_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "obsidian-plugin", "eldoria-orecchio");
let PLUGIN_VERSION = null;
try { PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_SRC, "manifest.json"), "utf8")).version; } catch { /* niente plugin */ }

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
    const { text = "", alts = [], newTab = true, dry = false } = await readBody(req);
    const heard = String(text).trim();
    const hits = matchText(text, Array.isArray(alts) ? alts : []).map((h) => ({ ...h, result: dry ? "dry" : openInObsidian(h, { newTab, heard }) }));
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
    return json(res, 200, { reset: since > eventSeq, pluginVersion: PLUGIN_VERSION, events: events.filter((e) => e.id > since) });
  }
  if (req.method === "POST" && url.pathname === "/teach") {
    const { heard = "", rel = "" } = await readBody(req);
    return json(res, 200, { ok: teach(heard, rel), taught: loadTaught() });
  }
  if (req.method === "POST" && url.pathname === "/unteach") {
    const { heard = "" } = await readBody(req);
    unteach(heard);
    return json(res, 200, { taught: loadTaught() });
  }
  if (req.method === "GET" && url.pathname === "/notes") {
    const idx = buildIndex();
    const notes = new Map();
    for (const k of idx.keys) for (const n of k.notes) notes.set(n.rel, n.label);
    for (const [num, rel] of idx.sessions) notes.set(rel, `Sessione ${num}`);
    return json(res, 200, { notes: [...notes].map(([rel, label]) => ({ rel, label })).sort((a, b) => a.label.localeCompare(b.label, "it")), taught: loadTaught() });
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
  console.log(`    note riconoscibili per nome: ${new Set(idx.keys.flatMap((k) => k.notes.map((n) => n.rel))).size} · sessioni: ${idx.sessions.size}`);
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
.hint{color:var(--muted);font-size:.88rem;margin:0 0 10px}
.w{display:inline-block;background:#241d20;border:1px solid var(--line);border-radius:3px;padding:1px 7px;margin:2px 3px 2px 0;cursor:pointer}
.w:hover{border-color:var(--el)}.w.sel{background:var(--el);border-color:var(--el);color:#120e0f}
#tf{flex-wrap:wrap}#tf input{min-width:140px}
.tg{display:flex;gap:8px;align-items:center;padding:4px 0}.tg button{background:none;border:0;color:var(--muted);cursor:pointer;font-size:1rem}
</style></head><body><main>
<h1>👂 Orecchio del Master</h1>
<p class="sub">Parla normalmente: non bada alle frasi, pesca solo le parole giuste. Categorie (<b>npc</b>, <b>personaggi</b>, <b>luoghi</b>, <b>taverna</b>, <b>incarichi</b>, <b>sessioni</b>, <b>ultima sessione</b>, <b>sessione 12</b>, <b>gruppo AMEA</b>) e qualunque nome della vault, anche storpiato: NPC, luoghi, incarichi, personaggi dei giocatori e le tue note.</p>
<div class="mic">
  <button id="btn" title="Ascolta / pausa (barra spaziatrice)">🎙</button>
  <div><div id="state">In pausa</div><div id="live"></div>
  <label><input type="checkbox" id="newtab" checked> apri in una nuova scheda di Obsidian</label>
  <div id="plug" class="t"></div></div>
</div>
<div class="box"><h2>Apri subito</h2><div class="chips">
  <button data-say="npc">🧑 NPC</button><button data-say="personaggi">🛡️ Personaggi</button><button data-say="taverna">🍺 Taverne</button>
  <button data-say="luoghi">🗺️ Luoghi</button><button data-say="incarichi">📜 Incarichi</button>
  <button data-say="ultima sessione">📖 Ultima sessione</button></div>
  <form id="f" style="margin-top:10px"><input id="q" placeholder="oppure scrivi un nome…"><button>Apri</button></form>
</div>
<div class="box"><h2>Aperte finora</h2><ul id="log"><li class="t">Ancora niente.</li></ul></div>
<div class="box"><h2>Sentito ma non riconosciuto</h2>
  <p class="hint">Se avevi detto un nome e non si è aperto niente, tocca le parole com'è state scritte qui sotto: finiscono in «Insegna».</p>
  <ul id="miss"><li class="t">Niente per ora.</li></ul></div>
<div class="box"><h2>Insegna una pronuncia</h2>
  <p class="hint">Per la tua R, i nomi detti all'inglese o accorciati: «quando dico <i>nolbo</i> apri <i>Nolborg</i>». Se lo ricorda per sempre (sta nella vault).</p>
  <form id="tf"><input id="th" placeholder="quando dico… (es. nolbo)"><input id="tn" list="notes" placeholder="apri la nota… (scrivi e scegli)"><button>Insegna</button></form>
  <datalist id="notes"></datalist>
  <div id="taught" style="margin-top:10px"></div></div>
</main><script>
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const btn = document.getElementById("btn"), state = document.getElementById("state"), live = document.getElementById("live");
const log = document.getElementById("log"), newtab = document.getElementById("newtab");
let on = false, rec = null, empty = true;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const now = () => new Date().toLocaleTimeString("it-IT", {hour:"2-digit", minute:"2-digit"});

async function hear(text, manual, alts) {
  const r = await fetch("/hear", {method:"POST", body: JSON.stringify({text, alts: alts || [], newTab: newtab.checked})}).then((x) => x.json()).catch(() => null);
  if (!r) { addRow(text, [], "Il programma sul PC non risponde: è ancora acceso?"); return; }
  if (r.hits.length || manual) addRow(text, r.hits, r.hits.length ? "" : "Nessuna nota corrisponde.");
  if (!r.hits.length) addMiss(text, alts || []);
}

/* ── sentito ma non riconosciuto → insegna ── */
const miss = document.getElementById("miss"), th = document.getElementById("th"), tn = document.getElementById("tn");
let missEmpty = true, noteByLabel = new Map();
function addMiss(text, alts) {
  if (missEmpty) { miss.innerHTML = ""; missEmpty = false; }
  const li = document.createElement("li");
  const variants = [...new Set([text, ...alts].map((x) => x.trim()).filter(Boolean))];
  li.innerHTML = '<span class="t">' + now() + '</span><span>' + variants.map((v) =>
    v.split(/s+/).map((w) => '<span class="w">' + esc(w) + '</span>').join("")).join('<span class="t"> · </span>') + '</span>';
  miss.prepend(li);
  while (miss.children.length > 12) miss.lastChild.remove();
}
miss.addEventListener("click", (e) => {
  const w = e.target.closest(".w"); if (!w) return;
  w.classList.toggle("sel");
  const sel = [...w.parentElement.querySelectorAll(".w.sel")].map((x) => x.textContent);
  th.value = sel.join(" ");
  tn.focus();
});
async function loadNotes() {
  const r = await fetch("/notes").then((x) => x.json()).catch(() => null);
  if (!r) return;
  noteByLabel = new Map(r.notes.map((n) => [n.label, n.rel]));
  document.getElementById("notes").innerHTML = r.notes.map((n) => '<option value="' + esc(n.label) + '">').join("");
  showTaught(r.taught);
}
function showTaught(t) {
  const box = document.getElementById("taught");
  const rows = Object.entries(t || {});
  box.innerHTML = rows.length ? rows.map(([h, rels]) => '<div class="tg">«' + esc(h) + '» → ' +
    rels.map((r) => esc(r.split("/").pop().replace(/.md$/, ""))).join(", ") +
    ' <button title="Dimentica" data-un="' + esc(h) + '">✕</button></div>').join("") : '<span class="t">Nessuna pronuncia insegnata.</span>';
}
document.getElementById("taught").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-un]"); if (!b) return;
  const r = await fetch("/unteach", {method:"POST", body: JSON.stringify({heard: b.dataset.un})}).then((x) => x.json());
  showTaught(r.taught);
});
document.getElementById("tf").onsubmit = async (e) => {
  e.preventDefault();
  const rel = noteByLabel.get(tn.value.trim());
  if (!th.value.trim() || !rel) { tn.setCustomValidity(rel ? "" : "Scegli una nota dall'elenco"); tn.reportValidity(); tn.setCustomValidity(""); return; }
  const r = await fetch("/teach", {method:"POST", body: JSON.stringify({heard: th.value, rel})}).then((x) => x.json());
  showTaught(r.taught); th.value = ""; tn.value = "";
};
loadNotes(); setInterval(loadNotes, 60000);
function addRow(text, hits, err) {
  if (empty) { log.innerHTML = ""; empty = false; }
  const li = document.createElement("li");
  li.innerHTML = '<span class="t">' + now() + '</span>' +
    hits.map((h) => '<span><a data-rel="' + esc(h.rel) + '">' + esc(h.label) + '</a> <span class="kind">' + esc(h.kind) + '</span>' +
      (h.heardAs && norm(h.heardAs) !== norm(h.label) ? ' <span class="t">(«' + esc(h.heardAs) + '»)</span>' : '') +
      ((h.related || []).length ? ' <span class="t">· anche: ' + h.related.map((r) => '<a data-rel="' + esc(r) + '">' + esc(r.split("/").pop().slice(0, -3)) + '</a>').join(", ") + '</span>' : '') +
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
  rec = new SR(); rec.lang = "it-IT"; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 5;
  rec.onresult = (ev) => {
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) hear(res[0].transcript, false, [...res].slice(1).map((a) => a.transcript)); else interim += res[0].transcript;
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
