/* LE SEGRETE IN PRIMA PERSONA (2026-11-07): il motore grafico della vista "crawler".
   Disegna soltanto: non conosce le regole, le decide il server; la pagina gli passa i nemici e gli
   dice quando colpire o camminare. Due strati:
   - la STANZA (264×255, canvas di sotto): raggi su una griglia, luce piatta a fasce come nei vecchi
     dungeon. È FERMA: si ridisegna solo camminando o cambiando dungeon, niente tremolii.
   - gli SPRITE (×3, canvas di sopra): mostri e armi nitidi, pixel per pixel, mai sfumati.
   Mappa: stanza larga 9 caselle e profonda 7, corridoio di 3, stanza… (si ripete ogni P caselle).
   Gli sprite veri stanno su Storage e possono non permettere la lettura dei pixel: per questo i mostri
   si disegnano con drawImage (mai getImageData sul canvas) e le varianti si fanno con il compositing. */
import { TILE_THEMES, proceduralHands, tileFromImage } from "./crawlerArt";

export const CW_W = 264, CW_H = 255, CW_FG = 3;
const W = CW_W, H = CW_H, FS = CW_FG, HZ = Math.round(H * 0.4), PL = 0.78, SC = W / 2 / PL, WALLH = 1.9, CAM = 0.56, P = 10, BANDS = 7;
const STEP_MS = 215;
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
    this.foes = []; this.byId = new Map(); this.aim = null; this.anchors = new Map(); this.order = [];
    this.hands = { R: null, L: null }; this.handKey = "";
    this.pose = { swing: 0, cast: 0 };
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
    const out = proceduralHands(spec.main, spec.off);
    const up = async (url) => { const l = url ? await loadImage(url) : null; return l ? l.img : null; };
    const [m, o] = await Promise.all([up(spec.mainUrl), up(spec.offUrl)]);
    if (this.handKey !== key || this.dead) return;
    if (m) { out.R = m; out.big = true; if (spec.off === "mirror") out.L = m; }
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
      f.h = clamp(0.98 * (src.scale || 1), 0.62, 1.7);
      f.hp = src.hp; f.max = src.maxHp; f.state = src.state || "";
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
    f.spr = { lit: c, white: overlay(c, "#fff"), stone: overlay(c, "rgba(120,120,125,.72)"), ice: overlay(c, "rgba(120,200,255,.55)"), ratio: b.w / b.h };
  }
  setAim(id) { this.aim = id || null; }
  bindAnchor(id, el) { if (el) this.anchors.set(id, el); else this.anchors.delete(id); }

  /* ── colpi ── */
  flash(id) { const f = this.byId.get(id); if (f) f.flash = 150; }
  hurt() { this.red = 0.42; }
  anim(ms, fn) {
    if (this.calm) ms = Math.min(ms, 60);
    return new Promise((res) => { this.anims.push({ t0: performance.now(), ms, fn, res }); setTimeout(() => res(), ms + 400); });
  }
  swing() { return this.anim(300, (k) => { this.pose.swing = k >= 1 ? 0 : k; }); }
  cast() { return this.anim(360, (k) => { this.pose.cast = k >= 1 ? 0 : Math.sin(k * Math.PI); }); }
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
        this.put(y * W + x, tex, (wx * s) | 0, (wy * s) | 0, q);
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
      const u = side === 0 ? cam.y + dist : cam.x + dist * rx, tex = dist > 4.5 ? mipOf(T.W) : T.W, ws = tex.size, tx = ((u - Math.floor(u)) * ws) | 0;
      const top = Math.max(0, Math.ceil(hz + ((ch - WALLH) * SC) / dist)), bot = Math.min(H - 1, Math.floor(hz + (ch * SC) / dist));
      const q = band(dist) * (side === 0 ? 0.74 : 1); // i muri di lato un tono più scuri, come una volta
      for (let y = top; y <= bot; y++) {
        const hgt = ch - ((y - hz) * dist) / SC, ty = ((hgt - Math.floor(hgt)) * ws) | 0;
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
  drawFoes() {
    const { ctx, zbuf } = this;
    for (const { f, dz } of this.order) {
      if (!f.spr || !f.box || f.die >= 1) continue;
      const b = f.box, src = f.flash > 0 ? f.spr.white : f.state === "stone" ? f.spr.stone : f.state === "ice" ? f.spr.ice : f.spr.lit;
      ctx.globalAlpha = (f.die > 0 ? Math.round((1 - f.die) * 4) / 4 : 1) * 0.42;
      ctx.fillStyle = "#000"; // ombra piatta a terra
      const sw = Math.round(b.w * 0.8), sh = Math.max(2, Math.round((SC / dz) * 0.07));
      ctx.fillRect(Math.round(b.cx - sw / 2), Math.round(b.foot - sh / 2), sw, sh);
      ctx.globalAlpha = f.die > 0 ? Math.round((1 - f.die) * 4) / 4 : 1;
      // solo le colonne non coperte da un pilastro
      const x0 = Math.max(0, Math.floor(b.x)), x1 = Math.min(W, Math.ceil(b.x + b.w));
      let s = -1;
      for (let x = x0; x <= x1; x++) {
        const vis = x < x1 && zbuf[x] >= dz;
        if (vis && s < 0) s = x;
        if (!vis && s >= 0) {
          const a = Math.max(s, b.x), e = Math.min(x, b.x + b.w);
          const u0 = ((a - b.x) / b.w) * src.width, u1 = ((e - b.x) / b.w) * src.width;
          ctx.drawImage(src, u0, 0, u1 - u0, src.height, a, b.y, e - a, b.h);
          s = -1;
        }
      }
    }
    ctx.globalAlpha = 1;
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
      const w = clamp(Math.round(f.box.w * 0.62), 18, 52), x = Math.round(f.box.cx - w / 2), y = Math.max(3, Math.round(f.box.y) - 6);
      ctx.fillStyle = "#000"; ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = f.hp / f.max < 0.3 ? "#ff7a5c" : "#c8303a"; ctx.fillRect(x, y, Math.max(1, Math.round((w * f.hp) / Math.max(1, f.max))), 3);
      if (f.id === this.aim) {
        ctx.fillStyle = "#f2c14e"; const ax = Math.round(f.box.cx), ay = Math.max(0, y - 8);
        for (let i = 0; i < 4; i++) ctx.fillRect(ax - 3 + i, ay + i, 7 - i * 2, 1);
      }
    }
  }
  drawHands() {
    const { ctx, hands, pose, cam } = this, k = W / 240, b = Math.round(cam.bob * 1.1);
    // stessa misura per tutte e due le mani: i disegni sono fatti in scala uguale
    const size = H * 0.66;
    const dims = (s) => { const w = s.naturalWidth || s.width, h = s.naturalHeight || s.height; return [size * (w / h), size]; };
    if (hands.L) {
      const [w, h] = dims(hands.L);
      ctx.save();
      ctx.translate(0, H - h + 4 + b - pose.cast * 16);
      if (hands.mirrorL) { ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(hands.L, 0, 0, w, h);
      ctx.restore();
    }
    if (hands.R) {
      const [w, h] = dims(hands.R), a = Math.sin(pose.swing * Math.PI);
      ctx.save();
      ctx.translate(W, H + 4 + b - pose.cast * 12);
      ctx.rotate(-a * 0.75);
      ctx.translate(-w - a * 46 * k, -h - a * 30 * k);
      ctx.drawImage(hands.R, 0, 0, w, h);
      ctx.restore();
    }
  }
  syncAnchors() {
    const pct = (v, m) => `${((v / m) * 100).toFixed(1)}%`;
    this.anchors.forEach((el, id) => {
      const b = this.byId.get(id)?.box; if (!b) return;
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
    this.drawTorches(); this.drawFoes(); this.drawBars(); this.drawHands();
    if (this.red > 0) { ctx.fillStyle = `rgba(190,20,20,${this.red.toFixed(2)})`; ctx.fillRect(0, 0, W, H); this.red = Math.max(0, this.red - dt * 0.0016); }
    this.syncAnchors();
  }
}
