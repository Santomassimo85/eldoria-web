/* LE SEGRETE IN PRIMA PERSONA (2026-11-07): il motore grafico della vista "crawler".
   Disegna soltanto: non conosce le regole, le decide il server; la pagina gli passa i nemici e gli
   dice quando colpire o camminare. Due strati:
   - la STANZA (264×255, canvas di sotto): raggi su una griglia, luce piatta a fasce come nei vecchi
     dungeon. È FERMA: si ridisegna solo camminando o cambiando dungeon, niente tremolii.
   - gli SPRITE (×3, canvas di sopra): mostri e armi nitidi, pixel per pixel, mai sfumati.
   Mappa: stanza larga 9 caselle e profonda 7, corridoio di 3, stanza… (si ripete ogni P caselle).
   Gli sprite veri stanno su Storage e possono non permettere la lettura dei pixel: per questo i mostri
   si disegnano con drawImage (mai getImageData sul canvas) e le varianti si fanno con il compositing. */
import { TILE_THEMES, proceduralHands, tileFromImage, raceHandImage } from "./crawlerArt";

export const CW_W = 264, CW_H = 255, CW_FG = 3;
const W = CW_W, H = CW_H, FS = CW_FG, HZ = Math.round(H * 0.4), PL = 0.78, SC = W / 2 / PL, WALLH = 1.9, CAM = 0.56, P = 10, BANDS = 7;
const STEP_MS = 215;
/* COLPI IN PRIMA PERSONA (2026-11-07): la mano destra con l'arma si stacca dalla sinistra (lo sprite ha
   il centro vuoto) e fa il suo movimento; la sinistra dà un piccolo contraccolpo. Nessun disegno nuovo. */
const MOVES = {
  slash: { ms: 430, R: [[0, 0, 0, 0, 1], [0.32, 0.3, 16, -16, 1], [0.5, -0.62, -46, 6, 1.04], [0.68, -0.66, -48, 8, 1.04], [1, 0, 0, 0, 1]] },
  smash: { ms: 480, R: [[0, 0, 0, 0, 1], [0.35, 0.12, 6, -34, 1], [0.52, -0.4, -24, 26, 1.08], [0.7, -0.42, -26, 28, 1.08], [1, 0, 0, 0, 1]] },
  thrust: { ms: 400, R: [[0, 0, 0, 0, 1], [0.3, 0.05, 8, 14, 0.94], [0.5, -0.12, -48, -34, 1.28], [0.66, -0.12, -48, -34, 1.28], [1, 0, 0, 0, 1]] },
  // Il polso ruota PRIMA dell'affondo; il braccio poi si distende lungo la lama.
  // Le ultime due colonne deformano separatamente larghezza/lunghezza del braccio.
  daggerThrust: { ms: 560, R: [[0, 0, 0, 0, 1, 1, 1], [0.22, -0.55, 20, 18, 0.98, 1, 1], [0.34, -0.55, 18, 18, 0.98, 1, 1], [0.49, -0.55, -12, -42, 0.92, 0.84, 1.18], [0.60, -0.55, -14, -42, 0.92, 0.84, 1.18], [0.78, -0.55, 18, 18, 0.98, 1, 1], [1, 0, 0, 0, 1, 1, 1]] },
  punch: { ms: 340, R: [[0, 0, 0, 0, 1], [0.25, 0, 10, 12, 0.95], [0.42, -0.05, -70, -40, 1.38], [0.56, -0.05, -70, -40, 1.38], [1, 0, 0, 0, 1]] },
  /* TIRO CON L'ARCO (2026-11-07): tendi (le mani vengono indietro e un po' giù, l'arco trema) → scocchi
     (contraccolpo secco in avanti) → la freccia non c'è più → abbassi le mani a prendere una freccia
     nuova e le rialzi: la freccia ricompare. RELEASE = istante dello scocco, EMPTY = finestra senza freccia. */
  shoot: { ms: 1050, R: [[0, 0, 0, 0, 1], [0.34, 0.015, 4, 9, 1.06], [0.4, 0.015, 4, 9, 1.06], [0.44, -0.035, -2, -12, 0.99], [0.56, 0, 0, -2, 1], [0.72, 0, 6, 46, 1], [0.8, 0, 6, 48, 1], [1, 0, 0, 0, 1]], release: 0.42, empty: [0.42, 0.78] },
  // balestra: niente da tendere, mira, scatto del grilletto con rinculo, poi ricarica (giù e su)
  shootX: { ms: 900, R: [[0, 0, 0, 0, 1], [0.14, 0, 0, 3, 1.02], [0.2, -0.05, 4, -14, 0.98], [0.36, 0, 0, -2, 1], [0.62, 0, 8, 44, 1], [0.72, 0, 8, 46, 1], [1, 0, 0, 0, 1]], release: 0.18, empty: [0.18, 0.7] },
  cast: { ms: 520, R: [[0, 0, 0, 0, 1], [0.4, 0.04, 0, -12, 1.02], [0.6, 0.04, 0, -12, 1.02], [1, 0, 0, 0, 1]] },
};
const LEFT = {
  melee: [[0, 0, 0, 0, 1], [0.5, 0.05, 6, 10, 1], [1, 0, 0, 0, 1]],
  shield: [[0, 0, 0, 0, 1], [0.5, -0.04, 6, -8, 1.02], [1, 0, 0, 0, 1]],
  cast: [[0, 0, 0, 0, 1], [0.4, -0.05, 10, -22, 1.06], [0.65, -0.05, 10, -22, 1.06], [1, 0, 0, 0, 1]],
  still: [[0, 0, 0, 0, 1], [1, 0, 0, 0, 1]],
};
const RANGED = new Set(["arco_lungo", "balestra_l"]);
const SHOOT_OF = { arco_lungo: "shoot", balestra_l: "shootX" };
// valore della curva al tempo k (tra un fotogramma e l'altro si passa in modo morbido)
function curve(keys, k) {
  let i = 0;
  while (i < keys.length - 2 && k > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((k - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1), e = t * t * (3 - 2 * t);
  return { rot: a[1] + (b[1] - a[1]) * e, dx: a[2] + (b[2] - a[2]) * e, dy: a[3] + (b[3] - a[3]) * e, s: a[4] + (b[4] - a[4]) * e, sx: (a[5] ?? 1) + ((b[5] ?? 1) - (a[5] ?? 1)) * e, sy: (a[6] ?? 1) + ((b[6] ?? 1) - (a[6] ?? 1)) * e };
}
const NO_MOVE = { rot: 0, dx: 0, dy: 0, s: 1 };

// Deforma il braccio lungo l'affondo, mantenendo attaccata al bordo la base
// dell'avambraccio. Muovere rigidamente l'intero sprite sembrava un pugno volante.
export function thrustArmPoint(x, y, w, h, m, px, py, k, u, v) {
  const ox = x + u * w, oy = y + v * h;
  const weight = Math.min(1, Math.max(0, (1 - v) * 2.5));
  const rx = (ox - px) * m.s * (m.sx ?? 1), ry = (oy - py) * m.s * (m.sy ?? 1);
  const tx = px + m.dx * k + Math.cos(m.rot) * rx - Math.sin(m.rot) * ry;
  const ty = py + m.dy * k + Math.sin(m.rot) * rx + Math.cos(m.rot) * ry;
  return { x: ox + (tx - ox) * weight, y: oy + (ty - oy) * weight };
}
function drawThrustArm(ctx, img, x, y, w, h, m, px, py, k) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const point = (u, v) => thrustArmPoint(x, y, w, h, m, px, py, k, u, v);
  const triangle = (src, dst) => {
    const [s0, s1, s2] = src, [p0, p1, p2] = dst;
    const ux = s1[0] - s0[0], uy = s1[1] - s0[1], vx = s2[0] - s0[0], vy = s2[1] - s0[1];
    const det = ux * vy - uy * vx;
    const a = ((p1.x - p0.x) * vy - (p2.x - p0.x) * uy) / det;
    const b = ((p1.y - p0.y) * vy - (p2.y - p0.y) * uy) / det;
    const c = ((p2.x - p0.x) * ux - (p1.x - p0.x) * vx) / det;
    const d = ((p2.y - p0.y) * ux - (p1.y - p0.y) * vx) / det;
    // Sovrapposizione subpixel: evita fessure fra i triangoli del braccio.
    const cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3;
    const edge = (p) => {
      const len = Math.hypot(p.x - cx, p.y - cy) || 1;
      return { x: p.x + (p.x - cx) * 0.75 / len, y: p.y + (p.y - cy) * 0.75 / len };
    };
    const [q0, q1, q2] = dst.map(edge);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, p0.x - a * s0[0] - c * s0[1], p0.y - b * s0[0] - d * s0[1]);
    ctx.drawImage(img, 0, 0); ctx.restore();
  };
  for (let i = 0; i < 16; i++) {
    const v0 = i / 16, v1 = (i + 1) / 16, y0 = v0 * ih, y1 = v1 * ih;
    const tl = point(0, v0), tr = point(1, v0), bl = point(0, v1), br = point(1, v1);
    triangle([[0, y0], [iw, y0], [0, y1]], [tl, tr, bl]);
    triangle([[iw, y0], [iw, y1], [0, y1]], [tr, br, bl]);
  }
}
// dove separare le due mani: la colonna più vuota nella fascia centrale dello sprite
function splitOf(img) {
  try {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let best = -1, min = Infinity;
    for (let x = Math.round(w * 0.3); x <= Math.round(w * 0.62); x++) {
      let n = 0;
      for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 40) n++;
      if (n < min) { min = n; best = x; }
    }
    if (best < 0 || min > h * 0.02) return null;
    const part = (x0, x1) => { const p = document.createElement("canvas"); p.width = x1 - x0; p.height = h; p.getContext("2d").drawImage(img, x0, 0, x1 - x0, h, 0, 0, x1 - x0, h); return p; };
    return { x: best, L: part(0, best), R: part(best, w) };
  } catch { return null; }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hexRgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
// luce a fasce: dipende solo dalla distanza, così pareti e pavimento restano piatti e fermi
const band = (dist) => Math.round(clamp(1.04 - dist * 0.09, 0.2, 1) * BANDS) / BANDS;

function solid(x, y) {
  const r = ((y % P) + P) % P;
  if (x < 0 || x > 12) return 1;
  if (r < 7) { if (x < 2 || x > 10) return 1; if ((x === 3 || x === 9) && r === 5) return 2; return 0; }
  return x === 6 ? 0 : 1;
}

// dove stanno i nemici: [spostamento laterale, profondità]; il boss al centro, più indietro
export function foeSlots(n, bossIdx = -1) {
  const rows = {
    1: [[0, 2.3]], 2: [[-0.85, 2.25], [0.85, 2.25]], 3: [[-1.3, 2.15], [0, 2.3], [1.3, 2.15]],
    4: [[-1.32, 2.15], [1.32, 2.15], [-0.62, 3.3], [0.62, 3.3]],
    5: [[-1.32, 2.15], [0, 2.25], [1.32, 2.15], [-0.7, 3.35], [0.7, 3.35]],
    6: [[-1.32, 2.15], [0, 2.25], [1.32, 2.15], [-1.1, 3.4], [0, 3.5], [1.1, 3.4]],
  };
  if (bossIdx >= 0) {
    const side = [[-1.4, 2.1], [1.4, 2.1], [-1.9, 3.1], [1.9, 3.1], [-0.8, 1.9], [0.8, 1.9]];
    let k = 0;
    return Array.from({ length: n }, (_, i) => (i === bossIdx ? [0, 2.9] : side[k++ % side.length]));
  }
  const base = rows[Math.min(n, 6)] || rows[1];
  return Array.from({ length: n }, (_, i) => base[i] || [((i % 3) - 1) * 1.2, 4.2]);
}

function loadImage(src) {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res({ img: i, readable: true });
    i.onerror = () => {
      const j = new Image();
      j.onload = () => res({ img: j, readable: false });
      j.onerror = () => res(null);
      j.src = src;
    };
    i.src = src;
  });
}
// toglie i bordi vuoti, così i piedi poggiano davvero a terra (solo se l'immagine si può leggere)
function bounds({ img, readable }) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, all = { x: 0, y: 0, w, h };
  if (!readable) return all;
  try {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? all : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch { return all; }
}
// lo sprite tocca il bordo in alto? (solo immagini leggibili, come le data URL dell'admin)
function topRow(img) {
  try {
    const w = img.naturalWidth || img.width, c = document.createElement("canvas"); c.width = w; c.height = 3;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, 3).data;
    let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 40) n++;
    return n > 2;
  } catch { return false; }
}
function emojiSprite(ch) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d"); g.font = "104px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch || "👹", 64, 70);
  return c;
}
const overlay = (src, color) => {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d"); g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
};
// versione rimpicciolita della tessera: da lontano niente righe che sfarfallano
function mipOf(t) {
  if (t.mip) return t.mip;
  const k = 4, size = t.size / k, rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let n = 0; n < 3; n++) {
    let s = 0;
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += t.rgb[((y * k + j) * t.size + x * k + i) * 3 + n];
    rgb[(y * size + x) * 3 + n] = s / (k * k);
  }
  t.mip = { size, mask: size - 1, rgb, em: null, unit: size };
  return t.mip;
}


/* LO SCRIGNO A PIXEL (2026-11-07 sera): 32 pixel di larghezza, legno a fasce, ferri d'oro con borchie,
   serratura; aperto = coperchio ribaltato all'indietro e un mucchio di monete con gemme. */
const CHEST_W = 32;
const CHEST_SPARK_SHUT = [[6, 9], [25, 9], [16, 15], [6, 21], [25, 21]];
const CHEST_SPARK_OPEN = [[9, 12], [14, 10], [19, 11], [23, 12], [12, 13], [17, 9], [21, 13]];
const chestCache = {};
function chestSprite(frame) {
  if (chestCache[frame]) return chestCache[frame];
  const H = 30, cv = document.createElement("canvas"); cv.width = CHEST_W; cv.height = H;
  const g = cv.getContext("2d");
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const O = "#1a0f08", W0 = "#3e2410", W1 = "#6b4423", W2 = "#86572d", W3 = "#a8743f", G0 = "#7a5410", G1 = "#d4a63a", G2 = "#f6d77a", IR = "#2b2724";
  const bodyTop = 17, bodyBot = 28; // corpo: righe 17..28
  // ── CORPO ──
  P(1, bodyTop - 1, 30, bodyBot - bodyTop + 3, O);
  P(2, bodyTop, 28, bodyBot - bodyTop + 1, W1);
  for (const y of [20, 24]) { P(2, y, 28, 1, W0); P(2, y + 1, 28, 1, W2); }
  P(2, bodyTop, 28, 1, W3); P(2, bodyBot, 28, 1, W0);
  for (let x = 4; x < 30; x += 7) P(x, bodyTop + 1, 1, 2, W0); // venature
  const band = (x, y0, y1) => { P(x - 1, y0, 5, y1 - y0 + 1, O); P(x, y0, 3, y1 - y0 + 1, G1); P(x, y0, 1, y1 - y0 + 1, G2); P(x + 2, y0, 1, y1 - y0 + 1, G0); };
  band(4, bodyTop, bodyBot); band(25, bodyTop, bodyBot);
  for (const x of [5, 26]) for (const y of [bodyTop + 2, bodyTop + 6, bodyTop + 10]) P(x, y, 1, 1, "#fff3c0");
  // angoli di ferro in basso
  P(1, bodyBot - 1, 3, 3, IR); P(28, bodyBot - 1, 3, 3, IR);
  // piedini
  P(2, bodyBot + 1, 3, 1, O); P(27, bodyBot + 1, 3, 1, O);
  if (frame === 2) {
    // ── APERTO: coperchio ribaltato dietro (si vede il dentro), monete ammucchiate ──
    P(3, 1, 26, 9, O); P(2, 3, 28, 7, O);
    P(4, 2, 24, 7, W0); P(3, 4, 26, 5, W0);
    for (const y of [4, 7]) P(3, y, 26, 1, "#2c190a");
    P(3, 9, 26, 1, G0);
    for (const x of [5, 26]) { P(x - 1, 2, 3, 8, G0); P(x - 1, 2, 1, 8, G1); }
    // il mucchio di monete
    P(2, 12, 28, 6, O);
    P(3, 11, 26, 6, G1); P(6, 10, 20, 1, G1); P(10, 9, 12, 1, G1); P(13, 8, 6, 1, G1);
    P(6, 9, 4, 1, O); P(22, 9, 4, 1, O); P(10, 8, 3, 1, O); P(19, 8, 3, 1, O); P(13, 7, 6, 1, O);
    const coin = [[5, 13], [8, 12], [11, 11], [14, 9], [17, 10], [20, 11], [23, 12], [26, 13], [9, 14], [15, 13], [21, 14], [12, 15], [18, 15], [6, 15], [25, 15]];
    coin.forEach(([x, y], i) => { P(x, y, 2, 1, i % 3 ? G2 : "#fff3c0"); P(x, y + 1, 2, 1, G0); });
    // gemme
    for (const [x, y, c1, c2] of [[10, 12, "#e0624f", "#ff9a8a"], [19, 12, "#4f8de0", "#a5ccff"], [15, 11, "#3fb85a", "#9ff0a8"], [23, 14, "#b46be0", "#e3b8ff"]]) { P(x, y, 2, 2, c1); P(x, y, 1, 1, c2); }
    // bordo davanti del corpo sopra il mucchio
    P(2, bodyTop, 28, 1, W3);
  } else {
    // ── CHIUSO / SOCCHIUSO: coperchio a cupola ──
    const lift = frame === 1 ? 2 : 0, lt = 5 - lift;
    const dome = [[8, 23], [5, 26], [3, 28], [2, 29]]; // righe in alto più strette
    dome.forEach(([x0, x1], i) => P(x0 - 1, lt + i - 1, x1 - x0 + 3, 1, O));
    P(1, lt + 3, 30, 12 - 3 - lift + lift, O);
    dome.forEach(([x0, x1], i) => P(x0, lt + i, x1 - x0 + 1, 1, i === 0 ? W3 : i === 1 ? W2 : W1));
    const lb = bodyTop - 2 - lift; // ultima riga del coperchio
    P(2, lt + 4, 28, lb - lt - 4 + 1, W1);
    for (const y of [lt + 6, lt + 9]) if (y < lb) { P(2, y, 28, 1, W0); P(2, y - 1, 28, 1, W2); }
    // fascia in fondo al coperchio
    P(1, lb, 30, 2, O); P(2, lb, 28, 1, G1); P(2, lb, 28, 1, G2); P(2, lb + 1 > lb ? lb : lb, 28, 1, G1);
    band(4, lt + 2, lb); band(25, lt + 2, lb);
    for (const x of [5, 26]) for (const y of [lt + 4, lt + 8]) P(x, y, 1, 1, "#fff3c0");
    if (frame === 1) { P(2, lb + 1, 28, 2, "#ffe27a"); P(5, lb + 1, 22, 1, "#fffbe0"); }
    // serratura
    const ly = bodyTop - 3 - lift;
    P(12, ly - 1, 8, 8, O); P(13, ly, 6, 6, G1); P(13, ly, 6, 1, G2); P(13, ly, 1, 6, G2); P(18, ly, 1, 6, G0); P(13, ly + 5, 6, 1, G0);
    P(15, ly + 2, 2, 2, O); P(15, ly + 4, 2, 1, O); P(16, ly + 4, 0, 0, O);
  }
  chestCache[frame] = cv;
  return cv;
}

export class CrawlerEngine {
  constructor(canvas, fg) {
    this.cv = canvas; canvas.width = W; canvas.height = H;
    this.bg = canvas.getContext("2d");
    this.imgData = this.bg.createImageData(W, H);
    this.px = new Uint32Array(this.imgData.data.buffer);
    this.zbuf = new Float32Array(W);
    fg.width = W * FS; fg.height = H * FS;
    this.ctx = fg.getContext("2d"); this.ctx.imageSmoothingEnabled = false;
    this.cam = { x: 6.5, y: 0.5, bob: 0 };
    this.base = 0; this.red = 0; this.last = 0; this.dirty = true;
    this.foes = []; this.byId = new Map(); this.aim = null; this.aimT = 0; this.pickable = new Set(); this.hover = null; this.anchors = new Map(); this.order = [];
    this.hands = { R: null, L: null }; this.handKey = "";
    this.act = null; this.ranged = false; this.offKind = "hand";
    this.anims = []; this.walking = null; this.calm = reduced();
    this.setTheme("segrete");
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() { cancelAnimationFrame(this.raf); this.dead = true; clearTimeout(this.walkTimer); this.walking = null; }

  /* ── aspetto ── */
  setTheme(key, custom) {
    const t = TILE_THEMES[key] || TILE_THEMES.segrete;
    t.tiles = t.tiles || { W: t.wall(), F: t.floor(), C: t.ceil() };
    this.T = { ...t, W: t.tiles.W, F: t.tiles.F, C: t.tiles.C };
    this.themeKey = key; this.dirty = true;
    if (custom) this.loadTiles(key, custom);
  }
  async loadTiles(key, custom) {
    const out = {};
    await Promise.all([["W", custom.wall], ["F", custom.floor], ["C", custom.ceil]].map(async ([k, src]) => {
      if (!src) return;
      const l = await loadImage(src);
      if (l?.readable) out[k] = tileFromImage(l.img);
    }));
    if (this.themeKey === key && !this.dead) { Object.assign(this.T, out); this.dirty = true; }
  }
  // spec = {main, off, mainUrl, offUrl}: senza immagini generate si usano i disegni di riserva
  async setHands(key, spec) {
    if (this.handKey === key) return;
    this.handKey = key;
    const out = proceduralHands(spec.main, spec.off, spec.race);
    const fists = proceduralHands("pugni", "mirror", spec.race);
    const up = async (url) => { const l = url ? await loadImage(url) : null; return l ? l.img : null; };
    const [m, o, p, pe, fp] = (await Promise.all([up(spec.mainUrl), up(spec.offUrl), up(spec.pairUrl), up(spec.pairEmptyUrl), up(spec.punchPairUrl)])).map((img) => spec.race === "elf" ? raceHandImage(img, "elf") : img);
    if (this.handKey !== key || this.dead) return;
    this.fists = fp ? { pair: fp, cutR: topRow(fp), split: splitOf(fp) } : fists;
    this.mainWeapon = spec.main;
    this.ranged = RANGED.has(spec.main);
    this.shootKind = SHOOT_OF[spec.main] || "shoot";
    this.offKind = spec.off;
    // pairEmpty = lo stesso sprite con la freccia già scoccata (facoltativo)
    if (p) { this.hands = { pair: p, pairEmpty: pe, cutR: topRow(p), split: spec.off === "none" || this.ranged ? null : splitOf(p) }; return; } // arco e balestra: le due mani si muovono insieme
    if (m) { out.R = m; out.big = true; out.cutR = topRow(m); if (spec.off === "mirror") out.L = m; }
    if (o) { out.L = o; out.mirrorL = false; out.big = true; } // l'IA disegna già il braccio sinistro
    this.hands = out;
  }

  /* ── nemici ── */
  setFoes(list) {
    const n = list.length, bossIdx = list.findIndex((f) => f.role === "boss"), slots = foeSlots(n, bossIdx);
    const keep = new Map(this.foes.map((f) => [f.id, f]));
    this.foes = list.map((src, i) => {
      const old = keep.get(src.id);
      const f = old && old.url === (src.img || "") ? old : { id: src.id, url: src.img || "", icon: src.icon, flash: 0, die: 0, lunge: 0, ph: i * 0.37, spr: null, box: null };
      const [dx, dz] = slots[i];
      f.x = 6.5 + dx; f.y = this.roomY + 0.5 + dz; f.dz0 = dz;
      f.h = clamp(0.82 * (src.scale || 1), 0.42, 1.85); // 2026-11-07: un po' più piccoli, taglie più marcate
      f.hp = src.hp; f.max = src.maxHp; f.state = src.state || ""; f.name = src.name || "";
      if (!f.loading && !f.spr) this.prep(f);
      return f;
    });
    this.byId = new Map(this.foes.map((f) => [f.id, f]));
  }
  get roomY() { return this.nextBase ?? this.base; }
  // lo sprite resta alla sua risoluzione: si ritaglia soltanto, e si fanno le varianti lampo/pietra/ghiaccio
  async prep(f) {
    f.loading = true;
    const l = f.url ? await loadImage(f.url) : null;
    const source = l ? l.img : emojiSprite(f.icon), b = l ? bounds(l) : { x: 0, y: 0, w: 128, h: 128 };
    f.loading = false;
    if (this.dead) return;
    const c = document.createElement("canvas"); c.width = b.w; c.height = b.h;
    c.getContext("2d").drawImage(source, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
    f.spr = { lit: c, white: overlay(c, "#fff"), stone: overlay(c, "rgba(120,120,125,.72)"), ice: overlay(c, "rgba(120,200,255,.55)"), gold: overlay(c, "#ffd76a"), ratio: b.w / b.h };
  }
  /* MIRA (2026-11-07): niente riquadri. I nemici colpibili hanno un contorno dorato sulla sagoma che
     pulsa piano e una freccetta che ondeggia; quello sotto il dito si accende; il bersaglio scelto ha il
     mirino a quattro angoli che si stringe. Tutto disegnato qui, morbido (niente scatti). */
  setAim(id) { if ((id || null) !== this.aim) { this.aim = id || null; this.aimT = performance.now(); } }
  setPickable(ids) { this.pickable = new Set(ids || []); }
  setHover(id) { this.hover = id || null; }
  bindAnchor(id, el) { if (el) this.anchors.set(id, el); else this.anchors.delete(id); }

  /* ── colpi ── */
  flash(id) { const f = this.byId.get(id); if (f) f.flash = 150; }
  hurt() { this.red = 0.42; }
  anim(ms, fn) {
    if (this.calm) ms = Math.min(ms, 60);
    return new Promise((res) => { this.anims.push({ t0: performance.now(), ms, fn, res }); setTimeout(() => res(), ms + 400); });
  }
  // fx della riga di cronaca: slash · smash · thrust · punch (corpo a corpo), arrow (a distanza), altro = incantesimo
  attack(fx, { hand = "R", unarmed = false } = {}) {
    // I pugnali usano lo stesso fendente dello sprite delle spade, alternando le mani.
    if (this.mainWeapon === "pugnali" && fx === "thrust" && !unarmed) fx = "slash";
    const kind = MOVES[fx] && fx !== "shoot" ? fx : fx === "arrow" || fx === "shoot" ? (this.ranged ? this.shootKind : "cast") : "cast";
    const ms = this.calm ? 60 : MOVES[kind].ms;
    this.act = { kind, hand, unarmed, t0: performance.now(), ms };
    return new Promise((res) => setTimeout(res, this.calm ? 60 : ms));
  }
  // dopo quanti ms dall'inizio del tiro parte la freccia (per far partire l'effetto allo scocco)
  releaseMs() { const m = MOVES[this.shootKind || "shoot"]; return this.calm || !this.ranged ? 0 : Math.round(m.ms * m.release); }
  // la freccia è già partita e non è ancora stata ripresa?
  arrowGone() {
    const a = this.act, m = a && MOVES[a.kind];
    if (!m?.empty || this.calm) return false;
    const k = (performance.now() - a.t0) / a.ms;
    return k >= m.empty[0] && k < m.empty[1];
  }
  swing(fx = "slash") { return this.attack(fx); }
  cast() { return this.attack("cast"); }
  // movimento del momento per la destra (con l'arma) e per la sinistra
  moveNow() {
    const a = this.act;
    if (!a) return { R: NO_MOVE, L: NO_MOVE };
    const k = (performance.now() - a.t0) / a.ms;
    if (k >= 1) { this.act = null; return { R: NO_MOVE, L: NO_MOVE }; }
    if (this.calm) return { R: NO_MOVE, L: NO_MOVE };
    const left = a.kind === "cast" ? LEFT.cast : this.offKind === "shield" ? LEFT.shield : MOVES[a.kind].release != null ? LEFT.still : LEFT.melee;
    if (a.hand === "L") {
      const strike = curve(MOVES[a.kind].R, k);
      return { R: NO_MOVE, L: { ...strike, dx: -strike.dx, rot: -strike.rot } };
    }
    return { R: curve(MOVES[a.kind].R, k), L: a.unarmed || this.offKind === "mirror" ? NO_MOVE : curve(left, k) };
  }
  async lunge(id) {
    const f = this.byId.get(id); if (!f) return;
    await this.anim(190, (k) => { f.lunge = k; });
    await this.anim(170, (k) => { f.lunge = 1 - k; });
  }
  // cammina fino alla sala dopo; i nemici nuovi aspettano già là in fondo
  walk(list) {
    const to = this.base + P;
    this.nextBase = to;
    this.setFoes(list);
    const steps = P, from = this.cam.y;
    return new Promise((res) => {
      const done = () => { if (!this.walking) return; this.walking = null; this.cam.y = from + steps; this.cam.bob = 0; this.base = to; this.nextBase = null; this.dirty = true; clearTimeout(this.walkTimer); res(); };
      this.walking = { t0: performance.now(), from, steps, res: done, ms: this.calm ? 40 : STEP_MS };
      this.walkTimer = setTimeout(done, steps * STEP_MS + 1500); // scheda in pausa: non resta a metà
    });
  }

  /* ── la stanza ── */
  torches(y = this.cam.y) {
    const b = Math.floor(y / P) * P, out = [];
    for (const q of [b, b + P]) out.push([2.15, q + 1.5], [10.85, q + 1.5], [2.15, q + 4.5], [10.85, q + 4.5], [5.4, q + 6.85], [7.6, q + 6.85]);
    return out;
  }
  put(i, tex, tx, ty, q) {
    const ti = (ty & tex.mask) * tex.size + (tx & tex.mask), r = tex.rgb, o = ti * 3;
    if (tex.em && tex.em[ti]) { this.px[i] = 0xff000000 | (r[o + 2] << 16) | (r[o + 1] << 8) | r[o]; return; }
    const t = this.T.tint;
    this.px[i] = 0xff000000 | (Math.min(255, r[o + 2] * q * t[2]) << 16) | (Math.min(255, r[o + 1] * q * t[1]) << 8) | Math.min(255, r[o] * q * t[0]);
  }
  render() {
    const { cam, T, zbuf } = this, hz = HZ + Math.round(cam.bob * 0.5), ch = CAM + cam.bob * 0.006;
    for (let y = 0; y < H; y++) { // pavimento e soffitto: una fascia di luce per riga
      if (y === hz) { for (let x = 0; x < W; x++) this.px[y * W + x] = 0xff000000; continue; }
      const floor = y > hz, dist = ((floor ? ch : WALLH - ch) * SC) / Math.abs(y - hz), full = floor ? T.F : T.C, tex = dist > 4.5 ? mipOf(full) : full, s = tex.size;
      const q = band(dist) * (floor ? 1 : 0.68);
      for (let x = 0; x < W; x++) {
        const wx = cam.x + dist * (((2 * x) / W - 1) * PL), wy = cam.y + dist;
        this.put(y * W + x, tex, Math.floor(wx * s / (full.span || 1)), Math.floor(wy * s / (full.span || 1)), q);
      }
    }
    for (let x = 0; x < W; x++) { // pareti: un raggio per colonna
      const rx = ((2 * x) / W - 1) * PL;
      let mx = Math.floor(cam.x), my = Math.floor(cam.y), side = 0, hit = 0;
      const dX = rx === 0 ? 1e9 : Math.abs(1 / rx), sx = rx < 0 ? -1 : 1;
      let tX = (rx < 0 ? cam.x - mx : mx + 1 - cam.x) * dX, tY = my + 1 - cam.y;
      for (let n = 0; n < 40 && !hit; n++) {
        if (tX < tY) { tX += dX; mx += sx; side = 0; } else { tY += 1; my += 1; side = 1; }
        hit = solid(mx, my);
      }
      const dist = side === 0 ? tX - dX : tY - 1;
      zbuf[x] = dist;
      const u = side === 0 ? cam.y + dist : cam.x + dist * rx, tex = dist > 4.5 ? mipOf(T.W) : T.W, ws = tex.size, tx = Math.floor(u * ws / (T.W.span || 1));
      const top = Math.max(0, Math.ceil(hz + ((ch - WALLH) * SC) / dist)), bot = Math.min(H - 1, Math.floor(hz + (ch * SC) / dist));
      const q = band(dist) * (side === 0 ? 0.74 : 1); // i muri di lato un tono più scuri, come una volta
      for (let y = top; y <= bot; y++) {
        const hgt = ch - ((y - hz) * dist) / SC, ty = Math.floor(hgt * ws / (T.W.span || 1));
        this.put(y * W + x, tex, tx, ws - 1 - ty, q);
      }
    }
    this.bg.putImageData(this.imgData, 0, 0);
    this.dirty = false;
  }

  /* ── gli sprite ── */
  layoutFoes(t) {
    const { cam } = this, hz = HZ + Math.round(cam.bob * 0.5);
    this.order = this.foes.map((f) => ({ f, dz: f.y - cam.y - f.lunge * 0.55 })).filter((o) => o.dz > 0.35).sort((a, b) => b.dz - a.dz);
    for (const o of this.order) {
      const { f, dz } = o, sc = SC / dz, ratio = f.spr?.ratio || 0.7;
      let sh = f.h * sc, sw = sh * ratio;
      const maxW = (W * 0.62 * f.dz0) / dz;
      if (sw > maxW) { sh *= maxW / sw; sw = maxW; }
      const dx = f.x - cam.x;
      // i nemici grossi sui lati restano dentro lo schermo
      const cx = clamp((W / 2) * (1 + dx / dz / PL), Math.min(W / 2, sw / 2 + 2), Math.max(W / 2, W - sw / 2 - 2));
      const bob = !this.calm && !f.state && Math.floor(t / 620 + f.ph * 3) % 2 ? 1 : 0;
      const foot = hz + CAM * sc + f.die * 6;
      f.box = { x: cx - sw / 2, y: foot - sh + bob, w: sw, h: sh, cx, foot };
    }
  }
  // le colonne dello sprite non coperte da un pilastro; ox/oy = spostamento (per il contorno)
  drawSpans(src, b, dz, ox = 0, oy = 0) {
    const { ctx, zbuf } = this;
    const x0 = Math.max(0, Math.floor(b.x)), x1 = Math.min(W, Math.ceil(b.x + b.w));
    let s = -1;
    for (let x = x0; x <= x1; x++) {
      const vis = x < x1 && zbuf[x] >= dz;
      if (vis && s < 0) s = x;
      if (!vis && s >= 0) {
        const a = Math.max(s, b.x), e = Math.min(x, b.x + b.w);
        const u0 = ((a - b.x) / b.w) * src.width, u1 = ((e - b.x) / b.w) * src.width;
        ctx.drawImage(src, u0, 0, u1 - u0, src.height, a + ox, b.y + oy, e - a, b.h);
        s = -1;
      }
    }
  }
  drawFoes(t) {
    const { ctx } = this, px = 1 / FS;
    for (const { f, dz } of this.order) {
      if (!f.spr || !f.box || f.die >= 1) continue;
      const b = f.box, src = f.flash > 0 ? f.spr.white : f.state === "stone" ? f.spr.stone : f.state === "ice" ? f.spr.ice : f.spr.lit;
      const fade = f.die > 0 ? Math.round((1 - f.die) * 4) / 4 : 1;
      ctx.globalAlpha = fade * 0.42;
      ctx.fillStyle = "#000"; // ombra piatta a terra
      const sw = Math.round(b.w * 0.8), sh = Math.max(2, Math.round((SC / dz) * 0.07));
      ctx.fillRect(Math.round(b.cx - sw / 2), Math.round(b.foot - sh / 2), sw, sh);
      // contorno dorato: colpibile (pulsa piano), sotto il dito o bersaglio scelto (pieno)
      const alive = f.hp > 0 && !f.die, aimed = alive && f.id === this.aim, hot = alive && f.id === this.hover && this.pickable.has(f.id);
      if (alive && (aimed || this.pickable.has(f.id))) {
        const pulse = this.calm ? 0.8 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t / 260));
        const glow = aimed || hot ? 1 : pulse, thick = aimed || hot ? 2.2 : 1.6;
        ctx.globalAlpha = fade * glow;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) this.drawSpans(f.spr.gold, b, dz, dx * thick * px * FS / 2, dy * thick * px * FS / 2);
      }
      ctx.globalAlpha = fade;
      this.drawSpans(src, b, dz);
      if (hot && !aimed) { ctx.globalAlpha = 0.18; this.drawSpans(f.spr.white, b, dz); }
    }
    ctx.globalAlpha = 1;
  }
  // freccetta che ondeggia sopra i colpibili; mirino a quattro angoli sul bersaglio scelto
  drawAim(t) {
    if (this.walking) return;
    const { ctx } = this;
    for (const f of this.foes) {
      if (!f.box || f.hp <= 0 || f.die) continue;
      const b = f.box, aimed = f.id === this.aim, pick = this.pickable.has(f.id);
      if (pick && !aimed) {
        const hot = f.id === this.hover, bob = this.calm ? 0 : Math.sin(t / 220 + f.ph * 4) * 2.2, cx = b.cx, y = Math.max(6, b.y - 14) + bob, s = hot ? 1.25 : 1;
        ctx.fillStyle = "#1a1206"; ctx.beginPath(); ctx.moveTo(cx - 5.2 * s, y - 1); ctx.lineTo(cx + 5.2 * s, y - 1); ctx.lineTo(cx, y + 6.4 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hot ? "#fff3c4" : "#ffd76a"; ctx.beginPath(); ctx.moveTo(cx - 4 * s, y); ctx.lineTo(cx + 4 * s, y); ctx.lineTo(cx, y + 5 * s); ctx.closePath(); ctx.fill();
      }
      if (aimed) {
        const k = this.calm ? 1 : clamp((performance.now() - this.aimT) / 260, 0, 1), e = 1 - (1 - k) ** 3, breathe = this.calm ? 0 : Math.sin(t / 300) * 1.2;
        const pad = 10 * (1 - e) + 3 + breathe, x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.foot + pad * 0.6, L = Math.max(5, Math.min(b.w, b.h) * 0.28);
        ctx.globalAlpha = e;
        ctx.lineCap = "square";
        for (const [lw, col] of [[3.2, "#1a1206"], [1.6, "#fff3c4"]]) {
          ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath();
          ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
          ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
          ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
          ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  drawTorches() {
    const { ctx, cam, zbuf } = this, col = hexRgb(this.T.flame);
    for (const [wx, wy] of this.torches()) {
      const dz = wy - cam.y; if (dz < 0.5 || dz > 11) continue;
      const x = Math.round((W / 2) * (1 + (wx - cam.x) / dz / PL)), sc = SC / dz;
      if (x < 1 || x >= W - 1 || zbuf[x] < dz - 0.25) continue;
      const y = Math.round(HZ + (CAM - 1.12) * sc), s = Math.max(2, Math.round(sc * 0.07));
      ctx.fillStyle = "#2a1c12"; ctx.fillRect(x - Math.ceil(s / 3), y, Math.ceil(s * 0.66), s * 2);
      ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x - s / 2, y - s, s, s);
      ctx.fillStyle = "#fff0b0"; ctx.fillRect(x - s / 4, y - s / 2, Math.max(1, s / 2), s / 2 + 1);
    }
  }
  drawBars() {
    if (this.walking) return;
    const { ctx } = this;
    for (const f of this.foes) {
      if (!f.box || f.hp <= 0 || f.die) continue;
      const w = clamp(Math.round(f.box.w * 0.62), 18, 52), x = Math.round(f.box.cx - w / 2), y = Math.max(11, Math.round(f.box.y) - 6);
      ctx.fillStyle = "#000"; ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = f.hp / f.max < 0.3 ? "#ff7a5c" : "#c8303a"; ctx.fillRect(x, y, Math.max(1, Math.round((w * f.hp) / Math.max(1, f.max))), 3);
      // il nome sopra la barra (2026-11-07): contorno scuro, accorciato se è troppo lungo; oro sul bersaglio
      if (f.name) {
        ctx.font = '700 6.6px "Pixelify Sans", system-ui, sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        const max = Math.max(w + 18, 44);
        let txt = f.name;
        if (ctx.measureText(txt).width > max) { while (txt.length > 3 && ctx.measureText(`${txt}…`).width > max) txt = txt.slice(0, -1); txt = `${txt.trimEnd()}…`; }
        ctx.lineJoin = "round"; ctx.lineWidth = 2; ctx.strokeStyle = "#0a0709";
        ctx.strokeText(txt, f.box.cx, y - 1.6);
        ctx.fillStyle = f.id === this.aim ? "#ffd76a" : f.id === this.hover && this.pickable.has(f.id) ? "#fff3c4" : "#f3ead8";
        ctx.fillText(txt, f.box.cx, y - 1.6);
      }
    }
  }
  drawHands() {
    const { ctx, cam } = this, k = W / 240, b = Math.round(cam.bob * 1.1);
    const mv = this.moveNow();
    const hands = this.act?.unarmed && this.fists ? this.fists : this.hands;
    // disegna img nel riquadro (x, y, w, h) con il movimento m, che ruota attorno a (px, py)
    const part = (img, x, y, w, h, m, px, py, sx = 0, sw = null) => {
      if (this.act?.kind === "daggerThrust" && (m.dx || m.dy || m.rot) && sw == null) {
        drawThrustArm(ctx, img, x, y, w, h, m, px, py, k);
        return;
      }
      ctx.save();
      ctx.translate(px + m.dx * k, py + m.dy * k);
      ctx.rotate(m.rot);
      ctx.scale(m.s * (m.sx ?? 1), m.s * (m.sy ?? 1));
      ctx.translate(-px, -py);
      if (sw == null) ctx.drawImage(img, x, y, w, h);
      else ctx.drawImage(img, sx, 0, sw, img.height, x, y, w, h);
      ctx.restore();
    };
    const gone = this.arrowGone();
    if (hands.pair) { // un'immagine sola con le due mani, larga quanto la scena
      const img = gone && hands.pairEmpty ? hands.pairEmpty : hands.pair;
      const iw = hands.pair.naturalWidth || hands.pair.width, ih = hands.pair.naturalHeight || hands.pair.height;
      const grow = hands.cutR ? Math.max(1, (H + 10) / ((W * ih) / iw)) : 1, w = W * grow, h = ((W * ih) / iw) * grow;
      const x0 = (W - w) / 2, y0 = H + 4 + b - h, sc = w / iw;
      if (hands.split) {
        const sp = hands.split, wl = sp.x * sc;
        part(sp.L, x0, y0, wl, h, mv.L, x0 + wl * 0.4, y0 + h);
        part(sp.R, x0 + wl, y0, w - wl, h, mv.R, x0 + wl + (w - wl) * 0.7, y0 + h); // perno: il polso, in basso
      } else {
        part(img, x0, y0, w, h, mv.R, W / 2 + W * 0.15, y0 + h);
      }
      return;
    }
    // riserva disegnata dal codice: due mani separate
    const size = H * 0.66;
    const dims = (s) => { const w = s.naturalWidth || s.width, h = s.naturalHeight || s.height; return [size * (w / h), size]; };
    if (hands.L) {
      const [w, h] = dims(hands.L), y = H - h + 4 + b;
      ctx.save();
      if (hands.mirrorL) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      const lm = hands.mirrorL ? { ...mv.L, dx: -mv.L.dx, rot: -mv.L.rot } : mv.L;
      part(hands.L, 0, y, w, h, lm, w * 0.2, H + 4 + b);
      ctx.restore();
    }
    if (hands.R) {
      // arma tagliata dall'IA in alto: più grande, il bordo tagliato finisce fuori dallo schermo
      const [w0, h0] = dims(hands.R), grow = hands.cutR ? (H + 10) / h0 : 1, w = w0 * grow, h = h0 * grow;
      part(gone && hands.R0 ? hands.R0 : hands.R, W - w, H + 4 + b - h, w, h, mv.R, W - w * 0.2, H + 4 + b);
    }
  }
  /* LO SCRIGNO (2026-11-07): in fondo alla sala del tesoro. setChest("closed") lo mette; openChest() alza il
     coperchio e fa uscire una fontana di monete. Il bottone "Toccami" della pagina lo segue (ancora "chest"). */
  setChest(state) { if (!state) { this.chest = null; return; } if (!this.chest) this.chest = { open: 0, t0: 0 }; if (state === "open") this.chest.open = 1; }
  openChest() {
    if (!this.chest) this.chest = { open: 0, t0: 0 };
    const c = this.chest; c.t0 = performance.now(); c.opening = true;
    return new Promise((res) => setTimeout(res, this.calm ? 200 : 1300));
  }
  drawChest(t) {
    const c = this.chest; if (!c) return;
    const { ctx, cam } = this;
    if (c.opening) { const k = clamp((performance.now() - c.t0) / 900, 0, 1); c.open = k; if (k >= 1) c.opening = false; if (!c.burst && k > 0.45) { c.burst = true; this.coinBurst(); } }
    const dz = this.roomY + 0.5 + 2.4 - cam.y; if (dz < 0.4) return;
    const sc = SC / dz, w = 1.05 * sc, p = w / CHEST_W, cx = W / 2, foot = HZ + CAM * sc + Math.round(cam.bob * 0.5);
    // scalino di pietra sotto lo scrigno
    const dw = w * 1.3, dh = p * 3, dx = cx - dw / 2, dy = foot - dh * 0.6;
    ctx.globalAlpha = 0.5; ctx.fillStyle = "#000"; ctx.fillRect(dx - p * 2, dy + dh - p, dw + p * 4, p * 2); ctx.globalAlpha = 1;
    ctx.fillStyle = "#14110f"; ctx.fillRect(dx - p, dy - p, dw + p * 2, dh + p * 2);
    ctx.fillStyle = "#4a4540"; ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = "#6a635b"; ctx.fillRect(dx, dy, dw, p);
    ctx.fillStyle = "#2e2a26"; for (let i = 1; i < 5; i++) ctx.fillRect(dx + (dw * i) / 5, dy + p, p, dh - p);
    const frame = c.open < 0.2 ? 0 : c.open < 0.5 ? 1 : 2;
    const spr = chestSprite(frame), sh = spr.height * p, x0 = Math.round(cx - w / 2), top = dy - sh + p * 2;
    this.chestBox = { x: x0, y: top, w, h: sh, cx, foot: dy };
    // luce dorata: colonne a fasce che salgono quando è aperto
    if (frame > 0) {
      const k = frame === 1 ? 0.45 : 1, lt = top + sh * 0.42;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(cx, lt, 0, cx, lt, w * 1.2);
      g.addColorStop(0, `rgba(255,220,110,${(0.5 * k).toFixed(2)})`); g.addColorStop(1, "rgba(255,190,70,0)");
      ctx.fillStyle = g; ctx.fillRect(cx - w * 1.3, lt - w * 1.3, w * 2.6, w * 1.8);
      if (frame === 2 && !this.calm) {
        for (let i = 0; i < 5; i++) {
          const bx = x0 + w * (0.16 + i * 0.17), bw = p * (2 + (i % 2)), al = 0.12 + 0.1 * Math.abs(Math.sin(t / 500 + i * 1.7));
          ctx.fillStyle = `rgba(255,226,140,${al.toFixed(2)})`; ctx.fillRect(Math.round(bx), lt - sh * 1.6, bw, sh * 1.6);
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, x0, top, w, sh);
    // luccichii a pixel: sull'oro quando è aperto, sulle fasce quando è chiuso (invito a toccarlo)
    if (!this.calm) {
      const pts = frame === 2 ? CHEST_SPARK_OPEN : CHEST_SPARK_SHUT;
      pts.forEach(([sx, sy], i) => {
        const ph = (t / 700 + i * 0.37) % 1; if (ph > 0.35) return;
        const s = ph < 0.18 ? 1 : 2, X = x0 + sx * p, Y = top + sy * p;
        ctx.fillStyle = "#fffbe0";
        ctx.fillRect(X - p * 0.5, Y - p * (s - 0.5), p, p * (s * 2 - 1)); ctx.fillRect(X - p * (s - 0.5), Y - p * 0.5, p * (s * 2 - 1), p);
      });
      if (frame === 0) for (let i = 0; i < 3; i++) { const ph = (t / 1100 + i / 3) % 1, sx = x0 + w * (0.22 + 0.28 * i) + Math.sin(t / 400 + i) * w * 0.04, sy = top - ph * sh * 0.8; ctx.globalAlpha = 1 - ph; ctx.fillStyle = "#ffe9a0"; ctx.fillRect(Math.round(sx), Math.round(sy), p * 1.2, p * 1.2); }
      ctx.globalAlpha = 1;
    }
  }
  coinBurst() {
    const b = this.chestBox; if (!b) return;
    this.parts = this.parts || [];
    for (let i = 0; i < (this.calm ? 8 : 46); i++) this.parts.push({ x: b.cx + (Math.random() - 0.5) * b.w * 0.5, y: b.y + b.h * 0.3, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 130, life: 0.9 + Math.random() * 0.7, t: 0, s: 1.6 + Math.random() * 1.4, ph: Math.random() * 6 });
  }
  drawParts(dt) {
    if (!this.parts?.length) return;
    const { ctx } = this, k = dt / 1000;
    this.parts = this.parts.filter((p) => {
      p.t += k; if (p.t >= p.life) return false;
      p.vy += 300 * k; p.x += p.vx * k; p.y += p.vy * k;
      const wob = Math.abs(Math.cos(p.t * 12 + p.ph)); // la moneta che gira
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 2.5);
      ctx.fillStyle = "#8a5a12"; ctx.fillRect(p.x - (p.s * wob) / 2 - 0.4, p.y - p.s / 2 - 0.4, p.s * wob + 0.8, p.s + 0.8);
      ctx.fillStyle = wob > 0.6 ? "#ffe27a" : "#f2b62e"; ctx.fillRect(p.x - (p.s * wob) / 2, p.y - p.s / 2, p.s * wob, p.s);
      return true;
    });
    ctx.globalAlpha = 1;
  }
  syncAnchors() {
    const pct = (v, m) => `${((v / m) * 100).toFixed(1)}%`;
    this.anchors.forEach((el, id) => {
      const b = id === "chest" ? this.chestBox : this.byId.get(id)?.box; if (!b) return;
      const key = `${b.x | 0},${b.y | 0},${b.w | 0},${b.h | 0}`;
      if (el.dataset.k === key) return;
      el.dataset.k = key;
      el.style.left = pct(b.x, W); el.style.top = pct(b.y, H); el.style.width = pct(b.w, W); el.style.height = pct(b.h, H);
    });
  }
  loop(t) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    if (t - this.last < 32 || document.hidden) return;
    const dt = Math.min(100, t - this.last); this.last = t;
    this.anims = this.anims.filter((a) => { const k = clamp((performance.now() - a.t0) / a.ms, 0, 1); a.fn(k); if (k >= 1) a.res(); return k < 1; });
    if (this.walking) {
      const w = this.walking, p = (performance.now() - w.t0) / w.ms;
      if (p >= w.steps) w.res();
      else { const i = Math.floor(p), k = p - i; this.cam.y = w.from + i + k; this.cam.bob = Math.sin(k * Math.PI) * -3; this.dirty = true; }
    }
    for (const f of this.foes) { if (f.flash > 0) f.flash -= dt; if (f.hp <= 0 && f.die < 1) f.die = Math.min(1, f.die + dt / 520); else if (f.hp > 0) f.die = 0; }
    if (this.dirty) this.render();
    const { ctx } = this;
    ctx.setTransform(FS, 0, 0, FS, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.layoutFoes(t);
    this.drawTorches(); this.drawChest(t); this.drawFoes(t); this.drawBars(); this.drawAim(t); this.drawParts(dt); this.drawHands();
    if (this.red > 0) { ctx.fillStyle = `rgba(190,20,20,${this.red.toFixed(2)})`; ctx.fillRect(0, 0, W, H); this.red = Math.max(0, this.red - dt * 0.0016); }
    this.syncAnchors();
  }
}
