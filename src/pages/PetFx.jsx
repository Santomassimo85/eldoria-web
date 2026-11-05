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
import { shake, recoil, castPose } from "../fx/hitFeel";
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
