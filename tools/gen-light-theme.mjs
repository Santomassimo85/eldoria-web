#!/usr/bin/env node
// tools/gen-light-theme.mjs
//
// Genera `src/styles/nesso-light.generated.css`: il tema chiaro "Alba del
// Nesso" ottenuto per MAPPATURA MECCANICA della palette del vuoto.
// Per ogni regola dei CSS del sito (escluse le pagine di gioco scure) che
// contiene un colore della palette Nesso, emette la stessa regola con
// prefisso `html[data-theme="light"]` e i colori rimappati (stessa alpha
// per gli rgba). La specificità cresce in modo uniforme (+1 attributo,
// +1 tipo) così l'ordine relativo delle regole originali resta valido.
//
// Le regole scritte a mano (token, fondo, tastino) stanno in
// `src/styles/nesso-light.css`, caricato DOPO il generato.
//
//   node tools/gen-light-theme.mjs        # rigenera
//   node tools/gen-light-theme.mjs --dry  # solo statistiche

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/styles/nesso-light.generated.css");
const DRY = process.argv.includes("--dry");

/* ─────────────── FILE SORGENTE (ordine = ordine di cascata) ─────────────── */
const FILES = [
  "src/style.css",
  "src/styles/theme.css",
  "src/styles/shell.css",
  "src/styles/light-theme.css",
  "src/styles/layout.css",
  "src/styles/nesso.css",
  "src/styles/cinematic.css",
  "src/LoginDropdown.css",
  "src/components/DateTimePicker.css",
  "src/components/SendNotification.css",
  "src/components/AmbientFX.css",
  // pagine (NON di gioco: Arena/TCG/World Boss/Pet restano scure)
  "src/pages/Home.css",
  "src/pages/Party.css",
  "src/pages/NPC.css",
  "src/pages/Geo.css",
  "src/pages/WorldMap.css",
  "src/pages/Mercato.css",
  "src/pages/ItemDetail.css",
  "src/pages/Riassunti.css",
  "src/pages/RiassuntoSingolo.css",
  "src/pages/Crafting.css",
  "src/pages/RattiLore.css",
  "src/pages/Almanacco.css",
  "src/pages/Cinema.css",
  "src/pages/Bacheca.css",
  "src/pages/QuestDetail.css",
  "src/pages/Scriba.css",
  "src/pages/Diario.css",
  "src/pages/Updates.css",
  "src/pages/Notifications.css",
  "src/pages/Feedback.css",
  "src/pages/Tarocchi.css",
  "src/pages/Concilio.css",
  "src/pages/DmTools.css",
  "src/pages/admin.css",
  "src/pages/ToggleSection.css",
].filter((f) => fs.existsSync(path.join(ROOT, f)));

/* ─────────────── PALETTE: vuoto → alba ───────────────
   Chiavi in minuscolo a 6 cifre. `text` = valore quando il colore è usato
   come colore del TESTO (color / text-fill / caret); `surf` = in tutti gli
   altri casi (sfondi, bordi, ombre, gradienti, custom property).
   Se manca `text`, vale `surf` per entrambi. */
const MAP = {
  // il vuoto e le superfici
  "070713": { surf: "#f4f1ff", text: "#ffffff" }, // testo scuro su bottoni a gradiente → bianco
  "0a0a18": { surf: "#f4f1ff" },
  "0b0b1b": { surf: "#f6f4ff" },
  "0d0d1f": { surf: "#ffffff" },
  "0f0f23": { surf: "#f7f5ff" },
  "101025": { surf: "#f7f5ff" },
  "12122a": { surf: "#fbfaff" },
  "13132b": { surf: "#fbfaff" },
  "14142c": { surf: "#ffffff" },
  "161632": { surf: "#f1eefc" },
  "1a1a3a": { surf: "#ede9fc" },
  "1c1c3c": { surf: "#ece8ff" },
  "1e1e3c": { surf: "#e6e1fb" },
  "24244a": { surf: "#e3dffa" },
  "2c2c55": { surf: "#d9d3f5" },
  // inchiostro
  "edeaff": { surf: "#1a1636", text: "#1a1636" },
  "dcd8f2": { surf: "#2c2850", text: "#2c2850" },
  "c9c4ea": { surf: "#2c2850", text: "#2c2850" },
  "8f8bb8": { surf: "#5d5a86", text: "#5d5a86" },
  "5e5b86": { surf: "#8d89b5", text: "#8d89b5" },
  // accenti (più scuri: devono reggere su fondo chiaro)
  "22d3ee": { surf: "#0891b2", text: "#0e7490" },
  "67e8f9": { surf: "#0891b2", text: "#0e7490" },
  "9ff0ff": { surf: "#0e7490", text: "#155e75" },
  "0e7490": { surf: "#155e75" },
  "8b5cf6": { surf: "#6d3fe0" },
  "a78bfa": { surf: "#6d3fe0" },
  "c4b5fd": { surf: "#5b3fc4" },
  "d8b4fe": { surf: "#7e22ce" },
  "6d3fe0": { surf: "#5b32c9" },
  "e879f9": { surf: "#c026d3", text: "#a21caf" },
  "f5b8ff": { surf: "#c026d3", text: "#a21caf" },
  "c026d3": { surf: "#a21caf" },
  "34d399": { surf: "#059669", text: "#047857" },
  "4ade80": { surf: "#16a34a", text: "#15803d" },
  "a3e635": { surf: "#65a30d", text: "#4d7c0f" },
  "f87171": { surf: "#dc2626", text: "#b91c1c" },
  "f59e0b": { surf: "#b45309", text: "#92400e" },
  "fbbf24": { surf: "#b45309", text: "#92400e" },
  "38bdf8": { surf: "#0284c7", text: "#0369a1" },
  "60a5fa": { surf: "#2563eb", text: "#1d4ed8" },
  "c084fc": { surf: "#9333ea", text: "#7e22ce" },
  "f472b6": { surf: "#db2777", text: "#be185d" },
  "fb923c": { surf: "#ea580c", text: "#c2410c" },
  "fde68a": { surf: "#d97706", text: "#92400e" },
  "fcd34d": { surf: "#d97706", text: "#92400e" },
  // altre superfici scure (gradienti di pannello, orbe, mappa)
  "0e0e22": { surf: "#f3f0ff" },
  "04040c": { surf: "#f7f5ff" },
  "1e1e40": { surf: "#e8e4fb" },
  "10102a": { surf: "#f7f5ff" },
  "0d0d22": { surf: "#f4f1ff" },
  "0b0b1c": { surf: "#f6f4ff" },
  "262650": { surf: "#d9d3f5" },
  "151531": { surf: "#efebfc" },
  "2a1660": { surf: "#5b32c9" },
  "3c3c3c": { surf: "#ffffff" },
  "7a2e6e": { surf: "#efe0ff" },
  "9b2d3a": { surf: "#ffe4e8" },
};

const TEXT_PROPS = new Set(["color", "-webkit-text-fill-color", "caret-color"]);
// proprietà "di colore": vengono SEMPRE ricopiate sotto il prefisso (mappate
// quando contengono la palette, verbatim altrimenti). Se si copiassero solo
// quelle mappate, le regole generate (specificità maggiore) scavalcherebbero
// regole originali successive con valori non-colore (transparent, var(--x)…).
const COLOR_PROPS = /^(color|background|background-color|background-image|border|border-color|border-top|border-bottom|border-left|border-right|border-top-color|border-bottom-color|border-left-color|border-right-color|box-shadow|outline|outline-color|fill|stroke|-webkit-text-fill-color|text-shadow|caret-color|accent-color)$/i;
const PREFIX = 'html[data-theme="light"]';

const hexToRgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const RGB_INDEX = new Map(Object.keys(MAP).map((h) => [hexToRgb(h).join(","), h]));

function norm6(hex) {
  let h = hex.toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("") + h[3] + h[3];
  return h;
}

/** Rimappa i colori dentro un valore CSS. Ritorna null se nulla cambia. */
function mapValue(value, isText) {
  let changed = false;
  let out = value.replace(/#([0-9a-fA-F]{3,8})\b/g, (m, hex) => {
    const h = norm6(hex);
    const base = h.slice(0, 6);
    const alpha = h.slice(6);
    const e = MAP[base];
    if (!e) return m;
    changed = true;
    const to = isText && e.text ? e.text : e.surf;
    return to + alpha;
  });
  out = out.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9.]+)\s*)?\)/g, (m, r, g, b, _c, a) => {
    const key = RGB_INDEX.get(`${+r},${+g},${+b}`);
    if (!key) return m;
    const e = MAP[key];
    const to = isText && e.text ? e.text : e.surf;
    const [R, G, B] = hexToRgb(to.slice(1));
    changed = true;
    return a !== undefined ? `rgba(${R}, ${G}, ${B}, ${a})` : `rgb(${R}, ${G}, ${B})`;
  });
  return changed ? out : null;
}

function prefixSelector(sel) {
  const s = sel.trim();
  if (!s) return s;
  if (/^:root\b/.test(s)) return s.replace(/^:root/, PREFIX);
  if (/^html\b/.test(s)) return s.replace(/^html/, PREFIX);
  return `${PREFIX} ${s}`;
}

/* ─────────────── GENERAZIONE ─────────────── */
const stats = { files: 0, rules: 0, decls: 0 };
const chunks = [];

for (const rel of FILES) {
  const css = fs.readFileSync(path.join(ROOT, rel), "utf8");
  let root;
  try { root = postcss.parse(css, { from: rel }); }
  catch (e) { console.warn(`[skip] ${rel}: ${e.message}`); continue; }

  const outRoot = postcss.root();
  let fileRules = 0;

  root.walkRules((rule) => {
    // salta keyframes / font-face / regole senza selettore
    let p = rule.parent;
    let skip = false;
    const wrappers = [];
    while (p && p.type === "atrule") {
      if (/keyframes|font-face|page|counter-style/i.test(p.name)) { skip = true; break; }
      wrappers.unshift(p);
      p = p.parent;
    }
    if (skip) return;

    const decls = [];
    rule.each((node) => {
      if (node.type !== "decl") return;
      const isText = TEXT_PROPS.has(node.prop.toLowerCase());
      let value = null;
      if (node.prop.toLowerCase() === "text-shadow") {
        // le aureole luminose del vuoto diventano sbavature sul chiaro
        value = mapValue(node.value, false) ? "none" : node.value;
      } else {
        value = mapValue(node.value, isText);
        // proprietà di colore non mappabili (var(), transparent, none, inherit,
        // url(), colori fuori palette): ricopiate così com'è, per conservare
        // l'intero ordine di cascata del "livello colore" sotto il prefisso.
        if (value === null && COLOR_PROPS.test(node.prop)) value = node.value;
      }
      if (value === null) return;
      decls.push(postcss.decl({ prop: node.prop, value, important: node.important }));
    });
    if (!decls.length) return;

    // Lo shorthand `background` azzera background-clip: se la regola originale
    // ritaglia il gradiente sul testo (titoli a gradiente), va ripetuto.
    if (decls.some((d) => d.prop.toLowerCase() === "background")) {
      rule.each((node) => {
        if (node.type !== "decl") return;
        const pr = node.prop.toLowerCase();
        if (pr === "background-clip" || pr === "-webkit-background-clip" || pr === "-webkit-text-fill-color") {
          decls.push(postcss.decl({ prop: node.prop, value: node.value, important: node.important }));
        }
      });
    }

    const newRule = postcss.rule({ selector: rule.selectors.map(prefixSelector).join(",\n") });
    decls.forEach((d) => newRule.append(d));

    // ricrea gli at-rule contenitori (@media / @supports / @container)
    let target = outRoot;
    for (const w of wrappers) {
      let existing = null;
      target.each((n) => { if (n.type === "atrule" && n.name === w.name && n.params === w.params) existing = n; });
      if (!existing) { existing = postcss.atRule({ name: w.name, params: w.params }); target.append(existing); }
      target = existing;
    }
    target.append(newRule);
    fileRules++;
    stats.decls += decls.length;
  });

  if (fileRules) {
    stats.files++;
    stats.rules += fileRules;
    chunks.push(`\n/* ═══════ ${rel} (${fileRules} regole) ═══════ */\n${outRoot.toString()}`);
  }
}

const header = `/* ============================================================================
   TEMA CHIARO "ALBA DEL NESSO" — FILE GENERATO, NON MODIFICARE A MANO.
   Rigenera con:  node tools/gen-light-theme.mjs
   Mappatura meccanica della palette del vuoto (nesso.css e CSS di pagina)
   sotto html[data-theme="light"]. Le regole scritte a mano stanno in
   nesso-light.css (caricato dopo questo file).
   ============================================================================ */
`;

const output = header + chunks.join("\n") + "\n";
console.log(`[gen-light-theme] ${stats.files} file · ${stats.rules} regole · ${stats.decls} dichiarazioni · ${(output.length / 1024).toFixed(0)} KB`);
if (!DRY) {
  fs.writeFileSync(OUT, output);
  console.log(`[gen-light-theme] scritto ${path.relative(ROOT, OUT)}`);
}
