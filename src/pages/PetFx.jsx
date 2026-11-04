/* ============================================================
   EFFETTI DELLA LOTTA DEI PET (2026-10-31) — tutto DOM + CSS.
   Ogni mossa ha un `fx` (forma dell'attacco, vedi petDex.js) e un
   tipo (elemento → colori). Le posizioni vengono misurate dagli
   sprite veri in campo, così valgono su telefono e desktop.
   Look pixel art: tutto lo strato passa dal filtro SVG #pd-pixelate
   (blocchi da PIX px), i movimenti vanno a scatti (steps) e le
   particelle sono quadrate. Negli impatti escono scintille quadrate.
   ============================================================ */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TYPE_COLORS } from "../data/petDex";
import "./PetFx.css";

// Mosse che restano su chi le usa.
const SELF_FX = new Set(["aura", "heal", "sleep"]);

// Numeri pseudo-casuali fissi per seme (le particelle non "ballano" ai render).
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function measure(field, el) {
  const f = field.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - f.left, y: r.top + r.height * 0.55 - f.top, feet: r.bottom - f.top, s: r.width };
}

const PIX = 3; // lato dei "pixel" del filtro (2026-11-04: da 5 a 3, i dettagli degli elementi si leggono)

// Filtro di pixelatura: campiona un punto ogni PIX px e lo allarga a blocco.
function PixelFilter() {
  const h = Math.floor(PIX / 2);
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="pd-pixelate" x="0" y="0" width="100%" height="100%">
        <feFlood x={h} y={h} height="1" width="1" />
        <feComposite width={PIX} height={PIX} />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius={h} />
      </filter>
    </svg>
  );
}

// Scintille quadrate che schizzano dal punto d'impatto.
function Sparks({ parts, s, delay = 0, n = 8 }) {
  return parts.slice(0, n).map((p, i) => (
    <span key={`sp${i}`} className="pfx-spark" style={{
      left: "var(--x1)", top: "var(--y1)",
      "--tx": `${Math.cos((i / n) * 6.283 + p[0]) * s * (0.45 + p[1] * 0.35)}px`,
      "--ty": `${Math.sin((i / n) * 6.283 + p[0]) * s * (0.45 + p[1] * 0.35)}px`,
      background: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "var(--c1)" : "var(--c2)",
      animationDelay: `${delay}ms`,
    }} />
  ));
}

// Quando la forma della mossa arriva sul bersaglio (ms): lì parte il marchio dell'elemento.
const IMPACT_MS = { stomp: 300, bite: 330, claw: 120, whip: 330, sting: 300, dash: 300, spikes: 160, orb: 380, beam: 200, breath: 460, drain: 0, burst: 40, bolt: 90, rain: 460, wave: 480, roar: 480, cloud: 200, curse: 260 };

/* ── MARCHIO DELL'ELEMENTO (2026-11-04) ─────────────────────────
   Sopra la forma della mossa, sul bersaglio colpito, ogni elemento ha
   il suo disegno: fiamme che salgono, cristalli di ghiaccio, schizzi
   d'acqua, scariche, sassi, bolle d'acido, teschio del veleno, spiriti
   neri, raggi di luce, cerchi psichici. Così si capisce subito COSA
   ha colpito, non solo dal colore. */
function ElementMark({ type, parts, s, delay }) {
  const P = (i) => parts[i % parts.length];
  const d = (ms, extra = {}) => ({ ...extra, animationDelay: `${delay + ms}ms` });
  const at = (x, y, extra = {}) => ({ left: x, top: y, ...extra });
  const around = (i, n, r, k = 0) => {
    const a = (i / n) * 6.283 + P(i)[0] * 0.6 + k;
    return [Math.cos(a) * s * r, Math.sin(a) * s * r];
  };
  switch (type) {
    case "fire":
      return (
        <>
          <span className="pfx-el-scorch" style={at("var(--x1)", "var(--fy)", d(0))} />
          {[-0.36, -0.18, 0, 0.18, 0.36].map((k, i) => (
            <span key={`f${i}`} className="pfx-flame" style={at(`calc(var(--x1) + ${k}*var(--s))`, "var(--fy)", d(i % 2 ? 70 : 0, { "--h": `${s * (i === 2 ? 0.95 : 0.5 + P(i)[1] * 0.35)}px` }))} />
          ))}
          {parts.slice(0, 9).map((p, i) => (
            <span key={`e${i}`} className="pfx-ember" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 0.9}px)`, `calc(var(--y1) + ${p[1] * s * 0.35}px)`, d(80 + i * 35, { "--tx": `${(p[2] - 0.5) * s * 0.5}px`, "--ty": `${-s * (0.6 + p[3] * 0.6)}px` }))} />
          ))}
        </>
      );
    case "cold":
      return (
        <>
          <span className="pfx-frost" style={at("var(--x1)", "var(--y1)", d(0))} />
          {Array.from({ length: 6 }, (_, i) => {
            const [x, y] = around(i, 6, 0.42);
            return <span key={`c${i}`} className="pfx-crystal" style={at(`calc(var(--x1) + ${x}px)`, `calc(var(--y1) + ${y}px)`, d(i * 30, { "--r": `${(i / 6) * 360 + 90}deg`, "--z": 0.7 + P(i)[1] * 0.6 }))} />;
          })}
          {parts.slice(0, 6).map((p, i) => (
            <span key={`s${i}`} className="pfx-flake" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 1.1}px)`, `calc(var(--y1) - ${s * 0.5}px)`, d(120 + i * 50, { "--ty": `${s * (0.7 + p[1] * 0.4)}px` }))}>❄</span>
          ))}
        </>
      );
    case "water":
      return (
        <>
          <span className="pfx-ripple" style={at("var(--x1)", "var(--fy)", d(0))} />
          <span className="pfx-ripple" style={at("var(--x1)", "var(--fy)", d(150))} />
          {Array.from({ length: 9 }, (_, i) => {
            const k = (i / 8 - 0.5) * 2;
            return <span key={`w${i}`} className="pfx-splash" style={at("var(--x1)", "var(--y1)", d(i * 15, { "--tx": `${k * s * 0.7}px`, "--ty": `${-s * (0.45 + (1 - Math.abs(k)) * 0.4 + P(i)[0] * 0.15)}px` }))} />;
          })}
          {parts.slice(0, 4).map((p, i) => (
            <span key={`b${i}`} className="pfx-bubble" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 0.8}px)`, `calc(var(--y1) + ${p[1] * s * 0.2}px)`, d(200 + i * 70))} />
          ))}
        </>
      );
    case "lightning":
      return (
        <>
          <span className="pfx-el-flash" style={at("var(--x1)", "var(--y1)", d(0))} />
          {Array.from({ length: 6 }, (_, i) => {
            const [x, y] = around(i, 6, 0.34);
            return <span key={`z${i}`} className="pfx-zap" style={at(`calc(var(--x1) + ${x}px)`, `calc(var(--y1) + ${y}px)`, d((i % 3) * 70, { "--r": `${(i / 6) * 360 + P(i)[2] * 40}deg` }))} />;
          })}
          <span className="pfx-zapring" style={at("var(--x1)", "var(--y1)", d(60))} />
        </>
      );
    case "earth":
      return (
        <>
          <span className="pfx-el-dust" style={at("var(--x1)", "var(--fy)", d(0))} />
          <span className="pfx-crack-gr" style={at("var(--x1)", "var(--fy)", d(0))} />
          {parts.slice(0, 8).map((p, i) => (
            <span key={`r${i}`} className="pfx-rock" style={at("var(--x1)", "var(--y1)", d(i * 20, { "--tx": `${(p[0] - 0.5) * s * 1.5}px`, "--ty": `${-s * (0.3 + p[1] * 0.45)}px`, "--fall": `${s * 0.75}px`, "--z": 0.6 + p[2] * 0.8, "--r": `${Math.round(p[3] * 540)}deg` }))} />
          ))}
        </>
      );
    case "acid":
      return (
        <>
          <span className="pfx-goo" style={at("var(--x1)", "var(--y1)", d(0))} />
          {parts.slice(0, 7).map((p, i) => (
            <span key={`a${i}`} className="pfx-acid-drip" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 0.8}px)`, `calc(var(--y1) + ${(p[1] - 0.6) * s * 0.4}px)`, d(60 + i * 40, { "--ty": `${s * (0.35 + p[2] * 0.35)}px` }))} />
          ))}
          {parts.slice(7, 12).map((p, i) => (
            <span key={`h${i}`} className="pfx-sizzle" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 0.9}px)`, `calc(var(--y1) + ${p[1] * s * 0.3}px)`, d(180 + i * 60))} />
          ))}
        </>
      );
    case "poison":
      return (
        <>
          {parts.slice(0, 8).map((p, i) => (
            <span key={`p${i}`} className="pfx-toxbub" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * s * 0.9}px)`, `calc(var(--y1) + ${p[1] * s * 0.3}px)`, d(i * 45, { "--z": 0.6 + p[2] * 0.8, "--ty": `${-s * (0.5 + p[3] * 0.5)}px` }))} />
          ))}
          <span className="pfx-skull" style={at("var(--x1)", "var(--y1)", d(120))}>☠️</span>
        </>
      );
    case "necrotic":
      return (
        <>
          <span className="pfx-voidring" style={at("var(--x1)", "var(--y1)", d(0))} />
          {Array.from({ length: 5 }, (_, i) => (
            <span key={`n${i}`} className="pfx-wisp" style={at(`calc(var(--x1) + ${(i - 2) * 0.2}*var(--s))`, "var(--y1)", d(i * 60, { "--ty": `${-s * (0.6 + P(i)[0] * 0.4)}px`, "--sw": `${(P(i)[1] - 0.5) * s * 0.4}px` }))} />
          ))}
          <span className="pfx-skull pfx-skull--necro" style={at("var(--x1)", "var(--y1)", d(160))}>💀</span>
        </>
      );
    case "radiant":
      return (
        <>
          <span className="pfx-halo" style={at("var(--x1)", "var(--y1)", d(0))} />
          {Array.from({ length: 8 }, (_, i) => (
            <span key={`l${i}`} className="pfx-lightray" style={at("var(--x1)", "var(--y1)", d(i % 2 ? 60 : 0, { "--r": `${i * 45}deg` }))} />
          ))}
          {parts.slice(0, 6).map((p, i) => {
            const [x, y] = around(i, 6, 0.5 + p[1] * 0.2);
            return <span key={`t${i}`} className="pfx-twinkle" style={at(`calc(var(--x1) + ${x}px)`, `calc(var(--y1) + ${y}px)`, d(100 + i * 50))}>✦</span>;
          })}
        </>
      );
    case "psychic":
      return (
        <>
          {[0, 1, 2].map((i) => <span key={`q${i}`} className="pfx-psiring" style={at("var(--x1)", "var(--y1)", d(i * 110))} />)}
          {parts.slice(0, 5).map((p, i) => {
            const [x, y] = around(i, 5, 0.45);
            return <span key={`g${i}`} className="pfx-psigem" style={at(`calc(var(--x1) + ${x}px)`, `calc(var(--y1) + ${y}px)`, d(150 + i * 40))}>◆</span>;
          })}
        </>
      );
    default: // colpo fisico: stella d'urto + linee della botta
      return (
        <>
          <span className="pfx-impact" style={at("var(--x1)", "var(--y1)", d(0))} />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={`k${i}`} className="pfx-bonk" style={at("var(--x1)", "var(--y1)", d(0, { "--r": `${i * 60 + 15}deg` }))} />
          ))}
        </>
      );
  }
}

export default function PetFx({ ev: liveEv, seq: liveSeq, fieldRef, spotRefs }) {
  // L'effetto resta in scena anche quando arriva la riga dopo (colpo, danni):
  // prima spariva a metà e il marchio dell'elemento non si vedeva.
  const [held, setHeld] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    if (liveEv?.kind !== "move" || !liveEv.fx) return;
    setHeld({ ev: liveEv, seq: liveSeq });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHeld(null), 1500);
  }, [liveSeq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  const ev = held?.ev;
  const seq = held?.seq ?? 0;
  const [pos, setPos] = useState(null);
  const active = ev?.kind === "move" && ev.fx;

  useLayoutEffect(() => {
    if (!active) { setPos(null); return; }
    const field = fieldRef.current;
    const from = spotRefs[ev.side]?.current?.querySelector(".pd-sprite");
    const to = spotRefs[ev.side === "p" ? "e" : "p"]?.current?.querySelector(".pd-sprite");
    if (!field || !from || !to) return;
    setPos({ a: measure(field, from), b: measure(field, to) });
  }, [seq, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const parts = useMemo(() => {
    const r = rng(seq + 7);
    return Array.from({ length: 14 }, () => [r(), r(), r(), r()]);
  }, [seq]);

  if (!active || !pos) return null;
  const self = SELF_FX.has(ev.fx);
  const a = pos.a, b = self ? pos.a : pos.b;
  const dx = b.x - a.x, dy = b.y - a.y;
  const [c1, c2, c3] = TYPE_COLORS[ev.mtype] || TYPE_COLORS.neutral;
  const style = {
    "--x0": `${a.x}px`, "--y0": `${a.y}px`, "--x1": `${b.x}px`, "--y1": `${b.y}px`,
    "--fy": `${b.feet}px`, "--s": `${b.s}px`, "--dx": `${dx}px`, "--dy": `${dy}px`,
    "--len": `${Math.hypot(dx, dy)}px`, "--ang": `${Math.atan2(dy, dx)}rad`,
    "--c1": c1, "--c2": c2, "--c3": c3,
  };
  const P = (i) => parts[i % parts.length];
  const at = (x, y, extra = {}) => ({ left: x, top: y, ...extra });

  let body = null;
  switch (ev.fx) {
    case "stomp":
      body = (
        <>
          <span className="pfx-shock" style={at("var(--x1)", "var(--fy)")} />
          <span className="pfx-shock pfx-shock--2" style={at("var(--x1)", "var(--fy)")} />
          {parts.slice(0, 8).map((p, i) => (
            <span key={i} className="pfx-dust" style={at("var(--x1)", "var(--fy)", {
              "--tx": `${(p[0] - 0.5) * b.s * 1.6}px`, "--ty": `${-p[1] * b.s * 0.5}px`, "--z": 0.6 + p[2],
              background: i % 3 ? "var(--c2)" : "var(--c3)",
            })} />
          ))}
          <span className="pfx-pow" style={at("var(--x1)", "var(--y1)")} />
          <Sparks parts={parts} s={b.s} delay={300} />
        </>
      );
      break;
    case "bite":
      body = (
        <>
          <span className="pfx-jaw pfx-jaw--top" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-jaw pfx-jaw--bot" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-pow pfx-pow--late" style={at("var(--x1)", "var(--y1)")} />
          <Sparks parts={parts} s={b.s} delay={320} />
        </>
      );
      break;
    case "claw":
      body = (
        <>
          {[0, 1, 2].map((i) => (
            <span key={i} className="pfx-slash" style={at(`calc(var(--x1) + ${(i - 1) * 0.22}*var(--s))`, `calc(var(--y1) + ${(i - 1) * 0.08}*var(--s))`, { animationDelay: `${i * 70}ms` })} />
          ))}
          <Sparks parts={parts} s={b.s} delay={200} n={6} />
        </>
      );
      break;
    case "whip": {
      // UNA sferzata: la frusta parte da chi attacca, si srotola ad arco e schiocca sul bersaglio.
      const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.abs(b.x - a.x) * 0.35;
      const d = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
      body = (
        <>
          <svg className="pfx-whip" width="100%" height="100%" aria-hidden="true">
            <path d={d} pathLength="100" fill="none" stroke="var(--c3)" strokeWidth="15" strokeLinecap="square" />
            <path d={d} pathLength="100" fill="none" stroke="var(--c2)" strokeWidth="9" strokeLinecap="square" />
            <path d={d} pathLength="100" fill="none" stroke="var(--c1)" strokeWidth="3" strokeLinecap="square" />
          </svg>
          <span className="pfx-crack" style={at("var(--x1)", "var(--y1)")} />
          <Sparks parts={parts} s={b.s} delay={330} n={6} />
        </>
      );
      break;
    }
    case "sting":
      // pungiglione: un ago veloce, la puntura e qualche goccia dell'elemento
      body = (
        <>
          <span className="pfx-needle" style={at("var(--x0)", "var(--y0)")} />
          <span className="pfx-prick" style={at("var(--x1)", "var(--y1)")} />
          {parts.slice(0, 5).map((p, i) => (
            <span key={i} className="pfx-drip" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * b.s * 0.5}px)`, "var(--y1)", { animationDelay: `${330 + i * 50}ms` })} />
          ))}
        </>
      );
      break;
    case "dash":
      // carica: scie di velocità lungo il percorso e botta sul bersaglio (chi attacca si lancia, vedi .is-dash)
      body = (
        <>
          {parts.slice(0, 6).map((p, i) => (
            <span key={i} className="pfx-streak" style={at(`calc(var(--x0) + var(--dx) * ${0.15 + p[0] * 0.55})`, `calc(var(--y0) + var(--dy) * ${0.15 + p[0] * 0.55} + ${(p[1] - 0.5) * b.s * 0.6}px)`, { animationDelay: `${Math.round(p[2] * 120)}ms` })} />
          ))}
          <span className="pfx-pow" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-ring" style={at("var(--x1)", "var(--y1)", { animationDelay: ".3s" })} />
          <Sparks parts={parts} s={b.s * 1.2} delay={300} n={10} />
        </>
      );
      break;
    case "spikes":
      // spuntoni che salgono dal terreno sotto il bersaglio
      body = (
        <>
          {[-0.42, -0.2, 0, 0.22, 0.44].map((k, i) => (
            <span key={i} className={`pfx-spike pfx-spike--${ev.mtype}`} style={at(`calc(var(--x1) + ${k}*var(--s))`, "var(--fy)", {
              "--h": `${b.s * (i === 2 ? 0.95 : 0.55 + P(i)[0] * 0.3)}px`, animationDelay: `${120 + Math.abs(i - 2) * 70}ms`,
            })} />
          ))}
          {parts.slice(0, 6).map((p, i) => (
            <span key={`d${i}`} className="pfx-dust" style={at("var(--x1)", "var(--fy)", {
              "--tx": `${(p[0] - 0.5) * b.s * 1.4}px`, "--ty": `${-p[1] * b.s * 0.35}px`, "--z": 0.5 + p[2] * 0.6,
              background: i % 2 ? "var(--c2)" : "var(--c3)",
            })} />
          ))}
        </>
      );
      break;
    case "orb":
      body = (
        <>
          <span className="pfx-orb" style={at("var(--x0)", "var(--y0)")} />
          <span className="pfx-pop pfx-pop--orb" style={at("var(--x1)", "var(--y1)")} />
          <Sparks parts={parts} s={b.s} delay={380} n={6} />
        </>
      );
      break;
    case "beam":
      body = (
        <>
          <span className="pfx-beam" style={at("var(--x0)", "var(--y0)")} />
          <span className="pfx-pop pfx-pop--beam" style={at("var(--x1)", "var(--y1)")} />
        </>
      );
      break;
    case "breath":
    case "drain": {
      const rev = ev.fx === "drain";
      body = (
        <>
          {parts.slice(0, 12).map((p, i) => (
            <span key={i} className={`pfx-part${rev ? " is-rev" : ""}`} style={{
              left: rev ? "var(--x1)" : "var(--x0)", top: rev ? "var(--y1)" : "var(--y0)",
              "--ox": `${(p[0] - 0.5) * b.s * 0.7}px`, "--oy": `${(p[1] - 0.5) * b.s * 0.7}px`,
              "--z": 0.5 + p[2], animationDelay: `${Math.round(p[3] * 320)}ms`,
              background: ["var(--c1)", "var(--c2)", "var(--c3)"][i % 3],
            }} />
          ))}
          {rev
            ? parts.slice(0, 5).map((p, i) => <span key={`h${i}`} className="pfx-plus pfx-plus--late" style={at(`calc(var(--x0) + ${(p[0] - 0.5) * a.s * 0.8}px)`, "var(--y0)", { animationDelay: `${450 + i * 60}ms` })}>✚</span>)
            : <span className="pfx-pop pfx-pop--breath" style={at("var(--x1)", "var(--y1)")} />}
        </>
      );
      break;
    }
    case "burst":
      body = (
        <>
          <span className="pfx-boom" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-ring" style={at("var(--x1)", "var(--y1)")} />
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="pfx-ray" style={at("var(--x1)", "var(--y1)", { "--r": `${i * 36 + P(i)[0] * 20}deg` })} />
          ))}
          <Sparks parts={parts} s={b.s * 1.3} delay={60} n={10} />
        </>
      );
      break;
    case "bolt": {
      const xs = [0, 0.18, -0.12, 0.2, -0.08, 0.1, 0].map((k, i) => `${b.x + k * b.s},${(b.y * i) / 6}`).join(" ");
      body = (
        <>
          <span className="pfx-flash" />
          <svg className="pfx-bolt" width="100%" height="100%" aria-hidden="true">
            <polyline points={xs} fill="none" stroke="var(--c3)" strokeWidth="14" strokeLinejoin="bevel" opacity=".55" />
            <polyline points={xs} fill="none" stroke="var(--c2)" strokeWidth="7" strokeLinejoin="bevel" />
            <polyline points={xs} fill="none" stroke="var(--c1)" strokeWidth="3" strokeLinejoin="bevel" />
          </svg>
          <span className="pfx-pop pfx-pop--bolt" style={at("var(--x1)", "var(--y1)")} />
        </>
      );
      break;
    }
    case "rain":
      body = (
        <>
          {parts.slice(0, 8).map((p, i) => (
            <span key={i} className={`pfx-drop pfx-drop--${ev.mtype}`} style={{
              left: `calc(var(--x1) + ${(p[0] - 0.5) * b.s * 1.1}px)`, top: `calc(var(--y1) + ${(p[1] - 0.5) * b.s * 0.5}px)`,
              "--z": 0.7 + p[2] * 0.6, animationDelay: `${Math.round(p[3] * 380)}ms`,
            }} />
          ))}
          <span className="pfx-pop pfx-pop--rain" style={at("var(--x1)", "var(--y1)")} />
        </>
      );
      break;
    case "wave":
    case "roar":
      body = [0, 1, 2].map((i) => (
        <span key={i} className={`pfx-arc${ev.fx === "roar" ? " is-roar" : ""}`} style={at("var(--x0)", "var(--y0)", { animationDelay: `${i * 140}ms` })} />
      ));
      break;
    case "cloud":
      body = parts.slice(0, 7).map((p, i) => (
        <span key={i} className="pfx-puff" style={at("var(--x1)", "var(--y1)", {
          "--a": `${i * 51}deg`, "--rr": `${b.s * (0.18 + p[0] * 0.2)}px`, "--z": 0.7 + p[1] * 0.7,
          animationDelay: `${i * 50}ms`, background: i % 2 ? "var(--c2)" : "var(--c3)",
        })} />
      ));
      break;
    case "curse":
      body = (
        <>
          <span className="pfx-spiral" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-spiral pfx-spiral--in" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-eye" style={at("var(--x1)", "var(--y1)")} />
        </>
      );
      break;
    case "aura":
      body = (
        <>
          {[0, 1, 2].map((i) => <span key={i} className="pfx-aura" style={at("var(--x1)", "var(--fy)", { animationDelay: `${i * 160}ms` })} />)}
          {parts.slice(0, 5).map((p, i) => (
            <span key={`u${i}`} className="pfx-up" style={at(`calc(var(--x1) + ${(p[0] - 0.5) * b.s * 0.9}px)`, `calc(var(--y1) + ${p[1] * b.s * 0.3}px)`, { animationDelay: `${i * 90}ms` })}>▲</span>
          ))}
        </>
      );
      break;
    case "heal":
    case "sleep":
      body = (
        <>
          <span className="pfx-glow" style={at("var(--x1)", "var(--y1)")} />
          {parts.slice(0, ev.fx === "sleep" ? 3 : 7).map((p, i) => (
            <span key={i} className={ev.fx === "sleep" ? "pfx-z" : "pfx-plus"} style={at(`calc(var(--x1) + ${(p[0] - 0.3) * b.s * 0.8}px)`, `calc(var(--y1) + ${p[1] * b.s * 0.2}px)`, { animationDelay: `${i * (ev.fx === "sleep" ? 220 : 80)}ms` })}>
              {ev.fx === "sleep" ? "Z" : "✚"}
            </span>
          ))}
        </>
      );
      break;
    default:
      body = <span className="pfx-pop" style={at("var(--x1)", "var(--y1)")} />;
  }
  // il marchio dell'elemento solo se la mossa va a segno sul bersaglio
  const landed = !self && (!ev.roll || ev.roll.ok);
  const missed = !self && ev.roll && !ev.roll.ok;
  const hitAt = IMPACT_MS[ev.fx] ?? 300;

  return (
    <>
      <PixelFilter />
      <div key={seq} className={`pfx pfx--${ev.mtype}${ev.roll?.crit ? " is-crit" : ""}`} style={style} aria-hidden="true">
        {body}
        {landed && <ElementMark type={ev.mtype} parts={parts} s={b.s * (ev.roll?.crit ? 1.25 : 1)} delay={hitAt} />}
        {missed && <span className="pfx-whiff" style={at("var(--x1)", "var(--y1)", { animationDelay: `${hitAt}ms` })}>MANCATO</span>}
      </div>
    </>
  );
}
