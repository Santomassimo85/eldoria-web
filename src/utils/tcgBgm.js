/* ============================================================
   TCG battle BGM — chiptune music synthesized on the fly with
   the Web Audio API. No external files; pure square/triangle
   oscillators give the authentic low-bitrate NES feel.

   Public API:
     startBgm()        — begin the loop (no-op if already playing)
     stopBgm()         — silence and tear down audio nodes
     setBgmMuted(b)    — mute/unmute without stopping playback

   Browsers block audio before a user gesture; the first call to
   startBgm() will resume a suspended context, and if it's still
   suspended (zero gestures so far) the music waits silently for
   the next click.
   ============================================================ */

let ctx          = null;
let masterGain   = null;
let nextLoopTime = 0;
let scheduleId   = null;
let isPlaying    = false;
let muted        = false;

/* Frequencies for a one-octave bank (C minor pentatonic flavor) */
const NOTE = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, F3: 174.61, G3: 196.00, Ab3: 207.65, Bb3: 233.08,
  C4: 261.63, D4: 293.66, Eb4: 311.13, F4: 349.23, G4: 392.00, Ab4: 415.30, Bb4: 466.16,
  C5: 523.25, D5: 587.33, Eb5: 622.25, F5: 698.46, G5: 783.99,
};

/* Tempo: 132 BPM, four-on-the-floor feel for a battle. */
const BPM       = 132;
const SEC_BEAT  = 60 / BPM;

/* Lead melody — a heroic minor-key loop, 16 beats long. */
const LEAD = [
  ["C5", 1], ["Eb5", 1], ["G5", 1], ["Eb5", 1],
  ["F5", 1], ["Eb5", 1], ["D5", 1], ["C5", 1],
  ["Bb4", 1], ["C5", 1], ["D5", 1], ["Eb5", 1],
  ["D5", 1], ["C5", 1], ["G4", 1], [null, 1],
];

/* Bass: walking eighth notes following i-VI-VII-i progression. */
const BASS = [
  ["C3", 2], ["G3", 2], ["C3", 2], ["G3", 2],
  ["Ab3", 2], ["Eb3", 2], ["Ab3", 2], ["Eb3", 2],
  ["Bb3", 2], ["F3", 2], ["Bb3", 2], ["F3", 2],
  ["C3", 2], ["G3", 2], ["C3", 2], ["D3", 2],
];

/* Light arpeggio on a second voice for a bit of NES sparkle. */
const ARP = [
  ["G4", 0.5], ["Eb4", 0.5], ["C4", 0.5], ["Eb4", 0.5],
  ["G4", 0.5], ["Eb4", 0.5], ["C4", 0.5], ["Eb4", 0.5],
  ["Ab4", 0.5], ["F4", 0.5], ["C4", 0.5], ["F4", 0.5],
  ["Ab4", 0.5], ["F4", 0.5], ["C4", 0.5], ["F4", 0.5],
  ["Bb4", 0.5], ["F4", 0.5], ["D4", 0.5], ["F4", 0.5],
  ["Bb4", 0.5], ["F4", 0.5], ["D4", 0.5], ["F4", 0.5],
  ["G4", 0.5], ["Eb4", 0.5], ["C4", 0.5], ["Eb4", 0.5],
  ["G4", 0.5], ["Eb4", 0.5], ["D4", 0.5], ["G4", 0.5],
];

const LOOP_BEATS = 16;
const LOOP_LEN   = LOOP_BEATS * SEC_BEAT;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.10;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

/* Schedule a single note. Slight envelope so square waves don't click. */
function note(startAt, freq, durSec, type, vol) {
  if (freq == null) return;
  const c = ctx;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  const peak = Math.max(0, vol);
  const ATK  = 0.005;
  const REL  = Math.min(0.04, durSec * 0.4);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + ATK);
  g.gain.setValueAtTime(peak, startAt + Math.max(ATK, durSec - REL));
  g.gain.linearRampToValueAtTime(0, startAt + durSec);
  osc.connect(g).connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.02);
}

/* Schedule one full 16-beat loop starting at `loopStart`. */
function scheduleOneLoop(loopStart) {
  let t = loopStart;
  for (const [n, b] of LEAD) {
    note(t, NOTE[n], b * SEC_BEAT * 0.92, "square", 0.16);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of BASS) {
    note(t, NOTE[n], b * SEC_BEAT * 0.5, "triangle", 0.22);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of ARP) {
    note(t, NOTE[n], b * SEC_BEAT * 0.6, "square", 0.06);
    t += b * SEC_BEAT;
  }
}

/* Scheduler tick — schedules upcoming loops slightly ahead of the
   playback head so the music never drops out, but never queues
   more than ~4 seconds at a time. */
function tick() {
  if (!isPlaying || !ctx) return;
  const lookahead = 1.0; // sec
  while (nextLoopTime < ctx.currentTime + lookahead) {
    scheduleOneLoop(nextLoopTime);
    nextLoopTime += LOOP_LEN;
  }
  scheduleId = setTimeout(tick, 250);
}

export function startBgm() {
  if (isPlaying) return;
  const c = getCtx();
  if (!c) return;
  isPlaying = true;
  if (c.state === "suspended") c.resume().catch(() => {});
  nextLoopTime = c.currentTime + 0.1;
  tick();
}

export function stopBgm() {
  isPlaying = false;
  if (scheduleId) { clearTimeout(scheduleId); scheduleId = null; }
  if (ctx) {
    try {
      // Fade master out quickly before tearing down to avoid a click.
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.08);
      const oldCtx = ctx;
      ctx = null;
      masterGain = null;
      setTimeout(() => { oldCtx.close().catch(() => {}); }, 200);
    } catch {
      try { ctx.close(); } catch {}
      ctx = null;
      masterGain = null;
    }
  }
  nextLoopTime = 0;
}

export function setBgmMuted(m) {
  muted = !!m;
  if (masterGain && ctx) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.10, now, 0.05);
  }
}
