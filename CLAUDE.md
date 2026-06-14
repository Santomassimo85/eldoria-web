## Regole restyle (sempre valide)
- Ricolorare = fallire. Ogni pagina cambia STRUTTURA, non solo colori.
- NON toccare logica/link/route/href. Solo markup + CSS/animazioni.
- NON toccare: TCG, Arena, World Boss Fight.
- Tema unico: "Pergamena Antica" (chiaro).
- Parallax: mai background-attachment:fixed (rotto iOS). Usa translateY/sticky.
- Lavora su UN pezzo alla volta, committa, poi fermati.
- Test di accettazione B&N: "prima" e "dopo" devono sembrare due siti diversi anche in bianco e nero.

## Workflow per ogni pagina
1. FASE 0 (no codice): mini-audit STRUTTURA VECCHIA → STRUTTURA NUOVA (chiaramente diversa) + alternative con raccomandazione + lista file. Fermati e aspetta conferma.
2. Implementa SOLO quella pagina. Niente commit/push se non richiesto (l'utente rivede dal locale).
3. Aspetta il giudizio B&N dell'utente, poi pagina successiva.

## STATO / SAVEPOINT (aggiornato 2026-06-14)

### FATTO
- **Tema chiaro "Pergamena Antica"** esteso a tutto il sito (commit Fasi 1–6).
  - Token: `src/styles/light-theme.css`. Sistema cine condiviso: `src/styles/cinematic.css`. Flottanti/layout: `src/styles/layout.css`. Caricati in `src/main.jsx` (ordine: style → theme → shell → light-theme → layout).
  - Pagine di gioco (Arena/TCG/World Boss/Pet) restano SCURE via `body.theme-dark` (toggle per-rotta in `src/App.jsx`).
- **Restyle STRUTTURALE — PILOTA = Home + shell/nav (COMPLETO):**
  - **STEP A — nav globale** (`src/App.jsx` componente `MobileBottomNav` + `src/styles/layout.css`):
    - Mobile/tablet (≤1300px): **bottom-bar** `Home · Mondo · Eroi · Gilda · Menu`; Mondo/Eroi/Gilda aprono **bottom-sheet** a griglia; **Menu** apre il drawer completo (Agent, Update, Battaglia, DM Tools, DM Admin…). Burger nascosto su mobile.
    - Flottanti riordinati SOPRA la barra: chat (dx), presenza online (sx), calendario Home (sx, impilato). Safe-area iOS ovunque.
    - Desktop (>1300px): top-bar con nav inline invariata (copertura identica).
    - La bottom-bar è un `<div role="navigation">` (NON `<nav>`, altrimenti eredita lo stile drawer di shell.css). Z-index 1065 (sopra il backdrop sheet).
  - **STEP B — contenuto Home** (`src/pages/Home.jsx` + `src/pages/Home.css`, nuovo componente `PantheonGrid`):
    - Hero **asimmetrico**: immagine full-bleed dx + placca-pergamena sx, titolo a sinistra, CTA in colonna→riga, parallax translateY, scroll-cue ad anello.
    - Lore **manoscritto**: desktop = marginalia sticky (Capitolo I) + articolo con rubrica/illustrazione float/capolettera; mobile = colonna unica. Prosa originale invariata.
    - Pantheon: **fascia etichettata** + **griglia carte** (1/2/3 col) con **dettaglio al tap (modale)**. Sostituisce il vecchio accordion.

### DA FARE (una pagina alla volta, stesso workflow + test B&N)
Ordine suggerito:
1. Eroi / Party (`src/pages/Party.jsx` + `Party.css`)
2. NPC (`src/pages/NPC.*`)
3. **Geo / Archivio Geomantico** (`src/pages/Geo.*`) — BUG NOTO da risolvere: l'indicatore "Scorri" e le iconcine renderizzano in un riquadro bianco vuoto/fuori posto.
4. Mercato (`src/pages/Mercato.*`) + ItemDetail (`src/pages/ItemDetail.*`)
5. Bacheca (`src/pages/Bacheca.*`)
6. Riassunti (`src/pages/Riassunti.*`)
7. Crafting (`src/pages/Crafting.*`)
8. Gilda dei Ratti (`src/pages/RattiLore.*`)
9. Cinema (`src/pages/Cinema.*`)
10. Feedback (`src/pages/Feedback.*`)
11. QuestDetail (`src/pages/QuestDetail.*`)
12. Notifications (`src/pages/Notifications.*`)
13. Bottega Arena (`src/pages/ArenaMarket.*`) — è contenuto, NON il combattimento Arena
14. Assistente (`src/pages/Assistente.jsx`, stile inline)
15. Scheda PG (`src/pages/SchedaPG.jsx` + `pgSheetEditor.css`)
16. Pannelli DM/Admin (`src/pages/admin.css`, `src/GeneraNPC.*`, `src/pages/DmTools.*`)
17. WorldMap (`src/pages/WorldMap.*`) — SOLO cornice/UI, mappa interattiva intatta
18. Updates (`src/pages/Updates.*`) — già a tema, rifinire solo se serve

### Note / aperti
- Rail `cine-side-nav` (indice sezioni): valutare trasformazione in indice-capitoli inline (oggi solo riposizionato sopra la bottom-bar).
- `Antico_pantheon.png` non più mostrato nella sezione Antichi (eventuale reinserimento nella fascia).

### Verifica
- Build: `npx vite build`. Dev: `npx vite --port 5188`. Test mobile 414px + desktop 1568px. Applica il test B&N a ogni pagina.
