# Shared UI Components — eldoria-web ("Crit Happens")

Framework: **React 19 + Vite 7 (JSX, no TS)** · Router: **react-router-dom v7 (config-based, in `src/App.jsx`)** · CSS: **vanilla CSS, one file per page/component** (no Tailwind, no CSS Modules, no styled-components) · Component library: **custom** (nessuna libreria UI esterna).

I primitivi condivisi vivono in `src/components/` (più `ToggleSection` che storicamente sta in `src/pages/`). Le classi di stile condivise (`.cine-*`, `.ch-*`) vivono in `src/styles/cinematic.css` e `src/styles/theme.css` (vedi `theme.md`).

---

## CineToolbar
- Path: `src/components/CineToolbar.jsx`
- Toolbar di ricerca riutilizzabile (input + chip filtri + contatore risultati) usata dalle pagine "cinematografiche" (NPC, Geo, Party, Bacheca…). Stile in `src/styles/cinematic.css` (`.cine-toolbar`).
- Props: `query`, `onQuery`, `placeholder`, `chips [{key,label}]`, `activeChip`, `onChip`, `allLabel`, `count`, `countNoun`.

```jsx
// src/components/CineToolbar.jsx
// Toolbar di ricerca riutilizzabile per le pagine cinematografiche.
// Ricerca testuale + (opzionale) chip di filtro + contatore risultati.
// Lo stile vive in src/styles/cinematic.css (.cine-toolbar …).
export default function CineToolbar({
    query,
    onQuery,
    placeholder = "Cerca…",
    chips = [],            // [{ key, label }]
    activeChip = null,     // null = "tutti"
    onChip,
    allLabel = "Tutti",
    count,
    countNoun = "risultati",
}) {
    return (
        <div className="cine-toolbar">
            <div className="cine-search">
                <span className="cine-search-icon" aria-hidden="true">🔍</span>
                <input
                    type="text"
                    className="cine-search-input"
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                />
                {query && (
                    <button
                        type="button"
                        className="cine-search-clear"
                        onClick={() => onQuery("")}
                        aria-label="Cancella ricerca"
                    >
                        ✕
                    </button>
                )}
            </div>

            {chips.length > 0 && (
                <div className="cine-chips" role="group" aria-label="Filtri">
                    <button
                        type="button"
                        className={`cine-chip ${activeChip == null ? "active" : ""}`}
                        onClick={() => onChip(null)}
                    >
                        {allLabel}
                    </button>
                    {chips.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className={`cine-chip ${activeChip === c.key ? "active" : ""}`}
                            onClick={() => onChip(activeChip === c.key ? null : c.key)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            )}

            {count != null && (
                <span className="cine-result-count">
                    {count} {countNoun}
                </span>
            )}
        </div>
    );
}
```

---

## ToggleSection
- Path: `src/pages/ToggleSection.jsx` (+ `src/pages/ToggleSection.css`)
- Sezione a fisarmonica (titolo cliccabile ▼ + contenuto collassabile). Usata in Riassunti e Geo.
- Props: `title`, `children`, `staticContent`, `defaultOpen`, `titleClass`, `contentClass`, `onOpen`.

```jsx
import React, { useState } from 'react';
import './ToggleSection.css';

const ToggleSection = ({ title, children, staticContent, defaultOpen = false, titleClass = '', contentClass = '', onOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleContent = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && onOpen) onOpen();
  };

  return (
    <div className="toggle-section">
      <h3 className={`toggle-title ${titleClass}`} onClick={toggleContent}>
        {title}
        {/* Icona per indicare lo stato (aperto/chiuso) */}
        <span className={`toggle-icon ${isOpen ? 'open' : ''}`}>&#9660;</span>
      </h3>
      {staticContent && <div className="toggle-static">{staticContent}</div>}
      {/* Applico la nuova classe qui, insieme alla classe 'open' */}
      <div className={`toggle-content ${isOpen ? 'open' : ''} ${contentClass}`}>
        {children}
      </div>
    </div>
  );
};

export default ToggleSection;
```

---

## Countdown
- Path: `src/components/Countdown.jsx`
- Countdown alla prossima sessione di un party (giorni/ore/minuti/secondi) + CTA fissa a Foundry VTT. Usato in Home (widget calendario).
- Props: `targetDate` (ISO string), `partyName`.

```jsx
import { useState, useEffect } from 'react';

/**
 * Componente Countdown dinamico per i party di Exanthia.
 * @param {string} targetDate - Stringa data formato ISO (es. 2026-02-20T21:00:00)
 * @param {string} partyName - Nome del gruppo (Amea, Lac, Enox)
 */
const Countdown = ({ targetDate, partyName }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    // LINK ROLL20 FISSO PER TUTTI I PARTY
    const FIXED_ROLL20_LINK = "https://santomassimo85.eu.forge-vtt.com";

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            
            // Se la data non è valida o non ancora impostata dall'admin
            if (isNaN(target)) {
                setTimeLeft(0);
                return;
            }

            const difference = target - now;
            setTimeLeft(difference > 0 ? difference : 0);
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    // Calcolo giorni, ore, minuti e secondi
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    // Formattazione della data leggibile (es: 20 Febbraio, ore 21:00)
    const formattedDate = targetDate 
        ? new Date(targetDate).toLocaleDateString('it-IT', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
          })
        : "Data non impostata";

    return (
        <div className="countdown-container">
            {/* Mostra Amea, Lac o Enox passato come partyName */}
            <h2 className="countdown-party-name" style={{ color: "var(--gold)", fontFamily: "Cinzel Decorative" }}>
                {partyName}
            </h2>
            
            <h3 className="countdown-title">Prossima Sessione</h3>
            
            {timeLeft > 0 ? (
                <>
                    <div className="countdown-timer">
                        <div>{String(days).padStart(2, '0')}<span>Giorni</span></div>
                        <div>{String(hours).padStart(2, '0')}<span>Ore</span></div>
                        <div>{String(minutes).padStart(2, '0')}<span>Minuti</span></div>
                        <div>{String(seconds).padStart(2, '0')}<span>Secondi</span></div>
                    </div>
                    <p className="countdown-date">Fissata per: {formattedDate}</p>
                </>
            ) : (
                <div className="session-active-msg">
                    <p>⚔️ La sessione è in corso o è terminata!</p>
                    <p style={{ fontSize: '0.8em', opacity: 0.7 }}>In attesa del Master per la prossima data.</p>
                </div>
            )}

            {/* Il bottone usa sempre il link fisso Exanthia 3.0 */}
            <button className="roll20-btn" style={{ marginTop: "20px" }}>
                <a 
                    href={FIXED_ROLL20_LINK} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="button-link"
                >
                    Entra su Foundry VTT
                </a>
            </button>
        </div>
    );
};

export default Countdown;
```

---

## TimerDisplay
- Path: `src/components/TimerDisplay.jsx`
- Countdown compatto testuale "Xh Ym Zs" (usato in WorldMap e aste del Mercato).
- Props: `expiryDate`.

```jsx
import React, { useState, useEffect } from "react";

export default function TimerDisplay({ expiryDate }) {
  const [timeLeft, setTimeLeft] = useState("");

 useEffect(() => {
    if (!expiryDate) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(expiryDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("TEMPO SCADUTO");
        return;
      }

      const h = Math.floor((diff / (1000 * 60 * 60)));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h}h ${m}m ${s}s`);
    };

    updateTimer(); // Esegui subito
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  return <span className="timer-countdown-text">{timeLeft}</span>;
}
```

---

## DieIcon
- Path: `src/components/DieIcon.jsx`
- Icone SVG inline dei dadi poliedrici (d4–d20), stile coerente col tema, usate nel log dell'Arena.
- Props: `sides` (4|6|8|10|12|20), `className`, `title`.

```jsx
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
```

---

## AmbientFX
- Path: `src/components/AmbientFX.jsx` (+ `src/components/AmbientFX.css`)
- Layer di particelle animate di sfondo, una variante per pagina: `fire` (Bottega Arena), `water` (NPC), `leaves` (Party), `cosmos` (Geo), `fireflies` (Bacheca).
- Props: `variant`.

```jsx
// src/components/AmbientFX.jsx
// Layer di sfondo animato CONTINUO, una variante per pagina.
// Le particelle ricevono posizione/tempo via CSS custom props (inline),
// così il CSS resta compatto e ogni effetto è facilmente regolabile.
//   fire      → braci che salgono (Bottega Arena)
//   water     → bolle d'acqua che risalgono (NPC)
//   leaves    → foglie al vento che cadono (Party)
//   cosmos    → stelle che brillano + nebulosa che deriva (Geo)
//   fireflies → lucciole/polvere dorata che fluttuano (Bacheca)
import "./AmbientFX.css";

const COUNTS = { fire: 18, water: 14, leaves: 14, cosmos: 36, fireflies: 20 };

// pseudo-random deterministico per indice (niente flicker tra render)
const rand = (i, seed) => {
    const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    return x - Math.floor(x);
};

export default function AmbientFX({ variant = "fire" }) {
    const n = COUNTS[variant] || 16;
    const anchored = variant === "cosmos" || variant === "fireflies";

    const particles = Array.from({ length: n }, (_, i) => {
        const r1 = rand(i, 1.7);
        const r2 = rand(i, 3.1);
        const r3 = rand(i, 5.3);
        const r4 = rand(i, 7.9);

        const dur = +(12 + r2 * 22).toFixed(2);   // 12..34s
        const style = {
            left: `${(r1 * 100).toFixed(2)}%`,
            animationDuration: `${dur}s`,
            animationDelay: `${(-r3 * dur).toFixed(2)}s`, // negativo → già in volo al load
            "--afx-size": (0.5 + r4).toFixed(2),           // moltiplicatore 0.5..1.5
            "--afx-dx": `${((r2 - 0.5) * 80).toFixed(1)}px`, // drift orizzontale
        };
        if (anchored) style.top = `${(rand(i, 9.2) * 100).toFixed(2)}%`;

        return <span key={i} className="afx-p" style={style} />;
    });

    return (
        <div className={`ambient-fx ambient-fx--${variant}`} aria-hidden="true">
            {particles}
        </div>
    );
}
```

---

## DiceRollHost / showD20Roll
- Path: `src/components/DiceRoll.jsx` (+ `src/components/DiceRoll.css`)
- Overlay globale (portal su body) che anima un tiro di d20 con skin selezionabile; API imperativa `showD20Roll(value, opts)` disponibile ovunque. Montato una volta in `App.jsx`.
- Export: `DICE_SKINS`, `setDiceSkin(id)`, `getDiceSkin()`, `showD20Roll(value, {label})`, default `DiceRollHost`.

```jsx
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
```

---

## DateTimePicker
- Path: `src/components/DateTimePicker.jsx` (+ `src/components/DateTimePicker.css`)
- Sostituto drop-in di `<input type="datetime-local">`: calendario + stepper ora/minuti + preset (asta/apertura/sessione). Usato nei pannelli admin (aste Mercato, sessioni).
- Props: `value` ("YYYY-MM-DDTHH:MM"), `onChange`, `required`, `className`, `placeholder`, `presets` ("auction"|"opening"|"session"|"none").

```jsx
import { useState, useEffect, useRef, useMemo } from "react";
import "./DateTimePicker.css";

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DDTHH:MM" ⇄ Date (treated as local time, like <input type="datetime-local">)
const parseValue = (v) => {
  if (!v) return null;
  const [date, time = "00:00"] = v.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h || 0, mi || 0);
};

const formatValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatDisplay = (date) => {
  if (!date) return "";
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const startOfMonth = (y, m) => new Date(y, m, 1);
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Drop-in replacement for `<input type="datetime-local">`.
 * Same value contract: "YYYY-MM-DDTHH:MM" string.
 */
export default function DateTimePicker({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "Seleziona data e ora",
  presets = "auction", // "auction" | "opening" | "session" | "none"
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseValue(value), [value]);
  const initial = selected || new Date();

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [hour, setHour] = useState(selected ? selected.getHours() : 22);
  const [minute, setMinute] = useState(selected ? selected.getMinutes() : 0);

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
      setHour(selected.getHours());
      setMinute(selected.getMinutes());
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emit = (date) => onChange?.(formatValue(date));

  const pickDate = (day) => {
    const d = new Date(viewYear, viewMonth, day, hour, minute);
    emit(d);
  };

  const pickTime = (h, m) => {
    setHour(h);
    setMinute(m);
    const base = selected || new Date(viewYear, viewMonth, new Date().getDate());
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    emit(d);
  };

  const shiftMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const stepHour = (delta) => {
    const next = (hour + delta + 24) % 24;
    pickTime(next, minute);
  };
  const stepMinute = (delta) => {
    let nm = minute + delta;
    let nh = hour;
    if (nm >= 60) { nm -= 60; nh = (nh + 1) % 24; }
    if (nm < 0)   { nm += 60; nh = (nh - 1 + 24) % 24; }
    pickTime(nh, nm);
  };

  // ── Presets ─────────────────────────────────────────────────
  const presetButtons = useMemo(() => {
    const now = new Date();
    const at = (offsetDays, h = 22, m = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const nextWeekday = (target, h = 22, m = 0) => {
      // target: 0=Sunday … 6=Saturday
      const d = new Date(now);
      const diff = (target - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(h, m, 0, 0);
      return d;
    };

    if (presets === "none") return [];
    if (presets === "opening") {
      return [
        { label: "Stasera 22:00", date: at(0, 22, 0) },
        { label: "Domani 22:00", date: at(1, 22, 0) },
        { label: "Sabato 22:00", date: nextWeekday(6, 22, 0) },
        { label: "+7 giorni",    date: at(7, 22, 0) },
      ];
    }
    if (presets === "session") {
      return [
        { label: "Stasera 21:00",  date: at(0, 21, 0) },
        { label: "Domani 21:00",   date: at(1, 21, 0) },
        { label: "Sabato 21:00",   date: nextWeekday(6, 21, 0) },
        { label: "Domenica 21:00", date: nextWeekday(0, 21, 0) },
      ];
    }
    // auction defaults
    return [
      { label: "+24h",        date: at(1, hour || 22, minute) },
      { label: "+3 giorni",   date: at(3, hour || 22, minute) },
      { label: "+7 giorni",   date: at(7, hour || 22, minute) },
      { label: "Sabato 22:00", date: nextWeekday(6, 22, 0) },
    ];
  }, [presets, hour, minute]);

  // ── Calendar grid ───────────────────────────────────────────
  const calendarCells = useMemo(() => {
    const first = startOfMonth(viewYear, viewMonth);
    const firstDow = (first.getDay() + 6) % 7; // Mon = 0
    const total = daysInMonth(viewYear, viewMonth);
    const prevTotal = daysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);
    const cells = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: prevTotal - firstDow + i + 1, muted: true, monthDelta: -1 });
    }
    for (let d = 1; d <= total; d++) {
      cells.push({ day: d, muted: false, monthDelta: 0 });
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const nextDay = cells.length - firstDow - total + 1;
      cells.push({ day: nextDay, muted: true, monthDelta: 1 });
      if (cells.length >= 42) break;
    }
    return cells;
  }, [viewYear, viewMonth]);

  const today = new Date();
  const display = formatDisplay(selected);

  return (
    <div className={`dtp-wrap ${className} ${open ? "is-open" : ""}`} ref={wrapRef}>
      <button
        type="button"
        className={`dtp-trigger ${selected ? "has-value" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="dtp-trigger-icon" aria-hidden="true">📅</span>
        <span className="dtp-trigger-value">
          {display || <span className="dtp-trigger-placeholder">{placeholder}</span>}
        </span>
        {selected && (
          <span
            className="dtp-trigger-clear"
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onChange?.(""); }}
            title="Cancella"
          >
            ✕
          </span>
        )}
        <span className="dtp-trigger-caret" aria-hidden="true">▾</span>
      </button>

      {/* Hidden field for native form `required` validation */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value || ""}
          onChange={() => {}}
          className="dtp-required-shim"
        />
      )}

      {open && (
        <div className="dtp-pop" role="dialog">
          {presetButtons.length > 0 && (
            <div className="dtp-presets">
              {presetButtons.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className="dtp-preset"
                  onClick={() => emit(p.date)}
                  title={formatDisplay(p.date)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="dtp-body">
            <div className="dtp-cal">
              <div className="dtp-cal-head">
                <button type="button" className="dtp-nav" onClick={() => shiftMonth(-1)} aria-label="Mese precedente">‹</button>
                <div className="dtp-cal-title">
                  {MONTHS[viewMonth]} {viewYear}
                </div>
                <button type="button" className="dtp-nav" onClick={() => shiftMonth(1)} aria-label="Mese successivo">›</button>
              </div>

              <div className="dtp-cal-dows">
                {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
              </div>

              <div className="dtp-cal-grid">
                {calendarCells.map((c, i) => {
                  const cellDate = new Date(viewYear, viewMonth + c.monthDelta, c.day);
                  const isToday = isSameDay(cellDate, today);
                  const isSel   = isSameDay(cellDate, selected);
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`dtp-day ${c.muted ? "muted" : ""} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}`}
                      onClick={() => {
                        if (c.monthDelta !== 0) {
                          setViewMonth(viewMonth + c.monthDelta);
                          if (viewMonth + c.monthDelta < 0) { setViewMonth(11); setViewYear(viewYear - 1); }
                          if (viewMonth + c.monthDelta > 11) { setViewMonth(0); setViewYear(viewYear + 1); }
                        }
                        const target = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), hour, minute);
                        emit(target);
                      }}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="dtp-time">
              <div className="dtp-time-label">Ora</div>
              <div className="dtp-time-row">
                <div className="dtp-stepper">
                  <button type="button" onClick={() => stepHour(1)}  aria-label="Ora +">▲</button>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={pad(hour)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(23, Number(e.target.value || 0)));
                      pickTime(v, minute);
                    }}
                  />
                  <button type="button" onClick={() => stepHour(-1)} aria-label="Ora −">▼</button>
                </div>
                <span className="dtp-colon">:</span>
                <div className="dtp-stepper">
                  <button type="button" onClick={() => stepMinute(5)}  aria-label="Min +5">▲</button>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={pad(minute)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(59, Number(e.target.value || 0)));
                      pickTime(hour, v);
                    }}
                  />
                  <button type="button" onClick={() => stepMinute(-5)} aria-label="Min −5">▼</button>
                </div>
              </div>

              <div className="dtp-quick-times">
                {["18:00", "20:00", "21:00", "22:00", "23:00"].map(t => {
                  const [h, m] = t.split(":").map(Number);
                  const on = h === hour && m === minute;
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`dtp-quick-time ${on ? "on" : ""}`}
                      onClick={() => pickTime(h, m)}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="dtp-foot">
            <button
              type="button"
              className="dtp-foot-btn"
              onClick={() => onChange?.("")}
            >
              Cancella
            </button>
            <button
              type="button"
              className="dtp-foot-btn primary"
              onClick={() => setOpen(false)}
            >
              Fatto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## PetAvatar
- Path: `src/components/PetAvatar.jsx` (+ `src/components/PetAvatar.css`)
- Avatar condiviso per le specie di pet: `<img>` con fallback all'emoji se l'immagine manca/fallisce.
- Props: `species` ({image, icon, name, key}), `size`, `className`, `style`.

```jsx
import { useState, useEffect } from "react";
import "./PetAvatar.css";

/* Shared avatar for pet species. Renders <img> when species.image is set
   and the file actually loads; otherwise falls back to the emoji icon.
   Pass through className/style so call-sites keep their layout rules. */
export default function PetAvatar({ species, size, className = "", style }) {
  const [failed, setFailed] = useState(false);

  // Reset fallback if the species (and therefore image src) changes.
  useEffect(() => { setFailed(false); }, [species?.image, species?.key]);

  if (!species) return null;

  const sizingStyle = size ? { width: size, height: size, fontSize: size * 0.6 } : null;
  const merged = { ...sizingStyle, ...style };

  if (!species.image || failed) {
    return (
      <span className={`pet-avatar pet-avatar--emoji ${className}`} style={merged}>
        {species.icon}
      </span>
    );
  }
  return (
    <img
      src={species.image}
      alt={species.name}
      className={`pet-avatar pet-avatar--img ${className}`}
      style={merged}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
```

---

## HtmlToolbar
- Path: `src/components/HtmlToolbar.jsx`
- Mini-toolbar per inserire tag HTML (b/i/u, colori, dropcap, liste, allineamenti) in una textarea di form admin.
- Props: `textAreaRef`, `formData`, `setFormData`, `fieldName`.

```jsx
import React from "react";

export default function HtmlToolbar({ textAreaRef, formData, setFormData, fieldName }) {
  const insertTag = (tagOpen, tagClose = "") => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData[fieldName] || "";
    
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${tagOpen}${selected}${tagClose}${after}`;

    setFormData({
      ...formData,
      [fieldName]: newText
    });

    setTimeout(() => {
      textarea.focus();
      const cursorOffset = tagOpen.length + selected.length + tagClose.length;
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 10);
  };

  // Funzione per inserire un colore a scelta
  const insertColor = () => {
    const color = prompt("Inserisci codice colore (es: #ff0000 o gold):", "var(--gold)");
    if (color) {
      insertTag(`<span style="color:${color}">`, "</span>");
    }
  };

  return (
    <div className="html-toolbar" style={{ marginBottom: "10px", display: "flex", gap: "5px", flexWrap: "wrap", background: "#222", padding: "5px", borderRadius: "5px" }}>
      {/* Formattazione Base */}
      <button type="button" onClick={() => insertTag("<b>", "</b>")} style={btnStyle} title="Grassetto">B</button>
      <button type="button" onClick={() => insertTag("<i>", "</i>")} style={btnStyle} title="Corsivo">I</button>
      <button type="button" onClick={() => insertTag("<u>", "</u>")} style={btnStyle} title="Sottolineato">U</button>
      
      {/* Colori e Stili Speciali */}
      <button type="button" onClick={() => insertTag('<span style="color:var(--gold)">', "</span>")} style={{...btnStyle, color: "var(--gold)"}} title="Testo Oro">Oro</button>
      <button type="button" onClick={insertColor} style={btnStyle} title="Colore Personalizzato">🎨 Colore</button>
      
      {/* Struttura */}
      <button type="button" onClick={() => insertTag('<span class="start">', "</span>")} style={{...btnStyle, border: "1px solid var(--gold)"}} title="Capolettera Grande">A (DropCap)</button>
      <button type="button" onClick={() => insertTag("<br>", "")} style={btnStyle}>A Capo</button>
      <button type="button" onClick={() => insertTag('<hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">', "")} style={btnStyle}>Linea —</button>
      
      {/* Liste */}
      <button type="button" onClick={() => insertTag("<ul>\n  <li>", "</li>\n</ul>")} style={btnStyle}>Lista •</button>
      <button type="button" onClick={() => insertTag('<h3 style="color:var(--gold); border-bottom: 1px solid #444; padding-bottom: 5px;">', "</h3>")} style={btnStyle}>Titolo H3</button>
      
      {/* Allineamento */}
      <button type="button" onClick={() => insertTag('<div style="text-align:left;">', "</div>")} style={btnStyle} title="Allinea a Sinistra">⬅ Sinistra</button>
      <button type="button" onClick={() => insertTag('<div style="text-align:center;">', "</div>")} style={btnStyle} title="Centra">↔ Centro</button>
      <button type="button" onClick={() => insertTag('<div style="text-align:right;">', "</div>")} style={btnStyle} title="Allinea a Destra">➡ Destra</button>
      <button type="button" onClick={() => insertTag('<div style="text-align:justify;">', "</div>")} style={btnStyle} title="Giustifica">≡ Giustifica</button>
    </div>
  );
}

const btnStyle = { 
  background: "#333", 
  color: "#fff", 
  border: "1px solid #555", 
  padding: "4px 10px", 
  cursor: "pointer", 
  borderRadius: "3px",
  fontSize: "0.85rem",
  fontWeight: "bold"
};
```

---

## PantheonGrid (inline, page-local ma pattern riusabile)
- Path: `src/pages/Home.jsx` (funzione interna, righe ~16–59)
- Griglia di carte divinità con modale di dettaglio al tap. Pattern "grid di carte + modal" riusato in tutto il restyle Pergamena.
- Props: `list` (array di {nome, immagine, dominio, titoli, simbolo, descrizione, dogma}).

```jsx
// Pantheon: griglia di carte + scheda-dettaglio al tap (solo presentazione).
function PantheonGrid({ list }) {
  const [openIdx, setOpenIdx] = useState(null);
  const open = openIdx != null ? list[openIdx] : null;
  return (
    <>
      <div className="deity-grid">
        {list.map((dio, i) => {
          const { main, epithet } = splitDeityName(dio.nome);
          return (
            <button key={i} type="button" className="deity-card" onClick={() => setOpenIdx(i)}>
              <span className="deity-card-portrait">
                <img src={dio.immagine} alt={dio.nome} loading="lazy"
                     onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
              </span>
              <span className="deity-card-body">
                <span className="deity-card-name">{main}</span>
                {epithet && <span className="deity-card-epithet">{epithet}</span>}
                <span className="deity-card-dominio">{dio.dominio}</span>
              </span>
              <span className="deity-card-cue" aria-hidden="true">Scopri ›</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="deity-modal-overlay" onClick={() => setOpenIdx(null)}>
          <div className="deity-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="deity-modal-close" onClick={() => setOpenIdx(null)} aria-label="Chiudi">✕</button>
            <img className="deity-modal-img" src={open.immagine} alt={open.nome}
                 onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <h3 className="deity-modal-name">{open.nome}</h3>
            <p className="deity-modal-titolo">{open.titoli || open.titolo}</p>
            <div className="deity-modal-meta">
              <p><strong>Dominio:</strong> {open.dominio}</p>
              <p><strong>Simbolo:</strong> {open.simbolo}</p>
            </div>
            <p className="deity-modal-desc">{open.descrizione}</p>
            <p className="deity-modal-dogma"><em>{open.dogma}</em></p>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## Altri componenti in `src/components/` (page-specific, non primitivi)
- `ArenaMarketCatalog.jsx` (43KB) — catalogo Bottega Arena, specifico della pagina ArenaMarket.
- `PetCardDetail.jsx` — scheda dettaglio pet (sistema Pet attualmente disabilitato).
- `SendNotification.jsx` (+ .css) — pagina admin invio notifiche push (montata come route `/dm-admin/send-notif`).
- `GlobalChat.jsx`, `NotificationOptIn.jsx`, `FirestoreErrorGuard.jsx` — componenti di shell/app: codice completo in `layouts.md`.
