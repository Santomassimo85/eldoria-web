# Design System — Crit Happens (Eldoria)

## Direzione attiva: "GHIACCIO E ACQUA" (2026-08-25)

REDESIGN TOTALE (sostituisce sia "Pergamena Antica" pura sia "Tomo tra le Braci"):
**l'abisso sotto i ghiacci**. Il fondo dell'app è l'oceano profondo di notte
(blu abissale, neve che cade, raggi di luce dall'alto); ogni pagina è una
**lastra di ghiaccio** chiara (max 1480px) che galleggia sopra, margini
brinati; **tutti gli hero sono finestre ad arco artico** (radius clamp
110-230px in alto, cornice di brina); chrome = vetro d'abisso con perle.
Scelto dal mockup B (`public/mockups/b-ghiaccio.html`, immagini PhotoStory:
hero tipo dragonLeaf).

**Feature interattiva**: a ogni tocco/click sulle pagine chiare → onde
concentriche + cristalli di brina dal punto (FrostOverlay, canvas globale).

**Vincoli inderogabili**
- Solo grafica/struttura: MAI toccare logica, route, link, href.
- Pagine di gioco (Arena, TCG, World Boss, Pet) = `body.theme-dark`, INTOCCATE.
- Mai `background-attachment: fixed` (iOS). `prefers-reduced-motion` rispettato.
- Test B&N: scuro fuori / chiaro dentro + archi = struttura nuova anche in B&N.

## Palette (tema chiaro glaciale — token in glacier.css :root)
- Abisso (body): `#0d2438 → #081827 → #050e18` + radiali ciano
- Lastra (main): `#eef6fb → #e6f1f8 → #d8e8f2`, bordo `#8fb9cf` + alone ciano
- Superfici: `--bg-0 #e8f2f8` `--bg-2 #f4fafd` `--bg-3 #fff`; linee `#a9c9da`
- Inchiostro: `--ink #16303f` `--muted #4a687a` `--faint #7d9aab`
- Acqua (ex "amber"): `--amber #2e86ad / deep #1d6485 / soft #7fc4de`
- Blu arcano: `--arc #3b6fd4 / deep #274b9e / soft #6f97e8`
- Crit: `#c33d4e` · Cristallo/glow: `#6fd0ee` · Brina: `#bfe6f5` / `#e8f7fd`
- Cine vars: accent `#3b6fd4`, gold `#2e86ad`, gold-soft `#cfeefc`,
  gold-ink `#1d6485`, bg `#eaf4fa/#e0edf5/#d4e5ef`

## Convenzioni sfruttate (selettori ad attributo in glacier.css)
- `[class*="-hero-plate"]` / `hero2-plate` → placca gelata (vetro smerigliato)
- `[class*="-hero-title"]` (escluso cine-hero) / `hero2-title` → gradiente blu clip-text
- `[class*="-rubric-title|-eyebrow|-sub"]` → rubriche glaciali (6+ pagine)
- `-hero-tagline/-greet/-seal/-wash/-scroll` → ritinte generiche
- Full-bleed 100vw delle pagine chiare → arco artico largo `calc(100% - clamp(...))`

## File del layer
- `src/styles/glacier.css` — tutto il tema (caricato per ultimo in main.jsx)
- `src/components/FrostOverlay.jsx` — neve + raggi + onde/cristalli al tocco
  (montato in App.jsx; si spegne da solo su `body.theme-dark` via MutationObserver)

## Motion
- `frost-caustica` 10s (raggi) · neve canvas (34/54/78 fiocchi per breakpoint,
  dpr max 1.5, pausa a tab nascosta) · onde tap max 8 anelli + 6 cristalli
