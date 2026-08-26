# Design System — Crit Happens (Eldoria)

## Direzione attiva: "GHIACCIO E ACQUA" (2026-08-25)

REDESIGN TOTALE (sostituisce sia "Pergamena Antica" pura sia "Tomo tra le Braci"):
**l'abisso sotto i ghiacci — TUTTO SCURO come il mockup B**. Il fondo è
l'oceano profondo di notte (blu abissale, neve, raggi); `<main>` è un
pannello di **vetro d'abisso** (max 1480px, bordo di ghiaccio, alone ciano);
**tutti gli hero sono finestre ad arco artico**; card/pannelli = vetro
gelato scuro; i documenti-pergamena interni (schede, missive, memorie)
restano isole chiare che galleggiano sull'abisso. Chrome = vetro d'abisso
con perle. Scelto dal mockup B (`public/mockups/b-ghiaccio.html`).

**Feature interattiva**: a ogni tocco/click sulle pagine chiare → onde
concentriche + cristalli di brina dal punto (FrostOverlay, canvas globale).

**Vincoli inderogabili**
- Solo grafica/struttura: MAI toccare logica, route, link, href.
- Pagine di gioco (Arena, TCG, World Boss, Pet) = `body.theme-dark`, INTOCCATE.
- Mai `background-attachment: fixed` (iOS). `prefers-reduced-motion` rispettato.
- Test B&N: scuro fuori / chiaro dentro + archi = struttura nuova anche in B&N.

## Palette (abisso scuro — token in glacier.css :root)
- Abisso (body): `#0d2438 → #081827 → #050e18` + radiali ciano
- Vetro d'abisso (main): `#0d2438 → #081827 → #071624`, bordo rgba(111,208,238,.35)
- Superfici: `--bg-0 #0b1f30` `--bg-2 #102940` `--bg-3 #153450`; linee `#27506a`
- Inchiostro (chiaro): `--ink #eaf6fc` `--muted #8fb6cb` `--faint #5f8299`
- Acqua (ex "amber"): `--amber #2e86ad / deep #1d6485 / soft #7fc4de`
- Blu arcano: `--arc #6f97e8 / deep #3b6fd4 / soft #9fc0f2`
- Crit: `#c33d4e` · Cristallo/glow: `#6fd0ee` · Brina: `#bfe6f5` / `#e8f7fd`
- Cine vars: accent `#6f97e8`, gold `#6fd0ee`, gold-soft `#bfe6f5`,
  gold-ink `#7fc4de`, bg `#0d2438/#0a1c2c/#071624` (niente velo crema)
- Titoli: clip-text `#fff → #bfe6f5 → #2e9ad0`

## Convenzioni sfruttate (selettori ad attributo in glacier.css)
- `[class*="-hero-plate"]` / `hero2-plate` → placca gelata (vetro smerigliato)
- `[class*="-hero-title"]` (escluso cine-hero) / `hero2-title` → gradiente blu clip-text
- `[class*="-rubric-title|-eyebrow|-sub"]` → rubriche glaciali (6+ pagine)
- `-hero-tagline/-greet/-seal/-wash/-scroll` → ritinte generiche
- Full-bleed 100vw delle pagine chiare → arco artico largo `calc(100% - clamp(...))`

## File del layer
- `src/styles/glacier.css` — tutto il tema + sez. 9 STRUTTURA (gl-finestra,
  gl-vetrata, gl-sezlabel, gl-cta, gl-seal, perle .nav-rune)
- `src/components/FrostOverlay.jsx` — neve + raggi + onde/cristalli al tocco
  (montato in App.jsx; si spegne da solo su `body.theme-dark` via MutationObserver)
- `src/components/glacier/GlacierHero.jsx` — hero FINESTRA ARTICA condiviso
- `src/components/glacier/Vetrata.jsx` — lastra panoramica 16/9 (Link/a/button/article)
- `src/styles/layout.css` — NAV A PERLE: bottom-bar flottante di vetro d'abisso
  con perle runiche + bottom-sheet abisso (valide anche sulle pagine scure)
- Spec del restyle pagina-per-pagina: `docs/glacier-restyle-spec.md`

## Restyle STRUTTURALE applicato (2026-08-26)
Tutte le pagine chiare usano GlacierHero (finestra ad arco con immagine,
titolo inciso, sigillo dinamico, tagline+CTA cristallo sotto); rubriche →
.gl-sezlabel; Home e Scriba hanno vetrate panoramiche; WorldMap/DmTools/
GeneraNPC/Concilio = testata glaciale compatta. ItemDetail e ScribaSingolo
senza hero: lasciati invariati.

## Motion
- `frost-caustica` 10s (raggi) · neve canvas (34/54/78 fiocchi per breakpoint,
  dpr max 1.5, pausa a tab nascosta) · onde tap max 8 anelli + 6 cristalli
