import React from "react";

/* Icone poliedriche pulite (d4·d6·d8·d10·d12·d20) per i tiri di dado nel log
   d'Arena. Niente emoji di sistema: SVG inline, stile coerente col tema
   (silhouette teal + faccette dorate + numero del dado), identiche su ogni OS.
   Sostituiscono il 🎲 (che in Unicode esiste solo come d6). */
const SHAPES = {
  4:  { poly: "50,12 90,82 10,82",                  lines: ["10,82 50,55 90,82"],                                   cx: 50, cy: 66, fs: 28 },
  6:  { poly: "50,8 88,30 88,72 50,94 12,72 12,30", lines: ["12,30 50,52 88,30", "50,52 50,94"],                    cx: 50, cy: 60, fs: 30 },
  8:  { poly: "50,6 90,50 50,94 10,50",             lines: ["10,50 90,50"],                                         cx: 50, cy: 54, fs: 30 },
  10: { poly: "50,6 84,38 68,92 32,92 16,38",       lines: ["16,38 84,38"],                                         cx: 50, cy: 62, fs: 28 },
  12: { poly: "50,6 89,37 73,90 27,90 11,37",       lines: ["50,28 70,42 62,68 38,68 30,42 50,28"],                 cx: 50, cy: 58, fs: 28 },
  20: { poly: "50,5 87,27 87,73 50,95 13,73 13,27", lines: ["31,38 69,38 50,72 31,38"],                             cx: 50, cy: 56, fs: 30 },
};

export default function DieIcon({ sides = 6, className = "", title }) {
  const shape = SHAPES[sides] || SHAPES[6];
  const known = !!SHAPES[sides];
  const label = known ? `d${sides}` : "dado";
  return (
    <svg
      className={`die-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title || label}
      focusable="false"
    >
      <polygon points={shape.poly} className="die-icon-body" />
      {shape.lines.map((pts, i) => (
        <polyline key={i} points={pts} className="die-icon-facet" />
      ))}
      {known && (
        <text
          x={shape.cx}
          y={shape.cy}
          className="die-icon-num"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: shape.fs }}
        >
          {sides}
        </text>
      )}
    </svg>
  );
}
