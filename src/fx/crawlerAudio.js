/* Audio procedurale WebAudio per Le Segrete e La Torre di Vethrik:
   - Passi del gruppo sul pavimento del dungeon (pietra, ghiaccio, acqua/palude, metallo, sabbia/roccia)
   - Sblocco del sigillo e apertura pesante delle porte runiche/corazzate a fine piano. */

let actx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!actx) {
    try { actx = new AC(); } catch { return null; }
  }
  if (actx.state === "suspended") {
    actx.resume().catch(() => {});
  }
  return actx;
}

let noiseBuf = null;
function getNoise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 1.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
}

function singleStep(ctx, t0, isLeft, theme = "segrete", gainScale = 1) {
  const now = Math.max(ctx.currentTime, t0);
  const pitchVar = (isLeft ? 0.96 : 1.04) * (0.97 + Math.random() * 0.06);

  // 1. Impatto del tacco/stivale (colpo grave)
  const osc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(105 * pitchVar, now);
  osc.frequency.exponentialRampToValueAtTime(36 * pitchVar, now + 0.085);
  thudGain.gain.setValueAtTime(0.0001, now);
  thudGain.gain.linearRampToValueAtTime(0.24 * gainScale, now + 0.008);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
  osc.connect(thudGain);
  thudGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  // 2. Attrito della suola sulla superficie (pietra / ghiaccio / acqua / ferro)
  const noise = ctx.createBufferSource();
  noise.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  const gritGain = ctx.createGain();

  const isWet = theme === "palude" || theme === "abisso";
  const isIce = theme === "ghiaccio";
  const isMetal = theme === "forgia";

  filter.type = "bandpass";
  const baseFreq = isIce ? 2100 : isMetal ? 1450 : isWet ? 780 : 1050;
  filter.frequency.setValueAtTime(baseFreq * pitchVar, now);
  filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.65 * pitchVar, now + 0.09);
  filter.Q.value = isIce ? 3.2 : isWet ? 2.4 : 1.8;

  gritGain.gain.setValueAtTime(0.0001, now);
  gritGain.gain.linearRampToValueAtTime(0.16 * gainScale, now + 0.012);
  gritGain.gain.exponentialRampToValueAtTime(0.0001, now + (isWet ? 0.13 : 0.085));

  noise.connect(filter);
  filter.connect(gritGain);
  gritGain.connect(ctx.destination);
  noise.start(now, Math.random() * 0.8, 0.15);
  noise.stop(now + 0.15);

  // 3. Leggero tintinnio metallico di armatura / equipaggiamento
  if (Math.random() < 0.75) {
    const clink = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clink.type = "sine";
    const cf = (isMetal ? 1950 : 2650) * pitchVar;
    clink.frequency.setValueAtTime(cf, now + 0.015);
    clink.frequency.exponentialRampToValueAtTime(cf * 0.82, now + 0.065);
    clinkGain.gain.setValueAtTime(0.0001, now + 0.015);
    clinkGain.gain.linearRampToValueAtTime(0.022 * gainScale, now + 0.022);
    clinkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    clink.connect(clinkGain);
    clinkGain.connect(ctx.destination);
    clink.start(now + 0.015);
    clink.stop(now + 0.075);
  }
}

export function playFootstep(stepIndex = 0, theme = "segrete", partySize = 1) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const isLeft = stepIndex % 2 === 0;
  singleStep(ctx, now, isLeft, theme, 1);

  // Passi dei compagni di gruppo leggermente sfalsati per dare il senso della compagnia in marcia
  const companions = Math.min(3, Math.max(0, (Number(partySize) || 1) - 1));
  for (let c = 0; c < companions; c++) {
    const delay = 0.038 * (c + 1) + Math.random() * 0.018;
    singleStep(ctx, now + delay, (stepIndex + c + 1) % 2 === 0, theme, 0.48 - c * 0.1);
  }
}

export function playDoorOpen(doorKind = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const isMagic = doorKind === 0 || doorKind === 3; // 0 = runica, 3 = draconica/boss

  // 1. Scatto della serratura / attivazione del sigillo runico
  if (isMagic) {
    const freqs = doorKind === 3 ? [220, 330, 440, 660] : [293.66, 440, 587.33, 880];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const t = now + idx * 0.035;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.06, t + 0.38);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  } else {
    // Scatto metallico del chiavistello
    const latch = ctx.createOscillator();
    const lg = ctx.createGain();
    latch.type = "square";
    latch.frequency.setValueAtTime(320, now);
    latch.frequency.exponentialRampToValueAtTime(110, now + 0.07);
    lg.gain.setValueAtTime(0.0001, now);
    lg.gain.linearRampToValueAtTime(0.12, now + 0.008);
    lg.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    latch.connect(lg);
    lg.connect(ctx.destination);
    latch.start(now);
    latch.stop(now + 0.09);
  }

  // 2. Scorrimento / apertura dei pesanti battenti di pietra e ferro
  const slideStart = now + 0.09;
  const slideDur = 0.52;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoise(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = "bandpass";
  lp.frequency.setValueAtTime(150, slideStart);
  lp.frequency.linearRampToValueAtTime(240, slideStart + slideDur * 0.5);
  lp.frequency.linearRampToValueAtTime(120, slideStart + slideDur);
  lp.Q.value = 2.2;

  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, slideStart);
  sg.gain.linearRampToValueAtTime(0.22, slideStart + 0.08);
  sg.gain.setValueAtTime(0.2, slideStart + slideDur - 0.1);
  sg.gain.exponentialRampToValueAtTime(0.0001, slideStart + slideDur);

  noise.connect(lp);
  lp.connect(sg);
  sg.connect(ctx.destination);
  noise.start(slideStart, 0, slideDur + 0.05);
  noise.stop(slideStart + slideDur + 0.05);

  // 3. Rombo grave dei cardini e arresto finale dei battenti
  const rumble = ctx.createOscillator();
  const rg = ctx.createGain();
  rumble.type = "sawtooth";
  rumble.frequency.setValueAtTime(64, slideStart);
  rumble.frequency.linearRampToValueAtTime(78, slideStart + slideDur * 0.6);
  rumble.frequency.exponentialRampToValueAtTime(42, slideStart + slideDur);
  const rlp = ctx.createBiquadFilter();
  rlp.type = "lowpass";
  rlp.frequency.value = 160;
  rg.gain.setValueAtTime(0.0001, slideStart);
  rg.gain.linearRampToValueAtTime(0.14, slideStart + 0.06);
  rg.gain.exponentialRampToValueAtTime(0.0001, slideStart + slideDur + 0.04);
  rumble.connect(rlp);
  rlp.connect(rg);
  rg.connect(ctx.destination);
  rumble.start(slideStart);
  rumble.stop(slideStart + slideDur + 0.05);
}
