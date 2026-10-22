// ── Rumore del d20 che rotola (2026-10-22) ─────────────────────────────────
// Sintetizzato con Web Audio (niente file da scaricare): un colpetto quando il
// dado parte, i rimbalzi sul tavolo negli stessi istanti del saltello di
// dice3d.js (55% · 80% · 92% della durata) e un tintinnio che si smorza mentre
// rotola. Con più dadi ogni dado fa i suoi colpi, un po' sfasati.
let ctx = null;
let noise = null;
const VOLUME = 0.55;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Il browser apre l'audio solo dopo un gesto: a ogni tocco (in cattura, PRIMA dei
// bottoni) si crea/riaccende il contesto, così il tiro che quel tocco fa partire si
// sente, e anche i tiri degli altri, che arrivano senza tocchi. Il telefono lo
// risospende quando l'app va in secondo piano: per questo il listener resta.
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = getCtx();
    if (c && c.state !== "running") c.resume().catch(() => {});
  };
  ["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));
}

function noiseBuffer(c) {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const len = Math.floor(c.sampleRate * 0.25);
  noise = c.createBuffer(1, len, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

// Un colpo di resina sul legno: schiocco di rumore filtrato + "toc" breve + un po' di tavolo sotto.
function knock(c, out, at, gain, pitch = 1) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = (2600 + Math.random() * 1800) * pitch;
  bp.Q.value = 2.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
  src.connect(bp).connect(g).connect(out);
  src.start(at, Math.random() * 0.2, 0.05);

  const tock = c.createOscillator();
  tock.type = "triangle";
  tock.frequency.setValueAtTime((1100 + Math.random() * 500) * pitch, at);
  tock.frequency.exponentialRampToValueAtTime(600 * pitch, at + 0.05);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0, at);
  tg.gain.linearRampToValueAtTime(gain * 0.45, at + 0.002);
  tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  tock.connect(tg).connect(out);
  tock.start(at); tock.stop(at + 0.08);

  if (gain > 0.25) {
    const thump = c.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(190, at);
    thump.frequency.exponentialRampToValueAtTime(90, at + 0.08);
    const hg = c.createGain();
    hg.gain.setValueAtTime(0, at);
    hg.gain.linearRampToValueAtTime(gain * 0.5, at + 0.004);
    hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    thump.connect(hg).connect(out);
    thump.start(at); thump.stop(at + 0.12);
  }
}

/** Suona il lancio di `count` d20 che durano `durationMs` (fino al dado fermo). */
export function playDiceRoll(durationMs = 1350, count = 1) {
  const c = getCtx();
  if (!c) return;
  // contesto ancora sospeso (nessun tocco dall'apertura, o appena riacceso): si suona
  // appena riparte, se riparte in tempo utile
  if (c.state !== "running") {
    const asked = Date.now();
    c.resume().then(() => { if (Date.now() - asked < 400) schedule(c, durationMs, count); }).catch(() => {});
    return;
  }
  schedule(c, durationMs, count);
}

function schedule(c, durationMs, count) {
  try {
    const D = durationMs / 1000;
    const n = Math.max(1, Math.min(6, count));
    const out = c.createGain();
    out.gain.value = VOLUME / Math.sqrt(n);
    out.connect(c.destination);
    const t0 = c.currentTime + 0.02;
    for (let k = 0; k < n; k++) {
      const j = () => (k ? (Math.random() - 0.5) * 0.08 : 0);
      const pitch = 0.9 + Math.random() * 0.25;
      knock(c, out, t0 + Math.max(0, j()), 0.18, pitch);               // parte dalla mano
      knock(c, out, t0 + D * 0.55 + j(), 0.9, pitch);                  // primo impatto
      knock(c, out, t0 + D * 0.8 + j(), 0.5, pitch);                   // rimbalzo
      knock(c, out, t0 + D * 0.92 + j(), 0.28, pitch);                 // rimbalzino
      // rotola: tic sempre più fitti e più deboli fino a fermarsi
      let t = D * 0.58;
      let g = 0.22;
      while (t < D * 0.99) {
        t += 0.035 + Math.random() * 0.06;
        g *= 0.86;
        knock(c, out, t0 + t + j() * 0.3, g, pitch * 1.1);
      }
    }
    setTimeout(() => { try { out.disconnect(); } catch { /* già staccato */ } }, durationMs + 600);
  } catch { /* audio non disponibile: il dado resta muto */ }
}
