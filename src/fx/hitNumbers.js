/* ============================================================
   NUMERI DEI COLPI (2026-11-04) — "−12" che salta fuori dallo sprite,
   come nei giochi old style. Ogni numero è disegnato su un piccolo
   canvas (grassetto, contorno scuro pieno, due toni di colore)
   e ingrandito ×2 senza sfumare: pixel visibili ma leggibile.

   Uso:  popNumber({ x, y, value, kind, el, delay, crit, text })
     x, y  = px dello SCHERMO (centro dello sprite)
     value = numero (il segno lo mette kind: dmg "−", heal "+")
     kind  = dmg · heal · miss · text
     el    = elemento del danno (colore): fire, frost, water, lightning,
             earth, acid, poison, darkness, radiant, arcane, psychic, physical
             (anche i nomi dei pet / D&D: cold, necrotic, neutral, thunder, force…)
   popAt(key, o)  = stesso, sullo sprite con data-vfx-target="key"
   popOnEl(el, o) = stesso, su un elemento del DOM
   ============================================================ */

const PX = 2; // ingrandimento del canvas (lato del "pixel")
const ALIAS = {
  cold: "frost", necrotic: "darkness", neutral: "physical", thunder: "lightning", force: "arcane",
  bludgeoning: "physical", piercing: "physical", slashing: "physical",
  fuoco: "fire", freddo: "frost", gelo: "frost", fulmine: "lightning", veleno: "poison", acido: "acid",
  necrotico: "darkness", radioso: "radiant", psichico: "psychic", forza: "arcane", tuono: "lightning",
};
// [colore in alto, colore in basso, contorno]
const COL = {
  fire:      ["#ffe27a", "#ff6a1a", "#3a0c02"],
  frost:     ["#f0fdff", "#5fd0ff", "#06213f"],
  water:     ["#d8f6ff", "#3aa4ff", "#041f45"],
  lightning: ["#fffbd2", "#ffd21a", "#3a2600"],
  thunder:   ["#ffffff", "#a9cbdc", "#263846"],
  earth:     ["#ffe2b0", "#c9823a", "#2c1606"],
  acid:      ["#f4ffc0", "#93e01c", "#132c02"],
  poison:    ["#f3d6ff", "#b25cff", "#22073f"],
  darkness:  ["#e6d4ff", "#8a55f0", "#12051f"],
  radiant:   ["#ffffff", "#ffd640", "#3d2a00"],
  arcane:    ["#f2e8ff", "#a77bff", "#1b0a45"],
  psychic:   ["#ffe6f8", "#ff6fd8", "#3a0533"],
  physical:  ["#ffffff", "#ff4a3a", "#2a0505"],
  heal:      ["#e8ffe8", "#3dea6a", "#04300f"],
  miss:      ["#f2f2f2", "#a9a9b4", "#1c1c22"],
  text:      ["#fffbe8", "#ffd27a", "#2a1a05"],
  // scritte sotto il numero (2026-11-04): immune / resiste / vulnerabile / furia
  imm:       ["#ffffff", "#9fb3cc", "#0d1626"],
  res:       ["#fff1d6", "#d9a35a", "#2a1806"],
  vul:       ["#fff59a", "#ff5a1f", "#3a0303"],
  rage:      ["#ffe0d0", "#ff6a4a", "#3a0505"],
  corrode:   ["#f8ffd4", "#c2f545", "#2e6108"],
};
export const TAG_TEXT = { imm: "IMMUNE", res: "RESISTE", vul: "VULNERABILE!", rage: "FURIA", corrode: "CORROSIONE ×1,5" };
/* Scritta sotto il numero del colpo: popTag({x, y, tag, delay}) */
export function popTag(o) {
  if (!TAG_TEXT[o.tag]) return;
  popNumber({ ...o, kind: "text", tone: o.tag, text: TAG_TEXT[o.tag], noStack: true, y: o.y + 30 });
}
export const numberElement = (el) => (COL[el] ? el : COL[ALIAS[el]] ? ALIAS[el] : "physical");

let layer = null;
const recent = new Map(); // impila i numeri sullo stesso punto

function ensureLayer() {
  if (typeof document === "undefined") return false;
  if (layer && document.body.contains(layer)) return true;
  layer = document.createElement("div");
  layer.className = "hitnum-layer";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9600", overflow: "hidden" });
  document.body.appendChild(layer);
  if (!document.getElementById("hitnum-css")) {
    const st = document.createElement("style");
    st.id = "hitnum-css";
    st.textContent = `
.hitnum { position: absolute; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; will-change: transform, opacity;
  animation: hitnum-pop var(--hn-dur, 1100ms) linear forwards; opacity: 0; }
.hitnum.is-crit { animation-name: hitnum-crit; }
.hitnum.is-miss { animation-name: hitnum-miss; }
.hitnum.is-tag { animation-name: hitnum-tag; }
@keyframes hitnum-tag {
  0%   { opacity: 0; transform: translate(var(--hn-x), var(--hn-y)) translate(-50%, -50%) scale(.6); }
  14%  { opacity: 1; transform: translate(var(--hn-x), calc(var(--hn-y) - 10px)) translate(-50%, -50%) scale(1.15); }
  24%  { transform: translate(var(--hn-x), calc(var(--hn-y) - 8px)) translate(-50%, -50%) scale(1); }
  80%  { opacity: 1; transform: translate(var(--hn-x), calc(var(--hn-y) - 30px)) translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(var(--hn-x), calc(var(--hn-y) - 40px)) translate(-50%, -50%) scale(.95); }
}
@keyframes hitnum-pop {
  0%   { opacity: 1; transform: translate(var(--hn-x), var(--hn-y)) translate(-50%, -50%) scale(.4); }
  12%  { opacity: 1; transform: translate(var(--hn-x), calc(var(--hn-y) - 26px)) translate(-50%, -50%) scale(1.25); }
  22%  { transform: translate(var(--hn-x), calc(var(--hn-y) - 20px)) translate(-50%, -50%) scale(1); }
  32%  { transform: translate(calc(var(--hn-x) + var(--hn-dx) * .3), calc(var(--hn-y) - 30px)) translate(-50%, -50%) scale(1); }
  78%  { opacity: 1; transform: translate(calc(var(--hn-x) + var(--hn-dx) * .7), calc(var(--hn-y) - 44px)) translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(var(--hn-x), calc(var(--hn-y) - 56px)) translate(-50%, -50%) scale(.9); }
}
@keyframes hitnum-crit {
  0%   { opacity: 1; transform: translate(var(--hn-x), var(--hn-y)) translate(-50%, -50%) scale(.3) rotate(-8deg); }
  10%  { opacity: 1; transform: translate(var(--hn-x), calc(var(--hn-y) - 30px)) translate(-50%, -50%) scale(1.6) rotate(4deg); }
  18%  { transform: translate(calc(var(--hn-x) - 3px), calc(var(--hn-y) - 24px)) translate(-50%, -50%) scale(1.15) rotate(-3deg); }
  24%  { transform: translate(calc(var(--hn-x) + 3px), calc(var(--hn-y) - 26px)) translate(-50%, -50%) scale(1.2) rotate(2deg); }
  30%  { transform: translate(var(--hn-x), calc(var(--hn-y) - 28px)) translate(-50%, -50%) scale(1.15) rotate(0); }
  80%  { opacity: 1; transform: translate(var(--hn-x), calc(var(--hn-y) - 44px)) translate(-50%, -50%) scale(1.15); }
  100% { opacity: 0; transform: translate(var(--hn-x), calc(var(--hn-y) - 58px)) translate(-50%, -50%) scale(1); }
}
@keyframes hitnum-miss {
  0%   { opacity: 0; transform: translate(var(--hn-x), var(--hn-y)) translate(-50%, -50%); }
  12%  { opacity: 1; }
  75%  { opacity: 1; transform: translate(calc(var(--hn-x) + 14px), calc(var(--hn-y) - 22px)) translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(calc(var(--hn-x) + 18px), calc(var(--hn-y) - 30px)) translate(-50%, -50%); }
}
@media (prefers-reduced-motion: reduce) { .hitnum { animation-duration: 900ms; } }`;
    document.head.appendChild(st);
  }
  return true;
}

// Disegna il testo su un canvas piccolo: contorno scuro di 2 pixel pieni + ombra + due toni.
function render(text, colors, fontPx) {
  // grassetto di sistema (nel Pixelify in grassetto il 2 sembra un 8): il canvas piccolo ingrandito lo rende a pixel
  const font = `900 ${fontPx}px "Arial Black", "Segoe UI Black", "Segoe UI", system-ui, sans-serif`;
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 8, h = Math.ceil(fontPx * 1.25) + 8;
  c.width = w; c.height = h;
  g.font = font; g.textBaseline = "middle"; g.textAlign = "center";
  const cx = w / 2, cy = h / 2;
  // ombra in basso a destra
  g.fillStyle = "rgba(0,0,0,.55)";
  g.fillText(text, cx + 2, cy + 2);
  // contorno: il testo ripetuto attorno (1 pixel pieno, più spesso sotto: i buchi delle cifre restano aperti)
  g.fillStyle = colors[2];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) g.fillText(text, cx + dx, cy + dy);
  g.fillText(text, cx + 1, cy + 2); g.fillText(text, cx, cy + 2); g.fillText(text, cx - 1, cy + 2);
  // riempimento a due toni (chiaro in alto)
  const gr = g.createLinearGradient(0, cy - fontPx / 2, 0, cy + fontPx / 2);
  gr.addColorStop(0, colors[0]); gr.addColorStop(0.45, colors[0]); gr.addColorStop(0.55, colors[1]); gr.addColorStop(1, colors[1]);
  g.fillStyle = gr;
  g.fillText(text, cx, cy);
  return c;
}

export function popNumber(o) {
  if (!ensureLayer()) return;
  const show = () => {
    const kind = o.kind || "dmg";
    const colors = kind === "heal" ? COL.heal : kind === "miss" ? COL.miss : kind === "text" ? COL[o.tone] || COL.text : COL[numberElement(o.el)];
    const v = Math.abs(Math.round(Number(o.value) || 0));
    const text = o.text || (kind === "miss" ? "MANCATO" : kind === "heal" ? `+${v}` : `−${v}${o.crit ? "!" : ""}`);
    const small = window.innerWidth < 700;
    const base = kind === "miss" || kind === "text" ? 11 : o.crit ? 17 : 14;
    const cv = render(text, colors, small ? base - 1 : base);
    cv.className = `hitnum${o.crit ? " is-crit" : ""}${kind === "miss" ? " is-miss" : ""}${o.tone ? " is-tag" : ""}`;
    cv.style.width = `${cv.width * PX}px`;
    cv.style.height = `${cv.height * PX}px`;
    // impila: un numero sullo stesso punto da poco → un po' più in alto e di lato
    const key = `${Math.round(o.x / 40)}:${Math.round(o.y / 40)}`;
    const now = performance.now();
    const prev = recent.get(key);
    const n = o.noStack ? 0 : prev && now - prev.at < 700 ? prev.n + 1 : 0;
    if (!o.noStack) recent.set(key, { at: now, n });
    const x = o.x + (n % 2 ? 18 : -18) * Math.min(n, 3), y = o.y - n * 22;
    cv.style.setProperty("--hn-x", `${Math.round(x)}px`);
    cv.style.setProperty("--hn-y", `${Math.round(y)}px`);
    cv.style.setProperty("--hn-dx", `${(Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10)}px`);
    cv.style.setProperty("--hn-dur", `${o.crit ? 1300 : 1100}ms`);
    layer.appendChild(cv);
    setTimeout(() => cv.remove(), (o.crit ? 1300 : 1100) + 80);
  };
  if (o.delay > 0) setTimeout(show, o.delay); else show();
}

/** Centro alto di un elemento del DOM (dove esce il numero). */
export function pointOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.35 };
}
export function popOnEl(el, o) {
  const p = pointOf(el);
  if (p) popNumber({ ...o, ...p });
}
export function popAt(key, o) {
  if (typeof document === "undefined") return;
  popOnEl(document.querySelector(`[data-vfx-target="${key}"]`), o);
}

// prova dalla console: __hitNum(12, "fire", {crit:true})
if (typeof window !== "undefined") {
  window.__hitNum = (value = 12, el = "fire", x = {}) =>
    popNumber({ x: window.innerWidth / 2, y: window.innerHeight / 2, value, el, kind: x.kind || "dmg", crit: !!x.crit });
}
