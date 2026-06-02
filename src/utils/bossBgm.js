/* ============================================================
   Boss-fight BGM — plays /public/BossBattleTheme.mid on loop.

   Browsers can't decode .mid with <audio>, so we PARSE the MIDI
   ourselves and re-synthesize it with the Web Audio API (soft
   triangle voices, low master volume) — same engine family as the
   TCG BGM. The whole song loops for the duration of the fight.

   Public API:
     startBossBgm()     — load (once) + play on loop
     stopBossBgm()      — silence and tear down
     setBossBgmMuted(b) — mute/unmute without stopping

   Like all web audio, playback can only begin after a user gesture;
   the first start attaches a one-shot gesture listener if needed.
   ============================================================ */

const MIDI_URL = "/BossBattleTheme.mid";
const VOLUME = 0.06;            // master gain — deliberately low / unobtrusive
const LOOP_GAP = 1.0;           // seconds of silence appended before the loop repeats

// ── MIDI parsing (dependency-free) ──────────────────────────────────────────
// Returns { notes: [{ t, dur, freq, vel }], duration } in seconds. Drum channel
// (10 / index 9) is skipped — oscillator drums sound bad. Exported for testing.
export function parseMidi(buf) {
  const v = new DataView(buf);
  let p = 0;
  const u8 = () => v.getUint8(p++);
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const varlen = () => { let val = 0, b; do { b = v.getUint8(p++); val = (val << 7) | (b & 0x7f); } while (b & 0x80); return val; };

  if (u32() !== 0x4d546864) throw new Error("not a MIDI file"); // 'MThd'
  const hlen = u32();
  u16();                              // format
  const ntracks = u16();
  const division = u16();
  p = 8 + hlen;                       // jump to first track

  const tempoEvents = [];             // { tick, us }
  const rawNotes = [];                // { startTick, endTick, note, ch, vel }

  for (let tr = 0; tr < ntracks; tr++) {
    if (p + 8 > v.byteLength) break;
    const id = u32();
    const len = u32();
    const end = Math.min(p + len, v.byteLength);
    if (id !== 0x4d54726b) { p = end; continue; }   // 'MTrk'
    let tick = 0, status = 0;
    const active = new Map();          // "ch:note" → [{ startTick, vel }]
    while (p < end) {
      tick += varlen();
      const b = v.getUint8(p);
      if (b & 0x80) { status = b; p++; }            // new status (else running status)
      const type = status & 0xf0, ch = status & 0x0f;
      if (status === 0xff) {                          // meta event
        const meta = u8();
        const mlen = varlen();
        if (meta === 0x51 && mlen === 3) {
          const us = (v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2);
          tempoEvents.push({ tick, us });
        }
        p += mlen;
        if (meta === 0x2f) break;                     // end of track
      } else if (status === 0xf0 || status === 0xf7) { // sysex
        p += varlen();
      } else if (type === 0x90) {                     // note on
        const note = u8(), vel = u8();
        if (vel > 0) {
          const k = ch + ":" + note;
          if (!active.has(k)) active.set(k, []);
          active.get(k).push({ startTick: tick, vel });
        } else closeNote(active, ch, note, tick, rawNotes);
      } else if (type === 0x80) {                     // note off
        const note = u8(); u8();
        closeNote(active, ch, note, tick, rawNotes);
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        p += 2;                                        // 2 data bytes
      } else if (type === 0xc0 || type === 0xd0) {
        p += 1;                                        // 1 data byte
      } else break;                                    // unknown → bail this track
    }
    p = end;
  }

  tempoEvents.sort((a, b) => a.tick - b.tick);
  const PPQ = (division & 0x8000) ? 480 : (division || 480);   // assume PPQ (SMPTE→fallback)
  const tickToSec = (tick) => {
    let sec = 0, lastTick = 0, us = 500000;             // default 120 BPM
    for (const te of tempoEvents) {
      if (te.tick > tick) break;
      sec += (te.tick - lastTick) * (us / 1e6) / PPQ;
      lastTick = te.tick; us = te.us;
    }
    return sec + (tick - lastTick) * (us / 1e6) / PPQ;
  };

  const notes = [];
  let duration = 0;
  for (const rn of rawNotes) {
    if (rn.ch === 9) continue;                          // skip drums
    const t = tickToSec(rn.startTick);
    const tend = tickToSec(rn.endTick);
    notes.push({ t, dur: Math.max(0.05, tend - t), freq: 440 * Math.pow(2, (rn.note - 69) / 12), vel: rn.vel / 127 });
    if (tend > duration) duration = tend;
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, duration };
}

function closeNote(active, ch, note, tick, out) {
  const arr = active.get(ch + ":" + note);
  if (arr && arr.length) {
    const s = arr.shift();
    out.push({ startTick: s.startTick, endTick: tick, note, ch, vel: s.vel });
  }
}

// ── Web Audio playback ──────────────────────────────────────────────────────
let ctx = null, masterGain = null;
let notes = null, loopLen = 0, loading = null;
let isPlaying = false, muted = false;
let scheduleId = null;
let loopStartTime = 0, noteIdx = 0;   // playback head across loop iterations

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : VOLUME;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

async function load() {
  if (notes) return;
  if (!loading) {
    loading = fetch(MIDI_URL)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then((buf) => { const parsed = parseMidi(buf); notes = parsed.notes; loopLen = parsed.duration + LOOP_GAP; })
      .catch((e) => { console.warn("Boss BGM: load/parse failed", e); notes = []; });
  }
  await loading;
}

// One soft note (triangle, quick attack, gentle tail) — same envelope shape as
// the TCG BGM so the timbre stays warm and never clicks.
function playNote(startAt, freq, durSec, vel) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  const peak = Math.max(0, vel) * 0.5;
  const ATK = Math.min(0.02, durSec * 0.1);
  const REL = Math.min(0.18, durSec * 0.5);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + ATK);
  g.gain.setValueAtTime(peak, startAt + Math.max(ATK, durSec - REL));
  g.gain.exponentialRampToValueAtTime(0.001, startAt + durSec);
  osc.connect(g).connect(masterGain);
  osc.start(startAt);
  osc.stop(startAt + durSec + 0.05);
}

// Schedule only the notes inside the ~1s lookahead window, advancing the head
// across loop boundaries — so a dense 3-minute song never creates thousands of
// oscillator nodes at once.
function tick() {
  if (!isPlaying || !ctx) return;
  const horizon = ctx.currentTime + 1.0;
  let guard = 0;
  while (guard++ < 8000) {
    if (noteIdx >= notes.length) {        // wrap to the next loop iteration
      loopStartTime += loopLen;
      noteIdx = 0;
      if (!notes.length) break;
    }
    const n = notes[noteIdx];
    const at = loopStartTime + n.t;
    if (at >= horizon) break;
    playNote(at, n.freq, n.dur, n.vel);
    noteIdx++;
  }
  scheduleId = setTimeout(tick, 200);
}

let pendingStart = false;
function attachGestureUnlock() {
  if (pendingStart) return;
  pendingStart = true;
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    window.removeEventListener("touchstart", onGesture, true);
    pendingStart = false;
    startBossBgm();
  };
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  window.addEventListener("touchstart", onGesture, true);
}

export async function startBossBgm() {
  if (isPlaying) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") { attachGestureUnlock(); c.resume().catch(() => {}); return; }
  await load();
  if (isPlaying || !notes || !notes.length || !ctx) return;
  isPlaying = true;
  loopStartTime = ctx.currentTime + 0.15;
  noteIdx = 0;
  tick();
}

export function stopBossBgm() {
  isPlaying = false;
  if (scheduleId) { clearTimeout(scheduleId); scheduleId = null; }
  if (ctx) {
    try {
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + 0.1);
      const old = ctx;
      ctx = null; masterGain = null;
      setTimeout(() => { old.close().catch(() => {}); }, 250);
    } catch {
      try { ctx.close(); } catch { /* */ }
      ctx = null; masterGain = null;
    }
  }
  loopStartTime = 0; noteIdx = 0;
}

export function setBossBgmMuted(m) {
  muted = !!m;
  if (masterGain && ctx) {
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(muted ? 0 : VOLUME, now, 0.05);
  }
}
