/* ============================================================
   SPELL FX (2026-11-04) — effetti degli incantesimi "RPG old style".
   Un unico canvas a tutto schermo sopra la pagina, disegnato a bassa
   risoluzione (1 pixel = SCALE px dello schermo) e ingrandito senza
   sfumare: pixel grossi come nei giochi a 16 bit, ma con luce vera
   (fusione additiva "lighter": i colori si sommano e brillano), fumo
   grigio, fiamme, scariche, schegge, anelli.

   Uso:  playSpell({ kind, el, from, to, miss, kill, crit, delay, scale })
     kind  = bolt (proiettile) · arrow · slash · hit · aoe · beam · strike
             (fulmine dall'alto) · breath · cloud · curse · drain · wave ·
             heal · buff · shield · debuff · impact · burst
             forme fisiche dei pet (2026-11-05): claw · bite · stomp · whip ·
             sting · dash · spikes · rain · roar · sleep
     el    = fire · frost · water · lightning · earth · acid · poison ·
             darkness · radiant · arcane · psychic · physical
     from/to = { x, y, size, bottom? } in px dello SCHERMO (getBoundingClientRect)
   Le coordinate si danno sempre in px dello schermo: la conversione è qui.
   ============================================================ */

const SCALE = 3;                     // lato del "pixel" sullo schermo
const MAX_PARTS = 1600;

/* ── palette per elemento: [nucleo, pieno, profondo, scuro, fumo] ── */
const PAL = {
  fire:      ["#fff6d0", "#ffb52e", "#ff4f12", "#a3170a", "#4d4140"],
  frost:     ["#ffffff", "#a8ecff", "#45a8ff", "#1b4fb5", "#9bb4cc"],
  water:     ["#effcff", "#62c9ff", "#1f80e6", "#0c3c8c", "#a6c6da"],
  lightning: ["#ffffff", "#fff47e", "#ffcc1a", "#7d5cff", "#6b6680"],
  thunder:   ["#ffffff", "#c9e4ef", "#7d9ead", "#394b60", "#829095"],
  earth:     ["#fff0cc", "#dca35e", "#8f5d2c", "#46301a", "#7c6b58"],
  acid:      ["#f8ffd4", "#c2f545", "#6fc412", "#2e6108", "#5f6e45"],
  poison:    ["#f8e4ff", "#c77bff", "#8b2be8", "#3a0c70", "#4f3d63"],
  darkness:  ["#efe2ff", "#a06bff", "#55209a", "#150a26", "#251c30"],
  radiant:   ["#ffffff", "#fff3b0", "#ffd640", "#e0960e", "#8a7f6a"],
  arcane:    ["#ffffff", "#c8a6ff", "#7f4dff", "#35179c", "#4c4668"],
  psychic:   ["#fff2fc", "#ff94e4", "#e43cc6", "#6b1a8f", "#5c4660"],
  physical:  ["#ffffff", "#fff1c4", "#f2b552", "#8a4b1f", "#6c6258"],
};
// colori del ramo magico (forma "vine", Frusta di Rovi)
const VINE = { dark: "#1c2410", bark: "#6b4a26", vein: "#a8e05a", thorn: "#e8dcae", leaf: "#3f9a2a", leafHi: "#b6f06a", aura: "#7dff6a" };
// nomi che arrivano dai pet (tipi D&D) → elementi del motore
const ALIAS = { cold: "frost", necrotic: "darkness", neutral: "physical", force: "arcane" };
export const fxElement = (el) => (PAL[el] ? el : PAL[ALIAS[el]] ? ALIAS[el] : "arcane");

/* ── canvas ── */
let cvs = null, ctx = null, W = 0, H = 0, raf = 0, last = 0;
const parts = [];
const actors = [];
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function ensure() {
  if (cvs && document.body.contains(cvs)) return true;
  if (typeof document === "undefined") return false;
  cvs = document.createElement("canvas");
  cvs.className = "spellfx-canvas";
  Object.assign(cvs.style, {
    position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none",
    zIndex: "9500", imageRendering: "pixelated",
  });
  cvs.setAttribute("aria-hidden", "true");
  document.body.appendChild(cvs);
  ctx = cvs.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  return true;
}
function resize() {
  if (!cvs) return;
  W = Math.ceil(window.innerWidth / SCALE);
  H = Math.ceil(window.innerHeight / SCALE);
  cvs.width = W; cvs.height = H;
  ctx.imageSmoothingEnabled = false;
}
const S = (v) => v / SCALE; // px schermo → pixel del canvas

/* ── sprite di luce pre-disegnati (cache per colore/raggio) ── */
const glowCache = new Map();
function glow(color, hard = 0) {
  const key = color + hard;
  let g = glowCache.get(key);
  if (g) return g;
  g = document.createElement("canvas");
  g.width = g.height = 32;
  const c = g.getContext("2d");
  const rg = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, color);
  rg.addColorStop(hard ? 0.6 : 0.4, color);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = rg;
  c.fillRect(0, 0, 32, 32);
  glowCache.set(key, g);
  return g;
}
// sbuffo di fumo: disco pieno con bordo morbido e un riflesso in alto
const puffCache = new Map();
function puff(color) {
  let g = puffCache.get(color);
  if (g) return g;
  g = document.createElement("canvas");
  g.width = g.height = 32;
  const c = g.getContext("2d");
  const rg = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, color);
  rg.addColorStop(0.7, color);
  rg.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = rg;
  c.beginPath(); c.arc(16, 16, 16, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = "source-atop";
  c.fillStyle = "rgba(255,255,255,.18)";
  c.beginPath(); c.arc(12, 11, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(0,0,0,.22)";
  c.beginPath(); c.arc(19, 22, 10, 0, Math.PI * 2); c.fill();
  puffCache.set(color, g);
  return g;
}

/* ── particelle ── */
const R = Math.random;
const rr = (a, b) => a + R() * (b - a);
// p: { x,y, vx,vy, ax,ay, drag, life, t, r, r1, type, c (colore o palette), a, rot, vr }
function add(p) {
  if (parts.length >= MAX_PARTS) parts.shift();
  parts.push({ vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, t: 0, r1: p.r, a: 1, rot: 0, vr: 0, ...p });
}
function lerpColor(pal, k) {
  // k 0..1 lungo [nucleo, pieno, profondo, scuro]
  const i = Math.min(3, Math.floor(k * 4));
  return pal[i];
}
function drawParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t >= p.life) { parts.splice(i, 1); continue; }
    if (p.wait && p.t < p.wait) continue;
    const k = p.t / p.life;
    const f = Math.pow(1 - p.drag, dt * 60);
    p.vx = (p.vx + p.ax * dt) * f;
    p.vy = (p.vy + p.ay * dt) * f;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const r = p.r + (p.r1 - p.r) * k;
    if (r <= 0.2) continue;
    const fade = p.fadeIn ? Math.min(1, k / p.fadeIn) * (1 - k) : 1 - k * k;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a * fade));
    switch (p.type) {
      case "glow":
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glow(p.c), p.x - r, p.y - r, r * 2, r * 2);
        break;
      case "flame": // una fiammella che passa dal bianco al rosso e poi si spegne
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(glow(lerpColor(p.c, k), 1), p.x - r, p.y - r, r * 2, r * 2);
        break;
      case "smoke":
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(puff(p.c), p.x - r, p.y - r, r * 2, r * 2);
        break;
      case "spark": { // scintilla allungata nel verso del moto
        ctx.globalCompositeOperation = "lighter";
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const L = Math.min(r * 6, sp * 0.05 + r);
        ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(1, r * 0.7); ctx.lineCap = "square";
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L); ctx.stroke();
        break;
      }
      case "shard": { // scheggia di ghiaccio / cristallo
        ctx.globalCompositeOperation = "source-over";
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c2 || "#1b4fb5";
        ctx.beginPath(); ctx.moveTo(0, -r * 2.2 - 1); ctx.lineTo(r + 1, 0); ctx.lineTo(0, r * 2.2 + 1); ctx.lineTo(-r - 1, 0); ctx.fill();
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(0, -r * 2.2); ctx.lineTo(r, 0); ctx.lineTo(0, r * 2.2); ctx.lineTo(-r, 0); ctx.fill();
        ctx.restore();
        break;
      }
      case "rock": // sasso: quadrato con bordo scuro
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = p.c2 || "#2a1d10";
        ctx.fillRect(Math.round(p.x - r - 1), Math.round(p.y - r - 1), Math.round(r * 2 + 2), Math.round(r * 2 + 2));
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x - r), Math.round(p.y - r), Math.round(r * 2), Math.round(r * 2));
        break;
      case "bubble":
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.c; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.fillRect(Math.round(p.x - r * 0.4), Math.round(p.y - r * 0.5), 1, 1);
        break;
      case "star": { // stellina a quattro punte
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.c;
        const a = Math.max(1, Math.round(r));
        ctx.fillRect(Math.round(p.x - a * 2), Math.round(p.y), a * 4, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y - a * 2), 1, a * 4);
        ctx.drawImage(glow(p.c), p.x - a, p.y - a, a * 2, a * 2);
        break;
      }
      default:
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x - r), Math.round(p.y - r), Math.round(r * 2), Math.round(r * 2));
    }
  }
}

/* ── attori: pezzi con una durata che disegnano e generano particelle ── */
// a: { start (ms), dur (ms), fn(t 0..1, dt, a) }
function actor(delay, dur, fn, extra = {}) { actors.push({ start: performance.now() + delay, dur, fn, ...extra }); }

function loop(now) {
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, W, H);
  for (let i = actors.length - 1; i >= 0; i--) {
    const a = actors[i];
    if (now < a.start) continue;
    const t = Math.min(1, (now - a.start) / a.dur);
    ctx.globalAlpha = 1;
    a.fn(t, dt, a);
    if (t >= 1) actors.splice(i, 1);
  }
  drawParts(dt);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (actors.length || parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; last = 0; ctx.clearRect(0, 0, W, H); }
}
function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

/* ── disegni ricorrenti ── */
function lightningPath(x1, y1, x2, y2, disp, out = []) {
  // spostamento del punto medio: la classica saetta frastagliata
  const pts = [[x1, y1], [x2, y2]];
  let d = disp;
  for (let it = 0; it < 5; it++) {
    for (let i = pts.length - 1; i > 0; i--) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      const o = (R() - 0.5) * d;
      pts.splice(i, 0, [mx + (nx / nl) * o, my + (ny / nl) * o]);
    }
    d *= 0.55;
  }
  out.push(pts);
  return pts;
}
function strokePath(pts, color, w, alpha = 1) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = "miter"; ctx.lineCap = "square";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function bolt(x1, y1, x2, y2, pal, w = 2, disp) {
  const pts = lightningPath(x1, y1, x2, y2, disp ?? Math.hypot(x2 - x1, y2 - y1) * 0.3);
  strokePath(pts, pal[3], w + 3, 0.5);
  strokePath(pts, pal[1], w + 1, 0.9);
  strokePath(pts, pal[0], Math.max(1, w - 1), 1);
}
function ring(x, y, r, color, w = 1, alpha = 1, squash = 0.55, dash = null, rot = 0) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color; ctx.lineWidth = w;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, r), Math.max(0.5, r * squash), rot, 0, Math.PI * 2); ctx.stroke();
  if (dash) ctx.setLineDash([]);
}
function blob(x, y, r, color, alpha = 1) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
}

/* ── pezzi delle forme fisiche (2026-11-05) ── */
// taglio: tre strati (alone, colore, nucleo bianco)
function slashLine(x1, y1, x2, y2, pal, w, a) {
  strokePath([[x1, y1], [x2, y2]], pal[2], w + 2.5, 0.55 * a);
  strokePath([[x1, y1], [x2, y2]], pal[1], w + 0.8, a);
  strokePath([[x1, y1], [x2, y2]], pal[0], Math.max(1, w - 1), a);
}
// mascella: arco pieno con i denti a punta (dir 1 = in alto, i denti guardano giù)
function jaw(x, y, w, pal, a, dir) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = a;
  const n = 5, tw = (w * 2) / n, th = Math.max(2, w * 0.45);
  ctx.fillStyle = pal[3];
  ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - dir * th * 0.6), w + 1, th * 0.9 + 1, 0, dir > 0 ? Math.PI : 0, dir > 0 ? Math.PI * 2 : Math.PI); ctx.fill();
  for (let i = 0; i < n; i++) {
    const x0 = x - w + i * tw;
    ctx.fillStyle = pal[3];
    ctx.beginPath(); ctx.moveTo(Math.round(x0 - 1), Math.round(y)); ctx.lineTo(Math.round(x0 + tw + 1), Math.round(y)); ctx.lineTo(Math.round(x0 + tw / 2), Math.round(y + dir * (th + 1))); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(Math.round(x0), Math.round(y)); ctx.lineTo(Math.round(x0 + tw), Math.round(y)); ctx.lineTo(Math.round(x0 + tw / 2), Math.round(y + dir * th)); ctx.fill();
  }
  blob(x, y, w * 1.2, pal[1], 0.35 * a);
}
// stella a quattro punte (schiocco)
function star4(x, y, r, color, a) {
  strokePath([[x - r, y], [x + r, y]], color, 1, a);
  strokePath([[x, y - r], [x, y + r]], color, 1, a);
  strokePath([[x - r * 0.5, y - r * 0.5], [x + r * 0.5, y + r * 0.5]], color, 1, a * 0.7);
  strokePath([[x - r * 0.5, y + r * 0.5], [x + r * 0.5, y - r * 0.5]], color, 1, a * 0.7);
}
// spuntone dal terreno, con la faccia dell'elemento
function spike(x, gy, w, h, el, pal) {
  if (h <= 0.5) return;
  if (el === "fire") { for (let i = 0; i < 2; i++) add({ type: "flame", c: pal, x: x + rr(-w, w) * 0.5, y: gy - h * R(), vy: -rr(40, 90), r: w * 0.9, r1: w * 0.2, life: 0.3 }); return; }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const pts = [[x - w, gy], [x, gy - h], [x + w, gy]];
  ctx.fillStyle = pal[3];
  ctx.beginPath(); ctx.moveTo(Math.round(pts[0][0] - 1), Math.round(gy)); ctx.lineTo(Math.round(x), Math.round(gy - h - 1)); ctx.lineTo(Math.round(pts[2][0] + 1), Math.round(gy)); ctx.fill();
  ctx.fillStyle = pal[1];
  ctx.beginPath(); ctx.moveTo(Math.round(pts[0][0]), Math.round(gy)); ctx.lineTo(Math.round(x), Math.round(gy - h)); ctx.lineTo(Math.round(pts[2][0]), Math.round(gy)); ctx.fill();
  ctx.fillStyle = pal[0];
  ctx.beginPath(); ctx.moveTo(Math.round(x - w * 0.25), Math.round(gy)); ctx.lineTo(Math.round(x), Math.round(gy - h + 1)); ctx.lineTo(Math.round(x + 0.5), Math.round(gy)); ctx.fill();
  if (el === "frost" || el === "lightning" || el === "radiant" || el === "arcane" || el === "psychic") blob(x, gy - h * 0.6, w * 1.6, pal[1], 0.4);
}
// "Z" a pixel (p = lato del pixel nel canvas)
function pixelZ(x, y, p, color, a) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = Math.max(0, a);
  const rows = ["11111", "00010", "00100", "01000", "11111"];
  const ox = Math.round(x), oy = Math.round(y);
  ctx.fillStyle = "#2a1a4a";
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === "1") ctx.fillRect(ox + i * p - 1, oy + j * p - 1, p + 2, p + 2); }));
  ctx.fillStyle = color;
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === "1") ctx.fillRect(ox + i * p, oy + j * p, p, p); }));
}

/* ── scie dei proiettili per elemento ── */
function trail(el, pal, x, y, vx, vy, s) {
  const back = Math.hypot(vx, vy) || 1;
  const bx = -vx / back, by = -vy / back;
  switch (el) {
    case "fire":
      add({ type: "flame", c: pal, x: x + rr(-1, 1) * s * 0.4, y: y + rr(-1, 1) * s * 0.4, vx: bx * rr(30, 80) + rr(-20, 20), vy: by * rr(30, 80) - rr(15, 45), r: s * rr(0.9, 1.4), r1: s * 0.2, life: rr(0.3, 0.55) });
      if (R() < 0.45) add({ type: "smoke", c: pal[4], x, y, vx: bx * 25 + rr(-10, 10), vy: -rr(10, 35), r: s * 0.7, r1: s * 2, life: rr(0.6, 0.9), a: 0.6, fadeIn: 0.25 });
      if (R() < 0.4) add({ type: "sq", c: pal[1], x, y, vx: bx * 40 + rr(-30, 30), vy: rr(-50, 10), ay: 60, r: 0.6, r1: 0.4, life: 0.5 });
      break;
    case "frost":
      add({ type: "glow", c: pal[2], x, y, vx: bx * 30, vy: by * 30 + rr(-10, 10), r: s * 0.9, r1: s * 0.2, life: 0.35, a: 0.6 });
      if (R() < 0.45) add({ type: "shard", c: pal[1], c2: pal[3], x, y, vx: bx * rr(30, 70) + rr(-20, 20), vy: rr(-20, 30), ay: 80, r: rr(0.7, 1.3), life: 0.6, rot: rr(0, 6), vr: rr(-8, 8) });
      if (R() < 0.3) add({ type: "smoke", c: pal[4], x, y, vy: rr(-5, 5), r: s * 0.5, r1: s * 1.3, life: 0.6, a: 0.35, fadeIn: 0.2 });
      break;
    case "water":
      add({ type: "glow", c: pal[2], x, y, vx: bx * 25, vy: by * 25, r: s * 0.8, r1: s * 0.2, life: 0.3, a: 0.6 });
      if (R() < 0.5) add({ type: "glow", c: pal[1], x, y, vx: bx * 30 + rr(-20, 20), vy: rr(-30, 0), ay: 160, r: s * 0.25, life: 0.5 });
      if (R() < 0.2) add({ type: "bubble", c: pal[0], x, y, vy: -rr(10, 30), r: rr(1, 2), life: 0.6 });
      break;
    case "lightning":
      if (R() < 0.6) add({ type: "spark", c: pal[1], x, y, vx: rr(-120, 120), vy: rr(-120, 120), drag: 0.08, r: 1, life: 0.2 });
      add({ type: "glow", c: pal[3], x, y, vx: bx * 30, vy: by * 30, r: s * 0.7, r1: 0, life: 0.2, a: 0.6 });
      break;
    case "earth":
      if (R() < 0.6) add({ type: "rock", c: pal[1], c2: pal[3], x, y, vx: bx * 30 + rr(-20, 20), vy: rr(-30, 0), ay: 200, r: rr(0.6, 1.4), life: 0.6 });
      if (R() < 0.5) add({ type: "smoke", c: pal[4], x, y, vx: bx * 15, vy: rr(-10, 0), r: s * 0.5, r1: s * 1.4, life: 0.6, a: 0.5, fadeIn: 0.2 });
      break;
    case "acid":
    case "poison":
      add({ type: "glow", c: pal[2], x, y, vx: bx * 25, vy: by * 25, r: s * 0.8, r1: s * 0.25, life: 0.35, a: 0.7 });
      if (R() < 0.45) add({ type: "glow", c: pal[1], x, y, vx: bx * 20 + rr(-15, 15), vy: rr(-10, 10), ay: 140, r: s * 0.28, life: 0.6 });
      if (R() < 0.3) add({ type: "smoke", c: pal[3], x, y, vy: -rr(5, 20), r: s * 0.5, r1: s * 1.4, life: 0.7, a: 0.4, fadeIn: 0.25 });
      break;
    case "darkness":
      add({ type: "smoke", c: pal[3], x: x + rr(-1, 1) * s * 0.3, y: y + rr(-1, 1) * s * 0.3, vx: bx * 25 + rr(-10, 10), vy: by * 25 + rr(-15, 5), r: s * 0.7, r1: s * 1.5, life: rr(0.4, 0.6), a: 0.8, fadeIn: 0.15 });
      if (R() < 0.5) add({ type: "glow", c: pal[1], x, y, vx: rr(-30, 30), vy: rr(-30, 30), r: s * 0.25, life: 0.4 });
      break;
    case "radiant":
      add({ type: "glow", c: pal[2], x, y, vx: bx * 20, vy: by * 20, r: s * 0.8, r1: 0, life: 0.3, a: 0.7 });
      if (R() < 0.45) add({ type: "star", c: pal[R() < 0.5 ? 0 : 1], x: x + rr(-1, 1) * s, y: y + rr(-1, 1) * s, vy: rr(-15, 5), r: rr(0.6, 1.2), life: 0.45 });
      break;
    case "psychic":
    case "arcane":
    default: {
      const k = performance.now() / 70;
      add({ type: "glow", c: pal[2], x, y, vx: bx * 25, vy: by * 25, r: s * 0.8, r1: 0, life: 0.3, a: 0.7 });
      add({ type: "glow", c: pal[1], x: x + Math.cos(k) * s * 0.9, y: y + Math.sin(k) * s * 0.9, vx: bx * 15, vy: by * 15, r: s * 0.3, life: 0.4 });
      add({ type: "glow", c: pal[0], x: x - Math.cos(k) * s * 0.9, y: y - Math.sin(k) * s * 0.9, vx: bx * 15, vy: by * 15, r: s * 0.22, life: 0.4 });
    }
  }
}

/* ── IMPATTO per elemento (anche usato da solo) ── */
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);
// una freccia a pixel: punta in (x, y), lunga len, verso ang. tint = colore della punta per le elementali
function drawArrow(x, y, ang, len, tint) {
  const c = Math.cos(ang), sn = Math.sin(ang), th = Math.max(1, Math.round(len / 14));
  const px = (u, v, col, w = th) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x - c * u - sn * v - w / 2), Math.round(y - sn * u + c * v - w / 2), w, w); };
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  const step = Math.max(0.6, th * 0.7);
  for (let u = 0; u <= len; u += step) px(u, 0, "#1a110b", th + 2); // contorno scuro
  for (let u = 0; u <= len; u += step) px(u, 0, u < len * 0.18 ? (tint || "#c4ccd8") : "#8a5a30");
  const hw = Math.max(2, len * 0.09); // punta a triangolo
  for (let u = 0; u <= len * 0.18; u += step) { const w = hw * (u / (len * 0.18)); for (let v = -w; v <= w; v += step) px(u, v, u < len * 0.05 ? "#ffffff" : (tint || "#c4ccd8")); }
  for (let u = len * 0.7; u <= len; u += step) { const w = Math.max(2, hw * 2.4 * ((u - len * 0.7) / (len * 0.3))); for (let v = -w; v <= w; v += step) px(u, v, Math.abs(v) < step ? "#8a5a30" : Math.abs(v) > w - step ? "#1a110b" : (Math.round(u / step) % 3 ? "#d8433a" : "#f3ead8")); } // piume
}
// la freccia arriva: niente lampo da incantesimo, solo schegge di legno, polvere e qualche scintilla
function arrowHitAt(el, pal, x, y, s, ang, { crit = false } = {}) {
  const k = crit ? 1.4 : 1;
  actor(0, 120, (t) => blob(x, y, s * (0.8 + t) * k, "#fff1c4", (1 - t) * 0.55));
  for (let i = 0; i < 9 * k; i++) {
    const a = ang + Math.PI + rr(-0.9, 0.9), sp = rr(50, 120);
    add({ type: "sq", c: i % 2 ? "#8a5a30" : "#c9a06a", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 220, drag: 0.04, r: rr(0.6, 1.1), r1: 0.4, life: rr(0.35, 0.6) });
  }
  for (let i = 0; i < 4 * k; i++) add({ type: "spark", c: "#ffffff", x, y, vx: rr(-90, 90), vy: rr(-90, 40), drag: 0.08, r: 1, life: rr(0.15, 0.3) });
  for (let i = 0; i < 4; i++) add({ type: "smoke", c: "#8a8070", x: x + rr(-0.5, 0.5) * s, y: y + rr(-0.3, 0.3) * s, vx: rr(-15, 15), vy: -rr(5, 20), r: s * 0.4, r1: s * 1.1, life: rr(0.4, 0.6), a: 0.45 });
  if (el !== "physical") impactAt(el, pal, x, y, s * 0.7, { crit });
}

function impactAt(el, pal, x, y, s, { crit = false, ground = null } = {}) {
  const k = crit ? 1.35 : 1;
  const gy = ground ?? y + s * 1.1;
  // lampo di luce e anello d'urto comuni a tutti
  actor(0, 320, (t) => { blob(x, y, s * (2 + t * 3) * k, pal[2], (1 - t) * 0.8); blob(x, y, s * (1.4 + t * 1.6) * k, pal[1], 1 - t); blob(x, y, s * (0.9 + t) * k, pal[0], 1 - t); });
  actor(0, 420, (t) => ring(x, y, s * (0.8 + t * 3.2) * k, pal[1], Math.max(1, 3 * (1 - t)), 1 - t, 0.75));
  const n = Math.round(14 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rr(-0.2, 0.2), sp = rr(60, 150) * k;
    add({ type: "spark", c: pal[i % 3 ? 1 : 0], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.07, r: 1, life: rr(0.25, 0.45) });
  }
  switch (el) {
    case "fire":
      for (let i = 0; i < 26 * k; i++) {
        const a = rr(-Math.PI, 0), sp = rr(20, 90);
        add({ type: "flame", c: pal, x: x + rr(-1, 1) * s * 0.5, y: y + rr(-0.3, 0.6) * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, ay: -40, drag: 0.03, r: s * rr(0.6, 1.1), r1: s * 0.1, life: rr(0.35, 0.7) });
      }
      for (let i = 0; i < 7; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s * 0.6, y: y + rr(-0.5, 0.3) * s, vx: rr(-25, 25), vy: -rr(15, 40), r: s * 0.8, r1: s * 2, life: rr(0.8, 1.2), a: 0.75, fadeIn: 0.15, wait: 0.12 });
      for (let i = 0; i < 10; i++) add({ type: "sq", c: pal[1], x, y, vx: rr(-80, 80), vy: rr(-120, -30), ay: 140, r: 0.7, r1: 0.4, life: rr(0.6, 0.9) });
      break;
    case "frost":
      for (let i = 0; i < 12 * k; i++) {
        const a = (i / 12) * Math.PI * 2, sp = rr(70, 130);
        add({ type: "shard", c: i % 2 ? pal[0] : pal[1], c2: pal[3], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.1, r: rr(1, 1.8) * k, life: rr(0.5, 0.8), rot: a + Math.PI / 2 });
      }
      for (let i = 0; i < 6; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s * 0.6, y: y + rr(-0.4, 0.4) * s, vx: rr(-15, 15), vy: rr(-10, 5), r: s * 0.7, r1: s * 1.8, life: rr(0.7, 1), a: 0.5, fadeIn: 0.2 });
      for (let i = 0; i < 8; i++) add({ type: "star", c: pal[0], x: x + rr(-1.5, 1.5) * s, y: y - rr(0, 1.5) * s, vy: rr(10, 30), r: rr(0.5, 1), life: rr(0.6, 1), wait: 0.1 });
      break;
    case "water":
      for (let i = 0; i < 18 * k; i++) {
        const a = rr(-Math.PI * 0.95, -Math.PI * 0.05), sp = rr(60, 140);
        add({ type: "glow", c: i % 3 ? pal[1] : pal[0], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 300, r: s * rr(0.22, 0.38), life: rr(0.5, 0.8) });
      }
      actor(80, 500, (t) => { ring(x, gy, s * (0.8 + t * 2.5), pal[1], 1, 1 - t, 0.3); ring(x, gy, s * (0.4 + t * 1.6), pal[0], 1, 1 - t, 0.3); });
      for (let i = 0; i < 6; i++) add({ type: "bubble", c: pal[0], x: x + rr(-1, 1) * s * 0.7, y: y + rr(-0.3, 0.5) * s, vy: -rr(15, 40), r: rr(1, 2.2), life: rr(0.6, 0.9), wait: 0.1 });
      break;
    case "lightning":
      actor(0, 320, () => {
        for (let i = 0; i < 4; i++) { const a = rr(0, Math.PI * 2), L = s * rr(1.3, 2.6) * k; bolt(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, pal, 1, L * 0.5); }
      });
      for (let i = 0; i < 14; i++) add({ type: "spark", c: pal[0], x, y, vx: rr(-200, 200), vy: rr(-200, 120), drag: 0.06, ay: 120, r: 1, life: rr(0.3, 0.6) });
      add({ type: "smoke", c: pal[4], x, y, vy: -20, r: s, r1: s * 2, life: 0.8, a: 0.4, fadeIn: 0.2, wait: 0.15 });
      break;
    case "earth":
      for (let i = 0; i < 16 * k; i++) add({ type: "rock", c: i % 3 ? pal[1] : pal[2], c2: pal[3], x: x + rr(-1, 1) * s * 0.3, y, vx: rr(-110, 110), vy: rr(-170, -50), ay: 420, r: rr(0.8, 2) * k, life: rr(0.6, 0.9) });
      for (let i = 0; i < 8; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s, y: gy - rr(0, 0.6) * s, vx: rr(-40, 40), vy: -rr(5, 25), r: s * 0.7, r1: s * 2, life: rr(0.8, 1.1), a: 0.7, fadeIn: 0.15 });
      break;
    case "acid":
      // Spruzzi viscosi, colature e bolle: niente nube velenosa o scintille elettriche.
      for (let i = 0; i < 28 * k; i++) {
        const a = rr(-Math.PI, Math.PI), sp = rr(35, 125);
        add({ type: "sq", c: pal[i % 3 ? 1 : 2], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, ay: 210, drag: 0.015, r: rr(0.8, 1.7) * k, r1: 0.4, life: rr(0.45, 0.85) });
      }
      actor(50, 800, (t) => {
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = pal[2]; ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i++) {
          const dx = i * s * 0.55, top = y + Math.abs(i) * s * 0.22;
          ctx.beginPath(); ctx.moveTo(x + dx, top); ctx.lineTo(x + dx, top + s * (0.5 + t * (2.5 - Math.abs(i) * 0.4))); ctx.stroke();
        }
        ring(x, gy, s * (1 + t * 2), pal[2], 2, (1 - t) * 0.7, 0.22);
      });
      for (let i = 0; i < 12; i++) add({ type: "bubble", c: pal[1], x: x + rr(-1.2, 1.2) * s, y: y + rr(-0.2, 1) * s, vy: -rr(8, 24), r: rr(0.8, 2), r1: 3, life: rr(0.65, 1.1), wait: rr(0.05, 0.3) });
      for (let i = 0; i < 4; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s, y, vy: -rr(12, 22), r: s * 0.3, r1: s, life: 0.7, a: 0.28 });
      break;
    case "thunder":
      actor(0, 420, (t) => {
        for (let i = 0; i < 3; i++) ring(x, y, s * (0.8 + i * 0.6 + t * 5), pal[i % 2], Math.max(1, 3 * (1 - t)), (1 - t) * 0.8, 0.85);
      });
      for (let i = 0; i < 10; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s, y: gy, vx: rr(-65, 65), vy: -rr(5, 18), r: s * 0.35, r1: s * 1.4, life: 0.5, a: 0.35 });
      break;
    case "poison":
      for (let i = 0; i < 16 * k; i++) {
        const a = rr(-Math.PI, 0), sp = rr(40, 120);
        add({ type: "glow", c: i % 2 ? pal[1] : pal[2], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 260, r: s * rr(0.25, 0.4), life: rr(0.5, 0.8) });
      }
      for (let i = 0; i < 7; i++) add({ type: "smoke", c: el === "acid" ? pal[3] : pal[2], x: x + rr(-1, 1) * s * 0.7, y: y + rr(-0.3, 0.4) * s, vx: rr(-15, 15), vy: -rr(10, 30), r: s * 0.7, r1: s * 1.9, life: rr(0.8, 1.2), a: 0.55, fadeIn: 0.2, wait: 0.1 });
      for (let i = 0; i < 8; i++) add({ type: "bubble", c: pal[1], x: x + rr(-1, 1) * s * 0.8, y: y + rr(-0.2, 0.6) * s, vy: -rr(20, 45), r: rr(1, 2.4), life: rr(0.6, 1), wait: rr(0.05, 0.3) });
      break;
    case "darkness":
      // implosione: puntini che vengono risucchiati, poi fumo nero
      for (let i = 0; i < 18; i++) {
        const a = rr(0, Math.PI * 2), d = s * rr(1.8, 2.6);
        add({ type: "glow", c: pal[1], x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: -Math.cos(a) * d * 3.2, vy: -Math.sin(a) * d * 3.2, r: s * 0.25, r1: 0.4, life: 0.32 });
      }
      for (let i = 0; i < 9; i++) add({ type: "smoke", c: pal[3], x: x + rr(-1, 1) * s * 0.5, y: y + rr(-0.4, 0.4) * s, vx: rr(-35, 35), vy: -rr(15, 45), r: s * 0.7, r1: s * 2, life: rr(0.8, 1.1), a: 0.85, fadeIn: 0.15, wait: 0.28 });
      actor(260, 420, (t) => ring(x, y, s * (0.4 + t * 2.4), pal[2], 2, 1 - t, 0.8));
      break;
    case "radiant":
      actor(0, 520, (t) => {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + t * 0.4, L = s * (1 + t * 2.4) * k;
          ctx.globalAlpha = 1 - t; ctx.strokeStyle = i % 2 ? pal[1] : pal[0]; ctx.lineWidth = i % 2 ? 1 : 2;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
        }
      });
      actor(60, 520, (t) => ring(x, y - s * 1.2, s * 0.9, pal[2], 2, (1 - t) * Math.min(1, t * 4), 0.3));
      for (let i = 0; i < 12; i++) add({ type: "star", c: pal[i % 2 ? 0 : 1], x: x + rr(-1.6, 1.6) * s, y: y + rr(-1.6, 1) * s, vy: -rr(5, 25), r: rr(0.8, 1.6), life: rr(0.5, 0.9), wait: rr(0.05, 0.3), fadeIn: 0.3 });
      break;
    case "psychic":
      actor(0, 560, (t) => { for (let i = 0; i < 3; i++) { const q = (t + i / 3) % 1; ring(x, y, s * (2.6 - q * 2.3), pal[i % 2 ? 1 : 2], 2, Math.sin(q * Math.PI), 0.8); } });
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add({ type: "star", c: pal[1], x: x + Math.cos(a) * s * 1.4, y: y + Math.sin(a) * s * 1.1, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, r: 1, life: 0.6, wait: 0.1 }); }
      break;
    case "arcane":
      actor(0, 620, (t) => { ring(x, y, s * 1.8 * k, pal[1], 1, 1 - t, 0.75, [2, 2], t * 3); ring(x, y, s * 1.2 * k, pal[2], 2, 1 - t, 0.75, [3, 3], -t * 4); });
      for (let i = 0; i < 14; i++) { const a = rr(0, Math.PI * 2), sp = rr(30, 90); add({ type: "glow", c: pal[i % 2 ? 0 : 1], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, drag: 0.04, r: s * rr(0.2, 0.35), life: rr(0.5, 0.8) }); }
      break;
    default: // fisico: stella d'urto e polvere
      for (let i = 0; i < 5; i++) add({ type: "smoke", c: pal[4], x: x + rr(-1, 1) * s * 0.5, y: y + rr(-0.2, 0.5) * s, vx: rr(-40, 40), vy: -rr(5, 20), r: s * 0.5, r1: s * 1.4, life: rr(0.5, 0.7), a: 0.5, fadeIn: 0.15 });
  }
}

/* ── colpo mancato: sbuffo che scivola via ── */
function missAt(pal, x, y, s) {
  for (let i = 0; i < 5; i++) add({ type: "smoke", c: "#8a8590", x: x + s * 0.8 + rr(-0.3, 0.3) * s, y: y + rr(-0.3, 0.3) * s, vx: rr(30, 70), vy: -rr(5, 20), r: s * 0.4, r1: s * 1.1, life: 0.6, a: 0.55, fadeIn: 0.2 });
  for (let i = 0; i < 6; i++) add({ type: "spark", c: pal[1], x: x + s * 0.6, y, vx: rr(60, 160), vy: rr(-60, 60), drag: 0.08, r: 1, life: 0.3 });
}
/* ── KO: esplosione grande e colonna di fumo ── */
function deathAt(pal, x, y, s) {
  actor(0, 420, (t) => { blob(x, y, s * (1.5 + t * 3), pal[2], (1 - t) * 0.8); blob(x, y, s * (1 + t), "#ffffff", 1 - t); });
  for (let i = 0; i < 14; i++) add({ type: "smoke", c: "#5e5a62", x: x + rr(-1, 1) * s * 0.8, y: y + rr(-0.5, 0.5) * s, vx: rr(-40, 40), vy: -rr(30, 70), r: s * 0.8, r1: s * 2.3, life: rr(1, 1.5), a: 0.8, fadeIn: 0.12, wait: rr(0.05, 0.25) });
  for (let i = 0; i < 20; i++) { const a = rr(0, Math.PI * 2), sp = rr(80, 200); add({ type: "glow", c: pal[i % 2 ? 1 : 2], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.06, r: s * rr(0.2, 0.4), life: rr(0.5, 0.9) }); }
}

/* ============================================================
   API
   ============================================================ */
export function playSpell(o) {
  if (!ensure()) return 0;
  const el = fxElement(o.el);
  const pal = PAL[el];
  const delay = o.delay || 0;
  const to = o.to, from = o.from || o.to;
  if (!to) return 0;
  const tx = S(to.x), ty = S(to.y);
  const fx = S(from.x), fy = S(from.y);
  const ts = Math.max(3.2, S(to.size || 120) * 0.12) * (o.scale || 1);  // "taglia" dei pezzi in pixel del canvas
  const ground = to.bottom != null ? S(to.bottom) : null;
  const opts = { crit: !!o.crit, ground };
  const end = (at) => {
    if (o.miss) actor(at, 1, () => missAt(pal, tx, ty, ts));
    else {
      actor(at, 1, () => impactAt(el, pal, tx, ty, ts, opts));
      if (o.kill) actor(at + 250, 1, () => deathAt(pal, tx, ty, ts));
    }
  };
  const fast = reduced() ? 0.6 : 1;
  let hit = 0;
  switch (o.kind) {
    case "acidArrow": {
      const dur = 420 * fast, dx = tx - fx, dy = ty - fy;
      const ang = Math.atan2(dy, dx), len = ts * 4;
      actor(delay, dur, (t) => {
        const x = fx + dx * t, y = fy + dy * t - Math.sin(Math.PI * t) * ts;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 0.95;
        ctx.fillStyle = pal[3];
        ctx.beginPath(); ctx.moveTo(len * 0.6, 0); ctx.lineTo(-len * 0.25, -ts); ctx.lineTo(-len, 0); ctx.lineTo(-len * 0.25, ts); ctx.closePath(); ctx.fill();
        ctx.fillStyle = pal[1];
        ctx.beginPath(); ctx.moveTo(len * 0.55, 0); ctx.lineTo(-len * 0.2, -ts * 0.65); ctx.lineTo(-len * 0.85, 0); ctx.lineTo(-len * 0.2, ts * 0.65); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = pal[0]; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-len * 0.5, 0); ctx.lineTo(len * 0.4, 0); ctx.stroke();
        ctx.restore();
        if (R() < 0.7) add({ type: "sq", c: pal[2], x, y, vx: -Math.cos(ang) * rr(12, 35), vy: rr(-12, 12), ay: 100, r: rr(0.8, 1.6), r1: 0.3, life: 0.4 });
        if (R() < 0.3) add({ type: "bubble", c: pal[1], x, y, vy: -10, r: 1.3, life: 0.3 });
      });
      hit = delay + dur;
      break;
    }
    case "thunderwave": {
      // Fronte di pressione ampio: tre anelli d'aria, senza saette.
      const dur = 380 * fast, ang = Math.atan2(ty - fy, tx - fx);
      for (let i = 0; i < 3; i++) actor(delay + i * 65, dur, (t) => {
        const x = fx + (tx - fx) * t, y = fy + (ty - fy) * t;
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = (1 - t * 0.65) * (1 - i * 0.15);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = pal[1]; ctx.lineWidth = 3 * (1 - t * 0.5);
        ctx.beginPath(); ctx.ellipse(0, 0, ts * (0.6 + t), ts * (2 + t * 6), 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.strokeStyle = pal[0]; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ts * 0.3, 0, ts * (0.6 + t), ts * (1.8 + t * 6), 0, -1.5, 1.5); ctx.stroke();
        ctx.restore();
      });
      hit = delay + dur;
      break;
    }
    case "arrow": {
      /* FRECCIA VERA (2026-11-07): asta di legno, punta di ferro e piume, niente bagliori né lampo di
         lancio (prima era il proiettile delle magie, più piccolo). Si rimpicciolisce andando lontano
         (da chi tira a chi la riceve: in prima persona parte grande dall'arco). Frecce elementali:
         la stessa freccia con una scia leggera del loro colore. Impatto: schegge e polvere. */
      const dur = 280 * fast;
      const dx = tx - fx, dy = ty - fy, dist = Math.hypot(dx, dy) || 1;
      const arc = Math.min(18, dist * 0.06);
      const L0 = clampN(S(from.size || 120) * 0.55, 10, 56), L1 = clampN(S(to.size || 120) * 0.4, 9, 30);
      let px = fx, py = fy;
      actor(delay, dur, (t) => {
        const x = fx + dx * t, y = fy + dy * t - Math.sin(Math.PI * t) * arc;
        const ang = Math.atan2(y - py || dy, x - px || dx), len = L0 + (L1 - L0) * t;
        if (el !== "physical") for (let i = 1; i <= 3; i++) blob(x - Math.cos(ang) * len * 0.3 * i, y - Math.sin(ang) * len * 0.3 * i, len * 0.12, pal[1], 0.35 / i);
        drawArrow(x, y, ang, len, el === "physical" ? null : pal[1]);
        // scia: due righe sottili dietro le piume
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 0.35; ctx.strokeStyle = "#f3ead8"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len); ctx.lineTo(x - Math.cos(ang) * len * 1.8, y - Math.sin(ang) * len * 1.8); ctx.stroke();
        ctx.globalAlpha = 1;
        px = x; py = y;
      });
      hit = delay + dur;
      if (o.quiet) { /* niente impatto */ } else if (o.miss) actor(hit, 1, () => missAt(pal, tx, ty, ts));
      else {
        actor(hit, 1, () => arrowHitAt(el, pal, tx, ty, ts, Math.atan2(dy, dx), opts));
        if (o.kill) actor(hit + 250, 1, () => deathAt(pal, tx, ty, ts));
      }
      kick();
      return hit;
    }
    case "bolt": {
      // proiettile con la coda: palla di fuoco, scheggia, globo...
      const dur = 460 * fast;
      const dx = tx - fx, dy = ty - fy;
      const arc = Math.min(30, Math.hypot(dx, dy) * 0.12);
      const head = ts * 1.15;
      let px = fx, py = fy;
      // bagliore di lancio
      actor(delay, 220, (t) => { blob(fx, fy, ts * (2 + t * 2), pal[1], (1 - t) * 0.7); ring(fx, fy, ts * (1 + t * 3), pal[1], 1, 1 - t, 0.6); });
      actor(delay, dur, (t, dt) => {
        const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
        const x = fx + dx * e, y = fy + dy * e - Math.sin(Math.PI * e) * arc;
        const vx = (x - px) / Math.max(dt, 0.001), vy = (y - py) / Math.max(dt, 0.001);
        const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 2));
        for (let i = 1; i <= steps; i++) trail(el, pal, px + ((x - px) * i) / steps, py + ((y - py) * i) / steps, vx, vy, head * 0.85);
        // la testa: alone, corpo, nucleo bianco (allungato nel verso del moto)
        blob(x, y, head * 2.6, pal[2], 0.55);
        blob(x, y, head * 1.6, pal[1], 0.95);
        blob(x - vx * 0.004, y - vy * 0.004, head * 1.2, pal[1], 0.7);
        blob(x, y, head * 0.85, pal[0], 1);
        if (el === "lightning" && R() < 0.7) bolt(x, y, x + rr(-1, 1) * head * 4, y + rr(-1, 1) * head * 4, pal, 1, head * 2);
        if (el === "frost") { ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.fillStyle = pal[0]; ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2); }
        px = x; py = y;
      });
      hit = delay + dur;
      break;
    }
    case "beam": {
      const dur = 620 * fast;
      actor(delay, dur, (t) => {
        const w = ts * (t < 0.2 ? t / 0.2 : t > 0.75 ? (1 - t) / 0.25 : 1) * 1.6;
        const L = Math.min(1, t / 0.18);
        const ex = fx + (tx - fx) * L, ey = fy + (ty - fy) * L;
        ctx.globalCompositeOperation = "lighter";
        [[pal[3], w * 2.6, 0.45], [pal[2], w * 1.7, 0.8], [pal[1], w, 1], [pal[0], Math.max(1, w * 0.4), 1]].forEach(([c, lw, a]) => {
          ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, lw + Math.sin(t * 60) * 0.6); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(ex, ey); ctx.stroke();
        });
        blob(fx, fy, w * 2.2, pal[1], 0.9);
        if (L >= 1 && R() < 0.8) trail(el, pal, tx, ty, fx - tx, fy - ty, ts);
        if (el === "lightning" && R() < 0.5) bolt(fx, fy, ex, ey, pal, 1);
      });
      hit = delay + 140 * fast;
      break;
    }
    case "strike": { // fulmine (o colonna) che cade dal cielo sul bersaglio
      actor(delay, 120, (t) => { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - t) * 0.35; ctx.fillStyle = pal[1]; ctx.fillRect(0, 0, W, H); });
      actor(delay, 360 * fast, (t) => { if (t < 0.15 || (t > 0.3 && t < 0.5) || (t > 0.65 && t < 0.75)) bolt(tx + rr(-2, 2), 0, tx, ty, pal, 3, ts * 6); });
      hit = delay + 60;
      break;
    }
    case "breath": { // getto conico: tante particelle dal lanciatore al bersaglio
      const dur = 560 * fast;
      const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1;
      actor(delay, dur, () => {
        for (let i = 0; i < 6; i++) {
          const sp = d * rr(1.6, 2.2), sx = (dx / d) * sp, sy = (dy / d) * sp, sprd = rr(-0.22, 0.22);
          const vx = sx - sy * sprd, vy = sy + sx * sprd;
          if (el === "fire") add({ type: "flame", c: pal, x: fx, y: fy, vx, vy, r: ts * 0.5, r1: ts * 1.6, life: 0.5 });
          else if (el === "frost" && R() < 0.4) add({ type: "shard", c: pal[1], c2: pal[3], x: fx, y: fy, vx, vy, r: rr(0.8, 1.4), life: 0.5, rot: Math.atan2(vy, vx) + Math.PI / 2 });
          else if (el === "darkness" || el === "poison" || el === "acid") add({ type: "smoke", c: pal[el === "darkness" ? 3 : 2], x: fx, y: fy, vx, vy, r: ts * 0.4, r1: ts * 1.6, life: 0.5, a: 0.75 });
          else add({ type: "glow", c: pal[i % 3], x: fx, y: fy, vx, vy, r: ts * 0.4, r1: ts * 1.3, life: 0.5, a: 0.8 });
        }
      });
      hit = delay + 300 * fast;
      break;
    }
    case "drain": { // risucchio: particelle dal bersaglio verso chi lancia, poi cura
      actor(delay, 560 * fast, () => {
        for (let i = 0; i < 3; i++) {
          const ox = rr(-1, 1) * ts * 1.5, oy = rr(-1, 1) * ts * 1.5;
          add({ type: "glow", c: pal[i % 2 ? 1 : 2], x: tx + ox, y: ty + oy, vx: (fx - tx - ox) * 2, vy: (fy - ty - oy) * 2, r: ts * 0.4, r1: ts * 0.15, life: 0.5 });
        }
      });
      actor(delay + 450, 1, () => healAt(PAL.radiant, fx, fy, S(from.size || 120) * 0.075, "#7dff9a"));
      hit = delay + 40;
      break;
    }
    case "cloud": { // nube che avvolge il bersaglio
      actor(delay, 1, () => {
        for (let i = 0; i < 14; i++) add({ type: "smoke", c: i % 3 ? pal[2] : pal[3], x: tx + rr(-1.4, 1.4) * ts * 1.4, y: ty + rr(-1, 1) * ts * 1.2, vx: rr(-20, 20), vy: rr(-15, 5), r: ts * 0.6, r1: ts * 2, life: rr(0.9, 1.3), a: 0.7, fadeIn: 0.25, wait: rr(0, 0.2) });
        for (let i = 0; i < 10; i++) add({ type: "bubble", c: pal[1], x: tx + rr(-1, 1) * ts * 1.5, y: ty + rr(-0.5, 1) * ts, vy: -rr(15, 35), r: rr(1, 2), life: 0.9, wait: rr(0.1, 0.5) });
      });
      hit = -1;
      break;
    }
    case "curse":
    case "debuff": { // vortice scuro che si stringe sul bersaglio
      actor(delay, 760 * fast, (t) => {
        for (let i = 0; i < 3; i++) {
          const a = t * 14 + (i * Math.PI * 2) / 3, d = ts * 2.6 * (1 - t);
          blob(tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.6, ts * 0.6, pal[1], 0.9);
          add({ type: "glow", c: pal[2], x: tx + Math.cos(a) * d, y: ty + Math.sin(a) * d * 0.6, r: ts * 0.4, r1: 0, life: 0.3 });
        }
        ring(tx, ty, ts * 2.8 * (1 - t * 0.7), pal[2], 1, 1 - t, 0.6, [2, 3], t * 6);
      });
      actor(delay + 400, 1, () => { for (let i = 0; i < 8; i++) add({ type: "smoke", c: pal[3], x: tx + rr(-1, 1) * ts, y: ty + rr(-0.5, 0.5) * ts, vx: rr(-20, 20), vy: rr(10, 30), r: ts * 0.5, r1: ts * 1.6, life: 0.9, a: 0.7, fadeIn: 0.2 }); });
      hit = -1;
      break;
    }
    case "wave": { // onde che viaggiano verso il bersaglio
      const dur = 520 * fast;
      const ang = Math.atan2(ty - fy, tx - fx);
      for (let k = 0; k < 3; k++) {
        actor(delay + k * 110, dur, (t) => {
          const x = fx + (tx - fx) * t, y = fy + (ty - fy) * t;
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 1 - t * 0.5;
          ctx.strokeStyle = pal[1]; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, ts * (1 + t * 2), ts * (1.6 + t * 3), ang, -1.1, 1.1); ctx.stroke();
          ctx.strokeStyle = pal[0]; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(x, y, ts * (0.8 + t * 2), ts * (1.4 + t * 3), ang, -0.9, 0.9); ctx.stroke();
        });
      }
      hit = delay + dur;
      break;
    }
    case "aoe": { // cerchio magico a terra, colonna dell'elemento, esplosione
      const gy = ground ?? ty + ts * 8;
      actor(delay, 180, (t) => { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - t) * 0.25; ctx.fillStyle = pal[1]; ctx.fillRect(0, 0, W, H); });
      actor(delay, 900 * fast, (t) => {
        const r = ts * 6 * Math.min(1, t * 3);
        ring(tx, gy, r, pal[1], 2, 1 - t * 0.6, 0.3);
        ring(tx, gy, r * 0.75, pal[2], 1, 1 - t * 0.6, 0.3, [3, 2], t * 2);
        ring(tx, gy, r * 0.45, pal[0], 1, 1 - t, 0.3);
        if (t > 0.25 && t < 0.85) {
          for (let i = 0; i < 4; i++) {
            const ox = rr(-1, 1) * r * 0.8;
            if (el === "fire") add({ type: "flame", c: pal, x: tx + ox, y: gy, vy: -rr(80, 160), r: ts * 0.9, r1: ts * 0.2, life: rr(0.4, 0.7) });
            else if (el === "frost") add({ type: "shard", c: pal[1], c2: pal[3], x: tx + ox, y: gy, vy: -rr(60, 140), r: rr(1, 1.8), life: 0.6, rot: 0 });
            else if (el === "earth") add({ type: "rock", c: pal[1], c2: pal[3], x: tx + ox, y: gy, vx: rr(-20, 20), vy: -rr(100, 200), ay: 400, r: rr(1, 2), life: 0.7 });
            else if (el === "lightning" && R() < 0.3) bolt(tx + ox, gy - ts * 12, tx + ox, gy, pal, 1);
            else add({ type: "glow", c: pal[i % 3], x: tx + ox, y: gy, vy: -rr(60, 140), r: ts * 0.5, r1: 0, life: 0.6 });
          }
        }
      });
      hit = delay + 380 * fast;
      break;
    }
    case "slash": { // mezzaluna luminosa che taglia il bersaglio
      const dur = 260 * fast;
      actor(delay, dur, (t) => {
        const a0 = -2.4, a1 = -2.4 + 2.4 * Math.min(1, t * 1.6);
        ctx.globalCompositeOperation = "lighter";
        [[pal[2], 5, 0.6], [pal[1], 3, 1], [pal[0], 1, 1]].forEach(([c, w, a]) => {
          ctx.globalAlpha = a * (1 - Math.max(0, t - 0.6) / 0.4); ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.arc(tx, ty, ts * 3.4, a0, a1); ctx.stroke();
        });
      });
      hit = delay + 120;
      break;
    }
    /* ── FORME FISICHE DEI PET (2026-11-05): prima erano pezzi DOM, ora tutte nel motore ── */
    case "claw": { // tre graffi paralleli in fila, con scintille lungo il taglio
      const L = ts * 4;
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * ts * 1.5, oy = (k - 1) * ts * -0.3;
        const x1 = tx - L * 0.55 + ox, y1 = ty - L * 0.6 + oy, x2 = tx + L * 0.55 + ox, y2 = ty + L * 0.6 + oy;
        actor(delay + k * 70, 240 * fast, (t) => {
          const g = Math.min(1, t * 2.4), a = 1 - Math.max(0, t - 0.55) / 0.45;
          const ex = x1 + (x2 - x1) * g, ey = y1 + (y2 - y1) * g;
          slashLine(x1, y1, ex, ey, pal, 1.6, a);
          if (t < 0.45 && R() < 0.6) add({ type: "spark", c: pal[0], x: ex, y: ey, vx: rr(-50, 50) + (x2 - x1) * 1.5, vy: rr(-50, 50) + (y2 - y1) * 1.5, r: 1, life: 0.25 });
        });
      }
      hit = delay + 240;
      break;
    }
    case "bite": { // due mascelle con i denti che si chiudono, poi lo schiocco
      const dur = 340 * fast;
      const w = ts * 2.6;
      actor(delay, dur, (t) => {
        const close = t < 0.7 ? Math.pow(t / 0.7, 2) : 1;
        const gap = ts * 2.4 * (1 - close);
        const a = t < 0.85 ? 1 : (1 - t) / 0.15;
        jaw(tx, ty - gap, w, pal, a, 1);
        jaw(tx, ty + gap, w, pal, a, -1);
      });
      actor(delay + dur * 0.7, 160, (t) => { blob(tx, ty, ts * (2 + t * 3), pal[1], (1 - t) * 0.9); ring(tx, ty, ts * (1 + t * 4), pal[0], 1, 1 - t, 0.7); });
      hit = delay + dur * 0.72;
      break;
    }
    case "stomp": { // pestone: onda d'urto a terra, sassi e polvere che volano
      const gy = ground ?? ty + ts * 6;
      const at = delay + 280 * fast;
      actor(at, 520 * fast, (t) => {
        const r = ts * (1.5 + t * 9);
        ring(tx, gy, r, pal[1], 2, 1 - t, 0.22);
        ring(tx, gy, r * 0.7, pal[0], 1, (1 - t) * 0.8, 0.22);
      });
      actor(at, 1, () => {
        for (let i = 0; i < 16; i++) add({ type: "rock", c: i % 2 ? pal[1] : PAL.earth[1], c2: PAL.earth[3], x: tx + rr(-1, 1) * ts * 3, y: gy, vx: rr(-90, 90), vy: -rr(80, 190), ay: 520, r: rr(0.8, 1.8), life: rr(0.5, 0.8) });
        for (let i = 0; i < 10; i++) add({ type: "smoke", c: PAL.earth[4], x: tx + rr(-1, 1) * ts * 4, y: gy - ts * 0.5, vx: rr(-50, 50), vy: -rr(5, 25), r: ts * 0.6, r1: ts * 1.8, life: rr(0.6, 0.9), a: 0.6 });
      });
      hit = at;
      break;
    }
    case "whip": { // una frusta che si srotola ad arco e schiocca sul bersaglio
      const dur = 330 * fast;
      const mx = (fx + tx) / 2, my = Math.min(fy, ty) - Math.abs(tx - fx) * 0.35;
      const P = (u) => [(1 - u) * (1 - u) * fx + 2 * (1 - u) * u * mx + u * u * tx, (1 - u) * (1 - u) * fy + 2 * (1 - u) * u * my + u * u * ty];
      actor(delay, dur + 160, (t) => {
        const g = Math.min(1, t * (dur + 160) / dur);
        const a = t < 0.75 ? 1 : (1 - t) / 0.25;
        const pts = [];
        for (let i = 0; i <= 24; i++) pts.push(P((i / 24) * g));
        strokePath(pts, pal[3], 6, 0.6 * a);
        strokePath(pts, pal[1], 3, a);
        strokePath(pts, pal[0], 1, a);
      });
      actor(delay + dur, 200, (t) => { star4(tx, ty, ts * (1.5 + t * 3), pal[0], 1 - t); blob(tx, ty, ts * 3, pal[1], (1 - t) * 0.8); });
      hit = delay + dur;
      break;
    }
    case "vine": { // FRUSTA DI ROVI (2026-11-07): un ramo magico spinoso che cresce sinuoso, frusta e schiocca
      const grow = 420 * fast, hold = 130 * fast, back = 260 * fast;
      const mx = (fx + tx) / 2, my = Math.min(fy, ty) - Math.abs(tx - fx) * 0.3 - ts * 2;
      const len = Math.hypot(tx - fx, ty - fy) || 1, nx = -(ty - fy) / len, ny = (tx - fx) / len;
      // curva della frusta + un'onda che scorre lungo il ramo (si muove come una frusta viva)
      const P = (u, ph) => {
        const bx = (1 - u) * (1 - u) * fx + 2 * (1 - u) * u * mx + u * u * tx, by = (1 - u) * (1 - u) * fy + 2 * (1 - u) * u * my + u * u * ty;
        const w = Math.sin(u * Math.PI * 2.4 - ph) * ts * 1.6 * Math.sin(u * Math.PI);
        return [bx + nx * w, by + ny * w];
      };
      const N = 40;
      const leafSide = Array.from({ length: N }, (_, i) => (i % 2 ? 1 : -1));
      const drawVine = (g, ph, a) => {
        const n = Math.max(2, Math.round(N * g)), pts = [];
        for (let i = 0; i <= n; i++) pts.push(P((i / N) * Math.min(1, g * N / Math.max(1, n)), ph));
        strokePath(pts, VINE.aura, ts * 1.6, 0.22 * a); // alone verde magico
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (let i = 0; i < pts.length - 1; i++) { // corteccia che si assottiglia verso la punta
          const k = i / N, w = Math.max(1, ts * (1.15 - k * 0.75));
          ctx.globalAlpha = a;
          ctx.strokeStyle = VINE.dark; ctx.lineWidth = w + 1.4;
          ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
          ctx.strokeStyle = VINE.bark; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
          ctx.strokeStyle = VINE.vein; ctx.lineWidth = Math.max(0.6, w * 0.3);
          ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1] - w * 0.25); ctx.lineTo(pts[i + 1][0], pts[i + 1][1] - w * 0.25); ctx.stroke();
        }
        for (let i = 2; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dl = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / dl, uy = (y1 - y0) / dl, s = leafSide[i];
          const w = Math.max(1, ts * (1.15 - (i / N) * 0.75));
          if (i % 3 === 0) { // spina
            const bx = x0 - uy * s * w * 0.5, by = y0 + ux * s * w * 0.5, tipx = bx - uy * s * w * 1.1 + ux * w * 0.5, tipy = by + ux * s * w * 1.1 + uy * w * 0.5;
            ctx.fillStyle = VINE.dark; ctx.beginPath(); ctx.moveTo(bx - ux * w * 0.5, by - uy * w * 0.5); ctx.lineTo(tipx, tipy); ctx.lineTo(bx + ux * w * 0.5, by + uy * w * 0.5); ctx.fill();
            ctx.fillStyle = VINE.thorn; ctx.beginPath(); ctx.moveTo(bx - ux * w * 0.3, by - uy * w * 0.3); ctx.lineTo(tipx - ux * 0.3, tipy - uy * 0.3); ctx.lineTo(bx + ux * w * 0.3, by + uy * w * 0.3); ctx.fill();
          }
          if (i % 5 === 1) { // fogliolina
            const lx = x0 + uy * s * w * 1.4, ly = y0 - ux * s * w * 1.4;
            ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.atan2(uy, ux) + s * 0.7);
            ctx.fillStyle = VINE.dark; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.25 + 0.6, w * 0.6 + 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = VINE.leaf; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.25, w * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = VINE.leafHi; ctx.fillRect(-w * 0.6, -w * 0.25, w * 0.7, Math.max(0.6, w * 0.2));
            ctx.restore();
          }
        }
        const tip = pts[pts.length - 1];
        blob(tip[0], tip[1], ts * 1.3, VINE.aura, 0.6 * a);
        return tip;
      };
      // cresce dalla mano, sinuoso; scintille verdi dalla punta
      actor(delay, grow, (t) => {
        const g = 1 - (1 - t) ** 2;
        const tip = drawVine(g, t * 5, 1);
        if (R() < 0.6) add({ type: "glow", c: VINE.aura, x: tip[0] + rr(-1, 1) * ts * 0.6, y: tip[1] + rr(-1, 1) * ts * 0.6, vx: rr(-20, 20), vy: rr(-30, 5), r: rr(0.8, 1.6), r1: 0, life: rr(0.3, 0.6) });
      });
      // schiocco sul bersaglio, poi il ramo si ritira
      actor(delay + grow, hold, (t) => { drawVine(1, 5 + t * 2, 1); });
      actor(delay + grow + hold, back, (t) => { drawVine(1 - t, 7 + t * 3, 1 - t * 0.6); });
      actor(delay + grow, 1, () => {
        for (let i = 0; i < 14; i++) add({ c: i % 3 ? VINE.leaf : VINE.leafHi, x: tx + rr(-1, 1) * ts, y: ty + rr(-1, 1) * ts, vx: rr(-110, 110), vy: -rr(30, 140), ay: 300, drag: 0.02, r: rr(0.7, 1.3), life: rr(0.5, 0.9) });
        for (let i = 0; i < 6; i++) add({ type: "shard", c: VINE.thorn, c2: VINE.dark, x: tx, y: ty, vx: rr(-140, 140), vy: rr(-120, 40), ay: 260, r: rr(0.6, 1), rot: rr(0, 6), vr: rr(-12, 12), life: rr(0.35, 0.6) });
      });
      actor(delay + grow, 220, (t) => { star4(tx, ty, ts * (1.5 + t * 3.5), VINE.leafHi, 1 - t); ring(tx, ty, ts * (1 + t * 3), VINE.aura, 1, 1 - t, 0.6); });
      hit = delay + grow;
      break;
    }
    case "sting": { // ago velocissimo, puntura e gocce dell'elemento
      const dur = 200 * fast;
      actor(delay, dur, (t) => {
        const x = fx + (tx - fx) * t, y = fy + (ty - fy) * t;
        const bx = x - (tx - fx) * 0.12, by = y - (ty - fy) * 0.12;
        strokePath([[bx, by], [x, y]], pal[2], 3, 0.6);
        strokePath([[bx, by], [x, y]], pal[0], 1, 1);
      });
      actor(delay + dur, 1, () => {
        for (let i = 0; i < 9; i++) add({ type: "bubble", c: pal[1], x: tx + rr(-1, 1) * ts, y: ty, vx: rr(-30, 30), vy: rr(-40, 10), ay: 260, r: rr(0.8, 1.5), life: rr(0.5, 0.8) });
      });
      hit = delay + dur;
      break;
    }
    case "dash": { // carica: scie di velocità dietro a chi si lancia, poi la botta
      const dur = 300 * fast;
      const dx = tx - fx, dy = ty - fy;
      actor(delay, dur, (t) => {
        for (let i = 0; i < 3; i++) {
          const u = Math.max(0, t - 0.08 - R() * 0.25);
          const x = fx + dx * u, y = fy + dy * u + rr(-1, 1) * ts * 1.6;
          strokePath([[x - dx * 0.12, y - dy * 0.12], [x, y]], i ? pal[1] : pal[0], 1, 0.9);
        }
      });
      actor(delay + dur, 220, (t) => { ring(tx, ty, ts * (1.5 + t * 6), pal[1], 2, 1 - t, 0.7); blob(tx, ty, ts * 4, pal[0], (1 - t) * 0.8); });
      hit = delay + dur;
      break;
    }
    case "spikes": { // spuntoni che salgono dal terreno sotto il bersaglio (forma dell'elemento)
      const gy = ground ?? ty + ts * 6;
      const ks = [-0.9, -0.45, 0, 0.45, 0.9];
      ks.forEach((k, i) => {
        const h = ts * (i === 2 ? 6 : 3.5 + R() * 1.6), x = tx + k * ts * 2.6;
        actor(delay + 100 + Math.abs(i - 2) * 70, 520 * fast, (t) => {
          const up = t < 0.25 ? t / 0.25 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          spike(x, gy, ts * 0.9, h * up, el, pal);
        });
      });
      actor(delay + 100, 1, () => { for (let i = 0; i < 8; i++) add({ type: "rock", c: pal[1], c2: pal[3], x: tx + rr(-1, 1) * ts * 3, y: gy, vx: rr(-60, 60), vy: -rr(60, 140), ay: 500, r: rr(0.7, 1.4), life: 0.6 }); });
      hit = delay + 170;
      break;
    }
    case "rain": { // pioggia dell'elemento sul bersaglio (gocce, schegge, sassi, braci)
      const dur = 520 * fast;
      actor(delay, dur, () => {
        for (let i = 0; i < 2; i++) {
          const x = tx + rr(-1, 1) * ts * 3.5, y = ty - ts * 12;
          if (el === "frost") add({ type: "shard", c: pal[1], c2: pal[3], x, y, vx: rr(-10, 10), vy: rr(260, 340), r: rr(1, 1.6), life: 0.4, rot: 0 });
          else if (el === "earth") add({ type: "rock", c: pal[1], c2: pal[3], x, y, vy: rr(220, 300), ay: 300, r: rr(1, 1.8), life: 0.45 });
          else if (el === "fire") add({ type: "flame", c: pal, x, y, vy: rr(240, 320), r: ts * 0.6, r1: ts * 0.2, life: 0.4 });
          else add({ type: "spark", c: i ? pal[0] : pal[1], x, y, vx: rr(-10, 10), vy: rr(280, 360), r: 1, life: 0.4 });
        }
      });
      hit = delay + 460 * fast;
      break;
    }
    case "roar": { // ruggito: anelli d'aria da chi urla verso il bersaglio
      const ang = Math.atan2(ty - fy, tx - fx);
      for (let k = 0; k < 4; k++) {
        actor(delay + k * 90, 480 * fast, (t) => {
          const x = fx + (tx - fx) * t * 0.85, y = fy + (ty - fy) * t * 0.85;
          ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = pal[2]; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.ellipse(x, y, ts * (0.6 + t * 1.5), ts * (1.8 + t * 3.5), ang, -1.2, 1.2); ctx.stroke();
          ctx.strokeStyle = k % 2 ? pal[1] : pal[0]; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, y, ts * (0.6 + t * 1.5), ts * (1.8 + t * 3.5), ang, -1.2, 1.2); ctx.stroke();
        });
      }
      hit = -1;
      break;
    }
    case "sleep": { // Z pixel che salgono e un velo viola
      actor(delay, 900, (t) => blob(tx, ty, ts * 4, "#9b7bff", Math.sin(t * Math.PI) * 0.35));
      const zp = Math.max(1, Math.round(ts * 0.2));
      for (let k = 0; k < 3; k++) actor(delay + k * 260, 1000, (t) => pixelZ(tx + zp * 7 * k - zp * 4, ty - ts * 1.5 - zp * 7 * k - t * ts * 3, zp + (k === 2 ? 1 : 0), "#e8dcff", 1 - t * t));
      hit = -1;
      break;
    }
    case "burst": { // esplosione sul bersaglio: lampo, raggi, anello
      actor(delay, 140, (t) => { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - t) * 0.3; ctx.fillStyle = pal[1]; ctx.fillRect(0, 0, W, H); });
      actor(delay, 420 * fast, (t) => {
        blob(tx, ty, ts * (2 + t * 5), pal[2], (1 - t) * 0.8);
        blob(tx, ty, ts * (1 + t * 3), pal[0], 1 - t);
        ring(tx, ty, ts * (2 + t * 8), pal[1], 2, 1 - t, 0.8);
        for (let i = 0; i < 10; i++) { const q = (i / 10) * Math.PI * 2; strokePath([[tx + Math.cos(q) * ts * (1 + t * 3), ty + Math.sin(q) * ts * (1 + t * 3)], [tx + Math.cos(q) * ts * (2 + t * 7), ty + Math.sin(q) * ts * (2 + t * 7)]], pal[1], 1, 1 - t); }
      });
      hit = delay + 40;
      break;
    }
    /* ── FORME DELLE SEGRETE (2026-11-06) ── */
    case "smash": { // arma contundente: la testa cala dall'alto, botta pesante, terra che sobbalza
      const dur = 240 * fast;
      const side = fx <= tx ? -1 : 1;
      const gy = ground ?? ty + ts * 6;
      actor(delay, dur, (t) => {
        const e = t * t;
        const x = tx + side * ts * 6 * (1 - e), y = ty - ts * 8 * (1 - e);
        strokePath([[x + side * ts * 2.4, y - ts * 2.4], [x, y]], pal[2], 3, 0.7);
        blob(x, y, ts * 1.6, pal[2], 0.7);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.fillStyle = pal[1];
        ctx.fillRect(Math.round(x - ts), Math.round(y - ts), Math.round(ts * 2), Math.round(ts * 2));
      });
      hit = delay + dur;
      actor(hit, 340 * fast, (t) => {
        star4(tx, ty, ts * (3 + t * 3), pal[0], 1 - t);
        ring(tx, gy, ts * (1.5 + t * 8), pal[1], 3, 1 - t, 0.25);
        ring(tx, ty, ts * (1 + t * 5), pal[0], 2, 1 - t, 0.9);
      });
      actor(hit, 1, () => {
        for (let i = 0; i < 10; i++) add({ type: "rock", c: PAL.earth[1], c2: PAL.earth[3], x: tx + rr(-1, 1) * ts * 2, y: gy, vx: rr(-70, 70), vy: -rr(60, 150), ay: 480, r: rr(0.8, 1.5), life: rr(0.4, 0.7) });
        for (let i = 0; i < 6; i++) add({ type: "smoke", c: PAL.earth[4], x: tx + rr(-1, 1) * ts * 3, y: gy - ts * 0.5, vx: rr(-40, 40), vy: -rr(5, 20), r: ts * 0.5, r1: ts * 1.5, life: rr(0.5, 0.8), a: 0.55 });
      });
      break;
    }
    case "thrust": { // arma perforante: una punta dritta che entra ed esce dall'altra parte
      const dur = 150 * fast;
      const d = Math.hypot(tx - fx, ty - fy);
      const ux = d > 1 ? (tx - fx) / d : 1, uy = d > 1 ? (ty - fy) / d : 0;
      const len = ts * 10;
      actor(delay, dur, (t) => {
        const hx = tx - ux * len * (1 - t), hy = ty - uy * len * (1 - t);
        strokePath([[hx - ux * ts * 6, hy - uy * ts * 6], [hx, hy]], pal[2], 3, 0.6);
        strokePath([[hx - ux * ts * 5, hy - uy * ts * 5], [hx, hy]], pal[0], 1, 1);
        blob(hx, hy, ts * 0.7, pal[0], 1);
      });
      hit = delay + dur;
      actor(hit, 190 * fast, (t) => {
        const a = ts * 1.5, b = a + ts * 7 * t;
        strokePath([[tx + ux * a, ty + uy * a], [tx + ux * b, ty + uy * b]], pal[0], 2, 1 - t);
        ring(tx, ty, ts * (0.6 + t * 2), pal[1], 1, 1 - t, 0.9);
      });
      actor(hit, 1, () => {
        for (let i = 0; i < 8; i++) { const sp = rr(90, 220), q = rr(-0.35, 0.35); add({ type: "glow", c: pal[i % 2], x: tx, y: ty, vx: (ux * Math.cos(q) - uy * Math.sin(q)) * sp, vy: (uy * Math.cos(q) + ux * Math.sin(q)) * sp, r: ts * 0.3, r1: 0, life: 0.28 }); }
      });
      break;
    }
    case "punch": { // pugni: tre colpi rapidi in punti diversi
      const gap = 115 * fast;
      const spots = [[-1.3, -0.7], [1.2, -0.1], [-0.2, 0.8]];
      spots.forEach(([ox, oy], k) => {
        const x = tx + ox * ts * 1.7, y = ty + oy * ts * 1.7, at = delay + k * gap;
        actor(at, 170 * fast, (t) => {
          star4(x, y, ts * (1.4 + t * 2.2), pal[1], 1 - t);
          ring(x, y, ts * (0.7 + t * 3), pal[0], 2, 1 - t, 0.9);
        });
      });
      hit = delay + 2 * gap;
      break;
    }
    case "lob": { // oggetto lanciato ad arco alto; big = palla enorme (Palla di Fuoco)
      const dur = (o.big ? 620 : 500) * fast;
      const dx = tx - fx, dy = ty - fy;
      const arc = Math.max(ts * 10, Math.hypot(dx, dy) * 0.38);
      const head = o.big ? ts * 2.2 : ts * 0.8;
      actor(delay, dur, (t) => {
        const x = fx + dx * t, y = fy + dy * t - Math.sin(Math.PI * t) * arc;
        const grow = o.big ? 0.6 + t * 0.6 : 1;
        trail(el, pal, x, y, -dx, -dy + 30, head * 0.9);
        blob(x, y, head * 2 * grow, pal[2], 0.55);
        blob(x, y, head * 1.3 * grow, pal[1], 0.95);
        blob(x, y, head * 0.7 * grow, pal[0], 1);
      });
      hit = delay + dur;
      break;
    }
    case "missiles": { // Dardo Incantato: tre dardetti che curvano e arrivano in fila
      const dur = 340 * fast;
      const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy) || 1;
      [-1, 1, 0].forEach((side, k) => {
        actor(delay + k * 80, dur, (t) => {
          const e = t * t * (3 - 2 * t), bend = Math.sin(Math.PI * e) * ts * 7 * side;
          const x = fx + dx * e - (dy / d) * bend, y = fy + dy * e + (dx / d) * bend;
          add({ type: "glow", c: pal[1], x, y, r: ts * 0.4, r1: 0, life: 0.2 });
          blob(x, y, ts * 0.9, pal[2], 0.7);
          blob(x, y, ts * 0.45, pal[0], 1);
        });
      });
      hit = delay + 160 + dur;
      break;
    }
    case "heal":
      actor(delay, 1, () => healAt(pal, tx, ty, ts, el === "radiant" || el === "physical" ? "#8dffa8" : pal[1]));
      hit = -1;
      break;
    case "buff":
      actor(delay, 760 * fast, (t) => {
        for (let k = 0; k < 3; k++) { const q = (t + k / 3) % 1; ring(tx, (ground ?? ty + ts * 7) - q * ts * 12, ts * 4, pal[1], 2, Math.sin(q * Math.PI) * (1 - t * 0.4), 0.3); }
        if (R() < 0.6) add({ type: "glow", c: pal[0], x: tx + rr(-1, 1) * ts * 3, y: ty + ts * 3, vy: -rr(40, 90), r: ts * 0.35, life: 0.6 });
      });
      hit = -1;
      break;
    case "shield":
      actor(delay, 820 * fast, (t) => {
        const r = ts * 5 * (t < 0.2 ? t / 0.2 : 1);
        const a = t < 0.7 ? 1 : (1 - t) / 0.3;
        blob(tx, ty, r * 1.2, pal[2], 0.25 * a);
        ring(tx, ty, r, pal[1], 2, a, 1);
        ring(tx, ty, r * 0.92, pal[0], 1, a * 0.8, 1, [2, 4], t * 3);
        // esagoni di luce sul bordo
        for (let i = 0; i < 6; i++) { const q = (i / 6) * Math.PI * 2 + t * 2; blob(tx + Math.cos(q) * r, ty + Math.sin(q) * r, ts * 0.6, pal[0], a); }
      });
      hit = -1;
      break;
    case "hit":
    case "impact":
    default:
      hit = delay;
  }
  if (hit >= 0 && !o.quiet) end(hit);
  kick();
  return hit;
}

function healAt(pal, x, y, s, plus = "#8dffa8") {
  actor(0, 900, (t) => {
    blob(x, y, s * 4.5, pal[1], Math.sin(t * Math.PI) * 0.35);
    for (let i = 0; i < 2; i++) {
      const a = t * 12 + i * Math.PI, d = s * 3.2 * (1 - t * 0.3);
      blob(x + Math.cos(a) * d, y + s * 3 - t * s * 8 + Math.sin(a) * d * 0.3, s * 0.7, i ? pal[0] : plus, 1 - t);
    }
  });
  for (let i = 0; i < 14; i++) {
    const ox = rr(-1, 1) * s * 3.5;
    add({ type: "star", c: i % 3 ? plus : pal[0], x: x + ox, y: y + rr(0, 1) * s * 3, vy: -rr(25, 60), r: rr(0.8, 1.6), life: rr(0.7, 1.1), wait: rr(0, 0.4), fadeIn: 0.3 });
  }
}

/* Prova grafica dalla console (anche in produzione: non scrive niente):
   __spellFx("bolt", "fire")  → dal centro-sinistra al centro-destra dello schermo */
if (typeof window !== "undefined") {
  window.__spellFx = (kind = "bolt", el = "fire", o = {}) => playSpell({
    kind, el,
    from: { x: innerWidth * 0.25, y: innerHeight * 0.6, size: 140 },
    to: { x: innerWidth * 0.72, y: innerHeight * 0.4, size: 140, bottom: innerHeight * 0.4 + 70 },
    ...o,
  });
}
