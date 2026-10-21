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

let renderer, scene, camera, die, dieMat, shadow, geo, faceFrames, lastSkin;
let raf = 0, token = 0;

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

function buildDie() {
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
  dieMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.18, flatShading: true });
  die = new THREE.Mesh(geo, dieMat);
  scene.add(die);

  const sc = document.createElement("canvas");
  sc.width = sc.height = 128;
  const sg = sc.getContext("2d");
  const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2.6, R * 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }),
  );
  scene.add(shadow);
}

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
  buildDie();
}

/** true se il browser sa disegnare in WebGL. */
export function canUse3D() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Lancio simulato: posizione (scivola e rimbalza) e rotazione (si smorza a ogni rimbalzo).
function simulate(frames, halfW) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const start = new THREE.Vector2(side * (halfW + 1.4), rnd(-1.6, 1.2));
  const end = new THREE.Vector2(rnd(-0.5, 0.5), rnd(-0.25, 0.35));
  const bounces = [[0, 0.24, 3.2, "fall"], [0.24, 0.52, 1.1], [0.52, 0.71, 0.42], [0.71, 0.83, 0.13]];
  const height = (u) => {
    for (const [t0, t1, h, kind] of bounces) {
      if (u < t1) {
        const s = (u - t0) / (t1 - t0);
        return kind === "fall" ? h * (1 - s * s) : h * 4 * s * (1 - s);
      }
    }
    return 0;
  };
  let w = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-0.4, 0.4)).normalize().multiplyScalar(rnd(15, 19));
  let q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)));
  const out = [];
  const dt = 1 / 60;
  let nextBounce = 1;
  for (let i = 0; i <= frames; i++) {
    const u = i / frames;
    if (nextBounce < bounces.length && u >= bounces[nextBounce][0]) {
      // a ogni contatto col tavolo il dado perde giri e cambia un po' asse
      w.add(new THREE.Vector3(rnd(-4, 4), rnd(-4, 4), rnd(-2, 2))).multiplyScalar(0.62);
      nextBounce++;
    }
    const damp = u > 0.83 ? 0.80 : 0.985;
    w.multiplyScalar(damp);
    const ang = w.length() * dt;
    if (ang > 1e-6) q = new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang).multiply(q);
    const slide = Math.min(1, u / 0.88);
    const e = 1 - Math.pow(1 - slide, 3);
    out.push({
      x: start.x + (end.x - start.x) * e,
      y: start.y + (end.y - start.y) * e,
      z: IN_R + height(u),
      q: q.clone(),
    });
  }
  return out;
}

/**
 * Lancia il d20 dentro `host` (un elemento a tutto schermo) e si ferma su `value`.
 * Risolve quando il dado è fermo (`durationMs`). `onLanded` arriva insieme.
 */
export function roll3D(host, { value, skin = "classic", durationMs = 1350, accent = null }) {
  if (!renderer) setup();
  cancelAnimationFrame(raf);
  const my = ++token;

  if (lastSkin !== skin) {
    dieMat.map?.dispose();
    dieMat.map = makeAtlas(skin);
    dieMat.needsUpdate = true;
    lastSkin = skin;
  }
  dieMat.emissive = new THREE.Color(0x000000);

  const el = renderer.domElement;
  el.className = "dice3d-canvas";
  if (el.parentNode !== host) host.appendChild(el);
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // sul telefono (verticale) il dado non deve riempire lo schermo
    camera.position.set(0, -2.1, w < h ? 14 : 10.5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  resize();

  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfW = halfH * camera.aspect;
  const frames = Math.max(30, Math.round(durationMs / (1000 / 60)));
  const path = simulate(frames, halfW);
  const face = Math.min(20, Math.max(1, Math.round(value) || 1)) - 1;
  const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd(-0.22, 0.22));
  const target = yaw.multiply(faceFrames[face].clone());
  const fix = target.clone().multiply(path[path.length - 1].q.clone().invert());
  path.forEach((p) => p.q.premultiply(fix));

  return new Promise((resolve) => {
    const t0 = performance.now();
    let landed = false;
    const tick = (now) => {
      if (my !== token) { resolve(); return; }
      const t = Math.min(1, (now - t0) / durationMs);
      const fi = t * frames, i = Math.floor(fi), k = fi - i;
      const a = path[Math.min(i, frames)], b = path[Math.min(i + 1, frames)];
      die.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      die.quaternion.copy(a.q).slerp(b.q, k);
      const lift = die.position.z - IN_R;
      shadow.position.set(die.position.x + lift * 0.18, die.position.y + lift * 0.25, 0.001);
      shadow.scale.setScalar(1 + lift * 0.18);
      shadow.material.opacity = Math.max(0.25, 1 - lift * 0.22);
      if (landed && accent) {
        const pulse = 0.35 + 0.35 * Math.sin((now - t0) / 140);
        dieMat.emissive.set(accent).multiplyScalar(pulse);
      }
      renderer.render(scene, camera);
      if (t >= 1 && !landed) { landed = true; resolve(); }
      // dopo l'atterraggio si continua a disegnare solo per il bagliore del critico
      if (t < 1 || accent) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("resize", resize, { once: true });
    raf = requestAnimationFrame(tick);
  });
}

// Anteprime del menu "I Tuoi Dadi": un d20 fermo (faccia 20, un po' inclinato)
// per ogni colore, disegnato una volta in un'immagine. Renderer e scena a parte,
// così un'anteprima non disturba un lancio in corso.
const previewCache = new Map();
let pv = null;
export function previewDie(skin = "classic", size = 160) {
  const key = `${skin}:${size}`;
  if (previewCache.has(key)) return previewCache.get(key);
  if (!renderer) setup();
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
