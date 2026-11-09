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
  pugnali: (s) => { arm(s, 90, 96, 0x4a3a2e, 0x6a5240); s.line(88, 92, 66, 51, (k) => 9 - k * 7, STEEL).line(78, 88, 91, 80, 4, GOLD); },
  stocco: (s) => { arm(s, 90, 92, 0x4a3a50, 0x6a5a70); s.ell(84, 86, 11, 9, GOLD).line(82, 80, 34, 4, (k) => 6 - k * 4, STEEL).line(80, 76, 36, 6, 1, 0xf0f4fa); },
  ascia_bip: (s) => { arm(s, 92, 96, 0x6a3a2a, SKIN); s.line(100, 114, 62, 22, 7, WOOD).ell(46, 26, 19, 21, STEEL).ell(80, 16, 16, 18, STEEL2).ell(38, 26, 8, 16, 0xf0f4fa); },
  martello: (s) => { arm(s, 90, 92); s.line(94, 100, 62, 32, 6, LEATHER).rect(36, 12, 46, 26, STEEL2).rect(36, 12, 46, 6, STEEL); },
  maglio: (s) => { arm(s, 92, 96, 0x6a3a2a, SKIN); s.line(100, 116, 62, 30, 8, WOOD).rect(28, 4, 62, 34, STEEL2).rect(28, 4, 62, 7, STEEL).rect(26, 16, 66, 5, GOLD); },
  mazza: (s) => { arm(s, 90, 92, 0xcfc7b0); s.line(92, 96, 62, 34, 6, LEATHER).ell(56, 22, 14, 14, STEEL2); [[40, 22], [72, 22], [56, 6], [45, 10], [67, 10], [46, 34], [66, 34]].forEach(([x, y]) => s.ell(x, y, 3, 3, STEEL)); },
  mazzafrusto: (s) => { arm(s, 90, 92); s.line(92, 96, 72, 56, 6, LEATHER); for (let i = 0; i < 6; i++) s.ell(70 - i * 3, 50 - i * 4, 2, 2, STEEL2); s.ell(50, 22, 13, 13, STEEL2); [[36, 22], [64, 22], [50, 7], [40, 12], [60, 12]].forEach(([x, y]) => s.ell(x, y, 3, 3, STEEL)); },
  bastone: (s) => { s.line(100, 121, 66, 14, 6, WOOD); arm(s, 90, 92, 0x2c3f8a, SKIN); s.ell(63, 12, 9, 10, 0x6fb4ff).ell(61, 9, 3, 3, 0xe0f4ff).line(54, 22, 72, 19, 3, GOLD); },
  lancia: (s) => { s.line(104, 121, 62, 22, 5, WOOD); arm(s, 92, 94, 0x4a5a3a, SKIN); s.line(62, 24, 48, 2, (k) => 11 - k * 9, STEEL).line(56, 26, 70, 22, 3, GOLD); },
  arco_lungo: (s, empty) => { for (let i = 0; i < 60; i++) { const k = i / 59; s.ell(58 + Math.sin(k * 3.14) * 22, 2 + k * 118, 3, 3, WOOD); } s.line(58, 2, 58, 120, 1, 0xe8e0d0); if (!empty) s.line(112, 62, 34, 62, 2, 0xc8b890).line(44, 58, 34, 62, 3, STEEL); arm(s, 84, 66, 0x3f6a4a, SKIN); },
  balestra_l: (s) => { s.line(106, 110, 54, 44, 8, WOOD); for (let i = 0; i < 40; i++) { const k = i / 39; s.ell(26 + k * 66, 58 - Math.sin(k * 3.14) * 16 + k * -12, 2, 2, STEEL2); } s.line(26, 58, 92, 46, 1, 0xe8e0d0); arm(s, 96, 100, 0x2c3f8a, SKIN); },
  pugni: (s) => { s.line(102, 104, 142, 140, (k) => 18 + k * 14, SKIN); s.ell(86, 86, 20, 19, SKIN); for (let i = 0; i < 4; i++) s.line(70 + i * 9, 74, 72 + i * 9, 92, 7, 0xc89a78); s.ell(80, 100, 8, 6, 0xc89a78); },
};
function offHand(kind) {
  const s = Spr(130, 122);
  if (kind === "shield") {
    s.ell(38, 100, 58, 60, 0x55585e).ell(38, 100, 53, 55, 0x6a4526); // bordo di ferro, assi di legno
    for (let i = -48; i <= 48; i += 12) s.line(38 + i, 46, 38 + i, 158, 1, 0x4a2f1a);
    for (const [x, y] of [[0, 72], [76, 72], [6, 132], [72, 132], [38, 46]]) s.ell(x, y, 2, 2, 0xb8bcc4); // ribattini
    s.rect(-6, 82, 88, 9, 0x3a2414).rect(-6, 112, 88, 9, 0x3a2414); // cinghie di cuoio
    s.rect(30, 74, 16, 50, 0x5a3a24).ell(38, 98, 13, 16, 0x8a92a0).ell(34, 92, 6, 6, 0xa8b0bc); // impugnatura e pugno
  } else { // mano semiaperta, come per bilanciare il colpo
    s.line(104, 110, 142, 140, (k) => 14 + k * 10, SLEEVE).ell(94, 100, 13, 12, GLOVE);
    for (let i = 0; i < 4; i++) s.line(86 + i * 6, 94, 78 + i * 7, 84 + Math.abs(i - 1.5) * 3, 5, GLOVE);
    s.line(104, 100, 108, 86, 5, GLOVE);
  }
  return s.done();
}
const cacheR = {};
export function proceduralHands(main, off) {
  const key = DRAW[main] ? main : "spada_lunga";
  if (!cacheR[key]) { const s = Spr(130, 122); DRAW[key](s); cacheR[key] = s.done(); }
  const R = cacheR[key];
  // l'arco appena scoccato: la stessa immagine senza la freccia (2026-11-07)
  const ek = `${key}:empty`;
  if (key === "arco_lungo" && !cacheR[ek]) { const s = Spr(130, 122); DRAW[key](s, true); cacheR[ek] = s.done(); }
  const R0 = cacheR[ek] || null;
  if (off === "none") return { R, R0, L: null };
  if (off === "mirror") return { R, R0, L: R, mirrorL: true };
  const k = `off:${off === "magic" ? "hand" : off}`;
  if (!cacheR[k]) cacheR[k] = offHand(off);
  return { R, R0, L: cacheR[k], mirrorL: off !== "shield" };
}

/* GUANTI PER CLASSE (2026-11-07, richiesta dell'utente): stesse mani per tutte le armi di una classe.
   Le mani di una classe si generano partendo dalla sua mano sinistra semiaperta (immagine di
   riferimento), così guanto, misura e tratto restano uguali. Chiave: hand_{voce}__{guanto}. */
export const GLOVES = {
  gauntlet: { name: "Guanti d'arme", icon: "🛡", desc: "an articulated steel plate gauntlet with a short steel cuff", classes: ["fighter", "paladin", "cleric"] },
  leather: { name: "Guanti di pelle", icon: "🧤", desc: "a worn brown leather glove with a laced leather bracer", classes: ["barbarian", "ranger", "rogue", "druid", "bard"] },
  wraps: { name: "Bende da monaco", icon: "🥋", desc: "a bare hand wrapped in off-white cloth bandages up to the wrist, monk hand wraps", classes: ["monk"] },
  cloth: { name: "Mani da incantatore", icon: "✋", desc: "a bare hand with the cuff of a dark blue wizard robe sleeve at the wrist, a simple ring", classes: ["wizard", "sorcerer"],
    focus: "an arcane focus: a glowing blue crystal orb or a large faceted magic gem, held up in the open palm" },
  pact: { name: "Mani del patto", icon: "💀", desc: "a pale bare hand with the cuff of a black and deep purple robe sleeve at the wrist, a dark iron ring", classes: ["warlock"],
    focus: "a warlock's focus: a small human skull with faint violet light in the eye sockets, or a large dark violet gem, held in the open palm" },
};
export const gloveOf = (cls) => Object.keys(GLOVES).find((g) => GLOVES[g].classes.includes(cls)) || "leather";
export const handDoc = (key, glove) => `hand_${key}__${glove}`;
// UNO sprite per arma con TUTTE E DUE le mani (2026-11-07, idea dell'utente): off = hand (sinistra libera) · shield · none (due mani)
export const pairKey = (weapon, off) => `${weapon}~${off}`;
/* quali mani vede un eroe: l'arma a una mano sempre a destra; a sinistra lo scudo SOLO se lo
   impugna, altrimenti la mano semiaperta; le armi a due mani le tengono tutte e due. */
// armi che una classe tiene SEMPRE a due mani anche se di solito ne basta una
const TWO_FOR = { monk: ["bastone"] };
export const twoHandedFor = (cls, weaponKey, twoHanded) => !!twoHanded || (TWO_FOR[cls] || []).includes(weaponKey);
export function handSpec(hero, weaponKey, twoHandedWeapon) {
  const glove = gloveOf(hero?.cls), twoHanded = twoHandedFor(hero?.cls, weaponKey, twoHandedWeapon);
  if ((weaponKey === "pugnali" || weaponKey === "pugni")) return { main: weaponKey, off: "mirror", glove };
  if (twoHanded || hero?.twoHand) return { main: weaponKey, off: "none", glove };
  if (hero?.gear?.shield) return { main: weaponKey, off: "shield", glove };
  return { main: weaponKey, off: "hand", glove };
}
/* la lista per l'admin: per ogni guanto la mano sinistra, lo scudo (se quelle classi lo portano),
   le armi delle sue classi e le armi speciali fatte su quelle armi */
export function handEntries({ WEAPONS, WEAPON_CHOICES, TWO_HANDED, ITEMS, armorProf, canTwoHand = () => false }) {
  const out = [];
  Object.entries(GLOVES).forEach(([glove, g]) => {
    const weapons = [...new Set(g.classes.flatMap((c) => WEAPON_CHOICES[c] || []))];
    // con lo scudo: solo le armi a una mano di classi che lo possono portare
    const withShield = new Set(g.classes.filter((c) => armorProf(c).shield).flatMap((c) => WEAPON_CHOICES[c] || []).filter((k) => !g.classes.some((c) => twoHandedFor(c, k, TWO_HANDED.has(k)))));
    const items = [
      ...weapons.map((k) => ({ item: k, base: k, name: WEAPONS[k].name, icon: WEAPONS[k].icon, weaponName: EN[k] || WEAPONS[k].name })),
      ...Object.entries(ITEMS).filter(([id, it]) => weapons.includes(it.base) && !/_[12]$/.test(id)).map(([id, it]) => ({
        item: id, base: it.base, name: it.name, icon: it.icon, special: true, desc: it.desc, ...(it.look ? { look: it.look } : {}), weaponName: `magic ${EN[it.base] || WEAPONS[it.base].name} named "${it.name}"`,
      })),
    ];
    items.forEach((it) => {
      // a due mani: le armi a due mani, e quelle che le classi di questo guanto tengono sempre a due mani
      const two = g.classes.some((c) => twoHandedFor(c, it.base, TWO_HANDED.has(it.base)));
      out.push({ ...it, glove, kind: "pair", two, off: (it.base === "pugnali" || it.base === "pugni") ? "mirror" : two ? "none" : "hand", key: pairKey(it.item, (it.base === "pugnali" || it.base === "pugni") ? "mirror" : two ? "none" : "hand") });
      if (withShield.has(it.base)) out.push({ ...it, glove, kind: "pair", two: false, off: "shield", key: pairKey(it.item, "shield") });
      // presa a due mani (armi versatili): lo sprite con tutte e due le mani sull'arma
      if (!two && g.classes.some((c) => canTwoHand(c, it.base))) out.push({ ...it, glove, kind: "pair", two: true, off: "none", key: pairKey(it.item, "none") });
    });
  });
  return out;
}

/* ARMATURE SPECIALI IN PRIMA PERSONA (2026-11-08): in prima persona si vedono avambracci e mani;
   un'armatura con `look` (aspetto di maniche e guanti, in inglese) ha le sue mani: per ogni arma delle
   classi che la possono portare, lo stesso sprite con il guanto «a-<idArmatura>». La lotta le cerca
   prima di quelle del guanto di classe (armorGlove). */
export const armorGlove = (itemId) => `a-${itemId}`;
export function armorHandEntries(itemId, it, { WEAPONS, WEAPON_CHOICES, TWO_HANDED, gearUsers, armorProf, canTwoHand = () => false }) {
  if (!it || it.kind !== "armor" || !it.look) return [];
  const glove = armorGlove(itemId), out = [], seen = new Set();
  gearUsers(it).forEach((cls) => {
    (WEAPON_CHOICES[cls] || []).forEach((k) => {
      const base = { item: k, base: k, name: WEAPONS[k].name, icon: WEAPONS[k].icon, weaponName: EN[k] || WEAPONS[k].name, glove, gloveDesc: it.look, baseGlove: gloveOf(cls), kind: "pair", armor: itemId };
      const two = twoHandedFor(cls, k, TWO_HANDED.has(k));
      const push = (off, tw) => { const key = pairKey(k, off); if (seen.has(key)) return; seen.add(key); out.push({ ...base, two: tw, off, key }); };
      push((k === "pugnali" || k === "pugni") ? "mirror" : two ? "none" : "hand", two);
      if (!two && armorProf(cls).shield) push("shield", false);
      if (!two && canTwoHand(cls, k)) push("none", true);
    });
  });
  return out;
}

const DMG_IT = { fire: "fuoco", cold: "gelo", poison: "veleno", radiant: "luce sacra", necrotic: "necrotico", lightning: "fulmine", acid: "acido", psychic: "psichico", thunder: "tuono", bludgeoning: "contundente", piercing: "perforante", slashing: "tagliente" };
export function weaponEffectsText(it, w) {
  const fx = it?.fx || {}, out = [];
  if (w) out.push(`${w.dice} ${DMG_IT[w.dmg] || w.dmg}`);
  if (it?.plus) out.push(`+${it.plus} magica`);
  if (fx.extra) out.push(`+${fx.extra[0]} danni da ${DMG_IT[fx.extra[1]] || fx.extra[1]}`);
  if (fx.burn) out.push("può bruciare il bersaglio");
  if (fx.poison) out.push("può avvelenare il bersaglio");
  if (fx.slow) out.push("può rallentare il bersaglio");
  if (fx.stun) out.push("può stordire il bersaglio");
  if (fx.drain) out.push("cura chi la impugna");
  if (fx.crit) out.push("colpi critici più facili");
  if (fx.multi) out.push("a volte colpisce due volte");
  return out.join(", ");
}

/* ── prompt per l'IA ── */
const BG = "CRITICAL: render the subject ALONE on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). One flat magenta color: no gradient, no ground shadow, no scenery. No text, no frame, no border. Do NOT use magenta, pink or purple anywhere on the subject, and no glow, aura, halo, smoke or particles around it: the outline must be a clean dark line directly against the flat magenta.";
const STYLE = "Style: crisp 16-bit pixel art like a classic 1990s first-person dungeon RPG, limited palette, clean hard outlines, NO anti-aliasing, NO blur.";

const SIZE_EN = { tiny: "a tiny creature", small: "a small creature", large: "a large, massive creature", huge: "a huge, towering creature", gargantuan: "a colossal creature" };
export const frontPrompt = (name, desc, withRef, size) => `Pixel art sprite of a single fantasy monster for a first-person dungeon crawler: the player stands in front of it and looks straight at it.
${withRef ? "The attached image shows this EXACT creature in a THREE-QUARTER view. Redraw the SAME individual (species, anatomy, colors, armor, clothes, weapons, pixel style) but rotated to face the camera head-on. Do NOT copy the reference pose." : ""}
Subject: ${name || "fantasy monster"}${SIZE_EN[size] ? `, ${SIZE_EN[size]}` : ""}.${desc ? ` Description: ${desc}.` : ""}
Pose: FULL BODY, strictly FRONT VIEW, facing the viewer straight on, chest and face turned to the camera, symmetrical stance, feet on the bottom of the image, menacing, ready to attack. NOT in profile, NOT three-quarter view.
${STYLE}
${BG}`;

const TILE_WHAT = {
  wall: "a dungeon WALL surface seen perfectly straight on",
  floor: "a dungeon FLOOR surface seen from directly above",
  ceil: "a dungeon CEILING surface seen from directly below, darker than the walls",
};
/* MATERIALI PER DUNGEON (2026-11-07): prima la richiesta diceva solo nome e descrizione (che parla
   di mostri, non di muri) e le tessere uscivano tutte uguali, pietra grigia. Ora ogni dungeon ha il suo
   materiale per parete/pavimento/soffitto e la sua tavolozza; i dungeon nuovi lo deducono dalle parole
   del nome e della descrizione (ghiaccio, lava, palude, sabbia, ossa, cristallo, fogna…). Si può
   sempre scrivere il materiale a mano nel dungeon (campo `tiles`). */
const MATERIALS = [
  { re: /segret|prigion|cella|celle|carcer|fortezz|castell/, colors: "cold grey and blue-grey stone, dark mortar, rusty iron", wall: "square-cut grey stone blocks with dark mortar, rusty iron rings and chain marks, damp stains", floor: "worn grey flagstones with cracks, puddles and scattered straw", ceil: "rough dark stone vault with heavy wooden beams and cobwebs" },
  { re: /magma|lava|vulcan|fuoco|fiamm|brace|infern|fornac/, colors: "black basalt, deep reds and glowing orange", wall: "black volcanic basalt with glowing orange lava cracks and veins", floor: "cracked black obsidian and cooled lava crust with glowing seams", ceil: "dark scorched rock with ember-red glowing fissures and soot" },
  { re: /ghiacc|gelo|neve|brina|invern|frozen|\bice\b/, colors: "pale cyan, icy blue and white", wall: "translucent blue glacier ice with deep cracks, frozen bubbles and frost", floor: "smooth frozen ice sheet with snow drifts and frost patterns", ceil: "icy blue rock with hanging icicles and frost" },
  { re: /palud|fango|acquitrin|stagn|marci|bosco|foresta|giungl/, colors: "murky greens, olive and black-brown", wall: "slimy mossy stones and rotting wooden planks covered in moss, vines and mushrooms", floor: "thick black mud with puddles of stagnant water, reeds and roots", ceil: "tangled roots, hanging moss and dripping slime" },
  { re: /tempio|sabbi|desert|piramid|santuari|rovin|culto|sepolt/, colors: "sandstone yellows, gold and dusty ochre", wall: "carved sandstone blocks with faded relief carvings and gold trims", floor: "dusty sandstone floor tiles with sand in the cracks and engraved patterns", ceil: "carved sandstone ceiling with geometric patterns and gold details" },
  { re: /cript|tomb|ossa|ossari|catacomb|cimiter|necro|morti/, colors: "bone white, grey and sickly green", wall: "catacomb walls made of stacked skulls and bones set in grey stone", floor: "cracked tomb slabs with bone fragments and dust", ceil: "low stone vault with skulls in niches and cobwebs" },
  { re: /cristall|gemm|arcan|magic|astral/, colors: "violet, amethyst and glowing cyan", wall: "dark rock studded with glowing violet and cyan crystals", floor: "polished dark stone with crystal shards and engraved arcane runes", ceil: "rock ceiling with clusters of glowing crystals" },
  { re: /fogn|scolo|canal|abiss|marin|sommers|annegat/, colors: "teal, dark green and wet black", wall: "wet green-black brick with algae, barnacles and water stains", floor: "wet stone with shallow water channels and slime", ceil: "dripping arched brick with algae" },
  { re: /cavern|grott|galleri|minier|tana|sottosuol/, colors: "warm browns, ochre and dark umber", wall: "rough natural cave rock, uneven earth-brown stone with mineral veins and roots", floor: "packed earth and gravel with small rocks and pebbles", ceil: "dark cave rock with small stalactites and dripping water" },
];
const plain = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
export const materialOf = (d) => {
  if (d?.tiles && (d.tiles.wall || d.tiles.floor || d.tiles.ceil)) return { colors: d.tiles.colors || "", ...d.tiles };
  const key = plain(d?.key), txt = `${plain(d?.name)} ${plain(d?.desc)}`;
  return MATERIALS.find((m) => m.re.test(key)) || MATERIALS.find((m) => m.re.test(plain(d?.name))) || MATERIALS.find((m) => m.re.test(txt)) || null;
};
export const tilePrompt = (d, slot, idea) => {
  const m = materialOf(d), what = { wall: "walls", floor: "floor", ceil: "ceiling" }[slot];
  return `Seamless tileable square texture for a first-person dungeon crawler: ${TILE_WHAT[slot]}.
Dungeon: "${d.name}"${d.desc ? ` (${d.desc})` : ""}.
MATERIAL (the most important part: this dungeon must NOT look like a generic grey stone dungeon): ${m?.[slot] || `the ${what} that a place called "${d.name}" would really have, with its own materials and colors`}.${m?.colors ? `
Color palette: ${m.colors}.` : ""}${idea ? `
Extra details from the Game Master (follow them): ${idea}.` : ""}
The texture MUST tile perfectly: left edge matches right edge, top edge matches bottom edge. Completely flat and orthographic: NO perspective, NO vanishing point, NO horizon, no lighting direction, no vignette, even brightness across the whole image.
Style: crisp 16-bit pixel art like a classic 1990s dungeon RPG, chunky visible pixels, limited palette, NO anti-aliasing, NO blur. Only the surface itself (details that belong to the surface are fine): no characters, no furniture, no text, no frame.`;
};

const EN = { pugnali: "dagger", spada_lunga: "longsword", scimitarra: "scimitar", stocco: "rapier", martello: "warhammer", mazza: "flanged mace", mazzafrusto: "flail", lancia: "spear", bastone: "quarterstaff", ascia_bip: "double-bladed greataxe", maglio: "great maul", arco_lungo: "longbow", balestra_l: "light crossbow", pugni: "bare fist" };
/* RICHIESTA DELLE MANI (2026-11-07, riscritta): istruzioni semplici e senza contraddizioni.
   Immagine 4:3 divisa in tre: arma QUASI VERTICALE nel terzo destro, centro VUOTO (lì si vedono i
   nemici), mano libera o scudo nel terzo sinistro. Per ogni tipo d'arma: com'è fatta e come si tiene. */
const BLADE = "a straight, symmetric blade; the crossguard is a straight bar exactly PERPENDICULAR to the blade and centered on it; the handle continues the blade in a straight line below the crossguard; a round pommel at the bottom of the handle. The fist closes around the handle just below the crossguard, thumb wrapped around it; the hand never touches the blade";
const BUILD = {
  pugnali: "TWO short straight double-edged steel daggers, one in EACH hand; small crossguards, leather grips; no scimitar, no long sword",
  spada_lunga: BLADE,
  scimitarra: "a curved single-edged blade that curves gently backward; a small straight crossguard perpendicular to the handle; the fist closes around the handle just below the crossguard",
  stocco: `a long thin straight rapier blade; a swept hilt cage of curved bars around the fist; ${BLADE.split("; ").slice(2).join("; ")}`,
  martello: "a straight wooden shaft with a metal warhammer head at the top, the head perpendicular to the shaft; the fist closes around the shaft in its lower half",
  mazza: "a straight shaft with a flanged metal mace head at the top; the fist closes around the shaft in its lower half",
  mazzafrusto: "a short straight handle; a spiked iron ball hangs from a short chain fixed to the top of the handle; the fist closes around the handle",
  lancia: "a long straight wooden spear shaft with a leaf-shaped steel point at the top; the fist closes around the shaft at about one third of its length; the point stays inside the image",
  bastone: "a long straight iron-shod wooden quarterstaff with metal caps at both ends; the fist closes around it at about one third of its length; the top end stays inside the image",
  ascia_bip: "a long straight wooden shaft with a double-bladed axe head at the top, the head perpendicular to the shaft; BOTH fists on the shaft, one above the other",
  maglio: "a long straight wooden shaft with a big rectangular hammer head at the top, the head perpendicular to the shaft; BOTH fists on the shaft, one above the other",
  arco_lungo: "the archer's own view while drawing the bow, like a modern first-person RPG. The LEFT arm reaches forward from the BOTTOM-LEFT corner; the LEFT fist grips the handle of a wooden longbow just below the center of the image. The bow is CANTED diagonally: its upper limb goes up toward the upper-RIGHT, its lower limb down toward the bottom-left, both tips visible inside the image. An arrow is NOCKED and rests on the knuckles of the left fist; the arrow points FORWARD, toward the CENTER of the image and the horizon, slightly foreshortened, NOT upward. The RIGHT hand, at the BOTTOM-CENTER close to the viewer, holds the string drawn back with fingers on the nock; the taut string runs diagonally from the right hand up to the upper tip of the bow",
  balestra_l: "a light crossbow seen from behind, pointing forward away from the viewer; the RIGHT hand on the stock with a finger near the trigger, the LEFT hand supporting the front of the stock from below; a bolt is loaded",
  pugni: "no weapon: both fists clenched and raised in a boxing guard",
};
const WHERE = {
  arco_lungo: "Bow and hands fill the lower half and the right side of the image; the arrow tip reaches the center, the upper-left and upper-center stay empty.",
  balestra_l: "The crossbow sits low in the lower half of the image, so the upper CENTER stays empty.",
  pugni: "The LEFT fist in the LEFT third, the RIGHT fist in the RIGHT third, the CENTER stays EMPTY.",
};
// e = voce di handEntries. Nessuna immagine di riferimento: l'IA la ricopiava dentro lo sprite.
export function handPrompt(e) {
  const glove = e.gloveDesc || GLOVES[e.glove]?.desc || GLOVES.leather.desc;
  const gk = GLOVES[e.glove] ? e.glove : e.baseGlove;
  const weapon = `${e.weaponName}${e.look ? ` — its look: ${e.look}` : e.desc ? ` (${e.desc})` : ""}`;
  const build = BUILD[e.base] ? `\nHow the weapon is made and held: ${BUILD[e.base]}.` : "";
  const special = WHERE[e.base];
  const left = e.off === "mirror" && e.base === "pugni"
    ? "LEFT third: the LEFT hand is a CLOSED EMPTY FIST, ready to punch. The RIGHT hand is also a CLOSED EMPTY FIST. No weapons. Keep the center EMPTY."
    : e.off === "mirror"
    ? "LEFT third: the LEFT fist holds the SECOND matching short dagger upright, fully visible. Exactly two daggers, one per hand. Keep the center EMPTY."
    : e.off === "shield"
    ? "LEFT third of the image: the LEFT hand holds a round shield, seen from BEHIND as the hero sees it: the inside of the shield (wooden planks, iron rim, rivets, two leather straps, the fist closed around the grip), never its painted front. The shield sits low in the bottom-left corner and does not reach the center."
    : GLOVES[gk]?.focus
      ? `LEFT third of the image: the LEFT hand, low in the bottom-left corner, palm up, holds ${GLOVES[gk].focus}.`
      : "LEFT third of the image: the LEFT hand, EMPTY, half open and relaxed, fingers slightly curled, held low in the bottom-left corner.";
  const layout = special
    ? `Both hands and the weapon (${weapon}). ${special}`
    : e.off === "none"
      ? `RIGHT half of the image: BOTH hands (one above the other) holding the ${weapon} UPRIGHT, almost VERTICAL (tilted at most 10 degrees), the whole weapon visible from the bottom of the handle to the top, with empty space above it. The LEFT half and the CENTER stay EMPTY.`
      : `RIGHT third of the image: the RIGHT hand, near the bottom, holds the ${weapon} UPRIGHT, almost VERTICAL (tilted at most 10 degrees), the whole weapon visible from the pommel to the tip, with empty space above the tip.
CENTER third of the image: EMPTY (the enemies are seen there).
${left}`;
  return `Pixel art sprite for a first-person dungeon crawler: the hero's own hands, seen from behind, exactly as the hero sees them.
${e.gloveDesc ? `Both forearms and hands wear the SAME armor: sleeves, bracers and gloves of ${glove}` : `Both hands wear the SAME gloves: ${glove}`}. The two hands are the SAME size. The forearms leave the image through the BOTTOM border. Exactly TWO hands.
${layout}${build}
The weapon is drawn cleanly and solidly, every part straight and aligned, thick dark outline, 3 or 4 tones of shading per material. Nothing else in the image.
${STYLE}
${BG}`;
}

/* ARCO E BALESTRA SCOCCATI (2026-11-07): secondo fotogramma dello stesso sprite, senza freccia o
   quadrello, per l'animazione del tiro (tendi → scocca → la freccia sparisce → ricarichi e ricompare).
   Si genera partendo dallo sprite già fatto (immagine di riferimento), così resta identico. */
export const isRangedHand = (base) => base === "arco_lungo" || base === "balestra_l";
export const releasedPrompt = (base) => `Edit the attached pixel art sprite. Output the SAME image: identical hands, gloves, ${base === "balestra_l" ? "crossbow" : "bow"}, position, size, framing, colors and pixel style, on the same flat magenta (#FF00FF) background.
The ONLY change: the ${base === "balestra_l" ? "crossbow bolt has just been shot: there is NO bolt loaded on the crossbow" : "arrow has just been released: there is NO arrow anymore. The bowstring is straight and relaxed between the two tips of the bow, and the right hand is open, fingers relaxed, a little behind where it held the string"}.
Do NOT add anything else: no arrow, no motion lines, no effects, no text.
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
