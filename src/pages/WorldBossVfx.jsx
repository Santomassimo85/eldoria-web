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

// File audio in public/sounds/. Heal ha il suo "holy cast"; gli altri elementali/magici condividono "spell".
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

function playEffectSound(effect) {
  const src = VFX_SOUNDS[effect];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = VFX_VOLUME;
    audio.play().catch(() => { /* autoplay bloccato fino al primo click utente */ });
  } catch { /* ignore */ }
}

// Mappa azione → chiave effetto. Cerca per parola chiave; fallback: slash per "Armi", magic per il resto.
export function pickEffectForAction(action) {
  if (!action) return "slash";
  const name = (action.name || "").toLowerCase();
  const cat  = (action.category || "").toLowerCase();
  // Cura ha precedenza su qualsiasi keyword (es. "Cura Ferite di Fuoco" → heal)
  if (/(cura|cure|guari|heal|parola guaritrice|lay of hands|ristora)/.test(name)) return "heal";
  // Elementi
  if (/(fuoco|fire|fiamm|brucia|incendio|palla di fuoco|dardo di fuoco|mani brucianti|rovente)/.test(name)) return "fire";
  if (/(freddo|gelo|frost|ice|ghiacc|raggio di gelo|tocco gelido|gelidito|cono di freddo|morso di gelo)/.test(name)) return "frost";
  if (/(fulmine|lightning|elettr|scossa folgorante|tempesta|fulminare|tuono|tonante|schianto)/.test(name)) return "lightning";
  if (/(veleno|poison|acid|tossico|spruzzo velenoso|nube|raggio avvelenato|braccia di hadar)/.test(name)) return "poison";
  // Armi a distanza (arco, balestra, armi da fuoco artefice…)
  if (/(arco|balestra|freccia|dardo|giavellotto|pistola|rifle|fucile|bow|crossbow|arrow)/.test(name)) return "ranged";
  // Categoria "Armi" → fendente generico
  if (cat === "armi") return "slash";
  // Tutto il resto (skill, buff, controllo senza elemento) → cerchio magico generico
  return "magic";
}

// Layer in portal: ascolta `messages`, su nuovi doc con effect+effectTargets piazza un video sopra il bersaglio.
export function VfxLayer({ messages }) {
  const seenRef = useRef(new Set());
  const mountedAtRef = useRef(Date.now());
  const [active, setActive] = useState([]);

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
      // Salta i messaggi storici al primo caricamento (evita "burst" iniziale).
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
        setTimeout(() => setActive(prev => prev.filter(a => a.id !== id)), 4000);
        if (!played) { playEffectSound(msg.effect); played = true; }
      }
    }
  }, [messages]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {active.map(({ id, effect, rect }) => {
        const src = VFX_FILES[effect] || VFX_FILES.slash;
        const size = Math.max(rect.width, rect.height) * 1.8;
        const style = {
          position: "fixed",
          left: rect.left + rect.width / 2 - size / 2,
          top:  rect.top  + rect.height / 2 - size / 2,
          width: size, height: size,
          pointerEvents: "none",
          zIndex: 9999,
          mixBlendMode: "screen",
        };
        const remove = () => setActive(prev => prev.filter(a => a.id !== id));
        if (isVideoFile(src)) {
          return <video key={id} src={src} autoPlay muted playsInline
                    onEnded={remove} onError={remove} style={style} />;
        }
        // Animated webp / png / gif → img (cleanup affidato al timeout di 4s).
        return <img key={id} src={src} alt="" onError={remove} style={style} />;
      })}
    </>,
    document.body
  );
}
