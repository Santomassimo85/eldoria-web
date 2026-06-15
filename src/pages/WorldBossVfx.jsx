import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// File in public/animations/. Provenienza consigliata: JB2A free pack (CC BY-NC-SA 4.0).
// Supporta sia .webm (video) sia .webp animati (img).
const VFX_FILES = {
  slash:     "/animations/slash.webp",
  ranged:    "/animations/ranged.webp",
  fire:      "/animations/fire.webp",
  frost:     "/animations/frost.webp",
  lightning: "/animations/lightning.webp",
  poison:    "/animations/poison.webm",
  heal:      "/animations/heal.webp",
  magic:     "/animations/magic.webp",
};

const isVideoFile = (src) => /\.(webm|mp4)$/i.test(src || "");

// iOS Safari (incluso PWA) non decodifica webm: fallback a magic.webp per "poison".
const canPlayWebm = (() => {
  if (typeof document === "undefined") return true;
  const v = document.createElement("video");
  return !!(v.canPlayType('video/webm; codecs="vp8,vp9"') || v.canPlayType("video/webm"));
})();

const VFX_SOUNDS = {
  slash:     "/sounds/slash.mp3",
  ranged:    "/sounds/ranged.mp3",
  heal:      "/sounds/heal.mp3",
  fire:      "/sounds/spell.mp3",
  frost:     "/sounds/spell.mp3",
  lightning: "/sounds/spell.mp3",
  poison:    "/sounds/spell.mp3",
  magic:     "/sounds/spell.mp3",
};
const VFX_VOLUME = 0.4;
const VFX_DURATION_MS = 1500;

// Alone colorato dietro l'effetto, per dare profondità e leggibilità anche se la webp è "magra".
const GLOW_COLOR = {
  slash:     "rgba(255,200,180,0.85)",
  ranged:    "rgba(230,200,140,0.75)",
  fire:      "rgba(255,120,40,0.9)",
  frost:     "rgba(140,200,255,0.9)",
  lightning: "rgba(230,230,140,0.95)",
  poison:    "rgba(120,220,120,0.85)",
  heal:      "rgba(255,240,180,0.9)",
  magic:     "rgba(180,120,255,0.85)",
};

// ── Audio: Web Audio API. Funziona in iOS PWA dopo un singolo "resume" su gesto utente.
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

function playEffectSound(effect) {
  const ctx = getCtx();
  const buf = audioBuffers[effect];
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

// ── Stile keyframes iniettato una volta sola.
const STYLE_ID = "wb-vfx-style";
function ensureStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes wb-vfx-pop {
      0%   { opacity: 0; transform: scale(0.45) rotate(-6deg); filter: blur(8px); }
      22%  { opacity: 1; transform: scale(1.18) rotate(3deg); filter: blur(0); }
      55%  { opacity: 1; transform: scale(1.0) rotate(0deg); filter: blur(0); }
      100% { opacity: 0; transform: scale(1.08) rotate(0deg); filter: blur(3px); }
    }
    @keyframes wb-vfx-glow {
      0%   { opacity: 0; transform: scale(0.5); }
      30%  { opacity: 0.85; transform: scale(1.25); }
      70%  { opacity: 0.4; transform: scale(1.45); }
      100% { opacity: 0; transform: scale(1.7); }
    }
  `;
  document.head.appendChild(s);
}

// Tipo di danno scelto nell'editor (WorldBossAdmin) → chiave effetto webp.
// "fisico"/"arcano" non hanno una webp dedicata: ricadono su slash/magic.
const DMGTYPE_EFFECT = {
  fuoco: "fire", ghiaccio: "frost", fulmine: "lightning", veleno: "poison",
  "oscurità": "magic", oscurita: "magic", sacro: "heal", fisico: "slash", arcano: "magic",
  fire: "fire", frost: "frost", lightning: "lightning", poison: "poison",
  darkness: "magic", radiant: "heal", physical: "slash", arcane: "magic",
};

// Mappa azione → chiave effetto. Il tipo di danno esplicito vince; altrimenti cerca
// per parola chiave; fallback: slash per "Armi", magic per il resto.
export function pickEffectForAction(action) {
  if (!action) return "slash";
  const name = (action.name || "").toLowerCase();
  const cat  = (action.category || "").toLowerCase();
  // Una cura resta una cura anche se le si assegna un tipo di danno.
  if (/(cura|cure|guari|heal|parola guaritrice|lay of hands|ristora)/.test(name)) return "heal";
  const explicit = DMGTYPE_EFFECT[(action.dmgType || "").toLowerCase().trim()];
  if (explicit) return explicit;
  if (/(fuoco|fire|fiamm|brucia|incendio|palla di fuoco|dardo di fuoco|mani brucianti|rovente)/.test(name)) return "fire";
  if (/(freddo|gelo|frost|ice|ghiacc|raggio di gelo|tocco gelido|gelidito|cono di freddo|morso di gelo)/.test(name)) return "frost";
  if (/(fulmine|lightning|elettr|scossa folgorante|tempesta|fulminare|tuono|tonante|schianto)/.test(name)) return "lightning";
  if (/(veleno|poison|acid|tossico|spruzzo velenoso|nube|raggio avvelenato|braccia di hadar)/.test(name)) return "poison";
  if (/(arco|balestra|freccia|dardo|giavellotto|pistola|rifle|fucile|bow|crossbow|arrow)/.test(name)) return "ranged";
  if (cat === "armi") return "slash";
  return "magic";
}

// Layer in portal: ascolta `messages`, su nuovi doc con effect+effectTargets piazza un VFX sopra il bersaglio.
export function VfxLayer({ messages }) {
  const seenRef = useRef(new Set());
  const mountedAtRef = useRef(Date.now());
  const [active, setActive] = useState([]);

  useEffect(() => { ensureStyle(); }, []);

  useEffect(() => {
    if (!messages?.length) return;
    for (const msg of messages) {
      if (!msg.id || seenRef.current.has(msg.id)) continue;
      const targets = Array.isArray(msg.effectTargets)
        ? msg.effectTargets
        : (msg.effectTarget ? [msg.effectTarget] : []);
      if (!msg.effect || !targets.length) {
        seenRef.current.add(msg.id);
        continue;
      }
      const ts = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : 0;
      if (ts && ts < mountedAtRef.current - 5000) {
        seenRef.current.add(msg.id);
        continue;
      }
      seenRef.current.add(msg.id);
      let played = false;
      for (const t of targets) {
        const el = document.querySelector(`[data-vfx-target="${t}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const id = `${msg.id}-${t}-${Math.random().toString(36).slice(2, 7)}`;
        setActive(prev => [...prev, { id, effect: msg.effect, rect }]);
        setTimeout(() => setActive(prev => prev.filter(a => a.id !== id)), VFX_DURATION_MS + 100);
        if (!played) { playEffectSound(msg.effect); played = true; }
      }
    }
  }, [messages]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {active.map(({ id, effect, rect }) => {
        let src = VFX_FILES[effect] || VFX_FILES.slash;
        if (isVideoFile(src) && !canPlayWebm) src = VFX_FILES.magic;
        const size = Math.max(rect.width, rect.height) * 1.8;
        const wrapperStyle = {
          position: "fixed",
          left: rect.left + rect.width / 2 - size / 2,
          top:  rect.top  + rect.height / 2 - size / 2,
          width: size, height: size,
          pointerEvents: "none",
          zIndex: 9999,
        };
        const glowStyle = {
          position: "absolute", inset: 0,
          background: `radial-gradient(circle, ${GLOW_COLOR[effect] || GLOW_COLOR.magic} 0%, transparent 62%)`,
          animation: `wb-vfx-glow ${VFX_DURATION_MS}ms ease-out forwards`,
          mixBlendMode: "screen",
          willChange: "transform, opacity",
        };
        const innerStyle = {
          width: "100%", height: "100%",
          mixBlendMode: "screen",
          animation: `wb-vfx-pop ${VFX_DURATION_MS}ms cubic-bezier(.2,.7,.3,1) forwards`,
          willChange: "transform, opacity, filter",
        };
        // Cache-bust: alcuni browser mobili mostrano l'ultimo frame della webp riusata; con ?t=<id> ogni mount è una decode fresca.
        const bustedSrc = `${src}?t=${encodeURIComponent(id)}`;
        return (
          <div key={id} style={wrapperStyle}>
            <div style={glowStyle} />
            {isVideoFile(src) ? (
              <video src={bustedSrc} autoPlay muted playsInline style={innerStyle} />
            ) : (
              <img src={bustedSrc} alt="" style={innerStyle} />
            )}
          </div>
        );
      })}
    </>,
    document.body
  );
}
