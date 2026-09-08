#!/usr/bin/env node
// tools/covo-remap.mjs — 2026-09-08
// "R · IL COVO DEL DRAGO": rimappa (una tantum, idempotente) la palette del
// Nesso (vuoto/viola/ciano/magenta) sulla palette del Covo (ossidiana/roccia/
// osso/respiro) in TUTTI i CSS/JSX del sito, escluse le pagine di gioco
// (Arena/TCG/World Boss/Pet). Gli accenti diventano token `var(--el*)` così
// il respiro Fuoco/Gelo (e la variante Arcano dell'admin) cambia colore a
// tutto il sito senza toccare le pagine. Raggi ≥5px → 3px (pietra tagliata).
//   node tools/covo-remap.mjs        # applica
//   node tools/covo-remap.mjs --dry  # solo statistiche
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

/* HEX (minuscolo, 6 cifre) → valore Covo */
const HEX = {
  // il vuoto → ossidiana
  "070713": "#0b0a0d", "0a0a18": "#0f0e12", "0b0b1b": "#0f0e12", "0b0b1c": "#0f0e12", "110e1b": "#0f0e12",
  "0a0f1c": "#0f0e12", "0e1426": "#17151b", "0b1220": "#0b0a0d", "0f1729": "#17151b", "141d33": "#221f27", "1b2742": "#2e2a35",
  // scala di superfici S1..S4 → roccia
  "14111f": "#17151b", "201c2f": "#221f27", "2d2841": "#2e2a35", "3b3555": "#3a3542", "3e3856": "#3d3846",
  "22224a": "#2e2a35", "3c3c78": "#3d3846", "293a5e": "#3d3846", "1d2a45": "#2e2a35",
  // inchiostro → osso
  "f3f0fa": "#ece5d6", "edeaff": "#ece5d6", "eef2ff": "#ece5d6", "f8fafc": "#ece5d6",
  "d9d5ea": "#d6cdbb", "d6d2e6": "#d6cdbb", "dcd8f2": "#d6cdbb", "dcd8ff": "#d6cdbb", "c9c4f2": "#d6cdbb", "c9c4ea": "#d6cdbb",
  "a6a1c2": "#b9af9d", "9fabcb": "#b9af9d",
  "7a75a0": "#7d7566", "6b66a3": "#7d7566", "8f8bb8": "#7d7566", "5e5b86": "#7d7566", "6c789b": "#7d7566",
  // viola → respiro
  "8b5cf6": "var(--el)", "b07cff": "var(--el)", "7c3aed": "var(--el)", "9a7bff": "var(--el)",
  "6d3fe0": "var(--el-deep)", "553099": "var(--el-deep)", "5b3fc4": "var(--el-deep)", "7d4fd6": "var(--el-deep)", "5b32c9": "var(--el-deep)",
  "c4b5fd": "var(--el-soft)", "a78bfa": "var(--el-soft)", "cdb0ff": "var(--el-soft)", "bfaaff": "var(--el-soft)",
  // ciano → respiro chiaro
  "22d3ee": "var(--el-2)", "9ff0ff": "var(--el-soft)", "0e7490": "var(--el-deep)", "0891b2": "var(--el-deep)", "155e75": "var(--el-deep)",
  // magenta ("crit") → oro / sangue
  "e879f9": "var(--oro)", "c026d3": "var(--sangue)", "a21caf": "var(--sangue)", "f5b8ff": "var(--oro-soft)",
  // ambra/oro legacy → oro
  "f0a93b": "var(--oro)", "f8cd7e": "var(--oro-soft)", "c07e1e": "#b8933f", "d4af37": "var(--oro)",
};

/* triplette rgb(a) → tripletta Covo (o token --el-rgb) */
const RGB = {
  "139,92,246": "var(--el-rgb)", "34,211,238": "var(--el-rgb)", "122,79,207": "var(--el-rgb)",
  "176,124,255": "var(--el-rgb)", "124,58,237": "var(--el-rgb)", "85,48,153": "var(--el-rgb)",
  "232,121,249": "232,197,106", "240,169,59": "232,197,106", "212,175,55": "232,197,106",
  "196,181,253": "236,229,214", "237,234,255": "236,229,214",
  "7,7,19": "11,10,13", "4,4,12": "11,10,13", "0,0,8": "0,0,0", "10,15,26": "11,10,13", "7,11,22": "11,10,13",
  "20,17,31": "23,21,27", "32,28,47": "34,31,39", "45,40,65": "46,42,53", "10,10,26": "15,14,18",
  "20,20,44": "34,31,39", "22,22,50": "46,42,53", "30,30,64": "46,42,53", "26,26,58": "46,42,53",
};

/* font */
const FONTS = [
  [/"Manrope",\s*system-ui,\s*(?:-apple-system,\s*"Segoe UI",\s*)?sans-serif/g, '"Alegreya", Georgia, serif'],
  [/"Cardo",\s*"EB Garamond",\s*Georgia,\s*serif/g, '"Alegreya SC", "Alegreya", Georgia, serif'],
  [/"Cinzel Decorative",\s*serif/g, '"Grenze Gotisch", "Cinzel", serif'],
];

const SKIP = /(Arena|Tcg|[\\/]tcg[\\/]|WorldBoss(?!Admin)|Pet(?!Points)|tactics|generated|nesso-light|light-theme\.css|covo)/;
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|jsx)$/.test(e.name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

let tot = 0, files = 0;
for (const f of walk(path.join(ROOT, "src"))) {
  const src = fs.readFileSync(f, "utf8");
  const isCss = f.endsWith(".css");
  let n = 0;
  let out = src.replace(/#([0-9a-fA-F]{6})\b(?![0-9a-fA-F])/g, (m, h) => {
    const v = HEX[h.toLowerCase()];
    if (!v) return m;
    n++; return v;
  });
  out = out.replace(/(rgba?\(\s*)(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, pre, r, g, b) => {
    const v = RGB[`${r},${g},${b}`];
    if (!v) return m;
    n++; return pre + v;
  });
  if (isCss) {
    for (const [re, rep] of FONTS) out = out.replace(re, () => { n++; return rep; });
    // raggi: la pietra del covo è tagliata, non levigata (5..60px → 3px; pillole 999 e % intatti)
    out = out.replace(/(border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:)([^;}]+)/g, (m, prop, val) => {
      const nv = val.replace(/(\d+(?:\.\d+)?)px/g, (mm, px) => {
        const v = parseFloat(px);
        if (v >= 5 && v <= 60) { n++; return "3px"; }
        return mm;
      });
      return prop + nv;
    });
  }
  if (n && out !== src) {
    tot += n; files++;
    console.log(`${String(n).padStart(4)}  ${path.relative(ROOT, f)}`);
    if (!DRY) fs.writeFileSync(f, out);
  }
}
console.log(`\n${DRY ? "[dry] " : ""}${tot} sostituzioni in ${files} file`);
