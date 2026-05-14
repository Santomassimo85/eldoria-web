/* ============================================================
   TCG battle BGM — calm classical loop synthesized on the fly
   with the Web Audio API. No external files; sine and triangle
   oscillators give it a soft, string-like timbre instead of the
   harsh chiptune square waves it used to be.

   The loop is a Pachelbel-Canon-style progression in C major:
     C  G  Am  Em  F  C  F  G
   …with a sustained lead voice over a walking bass and a gentle
   eighth-note arpeggio. Tempo ~70 BPM (largo/adagio).

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

/* C-major / A-minor diatonic notes across three octaves — enough
   range for the lead, bass, and arpeggio voices below. */
const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

/* Tempo: 70 BPM (largo). Each chord lasts 2 beats. */
const BPM       = 70;
const SEC_BEAT  = 60 / BPM;

/* Lead voice — sustained two-beat melodic line over each chord.
   Pachelbel-style descending top-voice canon, calmed down with
   long held notes instead of a fast melody. */
const LEAD = [
  ["E5", 2], ["D5", 2],   // C  → G
  ["C5", 2], ["B4", 2],   // Am → Em
  ["A4", 2], ["G4", 2],   // F  → C
  ["F4", 2], ["G4", 2],   // F  → G
];

/* Bass voice — root note of each chord, held for the full 2 beats. */
const BASS = [
  ["C3", 2], ["G3", 2],
  ["A3", 2], ["E3", 2],
  ["F3", 2], ["C3", 2],
  ["F3", 2], ["G3", 2],
];

/* Arpeggio voice — gentle eighth-note triad arpeggios on each
   chord (4 notes per beat, 2 beats per chord = 8 notes/chord). */
const ARP = [
  // C (C E G)
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  // G (G B D)
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
  // Am (A C E)
  ["A3", 0.5], ["C4", 0.5], ["E4", 0.5], ["C4", 0.5],
  ["A3", 0.5], ["C4", 0.5], ["E4", 0.5], ["C4", 0.5],
  // Em (E G B)
  ["E3", 0.5], ["G3", 0.5], ["B3", 0.5], ["G3", 0.5],
  ["E3", 0.5], ["G3", 0.5], ["B3", 0.5], ["G3", 0.5],
  // F (F A C)
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  // C (C E G)
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  // F (F A C)
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  // G (G B D)
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
];

const LOOP_BEATS = 16;
const LOOP_LEN   = LOOP_BEATS * SEC_BEAT;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.08;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

/* Schedule a single note. Soft envelope (longer attack/release)
   gives the sine voices a string-like swell instead of the abrupt
   click of a square wave. */
function note(startAt, freq, durSec, type, vol) {
  if (freq == null) return;
  const c = ctx;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  const peak = Math.max(0, vol);
  // Gentle attack/release so notes blend instead of clicking.
  const ATK = Math.min(0.08, durSec * 0.15);
  const REL = Math.min(0.18, durSec * 0.35);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + ATK);
  g.gain.setValueAtTime(peak, startAt + Math.max(ATK, durSec - REL));
  g.gain.linearRampToValueAtTime(0, startAt + durSec);
  osc.connect(g).connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.05);
}

/* Schedule one full 16-beat loop starting at `loopStart`. */
function scheduleOneLoop(loopStart) {
  let t = loopStart;
  for (const [n, b] of LEAD) {
    // Sine = soft, breath-like sustain for the melodic top voice.
    note(t, NOTE[n], b * SEC_BEAT * 0.95, "sine", 0.18);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of BASS) {
    // Triangle = warm, mellow bass with a hint of edge.
    note(t, NOTE[n], b * SEC_BEAT * 0.9, "triangle", 0.14);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of ARP) {
    // Sine arpeggio — kept very quiet so it sits behind the lead.
    note(t, NOTE[n], b * SEC_BEAT * 0.85, "sine", 0.05);
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

/* Wait for a real user gesture before scheduling notes. Browsers
   block AudioContext.start() on a suspended context and warn for
   every blocked oscillator — without this gate the scheduler ticks
   every 250 ms and floods the console (and burns CPU) with hundreds
   of "AudioContext was not allowed to start" warnings. */
let pendingStart = false;
function attachGestureUnlock() {
  if (pendingStart) return;
  pendingStart = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    window.removeEventListener("touchstart", onGesture, true);
    pendingStart = false;
    // Recurse — by now a gesture has happened, so the AudioContext
    // can be resumed without producing the autoplay warning.
    startBgm();
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  window.addEventListener("touchstart", onGesture, true);
}

export function startBgm() {
  if (isPlaying) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") {
    // No user gesture yet — defer everything. Don't read currentTime,
    // don't schedule notes, don't tick. Wait silently.
    attachGestureUnlock();
    c.resume().catch(() => {});
    return;
  }
  isPlaying = true;
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
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.08, now, 0.05);
  }
}
