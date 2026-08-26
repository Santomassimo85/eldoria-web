# Design System — Crit Happens (Eldoria)

## Direzione attiva: "AURORA DEL NORD" (2026-08-27)

REDESIGN TOTALE (sostituisce "Draghi · Il Covo", che sostituiva "Ghiaccio e
Acqua" e "Pergamena Antica"): **la notte artica**. Il fondo dell'app è il
cielo del nord — notte blu-viola con **tre nastri d'aurora che danzano da
soli**, stelle che scintillano e neve finissima (AuroraOverlay, z-index 0);
`<main>` è un **velo di notte semitrasparente** che lascia filtrare
l'aurora. Hero e sezioni sono **PANORAMI**: immagini a tutta larghezza che
respirano (Ken Burns lento), titoli **Marcellus** con **filo d'aurora**
(menta→rosa) sotto, kicker alla menta, numerali romani in filigrana (CSS
counters) e contenuti alternati sx/dx; CTA = **faro** (pillola menta).
Nav mobile = **fuochi** (puntini che si accendono alla menta). TUTTO il
movimento è AMBIENTALE: nessuna feature legata a click/hover (uso da
cellulare). I documenti-pergamena interni restano isole chiare sulla notte.
Scelto dal mockup G (`public/mockups/g-aurora.html`).

**Vincoli inderogabili**
- Solo grafica/struttura: MAI toccare logica, route, link, href.
- Pagine di gioco (Arena, TCG, World Boss, Pet) = `body.theme-dark`, INTOCCATE.
- Mai `background-attachment: fixed` (iOS). `prefers-reduced-motion` rispettato.
- Motion solo ambientale (niente feature al tocco).

## Palette (notte artica — token in aurora.css :root)
- Cielo (body): `#0d1226 → #0a0e1c → #060812` + radiale viola in alto
- Velo (main): rgba notte .62→.9, bordo rgba(154,123,255,.22)
- Superfici: `--bg-0 #0d1226` `--bg-2 #131a38` `--bg-3 #1a2246`; linee `#2b3560`
- Inchiostro: `--ink #eef2ff` `--muted #98a2c8` `--faint #626c94`
- Menta d'aurora (ex "oro"): `--amber #5ce8b8 / deep #2ba57f / soft #9fefd2`
- Viola aurora: `--arc #9a7bff / deep #6a4fd0 / soft #bfaaff`
- Rosa aurora: `--crit #e0567e / deep #a52f54` (+ #ff8ac2 nei gradienti)
- Cine vars: accent `#9a7bff`, gold `#5ce8b8`, gold-soft `#9fefd2`,
  bg trasparente (il velo del main basta)
- Titoli: Marcellus 400, colore ink + glow viola; filo d'aurora `#5ce8b8→#ff8ac2`

## File del layer
- `src/styles/aurora.css` — tutto il tema + sez. 8 STRUTTURA (panorama
  gl-finestra, sezioni-panorama gl-vetrata con counters romani, apertura
  `.gl-hero--cielo`, gl-sezlabel con filo, gl-cta faro, gl-seal)
- `src/components/AuroraOverlay.jsx` — nastri d'aurora + stelle + neve
  (montato in App.jsx; si spegne da solo su `body.theme-dark`)
- `src/components/glacier/GlacierHero.jsx` — hero PANORAMA condiviso
  (il file conserva il nome storico per non toccare 20+ import)
- `src/components/glacier/Vetrata.jsx` — sezione-panorama (Link/a/button/article)
- `src/styles/layout.css` — NAV FUOCHI: bottom-bar flottante di vetro di
  notte con puntini-menta, sheet-velo (valide anche sulle pagine scure)
- Font: Marcellus aggiunto in index.html (Google Fonts)

## Restyle STRUTTURALE
Tutte le pagine chiare usano l'hero condiviso (panorama full-width, sigillo
dinamico, tagline+CTA sotto); Home = mockup G: apertura sotto l'aurora
(senza immagine) → 4 panorami numerati I-IV (Party/Mercato/Riassunti/
Tarocchi) → lore → pantheon a fasce-panorama. ItemDetail e ScribaSingolo
senza hero: invariati. WorldMap/DmTools/GeneraNPC/Concilio = compatti.

## Motion (solo ambientale)
- nastri d'aurora `aur-danza1/2` 16-26s · stelle+neve canvas (55-120/30-64
  per breakpoint, dpr max 1.5, pausa a tab nascosta) · Ken Burns
  `gl-respira` 18-20s sui panorami · scroll-cue `gl-scendi` in apertura
- reduced-motion: nastri fermi, canvas spento, niente Ken Burns
