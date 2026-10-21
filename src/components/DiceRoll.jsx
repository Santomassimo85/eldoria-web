import { useEffect, useRef, useState } from "react";
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
// Promessa del tiro ancora a schermo: se un nuovo tiro lo sostituisce prima della
// rivelazione (IA e umano quasi in contemporanea), va risolta subito, altrimenti chi
// la aspettava (es. il turno dell'IA) resterebbe appeso per sempre.
let pendingResolve = null;

// ── Dado 3D (2026-10-21): un d20 vero che rotola sul tavolo (three.js, caricato
// solo al primo tiro). Resta il dado disegnato in CSS per i tiri segreti
// dell'Officina, per chi ha "riduci animazioni" e dove WebGL non c'è.
let dice3dMod = null;
const load3D = () => (dice3dMod ||= import("./dice3d").then((m) => (m.canUse3D() ? m : null)).catch(() => null));
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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
        if (pendingResolve) { const prev = pendingResolve; pendingResolve = null; prev(); }
        const done = () => { if (pendingResolve === done) pendingResolve = null; resolve(); };
        pendingResolve = done;
        setRoll({
          id: Math.random().toString(36).slice(2),
          value,
          label: opts.label || "",
          // Tiro SEGRETO (Officina): il dado rotola e si ferma, ma sulla faccia
          // resta una runa. Il numero lo conosce solo il Master.
          hidden: !!opts.hidden,
          // La skin si legge al momento del tiro: rispecchia sempre la scelta corrente.
          skin: VALID_SKINS.has(currentSkin) ? currentSkin : DEFAULT_SKIN,
          resolve: done,
        });
      });
    return () => { trigger = null; };
  }, []);

  // Animation timing
  const TUMBLE_MS = 750;   // chaotic spin
  const SETTLE_MS = 450;   // settle / reveal
  const HOLD_MS   = 550;   // pause showing the result
  const FADE_MS   = 280;   // fade out
  const ROLL3D_MS = 1350;  // lancio 3D: dalla mano al dado fermo
  const HOLD3D_MS = 900;   // il dado 3D resta fermo un po' di più: si legge la faccia

  // Lancio 3D: si decide se usarlo PRIMA di montare l'overlay (mode "3d" | "css").
  const host3d = useRef(null);
  // La modalità vale solo per il tiro per cui è stata decisa: un tiro nuovo
  // (magari segreto) non deve partire in 3D col valore del precedente.
  const [modeFor, setModeFor] = useState({ id: null, mode: null });
  const mode = roll && modeFor.id === roll.id ? modeFor.mode : null;
  useEffect(() => {
    if (!roll) return;
    if (roll.hidden || reducedMotion()) { setModeFor({ id: roll.id, mode: "css" }); return; }
    let alive = true;
    load3D().then((m) => { if (alive) setModeFor({ id: roll.id, mode: m ? "3d" : "css" }); });
    return () => { alive = false; };
  }, [roll]);

  useEffect(() => {
    if (!roll || mode !== "3d" || !host3d.current) return;
    let alive = true;
    const accent = roll.value === 20 ? 0xffc23a : roll.value === 1 ? 0xff2a2a : null;
    load3D().then((m) => {
      if (!alive || !m) return;
      m.roll3D(host3d.current, { value: roll.value, skin: roll.skin, durationMs: ROLL3D_MS, accent })
        .then(() => roll.resolve());
    });
    const tEnd = setTimeout(() => setRoll(null), ROLL3D_MS + HOLD3D_MS + FADE_MS);
    return () => { alive = false; clearTimeout(tEnd); dice3dMod?.then((m) => m?.stop3D()); roll.resolve(); };
  }, [roll, mode]);

  useEffect(() => {
    if (!roll || mode !== "css") return;
    // Sblocco la logica (risultato + effetti pixel) appena il dado si FERMA sul
    // numero (tumble+settle), così il colpo è sincronizzato con la rivelazione.
    // L'overlay del dado resta visibile per hold+fade e si smonta da solo dopo.
    const revealAt = TUMBLE_MS + SETTLE_MS;
    const total    = revealAt + HOLD_MS + FADE_MS;
    const tReveal = setTimeout(() => roll.resolve(), revealAt);
    const tEnd    = setTimeout(() => setRoll(null), total);
    return () => { clearTimeout(tReveal); clearTimeout(tEnd); };
  }, [roll, mode]);

  if (!roll || !mode) return null;

  // Col tiro segreto niente numero e niente CRITICO/FALLIMENTO: il dado non
  // deve tradire l'esito nemmeno col colore.
  const isCrit = !roll.hidden && roll.value === 20;
  const isFumble = !roll.hidden && roll.value === 1;
  const variant = isCrit ? "crit" : isFumble ? "fumble" : "normal";

  if (mode === "3d") {
    return createPortal(
      <div className={`dice-overlay dice-overlay--3d ${variant}`} key={roll.id} aria-hidden="true"
        style={{ "--tumble-ms": `${ROLL3D_MS}ms`, "--settle-ms": "0ms", "--hold-ms": `${HOLD3D_MS}ms`, "--fade-ms": `${FADE_MS}ms` }}>
        <div className="dice3d-host" ref={host3d} />
        <div className="dice3d-caption">
          {roll.label && <div className="dice-label">{roll.label}</div>}
          {isCrit  && <div className="dice-tag crit">CRITICO!</div>}
          {isFumble && <div className="dice-tag fumble">FALLIMENTO</div>}
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className={`dice-overlay ${variant} skin-${roll.skin}${roll.hidden ? " hidden-roll" : ""}`} key={roll.id} aria-hidden="true">
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
          <span className="dice-d20-num">{roll.hidden ? "?" : roll.value}</span>
        </div>
        <div className="dice-d20-glow" />
      </div>
      {roll.label && <div className="dice-label">{roll.label}</div>}
      {isCrit  && <div className="dice-tag crit">CRITICO!</div>}
      {isFumble && <div className="dice-tag fumble">FALLIMENTO</div>}
      {roll.hidden && <div className="dice-tag segreto">TIRO SEGRETO</div>}
    </div>,
    document.body
  );
}
