/* ============================================================
   TCG SFX — sound effects synthesized with Web Audio API
   No external audio assets — every sound is built from oscillators
   and noise buffers, so the bundle stays small and there's no
   network round-trip on first play.
   ------------------------------------------------------------
   Public API:
     playSfx(name)        — fire-and-forget effect
     setSfxMuted(bool)    — toggle mute (persisted in localStorage)
     isSfxMuted()         — current mute state
   ============================================================ */

const MUTE_KEY = "tcg.sfx.muted";

let _ctx = null;
let _muted = false;

if (typeof window !== "undefined") {
  try {
    _muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    _muted = false;
  }
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  // Some browsers suspend the context until a user gesture; resume on demand.
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

export function isSfxMuted() { return _muted; }

export function setSfxMuted(v) {
  _muted = !!v;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(MUTE_KEY, _muted ? "1" : "0"); } catch {}
  }
}

/* ── Primitives ───────────────────────────────────────────── */

function envelope(gainNode, ctx, { attack = 0.005, decay = 0.15, peak = 0.18 } = {}) {
  const t0 = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  return t0 + attack + decay;
}

function tone(ctx, dest, { freq, type = "sine", duration = 0.2, peak = 0.18, slideTo = null }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + duration);
  }
  const end = envelope(gain, ctx, { decay: duration, peak });
  osc.connect(gain).connect(dest);
  osc.start();
  osc.stop(end + 0.05);
}

function noiseBuffer(ctx, duration = 0.3) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(ctx, dest, { duration = 0.22, peak = 0.12, lpStart = 6000, lpEnd = 800, hp = 200 }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, duration);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(lpStart, ctx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(Math.max(80, lpEnd), ctx.currentTime + duration);
  const hpF = ctx.createBiquadFilter();
  hpF.type = "highpass";
  hpF.frequency.value = hp;
  const gain = ctx.createGain();
  envelope(gain, ctx, { decay: duration, peak });
  src.connect(hpF).connect(lp).connect(gain).connect(dest);
  src.start();
  src.stop(ctx.currentTime + duration + 0.05);
}

/* ── Effect builders ──────────────────────────────────────── */

const EFFECTS = {
  // Sword swoosh + metallic impact
  attack(ctx, dest) {
    noise(ctx, dest, { duration: 0.16, peak: 0.10, lpStart: 5000, lpEnd: 1200, hp: 300 });
    setTimeout(() => {
      tone(ctx, dest, { freq: 220, type: "square", duration: 0.08, peak: 0.16, slideTo: 90 });
      tone(ctx, dest, { freq: 880, type: "triangle", duration: 0.12, peak: 0.10, slideTo: 660 });
    }, 90);
  },
  // Higher whoosh — air rush
  flying(ctx, dest) {
    noise(ctx, dest, { duration: 0.45, peak: 0.12, lpStart: 800, lpEnd: 3200, hp: 500 });
    setTimeout(() => {
      tone(ctx, dest, { freq: 1400, type: "sine", duration: 0.25, peak: 0.06, slideTo: 600 });
    }, 60);
  },
  // Soft card-on-table tap
  play(ctx, dest) {
    tone(ctx, dest, { freq: 420, type: "triangle", duration: 0.08, peak: 0.10, slideTo: 220 });
    noise(ctx, dest, { duration: 0.05, peak: 0.05, lpStart: 4000, lpEnd: 1000, hp: 800 });
  },
  // Heavy thud — creature dies
  death(ctx, dest) {
    tone(ctx, dest, { freq: 180, type: "sawtooth", duration: 0.35, peak: 0.16, slideTo: 55 });
    noise(ctx, dest, { duration: 0.20, peak: 0.10, lpStart: 1200, lpEnd: 200, hp: 80 });
  },
  // Cinder explosion
  cinder(ctx, dest) {
    noise(ctx, dest, { duration: 0.30, peak: 0.16, lpStart: 4500, lpEnd: 250, hp: 120 });
    tone(ctx, dest, { freq: 110, type: "square", duration: 0.18, peak: 0.14, slideTo: 50 });
  },
  // Pierce — sharp metallic stab
  pierce(ctx, dest) {
    tone(ctx, dest, { freq: 1800, type: "triangle", duration: 0.10, peak: 0.10, slideTo: 900 });
    tone(ctx, dest, { freq: 320, type: "square", duration: 0.10, peak: 0.10, slideTo: 160 });
  },
  // Heal — soft chime up
  heal(ctx, dest) {
    tone(ctx, dest, { freq: 660, type: "sine", duration: 0.18, peak: 0.10, slideTo: 990 });
    setTimeout(() => tone(ctx, dest, { freq: 880, type: "sine", duration: 0.18, peak: 0.08, slideTo: 1320 }), 70);
  },
  // Veil revive — ghostly shimmer
  veil(ctx, dest) {
    tone(ctx, dest, { freq: 520, type: "sine", duration: 0.35, peak: 0.08, slideTo: 1040 });
    tone(ctx, dest, { freq: 780, type: "triangle", duration: 0.35, peak: 0.06, slideTo: 1560 });
  },
  // Turn change — short low chime
  turn(ctx, dest) {
    tone(ctx, dest, { freq: 330, type: "sine", duration: 0.14, peak: 0.10, slideTo: 440 });
  },
  // Victory — ascending major triad
  win(ctx, dest) {
    [0, 130, 260].forEach((delay, i) => {
      setTimeout(() => {
        const freq = [523, 659, 784][i];
        tone(ctx, dest, { freq, type: "triangle", duration: 0.35, peak: 0.14 });
      }, delay);
    });
  },
  // Loss — descending minor
  lose(ctx, dest) {
    [0, 160, 320].forEach((delay, i) => {
      setTimeout(() => {
        const freq = [392, 311, 233][i];
        tone(ctx, dest, { freq, type: "sawtooth", duration: 0.40, peak: 0.12 });
      }, delay);
    });
  },
};

export function playSfx(name) {
  if (_muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  const builder = EFFECTS[name];
  if (!builder) return;
  try {
    // Master compressor keeps stacked effects from clipping.
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -16;
    master.ratio.value = 4;
    master.connect(ctx.destination);
    builder(ctx, master);
    // Disconnect compressor a little after the longest effect tail (~0.8s)
    setTimeout(() => { try { master.disconnect(); } catch {} }, 900);
  } catch (err) {
    // Audio is non-essential — never crash the game over a sound issue.
    console.warn("tcgSfx:", err);
  }
}

/* Convenience: call once on the first user gesture to wake the context
   under autoplay-policy browsers (Safari/Chrome on iOS especially). */
export function primeSfx() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}
