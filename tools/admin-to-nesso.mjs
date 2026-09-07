#!/usr/bin/env node
// tools/admin-to-nesso.mjs
//
// Migrazione UNA TANTUM (2026-09-07) dei CSS dei pannelli DM/Admin dalla
// palette "Pergamena Antica" (superfici crema, inchiostro bruno) alla palette
// del vuoto "Il Nesso" (superfici scure, inchiostro chiaro, oro→ciano,
// rosso→magenta). Con il redesign Nesso `--text` è diventato chiaro ma i
// pannelli admin tenevano sfondi crema hardcoded: testo chiaro su chiaro.
//
// Mappatura consapevole del contesto: `text` = valore quando il colore è il
// colore del TESTO (color / text-fill / caret), `surf` = sfondi, bordi,
// ombre, gradienti. Riscrive i file IN PLACE. Dopo: rilanciare
// `node tools/gen-light-theme.mjs` (il tema chiaro si genera dal Nesso).
//
//   node tools/admin-to-nesso.mjs          # riscrive
//   node tools/admin-to-nesso.mjs --dry    # solo statistiche + colori non mappati

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");

const FILES = [
  "src/pages/admin.css",
  "src/GeneraNPC.css",
  "src/pages/DmTools.css",
  "src/pages/pgSheetEditor.css",
  "src/pages/WorldBossAdmin.css",
  "src/components/DateTimePicker.css",
  "src/components/SendNotification.css",
];

/* palette Nesso (nesso.css) */
const N = {
  vuoto: "#070713", surf: "#0d0d1f", pan: "#14142c", pan2: "#12122a", up: "#1a1a3a",
  up2: "#1e1e3c", line: "#2c2c55", lineSoft: "#1e1e3c", deep: "#0e0e22",
  ink: "#edeaff", ink2: "#dcd8f2", ink3: "#c9c4ea", muted: "#8f8bb8", faint: "#5e5b86",
  ciano: "#22d3ee", cianoSoft: "#9ff0ff", cianoMid: "#67e8f9", cianoDeep: "#0e7490",
  viola: "#8b5cf6", violaSoft: "#c4b5fd", violaMid: "#a78bfa", violaDeep: "#6d3fe0",
  mag: "#e879f9", magSoft: "#f5b8ff", magDeep: "#c026d3",
  ok: "#34d399", ok2: "#4ade80", warn: "#fbbf24", warnSoft: "#fde68a", info: "#38bdf8", info2: "#60a5fa",
  rosso: "#f87171",
};

/* ── HEX: pergamena → nesso ── */
const MAP = {
  /* superfici bianche/crema → pannelli del vuoto */
  "ffffff": { surf: N.pan, text: N.ink },
  "fffdf7": { surf: N.pan }, "fffdf6": { surf: N.pan }, "fffdf5": { surf: N.pan }, "fffdf3": { surf: N.pan },
  "fdfbf3": { surf: N.pan }, "fafafa": { surf: N.pan }, "fafaf2": { surf: N.pan2 }, "fbf6ea": { surf: N.pan2 },
  "fdf6e3": { surf: N.up }, "f7f1e2": { surf: N.up }, "f6efdd": { surf: N.up }, "f4ecd8": { surf: N.up },
  "f5efe0": { surf: N.up }, "f7efd6": { surf: N.up }, "f7f0d8": { surf: N.up }, "f1e7cf": { surf: N.up },
  "fbf4e0": { surf: N.pan }, "f4efe2": { surf: N.up }, "f6ecd6": { surf: N.up },
  "f0e8d0": { surf: N.up2 }, "e8dfc6": { surf: N.up2 }, "f3eede": { surf: N.up2 }, "f5e6c8": { surf: N.up2 },
  "f4e6bf": { surf: N.up2 }, "f3e6c4": { surf: N.up2 }, "f3e6b8": { surf: N.up2 }, "f4ead4": { surf: N.up2 },
  "efe1bc": { surf: N.up2 }, "f6e9c8": { surf: N.up2 }, "e9dcbe": { surf: N.up2 }, "e6d6c0": { surf: N.up2 },
  "fff8e1": { surf: N.pan }, "fff8ed": { surf: N.pan }, "fff8e8": { surf: N.pan }, "fff7e6": { surf: N.pan },
  "fffaf0": { surf: N.pan }, "fff8e0": { surf: N.pan }, "fdf7e6": { surf: N.up }, "fdf2dc": { surf: N.up },
  "f5f3ff": { surf: N.up }, "fdeec7": { surf: N.up2 }, "fdf3cf": { surf: N.up2 }, "fdf3c8": { surf: N.up2 },
  "e8dab0": { surf: N.line }, "e9d9b0": { surf: N.line }, "e2d3a8": { surf: N.line }, "d9c79a": { surf: N.line },
  "dccfa6": { surf: N.line }, "d8c9a0": { surf: N.line }, "c9b78a": { surf: N.line }, "e3d4b0": { surf: N.line },
  "cbb894": { surf: N.line }, "a89a78": { surf: N.line, text: N.muted }, "d4c485": { surf: N.line },
  "ddd": { surf: N.line, text: N.ink3 }, "dddddd": { surf: N.line, text: N.ink3 },
  "ccc": { surf: N.line, text: N.ink3 }, "cccccc": { surf: N.line, text: N.ink3 },
  /* tinte chiare di stato → tinte scure */
  "fff7d6": { surf: "rgba(251, 191, 36, .16)" }, "fff3b0": { surf: "rgba(251, 191, 36, .22)" },
  "ffe28a": { surf: "rgba(251, 191, 36, .28)" }, "ffd76a": { surf: "rgba(251, 191, 36, .32)" },
  "f7d97a": { surf: "rgba(251, 191, 36, .32)" }, "f0c890": { surf: "rgba(251, 191, 36, .22)" },
  "ffd6d6": { surf: "rgba(248, 113, 113, .18)" }, "fbeae6": { surf: "rgba(248, 113, 113, .16)" },
  "fbeae5": { surf: "rgba(248, 113, 113, .16)" }, "fff1e0": { surf: "rgba(251, 146, 60, .16)" },
  "e2b4a8": { surf: "rgba(248, 113, 113, .45)" }, "d09898": { surf: "rgba(248, 113, 113, .45)" },
  "d8a0a0": { surf: "rgba(248, 113, 113, .45)" }, "ffa0a0": { surf: "rgba(248, 113, 113, .5)", text: N.rosso },
  "c6f0d0": { surf: "rgba(52, 211, 153, .18)" }, "e9f6ec": { surf: "rgba(52, 211, 153, .14)" },
  "e8f1e3": { surf: "rgba(52, 211, 153, .14)" }, "9ccfa6": { surf: "rgba(52, 211, 153, .45)" },
  "a3c5a8": { surf: "rgba(52, 211, 153, .45)" }, "98c0a0": { surf: "rgba(52, 211, 153, .45)" },
  "9aebac": { surf: "rgba(52, 211, 153, .5)", text: N.ok2 }, "88e09c": { surf: N.ok2, text: N.ok2 },
  "87e09a": { surf: N.ok2, text: N.ok2 }, "86efac": { surf: N.ok2, text: N.ok2 },
  "f0fdfa": { surf: "rgba(52, 211, 153, .12)" }, "e7eefb": { surf: "rgba(56, 189, 248, .14)" },
  "e6f0f7": { surf: "rgba(56, 189, 248, .14)" }, "cfdcf3": { surf: "rgba(56, 189, 248, .35)" },
  "c8dfff": { surf: "rgba(56, 189, 248, .35)" }, "b3d8ff": { surf: "rgba(56, 189, 248, .45)", text: N.info2 },
  "9cc0db": { surf: "rgba(56, 189, 248, .45)" }, "94b8e8": { surf: "rgba(56, 189, 248, .5)", text: N.info2 },
  "ece0ee": { surf: "rgba(139, 92, 246, .16)" }, "a888c0": { surf: "rgba(139, 92, 246, .5)", text: N.violaSoft },
  /* inchiostro bruno/nero → inchiostro del Nesso */
  "1a1303": { surf: N.viola, text: N.ink }, "241c05": { surf: N.vuoto, text: N.vuoto },
  "2a1c06": { surf: N.ink, text: N.ink }, "2a1c05": { surf: N.ink, text: N.ink },
  "2a1a00": { surf: N.ink, text: N.ink }, "2a1a10": { surf: N.ink, text: N.ink },
  "2d2418": { surf: N.ink, text: N.ink }, "33281a": { surf: N.ink, text: N.ink },
  "272727": { text: N.ink, surf: N.ink }, "111": { text: N.ink, surf: N.vuoto }, "111111": { text: N.ink, surf: N.vuoto },
  "333": { text: N.ink2, surf: N.up }, "333333": { text: N.ink2, surf: N.up },
  "444": { text: N.ink3, surf: N.line }, "444444": { text: N.ink3, surf: N.line },
  "555": { text: N.ink3, surf: N.line }, "555555": { text: N.ink3, surf: N.line },
  "666": { text: N.muted, surf: N.line }, "666666": { text: N.muted, surf: N.line },
  "777": { text: N.muted, surf: N.line }, "777777": { text: N.muted, surf: N.line },
  "888": { text: N.muted, surf: N.faint }, "888888": { text: N.muted, surf: N.faint },
  "999": { text: N.muted, surf: N.faint }, "999999": { text: N.muted, surf: N.faint },
  "aaa": { text: N.muted, surf: N.faint }, "aaaaaa": { text: N.muted, surf: N.faint },
  "4a3d24": { text: N.ink3, surf: N.ink3 }, "4a3018": { text: N.ink3, surf: N.ink3 }, "4a2a1a": { text: N.ink3, surf: N.ink3 },
  "5a4a2a": { text: N.ink3, surf: N.ink3 }, "5a4a2e": { text: N.ink3, surf: N.ink3 }, "5f3818": { text: N.ink3, surf: N.ink3 },
  "6a5a34": { text: N.muted, surf: N.muted }, "6a5b41": { text: N.muted, surf: N.muted }, "5b4a30": { text: N.muted, surf: N.muted },
  "7a6f57": { text: N.muted, surf: N.muted }, "7a6a4a": { text: N.muted, surf: N.muted }, "8a7a5a": { text: N.muted, surf: N.muted },
  "8a7a55": { text: N.muted, surf: N.muted }, "8a7a4a": { text: N.muted, surf: N.muted }, "9a825a": { text: N.muted, surf: N.muted },
  "9a8a6b": { text: N.muted, surf: N.muted }, "b0a07a": { text: N.muted, surf: N.faint }, "6f6453": { text: N.muted, surf: N.muted },
  "b08a6a": { text: N.muted, surf: N.faint }, "5e4208": { text: N.ink3, surf: N.ink3 },
  /* oro/bruno-oro → ciano (il "oro" del Nesso) */
  "d4af37": { surf: N.ciano, text: N.cianoSoft }, "c9a961": { surf: N.ciano, text: N.cianoSoft },
  "e0cf9d": { surf: N.cianoSoft, text: N.cianoSoft }, "c49a20": { surf: N.ciano, text: N.cianoSoft },
  "b8902f": { surf: N.ciano, text: N.cianoSoft }, "b8945a": { surf: N.ciano, text: N.cianoSoft },
  "b8a060": { surf: N.line, text: N.cianoSoft }, "d8b15a": { surf: N.ciano, text: N.cianoSoft },
  "d9b25a": { surf: N.ciano, text: N.cianoSoft }, "e7c878": { surf: N.cianoSoft, text: N.cianoSoft },
  "e6c477": { surf: N.ciano, text: N.cianoSoft }, "d8c068": { surf: N.ciano, text: N.cianoSoft },
  "c8a24a": { surf: N.ciano, text: N.cianoSoft }, "b9892a": { surf: N.ciano, text: N.cianoSoft },
  "8b6914": { surf: N.cianoDeep, text: N.cianoSoft }, "8a6a30": { surf: N.cianoDeep, text: N.cianoSoft },
  "8b6614": { surf: N.cianoDeep, text: N.cianoSoft }, "8a6212": { surf: N.cianoDeep, text: N.cianoSoft },
  "a07a1a": { surf: N.cianoDeep, text: N.cianoSoft }, "7a5a20": { surf: N.cianoDeep, text: N.cianoSoft },
  "6a4a1a": { surf: N.cianoDeep, text: N.cianoSoft }, "6a4a08": { surf: N.cianoDeep, text: N.cianoSoft },
  "5a3c0a": { surf: N.cianoDeep, text: N.cianoSoft }, "5a3a12": { surf: N.cianoDeep, text: N.cianoSoft },
  "4a3b08": { surf: N.cianoDeep, text: N.cianoSoft }, "7c560f": { surf: N.cianoDeep, text: N.cianoSoft },
  "a9781a": { surf: N.ciano, text: N.cianoSoft }, "9a7526": { surf: N.cianoDeep, text: N.cianoSoft },
  "7a5e10": { surf: N.cianoDeep, text: N.cianoSoft }, "b08820": { surf: N.ciano, text: N.cianoSoft },
  "ffd66b": { surf: N.cianoSoft, text: N.cianoSoft }, "ffb84d": { surf: N.warn, text: N.warn },
  "9a4e16": { surf: N.cianoDeep, text: N.cianoSoft }, "b85a00": { surf: N.warn, text: N.warn },
  "b8590a": { surf: N.warn, text: N.warn }, "e67e22": { surf: N.warn, text: N.warn },
  /* rossi (pericolo, cancella) → magenta / rosso chiaro */
  "8b1a1a": { surf: N.magDeep, text: N.mag }, "6a0808": { surf: N.magDeep, text: N.mag },
  "b41e1e": { surf: N.magDeep, text: N.mag }, "7a1010": { surf: N.magDeep, text: N.mag },
  "b03030": { surf: N.magDeep, text: N.mag }, "a30d0d": { surf: N.magDeep, text: N.mag },
  "b00808": { surf: N.magDeep, text: N.mag }, "8a0e0e": { surf: N.magDeep, text: N.mag },
  "6a0e0e": { surf: N.magDeep, text: N.mag }, "7a1a1a": { surf: N.magDeep, text: N.mag },
  "8a1f1f": { surf: N.magDeep, text: N.mag }, "5a0e0e": { surf: N.magDeep, text: N.mag },
  "721c24": { surf: N.magDeep, text: N.rosso }, "7d2929": { surf: N.magDeep, text: N.rosso },
  "a04545": { surf: N.magDeep, text: N.rosso }, "5a1818": { surf: N.magDeep, text: N.rosso },
  "b91c1c": { surf: N.magDeep, text: N.rosso }, "b8362a": { surf: N.magDeep, text: N.rosso },
  "e74c3c": { surf: N.magDeep, text: N.rosso }, "c0392b": { surf: N.magDeep, text: N.rosso },
  "d94444": { surf: N.magDeep, text: N.rosso }, "e25656": { surf: N.rosso, text: N.rosso },
  "c0563f": { surf: N.magDeep, text: N.rosso },
  "ff6b6b": { surf: N.rosso, text: N.rosso }, "ff8b8b": { surf: N.rosso, text: N.rosso }, "ff7878": { surf: N.rosso, text: N.rosso },
  "ff7676": { surf: N.rosso, text: N.rosso }, "ff5050": { surf: N.rosso, text: N.rosso }, "ff8a8a": { surf: N.rosso, text: N.rosso },
  "ff5a5a": { surf: N.rosso, text: N.rosso },
  /* verdi */
  "155724": { surf: N.ok, text: N.ok2 }, "0c4b18": { surf: N.ok, text: N.ok2 }, "1f6b30": { surf: N.ok, text: N.ok2 },
  "2f7a44": { surf: N.ok, text: N.ok2 }, "2e7a3f": { surf: N.ok, text: N.ok2 }, "0a7a3a": { surf: N.ok, text: N.ok2 },
  "1f8a6a": { surf: N.ok, text: N.ok2 }, "27ae60": { surf: N.ok, text: N.ok2 }, "2eaa48": { surf: N.ok, text: N.ok2 },
  "3cbc57": { surf: N.ok, text: N.ok2 }, "1a7a3c": { surf: N.ok, text: N.ok2 }, "3a7a4a": { surf: N.ok, text: N.ok2 },
  "4a8a3a": { surf: N.ok, text: N.ok2 }, "5fa470": { surf: N.ok, text: N.ok2 }, "1f5532": { surf: N.ok, text: N.ok2 },
  "2c8a5a": { surf: N.ok, text: N.ok2 }, "0f766e": { surf: N.ok, text: N.ok2 }, "0d9488": { surf: N.ok, text: N.ok2 },
  /* blu */
  "0e2247": { surf: N.info, text: N.info2 }, "18305a": { surf: N.info, text: N.info2 }, "2a5ca8": { surf: N.info, text: N.info2 },
  "3a6cba": { surf: N.info, text: N.info2 }, "2980b9": { surf: N.info, text: N.info2 }, "1a4a90": { surf: N.info, text: N.info2 },
  "7eaadf": { surf: N.info2, text: N.info2 }, "7aa6e0": { surf: N.info2, text: N.info2 }, "aac8ff": { surf: N.info2, text: N.info2 },
  /* viola profondi */
  "6d28d9": { surf: N.viola, text: N.violaSoft }, "7c3aed": { surf: N.viola, text: N.violaSoft },
  "4c1d95": { surf: N.violaDeep, text: N.violaSoft }, "5a3a7a": { surf: N.violaDeep, text: N.violaSoft },
  "4a3b7a": { surf: N.violaDeep, text: N.violaSoft }, "6f44c9": { surf: N.viola, text: N.violaSoft },
  /* DateTimePicker / SendNotification (pergamena bruna) */
  "1a1208": { surf: N.line, text: N.ink }, "b88a25": { surf: N.ciano, text: N.cianoSoft }, "6f5520": { surf: N.cianoDeep, text: N.cianoSoft },
  "fbf3dc": { surf: N.up }, "c8b27a": { surf: N.line, text: N.muted }, "b9a064": { surf: N.line, text: N.muted }, "9a7a20": { surf: N.cianoDeep, text: N.cianoSoft },
  "8b4513": { surf: N.viola, text: N.violaSoft }, "f4e4bc": { surf: N.pan }, "800000": { surf: N.magDeep, text: N.mag }, "a52a2a": { surf: N.magDeep, text: N.mag },
  "a68b7c": { surf: N.faint, text: N.muted }, "5d2e0a": { surf: N.ink, text: N.ink }, "3e1f07": { surf: N.ink, text: N.ink }, "2b1608": { surf: N.ink, text: N.ink },
  /* WorldBossAdmin: neri tinti */
  "1a1320": { surf: N.surf }, "1a0f18": { surf: N.surf }, "120a14": { surf: N.vuoto }, "2a1622": { surf: N.up },
};

/* ── RGBA: pergamena → nesso (stessa alpha) ── */
const RGBA = {
  "212,175,55": [139, 92, 246],   // oro → viola (bordi/aloni)
  "180,140,40": [139, 92, 246],
  "169,120,26": [139, 92, 246],
  "124,86,15": [139, 92, 246],
  "130,10,10": [232, 121, 249],   // rosso → magenta
  "176,48,48": [232, 121, 249],
  "180,30,30": [232, 121, 249],
  "184,54,42": [232, 121, 249],
  "220,60,60": [248, 113, 113],
  "231,76,60": [248, 113, 113],
  "255,80,80": [248, 113, 113],
  "160,69,69": [248, 113, 113],
  "86,64,30": [0, 0, 8],          // ombre brune → ombre del vuoto
  "95,56,24": [0, 0, 8],
  "45,32,14": [0, 0, 8],
  "80,60,20": [0, 0, 8],
  "74,50,18": [0, 0, 8],
  "20,16,10": [0, 0, 8],
  "20,14,8": [0, 0, 8],
  "245,230,200": [20, 20, 44],    // veli crema → veli scuri
  "255,253,245": [20, 20, 44],
  "253,246,227": [20, 20, 44],
  "243,234,212": [20, 20, 44],
  "255,220,170": [251, 191, 36],
  "255,184,77": [251, 191, 36],
  "46,204,113": [52, 211, 153],
  "39,174,96": [52, 211, 153],
  "60,160,80": [52, 211, 153],
  "26,122,60": [52, 211, 153],
  "64,156,255": [56, 189, 248],
  "34,70,110": [56, 189, 248],
  "26,74,144": [56, 189, 248],
  "124,58,237": [139, 92, 246],
};

const TEXT_PROPS = new Set(["color", "-webkit-text-fill-color", "caret-color"]);
const unmapped = new Map();

function norm(hex) {
  let h = hex.toLowerCase();
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  return h;
}

function mapValue(value, isText) {
  let changed = false;
  let out = value.replace(/#([0-9a-fA-F]{3,8})\b/g, (m, hex) => {
    const h = norm(hex);
    const base = h.slice(0, 6);
    const alpha = h.slice(6);
    const e = MAP[base] || MAP[hex.toLowerCase()];
    if (!e) {
      unmapped.set(base, (unmapped.get(base) || 0) + 1);
      return m;
    }
    changed = true;
    const to = isText && e.text ? e.text : e.surf;
    if (to.startsWith("rgba") && alpha) return to; // tinta già con alpha
    return to + alpha;
  });
  out = out.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9.]+)\s*)?\)/g, (m, r, g, b, _c, a) => {
    const to = RGBA[`${+r},${+g},${+b}`];
    if (!to) return m;
    changed = true;
    return a !== undefined ? `rgba(${to[0]}, ${to[1]}, ${to[2]}, ${a})` : `rgb(${to[0]}, ${to[1]}, ${to[2]})`;
  });
  return changed ? out : null;
}

let totalDecls = 0;
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const css = fs.readFileSync(abs, "utf8");
  const root = postcss.parse(css, { from: rel });
  let n = 0;
  root.walkDecls((decl) => {
    const isText = TEXT_PROPS.has(decl.prop.toLowerCase());
    const v = mapValue(decl.value, isText);
    if (v !== null) { decl.value = v; n++; }
  });
  totalDecls += n;
  console.log(`[admin-to-nesso] ${rel}: ${n} dichiarazioni riscritte`);
  if (!DRY) fs.writeFileSync(abs, root.toString());
}
console.log(`[admin-to-nesso] totale ${totalDecls} dichiarazioni${DRY ? " (dry)" : ""}`);
if (unmapped.size) {
  console.log("[admin-to-nesso] colori NON mappati (lasciati):");
  for (const [h, c] of [...unmapped].sort((a, b) => b[1] - a[1])) console.log(`   #${h} ×${c}`);
}
