# Theme — eldoria-web ("Crit Happens")

CSS approach: **vanilla CSS**, nessun Tailwind. Cascata (ordine import in `src/main.jsx`, l'ultimo vince):
`src/style.css` (legacy base, 84KB) → `src/styles/theme.css` (design system scuro "Arcanum Nocturne") → `src/styles/shell.css` (header/drawer) → `src/styles/light-theme.css` (tema chiaro **"Pergamena Antica"**, default) → `src/styles/layout.css` (bottom-bar, FAB, safe-area).
Sistema condiviso per-pagina: `src/styles/cinematic.css` (importato dalle singole pagine). Le pagine di gioco ripristinano il set scuro via `body.theme-dark`.

---

# PARTE 1 — Sommario compatto dei token

## Palette — tema CHIARO "Pergamena Antica" (`:root` in `light-theme.css`, default sito)

| Token | Valore | Uso |
|---|---|---|
| `--bg-0` | `#f1e7cf` | fondo app (carta antica) |
| `--bg-1` | `#e9dcbe` | superfici |
| `--bg-2` | `#fbf4e0` | card (velina chiara) |
| `--bg-3` | `#fffdf5` | elementi elevati |
| `--line` / `--line-soft` | `#c9b78a` / `#dccfa6` | bordi seppia |
| `--overlay` | `rgba(45,32,14,.42)` | backdrop |
| `--amber` / `--amber-deep` / `--amber-soft` | `#a9781a` / `#7c560f` / `#caa039` | oro antico |
| `--arc` / `--arc-deep` / `--arc-soft` | `#7a4fcf` / `#553099` / `#8a63dd` | viola arcano |
| `--crit` / `--crit-deep` | `#b8362a` / `#8a261c` | rosso "crit" |
| `--ok` / `--warn` / `--info` | `#2f8f5b` / `#b07d1a` / `#2b7fc0` | semantici |
| `--ink` / `--muted` / `--faint` | `#33281a` / `#6a5b41` / `#9a8a6b` | testo inchiostro seppia |
| `--text` (legacy) | `#33281a` | |

Body chiaro: gradiente carta `#f3ead4 → #efe4ca → #eaddbd` + due radial (ambra 10%, arcano 7%). MAI `background-attachment: fixed` (rotto su iOS).

## Palette — tema SCURO "Arcanum Nocturne" (`body.theme-dark`, pagine Arena/TCG/WorldBoss/Pet; stessi valori in `theme.css :root` prima dell'override chiaro)

| Token | Valore |
|---|---|
| `--bg-0/1/2/3` | `#0b1220` / `#0f1729` / `#141d33` / `#1b2742` (deep navy) |
| `--line` / `--line-soft` | `#293a5e` / `#1d2a45` |
| `--amber` / `--amber-deep` / `--amber-soft` | `#f0a93b` / `#c07e1e` / `#f8cd7e` |
| `--arc` / `--arc-deep` / `--arc-soft` | `#b07cff` / `#7d4fd6` / `#cdb0ff` |
| `--crit` / `--crit-deep` | `#ff5a4d` / `#c12d22` |
| `--ok` / `--warn` / `--info` | `#46c98b` / `#f0a93b` / `#5ab0ff` |
| `--ink` / `--muted` / `--faint` | `#eef2ff` / `#9fabcb` / `#6c789b` |

## Token legacy (`style.css :root`, rimappati da theme.css)
`--red:#820a0a` · `--gold:#d4af37` · `--bg:#ffffff` · `--text:#111111` — theme.css li rimappa: `--bg→var(--bg-0)`, `--gold→var(--amber)`, `--red→var(--crit)`, `--font-title→var(--font-display)`, `--font-text→var(--font-ui)`.

## Tipografia (Google Fonts in index.html: Cardo, Cinzel 500-700, Cinzel Decorative 400/700/900, Manrope 400-800, EB Garamond ital)
- `--font-display`: "Cinzel Decorative", serif — hero ornato (`--font-title` legacy)
- `--font-head`: "Cinzel", Georgia, serif — titoli / nav
- `--font-ui`: "EB Garamond", Georgia, serif — UI/testo (`--font-text` legacy; in style.css era "Cardo")
- `--font-sans`: "Manrope", system-ui, sans-serif — dati densi
- `--font-lore`: "EB Garamond", Georgia, serif — narrativa
- Scala: `.ch-h1` clamp(28px,7vw,52px) · `.ch-h2` clamp(20px,4.5vw,30px) · `.cine-hero-title` clamp(2.2rem,7vw,5rem) · `.cine-scrolly-title` clamp(1.8rem,4.5vw,3.2rem) · `.cine-section-title` clamp(1.3rem,3.5vw,2rem) · eyebrow 12px/0.72rem uppercase letterspaced.

## Spacing / Radius / Layout
- Spazi: `--sp-1..8` = 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
- Raggi: `--r-xs:6px --r-sm:10px --r-md:14px --r-lg:20px --r-xl:28px --r-pill:999px`; cinematic: `--cine-radius:22px`
- Larghezza contenuto: `--maxw:1180px` (`.ch-wrap`, `.cine-wrap`; `--narrow` 860px, `--wide` 1320px)
- Navbar: `--navbar-h` 80px (≤1300px:130, ≤620px:150, ≤400px:165). Bottom-bar: `--bottombar-h:60px` (+ safe-area). FAB: `--fab-edge:16px`, `--fab-gap:12px`.

## Ombre & glow
- Chiaro: `--shadow-1: 0 2px 10px rgba(86,64,30,.16)` · `--shadow-2: 0 14px 44px -14px rgba(86,64,30,.30)` · `--shadow-3: 0 28px 70px -24px rgba(86,64,30,.38)`
- Scuro: stesse forme su nero (.35/.65/.75)
- Glow: `--glow-amber/-arc/-crit` = ring 1px + soft drop del colore
- Gradienti firma: `--grad-amber` `--grad-arc` `--grad-crit` (135deg, 3 stop) + `--grad-night` (solo dark)

## Motion
`--dur-fast:.16s --dur:.28s --dur-slow:.5s` · `--ease:cubic-bezier(.22,.61,.36,1)` · `--ease-out:cubic-bezier(.16,1,.3,1)` · `--ease-spring:cubic-bezier(.34,1.56,.64,1)`. Keyframes condivisi: `ch-fade-up/fade-in/pop/glow-pulse/shimmer/float/spin-rune`, `cine-rise/bounce/pulse/rise-in`. Reveal allo scroll: `.ch-reveal(.is-in)` o scroll-driven `animation-timeline: view()` sulle `.cine-card/.cine-panel`. `prefers-reduced-motion` sempre rispettato. Parallax via CSS var `--cine-scroll` (hook `useParallaxScroll`).

## Breakpoints ricorrenti
- **1300px** — soglia desktop/mobile della shell (top-bar inline vs drawer + bottom-bar)
- 1280px (side-nav cine → dock in basso) · 1120px (hero più alto da desktop) · 900px / 760px / 768px / 620px / 600px / 520px / 480px / 400px (aggiustamenti per pagina)

## Sistema "cine" (cinematic.css) — classi chiave
`.cine-page` (sfondo pergamena parametrizzato: `--cine-accent #6f44c9`, `--cine-accent-2 #8a63dd`, `--cine-gold #a9781a`, `--cine-gold-soft #f1d8a0` testo su scuro, `--cine-gold-ink #7c560f` testo su carta, bg top/mid/bot `#f3ead4/#efe4ca/#eaddbd`) · `.cine-hero` (full-bleed 86-96vh, img parallax, vignette, gradiente che fonde nella carta) · `.cine-scrolly` (divisore scrollytell; in `.cine-compact` diventa banner contenuto) · `.cine-panel` / `.cine-panel-dark` / `.cine-card` · `.cine-btn(--gold|--ghost)` · `.cine-toolbar` (sticky search+chips) · `.cine-eyebrow` / `.cine-pill` / `.cine-section-title` · `.cine-side-nav` (rail dismessa sulle pagine ristrutturate) · `.cine-loading` / `.cine-empty`.

## Sistema "ch-" (theme.css) — componenti base
`.ch-wrap .ch-h1 .ch-h2 .ch-eyebrow .ch-lore .ch-btn(--amber|--arc|--crit|--ghost) .ch-card .ch-panel .ch-chip(--amber|--crit) .ch-field .ch-label .ch-input .ch-select .ch-textarea .ch-grid .ch-divider .ch-skel .ch-loader .ch-rune-spin`.

Nota: `src/index.css` (default Vite) esiste ma NON è importato da `main.jsx` — è morto.

---

# PARTE 2 — Dump raw dei CSS di tema

## `src/styles/light-theme.css` (tema chiaro "Pergamena Antica" — COMPLETO)

```css
/* ============================================================================
   CRIT HAPPENS — Tema chiaro "Pergamena Antica"
   Caricato PER ULTIMO (dopo style.css, theme.css, shell.css) così vince.
   Il sito è light di default; le pagine immersive di gioco (arena/tcg/boss/pet)
   restano scure tramite `body.theme-dark`, che ripristina i token Arcanum.
   NON tocca le animazioni di sfondo esistenti (AmbientFX, body::before/after, hero).
   Palette: pergamena invecchiata + oro antico + arcano viola + rosso "crit".
   ============================================================================ */

:root {
  /* ── Superfici (pergamena invecchiata) ── */
  --bg-0:#f1e7cf;   /* fondo app — bianco sporco / carta antica */
  --bg-1:#e9dcbe;   /* superfici */
  --bg-2:#fbf4e0;   /* card — velina chiara */
  --bg-3:#fffdf5;   /* elementi elevati */
  --line:#c9b78a;   /* bordo inchiostro/seppia */
  --line-soft:#dccfa6;
  --overlay:rgba(45,32,14,.42);

  /* ── Accenti (oro antico + arcano + crit), calibrati su fondo chiaro ── */
  --amber:#a9781a;  --amber-deep:#7c560f;  --amber-soft:#caa039;
  --arc:#7a4fcf;    --arc-deep:#553099;    --arc-soft:#8a63dd;
  --crit:#b8362a;   --crit-deep:#8a261c;
  --ok:#2f8f5b;     --warn:#b07d1a;        --info:#2b7fc0;

  /* ── Testo (inchiostro seppia) ── */
  --ink:#33281a;  --muted:#6a5b41;  --faint:#9a8a6b;

  /* ── Ombre morbide (calde, non nere dure) ── */
  --shadow-1:0 2px 10px rgba(86,64,30,.16);
  --shadow-2:0 14px 44px -14px rgba(86,64,30,.30);
  --shadow-3:0 28px 70px -24px rgba(86,64,30,.38);
  --glow-amber:0 0 0 1px rgba(169,120,26,.40), 0 10px 30px -10px rgba(169,120,26,.40);
  --glow-arc:0 0 0 1px rgba(122,79,207,.40), 0 10px 30px -10px rgba(122,79,207,.40);
  --glow-crit:0 0 0 1px rgba(184,54,42,.40), 0 10px 30px -10px rgba(184,54,42,.40);

  /* ── Gradienti firma (su chiaro) ── */
  --grad-amber:linear-gradient(135deg,#e6c477,#c79a32 45%,#a9781a);
  --grad-arc:linear-gradient(135deg,#b79bf0,#8a63dd 45%,#553099);
  --grad-crit:linear-gradient(135deg,#d96a5d,#b8362a 45%,#8a261c);

  /* token legacy di style.css */
  --text:#33281a;
}

/* ── Ambiente light: fondo carta + leggera vignettatura calda.
   (le animazioni di sfondo restano: qui tocchiamo solo background/colore) ── */
body:not(.theme-dark) {
  /* NB: niente background-attachment:fixed (janky/rotto su iOS Safari).
     Lo sfondo carta è uniforme → scorrere con la pagina è impercettibile. */
  background:
    radial-gradient(1200px 760px at 78% -8%, rgba(169,120,26,.10), transparent 60%),
    radial-gradient(900px 680px at 8% 6%, rgba(122,79,207,.07), transparent 55%),
    linear-gradient(180deg,#f3ead4,#efe4ca 60%,#eaddbd);
  background-attachment: scroll;
  color:var(--ink);
}
body:not(.theme-dark) ::selection { background:rgba(169,120,26,.28); color:#2a2010; }

/* Titoli ornati su pergamena (il gradiente chiaro originale sparirebbe) */
body:not(.theme-dark) .ch-h1 {
  background:linear-gradient(180deg,#4a3a22,#7c560f);
  -webkit-background-clip:text; background-clip:text; color:transparent;
}
body:not(.theme-dark) .ch-h2 { color:var(--amber-deep); }
body:not(.theme-dark) .ch-eyebrow { color:var(--arc-deep); }
body:not(.theme-dark) .ch-lore { color:#46382a; }

/* Card/pannelli: bordo seppia su velina chiara */
body:not(.theme-dark) .ch-card { background:linear-gradient(180deg,var(--bg-2),#f6eed6); }
body:not(.theme-dark) .ch-card::before { background:radial-gradient(420px 220px at 100% 0%, rgba(122,79,207,.12), transparent 60%); }
body:not(.theme-dark) .ch-input,
body:not(.theme-dark) .ch-select,
body:not(.theme-dark) .ch-textarea { background:#fffdf5; color:var(--ink); }
body:not(.theme-dark) .ch-input::placeholder,
body:not(.theme-dark) .ch-textarea::placeholder { color:#9c8a68; }
body:not(.theme-dark) .ch-chip { background:rgba(122,79,207,.12); color:var(--arc-deep); border-color:rgba(122,79,207,.28); }
body:not(.theme-dark) .ch-chip--amber { background:rgba(169,120,26,.14); color:var(--amber-deep); border-color:rgba(169,120,26,.30); }

/* ============================================================================
   HEADER / NAVIGAZIONE — restyle pergamena (override degli !important di shell.css)
   ============================================================================ */
body:not(.theme-dark) .app-nav {
  background:rgba(247,238,214,.82) !important;
  border-bottom:1px solid var(--line) !important;
  box-shadow:0 8px 26px -16px rgba(86,64,30,.5) !important;
}
body:not(.theme-dark) .logo-img { filter:drop-shadow(0 2px 8px rgba(169,120,26,.35)); }

/* link nav: inchiostro oro-bruno su carta */
body:not(.theme-dark) nav a,
body:not(.theme-dark) .nav-dd-trigger {
  color:#6b4f1a !important;
}
body:not(.theme-dark) nav a:hover,
body:not(.theme-dark) .nav-dd-trigger:hover {
  color:#3a2a08 !important;
  background:linear-gradient(90deg, rgba(169,120,26,.20), rgba(122,79,207,.12)) !important;
  box-shadow:inset 0 0 0 1px rgba(169,120,26,.45), 0 0 18px -6px rgba(169,120,26,.45) !important;
  text-shadow:none;
}
body:not(.theme-dark) nav a.active {
  background:var(--grad-amber) !important; color:#2a1d02 !important; box-shadow:var(--glow-amber);
}
body:not(.theme-dark) .nav-dd--open .nav-dd-trigger { background:var(--grad-arc) !important; color:#fff !important; }

/* dropdown chiaro */
body:not(.theme-dark) .nav-dd-menu {
  background:linear-gradient(180deg,#fffdf5,#f3ead4) !important;
  border:1px solid var(--line) !important; border-top:3px solid var(--amber) !important;
}
body:not(.theme-dark) .nav-dd-menu a { color:#6a5b41 !important; border-bottom:1px solid var(--line-soft) !important; }
body:not(.theme-dark) .nav-dd-menu a:hover { background:rgba(122,79,207,.12) !important; color:var(--ink) !important; }
body:not(.theme-dark) .nav-dd-menu a.active {
  background:rgba(169,120,26,.14) !important; color:var(--amber-deep) !important;
  border-left:3px solid var(--amber) !important;
}

/* DM Tools (azzurro) resta com'è — buon contrasto anche su chiaro */

/* drawer mobile chiaro */
@media (max-width: 1300px) {
  body:not(.theme-dark) nav,
  body:not(.theme-dark) nav.active {
    background:linear-gradient(180deg,#f6edd6,#efe2c4) !important;
    border-left:1px solid var(--line) !important;
    box-shadow:-24px 0 60px -20px rgba(86,64,30,.45) !important;
  }
  body:not(.theme-dark) .nav-backdrop { background:var(--overlay); }
  body:not(.theme-dark) .nav-close { color:#b8362a; }
  body:not(.theme-dark) .nav-close:hover { color:#8a261c; text-shadow:0 0 10px rgba(184,54,42,.5); }
}

/* lo sfondo decorativo (drago) su chiaro: appena accennato e più caldo */
body:not(.theme-dark)::before { opacity:.045; filter:hue-rotate(-12deg) saturate(.6) brightness(.9); }
body:not(.theme-dark)::after  { opacity:.04;  filter:sepia(.5) brightness(.95); }

/* ============================================================================
   PAGINE DI GIOCO — ripristino integrale del tema scuro "Arcanum Nocturne"
   (i token devono tornare scuri, altrimenti il testo a token diventa
   seppia-scuro su fondo scuro). I valori sono quelli originali di theme.css.
   ============================================================================ */
body.theme-dark {
  --bg-0:#0b1220; --bg-1:#0f1729; --bg-2:#141d33; --bg-3:#1b2742;
  --line:#293a5e; --line-soft:#1d2a45; --overlay:rgba(7,11,22,.66);
  --amber:#f0a93b; --amber-deep:#c07e1e; --amber-soft:#f8cd7e;
  --arc:#b07cff;   --arc-deep:#7d4fd6;   --arc-soft:#cdb0ff;
  --crit:#ff5a4d;  --crit-deep:#c12d22;
  --ok:#46c98b;    --warn:#f0a93b;       --info:#5ab0ff;
  --ink:#eef2ff;   --muted:#9fabcb;      --faint:#6c789b;
  --text:#eef2ff;
  --shadow-1:0 2px 10px rgba(0,0,0,.35);
  --shadow-2:0 14px 44px -14px rgba(0,0,0,.65);
  --shadow-3:0 28px 70px -24px rgba(0,0,0,.75);
  --glow-amber:0 0 0 1px rgba(240,169,59,.40), 0 10px 34px -10px rgba(240,169,59,.55);
  --glow-arc:0 0 0 1px rgba(176,124,255,.45), 0 10px 34px -10px rgba(176,124,255,.60);
  --glow-crit:0 0 0 1px rgba(255,90,77,.45), 0 10px 34px -10px rgba(255,90,77,.55);
  --grad-amber:linear-gradient(135deg,#f8cd7e,#f0a93b 45%,#c07e1e);
  --grad-arc:linear-gradient(135deg,#cdb0ff,#b07cff 45%,#7d4fd6);
  --grad-crit:linear-gradient(135deg,#ff7d72,#ff5a4d 45%,#c12d22);
  background:var(--grad-night) fixed;
  color:var(--ink);
}
```

## `src/styles/theme.css` (design system "Arcanum Nocturne" + componenti `ch-` — COMPLETO)

```css
/* ============================================================================
   CRIT HAPPENS — Design System "Arcanum Nocturne"
   Fondazione globale: design tokens + componenti base + animazioni.
   Caricato DOPO style.css (in main.jsx) così rimappa i token legacy
   (--bg/--gold/--red/--font-*) verso il nuovo sistema scuro coerente.
   Solo presentazione: nessuna logica, nessun nome di rotta/import toccato.
   Palette: deep navy + ambra + viola neon (+ rosso "crit" semantico).
   ============================================================================ */

:root {
  /* ── Superfici (deep navy) ── */
  --bg-0:#0b1220;   /* fondo app            */
  --bg-1:#0f1729;   /* superfici            */
  --bg-2:#141d33;   /* card                 */
  --bg-3:#1b2742;   /* elementi elevati     */
  --line:#293a5e;   /* bordi                */
  --line-soft:#1d2a45;
  --overlay:rgba(7,11,22,.66);

  /* ── Accenti ── */
  --amber:#f0a93b;  --amber-deep:#c07e1e;  --amber-soft:#f8cd7e;
  --arc:#b07cff;    --arc-deep:#7d4fd6;    --arc-soft:#cdb0ff;
  --crit:#ff5a4d;   --crit-deep:#c12d22;
  --ok:#46c98b;     --warn:#f0a93b;        --info:#5ab0ff;

  /* ── Testo ── */
  --ink:#eef2ff;  --muted:#9fabcb;  --faint:#6c789b;

  /* ── Tipografia (fantasy) ── */
  --font-display:"Cinzel Decorative", serif;   /* hero ornato        */
  --font-head:"Cinzel", Georgia, serif;         /* titoli / nav       */
  --font-ui:"EB Garamond", Georgia, serif;      /* UI / testo (serif fantasy) */
  --font-sans:"Manrope", system-ui, sans-serif; /* fallback per dati densi */
  --font-lore:"EB Garamond", Georgia, serif;    /* narrativa lunga    */

  /* ── Raggi ── */
  --r-xs:6px; --r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:28px; --r-pill:999px;

  /* ── Spazi ── */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px; --sp-8:64px;

  /* ── Ombre & glow ── */
  --shadow-1:0 2px 10px rgba(0,0,0,.35);
  --shadow-2:0 14px 44px -14px rgba(0,0,0,.65);
  --shadow-3:0 28px 70px -24px rgba(0,0,0,.75);
  --glow-amber:0 0 0 1px rgba(240,169,59,.40), 0 10px 34px -10px rgba(240,169,59,.55);
  --glow-arc:0 0 0 1px rgba(176,124,255,.45), 0 10px 34px -10px rgba(176,124,255,.60);
  --glow-crit:0 0 0 1px rgba(255,90,77,.45), 0 10px 34px -10px rgba(255,90,77,.55);

  /* ── Gradienti firma ── */
  --grad-amber:linear-gradient(135deg,#f8cd7e,#f0a93b 45%,#c07e1e);
  --grad-arc:linear-gradient(135deg,#cdb0ff,#b07cff 45%,#7d4fd6);
  --grad-crit:linear-gradient(135deg,#ff7d72,#ff5a4d 45%,#c12d22);
  --grad-night:radial-gradient(1200px 800px at 75% -10%, rgba(176,124,255,.12), transparent 60%),
               radial-gradient(900px 700px at 10% 8%, rgba(240,169,59,.08), transparent 55%),
               linear-gradient(180deg,#0b1220,#0a0f1c 60%,#080c16);

  /* ── Motion ── */
  --dur-fast:.16s; --dur:.28s; --dur-slow:.5s;
  --ease:cubic-bezier(.22,.61,.36,1);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --ease-spring:cubic-bezier(.34,1.56,.64,1);

  /* ── Layout ── */
  --bottomnav-h:64px;
  --maxw:1180px;

  /* ── REMAP token legacy → nuovo sistema (così tutte le pagine si scuriscono) ── */
  --bg:var(--bg-0);
  --gold:var(--amber);   --gold-deep:var(--amber-deep);   --gold-dim:var(--amber-deep);
  --red:var(--crit);     --red-soft:var(--crit-deep);
  --font-title:var(--font-display);
  --font-text:var(--font-ui);
}

/* ── Reset/ambiente di base ── */
html { -webkit-text-size-adjust:100%; }
body {
  background:var(--grad-night) fixed;
  color:var(--ink);
  font-family:var(--font-ui);
  letter-spacing:.1px;
}
::selection { background:rgba(176,124,255,.35); color:#fff; }

/* Scrollbar coerente */
* { scrollbar-width:thin; scrollbar-color:var(--arc-deep) transparent; }
*::-webkit-scrollbar { width:10px; height:10px; }
*::-webkit-scrollbar-thumb { background:linear-gradient(180deg,var(--amber-deep),var(--arc-deep)); border-radius:99px; }
*::-webkit-scrollbar-track { background:transparent; }

/* ============================================================================
   COMPONENTI BASE (prefisso ch- per non collidere con classi esistenti)
   ============================================================================ */

/* ── Contenitore pagina ── */
.ch-wrap { width:100%; max-width:var(--maxw); margin-inline:auto; padding-inline:clamp(14px,4vw,28px); }

/* ── Titoli ── */
.ch-h1 { font-family:var(--font-display); font-weight:900; font-size:clamp(28px,7vw,52px); line-height:1.04; color:var(--ink);
  background:linear-gradient(180deg,#fff,#cfd6ee); -webkit-background-clip:text; background-clip:text; color:transparent; }
.ch-h2 { font-family:var(--font-head); font-weight:700; font-size:clamp(20px,4.5vw,30px); color:var(--amber-soft); letter-spacing:.5px; }
.ch-eyebrow { font-family:var(--font-head); text-transform:uppercase; letter-spacing:.28em; font-size:12px; color:var(--arc-soft); }
.ch-lore { font-family:var(--font-lore); font-size:1.08rem; line-height:1.7; color:#d7ddf2; }

/* ── Bottoni: micro-animazioni hover/click + ripple ── */
.ch-btn {
  --bg:var(--bg-3); --fg:var(--ink); --bd:var(--line);
  position:relative; display:inline-flex; align-items:center; justify-content:center; gap:.55em;
  padding:12px 20px; border-radius:var(--r-pill); border:1px solid var(--bd);
  background:var(--bg); color:var(--fg); cursor:pointer; overflow:hidden;
  font-family:var(--font-ui); font-weight:700; font-size:15px; letter-spacing:.2px;
  transition:transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur) var(--ease), filter var(--dur) var(--ease);
  will-change:transform;
}
.ch-btn:hover { transform:translateY(-2px); }
.ch-btn:active { transform:translateY(0) scale(.97); }
.ch-btn::after { /* ripple */
  content:""; position:absolute; inset:0; border-radius:inherit;
  background:radial-gradient(circle at center, rgba(255,255,255,.35), transparent 45%);
  opacity:0; transform:scale(.4); transition:transform .5s var(--ease-out), opacity .6s;
}
.ch-btn:active::after { opacity:.5; transform:scale(1.6); transition:0s; }
.ch-btn--amber { --bg:var(--grad-amber); --fg:#2a1a04; --bd:transparent; }
.ch-btn--amber:hover { box-shadow:var(--glow-amber); }
.ch-btn--arc { --bg:var(--grad-arc); --fg:#190a33; --bd:transparent; }
.ch-btn--arc:hover { box-shadow:var(--glow-arc); }
.ch-btn--crit { --bg:var(--grad-crit); --fg:#270603; --bd:transparent; }
.ch-btn--crit:hover { box-shadow:var(--glow-crit); }
.ch-btn--ghost { --bg:transparent; --bd:var(--line); }
.ch-btn--ghost:hover { --bd:var(--amber); box-shadow:var(--glow-amber); }
.ch-btn:disabled { opacity:.45; cursor:default; transform:none !important; box-shadow:none !important; }

/* ── Card ── */
.ch-card {
  position:relative; background:linear-gradient(180deg,var(--bg-2),var(--bg-1));
  border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--sp-5);
  box-shadow:var(--shadow-1); overflow:hidden;
  transition:transform var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.ch-card::before { /* bagliore d'angolo */
  content:""; position:absolute; inset:0; pointer-events:none; opacity:.0;
  background:radial-gradient(420px 220px at 100% 0%, rgba(176,124,255,.16), transparent 60%);
  transition:opacity var(--dur) var(--ease);
}
.ch-card:hover { transform:translateY(-4px); border-color:var(--arc-deep); box-shadow:var(--shadow-2); }
.ch-card:hover::before { opacity:1; }
.ch-card--amber:hover { border-color:var(--amber-deep); }

/* ── Pannello (superficie neutra) ── */
.ch-panel { background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:var(--sp-4); }

/* ── Chip / tag ── */
.ch-chip {
  display:inline-flex; align-items:center; gap:.4em; padding:5px 12px; border-radius:var(--r-pill);
  font-size:12px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
  background:rgba(176,124,255,.12); color:var(--arc-soft); border:1px solid rgba(176,124,255,.25);
}
.ch-chip--amber { background:rgba(240,169,59,.12); color:var(--amber-soft); border-color:rgba(240,169,59,.28); }
.ch-chip--crit  { background:rgba(255,90,77,.12); color:#ff9a90; border-color:rgba(255,90,77,.30); }

/* ── Campi form ── */
.ch-field { display:flex; flex-direction:column; gap:6px; }
.ch-label { font-family:var(--font-head); font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
.ch-input, .ch-select, .ch-textarea {
  width:100%; background:var(--bg-0); color:var(--ink); border:1px solid var(--line);
  border-radius:var(--r-sm); padding:12px 14px; font-family:var(--font-ui); font-size:15px;
  transition:border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background var(--dur);
}
.ch-input:focus, .ch-select:focus, .ch-textarea:focus {
  outline:none; border-color:var(--arc); box-shadow:0 0 0 3px rgba(176,124,255,.18); background:var(--bg-1);
}
.ch-input::placeholder, .ch-textarea::placeholder { color:#5e6b8e; }

/* ── Griglia fluida 1→3+ colonne ── */
.ch-grid { display:grid; gap:var(--sp-4); grid-template-columns:repeat(auto-fill, minmax(min(100%,280px), 1fr)); }

/* ── Divider runico ── */
.ch-divider { height:1px; border:0; background:linear-gradient(90deg,transparent,var(--line),transparent); margin:var(--sp-5) 0; }

/* ============================================================================
   ANIMAZIONI
   ============================================================================ */
@keyframes ch-fade-up   { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
@keyframes ch-fade-in   { from { opacity:0; } to { opacity:1; } }
@keyframes ch-pop       { 0% { opacity:0; transform:scale(.92) translateY(10px); } 100% { opacity:1; transform:none; } }
@keyframes ch-glow-pulse{ 0%,100% { box-shadow:0 0 0 0 rgba(176,124,255,.0); } 50% { box-shadow:0 0 26px -4px rgba(176,124,255,.55); } }
@keyframes ch-shimmer   { 100% { background-position:200% 0; } }
@keyframes ch-float     { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
@keyframes ch-spin-rune { to { transform:rotate(360deg); } }

/* Ingressi allo scroll: aggiungi class .ch-reveal; .is-in la attiva (via IntersectionObserver presentazionale) */
.ch-reveal { opacity:0; transform:translateY(22px); transition:opacity .6s var(--ease-out), transform .6s var(--ease-out); }
.ch-reveal.is-in { opacity:1; transform:none; }
.ch-reveal[data-d="1"] { transition-delay:.08s; }
.ch-reveal[data-d="2"] { transition-delay:.16s; }
.ch-reveal[data-d="3"] { transition-delay:.24s; }
.ch-reveal[data-d="4"] { transition-delay:.32s; }

/* Entra di default (fallback se l'observer non gira) */
.ch-animate-in { animation:ch-fade-up .6s var(--ease-out) both; }

/* ── Loading "shimmer" (no spinner statico) ── */
.ch-skel {
  border-radius:var(--r-sm);
  background:linear-gradient(100deg, var(--bg-2) 30%, var(--bg-3) 50%, var(--bg-2) 70%);
  background-size:200% 100%; animation:ch-shimmer 1.3s linear infinite;
}
/* ── Loading "dadi che rotolano" ── */
.ch-loader { display:inline-flex; gap:8px; align-items:center; }
.ch-loader i {
  width:12px; height:12px; border-radius:4px; display:inline-block;
  background:var(--grad-amber); animation:ch-float 1s var(--ease) infinite;
}
.ch-loader i:nth-child(2){ animation-delay:.12s; background:var(--grad-arc); }
.ch-loader i:nth-child(3){ animation-delay:.24s; background:var(--grad-crit); }

/* ── Anello rune per stati "caricamento" pieni ── */
.ch-rune-spin { width:42px; height:42px; border-radius:50%;
  border:2px solid rgba(176,124,255,.18); border-top-color:var(--amber); animation:ch-spin-rune .9s linear infinite; }

/* ============================================================================
   ACCESSIBILITÀ: rispetta prefers-reduced-motion
   ============================================================================ */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; }
  .ch-reveal { opacity:1; transform:none; }
  body { background-attachment:scroll; }
}
```

## `src/styles/layout.css` (bottom-bar mobile + FAB dock + safe-area — COMPLETO)

```css
/* ============================================================
   LAYOUT & NAVIGAZIONE RESPONSIVE — caricato PER ULTIMO.
   Solo presentazione: nessuna logica/handler/route toccati.

   • Desktop (>1300px): top-bar con nav inline (come oggi, restyle).
   • Mobile/tablet (≤1300px): TOP-BAR (marchio + auth) + BOTTOM-BAR di
     navigazione (Home · Mondo · Biblioteca · Gilda · Menu). Le categorie aprono
     una bottom-sheet; "Menu" apre il drawer completo (tutto il resto).
   • Flottanti (chat/presenza/calendario) riuniti in un dock coerente,
     SEMPRE sopra la bottom-bar, con safe-area iOS.
   ============================================================ */
:root {
  --fab-edge: 16px;
  --fab-gap: 12px;
  --fab-chat: 52px;
  --fab-online: 48px;
  --fab-sidebar: 48px;
  --bottombar-h: 60px;
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  /* Base verticale dei FAB: su desktop sull'edge, su mobile SOPRA la bottom-bar */
  --fab-base: calc(var(--fab-edge) + var(--safe-b));
}

/* ============================================================
   DOCK FLOTTANTI — chat (destra) · presenza online (sinistra)
   ============================================================ */
.chat-toggle-btn {
  bottom: var(--fab-base) !important;
  right: calc(var(--fab-edge) + var(--safe-r)) !important;
  left: auto !important;
}
.global-chat-window {
  bottom: calc(var(--fab-base) + var(--fab-chat) + var(--fab-gap)) !important;
  right: calc(var(--fab-edge) + var(--safe-r)) !important;
  left: auto !important;
}
.online-fab {
  left: calc(var(--fab-edge) + var(--safe-l)) !important;
  right: auto !important;
  bottom: var(--fab-base) !important;
}
.online-popup {
  left: calc(var(--fab-edge) + var(--safe-l)) !important;
  right: auto !important;
  bottom: calc(var(--fab-base) + var(--fab-online) + var(--fab-gap)) !important;
}

/* Header: rispetta il notch in orizzontale */
.app-nav {
  padding-left: max(12px, env(safe-area-inset-left, 0px)) !important;
  padding-right: max(12px, env(safe-area-inset-right, 0px)) !important;
}

/* ============================================================
   BOTTOM-BAR (mobile/tablet ≤1300px)
   ============================================================ */
.app-bottom-nav { display: none; }

@media (max-width: 1300px) {
  /* i FAB salgono SOPRA la barra */
  :root { --fab-base: calc(var(--bottombar-h) + var(--safe-b) + 10px); }

  /* la voce "Menu" della bottom-bar sostituisce il burger */
  .burger { display: none !important; }

  .app-bottom-nav {
    display: flex;
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 1065; /* sopra il backdrop della sheet → tab sempre tappabili */
    height: calc(var(--bottombar-h) + var(--safe-b));
    padding-bottom: var(--safe-b);
    align-items: stretch;
    justify-content: space-around;
    background: linear-gradient(180deg, rgba(255,250,235,.95), rgba(243,234,212,.985));
    border-top: 1px solid var(--line, #c9b78a);
    box-shadow: 0 -10px 30px -14px rgba(86,64,30,.45);
    -webkit-backdrop-filter: blur(14px) saturate(1.2);
    backdrop-filter: blur(14px) saturate(1.2);
  }

  .mnav-tab {
    flex: 1 1 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px;
    background: none; border: none; cursor: pointer;
    padding: 7px 2px 5px; margin: 0;
    text-decoration: none; position: relative;
    color: #6a5b41;
    font-family: var(--font-head, "Cinzel"), Georgia, serif;
    font-size: .62rem; letter-spacing: .05em; line-height: 1;
    transition: color .15s ease;
  }
  .mnav-ic { font-size: 1.2rem; line-height: 1; filter: grayscale(.25) opacity(.85); transition: transform .18s var(--ease-spring, ease), filter .18s ease; }
  .mnav-lb { white-space: nowrap; }
  .mnav-tab:active { transform: translateY(1px); }
  .mnav-tab.is-active,
  .mnav-tab.active { color: #7c560f; font-weight: 700; }
  .mnav-tab.is-active .mnav-ic,
  .mnav-tab.active .mnav-ic { transform: translateY(-2px) scale(1.12); filter: none; }
  /* sigillo runico sopra la voce attiva */
  .mnav-tab.is-active::before,
  .mnav-tab.active::before {
    content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 28px; height: 3px; border-radius: 0 0 4px 4px;
    background: var(--grad-amber, linear-gradient(90deg, #e6c477, #a9781a));
    box-shadow: 0 2px 8px rgba(169,120,26,.5);
  }

  /* drawer aperto → nascondi la bottom-bar (il drawer copre lo schermo) */
  body:has(nav.active) .app-bottom-nav { display: none; }

  /* contenuti/footer non coperti dalla barra */
  footer { margin-bottom: calc(var(--bottombar-h) + var(--safe-b)); }
  .cine-page { padding-bottom: calc(96px + var(--bottombar-h)); }
}

/* la rail laterale "indice sezioni" (cine) sale sopra la barra su mobile */
@media (max-width: 1280px) {
  .cine-side-nav {
    bottom: calc(var(--bottombar-h) + 12px + var(--safe-b)) !important;
  }
}

/* ============================================================
   SIMBOLI RUNICI delle voci di navigazione (al posto delle icone)
   ============================================================ */
/* Desktop: rune accanto all'etichetta dei dropdown nella top-bar */
.nav-rune {
  display: inline-block;
  margin-right: 0.42em;
  font-size: 1.05em;
  line-height: 1;
  opacity: 0.62;
  transform: translateY(0.04em);
}
.nav-dd--open .nav-rune,
.nav-dd-trigger:hover .nav-rune { opacity: 0.95; }

/* Mobile: la rune fa da "icona" nel tab della bottom-bar (no grayscale). */
.mnav-rune {
  filter: none !important;
  font-weight: 700;
  letter-spacing: 0;
}
/* Mobile: rune nell'intestazione della bottom-sheet */
.mnav-sheet-rune {
  display: inline-block;
  margin-right: 0.3em;
  font-size: 1.15em;
  vertical-align: -0.06em;
  opacity: 0.85;
}

/* ============================================================
   BOTTOM-SHEET di categoria (Mondo / Biblioteca / Gilda)
   ============================================================ */
.mnav-backdrop {
  position: fixed; inset: 0; z-index: 1061;
  background: rgba(45,32,14,.42);
  -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
  animation: mnav-fade .25s ease both;
}
@keyframes mnav-fade { from { opacity: 0; } to { opacity: 1; } }

.mnav-sheet {
  position: fixed;
  left: 0; right: 0;
  bottom: calc(var(--bottombar-h) + var(--safe-b));
  z-index: 1062;
  background: linear-gradient(180deg, #fffdf5, #f3ead4);
  border-top: 3px solid var(--amber, #a9781a);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -22px 50px -18px rgba(86,64,30,.55);
  padding: 10px 14px calc(16px + var(--safe-b));
  animation: mnav-rise .28s cubic-bezier(.16,1,.3,1) both;
}
@keyframes mnav-rise { from { transform: translateY(100%); opacity: .4; } to { transform: translateY(0); opacity: 1; } }

.mnav-sheet-grip {
  display: block; width: 42px; height: 4px; border-radius: 999px;
  background: rgba(124,86,15,.35); margin: 2px auto 12px;
}
.mnav-sheet-head {
  font-family: var(--font-head, "Cinzel"), Georgia, serif;
  font-size: .72rem; letter-spacing: .22em; text-transform: uppercase;
  color: #7c560f; padding: 0 6px 10px; margin-bottom: 6px;
  border-bottom: 1px solid rgba(124,86,15,.18);
}
.mnav-sheet-links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mnav-sheet-link,
.mnav-sheet-links > a {
  display: flex; align-items: center; min-height: 52px;
  padding: 10px 14px; border-radius: 12px;
  background: linear-gradient(135deg, rgba(255,252,245,.96), rgba(247,238,214,.96));
  border: 1px solid rgba(124,86,15,.22);
  border-left: 4px solid var(--arc, #7a4fcf);
  color: #33281a; text-decoration: none;
  font-family: var(--font-ui, Georgia), serif; font-size: .95rem; font-weight: 600;
  box-shadow: 0 4px 14px -8px rgba(86,64,30,.4);
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.mnav-sheet-link:active { transform: scale(.98); }
.mnav-sheet-link.active {
  border-left-color: var(--amber, #a9781a);
  background: linear-gradient(135deg, rgba(169,120,26,.16), rgba(255,252,245,.96));
  color: #5a3d12;
}
/* l'ultima voce dispari occupa l'intera riga */
.mnav-sheet-links > *:last-child:nth-child(odd) { grid-column: 1 / -1; }

@media (prefers-reduced-motion: reduce) {
  .mnav-backdrop, .mnav-sheet { animation: none !important; }
}
```

## `src/styles/shell.css` (header/nav scuro premium + drawer mobile — COMPLETO)

```css
/* ============================================================================
   CRIT HAPPENS — Shell (header + navigazione)  ·  override scuro premium
   Caricato dopo theme.css. Solo CSS: nessun markup/logica toccati.
   Desktop: top-bar in vetro scuro. Mobile: drawer a tutta altezza animato.
   ============================================================================ */

/* ── Sfondo decorativo: ritinta il drago e attenua, coerente col navy ── */
body::before { opacity:.05; filter:hue-rotate(8deg) saturate(.5) brightness(1.3); }
body::after  { opacity:.06; filter:grayscale(.3) brightness(1.2); }

/* ── TOP BAR ── */
.app-nav {
  background:rgba(10,15,26,.78) !important;
  -webkit-backdrop-filter:blur(16px) saturate(1.2);
  backdrop-filter:blur(16px) saturate(1.2);
  border-bottom:1px solid var(--line);
  box-shadow:0 8px 30px -12px rgba(0,0,0,.7) !important;
  padding:10px clamp(14px,4vw,40px) !important;
}

/* Logo: lascio il wordmark originale (oro/rosso, già clippato e leggibile su navy);
   aggiungo solo un alone caldo all'icona. */
.logo:hover { transform:translateY(-1px) scale(1.03); }
.logo-img { filter:drop-shadow(0 2px 10px rgba(240,169,59,.35)); }

/* ── LINK NAV — fantasy oro-pergamena, hover epico ── */
nav a, .nav-dd-trigger {
  color:#ecdcae !important;                 /* oro pergamena, ben leggibile su navy */
  font-family:var(--font-head) !important;  /* Cinzel (fantasy)  */
  font-weight:600 !important; letter-spacing:.06em; border-radius:var(--r-pill); position:relative; overflow:hidden;
  transition:color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease), text-shadow var(--dur) var(--ease) !important;
}
nav a:hover, .nav-dd-trigger:hover {
  color:#fff !important;
  background:linear-gradient(90deg, rgba(240,169,59,.24), rgba(176,124,255,.12)) !important;
  box-shadow:inset 0 0 0 1px rgba(240,169,59,.45), 0 0 20px -4px rgba(240,169,59,.55) !important;
  text-shadow:0 0 14px rgba(240,169,59,.7);
}
nav a.active {
  background:var(--grad-amber) !important; color:#241501 !important; box-shadow:var(--glow-amber);
  text-shadow:none;
}
.nav-dd--open .nav-dd-trigger { background:var(--grad-arc) !important; color:#170a30 !important; text-shadow:none; }

/* Tasto "DM ADMIN" (inline gold): testo scuro leggibile sull'ambra.
   Hover: schiarisco il testo (rosso → ambra chiara) mantenendo lo sfondo oro. */
.admin-link, nav a.admin-link { color:#241501 !important; font-family:var(--font-head) !important; text-shadow:none !important; }
nav a.admin-link:hover { color:#fff5e6 !important; text-shadow:0 1px 3px rgba(0,0,0,.35) !important; }

/* Voci "AGENTI" e "DM ADMIN": sfondo rosso → testo oro chiaro leggibile
   (vince sul colore scuro ereditato da .admin-link). */
.admin-link.admin-link-red, nav a.admin-link.admin-link-red { color:#ffe7a8 !important; text-shadow:0 1px 2px rgba(0,0,0,.45) !important; }
nav a.admin-link.admin-link-red:hover { color:#fff5e6 !important; }

/* Tasto "DM Tools" (dropdown trigger): sfondo azzurro, testo nero.
   Hover: schiarisco il testo mantenendo l'azzurro. */
.nav-dd-trigger[data-dd="dmtools"] {
  background:linear-gradient(180deg,#7fd0ff,#4eb8f5) !important;
  color:#0b1626 !important; text-shadow:none !important;
  box-shadow:0 6px 18px -8px rgba(78,184,245,.6), inset 0 0 0 1px rgba(255,255,255,.25) !important;
}
.nav-dd-trigger[data-dd="dmtools"] .nav-dd-arrow { color:#0b1626 !important; }
.nav-dd-trigger[data-dd="dmtools"]:hover {
  background:linear-gradient(180deg,#1f6fa3,#124b73) !important;
  color:#eaf6ff !important; text-shadow:0 1px 3px rgba(0,0,0,.35) !important;
}
.nav-dd-trigger[data-dd="dmtools"]:hover .nav-dd-arrow { color:#eaf6ff !important; }
.nav-dd--open .nav-dd-trigger[data-dd="dmtools"] {
  background:linear-gradient(180deg,#9bdcff,#62c2f7) !important; color:#0b1626 !important;
}

/* Dropdown scuro */
.nav-dd-menu {
  background:linear-gradient(180deg,var(--bg-2),var(--bg-1)) !important;
  border:1px solid var(--line) !important; border-top:3px solid var(--amber) !important;
  border-radius:0 0 var(--r-md) var(--r-md) !important;
  box-shadow:var(--shadow-2) !important; overflow:hidden;
  animation:ch-pop .22s var(--ease-out) both;
}
.nav-dd-menu a {
  color:var(--muted) !important; border-bottom:1px solid var(--line-soft) !important;
}
.nav-dd-menu a:hover { background:rgba(176,124,255,.12) !important; color:var(--ink) !important; padding-left:24px; }
.nav-dd-menu a.active {
  background:rgba(240,169,59,.12) !important; color:var(--amber-soft) !important;
  border-left:3px solid var(--amber) !important;
}

/* Burger → ambra */
.burger .line { background:var(--amber) !important; box-shadow:0 0 8px rgba(240,169,59,.4); }

/* X di chiusura del drawer: visibile solo su mobile (vedi media query) */
.nav-close { display:none; }

/* Bottoni login/avatar sul fondo scuro restano leggibili (gradiente crit) */
.login-button, .logged-user-button {
  background:var(--grad-crit) !important; color:#fff !important; border:none;
  box-shadow:0 6px 18px -8px rgba(255,90,77,.6);
}

/* ============================================================================
   MOBILE — drawer a tutta altezza (≤1300px, coerente coi breakpoint esistenti)
   ============================================================================ */
@media (max-width: 1300px) {
  :root { --navbar-h: 66px; }

  .app-nav {
    flex-direction:row !important;
    justify-content:space-between; align-items:center;
    border-bottom:1px solid var(--line) !important;
    padding:8px 16px !important;
  }
  .logo { margin-left:0 !important; }
  .logo-img { height:42px !important; }

  /* il <nav> diventa un pannello laterale che scorre da destra */
  nav, .burger.open + nav {
    position:fixed !important; top:0 !important; right:0 !important; left:auto !important; bottom:0 !important;
    width:min(86vw, 380px) !important; height:100dvh !important; margin:0 !important;
    flex-direction:column !important; align-items:stretch !important; justify-content:flex-start !important;
    gap:3px !important; padding:calc(var(--navbar-h) + 14px) 16px 24px !important;
    background:linear-gradient(180deg,#0e1426,#0a0f1c) !important;
    border-left:1px solid var(--line) !important; border-radius:0 !important;
    box-shadow:-24px 0 60px -20px rgba(0,0,0,.8) !important;
    transform:translateX(105%); visibility:hidden; opacity:0;
    transition:transform .42s var(--ease-out), opacity .3s ease, visibility 0s linear .42s;
    overflow-y:auto; z-index:1050 !important; display:flex !important;
  }
  nav.active {
    transform:translateX(0) !important; visibility:visible !important; opacity:1 !important;
    background:linear-gradient(180deg,#0e1426,#0a0f1c) !important; margin:0 !important;
    transition:transform .42s var(--ease-out), opacity .3s ease;
  }
  /* X di chiusura in alto a destra nel drawer */
  .nav-close {
    display:block !important; position:absolute;
    top:calc(var(--navbar-h) - 40px); right:14px;
    width:34px; height:34px; padding:0; line-height:1;
    font-size:26px; font-weight:700;
    background:none; color:#ff8a80; border:none; border-radius:50%;
    cursor:pointer; z-index:2;
    transition:color var(--dur) var(--ease), text-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
  }
  .nav-close:hover { color:#ffd2cd; text-shadow:0 0 10px rgba(255,138,128,.6); transform:scale(1.12); }

  /* backdrop sfocato dietro al drawer: elemento reale e cliccabile (chiude il menu) */
  .nav-backdrop {
    position:fixed; inset:0; z-index:1040;
    background:var(--overlay); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px);
    animation:ch-fade-in .35s ease both;
  }

  /* link a tutta larghezza, ingresso a cascata */
  nav.active > a, nav.active > .nav-dd, nav.active > * {
    width:100%; opacity:0; animation:ch-fade-up .4s var(--ease-out) forwards;
  }
  nav.active > *:nth-child(1){ animation-delay:.05s; }
  nav.active > *:nth-child(2){ animation-delay:.09s; }
  nav.active > *:nth-child(3){ animation-delay:.13s; }
  nav.active > *:nth-child(4){ animation-delay:.17s; }
  nav.active > *:nth-child(5){ animation-delay:.21s; }
  nav.active > *:nth-child(6){ animation-delay:.25s; }
  nav.active > *:nth-child(7){ animation-delay:.29s; }
  nav.active > *:nth-child(8){ animation-delay:.33s; }
  nav.active > *:nth-child(n+9){ animation-delay:.37s; }

  nav a, .nav-dd-trigger {
    display:flex; width:100%; justify-content:flex-start; padding:9px 14px !important;
    font-size:0.92rem !important; letter-spacing:.04em; border-radius:var(--r-sm) !important;
    border:1px solid transparent;
  }
  /* barra runica che cresce a sinistra all'hover (effetto epico) */
  nav a::before, .nav-dd-trigger::before {
    content:""; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:3px;
    background:var(--grad-amber); transform:scaleY(0); transform-origin:center;
    transition:transform .28s var(--ease-spring); box-shadow:0 0 12px rgba(240,169,59,.7);
  }
  nav a:hover::before, .nav-dd-trigger:hover::before { transform:scaleY(1); }
  nav a:hover, .nav-dd-trigger:hover { border-color:rgba(240,169,59,.25); padding-left:24px !important; }
  nav a.active::before { transform:scaleY(0); }
  .nav-dd { width:100%; }
  .nav-dd-menu {
    position:static !important; transform:none !important; width:100% !important; min-width:0 !important;
    box-shadow:none !important; border:none !important; border-left:2px solid var(--amber-deep) !important;
    border-radius:0 !important; margin:4px 0 4px 10px !important; background:transparent !important;
  }
  .nav-dd-menu a { padding:7px 14px 7px 18px !important; font-size:0.84rem !important; }
  nav a::before, .nav-dd-trigger::before { top:6px; bottom:6px; }

  /* col drawer aperto, nascondi i bottoni flottanti (chat, calendario, presenza) */
  body:has(nav.active) .chat-toggle-btn,
  body:has(nav.active) .global-chat-window,
  body:has(nav.active) .floating-sidebar-btn,
  body:has(nav.active) .online-fab { display:none !important; }
}

/* Niente animazioni se l'utente preferisce ridurre il moto */
@media (prefers-reduced-motion: reduce) {
  nav, nav.active { transition:none !important; }
  nav.active > * { animation:none !important; opacity:1 !important; }
}
```

## `src/styles/cinematic.css` (sistema condiviso "cine" — COMPLETO)

```css
/* ============================================================
   CINEMATIC — sistema di design condiviso · "Pergamena Antica"
   Pagina chiara "blocco unico" scrollabile, hero in parallax
   (immagine antichizzata che sfuma nella carta), divisori
   "scrollytell", card/pannelli pergamena, toolbar e side-nav.
   Parametrizzato via CSS variables: ogni pagina può sovrascrivere
   la propria palette su .cine-page. Richiede useParallaxScroll()
   che aggiorna --cine-scroll.
   ── Due contesti per l'oro ──
   --cine-gold-soft : TESTO chiaro SOPRA hero/immagini scure
   --cine-gold-ink  : TESTO scuro su PERGAMENA chiara
   ============================================================ */

.cine-page {
  /* ---- palette (override per-pagina) — Pergamena Antica ---- */
  --cine-accent:      #6f44c9;   /* accento tema (viola arcano)      */
  --cine-accent-2:    #8a63dd;   /* variante chiara dell'accento     */
  --cine-gold:        #a9781a;   /* oro antico (fill/bordi/accenti)  */
  --cine-gold-soft:   #f1d8a0;   /* oro chiaro: testo su scuro/hero  */
  --cine-gold-ink:    #7c560f;   /* oro profondo: testo su carta     */
  --cine-bg-top:      #f3ead4;
  --cine-bg-mid:      #efe4ca;
  --cine-bg-bot:      #eaddbd;
  --cine-radius:      22px;

  min-height: 100vh;
  max-width: none;
  margin: 0;
  padding: 0 0 96px;
  font-family: var(--font-text);
  color: #33281a;
  position: relative;
  overflow-x: clip;

  /* La texture seppia è il primo layer del background (niente pseudo-elemento
     posizionato → nessuno stacking context che intrappoli modali/overlay).
     NB: niente background-attachment:fixed (rotto/janky su iOS Safari). */
  background-image:
    radial-gradient(circle, rgba(124, 86, 15, 0.05) 1px, transparent 1.6px),
    radial-gradient(circle at 10% 12%, color-mix(in srgb, var(--cine-gold) 14%, transparent), transparent 35%),
    radial-gradient(circle at 90% 88%, color-mix(in srgb, var(--cine-accent) 14%, transparent), transparent 42%),
    radial-gradient(circle at 50% 50%, rgba(255, 250, 235, 0.55), transparent 60%),
    linear-gradient(180deg, var(--cine-bg-top) 0%, var(--cine-bg-mid) 38%, var(--cine-bg-top) 72%, var(--cine-bg-bot) 100%);
  background-size: 24px 24px, auto, auto, auto, auto;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat, no-repeat;
  background-attachment: scroll;
}

/* anchor offset per la fixed navbar */
.cine-page [id] { scroll-margin-top: calc(var(--navbar-h, 80px) + 16px); }

/* contenitore centrato per i blocchi di contenuto */
.cine-wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 20px;
}
.cine-wrap--narrow { max-width: 860px; }
.cine-wrap--wide   { max-width: 1320px; }

/* ============================================================
   HERO full-bleed (parallax) — immagine antichizzata → carta
   ============================================================ */
.cine-hero {
  position: relative;
  margin: 0 calc(50% - 50vw) 28px;
  width: 100vw;
  max-width: 100vw;
  height: 86vh;
  min-height: 420px;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background:
    radial-gradient(circle at 25% 25%, color-mix(in srgb, var(--cine-gold) 20%, transparent), transparent 55%),
    radial-gradient(circle at 78% 80%, color-mix(in srgb, var(--cine-accent) 22%, transparent), transparent 60%),
    linear-gradient(135deg, var(--cine-bg-top) 0%, var(--cine-bg-mid) 45%, var(--cine-bg-bot) 100%);
}
.cine-hero--short { height: 64vh; min-height: 360px; }
@media (min-width: 1120px) { .cine-hero { height: 96vh; } .cine-hero--short { height: 68vh; } }

.cine-hero-media { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.cine-hero-media img {
  position: absolute;
  inset: -8% 0 -8% 0;
  width: 100%;
  height: 116%;
  object-fit: cover;
  object-position: center 40%;
  opacity: 0.82;
  filter: sepia(0.18) saturate(1.02);
  will-change: transform;
  transform: translate3d(0, calc(var(--cine-scroll, 0) * 0.32px), 0);
}
/* vignettatura calda (seppia) per dare profondità all'immagine */
.cine-hero-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 32%, rgba(34, 22, 8, 0.30) 72%, rgba(28, 18, 6, 0.62) 100%);
}
/* gradiente che FONDE l'hero nella pergamena verso il basso */
.cine-hero-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(180deg,
    rgba(30, 20, 8, 0.10) 0%,
    rgba(28, 18, 7, 0.24) 42%,
    color-mix(in srgb, var(--cine-bg-bot) 78%, transparent) 82%,
    var(--cine-bg-bot) 100%);
}
.cine-hero-pattern {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(124, 86, 15, 0.10) 1px, transparent 1.5px);
  background-size: 22px 22px;
  mix-blend-mode: multiply;
  opacity: 0.4;
}

.cine-hero-content {
  position: relative;
  z-index: 2;
  padding: 32px 24px 64px;
  max-width: 940px;
  color: #fff;
  animation: cine-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes cine-rise {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cine-eyebrow {
  display: inline-block;
  font-family: var(--font-title, "Cinzel", serif);
  font-size: 0.72rem;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: var(--cine-gold-soft);
  padding: 7px 18px;
  border: 1px solid color-mix(in srgb, var(--cine-gold) 55%, transparent);
  border-radius: 999px;
  background: rgba(28, 18, 6, 0.34);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  margin-bottom: 22px;
}

.cine-hero-title {
  font-family: var(--font-title, "Cinzel", serif);
  font-size: clamp(2.2rem, 7vw, 5rem);
  font-weight: 700;
  letter-spacing: 0.03em;
  margin: 0 0 18px;
  line-height: 1.04;
  text-shadow: 0 4px 28px rgba(20, 12, 4, 0.6), 0 1px 3px rgba(20, 12, 4, 0.5);
  background: linear-gradient(180deg, #fff 0%, #ffe9c2 55%, var(--cine-gold-soft) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.cine-hero-tagline {
  font-family: var(--font-text, sans-serif);
  font-size: clamp(0.95rem, 1.6vw, 1.18rem);
  line-height: 1.55;
  color: rgba(255, 248, 235, 0.92);
  max-width: 640px;
  margin: 0 auto 26px;
  text-shadow: 0 1px 4px rgba(20, 12, 4, 0.7);
}

.cine-hero-meta { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }
.cine-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-title, sans-serif);
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--cine-gold) 70%, transparent);
  color: var(--cine-gold-soft);
  background: rgba(28, 18, 6, 0.42);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.cine-pill--accent { border-color: color-mix(in srgb, var(--cine-accent-2) 80%, transparent); color: #fff; }

/* ── Scroll hint: chevron animato in anello (stile D2) ── */
.cine-hero-scroll-hint {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  font-family: var(--font-title, sans-serif);
  color: rgba(60, 42, 16, 0.85);
  font-size: 0.6rem;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  text-shadow: 0 1px 6px rgba(255, 248, 230, 0.6);
  pointer-events: none;
}
.cine-hero-arrow {
  font-size: 1rem;
  letter-spacing: 0;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--cine-gold) 55%, transparent);
  background: color-mix(in srgb, var(--cine-bg-top) 70%, transparent);
  color: var(--cine-gold-ink);
  box-shadow: 0 4px 14px rgba(86, 64, 30, 0.22);
  animation: cine-bounce 2.2s ease-in-out infinite;
}
@keyframes cine-bounce {
  0%, 100% { transform: translateY(0);   opacity: 0.7; }
  50%       { transform: translateY(7px); opacity: 1; }
}

/* ============================================================
   SIDE NAV (icone laterali fluttuanti)
   ============================================================ */
.cine-side-nav {
  position: fixed;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  z-index: 95;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 250, 235, 0.86), rgba(247, 238, 214, 0.92));
  border: 1px solid color-mix(in srgb, var(--cine-gold) 38%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 10px 24px rgba(86, 64, 30, 0.28);
  animation: cine-sidenav-fade 0.5s ease both;
}
@keyframes cine-sidenav-fade {
  from { opacity: 0; transform: translate(-12px, -50%); }
  to   { opacity: 1; transform: translate(0, -50%); }
}
.cine-side-nav-btn {
  width: 36px; height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: transparent;
  border: 1px solid transparent;
  color: var(--cine-gold-ink);
  font-size: 1rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.18s ease;
  position: relative;
}
.cine-side-nav-btn:hover {
  background: color-mix(in srgb, var(--cine-gold) 18%, transparent);
  border-color: color-mix(in srgb, var(--cine-gold) 50%, transparent);
  color: #5a3d12;
  transform: scale(1.08);
}
.cine-side-nav-btn:active { transform: scale(0.95); }
.cine-side-nav-btn::after {
  content: attr(title);
  position: absolute;
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%) translateX(-4px);
  background: rgba(40, 28, 12, 0.95);
  color: var(--cine-gold-soft);
  padding: 4px 10px;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  font-family: var(--font-title, sans-serif);
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--cine-gold) 35%, transparent);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.cine-side-nav-btn:hover::after { opacity: 1; transform: translateY(-50%) translateX(0); }
@media (max-width: 1280px) {
  .cine-side-nav {
    top: auto; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); left: 50%;
    transform: translateX(-50%);
    flex-direction: row; padding: 6px 8px; gap: 4px;
  }
  .cine-side-nav-btn::after { display: none; }
  @keyframes cine-sidenav-fade {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
}
@media (max-width: 480px) {
  .cine-side-nav { bottom: calc(10px + env(safe-area-inset-bottom, 0px)); padding: 4px 6px; gap: 2px; }
  .cine-side-nav-btn { width: 32px; height: 32px; font-size: 0.95rem; }
}

/* ============================================================
   SCROLLYTELL — divisore: immagine parallax + frame
   ============================================================ */
.cine-scrolly {
  position: relative;
  margin: 60px calc(50% - 50vw) 8px;
  width: 100vw;
  max-width: 100vw;
  height: 76vh;
  min-height: 460px;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cine-scrolly--short { height: 52vh; min-height: 360px; }
.cine-scrolly-media {
  position: absolute; inset: 0; z-index: 0; overflow: hidden;
  background:
    radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--cine-gold) 16%, transparent), transparent 55%),
    linear-gradient(135deg, var(--cine-bg-top) 0%, var(--cine-bg-mid) 50%, var(--cine-bg-bot) 100%);
}
.cine-scrolly-media img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: center 35%;
  opacity: 0.92;
  filter: sepia(0.2) saturate(1.05) contrast(1.04);
  will-change: transform;
  transform: scale(1.06) translate3d(0, calc(var(--cine-scroll, 0) * 0.06px), 0);
}
/* overlay seppia uniforme: l'immagine resta una "illustrazione antica" ricca
   e il frame-pergamena del titolo risalta sopra (no più banner slavato). */
.cine-scrolly-media::before {
  content: ""; position: absolute; inset: 0; z-index: 1;
  background:
    radial-gradient(ellipse at center, rgba(30, 20, 8, 0.22) 0%, rgba(30, 20, 8, 0.40) 60%, rgba(22, 14, 5, 0.66) 100%),
    linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--cine-bg-bot) 70%, transparent) 100%);
}
.cine-scrolly-media::after {
  content: ""; position: absolute; inset: 0; z-index: 2;
  background-image: radial-gradient(circle, rgba(124, 86, 15, 0.07) 1px, transparent 1.4px);
  background-size: 22px 22px;
  opacity: 0.5; mix-blend-mode: multiply;
}
.cine-scrolly::before {
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 20vh; z-index: 3;
  background: linear-gradient(0deg, transparent 0%, color-mix(in srgb, var(--cine-bg-bot) 55%, transparent) 45%, var(--cine-bg-bot) 100%);
  pointer-events: none;
}
.cine-scrolly-bottom-fade {
  position: absolute; left: 0; right: 0; bottom: 0; height: 24vh; z-index: 3;
  background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--cine-bg-bot) 60%, transparent) 40%, var(--cine-bg-bot) 100%);
  pointer-events: none;
}
.cine-scrolly-content {
  position: relative; z-index: 3;
  padding: 6vh 24px;
  color: #fff;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cine-scrolly-frame {
  max-width: 720px;
  width: 100%;
  text-align: center;
  background: linear-gradient(135deg, rgba(255, 250, 235, 0.97), rgba(248, 240, 222, 0.93));
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  border: 1px solid color-mix(in srgb, var(--cine-gold) 34%, transparent);
  border-top: 3px solid var(--cine-accent-2);
  border-radius: var(--cine-radius);
  padding: 32px 28px;
  color: #33281a;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 24px 60px rgba(86, 64, 30, 0.32);
  animation: cine-rise 0.7s ease both;
  animation-timeline: view();
  animation-range: cover 0% cover 35%;
}
@supports not (animation-timeline: view()) {
  .cine-scrolly-frame { animation: cine-rise 0.7s ease both; }
}
.cine-scrolly-eyebrow {
  display: inline-block;
  font-family: var(--font-title, "Cinzel", serif);
  font-size: 0.7rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--cine-gold-ink);
  padding: 6px 16px;
  border: 1px solid color-mix(in srgb, var(--cine-gold) 45%, transparent);
  border-radius: 999px;
  background: rgba(169, 120, 26, 0.10);
  margin-bottom: 16px;
}
.cine-scrolly-title {
  font-family: var(--font-title, serif);
  font-size: clamp(1.8rem, 4.5vw, 3.2rem);
  font-weight: 700;
  margin: 0 0 14px;
  line-height: 1.1;
  background: linear-gradient(180deg, #5a3d12 0%, #7c560f 50%, var(--cine-gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.cine-scrolly-text {
  font-family: var(--font-text, sans-serif);
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  line-height: 1.65;
  color: #46382a;
  margin: 0 0 20px;
}
.cine-scrolly-text:last-child { margin-bottom: 0; }
@media (max-width: 760px) {
  .cine-scrolly { height: 70vh; min-height: 400px; }
  .cine-scrolly-content { padding: 4vh 16px; }
  .cine-scrolly-frame { padding: 24px 20px; border-radius: 18px; }
}

/* ============================================================
   PANNELLI & CARD pergamena
   ============================================================ */
/* pannello pergamena chiaro (massima leggibilità testi lunghi) */
.cine-panel {
  border-radius: var(--cine-radius);
  border: 1px solid rgba(180, 140, 80, 0.34);
  border-left: 4px solid var(--cine-accent);
  background: linear-gradient(135deg, rgba(255, 250, 235, 0.97), rgba(250, 242, 222, 0.93));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 14px 38px rgba(86, 64, 30, 0.22);
  color: #3a2a10;
  padding: 26px 30px;
}
.cine-panel h1, .cine-panel h2, .cine-panel h3 { color: var(--cine-accent); }

/* pannello "aged" — usato per titoli/azioni: pergamena più calda con cornice oro */
.cine-panel-dark {
  border-radius: var(--cine-radius);
  border: 1px solid color-mix(in srgb, var(--cine-gold) 40%, transparent);
  background:
    radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--cine-gold) 12%, transparent), transparent 50%),
    linear-gradient(135deg, rgba(247, 236, 212, 0.96), rgba(238, 226, 198, 0.96));
  box-shadow: 0 14px 38px rgba(86, 64, 30, 0.26);
  color: #3a2a10;
  padding: 24px 26px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}
.cine-panel-dark::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, transparent, var(--cine-accent), var(--cine-gold), var(--cine-accent), transparent);
  opacity: 0.9;
}

/* card pergamena con accenti */
.cine-card {
  position: relative;
  border-radius: var(--cine-radius);
  border: 1px solid rgba(180, 140, 80, 0.32);
  border-left: 4px solid var(--cine-accent);
  background: linear-gradient(180deg, rgba(255, 252, 245, 0.98), rgba(252, 246, 235, 0.95));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 12px 32px rgba(86, 64, 30, 0.22);
  overflow: hidden;
  color: #2a2010;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.2s ease;
}
.cine-card::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2;
  background: linear-gradient(90deg, transparent, var(--cine-accent), var(--cine-gold), var(--cine-accent), transparent);
  opacity: 0.9;
}
.cine-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--cine-gold) 65%, transparent);
  box-shadow: 0 20px 44px rgba(86, 64, 30, 0.3);
}

/* titolo di sezione (sopra blocchi su pergamena) */
.cine-section-title {
  font-family: var(--font-title, serif);
  font-size: clamp(1.3rem, 3.5vw, 2rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: center;
  margin: 0 0 8px;
  background: linear-gradient(180deg, #5a3d12 0%, var(--cine-gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.cine-section-sub {
  text-align: center;
  color: var(--cine-gold-ink);
  font-style: italic;
  margin: 0 0 24px;
}

/* ============================================================
   BOTTONI
   ============================================================ */
.cine-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-title, "Cinzel"), Georgia, serif;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 10px 20px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--cine-accent) 45%, transparent);
  background: linear-gradient(135deg, var(--cine-accent-2), var(--cine-accent));
  color: #fff7e6;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--cine-accent) 36%, transparent);
  transition: transform 0.18s ease, box-shadow 0.2s ease, filter 0.15s;
}
.cine-btn:hover { transform: translateY(-2px); filter: brightness(1.05); }
.cine-btn:active { transform: translateY(0); }
.cine-btn--gold {
  background: linear-gradient(135deg, #e6c477, var(--cine-gold));
  color: #2a1606;
  border-color: color-mix(in srgb, var(--cine-gold) 60%, transparent);
  box-shadow: 0 8px 22px rgba(169, 120, 26, 0.32);
}
.cine-btn--ghost {
  background: linear-gradient(135deg, rgba(255, 250, 235, 0.9), rgba(245, 236, 216, 0.92));
  color: var(--cine-gold-ink);
  border-color: color-mix(in srgb, var(--cine-gold) 45%, transparent);
}

/* ============================================================
   STATI: loading / empty
   ============================================================ */
.cine-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  gap: 16px;
  color: var(--cine-gold-ink);
  font-family: var(--font-title);
  font-size: 0.95rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  animation: cine-pulse 2s ease-in-out infinite;
}
@keyframes cine-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
.cine-loading-icon { font-size: 2.4rem; }
.cine-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--muted, #6a5b41);
  font-style: italic;
  font-size: 1rem;
}

/* ============================================================
   REVEAL D'INGRESSO — card/pannelli che salgono quando entrano
   nel viewport. Scroll-driven (animation-timeline: view()), GPU,
   niente JS. Uso la proprietà `translate` (NON `transform`) così
   l'hover lift delle card (transform: translateY) resta intatto.
   Progressive enhancement: dove non supportato (Safari) il
   contenuto resta semplicemente visibile.
   ============================================================ */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .cine-card,
    .cine-panel,
    .cine-panel-dark {
      animation: cine-rise-in both;
      animation-timeline: view();
      animation-range: entry 0% entry 26%;
    }
    @keyframes cine-rise-in {
      from { opacity: 0; translate: 0 26px; }
      to   { opacity: 1; translate: 0 0; }
    }
  }
}

/* ============================================================
   RIDUZIONE MOTION
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
  .cine-hero-content,
  .cine-hero-scroll-hint,
  .cine-hero-arrow,
  .cine-scrolly-frame { animation: none !important; }
  .cine-hero-media img,
  .cine-scrolly-media img { transform: none !important; }
}

/* ============================================================
   LAYOUT COMPATTO — pagine con classe .cine-compact
   (Geo, NPC, Party, ArenaMarket, Bacheca)
   Elimina lo spazio morto: hero più corto e divisori a tutto
   schermo trasformati in BANNER COMPATTI (come la pagina /riassunti).
   Scoped a .cine-compact → non tocca le altre pagine cinematografiche.
   ============================================================ */

/* ── HERO più corto ── */
.cine-compact .cine-hero { height: 58vh; min-height: 340px; }
.cine-compact .cine-hero--short { height: 46vh; min-height: 300px; }
@media (min-width: 1120px) {
  .cine-compact .cine-hero { height: 66vh; }
  .cine-compact .cine-hero--short { height: 52vh; }
}
.cine-compact .cine-hero-content { padding-bottom: 40px; }

/* ── DIVISORE → BANNER COMPATTO (contenuto, non più full-screen) ── */
.cine-compact .cine-scrolly,
.cine-compact .cine-scrolly--short {
  width: auto;
  max-width: 1180px;
  height: auto;
  min-height: 132px;
  margin: 40px auto 0;
  border-radius: var(--cine-radius);
  border: 1px solid color-mix(in srgb, var(--cine-gold) 30%, transparent);
  border-left: 4px solid var(--cine-accent-2);
  box-shadow: 0 1px 0 rgba(255, 230, 180, 0.10) inset, 0 16px 40px rgba(86, 64, 30, 0.3);
  scroll-margin-top: calc(var(--navbar-h, 80px) + 80px);
}
/* immagine del banner: niente parallax (è basso) → leggero ken-burns */
.cine-compact .cine-scrolly-media img {
  opacity: 0.5;
  transform: scale(1.05);
  animation: cine-compact-kenburns 26s ease-in-out infinite alternate;
}
@keyframes cine-compact-kenburns {
  from { transform: scale(1.05) translate3d(0, 0, 0); }
  to   { transform: scale(1.13) translate3d(0, -3%, 0); }
}
/* overlay sinistro caldo per leggibilità del testo allineato a sinistra */
.cine-compact .cine-scrolly-media::before {
  background: linear-gradient(90deg,
    rgba(28, 18, 6, 0.88) 0%,
    rgba(32, 21, 8, 0.66) 45%,
    rgba(32, 21, 8, 0.4) 100%);
}
/* via le dissolvenze alto/basso pensate per il full-screen */
.cine-compact .cine-scrolly::before,
.cine-compact .cine-scrolly-bottom-fade { display: none; }

/* contenuto del banner: allineato a sinistra, padding compatto */
.cine-compact .cine-scrolly-content {
  padding: 18px clamp(18px, 3vw, 32px);
  justify-content: flex-start;
}
/* il "frame" diventa testo nudo (chiaro) sopra il banner-immagine */
.cine-compact .cine-scrolly-frame {
  max-width: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  color: #fff;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.cine-compact .cine-scrolly-eyebrow {
  margin-bottom: 6px; padding: 4px 12px;
  color: var(--cine-gold-soft);
  border-color: color-mix(in srgb, var(--cine-gold) 50%, transparent);
  background: rgba(28, 18, 6, 0.32);
}
.cine-compact .cine-scrolly-title {
  font-size: clamp(1.4rem, 3.6vw, 2.4rem);
  margin: 0;
  background: linear-gradient(180deg, #fff 0%, #ffe9c2 55%, var(--cine-gold-soft) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.cine-compact .cine-scrolly-text { margin: 6px 0 0; color: rgba(255, 248, 235, 0.92); }

/* su mobile: banner centrato, un filo più basso */
@media (max-width: 600px) {
  .cine-compact .cine-scrolly,
  .cine-compact .cine-scrolly--short { margin-top: 28px; min-height: 116px; }
  .cine-compact .cine-scrolly-content { justify-content: center; text-align: center; }
  .cine-compact .cine-scrolly-frame { text-align: center; }
}

@media (prefers-reduced-motion: reduce) {
  .cine-compact .cine-scrolly-media img { animation: none !important; }
}

/* ============================================================
   CINE TOOLBAR — barra di ricerca + filtri (componente CineToolbar)
   Sticky sotto la navbar. Specificità .cine-page … per vincere
   sempre sul lift di stacking delle singole pagine.
   ============================================================ */
.cine-page .cine-toolbar {
  position: sticky;
  top: calc(var(--navbar-h, 80px) + 8px);
  z-index: 30;
  max-width: 1180px;
  margin: 16px auto 0;
  padding: 12px 14px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 250, 235, 0.94), rgba(247, 238, 214, 0.97));
  border: 1px solid color-mix(in srgb, var(--cine-gold) 32%, transparent);
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 14px 34px rgba(86, 64, 30, 0.26);
}
.cine-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 260px;
  min-width: 0;
}
.cine-search-icon {
  position: absolute;
  left: 14px;
  font-size: 0.95rem;
  opacity: 0.7;
  pointer-events: none;
}
.cine-search-input {
  width: 100%;
  padding: 11px 38px 11px 40px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--cine-gold) 34%, transparent);
  background: #fffdf5;
  color: #33281a;
  font-family: var(--font-text, sans-serif);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}
.cine-search-input::placeholder { color: #9c8a68; }
.cine-search-input:focus {
  border-color: color-mix(in srgb, var(--cine-gold) 70%, transparent);
  background: #fff;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cine-gold) 20%, transparent);
}
.cine-search-clear {
  position: absolute;
  right: 8px;
  width: 26px; height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: color-mix(in srgb, var(--cine-gold) 18%, transparent);
  color: var(--cine-gold-ink);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.cine-search-clear:hover { background: color-mix(in srgb, var(--cine-gold) 32%, transparent); transform: scale(1.08); }
.cine-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}
.cine-chip {
  font-family: var(--font-title, sans-serif);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--cine-gold) 36%, transparent);
  background: rgba(169, 120, 26, 0.08);
  color: var(--cine-gold-ink);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.16s ease;
}
.cine-chip:hover {
  border-color: color-mix(in srgb, var(--cine-gold) 65%, transparent);
  color: #5a3d12;
  transform: translateY(-1px);
}
.cine-chip.active {
  background: linear-gradient(135deg, var(--cine-accent-2), var(--cine-accent));
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  box-shadow: 0 6px 16px rgba(86, 64, 30, 0.28);
}
.cine-result-count {
  margin-left: auto;
  font-family: var(--font-title, sans-serif);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--cine-gold-ink);
  opacity: 0.85;
  white-space: nowrap;
}
@media (max-width: 600px) {
  .cine-page .cine-toolbar { padding: 10px; gap: 8px; }
  .cine-search { flex-basis: 100%; }
  .cine-result-count { margin-left: 0; }
}
```

## `src/style.css` — estratto token (il file completo è 84KB di stili legacy per pagina; qui solo la testa con variabili e base)

```css
/* ========================================
    ROOT VARIABLES & RESET
    ======================================== */
:root {
     --red: #820a0a;
     --gold: #d4af37;
     --bg: #ffffff;
     --text: #111111;
     --font-title: "Cinzel Decorative", serif;
     --font-text: "Cardo", serif;
     --navbar-h: 80px;
}

/* header stacks to column at ≤1300px, so padding must account for the taller height */
@media (max-width: 1300px) { :root { --navbar-h: 130px; } }
@media (max-width: 620px)  { :root { --navbar-h: 150px; } }
@media (max-width: 400px)  { :root { --navbar-h: 165px; } }

* { box-sizing: border-box; margin: 0; padding: 0; }

* { scrollbar-width: thin; scrollbar-color: var(--gold) rgba(212, 175, 55, 0.08); }
/* …scrollbar oro/rosso, poi html/body overflow-x hidden… */

body {
     font-family: var(--font-text);
     background-color: var(--bg);
     color: var(--text);
     min-height: 100vh;
     display: flex;
     flex-direction: column;
}

h1, h2, h3, nav, .logo {
     font-family: var(--font-title);
     letter-spacing: 0.5px;
     color: var(--red);
}
```

Il resto di `style.css` (~3000 righe) contiene: header/nav/burger base, footer, countdown Home, mercato (loot-card `mc-*`, `mat-*`), chat globale (`chat-*`), presenza online (`online-*`), e vari blocchi legacy per pagina. Va letto direttamente solo quando serve la pagina specifica.

## Nota
`src/index.css` è il default Vite e **non è importato** da `main.jsx` → ignorarlo. I CSS per pagina (`src/pages/*.css`) sovrascrivono/estendono questi sistemi localmente; il tema dark dell'Arena vive in `src/pages/ArenaHero.css` (caricato dopo `Arena.css`, vince).
