import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./DiceRoll.css";

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
    <div className={`dice-overlay ${variant}`} key={roll.id} aria-hidden="true">
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
