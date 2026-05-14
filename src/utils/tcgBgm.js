/* ============================================================
   TCG battle BGM — bouncy fantasy-village loop, synthesized on
   the fly with the Web Audio API. No external files; triangle and
   sine oscillators give it a warm, woody timbre — closer to a tin
   whistle + plucked lute than the slow string drone it was before.

   Loop: a cheerful I–V–vi–IV / I–V–IV–V progression (Pachelbel-
   adjacent but happier and more melodic) at ~96 BPM. The lead
   phrases breathe (eighth-note runs broken up by rests) so the
   loop doesn't blur into a wall of sound.

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

/* Diatonic notes spanning the lead, bass, and arpeggio ranges. */
const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

/* Tempo: 96 BPM (allegro moderato — bouncy, never frantic). */
const BPM       = 96;
const SEC_BEAT  = 60 / BPM;

/* 8 chords × 2 beats = 16 beats per loop.
   Chord plan: C  G  Am  F  C  G  F  G  (happy folk-pop progression). */

/* Lead voice — short bouncy phrases with rests so the loop has
   "breath" and doesn't feel like a sustained drone. A null note
   = rest (the note() function treats freq=null as silence). */
const LEAD = [
  // C  → playful opening: triadic skip + rest
  ["E5", 0.5], ["G5", 0.5], ["E5", 0.5], [null, 0.5],
  // G  → answering phrase
  ["D5", 0.5], ["G5", 0.5], ["D5", 0.5], [null, 0.5],
  // Am → gentle dip into the relative minor
  ["C5", 0.5], ["E5", 0.5], ["A4", 1.0],
  // F  → uplifting climb
  ["F4", 0.5], ["A4", 0.5], ["C5", 1.0],
  // C  → return home, melodic ornament
  ["G4", 0.5], ["E5", 0.5], ["G5", 0.5], ["E5", 0.5],
  // G
  ["D5", 0.5], ["B4", 0.5], ["G4", 0.5], [null, 0.5],
  // F  → sustained, then walk down
  ["A4", 0.5], ["C5", 0.5], ["A4", 1.0],
  // G  → setup for next loop iteration
  ["B4", 0.5], ["D5", 0.5], ["G4", 1.0],
];

/* Bass voice — root + fifth pulse (root on beat 1, fifth on beat 2)
   to make the harmony feel like a strolling lute, not a held drone. */
const BASS = [
  // C
  ["C3", 1], ["G3", 1],
  // G
  ["G3", 1], ["D3", 1],
  // Am
  ["A3", 1], ["E3", 1],
  // F
  ["F3", 1], ["C3", 1],
  // C
  ["C3", 1], ["G3", 1],
  // G
  ["G3", 1], ["D3", 1],
  // F
  ["F3", 1], ["C3", 1],
  // G
  ["G3", 1], ["D3", 1],
];

/* Arpeggio voice — sparse triad sparkles, 4 notes per chord, kept
   well below the lead in volume so it sits behind the melody. */
const ARP = [
  // C
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  // G
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
  // Am
  ["A3", 0.5], ["C4", 0.5], ["E4", 0.5], ["C4", 0.5],
  // F
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  // C
  ["C4", 0.5], ["E4", 0.5], ["G4", 0.5], ["E4", 0.5],
  // G
  ["G3", 0.5], ["B3", 0.5], ["D4", 0.5], ["B3", 0.5],
  // F
  ["F3", 0.5], ["A3", 0.5], ["C4", 0.5], ["A3", 0.5],
  // G
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
    masterGain.gain.value = muted ? 0 : 0.07;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

/* Schedule a single note. A slightly snappier attack (vs. the old
   slow swell) gives notes a "plucked" feel; the release still
   tapers smoothly so adjacent notes don't click. */
function note(startAt, freq, durSec, type, vol) {
  if (freq == null) return; // rest
  const c = ctx;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  const peak = Math.max(0, vol);
  const ATK = Math.min(0.015, durSec * 0.05); // fast pluck
  const REL = Math.min(0.14, durSec * 0.45);  // gentle tail
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + ATK);
  g.gain.setValueAtTime(peak, startAt + Math.max(ATK, durSec - REL));
  g.gain.exponentialRampToValueAtTime(0.001, startAt + durSec);
  osc.connect(g).connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.05);
}

/* Schedule one full 16-beat loop starting at `loopStart`. */
function scheduleOneLoop(loopStart) {
  let t = loopStart;
  for (const [n, b] of LEAD) {
    // Triangle = warm, woody, tin-whistle-ish lead.
    note(t, NOTE[n], b * SEC_BEAT * 0.85, "triangle", 0.16);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of BASS) {
    // Triangle bass with shorter sustain → walking lute feel.
    note(t, NOTE[n], b * SEC_BEAT * 0.65, "triangle", 0.13);
    t += b * SEC_BEAT;
  }
  t = loopStart;
  for (const [n, b] of ARP) {
    // Sine sparkles — light, sits behind the lead.
    note(t, NOTE[n], b * SEC_BEAT * 0.7, "sine", 0.045);
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
   every 250 ms and floods the console with hundreds of warnings. */
let pendingStart = false;
function attachGestureUnlock() {
  if (pendingStart) return;
  pendingStart = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    window.removeEventListener("touchstart", onGesture, true);
    pendingStart = false;
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
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.07, now, 0.05);
  }
}
