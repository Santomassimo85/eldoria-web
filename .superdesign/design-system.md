# Design System — Crit Happens (Eldoria)

## Direzione attiva: "DRAGHI · IL COVO" (2026-08-27)

REDESIGN TOTALE (sostituisce "Ghiaccio e Acqua", che sostituiva "Pergamena
Antica" e "Tomo tra le Braci"): **il covo del drago**. Il fondo dell'app è
l'ossidiana del covo (nero caldo, bagliore d'oro del tesoro dal basso, trama
di squame, un drago che attraversa il cielo, il tesoro che luccica);
`<main>` è un **forziere** di ossidiana bordato d'oro; **tutti gli hero sono
IL COVO BUIO**: cornice del tesoro con angoli d'oro, immagine spenta che la
**torcia rivela** seguendo dito/cursore (doppia immagine + mask radiale +
fiamma), titolo d'oro fuso (Cinzel Decorative) con kicker rosso drago;
le sezioni sono **gemme** con cornici d'oro e angoli (pannoramiche o in
**mosaico bento**); chrome = ossidiana e oro, nav mobile = **artigli**
(rune d'oro + artiglio rosso ⌃ sulla voce attiva). I documenti-pergamena
interni delle pagine restano isole chiare sul buio (carta + oro = coerente).
Scelto dal mockup C (`public/mockups/c-draghi.html`).

**Feature interattive**: torcia sull'hero di ogni pagina (rivela il covo);
drago in volo + luccichio del tesoro sul fondo (DrakeOverlay).

**Vincoli inderogabili**
- Solo grafica/struttura: MAI toccare logica, route, link, href.
- Pagine di gioco (Arena, TCG, World Boss, Pet) = `body.theme-dark`, INTOCCATE.
- Mai `background-attachment: fixed` (iOS). `prefers-reduced-motion` rispettato.
- Test B&N: covo buio + cornici e angoli d'oro + bento = struttura nuova anche in B&N.

## Palette (ossidiana e oro — token in drake.css :root)
- Covo (body): `#121016 → #0c0a0e → #070609` + bagliore oro dal basso + squame
- Forziere (main): `#131017 → #0d0a0f → #0a080c`, bordo rgba(227,170,60,.4)
- Superfici: `--bg-0 #100d13` `--bg-2 #191319` `--bg-3 #221a20`; linee `#453723`
- Inchiostro (caldo): `--ink #f1ecdf` `--muted #a89f8e` `--faint #7a715f`
- Oro tesoro: `--amber #e3aa3c / deep #8f6a1e / soft #ffd97a`
- Squama drago: `--arc #3e7a52 / deep #2e5c3c / soft #6fae87`
- Rosso drago: `--crit #c03a2a / deep #8a2417` (kicker/eyebrow + artiglio ⌃)
- Cine vars: accent `#e3aa3c`, accent-2/gold-soft `#ffd97a`, gold-ink `#caa04a`,
  bg `#121016/#0c0a0e/#070609` (niente velo crema)
- Titoli: clip-text `#fff2cf → #ffd97a 40% → #e3aa3c 75% → #a5711c`

## File del layer
- `src/styles/drake.css` — tutto il tema + sez. 8 STRUTTURA (covo gl-finestra,
  gemme gl-vetrata, bento gl-bento, gl-sezlabel con ⟁, gl-cta tesoro, gl-seal)
- `src/components/DrakeOverlay.jsx` — drago in volo + luccichio del tesoro
  (montato in App.jsx; si spegne da solo su `body.theme-dark` via MutationObserver)
- `src/components/glacier/GlacierHero.jsx` — hero IL COVO BUIO condiviso con
  torcia (il file conserva il nome storico per non toccare 20+ import)
- `src/components/glacier/Vetrata.jsx` — gemma (Link/a/button/article);
  angoli d'oro via ::before/::after in drake.css
- `src/styles/layout.css` — NAV ARTIGLI: bottom-bar flottante di ossidiana
  bordata d'oro, rune-artiglio, sheet-scrigno (valide anche sulle pagine scure)
- Spec storica del giro strutturale: `docs/glacier-restyle-spec.md`
  (le istruzioni restano valide; il vestito ora è drake.css)

## Restyle STRUTTURALE (2026-08-26/27)
Tutte le pagine chiare usano l'hero condiviso (covo con torcia, sigillo
dinamico, tagline+CTA sotto); rubriche → `.gl-sezlabel`; Home = mockup C
1:1 (covo → "Sfida il Drago" → "Il Tesoro Custodito" bento a 4 gemme →
lore → pantheon a gemme); WorldMap/DmTools/GeneraNPC/Concilio = testata
compatta. ItemDetail e ScribaSingolo senza hero: invariati.

## Motion
- torcia (mask + fiamma `gl-guizza`) · drago `drake-volo` 17s · luccichio
  canvas (22/32/44 gemme per breakpoint, dpr max 1.5, pausa a tab nascosta)
- reduced-motion: niente drago/luccichio/fiamma animata (mask statica ok)
