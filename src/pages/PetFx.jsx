/* ============================================================
   EFFETTI DELLA LOTTA DEI PET (2026-10-31) — tutto DOM + CSS.
   Ogni mossa ha un `fx` (forma dell'attacco, vedi petDex.js) e un
   tipo (elemento → colori). Le posizioni vengono misurate dagli
   sprite veri in campo, così valgono su telefono e desktop.
   ============================================================ */

import React, { useLayoutEffect, useMemo, useState } from "react";
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

export default function PetFx({ ev, seq, fieldRef, spotRefs }) {
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
        </>
      );
      break;
    case "bite":
      body = (
        <>
          <span className="pfx-jaw pfx-jaw--top" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-jaw pfx-jaw--bot" style={at("var(--x1)", "var(--y1)")} />
          <span className="pfx-pow pfx-pow--late" style={at("var(--x1)", "var(--y1)")} />
        </>
      );
      break;
    case "claw":
      body = [0, 1, 2].map((i) => (
        <span key={i} className="pfx-slash" style={at(`calc(var(--x1) + ${(i - 1) * 0.22}*var(--s))`, `calc(var(--y1) + ${(i - 1) * 0.08}*var(--s))`, { animationDelay: `${i * 70}ms` })} />
      ));
      break;
    case "orb":
      body = (
        <>
          <span className="pfx-orb" style={at("var(--x0)", "var(--y0)")} />
          <span className="pfx-pop pfx-pop--orb" style={at("var(--x1)", "var(--y1)")} />
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

  return <div key={seq} className={`pfx pfx--${ev.mtype}`} style={style} aria-hidden="true">{body}</div>;
}
