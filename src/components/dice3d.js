// ── d20 in 3D che rotola davvero (2026-10-21) ──────────────────────────────
// Caricato solo al primo tiro (import dinamico da DiceRoll.jsx): three.js non
// pesa sul resto del sito. Il RISULTATO lo decide sempre il gioco: qui si
// simula un lancio (rimbalzi, rotazione che si smorza) e poi si ruota tutta la
// traiettoria di una rotazione fissa, così il dado si ferma con la faccia
// giusta verso l'alto senza scatti finali.
import * as THREE from "three";

// [colore del dado, colore dei numeri] per ogni skin di "I Tuoi Dadi".
const SKIN_COLORS = {
  classic:   ["#d6a536", "#2b1b05"],
  rubino:    ["#a3172c", "#fff1df"],
  zaffiro:   ["#1f4ea6", "#f1f5ff"],
  smeraldo:  ["#177a46", "#effff4"],
  ossidiana: ["#1c1b21", "#e6c45f"],
  damascato: ["#7b818a", "#111317"],
  arcano:    ["#5a2a9a", "#ffe9a6"],
  infernale: ["#3b0e08", "#ff8a2a"],
  glaciale:  ["#bfe4f5", "#0f3a5a"],
  cosmico:   ["#22174c", "#ece6ff"],
};

const R = 0.8;                      // raggio del dado (unità di scena)
const IN_R = R * 0.7947;            // raggio inscritto: altezza del centro a dado fermo
const COLS = 5, ROWS = 4;           // atlante delle 20 facce
const TRI = { a: [0.5, 0.93], b: [0.04, 0.12], c: [0.96, 0.12] }; // triangolo nella cella (v verso l'alto)

let renderer, scene, camera, geo, faceFrames, shadowTex, atlas, lastSkin;
// Un dado per ogni d20 del tiro (vantaggio = 2, tiri salvezza di gruppo = uno per bersaglio):
// mesh creati al bisogno e riusati; quelli in più restano nascosti.
let pool = [];
const MAX_DICE = 12;
let raf = 0, token = 0, lostFlag = false;
let pv = null; // renderer delle anteprime del menu "I Tuoi Dadi"

function makeAtlas(skin) {
  const [bg, ink] = SKIN_COLORS[skin] || SKIN_COLORS.classic;
  const W = 1280, H = 1024, cw = W / COLS, ch = H / ROWS;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) {
    const x0 = (i % COLS) * cw, y0 = Math.floor(i / COLS) * ch;
    const P = (p) => [x0 + p[0] * cw, y0 + (1 - p[1]) * ch];
    const [ax, ay] = P(TRI.a), [bx, by] = P(TRI.b), [cx, cy] = P(TRI.c);
    // spigoli appena più scuri: si leggono le facce anche col dado piatto di colore
    g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 10;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.stroke();
    const mx = (ax + bx + cx) / 3, my = (ay + by + cy) / 3 + ch * 0.03;
    const n = String(i + 1);
    g.fillStyle = ink;
    g.font = `700 ${Math.round(ch * (n.length > 1 ? 0.3 : 0.34))}px "Cinzel", "Grenze Gotisch", Georgia, serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(n, mx, my);
    if (n === "6" || n === "9") g.fillRect(mx - ch * 0.07, my + ch * 0.15, ch * 0.14, ch * 0.025);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildGeo() {
  geo = new THREE.IcosahedronGeometry(R, 0);          // 20 triangoli non indicizzati
  const pos = geo.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  faceFrames = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let f = 0; f < 20; f++) {
    const u0 = (f % COLS) / COLS, v0 = 1 - (Math.floor(f / COLS) + 1) / ROWS;
    [TRI.a, TRI.b, TRI.c].forEach((p, k) => {
      uv[(f * 3 + k) * 2] = u0 + p[0] / COLS;
      uv[(f * 3 + k) * 2 + 1] = v0 + p[1] / ROWS;
      v[k].fromBufferAttribute(pos, f * 3 + k);
    });
    // Sistema della faccia: normale fuori, "su" verso il vertice a (dove punta il numero).
    const centroid = v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
    const normal = centroid.clone().normalize();
    const up = v[0].clone().sub(centroid).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const F = new THREE.Matrix4().makeBasis(right, up, normal);
    // Rotazione che porta la faccia verso l'alto (+Z) col numero dritto (+Y).
    faceFrames.push(new THREE.Quaternion().setFromRotationMatrix(F.clone().transpose()));
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const sc = document.createElement("canvas");
  sc.width = sc.height = 128;
  const sg = sc.getContext("2d");
  const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(sc);
}

function dieAt(i) {
  while (pool.length <= i) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18, flatShading: true, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 2.6, R * 2.6),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    scene.add(mesh); scene.add(shadow);
    pool.push({ mesh, mat, shadow });
  }
  return pool[i];
}

// Sul telefono il browser butta via il contesto WebGL quando l'app va in secondo
// piano (o se ne apre un altro): un renderer morto non disegna più niente e il dado
// spariva per sempre. Si controlla a ogni tiro e, se serve, si rifà tutto da capo.
function rendererDead() {
  try { return !renderer || renderer.getContext().isContextLost(); } catch { return true; }
}
function teardown() {
  try { renderer?.dispose(); } catch { /* già morto */ }
  try { renderer?.domElement?.remove(); } catch { /* niente */ }
  renderer = scene = camera = null;
  pool = []; atlas = null;
  lastSkin = null;
  pv = null;
}

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lostFlag = true; }, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, -2.4, 13);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, -4, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2b0, 0.8);
  rim.position.set(5, 6, 4);
  scene.add(rim);
  buildGeo();
}

/** true se il browser sa disegnare in WebGL. */
export function canUse3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Lancio SUL POSTO (2026-10-22, richiesta dell'utente): il dado resta al centro
// dello schermo, fa un saltello e gira su sé stesso sempre più piano finché si ferma.
function simulate(frames, rx = 0, ry = 0.15) {
  const axis = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-0.5, 0.5)).normalize();
  const wobble = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
  const turns = rnd(4.2, 5.4) * Math.PI * 2;         // giri totali
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)));
  const out = [];
  for (let i = 0; i <= frames; i++) {
    const u = i / frames;
    const spin = 1 - Math.pow(1 - u, 3);               // veloce all'inizio, poi si smorza
    const a = new THREE.Vector3().copy(axis).lerp(wobble, 0.35 * Math.sin(u * Math.PI)).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(a, turns * spin).multiply(q0);
    // saltello: sale, ricade, due rimbalzini sempre più bassi
    const hop = u < 0.55 ? 1.1 * Math.sin((u / 0.55) * Math.PI)
      : u < 0.8 ? 0.28 * Math.sin(((u - 0.55) / 0.25) * Math.PI)
      : u < 0.92 ? 0.07 * Math.sin(((u - 0.8) / 0.12) * Math.PI) : 0;
    out.push({ x: rx, y: ry, z: IN_R + hop, q });
  }
  return out;
}

/**
 * Lancia uno o più d20 dentro `host` (un elemento a tutto schermo); ognuno si ferma
 * sul suo valore. `dice` = [{ value, accent, dim, name }]: `dim` = dado scartato
 * (vantaggio/svantaggio), si spegne quando è fermo; `name` = scritta sotto il dado.
 * Senza `dice` è il solito d20 singolo su `value`. Risolve quando i dadi sono fermi.
 */
export function roll3D(host, { value, dice = null, skin = "classic", durationMs = 1350, accent = null, pixel = false }) {
  if (lostFlag || rendererDead()) { lostFlag = false; teardown(); }
  if (!renderer) setup();
  cancelAnimationFrame(raf);
  const my = ++token;
  const list = (dice?.length ? dice : [{ value, accent }]).slice(0, MAX_DICE);
  const n = list.length;

  if (lastSkin !== skin) {
    atlas?.dispose();
    atlas = makeAtlas(skin);
    lastSkin = skin;
  }
  pool.forEach((d) => { d.mesh.visible = false; d.shadow.visible = false; });

  const el = renderer.domElement;
  // pixel = disegnato a bassa risoluzione e ingrandito a blocchi (lotta dei pet)
  el.className = pixel ? "dice3d-canvas is-pixel" : "dice3d-canvas";
  if (el.parentNode !== host) host.appendChild(el);

  // Griglia: al massimo 3 per riga sul telefono in verticale, 5 sul largo.
  const S = R * 2.7;
  const cols = Math.min(n, window.innerWidth < window.innerHeight ? 3 : 5), rows = Math.ceil(n / cols);
  const spots = list.map((_, i) => {
    const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols, c = i - r * cols;
    return { x: (c - (inRow - 1) / 2) * S, y: ((rows - 1) / 2 - r) * S * 1.15 + 0.15 };
  });

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    renderer.setPixelRatio(pixel ? 0.4 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    // sul telefono (verticale) il dado non deve riempire lo schermo; con più dadi ci si allontana
    const span = 2 * Math.tan((camera.fov * Math.PI) / 360);
    const needH = (rows * S * 1.15 + R) / (span * 0.6);
    const needW = (cols * S + R) / (span * aspect * 0.9);
    const dist = Math.max(w < h ? 10.5 : 8, n > 1 ? Math.max(needH, needW) : 0);
    camera.position.set(0, -1.6 * (dist / 8), dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  resize();

  const frames = Math.max(30, Math.round(durationMs / (1000 / 60)));
  const rolls = list.map((d, i) => {
    const one = dieAt(i);
    one.mesh.visible = one.shadow.visible = true;
    one.mat.map = atlas; one.mat.needsUpdate = true;
    one.mat.color.set(0xffffff); one.mat.opacity = 1;
    one.mat.emissive.set(0x000000);
    const path = simulate(frames, spots[i].x, spots[i].y);
    const face = Math.min(20, Math.max(1, Math.round(d.value) || 1)) - 1;
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd(-0.22, 0.22));
    const target = yaw.multiply(faceFrames[face].clone());
    const fix = target.clone().multiply(path[path.length - 1].q.clone().invert());
    path.forEach((p) => p.q.premultiply(fix));
    return { one, path, accent: d.dim ? null : (d.accent ?? (n === 1 ? accent : null)), dim: !!d.dim };
  });

  // Nomi sotto i dadi (bersagli dei tiri salvezza, dado scartato…): posizione a schermo del dado fermo.
  const placeNames = () => {
    host.querySelectorAll(".dice3d-name").forEach((x) => x.remove());
    list.forEach((d, i) => {
      if (!d.name) return;
      const v = new THREE.Vector3(spots[i].x, spots[i].y - R * 1.3, 0).project(camera);
      const tag = document.createElement("div");
      tag.className = `dice3d-name${d.dim ? " is-dim" : ""}`;
      tag.textContent = d.name;
      tag.style.left = `${((v.x + 1) / 2) * 100}%`;
      tag.style.top = `${((1 - v.y) / 2) * 100}%`;
      host.appendChild(tag);
    });
  };
  placeNames();

  return new Promise((resolve) => {
    const t0 = performance.now();
    let landed = false;
    const anyAccent = rolls.some((r) => r.accent);
    const tick = (now) => {
      if (my !== token) { resolve(); return; }
      // il primo fotogramma può avere un orario PRIMA di t0: senza il max(0) l indice
      // veniva -1 e il dado non si disegnava mai (era il bug del dado invisibile)
      const t = Math.max(0, Math.min(1, (now - t0) / durationMs));
      const done = t >= 1;
      const fi = t * frames, i = Math.floor(fi), k = fi - i;
      for (const r of rolls) {
        const { mesh, shadow, mat } = r.one;
        const a = r.path[Math.min(i, frames)], b = r.path[Math.min(i + 1, frames)];
        mesh.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
        mesh.quaternion.copy(a.q).slerp(b.q, k);
        const lift = mesh.position.z - IN_R;
        shadow.position.set(mesh.position.x + lift * 0.18, mesh.position.y + lift * 0.25, 0.001);
        shadow.scale.setScalar(1 + lift * 0.18);
        shadow.material.opacity = Math.max(0.25, 1 - lift * 0.22);
        if (done && r.accent) {
          const pulse = 0.35 + 0.35 * Math.sin((now - t0) / 140);
          mat.emissive.set(r.accent).multiplyScalar(pulse);
        }
        // il dado scartato (vantaggio/svantaggio) si spegne appena è fermo
        if (done && r.dim) { mat.color.set(0x5a5a5a); mat.opacity = 0.5; }
      }
      renderer.render(scene, camera);
      if (done && !landed) { landed = true; resolve(); }
      // dopo l'atterraggio si continua a disegnare solo per il bagliore del critico
      if (!done || anyAccent) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("resize", () => { resize(); placeNames(); }, { once: true });
    raf = requestAnimationFrame(tick);
  });
}

// Anteprime del menu "I Tuoi Dadi": un d20 fermo (faccia 20, un po' inclinato)
// per ogni colore, disegnato una volta in un'immagine. Renderer e scena a parte,
// così un'anteprima non disturba un lancio in corso.
const previewCache = new Map();

export function previewDie(skin = "classic", size = 160) {
  const key = `${skin}:${size}`;
  if (previewCache.has(key)) return previewCache.get(key);
  if (lostFlag || rendererDead()) { lostFlag = false; teardown(); }
  if (!renderer) setup();
  if (pv && pv.r.getContext().isContextLost()) pv = null;
  if (!pv) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene();
    sc.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, -4, 10); sc.add(key);
    const rim = new THREE.DirectionalLight(0xffe2b0, 0.8); rim.position.set(5, 6, 4); sc.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, -0.6, 4.4); cam.lookAt(0, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0.28, 0.1)).multiply(faceFrames[19].clone()));
    sc.add(mesh);
    pv = { r, sc, cam, mat };
  }
  pv.r.setPixelRatio(1);
  pv.r.setSize(size, size, false);
  pv.mat.map?.dispose();
  pv.mat.map = makeAtlas(skin);
  pv.mat.needsUpdate = true;
  pv.r.render(pv.sc, pv.cam);
  const url = pv.r.domElement.toDataURL("image/png"); // subito dopo il render: niente preserveDrawingBuffer
  previewCache.set(key, url);
  return url;
}

/** Ferma l'animazione in corso (il canvas resta dov'è, lo toglie il chiamante). */
export function stop3D() {
  token++;
  cancelAnimationFrame(raf);
}
