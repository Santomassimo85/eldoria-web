## FEATURE ATTIVA: Generatore Sessioni DM (2026-07-03)
- Piano completo + stato: `docs/generate-session/PLAN.md` e `docs/generate-session/progress.md`.
- Strumento privato (solo master + co-master) per generare/archiviare le prep-sessioni dei party AMEA/LEAF/ENOX con Claude Opus 4.8.
- Collezione `dm_sessions` (NON la `sessions` esistente = calendario). Isolamento per party sempre. `reference_sessions/*.html` = solo guscio grafico.

## Tema chiaro "Alba del Nesso" (2026-09-06)
- Tastino ☀/☾ nell'header (`App.jsx`, `.theme-toggle`), scelta in localStorage `nx_theme`; attivo via `html[data-theme="light"]`. Le pagine di gioco (`body.theme-dark`) restano SEMPRE scure.
- `src/styles/nesso-light.generated.css` è GENERATO: dopo aver toccato colori in nesso.css/layout/shell o nei CSS di pagina, rilanciare `node tools/gen-light-theme.mjs` (mappa vuoto→alba, vedi MAP nello script). Regole a mano in `src/styles/nesso-light.css`.
- Colori inline dal JS (party, classi, continenti) sul chiaro vengono scuriti con `filter: brightness(.55)` (lista in nesso-light.css §4).

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

### DA FARE — RESTYLE COMPLETATO ✅ (2026-06-14)
Tutte le pagine del giro sono state ristrutturate (changelog v25/v26/v27). Sintesi:
1. Eroi / Party → "Registro Araldico" (hero asimmetrico, indice sigilli, casate a doppia pagina, scheda eroe modale). ✅
2. NPC → "Schedario dei Volti" (capitoli per città a marginalia, schede-dossier orizzontali). ✅
3. Geo → "Atlante Geomantico" (indice continenti inline; **bug "Scorri" + iconcine in riquadro bianco RISOLTI**). ✅
4. Mercato → "Banco del Contrabbando" (hero + rango Ratto come sigillo + rubrica; loot-card/aste intatte) + ItemDetail "cartiglio di stima". ✅
5. Bacheca → "Albo degli Incarichi" (albo incorniciato + missive appuntate; animazione apri-pergamena intatta). ✅
6. Riassunti → "Codice delle Memorie" (gruppi a doppia pagina con marginalia + export PDF). ✅
7. Crafting → "Tomo dell'Artigiano" (sommario a capitoli + rubriche di capitolo numerate). ✅
8. Gilda dei Ratti → "Codice del Sottosuolo" (lore manoscritto + gradi a scala gerarchica). ✅
9. Cinema → hero a locandina + rubrica (teatro/featured/sala invariati). ✅
10. Feedback → hero asimmetrico (form/dashboard invariati). ✅
11. QuestDetail → hero "missiva" con copertina dinamica. ✅
12. Notifications → hero asimmetrico (card invariate). ✅
13. Bottega Arena → hero + rubrica Potenziamenti (shop/classi/master invariati). ✅
14. Assistente → masthead "oracolo" (chat invariata). ✅
15. Scheda PG → palette ribaltata da grimorio scuro a Pergamena chiara. ✅
16. Pannelli DM/Admin → masthead condiviso a filetto (`GeneraNPC.css`); `admin.css` già a tema. ✅
17. WorldMap → titolo a cartiglio cartografico, mappa/zoom intatti. ✅
18. Updates → eyebrow/rubrica (già a tema). ✅

### Note / aperti
- `pgSheetEditor.css` (editor PG del master) e i restanti pannelli admin minori: già su `admin.css` chiaro; eventuale rifinitura strutturale dedicata se richiesta.
- Rail `cine-side-nav`: dismesso sulle pagine ristrutturate a favore di indici inline / marginalia.
- `Antico_pantheon.png` non più mostrato nella sezione Antichi (eventuale reinserimento nella fascia).

### Verifica
- Build: `npx vite build`. Dev: `npx vite --port 5188`. Test mobile 414px + desktop 1568px. Applica il test B&N a ogni pagina.
