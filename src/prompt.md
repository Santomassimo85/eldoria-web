PROMPT PER CLAUDE CODE — Refactor UI pagina Arena
Sei un esperto frontend. Devi modificare la pagina Arena di un'app React + Vite. Il punto di ingresso è src/main.jsx. La pagina si trova su /arena. Ci sono ~22 stylesheet. Di seguito i problemi da risolvere nell'ordine esatto, con istruzioni precise.

🔴 PROBLEMA 1 — Nav chip non si vedono (foto 1)
Il componente .arena-quicknav contiene .arena-quicknav-chip. Il chip inattivo ha background quasi identico al contenitore (beige su beige). Il chip attivo (.arena-quicknav-chip--active) è bordeaux rgb(125,41,41) e si vede. Fix:

Chip inattivo: background #fff, border 1.5px solid #c9a84c, color #7d2929, con hover che scurisce leggermente
Chip attivo: rimane bordeaux #7d2929, testo bianco/crema
Il contenitore .arena-quicknav deve avere background #f5f0e8 e border 1px solid #c9a84c ben visibile
I chip devono avere abbastanza contrasto e leggibilità anche su mobile


🔴 PROBLEMA 2 — Fight conclusi nel tabellone troppo verbosi (foto 2)
Gli scontri conclusi nel bracket (.bracket-card-mini) mostrano avatar, nome completo, "batte", nome avversario. Su desktop occupano troppo spazio, su mobile ancora di più.
Fix: per i .bracket-card-mini che rappresentano fight già conclusi (non quello corrente/attivo), mostrare SOLO:

Nome abbreviato del vincitore (max ~10 caratteri + ...) o solo il cognome/primo token
Uno badge piccolo W (verde) o L (rosso) per indicare win/loss
Niente avatar, niente "batte", niente nome completo del perdente
Su smartphone questo formato compatto è già quello target — assicurarsi sia uguale anche su desktop
La struttura attuale è: .bracket-mini-badge, .bracket-mini-avatar, .bracket-mini-winner, .bracket-mini-vs, .bracket-mini-losers
Tieni solo .bracket-mini-winner (troncato) e aggiungi un badge W/L, nascondi il resto con CSS


🔴 PROBLEMA 3 — Pannello vincitore: nome e premio sovrapposti (foto 3)
Il componente .champion-banner.last-champion contiene:
html<div class="champion-crown">♛</div>
<div class="champion-label">Ultimo Campione</div>
<div class="champion-name">...</div>
<div class="champion-prize">Premio: ...</div>
Il .champion-prize è ora posizionato male (quasi sovrapposto al nome).
Fix:

.champion-name e .champion-prize devono essere in colonna, con display: flex; flex-direction: column; gap: 8px
.champion-prize deve avere font più piccolo (0.8rem), colore più tenue #7a6530, background leggero rgba(201,168,76,0.1), padding 6px 12px, border-radius 8px, e stare sotto il nome
Il banner deve avere display: flex; flex-direction: column; align-items: center; gap: 6px


🔴 PROBLEMA 4 — Indicatore "turno di..." brutto (foto 4)
Ci sono due elementi da migliorare:
A) .turn-indicator (dentro .fighter-card.active-turn, posizionato in absolute top): attualmente è un rettangolo rosso scuro rgb(130,10,10) con testo bianco "Il tuo turno". È grezzo.
Fix: rimpiazzarlo con una badge elegante:

Border-radius 20px (pill shape)
Background gradiente linear-gradient(135deg, #7d2929, #b8412a)
Ombra 0 2px 8px rgba(125,41,41,0.4)
Font Cinzel Decorative o simile, size 0.65rem, letterspacing 0.1em, uppercase
Aggiungere una piccola icona ⚔ prima del testo
Centrarlo in top del card con left: 50%; transform: translateX(-50%)

B) .turn-tracker (header dello scontro: "Turno di: Cleofe"): attualmente è testo piatto con timer.
Fix:

Renderlo una badge/pill centrata, background linear-gradient(90deg, #fffbf0, #fdf3dc), border 1px solid #c9a84c
Testo vincitore in grassetto bordeaux #7d2929
Timer .arena-turn-timer con stile pill separato, e quando è urgent deve essere rosso pulsante con animazione CSS pulse
Box-shadow leggera, border-radius 20px


🔴 PROBLEMA 5 — Grafica generale: tema light + layout
5a. Colori light

La palette attuale è giallognola/beige. Mantieni i colori tematici (bordeaux #7d2929, oro #c9a84c) ma rendi lo sfondo generale più bianco/grigio chiarissimo (#f8f6f2 o #fafafa)
I pannelli devono avere background: #fff, border: 1px solid #e8dcc8, border-radius: 12px, box-shadow: 0 2px 8px rgba(0,0,0,0.06)
Evita sfondi sabbia scura ovunque

5b. Tabellone troppo grande (.bracket-groups-wrap, .bracket-section)
Il tabellone del campionato occupa tutta la pagina, costringendo a scorrere molto.
Fix — opzione popup/modal:

Aggiungere un pulsante 📊 Tabellone visibile e fisso (o inline vicino alla sezione)
Il tabellone vero e proprio va messo in un modal/overlay che si apre al click e si chiude con ✕ o click fuori
Fuori dal modal, mostrare solo un riepilogo compatto: per ogni girone, una tabellina standings con solo nome + V + S (già presente come .bracket-standings)
Il modal deve essere fullscreen su mobile, centrato e largo 90vw su desktop, scrollabile internamente

5c. Pannelli collassabili a bottoni (foto 5)
I seguenti pannelli sono ora espandibili con ▼ ma occupano spazio:

.class-stats-section (Titoli d'Arena, Statistiche Classi Torneo, Statistiche Classi Arena Libera)
Fix:
Trasformarli in button pill/card cliccabili che aprono un modal con il contenuto
I bottoni devono essere in una riga/griglia orizzontale, stile card compatta con icona + titolo breve
Modal: stesso stile degli altri (fullscreen mobile, centrato desktop), con intestazione e bottone ✕
Rimuovere il sistema collapse ▼/▲ attuale, sostituire con questo sistema modal

5d. Pannello scommesse nascosto (.betting-panel)
Attualmente è in fondo alla pagina, invisibile.
Fix — floating action button:

Aggiungere un FAB (Floating Action Button) fisso in basso a destra: 🎲 Scommetti
Al click, aprire un drawer/modal con il contenuto del .betting-panel
Il FAB deve avere stile bordeaux #7d2929, icona dado 🎲, badge con numero di scommesse piazzate se > 0
Su mobile il drawer occupa tutta la viewport dal basso (bottom sheet), su desktop è un modal centrato
Il pannello scommesse originale nella pagina può essere rimosso o nascosto


📋 REGOLE GENERALI da rispettare

Non toccare la logica JS/React, solo CSS e struttura HTML dei template JSX dove strettamente necessario per i modal
Tutti i modal devono avere: overlay scuro semitrasparente, close button ✕, chiusura con Escape, focus trap base
I font (Cinzel Decorative, Cinzel, serif) vanno mantenuti per i titoli
Le modifiche devono funzionare su mobile (375px+) e desktop (1200px+)
Usa CSS custom properties dove possibile: --arena-red: #7d2929; --arena-gold: #c9a84c; --arena-bg: #f8f6f2;
Ogni classe CSS modificata deve essere commentata con /* FIX: [numero problema] */
Se usi React per i modal, aggiungi createPortal per renderli in document.body


📁 File probabilmente coinvolti

src/pages/ArenaPage.jsx o simile
src/components/arena/*.jsx
src/styles/arena.css o il CSS module della pagina Arena
Potrebbe esserci un file arena.css o stili inline nei componenti React

Prima di iniziare: elenca i file della cartella src/ e identifica esattamente quali file modificare. Poi procedi problema per problema nell'ordine indicato, mostrando le modifiche file per file.