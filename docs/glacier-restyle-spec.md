# SPEC — Restyle strutturale "Ghiaccio e Acqua" (mockup B)

Riferimento visivo: `public/mockups/b-ghiaccio.html`. Tema: l'abisso sotto i
ghiacci — il body è l'oceano notturno, `<main>` è la lastra di ghiaccio chiara,
ogni pagina ha come firma strutturale la **FINESTRA ARTICA** (hero ad arco) e le
**VETRATE PANORAMICHE** (lastre 16/9). Nav = perle di ghiaccio (già fatta).

## Regole INDEROGABILI
- NON toccare logica, hook, handler, route, link, href, dati, Firestore.
- NON toccare `src/App.jsx`, `src/main.jsx`, `src/styles/glacier.css`,
  `src/styles/layout.css`, i componenti in `src/components/glacier/`.
- NON toccare le pagine di gioco scure: Arena, TCG, World Boss/tactics, Pet
  (body.theme-dark) — se un file assegnato è tra queste, saltalo.
- Mantieni TUTTI gli `id` di ancoraggio (`#sezione`) e gli aria-label.
- Mai `background-attachment: fixed`.
- NON eseguire build/dev server e NON committare: solo modifiche ai file.
- Il CSS vecchio della pagina può restare (selettori morti ok). Aggiungi le
  regole nuove in FONDO al CSS della pagina sotto un commento `/* ── GLACIER ── */`.

## Componenti condivisi

### `src/components/glacier/GlacierHero.jsx`
Hero a finestra artica. Props:
- `id`, `className`, `ariaLabel`
- `image` (src), `imgAlt`, `imgPos` (object-position, es. "center 20%")
- `hint` (pill in alto, senza ❄ iniziale: lo aggiunge lui)
- `eyebrow` (kicker maiuscolo), `title` (nodo, va in `<h1 class="gl-title">`)
- `seal` (pill "sigillo di gelo" sopra l'eyebrow, es. conteggi dinamici)
- `tagline` (corsivo sotto la finestra), `actions` (nodo: CTA `.gl-cta`)
- `children` (contenuto extra sotto le azioni)

Esempio (Home, già fatta — usala come modello: `src/pages/Home.jsx`):
```jsx
<GlacierHero
  id="party-top"
  ariaLabel="Registro degli Eroi"
  image="/assets/PhotoStory/GruppoMEAA/garroth_lago.jpg"
  eyebrow="Registro Araldico"
  title="Gli Eroi di Eldoria"
  seal={`${heroes.length} eroi attivi`}
  tagline="Sedici nomi intrappolati nel cristallo del lago."
  actions={<a href="#party-indice" className="gl-cta">❆ Sfoglia il registro</a>}
/>
```

### `src/components/glacier/Vetrata.jsx`
Lastra panoramica 16/9 (21/8 su desktop) con immagine, velo, titolo, sub,
sigillo. Props: `img`, `imgPos`, `title`, `sub`, `sigillo`, `to` (→ Link),
`href` (→ a), `onClick` (→ button), `className`, `children`.
Solo per link/route GIÀ esistenti nella pagina — mai inventare rotte nuove.

### Classi CSS pronte (glacier.css, nessun nuovo CSS necessario)
- `.gl-sezlabel` — etichetta di sezione centrata, Cinzel spaziato, con ❄ sotto.
- `.gl-cta`, `.gl-cta--deep`, `.gl-cta--crit` — bottoni/link a cristallo.
- `.gl-seal` (fondi scuri) / `.gl-seal--ink` (fondi chiari) — pill sigillo.
- `.gl-vetrate` — contenitore colonna per più vetrate.
- `.gl-vetrata gl-vetrata--band` — vetrata usata come fascia di sezione
  (markup manuale con `<section id=…>`, vedi le fasce pantheon in Home.jsx).
- `.gl-plunge` — link discreto "❆ …" sotto le azioni.

## Cosa fare su OGNI pagina assegnata
1. Leggi il JSX (e il CSS solo se serve) della pagina.
2. Sostituisci l'hero/masthead esistente con `<GlacierHero …>`:
   - riusa la STESSA immagine hero già presente nel markup (o, se la pagina
     non ha immagine, scegline una coerente già usata in quella pagina);
   - sposta il titolo, il kicker, i sigilli/conteggi dinamici e le CTA
     esistenti nelle props (`title`, `eyebrow`, `seal`, `actions`);
   - le CTA diventano `.gl-cta` MANTENENDO href/onClick identici;
   - elementi interattivi non-CTA che vivevano nell'hero (form di ricerca,
     select, toggle) vanno in `children` sotto la finestra, intatti.
3. Le rubriche/intestazioni di sezione (`*-rubric-*`, header di capitolo)
   diventano `.gl-sezlabel` (una riga, testo maiuscolo breve) — MANTENENDO
   l'eventuale `id` sul contenitore della sezione. Se la rubrica ha un
   sottotitolo importante, tienilo in un `<p className="gl-vetrata-sub">`
   sotto la label o lascialo com'era.
4. (Solo se naturale) un indice/elenco di sezioni CON immagini già presenti
   può diventare una pila di `<Vetrata …>` dentro `.gl-vetrate`.
5. Tutto il resto (griglie, card, modali, form, animazioni interne) resta
   INTATTO: la ritintura glaciale è già fatta dai layer CSS globali.
6. Se l'hero vecchio aveva parallax (`useParallaxScroll`, data-parallax…),
   lascia l'hook dov'è (innocuo) e non portare il parallax nella finestra.

## Test di accettazione (mentale, B&N)
Prima: hero rettangolare a placca. Dopo: arco artico con titolo inciso in
basso + tagline/CTA sotto. Anche in bianco e nero deve sembrare un sito diverso.
