import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./DiceRoll.css";

/* ── Skin del dado ───────────────────────────────────────────────
   Ogni giocatore sceglie l'aspetto del proprio d20 (menu "I Tuoi Dadi"
   nell'Arena). La scelta è puramente visiva e locale: il numero, il
   critico (20) e il fallimento (1) restano sempre evidenziati in
   oro/rosso così da non perdere il segnale di gioco — la skin colora
   solo i tiri "normali".
────────────────────────────────────────────────────────────────*/
export const DICE_SKINS = [
  // 5 colori base
  { id: "classic",   label: "Oro Antico",  kind: "base",    glyph: "🎲" },
  { id: "rubino",    label: "Rubino",      kind: "base",    glyph: "🔴" },
  { id: "zaffiro",   label: "Zaffiro",     kind: "base",    glyph: "🔵" },
  { id: "smeraldo",  label: "Smeraldo",    kind: "base",    glyph: "🟢" },
  { id: "ossidiana", label: "Ossidiana",   kind: "base",    glyph: "⚫" },
  // 5 speciali con effetti animati
  { id: "damascato", label: "Acciaio Damascato", kind: "special", glyph: "🗡", desc: "Trame d'acciaio forgiato" },
  { id: "arcano",    label: "Arcano",            kind: "special", glyph: "✨", desc: "Bagliore magico pulsante" },
  { id: "infernale", label: "Infernale",         kind: "special", glyph: "🔥", desc: "Crepe di lava ardente" },
  { id: "glaciale",  label: "Glaciale",          kind: "special", glyph: "❄",  desc: "Ghiaccio scintillante" },
  { id: "cosmico",   label: "Cosmico",           kind: "special", glyph: "🌌", desc: "Nebulosa stellare" },
];

const DEFAULT_SKIN = "classic";
const VALID_SKINS = new Set(DICE_SKINS.map((s) => s.id));

let currentSkin = DEFAULT_SKIN;

/** Imposta la skin attiva del dado (chiamata dal menu "I Tuoi Dadi"). */
export function setDiceSkin(id) {
  currentSkin = VALID_SKINS.has(id) ? id : DEFAULT_SKIN;
}
/** Skin attiva del dado. */
export function getDiceSkin() {
  return currentSkin;
}

/* ── Module-level singleton ─────────────────────────────────────
   The host component registers a trigger; callers anywhere in the
   app can `await showD20Roll(value)` and get a promise that
   resolves once the animation has finished playing.  If the host
   is not mounted, the call resolves immediately (so wrapping a
   roll never blocks logic — it just degrades to no animation).
────────────────────────────────────────────────────────────────*/
let trigger = null;

export function showD20Roll(value, opts = {}) {
  if (!trigger) return Promise.resolve();
  return trigger(value, opts);
}

/* ── Host ───────────────────────────────────────────────────── */
export default function DiceRollHost() {
  const [roll, setRoll] = useState(null);

  useEffect(() => {
    trigger = (value, opts) =>
      new Promise((resolve) => {
        setRoll({
          id: Math.random().toString(36).slice(2),
          value,
          label: opts.label || "",
          // La skin si legge al momento del tiro: rispecchia sempre la scelta corrente.
          skin: VALID_SKINS.has(currentSkin) ? currentSkin : DEFAULT_SKIN,
          resolve,
        });
      });
    return () => { trigger = null; };
  }, []);

  // Animation timing
  const TUMBLE_MS = 750;   // chaotic spin
  const SETTLE_MS = 450;   // settle / reveal
  const HOLD_MS   = 550;   // pause showing the result
  const FADE_MS   = 280;   // fade out

  useEffect(() => {
    if (!roll) return;
    // Sblocco la logica (risultato + effetti pixel) appena il dado si FERMA sul
    // numero (tumble+settle), così il colpo è sincronizzato con la rivelazione.
    // L'overlay del dado resta visibile per hold+fade e si smonta da solo dopo.
    const revealAt = TUMBLE_MS + SETTLE_MS;
    const total    = revealAt + HOLD_MS + FADE_MS;
    const tReveal = setTimeout(() => roll.resolve(), revealAt);
    const tEnd    = setTimeout(() => setRoll(null), total);
    return () => { clearTimeout(tReveal); clearTimeout(tEnd); };
  }, [roll]);

  if (!roll) return null;

  const isCrit = roll.value === 20;
  const isFumble = roll.value === 1;
  const variant = isCrit ? "crit" : isFumble ? "fumble" : "normal";

  return createPortal(
    <div className={`dice-overlay ${variant} skin-${roll.skin}`} key={roll.id} aria-hidden="true">
      <div
        className="dice-d20"
        style={{
          "--tumble-ms": `${TUMBLE_MS}ms`,
          "--settle-ms": `${SETTLE_MS}ms`,
          "--hold-ms":   `${HOLD_MS}ms`,
          "--fade-ms":   `${FADE_MS}ms`,
        }}
      >
        <div className="dice-d20-face">
          <span className="dice-d20-num">{roll.value}</span>
        </div>
        <div className="dice-d20-glow" />
      </div>
      {roll.label && <div className="dice-label">{roll.label}</div>}
      {isCrit  && <div className="dice-tag crit">CRITICO!</div>}
      {isFumble && <div className="dice-tag fumble">FALLIMENTO</div>}
    </div>,
    document.body
  );
}
