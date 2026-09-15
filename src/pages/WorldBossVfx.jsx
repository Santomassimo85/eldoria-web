// Effetti a schermo del World Boss: PIXEL ART in CSS (gli stessi "scoppi" chunky
// stile Octopath nati per la vecchia versione isometrica, ormai cancellata), montati in
// un portal sopra la scena testo+sprite. Ogni attacco porta con sé forma + elemento:
//   effect        "slash" | "arrow" | "bolt" | "aoe" | "heal" | "buff" | "shield" | "debuff" | "hit"
//   effectEl      fire | frost | lightning | poison | darkness | radiant | arcane | physical
//   effectTargets [chiavi data-vfx-target dei bersagli]  (boss · minion-<id> · player-<uid>)
//   effectFrom    chiave di chi attacca (da lì parte il proiettile)
//   effectMissTargets  sottoinsieme mancato → sbuffo grigio invece dello scoppio
//   effectKill    sottoinsieme caduto → schizzo rosso scuro dopo il colpo
// Il trasporto è il doc di chat (world_boss_chat): ogni client legge il nuovo
// messaggio e disegna lo stesso effetto, senza scritture in più.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./WorldBossVfx.css";

// ── Suoni (mp3 già in public/sounds) ─────────────────────────────────────────
const VFX_SOUNDS = {
  slash: "/sounds/slash.mp3",
  ranged: "/sounds/ranged.mp3",
  heal: "/sounds/heal.mp3",
  spell: "/sounds/spell.mp3",
};
const SOUND_OF = { slash: "slash", arrow: "ranged", bolt: "spell", aoe: "spell", heal: "heal", buff: "spell", shield: "spell", debuff: "spell", hit: "slash" };
const VFX_VOLUME = 0.4;

let audioCtx = null;
const audioBuffers = {};
let audioUnlocked = false;
function getCtx() {
  if (audioCtx || typeof window === "undefined") return audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (Ctor) audioCtx = new Ctor();
  return audioCtx;
}
async function loadBuffer(key, src) {
  if (audioBuffers[key]) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const res = await fetch(src);
    const arr = await res.arrayBuffer();
    audioBuffers[key] = await ctx.decodeAudioData(arr);
  } catch { /* ignore */ }
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  for (const [k, src] of Object.entries(VFX_SOUNDS)) loadBuffer(k, src);
}
if (typeof window !== "undefined") {
  const onFirstGesture = () => {
    unlockAudio();
    window.removeEventListener("touchstart", onFirstGesture);
    window.removeEventListener("touchend", onFirstGesture);
    window.removeEventListener("click", onFirstGesture);
    window.removeEventListener("keydown", onFirstGesture);
  };
  window.addEventListener("touchstart", onFirstGesture, { passive: true });
  window.addEventListener("touchend", onFirstGesture, { passive: true });
  window.addEventListener("click", onFirstGesture);
  window.addEventListener("keydown", onFirstGesture);
}
function playSound(kind) {
  const ctx = getCtx();
  const buf = audioBuffers[SOUND_OF[kind] || "spell"];
  if (!ctx || !buf) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = VFX_VOLUME;
    src.connect(gain).connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
}

// Vecchi messaggi (prima del 2026-09-15) portavano solo una chiave webp.
const LEGACY = {
  fire: ["bolt", "fire"], frost: ["bolt", "frost"], lightning: ["bolt", "lightning"], poison: ["bolt", "poison"],
  magic: ["bolt", "arcane"], ranged: ["arrow", "physical"], slash: ["slash", "physical"], heal: ["heal", "radiant"],
  buff: ["buff", "radiant"], debuff: ["debuff", "darkness"], shield: ["shield", "arcane"], hit: ["hit", "physical"],
};
function normalizeEffect(msg) {
  let kind = msg.effect, el = msg.effectEl;
  if (!el && LEGACY[kind]) [kind, el] = LEGACY[kind];
  if (!LEGACY[kind] && kind !== "aoe" && kind !== "arrow" && kind !== "bolt") kind = "bolt";
  return { kind, el: el || "arcane" };
}

// ── Geometria ────────────────────────────────────────────────────────────────
// Punto ancora di un bersaglio: centro dello sprite, un po' sopra la metà (petto).
function anchorOf(key) {
  const el = document.querySelector(`[data-vfx-target="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const size = Math.max(r.width, r.height);
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.45, bottom: r.bottom, w: r.width, h: r.height, size };
}
// Da dove parte il proiettile: chi attacca se è in scena, altrimenti la sua metà campo.
function sourceOf(key, target) {
  const a = key ? anchorOf(key) : null;
  if (a) return a;
  const isHero = /^player-/.test(key || "");
  const zone = document.querySelector(isHero ? ".rpg-party-zone" : ".rpg-boss-zone");
  if (zone) {
    const r = zone.getBoundingClientRect();
    if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, size: 120 };
  }
  return { x: target.x + (isHero ? 260 : -260), y: target.y, size: 120 };
}
const pxSize = (size) => Math.max(5, Math.min(12, Math.round(size / 16)));
// Sequenza deterministica (stesso disegno su ogni client).
const seeded = (n) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };

// Scoppio a raggiera (colpo / morte).
function burstPixels(n, R, seed) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (seeded(seed + i) - 0.5) * 0.6;
    const d = R * (0.65 + seeded(seed + i + 31) * 0.45);
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.85 - R * 0.15 };
  });
}
// Cupola: mezza ellisse di pixel che avvolge TUTTO lo sprite (larga Rx, alta Ry),
// ognuno con ritardo dal centro al bordo così "cresce" dal suolo verso l'alto.
function domePixels(Rx, Ry, P) {
  const step = Math.max(P * 1.25, Math.max(Rx, Ry) / 12);
  const out = [];
  for (let gy = 0; gy >= -Ry; gy -= step) {
    for (let gx = -Rx; gx <= Rx; gx += step) {
      const d = Math.hypot(gx / Rx, gy / Ry);
      if (d > 1) continue;
      out.push({ x: gx, y: gy, edge: d });
    }
  }
  return out;
}

// ── Layer ────────────────────────────────────────────────────────────────────
export function VfxLayer({ messages }) {
  const seenRef = useRef(new Set());
  const mountedAtRef = useRef(Date.now());
  const [items, setItems] = useState([]);

  // Solo in sviluppo: dalla console `__wbVfx("bolt", "fire", ["boss"], {from:"player-<uid>", miss:[], kill:[]})`
  // disegna l'effetto in locale senza scrivere nulla su Firestore (prova grafica).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__wbVfx = (kind, el, targets, o = {}) => {
      const msg = { id: `dev-${Date.now()}`, effect: kind, effectEl: el, effectTargets: targets, effectFrom: o.from, effectMissTargets: o.miss, effectKill: o.kill };
      const spawned = spawnFor(msg, targets);
      setItems((prev) => [...prev, ...spawned]);
      const ids = new Set(spawned.map((s) => s.id));
      const ttl = spawned.length ? Math.max(...spawned.map((s) => s.delay + s.dur)) + 150 : 0;
      setTimeout(() => setItems((prev) => prev.filter((s) => !ids.has(s.id))), ttl);
      return spawned.length;
    };
    return () => { delete window.__wbVfx; };
  }, []);

  useEffect(() => {
    if (!messages?.length) return;
    for (const msg of messages) {
      if (!msg.id || seenRef.current.has(msg.id)) continue;
      const targets = Array.isArray(msg.effectTargets) ? msg.effectTargets : (msg.effectTarget ? [msg.effectTarget] : []);
      if (!msg.effect || !targets.length) { seenRef.current.add(msg.id); continue; }
      const ts = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : 0;
      // Niente replay della storia quando si entra in pagina.
      if (ts && ts < mountedAtRef.current - 5000) { seenRef.current.add(msg.id); continue; }
      seenRef.current.add(msg.id);
      const spawned = spawnFor(msg, targets);
      if (!spawned.length) continue;
      setItems((prev) => [...prev, ...spawned]);
      const ids = new Set(spawned.map((s) => s.id));
      const ttl = Math.max(...spawned.map((s) => s.delay + s.dur)) + 150;
      setTimeout(() => setItems((prev) => prev.filter((s) => !ids.has(s.id))), ttl);
      playSound(normalizeEffect(msg).kind);
    }
  }, [messages]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="wbv-layer" aria-hidden="true">
      {items.map((it) => <VfxItem key={it.id} it={it} />)}
    </div>,
    document.body,
  );
}

let seq = 0;
// Costruisce la lista di pezzi (con ritardo) per un messaggio.
function spawnFor(msg, targets) {
  const { kind, el } = normalizeEffect(msg);
  const missSet = new Set(Array.isArray(msg.effectMissTargets) ? msg.effectMissTargets : (msg.effectMiss ? targets : []));
  const killSet = new Set(Array.isArray(msg.effectKill) ? msg.effectKill : []);
  const out = [];
  const push = (o) => out.push({ id: `${msg.id}-${++seq}`, ...o });
  const anchors = targets.map((t) => ({ key: t, a: anchorOf(t) })).filter((x) => x.a);
  if (!anchors.length) return out;

  const impact = (key, a, at) => {
    const P = pxSize(a.size);
    if (missSet.has(key)) {
      push({ kind: "miss", x: a.x, y: a.y, P, R: a.size * 0.22, delay: at, dur: 520, el });
      return;
    }
    push({ kind: "burst", x: a.x, y: a.y, P, R: a.size * 0.38, delay: at, dur: 560, el, seed: seq });
    if (killSet.has(key)) push({ kind: "death", x: a.x, y: a.y + a.h * 0.1, P: P + 2, R: a.size * 0.5, delay: at + 300, dur: 760, el, seed: seq + 7 });
  };

  if (kind === "aoe") {
    push({ kind: "flash", delay: 0, dur: 420, el });
    anchors.forEach(({ key, a }, i) => {
      const at = i * 130;
      const P = pxSize(a.size);
      push({ kind: "dome", x: a.x, y: a.bottom, P, Rx: Math.max(a.w * 0.8, a.size * 0.45), Ry: a.h * 1.02, delay: at, dur: 1500, el });
      impact(key, a, at + 380);
    });
    return out;
  }
  if (kind === "slash" || kind === "hit") {
    anchors.forEach(({ key, a }, i) => {
      const at = i * 90;
      if (kind === "slash") push({ kind: "slash", x: a.x, y: a.y, P: pxSize(a.size), R: a.size * 0.42, delay: at, dur: 380, el });
      impact(key, a, at + (kind === "slash" ? 140 : 0));
    });
    return out;
  }
  if (kind === "arrow" || kind === "bolt") {
    anchors.forEach(({ key, a }, i) => {
      const at = i * 110;
      const from = sourceOf(msg.effectFrom, a);
      push({ kind: "proj", proj: kind, x: from.x, y: from.y, tx: a.x - from.x, ty: a.y - from.y, P: pxSize(Math.max(a.size, 90)), delay: at, dur: 440, el });
      impact(key, a, at + 400);
    });
    return out;
  }
  // heal / buff / shield / debuff: sul bersaglio, tutti insieme
  anchors.forEach(({ a }, i) => {
    const P = pxSize(a.size);
    if (kind === "shield") push({ kind: "ring", x: a.x, y: a.y, R: a.size * 0.45, delay: i * 60, dur: 700, el });
    else if (kind === "debuff") push({ kind: "sink", x: a.x, y: a.y, P, R: a.size * 0.4, delay: i * 60, dur: 720, el });
    else push({ kind: "rise", x: a.x, y: a.y, P, R: a.size * 0.4, delay: i * 60, dur: 720, el, tone: kind === "heal" ? "heal" : "buff" });
  });
  return out;
}

function VfxItem({ it }) {
  const el = `el-${it.el || "arcane"}`;
  const base = { left: it.x, top: it.y, "--p": `${it.P || 6}px`, animationDelay: `${it.delay}ms` };
  const d = (ms) => `${ms}ms`;
  switch (it.kind) {
    case "flash":
      return <div className={`wbv-flash ${el}`} style={{ animationDelay: d(it.delay), animationDuration: d(it.dur) }} />;
    case "proj": {
      const ang = (Math.atan2(it.ty, it.tx) * 180) / Math.PI;
      return (
        <div className="wbv-proj" style={{ left: it.x, top: it.y, "--tx": `${it.tx}px`, "--ty": `${it.ty}px`, "--p": `${it.P}px`, animationDelay: d(it.delay), animationDuration: d(it.dur) }}>
          <i className={`wbv-proj-head proj-${it.proj} ${el}`} style={{ transform: `rotate(${ang}deg)` }} />
          <i className={`wbv-proj-trail proj-${it.proj} ${el}`} style={{ transform: `rotate(${ang}deg)` }} />
        </div>
      );
    }
    case "slash":
      return <div className={`wbv-slash ${el}`} style={{ left: it.x, top: it.y, width: it.R * 2, animationDelay: d(it.delay), animationDuration: d(it.dur) }} />;
    case "burst":
    case "death": {
      const n = it.kind === "death" ? 12 : 10;
      const px = burstPixels(n, it.R, it.seed || 1);
      return (
        <div className={`wbv-burst wbv-${it.kind} ${el}`} style={base}>
          {px.map((p, i) => <i key={i} style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, animationDelay: d(it.delay), animationDuration: d(it.dur) }} />)}
        </div>
      );
    }
    case "miss":
      return (
        <div className="wbv-miss" style={base}>
          {[-2, -1, 0, 1, 2].map((k) => <i key={k} style={{ "--dx": `${k * it.P * 1.6}px`, animationDelay: d(it.delay + Math.abs(k) * 30), animationDuration: d(it.dur) }} />)}
          <span style={{ animationDelay: d(it.delay), animationDuration: d(it.dur) }}>mancato</span>
        </div>
      );
    case "dome": {
      const px = domePixels(it.Rx, it.Ry, it.P);
      return (
        <div className={`wbv-dome ${el}`} style={{ ...base, "--r": `${it.Rx}px`, "--w": `${it.Rx * 2.1}px`, animationDuration: d(it.dur) }}>
          <b style={{ animationDelay: d(it.delay), animationDuration: d(it.dur) }} />
          {px.map((p, i) => <i key={i} style={{ left: p.x, top: p.y, animationDelay: d(it.delay + p.edge * 480) }} />)}
        </div>
      );
    }
    case "ring":
      return <div className={`wbv-ring ${el}`} style={{ left: it.x, top: it.y, "--r": `${it.R}px`, animationDelay: d(it.delay), animationDuration: d(it.dur) }} />;
    case "rise":
    case "sink": {
      const n = 6;
      return (
        <div className={`wbv-${it.kind} ${it.tone ? `tone-${it.tone}` : ""} ${el}`} style={{ ...base, "--r": `${it.R}px` }}>
          {Array.from({ length: n }, (_, i) => (
            <i key={i} style={{ "--dx": `${((i / (n - 1)) - 0.5) * it.R * 1.6}px`, animationDelay: d(it.delay + (i % 3) * 70), animationDuration: d(it.dur) }} />
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}
