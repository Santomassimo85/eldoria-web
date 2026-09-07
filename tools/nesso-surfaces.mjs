#!/usr/bin/env node
// tools/nesso-surfaces.mjs — 2026-09-07
// Scala di superfici del Nesso: sostituisce (una tantum, idempotente) i vecchi
// grigi-indaco piatti con la scala a 4 livelli S1..S4 (deriva prugna, passi
// di luminosità percepibili). Le pagine di GIOCO (Arena/TCG/World Boss/Pet)
// sono escluse. Dopo: node tools/gen-light-theme.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEX = {
  // S1 — contenitori / input (inset) / fondo dei gradienti
  "0d0d1f": "14111f", "0e0e22": "14111f", "0d0d22": "14111f", "10102a": "14111f",
  "0a0a18": "110e1b", "0b0b1b": "110e1b", "0b0b1c": "110e1b", "0f0f23": "14111f", "101025": "14111f",
  // S2 — card e pannelli
  "12122a": "201c2f", "13132b": "201c2f", "14142c": "201c2f", "151531": "201c2f",
  // S3 — elevati: hover, tab attivi, modali, placche hero
  "161632": "2d2841", "1a1a3a": "2d2841", "1c1c3c": "2d2841", "1e1e40": "2d2841", "1e1e3c": "2d2841",
  // S4 — livello più alto
  "24244a": "3b3555", "262650": "3b3555", "2c2c55": "3e3856",
  // inchiostro
  "8f8bb8": "a6a1c2", "5e5b86": "7a75a0", "c9c4ea": "d6d2e6", "d5d1ee": "d9d5ea",
};
const RGB = {
  "13,13,31": "20,17,31", "14,14,34": "20,17,31", "20,20,44": "32,28,47", "22,22,50": "45,40,65",
  "26,26,58": "45,40,65", "30,30,64": "45,40,65",
};
const SKIP = /(Arena|Tcg|tcg|WorldBoss(?!Admin)|Pet|generated)/;
function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(css|jsx)$/.test(e.name) && !SKIP.test(p)) out.push(p);
  }
  return out;
}
let tot = 0;
for (const f of walk(path.join(ROOT, "src"))) {
  const src = fs.readFileSync(f, "utf8");
  let n = 0;
  let out = src.replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => {
    const to = HEX[h.toLowerCase()];
    if (!to) return m;
    n++; return "#" + to;
  });
  out = out.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[0-9.]+\s*)?\)/g, (m, r, g, b, a) => {
    const to = RGB[`${+r},${+g},${+b}`];
    if (!to) return m;
    n++;
    const [R, G, B] = to.split(",");
    return a ? `rgba(${R}, ${G}, ${B}${a.replace(/\s+/g, " ")})` : `rgb(${R}, ${G}, ${B})`;
  });
  if (n) { fs.writeFileSync(f, out); tot += n; console.log(`${n}\t${path.relative(ROOT, f)}`); }
}
console.log(`totale sostituzioni: ${tot}`);
