/* ============================================================
   EFFETTI DELLA LOTTA DEI PET — rifatti il 2026-11-05 sul motore
   "RPG old style" delle Segrete (src/fx/spellFx.js: canvas a pixel
   grossi, luce additiva, fumo, fiamme, schegge, scariche).
   Ogni mossa ha un `fx` (forma, vedi petDex.js) e un tipo (elemento):
   la forma va al motore (anche quelle fisiche: graffi, morso, pestone,
   frusta, pungiglione, carica, spuntoni, pioggia…), e qui si aggiunge il
   "peso" del colpo: chi lancia si carica, chi incassa lampeggia e
   arretra, il campo trema sui colpi pesanti e sui critici, MANCATO
   esce all'arrivo. I balzi di chi attacca restano le classi .is-lunge /
   .is-stomp / .is-dash (PetDen.jsx + PetFx.css).
   Prova dalla console: __spellFx("claw", "fire")
   ============================================================ */
import { useEffect } from "react";
import { playSpell } from "../fx/spellFx";
import { popOnEl } from "../fx/hitNumbers";
import "./PetFx.css";

// Mosse che restano su chi le usa.
const SELF_FX = new Set(["aura", "heal", "sleep"]);
// forma della mossa → forma del motore
const KIND = {
  stomp: "stomp", bite: "bite", claw: "claw", whip: "whip", sting: "sting", dash: "dash", spikes: "spikes",
  orb: "bolt", beam: "beam", breath: "breath", burst: "burst", bolt: "strike", rain: "rain", wave: "wave",
  roar: "roar", cloud: "cloud", curse: "curse", drain: "drain", heal: "heal", aura: "buff", sleep: "sleep",
};
// ritardo dell'effetto per aspettare il balzo di chi attacca (classi .is-lunge/.is-dash/.is-stomp)
const LEAD = { bite: 120, claw: 140, whip: 60, sting: 120, dash: 0, stomp: 0 };
// colpi che fanno tremare il campo
const HEAVY = new Set(["stomp", "dash", "spikes", "burst", "bolt", "rain"]);
const PHYSICAL = new Set(["stomp", "bite", "claw", "whip", "sting", "dash", "spikes"]);

const rectOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, size: r.width, bottom: r.bottom };
};
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// scossa a scatti (old style: niente morbidezza)
function shake(el, px, ms) {
  if (!el?.animate || reduced()) return;
  const k = [];
  for (let i = 0; i <= 6; i++) {
    const f = 1 - i / 6;
    k.push({ transform: i === 6 ? "none" : `translate(${Math.round((i % 2 ? -1 : 1) * px * f)}px, ${Math.round((i % 3 - 1) * px * 0.6 * f)}px)` });
  }
  el.animate(k, { duration: ms, easing: "steps(1, end)" });
}
// chi incassa: lampo bianco a scatti e un passo indietro
function recoil(el, dir, crit) {
  if (!el?.animate) return;
  const back = reduced() ? 0 : (crit ? 14 : 8) * dir;
  el.animate([
    { transform: "none", filter: "none" },
    { transform: `translateX(${back}px)`, filter: "brightness(4) saturate(0)" },
    { transform: `translateX(${back * 0.7}px)`, filter: "none" },
    { transform: `translateX(${back * 0.4}px)`, filter: "brightness(3) saturate(0)" },
    { transform: "none", filter: "none" },
  ], { duration: crit ? 360 : 260, easing: "steps(4, end)" });
}
// chi lancia un incantesimo: si gonfia e si illumina un attimo
function castPose(el, el2) {
  if (!el?.animate || reduced()) return;
  el.animate([
    { transform: "none", filter: "none" },
    { transform: "scale(1.06, .94)", filter: "brightness(1.6) drop-shadow(0 0 6px #fff)" },
    { transform: "scale(.97, 1.04) translateY(-4px)", filter: "brightness(1.3)" },
    { transform: "none", filter: "none" },
  ], { duration: 320, easing: "steps(3, end)" });
  void el2;
}

export default function PetFx({ ev, seq, fieldRef, spotRefs }) {
  useEffect(() => {
    if (ev?.kind !== "move" || !ev.fx) return undefined;
    const kind = KIND[ev.fx] || "impact";
    const fromWrap = spotRefs[ev.side]?.current;
    const toWrap = spotRefs[ev.side === "p" ? "e" : "p"]?.current;
    const fromEl = fromWrap?.querySelector(".pd-sprite");
    const toEl = toWrap?.querySelector(".pd-sprite");
    if (!fromEl || !toEl) return undefined;
    const self = SELF_FX.has(ev.fx);
    const miss = !self && !!(ev.roll && !ev.roll.ok);
    const crit = !!ev.roll?.crit;
    const from = rectOf(fromEl);
    const to = self ? from : rectOf(toEl);
    const lead = LEAD[ev.fx] || 0;
    if (!PHYSICAL.has(ev.fx)) castPose(fromEl);
    const hit = playSpell({ kind, el: ev.mtype, from, to, miss, crit, delay: lead, scale: ev.fx === "burst" ? 1.3 : 1 });
    if (self || hit < 0) return undefined;
    const timers = [];
    timers.push(setTimeout(() => {
      if (miss) { popOnEl(toEl, { kind: "miss" }); return; }
      // il bersaglio incassa: lampo, passo indietro (verso il suo lato), il campo trema
      recoil(toEl.querySelector(".pd-breathe") || toEl, ev.side === "p" ? 1 : -1, crit);
      if (crit || HEAVY.has(ev.fx)) shake(fieldRef.current, crit ? 7 : 5, crit ? 380 : 300);
    }, hit));
    return () => timers.forEach(clearTimeout);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
