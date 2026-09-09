## FEATURE ATTIVA: Generatore Sessioni DM (2026-07-03)
- Piano completo + stato: `docs/generate-session/PLAN.md` e `docs/generate-session/progress.md`.
- Strumento privato (solo master + co-master) per generare/archiviare le prep-sessioni dei party AMEA/LEAF/ENOX con Claude Opus 4.8.
- Collezione `dm_sessions` (NON la `sessions` esistente = calendario). Isolamento per party sempre. `reference_sessions/*.html` = solo guscio grafico.

## TEMA LIVE: "R · Il Covo del Drago" (2026-09-08) — TUTTO il sito
- Mockup approvato `public/mockups/r-covo.html` → portato su tutto il sito in un colpo. Layer globale `src/styles/covo.css` (caricato PER ULTIMO in main.jsx, dopo nesso.css): token del covo (`--ossidiana/--roccia*/--osso*/--oro/--sangue` + respiro `--el/--el-2/--el-soft/--el-deep/--el-rgb`), rimappa i token Nesso (`--nx-*`) e legacy, testata, d20-menu, rubriche col filo a freccia, blocchi (bordo alto acceso + artigli al hover), CTA "lama", input incassati, tab = dadi d6 (::before), modali, tiro, occhio, responsive.
- **Respiro** (5 voci dal 2026-09-08 sera): Fuoco · Gelo · Arcano (viola) · Veleno (drago verde) · **Bianco = TEMA CHIARO** (`html[data-soffio="bianco"]` ribalta ossidiana/roccia/osso; sezione 15 di covo.css). I colori del covo nei CSS sono TOKEN (`var(--roccia-2)`, `rgba(var(--ossidiana-rgb),.x)`…) grazie a `node tools/covo-remap.mjs --tokenize` (idempotente; salta CovoOverlay): MAI riscrivere #221f27/#ece5d6 in chiaro, altrimenti il Bianco si rompe. Le squame del canvas leggono `--pelle-0/1/2`. Tastino Fuoco/Gelo nell'header (`.respiro` in App.jsx, localStorage `covo_soffio`, `html[data-soffio]`). **Admin/DM = respiro ARCANO (viola)** via `body.covo-admin` (rotte /dm-admin, /dm/, /agenti, /sessions/) — stesso tema, colori diversi.
- `CovoOverlay.jsx` (sostituisce NessoOverlay): canvas squame + braci/cristalli + squame accese al mouse; gesti globali delegati: l'IRIDE (`.gl-finestra-img`, `.covo-iride`) segue il cursore; il TIRO inietta `<span class="tiro">` su `.nx-pannello--tap, .cine-card, .ch-card, .deity-card, .gl-vetrata, .admin-card, .tacca, [data-tiro]` (20 = `.covo-crit`, 1 = `.covo-fumble`). Spento su `body.theme-dark`.
- Il menu resta `NessoNav` (stessi handler) ma l'Orbe è il D20 (svg + numero che rotola; sfaccettature = esagoni). GlacierHero: il varco è l'OCCHIO (`.gl-finestra-wrap` > `.gl-finestra` ellisse con palpebre ::before/::after, immagine = iride, `.gl-finestra-velo` = pupilla).
- Palette meccanica: `node tools/covo-remap.mjs` (idempotente; esclude Arena/TCG/WorldBoss/Pet): hex Nesso → Covo, viola/ciano → `var(--el*)`, magenta → oro, raggi 5–60px → 3px, Manrope → Alegreya. Nuovi CSS: usare i token del covo, MAI esadecimali del Nesso.
- Font: Grenze Gotisch (titoli, `--font-title/head/display`), Alegreya (`--font-ui/text`), Alegreya SC (`--font-sc`, etichette), Cinzel (`--font-num`, numeri/CTA). Link in index.html.
- **Tema chiaro "Alba del Nesso" DISMESSO**: `nesso-light*.css` non più importati (file e `tools/gen-light-theme.mjs` restano su disco), tastino ☀/☾ sostituito dal respiro. Pagine di gioco (`body.theme-dark`) ricevono solo i token/header.
- **Arena** (2026-09-08): stesso Covo, STRUTTURA INVARIATA (hub bento, le due card del fight nel palco, sottomenu — piacciono all'utente). `node tools/covo-remap.mjs --arena` ha rimappato Arena.css/ArenaHero/ArenaNessoViste/ArenaPalcoFight/ArenaBill (oro → `--el`, pietra → roccia, pergamena → osso); `src/pages/ArenaCovo.css` (ULTIMO import in Arena.jsx) toglie il fondale e mette i font; `body.covo-arena` (solo rotta /arena) accende CovoOverlay pur restando theme-dark. **Bottega Arena (2026-09-09) = Covo**: `ArenaMarket.css`/`ArenaMarketCatalogo.css` riscritti a token (body.covo-arena anche su /arena-bottega), struttura invariata. Hub Arena semplificato (ArenaBill.css LAYER 11: tabellone in una riga, 4 piastrelle + fila "Altro", classifica a blocco unico). TCG, World Boss restano com'erano.
- Scheda PG: CSS inline in SchedaPG.jsx già rimappato al covo. Scriba: l'overlay nero all'apertura è l'intro-video (feature esistente), non un bug del tema.

## Scala di superfici Nesso (2026-09-07)
- Token in `nesso.css` §0: `--nx-s1` (contenitori/input incassati) → `--nx-s2` (card) → `--nx-s3` (elevati: hover, tab attivi, modali, card DENTRO card) → `--nx-s4` (livello massimo). Deriva prugna, non più indaco piatto. Bordo "filo di luce" `--nx-hair` + riflesso `--nx-hair-hi`. Testo: `--nx-ink` / `--nx-body` / `--nx-muted` / `--nx-faint`.
- Regola: un elemento annidato SALE di un gradino, mai lo stesso colore del contenitore. Il gradiente ciano→viola è solo per CTA e chip attive; i tab (`.dmt-tab`, `.mkadm-tab`, `.geoadm-tab`) sono binario S1 + segmento S4 con filo ciano (nesso.css §12).
- Nuovi CSS: usare i token, non esadecimali. `node tools/nesso-surfaces.mjs` rimappa i vecchi grigi-indaco hardcoded (idempotente, esclude pagine di gioco); poi `node tools/gen-light-theme.mjs`.

## Regole restyle (sempre valide)
- Ricolorare = fallire. Ogni pagina cambia STRUTTURA, non solo colori.
- NON toccare logica/link/route/href. Solo markup + CSS/animazioni.
- NON toccare: TCG, World Boss Fight. Arena: solo pelle (ArenaCovo.css), mai la struttura.
- Tema unico: "R · Il Covo del Drago" (scuro; Fuoco/Gelo; admin Arcano). Pergamena e Nesso sono storia.
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
