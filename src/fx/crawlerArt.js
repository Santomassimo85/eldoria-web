/* Disegni della vista in prima persona (2026-11-07).
   - TILE_THEMES: pareti, pavimento e soffitto di riserva, generati da codice, uno per dungeon.
   - proceduralHands: armi di riserva, finché dall'admin non si genera l'arma vera.
   - prompt e pulizia per l'IA: mostri FRONTALI, tessere ripetibili, armi viste da chi le impugna.
   L'art generata sta in dungeon_tiles/{dungeon} {wall, floor, ceil} e dungeon_tiles/hand_{arma} {image}
   come data URL (si legge coi pixel, cosa che le immagini di Storage possono non permettere);
   i frontali stanno in dungeon_monsters/{id}.frontImageUrl: la vista classica non li usa. */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s) { // rumore morbido che si ripete ogni 64 pixel
  const n = 64 / s, gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const v = (a, b) => hash(((a % n) + n) % n, ((b % n) + n) % n);
  const t = fx * fx * (3 - 2 * fx), u = fy * fy * (3 - 2 * fy);
  return (v(x0, y0) * (1 - t) + v(x0 + 1, y0) * t) * (1 - u) + (v(x0, y0 + 1) * (1 - t) + v(x0 + 1, y0 + 1) * t) * u;
}
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ── tessere di riserva ── */
function tile(fn) {
  const size = 64, rgb = new Uint8Array(size * size * 3), em = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = fn(x, y), i = y * size + x;
    rgb[i * 3] = clamp(r[0], 0, 255); rgb[i * 3 + 1] = clamp(r[1], 0, 255); rgb[i * 3 + 2] = clamp(r[2], 0, 255);
    em[i] = r[3] ? 1 : 0;
  }
  return { size, mask: size - 1, rgb, em };
}
function bricks(p, bw, bh, extra) {
  const [a, b, c] = p.map(hex);
  return tile((x, y) => {
    const row = Math.floor(y / bh), off = (row % 2) * (bw / 2), col = Math.floor((x + off) / bw) % (64 / bw);
    const lx = (x + off) % bw, ly = y % bh, n = hash(col + 3, row + 9);
    if (lx < 1 || ly < 1) return a.map((v) => v * 0.55);
    let k = 0.25 + n * 0.5 + (vnoise(x, y, 8) - 0.5) * 0.45 + (hash(x, y) - 0.5) * 0.16;
    if (ly === 1 || lx === 1) k += 0.28;
    if (ly === bh - 1 || lx === bw - 1) k -= 0.22;
    const c3 = k < 0.5 ? mix(a, b, clamp(k * 2, 0, 1)) : mix(b, c, clamp(k * 2 - 1, 0, 1));
    return extra ? extra(x, y, c3) : c3;
  });
}
function rock(p, cells, extra) {
  const [a, b, c] = p.map(hex);
  const pts = Array.from({ length: cells }, (_, i) => [hash(i, 1) * 64, hash(i, 2) * 64, hash(i, 3)]);
  return tile((x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (const q of pts) for (let ox = -64; ox <= 64; ox += 64) for (let oy = -64; oy <= 64; oy += 64) {
      const dd = Math.hypot(x - q[0] - ox, y - q[1] - oy);
      if (dd < d1) { d2 = d1; d1 = dd; id = q[2]; } else if (dd < d2) d2 = dd;
    }
    const edge = d2 - d1;
    let k = 0.2 + id * 0.55 + (vnoise(x, y, 8) - 0.5) * 0.4 + (hash(x, y) - 0.5) * 0.12 - d1 * 0.008;
    if (edge < 1.6) k = 0.02; else if (edge < 3) k += 0.2;
    const c3 = k < 0.5 ? mix(a, b, clamp(k * 2, 0, 1)) : mix(b, c, clamp(k * 2 - 1, 0, 1));
    return extra ? extra(x, y, c3, edge) : c3;
  });
}
const moss = (x, y, c3) => (vnoise(x, y, 16) > 0.58 ? mix(c3, [46, 92, 40], 0.65) : c3);
const lava = (x, y, c3, edge) => (edge < 1.7 && vnoise(x, y, 16) > 0.5 ? [255, 110 + hash(x, y) * 100, 30, 1] : c3);
export const TILE_THEMES = {
  segrete: { wall: () => bricks([0x24242e, 0x4f5163, 0x8f93a8], 32, 16), floor: () => bricks([0x1c1c24, 0x3c3d4b, 0x666878], 32, 32), ceil: () => rock([0x101016, 0x24242e, 0x3a3a48], 10), amb: 0.5, tint: [1.05, 0.95, 0.82], flame: 0xffa040 },
  caverna: { wall: () => rock([0x1d140e, 0x4c3525, 0x8a6a4c], 12), floor: () => rock([0x17100b, 0x3d2c20, 0x6a5240], 16), ceil: () => rock([0x0f0a07, 0x2a1d14, 0x46321f], 9), amb: 0.42, tint: [1.08, 0.95, 0.78], flame: 0xffb050 },
  magma: { wall: () => rock([0x120a0a, 0x33201d, 0x5a3a30], 11, lava), floor: () => rock([0x0f0808, 0x2c1a18, 0x4c2f28], 13, lava), ceil: () => rock([0x0c0606, 0x241412, 0x3a2420], 8), amb: 0.55, tint: [1.2, 0.8, 0.62], flame: 0xff6a20 },
  ghiaccio: { wall: () => rock([0x1d3a58, 0x4a80a8, 0x9fcfe8], 9), floor: () => rock([0x1f3e5c, 0x55899f, 0xa8d4e8], 12), ceil: () => rock([0x12263c, 0x2c5272, 0x5c94b8], 8), amb: 0.42, tint: [0.84, 0.96, 1.16], flame: 0x9fdcff },
  palude: { wall: () => bricks([0x151d14, 0x37452f, 0x667055], 32, 16, moss), floor: () => rock([0x0f1a12, 0x2b3d27, 0x4e6240], 14), ceil: () => rock([0x0b120c, 0x1d2a1b, 0x33432c], 9), amb: 0.48, tint: [0.88, 1.08, 0.74], flame: 0xb8e060 },
  tempio: { wall: () => bricks([0x4a3618, 0x9a7a44, 0xdcbf80], 32, 32), floor: () => bricks([0x3c2c14, 0x7f6236, 0xba9c64], 16, 16), ceil: () => bricks([0x281c0e, 0x5a4425, 0x8a6c3e], 32, 16), amb: 0.6, tint: [1.1, 0.96, 0.76], flame: 0xffc060 },
};
// un'immagine già quadrata e leggibile → tessera per il motore
export function tileFromImage(img, size = 128) {
  const c = document.createElement("canvas"); c.width = size; c.height = size;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, size, size);
  const d = g.getImageData(0, 0, size, size).data, rgb = new Uint8Array(size * size * 3);
  for (let i = 0; i < size * size; i++) { rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2]; }
  return { size, mask: size - 1, rgb, em: null };
}

/* ── armi di riserva, disegnate a pixel ── */
function Spr(w, h) {
  const a = new Int32Array(w * h);
  const s = {
    p(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = c | 0x1000000; return s; },
    ell(cx, cy, rx, ry, c) { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.1) + (y * y) / (ry * ry + 0.1) <= 1) s.p(cx + x, cy + y, c); return s; },
    rect(x, y, ww, hh, c) { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) s.p(x + i, y + j, c); return s; },
    line(x0, y0, x1, y1, t, c) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 || 1; for (let i = 0; i <= n; i++) { const k = i / n, tt = typeof t === "function" ? t(k) : t; s.ell(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, tt / 2, tt / 2, c); } return s; },
    done() { // luce dall'alto a sinistra e contorno scuro
      const b = a.slice(), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : b[y * w + x]);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"), id = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = b[y * w + x], o = (y * w + x) * 4;
        if (!v) { if (at(x + 1, y) || at(x - 1, y) || at(x, y + 1) || at(x, y - 1)) { id.data[o] = 10; id.data[o + 1] = 6; id.data[o + 2] = 8; id.data[o + 3] = 255; } continue; }
        const k = !at(x, y - 1) || !at(x - 1, y) ? 1.28 : !at(x, y + 1) || !at(x + 1, y) ? 0.66 : 1, [r, gg, bl] = hex(v & 0xffffff);
        id.data[o] = Math.min(255, r * k); id.data[o + 1] = Math.min(255, gg * k); id.data[o + 2] = Math.min(255, bl * k); id.data[o + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      return c;
    },
  };
  return s;
}
const STEEL = 0xc4ccd8, STEEL2 = 0x7f8896, LEATHER = 0x5a3a24, GOLD = 0xc9a040, WOOD = 0x6a4526, SKIN = 0xd8b090, GLOVE = 0x8a92a0, SLEEVE = 0x5a6270;
const arm = (s, hx, hy, sleeve = SLEEVE, glove = GLOVE) => { s.line(hx + 12, hy + 12, 142, 140, (k) => 16 + k * 16, sleeve); s.ell(hx, hy, 11, 10, glove); s.ell(hx + 4, hy - 2, 7, 6, glove); return s; };
const blade = (s, wide = 13) => { s.line(82, 78, 30, 8, (k) => wide - k * (wide - 4), STEEL).line(80, 74, 33, 10, 2, 0xf0f4fa).line(84, 80, 42, 24, 2, STEEL2); };
const DRAW = {
  spada_lunga: (s) => { arm(s, 88, 90); s.line(84, 88, 96, 104, 6, LEATHER).line(70, 88, 96, 72, 6, GOLD); blade(s); },
  scimitarra: (s) => { arm(s, 88, 90, 0x4a3a2e, 0x6a5240); s.line(70, 88, 94, 74, 5, GOLD); for (let i = 0; i < 40; i++) { const k = i / 39; s.ell(82 - k * 52 - Math.sin(k * 3.14) * 12, 78 - k * 70 + Math.sin(k * 3.14) * 6, 5 - k * 3, 5 - k * 3, STEEL); } },
  stocco: (s) => { arm(s, 90, 92, 0x4a3a50, 0x6a5a70); s.ell(84, 86, 11, 9, GOLD).line(82, 80, 34, 4, (k) => 6 - k * 4, STEEL).line(80, 76, 36, 6, 1, 0xf0f4fa); },
  ascia_bip: (s) => { arm(s, 92, 96, 0x6a3a2a, SKIN); s.line(100, 114, 62, 22, 7, WOOD).ell(46, 26, 19, 21, STEEL).ell(80, 16, 16, 18, STEEL2).ell(38, 26, 8, 16, 0xf0f4fa); },
  martello: (s) => { arm(s, 90, 92); s.line(94, 100, 62, 32, 6, LEATHER).rect(36, 12, 46, 26, STEEL2).rect(36, 12, 46, 6, STEEL); },
  maglio: (s) => { arm(s, 92, 96, 0x6a3a2a, SKIN); s.line(100, 116, 62, 30, 8, WOOD).rect(28, 4, 62, 34, STEEL2).rect(28, 4, 62, 7, STEEL).rect(26, 16, 66, 5, GOLD); },
  mazza: (s) => { arm(s, 90, 92, 0xcfc7b0); s.line(92, 96, 62, 34, 6, LEATHER).ell(56, 22, 14, 14, STEEL2); [[40, 22], [72, 22], [56, 6], [45, 10], [67, 10], [46, 34], [66, 34]].forEach(([x, y]) => s.ell(x, y, 3, 3, STEEL)); },
  mazzafrusto: (s) => { arm(s, 90, 92); s.line(92, 96, 72, 56, 6, LEATHER); for (let i = 0; i < 6; i++) s.ell(70 - i * 3, 50 - i * 4, 2, 2, STEEL2); s.ell(50, 22, 13, 13, STEEL2); [[36, 22], [64, 22], [50, 7], [40, 12], [60, 12]].forEach(([x, y]) => s.ell(x, y, 3, 3, STEEL)); },
  bastone: (s) => { s.line(100, 121, 66, 14, 6, WOOD); arm(s, 90, 92, 0x2c3f8a, SKIN); s.ell(63, 12, 9, 10, 0x6fb4ff).ell(61, 9, 3, 3, 0xe0f4ff).line(54, 22, 72, 19, 3, GOLD); },
  lancia: (s) => { s.line(104, 121, 62, 22, 5, WOOD); arm(s, 92, 94, 0x4a5a3a, SKIN); s.line(62, 24, 48, 2, (k) => 11 - k * 9, STEEL).line(56, 26, 70, 22, 3, GOLD); },
  arco_lungo: (s) => { for (let i = 0; i < 60; i++) { const k = i / 59; s.ell(58 + Math.sin(k * 3.14) * 22, 2 + k * 118, 3, 3, WOOD); } s.line(58, 2, 58, 120, 1, 0xe8e0d0).line(112, 62, 34, 62, 2, 0xc8b890).line(44, 58, 34, 62, 3, STEEL); arm(s, 84, 66, 0x3f6a4a, SKIN); },
  balestra_l: (s) => { s.line(106, 110, 54, 44, 8, WOOD); for (let i = 0; i < 40; i++) { const k = i / 39; s.ell(26 + k * 66, 58 - Math.sin(k * 3.14) * 16 + k * -12, 2, 2, STEEL2); } s.line(26, 58, 92, 46, 1, 0xe8e0d0); arm(s, 96, 100, 0x2c3f8a, SKIN); },
  pugni: (s) => { s.line(102, 104, 142, 140, (k) => 18 + k * 14, SKIN); s.ell(86, 86, 20, 19, SKIN); for (let i = 0; i < 4; i++) s.line(70 + i * 9, 74, 72 + i * 9, 92, 7, 0xc89a78); s.ell(80, 100, 8, 6, 0xc89a78); },
};
function offHand(kind) {
  const s = Spr(130, 122);
  if (kind === "shield") {
    s.ell(38, 96, 56, 58, 0x7a1f24).ell(38, 96, 47, 49, 0x3a3238).ell(38, 96, 42, 44, 0x7a1f24).rect(33, 66, 10, 56, 0xdfe6f0).rect(10, 84, 56, 10, 0xdfe6f0);
  } else { // mano aperta da incantatore: la riserva disegna anche la fiamma
    s.line(100, 104, 142, 140, (k) => 16 + k * 16, 0x2c3f8a).ell(92, 96, 12, 11, SKIN);
    for (let i = 0; i < 4; i++) s.line(86 + i * 5, 90, 76 + i * 7, 72 + (i === 0 ? 8 : 0), 4, SKIN);
    s.ell(82, 60, 7, 10, 0xff8a34).ell(82, 63, 3, 5, 0xffe0a0);
  }
  return s.done();
}
const cacheR = {};
export function proceduralHands(main, off) {
  const key = DRAW[main] ? main : "spada_lunga";
  if (!cacheR[key]) { const s = Spr(130, 122); DRAW[key](s); cacheR[key] = s.done(); }
  const R = cacheR[key];
  if (off === "none") return { R, L: null };
  if (off === "mirror") return { R, L: R, mirrorL: true };
  const k = `off:${off}`;
  if (!cacheR[k]) cacheR[k] = offHand(off);
  return { R, L: cacheR[k], mirrorL: off !== "shield" };
}

/* quali mani vede un eroe. Due mani = nessun oggetto a sinistra; scudo se lo porta; chi lancia
   incantesimi tiene la mano libera; gli altri impugnano due armi uguali. */
const CASTERS = new Set(["wizard", "sorcerer", "warlock", "druid", "cleric", "bard", "paladin"]);
export function handSpec(hero, weaponKey, twoHanded) {
  if (hero?.gear?.shield) return { main: weaponKey, off: "shield" };
  if (twoHanded) return { main: weaponKey, off: "none" };
  if (CASTERS.has(hero?.cls)) return { main: weaponKey, off: "magic" };
  return { main: weaponKey, off: "mirror" };
}

/* ── prompt per l'IA ── */
const BG = "CRITICAL: render the subject ALONE on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). One flat magenta color: no gradient, no ground shadow, no scenery. No text, no frame, no border. Do NOT use magenta, pink or purple anywhere on the subject, and no glow, aura, halo, smoke or particles around it: the outline must be a clean dark line directly against the flat magenta.";
const STYLE = "Style: crisp 16-bit pixel art like a classic 1990s first-person dungeon RPG, limited palette, clean hard outlines, NO anti-aliasing, NO blur.";

export const frontPrompt = (name, desc, withRef) => `Pixel art sprite of a single fantasy monster for a first-person dungeon crawler: the player stands in front of it and looks straight at it.
${withRef ? "The attached image is this EXACT creature seen from another angle. Keep the SAME individual: species, anatomy, colors, armor, clothes and weapons, same pixel-art style." : ""}
Subject: ${name || "fantasy monster"}.${desc ? ` Description: ${desc}.` : ""}
Pose: FULL BODY, strictly FRONT VIEW, facing the viewer straight on, chest and face turned to the camera, symmetrical stance, feet on the bottom of the image, menacing, ready to attack. NOT in profile, NOT three-quarter view.
${STYLE}
${BG}`;

const TILE_WHAT = {
  wall: "a dungeon WALL surface seen perfectly straight on",
  floor: "a dungeon FLOOR surface seen from directly above",
  ceil: "a dungeon CEILING surface seen from directly below, darker than the walls",
};
export const tilePrompt = (d, slot, idea) => `Seamless tileable square texture for a first-person dungeon crawler: ${TILE_WHAT[slot]}.
Setting: ${d.name}${d.desc ? ` — ${d.desc}` : ""}.${idea ? ` Details: ${idea}.` : ""}
The texture MUST tile perfectly: left edge matches right edge, top edge matches bottom edge. Completely flat and orthographic: NO perspective, NO vanishing point, NO horizon, no lighting direction, no vignette, even brightness across the whole image.
Style: crisp 16-bit pixel art like a classic 1990s dungeon RPG, chunky visible pixels, limited palette, NO anti-aliasing, NO blur. Only the surface: no characters, no objects, no text, no frame.`;

const HAND_WHAT = {
  shield: "a LEFT arm in armor entering from the BOTTOM-LEFT corner of the image, holding up a round fantasy shield seen from the front, covering the lower left",
  magic: "a LEFT open hand with sleeve entering from the BOTTOM-LEFT corner of the image, palm up, fingers spread, ready to cast a spell, no flame",
};
export const handPrompt = (key, weaponName) => `First-person view pixel art sprite for a dungeon crawler, as seen through the eyes of the hero.
Subject: ${HAND_WHAT[key] || `a RIGHT hand and forearm entering from the BOTTOM-RIGHT corner of the image, gripping a ${weaponName}. The weapon points UP and slightly to the LEFT, large in the frame, like a classic first-person RPG`}.
The arm MUST touch the corner of the image and be cut off by the image border. Nothing else in the image.
${STYLE}
${BG}`;

// tessera dall'IA → 128×128 che si ripete senza righe: i bordi si fondono col lato opposto
export function bakeTile(dataUrl, size = 128, blend = 10) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = size; c.height = size;
      const g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, size, size);
      const id = g.getImageData(0, 0, size, size), d = id.data, src = d.slice();
      const mixEdge = (i, j, k) => { for (let n = 0; n < 3; n++) d[i * 4 + n] = src[i * 4 + n] * (1 - k) + src[j * 4 + n] * k; };
      for (let y = 0; y < size; y++) for (let e = 0; e < blend; e++) { const k = (1 - e / blend) * 0.5; mixEdge(y * size + e, y * size + size - 1 - e, k); mixEdge(y * size + size - 1 - e, y * size + e, k); }
      src.set(d);
      for (let x = 0; x < size; x++) for (let e = 0; e < blend; e++) { const k = (1 - e / blend) * 0.5; mixEdge(e * size + x, (size - 1 - e) * size + x, k); mixEdge((size - 1 - e) * size + x, e * size + x, k); }
      g.putImageData(id, 0, 0);
      res(c.toDataURL("image/png"));
    };
    img.onerror = () => rej(new Error("Immagine non leggibile."));
    img.src = dataUrl;
  });
}
