// Genera src/assets/gameIcons.js con SOLO le icone di game-icons.net usate dal sito.
// Uso: node tools/build-game-icons.mjs [percorso/icons.json]
// Senza percorso scarica il set (Iconify, versione fissata) da jsDelivr.
// Le mappe dei nomi stanno in src/data/segreteIcons.js (e in futuro Arena / World Boss).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SET_URL = "https://cdn.jsdelivr.net/npm/@iconify-json/game-icons@1.2.2/icons.json";
const MAPS = ["src/data/segreteIcons.js"];
const EMOJI_MAP = "src/data/emojiIcons.js";
const SVG_DIR = "public/gi";
// icone usate solo dai CSS (maschere) o da un <image>
const EXTRA_SVG = ["crown", "photo-camera", "speaker", "rat", "fleur-de-lys", "crossed-swords", "scroll-unfurled", "night-sleep"];

const local = process.argv[2];
const set = local
  ? JSON.parse(fs.readFileSync(local, "utf8"))
  : await (await fetch(SET_URL)).json();

const names = new Set();
for (const rel of MAPS) {
  const mod = await import(pathToFileURL(path.join(ROOT, rel)).href);
  for (const [k, v] of Object.entries(mod)) if (k.startsWith("ALL_") && Array.isArray(v)) v.forEach((n) => names.add(n));
}

const out = {};
const missing = [];
for (const n of [...names].sort()) {
  const ic = set.icons[n];
  if (!ic) { missing.push(n); continue; }
  // tolgo fill="currentColor": il colore lo dà l'<svg> che le contiene
  out[n] = ic.body.replace(/\s*fill="currentColor"/g, "");
}
if (missing.length) {
  console.error("Icone inesistenti nel set:", missing.join(", "));
  process.exit(1);
}

const file = `/* GENERATO da tools/build-game-icons.mjs: non modificare a mano.
   Icone di game-icons.net (Lorc, Delapouite e altri autori), licenza CC BY 3.0
   https://creativecommons.org/licenses/by/3.0/ · viewBox 0 0 512 512. */
export const GAME_ICONS = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')};
`;
fs.writeFileSync(path.join(ROOT, "src/assets/gameIcons.js"), file);
// emoji del sito (src/jsx/iconize.js): un file a icona in public/gi, si scaricano solo quando servono
const emoji = await import(pathToFileURL(path.join(ROOT, EMOJI_MAP)).href);
const extra = [...new Set([...emoji.ALL_EMOJI_ICON_NAMES, ...EXTRA_SVG])];
const bad = extra.filter((n) => !set.icons[n]);
if (bad.length) { console.error("Icone inesistenti nel set:", bad.join(", ")); process.exit(1); }
const dir = path.join(ROOT, SVG_DIR);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
for (const n of extra) fs.writeFileSync(path.join(dir, `${n}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${set.icons[n].body}</svg>`);
console.log(`public/gi: ${extra.length} icone`);
console.log(`gameIcons.js: ${Object.keys(out).length} icone, ${(file.length / 1024).toFixed(0)} kB`);
