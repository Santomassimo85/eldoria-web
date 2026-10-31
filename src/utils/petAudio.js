/* ============================================================
   SUONI DELLA LOTTA DEI PET (2026-10-31) — tutto sintetizzato con
   Web Audio, niente file da scaricare.
   - sfx(ev): un suono per ogni riga della lotta. Le mosse suonano
     secondo la FORMA (fx: pestone, morso, frusta…) con sopra uno
     strato dell'ELEMENTO (crepitio del fuoco, cristalli del gelo…),
     sincronizzato con l'animazione di PetFx (impatto a ~0,3 s).
   - musica: un giro chiptune semplice in loop, con interruttore
     (localStorage pd_music) e uno per gli effetti (pd_sfx).
   Partenza automatica su ogni dispositivo: il browser apre l'audio
   solo dopo un gesto, quindi unlock() si chiama nel clic che avvia
   la lotta e un ascoltatore globale lo riprova a ogni tocco (iPhone
   compreso; con audioSession "playback" suona anche col silenzioso).
   ============================================================ */

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === "1"; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* niente */ } };
let musicOn = read("pd_music", true);
let sfxOn = read("pd_sfx", true);
let musicWanted = false; // c'è una lotta in corso che vuole la musica
const listeners = new Set();
const notify = () => listeners.forEach((f) => f({ musicOn, sfxOn }));

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  }
  return ctx;
}

export function unlock() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* vecchi browser */ }
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") c.resume().then(() => { if (musicWanted && musicOn) startLoop(); }).catch(() => {});
  else if (musicWanted && musicOn) startLoop();
}

if (typeof window !== "undefined") {
  const again = () => { if (musicWanted || ctx) unlock(); };
  ["pointerdown", "touchend", "click", "keydown"].forEach((e) => window.addEventListener(e, again, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) stopLoop();
    else if (musicWanted && musicOn) unlock();
  });
}

/* ── mattoncini ── */
function noise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = c.sampleRate;
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function env(g, at, peak, attack, dur) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}
// Nota: frequenza (con glissato `to`), forma d'onda, volume, durata, vibrato.
function tone(t, { f = 440, to, type = "square", vol = 0.2, dur = 0.15, attack = 0.005, vib = 0, out } = {}) {
  const c = ctx;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  if (vib) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = 9; lg.gain.value = vib;
    l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  env(g, t, vol, attack, dur);
  o.connect(g).connect(out || sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}
// Rumore filtrato (con spazzata del filtro da f a to).
function hiss(t, { f = 1000, to, q = 1, kind = "bandpass", vol = 0.25, dur = 0.2, attack = 0.005, out } = {}) {
  const c = ctx;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  fl.type = kind; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
  env(g, t, vol, attack, dur);
  s.connect(fl).connect(g).connect(out || sfxBus);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}
const thud = (t, vol = 0.5) => { tone(t, { f: 150, to: 40, type: "sine", vol, dur: 0.22 }); hiss(t, { f: 400, kind: "lowpass", vol: vol * 0.6, dur: 0.12 }); };
const swish = (t, hi = 3000, lo = 700, vol = 0.22) => hiss(t, { f: hi, to: lo, q: 2, vol, dur: 0.13, attack: 0.02 });

/* ── forme (sincronizzate con PetFx: l'impatto arriva a ~0,3 s) ── */
const SHAPES = {
  stomp: (t) => { swish(t, 600, 1800, 0.12); thud(t + 0.3, 0.6); hiss(t + 0.3, { f: 200, kind: "lowpass", vol: 0.25, dur: 0.4 }); },
  bite: (t) => { [0.3, 0.36].forEach((d) => { hiss(t + d, { f: 2500, kind: "highpass", vol: 0.3, dur: 0.05 }); tone(t + d, { f: 220, to: 120, vol: 0.12, dur: 0.06 }); }); },
  claw: (t) => [0, 0.07, 0.14].forEach((d) => swish(t + d, 4000, 900, 0.2)),
  whip: (t) => { swish(t, 500, 2500, 0.14); hiss(t + 0.32, { f: 3500, kind: "highpass", vol: 0.55, dur: 0.04, attack: 0.001 }); tone(t + 0.32, { f: 1800, to: 600, vol: 0.12, dur: 0.05 }); },
  sting: (t) => { tone(t, { f: 900, to: 2400, type: "triangle", vol: 0.12, dur: 0.25 }); tone(t + 0.3, { f: 2600, to: 1800, vol: 0.12, dur: 0.05 }); },
  dash: (t) => { hiss(t, { f: 400, to: 3000, q: 1.5, vol: 0.22, dur: 0.28, attack: 0.1 }); thud(t + 0.3, 0.55); },
  orb: (t) => { tone(t, { f: 300, to: 900, vol: 0.1, dur: 0.35 }); hiss(t + 0.38, { f: 1500, vol: 0.25, dur: 0.15 }); tone(t + 0.38, { f: 500, to: 150, type: "triangle", vol: 0.2, dur: 0.15 }); },
  beam: (t) => { tone(t, { f: 180, type: "sawtooth", vol: 0.08, dur: 0.6, vib: 25 }); tone(t, { f: 362, type: "square", vol: 0.05, dur: 0.6, vib: 40 }); },
  breath: (t) => hiss(t, { f: 700, to: 1800, kind: "lowpass", vol: 0.35, dur: 0.6, attack: 0.15 }),
  burst: (t) => { hiss(t, { f: 2000, to: 80, kind: "lowpass", vol: 0.6, dur: 0.7, attack: 0.003 }); tone(t, { f: 90, to: 30, type: "sine", vol: 0.5, dur: 0.5 }); },
  bolt: (t) => { hiss(t, { f: 4000, kind: "highpass", vol: 0.5, dur: 0.12, attack: 0.001 }); tone(t, { f: 60, type: "sawtooth", vol: 0.12, dur: 0.45, vib: 30 }); },
  rain: (t) => { for (let i = 0; i < 8; i++) hiss(t + 0.05 + Math.random() * 0.45, { f: 1500 + Math.random() * 2500, q: 4, vol: 0.18, dur: 0.04 }); },
  wave: (t) => { tone(t, { f: 220, to: 520, type: "sine", vol: 0.18, dur: 0.3 }); tone(t + 0.3, { f: 520, to: 200, type: "sine", vol: 0.15, dur: 0.3 }); hiss(t, { f: 900, q: 0.8, vol: 0.1, dur: 0.6, attack: 0.2 }); },
  roar: (t) => { tone(t, { f: 95, to: 70, type: "sawtooth", vol: 0.2, dur: 0.6, vib: 12 }); hiss(t, { f: 500, kind: "lowpass", vol: 0.2, dur: 0.6, attack: 0.05 }); },
  cloud: (t) => hiss(t, { f: 1200, to: 600, q: 0.7, vol: 0.25, dur: 0.85, attack: 0.25 }),
  curse: (t) => { tone(t, { f: 330, to: 140, type: "sine", vol: 0.15, dur: 0.75, vib: 18 }); tone(t, { f: 337, to: 146, type: "triangle", vol: 0.1, dur: 0.75, vib: 22 }); },
  aura: (t) => [392, 494, 587, 784].forEach((f, i) => tone(t + i * 0.08, { f, type: "triangle", vol: 0.12, dur: 0.2 })),
  heal: (t) => [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.09, { f, type: "sine", vol: 0.15, dur: 0.35 })),
  sleep: (t) => [523, 392, 330].forEach((f, i) => tone(t + i * 0.22, { f, type: "sine", vol: 0.12, dur: 0.3 })),
  drain: (t) => { tone(t, { f: 900, to: 200, type: "sine", vol: 0.15, dur: 0.6, vib: 10 }); hiss(t, { f: 3000, to: 500, q: 2, vol: 0.12, dur: 0.6, attack: 0.1 }); },
  spikes: (t) => { [0.12, 0.19, 0.26].forEach((d) => { hiss(t + d, { f: 2200, kind: "highpass", vol: 0.3, dur: 0.06 }); tone(t + d, { f: 300, to: 90, vol: 0.12, dur: 0.08 }); }); hiss(t + 0.1, { f: 180, kind: "lowpass", vol: 0.3, dur: 0.5 }); },
};

/* ── strato dell'elemento, all'impatto ── */
const ELEMENT = {
  fire: (t) => { for (let i = 0; i < 6; i++) hiss(t + Math.random() * 0.35, { f: 2500, kind: "highpass", vol: 0.12, dur: 0.03 }); hiss(t, { f: 600, kind: "lowpass", vol: 0.2, dur: 0.4 }); },
  cold: (t) => [2093, 2637, 3136].forEach((f, i) => tone(t + i * 0.05, { f, type: "sine", vol: 0.06, dur: 0.3 })),
  water: (t) => { for (let i = 0; i < 4; i++) tone(t + i * 0.06, { f: 400 + Math.random() * 300, to: 1200, type: "sine", vol: 0.08, dur: 0.07 }); },
  lightning: (t) => tone(t, { f: 110, type: "sawtooth", vol: 0.1, dur: 0.3, vib: 60 }),
  earth: (t) => tone(t, { f: 70, to: 40, type: "triangle", vol: 0.3, dur: 0.45 }),
  acid: (t) => hiss(t, { f: 5000, kind: "highpass", vol: 0.14, dur: 0.5, attack: 0.05 }),
  poison: (t) => { for (let i = 0; i < 5; i++) tone(t + i * 0.08, { f: 180 + Math.random() * 120, to: 400, type: "sine", vol: 0.08, dur: 0.06 }); },
  necrotic: (t) => tone(t, { f: 110, to: 80, type: "triangle", vol: 0.15, dur: 0.5, vib: 6 }),
  radiant: (t) => [1046, 1318, 1568].forEach((f) => tone(t, { f, type: "sine", vol: 0.05, dur: 0.6 })),
  psychic: (t) => tone(t, { f: 660, to: 990, type: "sine", vol: 0.07, dur: 0.5, vib: 30 }),
};
const IMPACT_AT = { stomp: 0.3, bite: 0.3, claw: 0.1, whip: 0.32, sting: 0.3, dash: 0.3, orb: 0.38, beam: 0.15, breath: 0.4, burst: 0, bolt: 0, rain: 0.2, wave: 0.4, cloud: 0.2, curse: 0.2, drain: 0.1, spikes: 0.15 };

export function sfx(ev) {
  if (!sfxOn || !ev) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.02;
  switch (ev.kind) {
    case "move":
      (SHAPES[ev.fx] || SHAPES.orb)(t);
      if (ev.mtype && ev.mtype !== "neutral" && IMPACT_AT[ev.fx] != null) ELEMENT[ev.mtype]?.(t + IMPACT_AT[ev.fx]);
      break;
    case "hit": // la botta che toglie i PF, più acuta se superefficace, doppia se critico
      tone(t, { f: ev.tm > 1 ? 520 : ev.tm < 1 ? 200 : 330, to: 90, vol: 0.18, dur: 0.12 });
      hiss(t, { f: 900, kind: "lowpass", vol: 0.3, dur: 0.1 });
      if (ev.crit) tone(t + 0.1, { f: 880, to: 1320, vol: 0.12, dur: 0.1 });
      if (ev.tm > 1) tone(t + 0.12, { f: 660, to: 990, vol: 0.1, dur: 0.12 });
      break;
    case "miss": swish(t, 2000, 400, 0.18); break;
    case "immune": tone(t, { f: 300, to: 280, type: "triangle", vol: 0.15, dur: 0.15 }); tone(t + 0.12, { f: 200, type: "triangle", vol: 0.12, dur: 0.2 }); break;
    case "heal": SHAPES.heal(t); break;
    case "buff": SHAPES.aura(t); break;
    case "debuff": [587, 494, 392].forEach((f, i) => tone(t + i * 0.08, { f, type: "triangle", vol: 0.1, dur: 0.15 })); break;
    case "status": tone(t, { f: 400, to: 250, vol: 0.1, dur: 0.25, vib: 20 }); break;
    case "stun": tone(t, { f: 700, type: "sine", vol: 0.1, dur: 0.5, vib: 120 }); break;
    case "dot": hiss(t, { f: 800, vol: 0.15, dur: 0.2 }); tone(t, { f: 220, to: 160, vol: 0.08, dur: 0.15 }); break;
    case "recoil": thud(t, 0.3); break;
    case "switch": tone(t, { f: 440, to: 880, type: "triangle", vol: 0.14, dur: 0.12 }); tone(t + 0.1, { f: 660, type: "triangle", vol: 0.12, dur: 0.1 }); break;
    case "faint": tone(t, { f: 600, to: 80, vol: 0.18, dur: 0.6 }); break;
    default: break;
  }
}

export function jingle(won) {
  if (!sfxOn) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.05;
  const notes = won ? [523, 659, 784, 1046, 784, 1046] : [392, 349, 311, 262];
  const step = won ? 0.12 : 0.22;
  notes.forEach((f, i) => tone(t + i * step, { f, type: "square", vol: 0.12, dur: won && i === notes.length - 1 ? 0.5 : step * 0.9 }));
  notes.forEach((f, i) => tone(t + i * step, { f: f / 2, type: "triangle", vol: 0.12, dur: step * 0.9 }));
}

/* ── MUSICA: giro di 4 battute in La minore (Am · F · G · E), 132 bpm ── */
const BPM = 132, STEP = 60 / BPM / 2; // crome
const MIDI = (n) => 440 * 2 ** ((n - 69) / 12);
const LEAD = [ // 8 crome per battuta, 0 = pausa
  [69, 72, 76, 72, 74, 72, 69, 0], [65, 69, 72, 69, 70, 69, 65, 0],
  [67, 71, 74, 71, 72, 74, 76, 0], [76, 75, 76, 71, 68, 71, 76, 0],
  [81, 0, 79, 76, 77, 76, 72, 0], [77, 0, 76, 72, 74, 72, 69, 0],
  [79, 0, 77, 74, 76, 74, 71, 0], [76, 0, 80, 0, 83, 0, 88, 0],
];
const BASS = [45, 41, 43, 40, 45, 41, 43, 40];
let timer = null, nextAt = 0, stepIdx = 0;

function schedule() {
  const c = ctx;
  while (nextAt < c.currentTime + 0.12) {
    const bar = Math.floor(stepIdx / 8) % LEAD.length, s = stepIdx % 8;
    const n = LEAD[bar][s];
    if (n) tone(nextAt, { f: MIDI(n), type: "square", vol: 0.07, dur: STEP * 0.85, out: musicBus });
    if (s % 2 === 0) tone(nextAt, { f: MIDI(BASS[bar] - (s === 4 ? 0 : 12) + 12), type: "triangle", vol: 0.16, dur: STEP * 1.7, out: musicBus });
    hiss(nextAt, { f: 7000, kind: "highpass", vol: s % 2 ? 0.04 : 0.07, dur: 0.03, out: musicBus });
    if (s === 0 || s === 4) tone(nextAt, { f: 120, to: 45, type: "sine", vol: 0.22, dur: 0.12, out: musicBus });
    nextAt += STEP;
    stepIdx += 1;
  }
}
function startLoop() {
  const c = getCtx();
  if (!c || c.state !== "running" || timer) return;
  nextAt = c.currentTime + 0.1;
  musicBus.gain.cancelScheduledValues(c.currentTime);
  musicBus.gain.setValueAtTime(0, c.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.5, c.currentTime + 1);
  timer = setInterval(schedule, 40);
  schedule();
}
function stopLoop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (ctx && musicBus) {
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0, ctx.currentTime);
  }
}

// La lotta chiama battleMusic(true) all'inizio e (false) alla fine.
export function battleMusic(on) {
  musicWanted = on;
  if (on && musicOn) unlock(); else stopLoop();
}
export function setMusicOn(v) {
  musicOn = v; write("pd_music", v);
  if (v && musicWanted) unlock(); else stopLoop();
  notify();
}
export function setSfxOn(v) {
  sfxOn = v; write("pd_sfx", v);
  if (v) unlock();
  notify();
}
export const audioPrefs = () => ({ musicOn, sfxOn });
export function onAudioPrefs(f) { listeners.add(f); return () => listeners.delete(f); }
