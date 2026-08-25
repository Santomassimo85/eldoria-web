# Routes — eldoria-web ("Crit Happens")

Routing: **react-router-dom v7, config-based**. Non esiste un file router separato: tutte le route sono dichiarate inline in **`src/App.jsx`** dentro `<main><Routes>…</Routes></main>` (il file completo di `App.jsx` è in `layouts.md`; il blocco router integrale è riportato in fondo a questo file). `BrowserRouter` è montato in `src/main.jsx`.

Tutte le route condividono la stessa shell (header/top-bar, drawer, MobileBottomNav, footer) — non ci sono layout annidati. Eccezioni:
- **Fullscreen** (chrome nascosta, riapribile via ☰): `/boss-tactics`, `/world-boss-fight`, `/dm-admin/battle-maps`.
- **Tema scuro** (`body.theme-dark`, token Arcanum Nocturne): `/arena*`, `/tcg`, `/world-boss*`, `/boss-tactics`, `/pet*`, `/dm-admin/battle-maps`. Tutto il resto è tema chiaro "Pergamena Antica".

## Route pubbliche / di gioco

| URL | Componente | File | Note |
|---|---|---|---|
| `/` | `Home` | `src/pages/Home.jsx` | Hero asimmetrico parallax, lore manoscritto (Capitolo I), PantheonGrid (Antichi/Nuovi/Malvagi) con modale, countdown sessioni (widget calendario) |
| `/party` | `Party` | `src/pages/Party.jsx` | "Registro Araldico": indice sigilli, casate a doppia pagina, scheda eroe modale |
| `/assistente` | `Assistente` | `src/pages/Assistente.jsx` | Chat AI "oracolo" (masthead + chat) |
| `/agenti` | `Concilio` | `src/pages/Concilio.jsx` | Il Concilio — agenti AI (solo Master) |
| `/npc` | `NPC` | `src/pages/NPC.jsx` | "Schedario dei Volti": capitoli per città a marginalia, schede-dossier |
| `/world-map` | `WorldMap` | `src/pages/WorldMap.jsx` | Mappa interattiva con zoom, cartiglio cartografico, hub città (CITIES_HUB) |
| `/Geo` | `Geo` | `src/pages/Geo.jsx` | "Atlante Geomantico": indice continenti inline, lore linkificata |
| `/riassunti` | `Riassunti` | `src/pages/Riassunti.jsx` | "Codice delle Memorie": gruppi a doppia pagina + export PDF |
| `/diario` | `Diario` | `src/pages/Diario.jsx` | Diario di Bordo |
| `/riassunto/:id` | `RiassuntoSingolo` | `src/pages/RiassuntoSingolo.jsx` | Dettaglio riassunto |
| `/sessions/:party` | `GenerateSession` | `src/pages/GenerateSession.jsx` | Archivio prep-sessioni DM per party |
| `/sessions/:party/:number` | `SessionDetail` | `src/pages/SessionDetail.jsx` | Dettaglio prep-sessione |
| `/dm/generate-session` | `GenerateSession` | `src/pages/GenerateSession.jsx` | Generatore sessioni DM (master+co-master) |
| `/scriba` | `Scriba` | `src/pages/Scriba.jsx` | Lo Scriba — gazzetta del mondo |
| `/giornale/:id` | `ScribaSingolo` | `src/pages/ScribaSingolo.jsx` | Numero singolo della gazzetta |
| `/almanacco` | `Almanacco` | `src/pages/Almanacco.jsx` | Almanacco del Mondo |
| `/ratti-lore` | `RattiLore` | `src/pages/RattiLore.jsx` | "Codice del Sottosuolo": lore + gradi Gilda dei Ratti |
| `/bacheca` | `Bacheca` | `src/pages/Bacheca.jsx` | "Albo degli Incarichi": missive appuntate, animazione apri-pergamena |
| `/quest/:id` | `QuestDetail` | `src/pages/QuestDetail.jsx` | Hero "missiva" con copertina dinamica |
| `/cinema` | `Cinema` | `src/pages/Cinema.jsx` | Hero a locandina, teatro/featured/sala video |
| `/tarocchi` | `Tarocchi` | `src/pages/Tarocchi.jsx` | L'Oracolo — letture 22 Arcani (Alaric) |
| `/my-pg`, `/scheda-pg` | `SchedaPG` | `src/pages/SchedaPG.jsx` | Scheda personaggio (palette Pergamena) |
| `/mercato` | `Mercato` | `src/pages/Mercato.jsx` | "Banco del Contrabbando": Mercato Nero, loot-card + aste |
| `/mercato/:id` | `ItemDetail` | `src/pages/ItemDetail.jsx` | "Cartiglio di stima" oggetto |
| `/arena` | `Arena` | `src/pages/Arena.jsx` | DARK. Hub bento "Pietra & Rune" (viste `arenaView`) |
| `/arena-bottega` | `ArenaMarket` | `src/pages/ArenaMarket.jsx` | Bottega Arena (hero chiaro + shop) |
| `/tcg` | `Tcg` | `src/pages/Tcg.jsx` | DARK. TCG MTGA-style (`src/tcg/*`), gated da allow-list |
| `/crafting` | `Crafting` | `src/pages/Crafting.jsx` | "Tomo dell'Artigiano": sommario a capitoli |
| `/world-boss-fight` | `BossTactics` | `src/pages/tactics/BossTactics.jsx` | DARK + fullscreen. Battaglia tattica iso FFT |
| `/world-boss-old` | `WorldBoss` | `src/pages/WorldBoss.jsx` | DARK. Vecchio world boss |
| `/boss-tactics` | `BossTactics` | `src/pages/tactics/BossTactics.jsx` | DARK + fullscreen (alias) |
| `/notifications` | `Notifications` | `src/pages/Notifications.jsx` | Notifiche utente (hero asimmetrico) |
| `/feedback` | `Feedback` | `src/pages/Feedback.jsx` | Form + dashboard feedback |
| `/updates` | `Updates` | `src/pages/Updates.jsx` | Changelog "UPDATE" (da `src/data/changelog.json`) |

Route commentate/disabilitate: `/pet` (PetHub), `/pet-arena` (PetArena) — sistema Pet temporaneamente spento.

## Route admin (`/dm-admin/*`, master o co-master via UI gating)

| URL | Componente | File |
|---|---|---|
| `/dm-admin` | `AdminPanel` | `src/pages/AdminPanel.jsx` |
| `/dm-admin/genera-npc` | `GeneraNPC` | `src/GeneraNPC.jsx` |
| `/dm-admin/strumenti` | `DmTools` | `src/pages/DmTools.jsx` |
| `/dm-admin/foundry-item` | `FoundryItemForm` | `src/pages/FoundryItemForm.jsx` |
| `/dm-admin/foundry-npc` | `FoundryNpcForm` | `src/pages/FoundryNpcForm.jsx` |
| `/dm-admin/world-boss` | `WorldBossAdmin` | `src/pages/WorldBossAdmin.jsx` |
| `/dm-admin/quests` | `QuestAdmin` | `src/pages/QuestAdmin.jsx` |
| `/dm-admin/market` | `MarketAdmin` | `src/pages/MarketAdmin.jsx` |
| `/dm-admin/sessions` | `AdminSessions` | `src/pages/AdminSessions.jsx` |
| `/dm-admin/videos` | `VideoAdmin` | `src/pages/VideoAdmin.jsx` |
| `/dm-admin/summaries` | `SummaryAdmin` | `src/pages/SummaryAdmin.jsx` |
| `/dm-admin/scriba` | `LoScribaAdmin` | `src/pages/LoScribaAdmin.jsx` |
| `/dm-admin/platinum` | `PlatinumAdmin` | `src/pages/PlatinumAdmin.jsx` |
| `/dm-admin/pet-points` | `PetPointsAdmin` | `src/pages/PetPointsAdmin.jsx` |
| `/dm-admin/reputation` | `ReputationAdmin` | `src/pages/ReputazioneAdmin.jsx` |
| `/dm-admin/geo` | `GeoAdmin` | `src/pages/GeoAdmin.jsx` |
| `/dm-admin/send-notif` | `SendNotification` | `src/components/SendNotification.jsx` |
| `/dm-admin/player-sprites` | `PlayerSpritesAdmin` | `src/pages/PlayerSpritesAdmin.jsx` |
| `/dm-admin/battle-maps` | `BattleMapEditor` | `src/pages/tactics/BattleMapEditor.jsx` (DARK + fullscreen) |

## Struttura della navigazione (come le route sono raggruppate nella UI)

- Top-level: `Home` · `Agent` (/assistente) · `UPDATE` (/updates)
- Dropdown **ᛗ Mondo**: Mappa (/world-map), Archivio Geomantico (/Geo)
- Dropdown **ᛒ Biblioteca**: Lo Scriba (/scriba), Riassunti (/riassunti), Diario di Bordo (/diario)
- Dropdown **ᚱ Guide**: Almanacco (/almanacco), Crafting (/crafting), Gilda dei Ratti (/ratti-lore)
- Dropdown **ᛖ Eroi**: Party (/party), Scheda PG (/scheda-pg), NPC (/npc)
- Dropdown **ᚷ Gilda**: Mercato Nero (/mercato), [💀 Listino MN — solo master, /mercato-nero-pricing.html statico], Bacheca (/bacheca), Cinema (/cinema), 🔮 L'Oracolo (/tarocchi), 💬 Feedback (/feedback)
- Dropdown **ᚦ Battaglia**: Arena (/arena), Bottega Arena (/arena-bottega), 🎴 TCG (gated), World Fight (/world-boss-fight)
- Condizionali: **DM Tools** (dropdown, master+co-master), **🜂 AGENTI** (/agenti, master), **DM ADMIN** (/dm-admin, master), RIASSUNTI/MARKET/GENERA SESSIONE (co-master)
- Bottom-bar mobile (≤1300px): `Home · ᛗ Mondo · ᛒ Biblioteca · ᚷ Gilda · ☰ Menu` (le prime 4 aprono bottom-sheet, Menu apre il drawer completo).

## Router config integrale (da `src/App.jsx`)

```jsx
<main>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/party" element={<Party />} />
    <Route path="/assistente" element={<Assistente />} />
    <Route path="/agenti" element={<Concilio />} />
    <Route path="/npc" element={<NPC />} />
    <Route path="/world-map" element={<WorldMap />} />
    <Route path="/Geo" element={<Geo />} />
    <Route path="/riassunti" element={<Riassunti />} />
    <Route path="/diario" element={<Diario />} />
    <Route path="/riassunto/:id" element={<RiassuntoSingolo />} />
    <Route path="/sessions/:party" element={<GenerateSession />} />
    <Route path="/sessions/:party/:number" element={<SessionDetail />} />
    <Route path="/dm/generate-session" element={<GenerateSession />} />
    <Route path="/scriba" element={<Scriba />} />
    <Route path="/giornale/:id" element={<ScribaSingolo />} />
    <Route path="/almanacco" element={<Almanacco />} />
    <Route path="/ratti-lore" element={<RattiLore />} />
    <Route path="/bacheca" element={<Bacheca />} />
    <Route path="/quest/:id" element={<QuestDetail />} />
    <Route path="/cinema" element={<Cinema />} />
    <Route path="/tarocchi" element={<Tarocchi />} />
    <Route path="/my-pg" element={<SchedaPG />} />
    <Route path="/scheda-pg" element={<SchedaPG />} />
    <Route path="/mercato" element={<Mercato />} />
    <Route path="/mercato/:id" element={<ItemDetail />} />
    <Route path="/arena" element={<Arena />} />
    <Route path="/arena-bottega" element={<ArenaMarket />} />
    {/* <Route path="/pet" element={<PetHub />} /> */}
    {/* <Route path="/pet-arena" element={<PetArena />} /> */}
    <Route path="/tcg" element={<Tcg />} />
    <Route path="/crafting" element={<Crafting />} />
    <Route path="/world-boss-fight" element={<BossTactics />} />
    <Route path="/world-boss-old" element={<WorldBoss />} />
    <Route path="/boss-tactics" element={<BossTactics />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="/feedback" element={<Feedback />} />
    <Route path="/updates" element={<Updates />} />

    {/* ROTTE ADMIN */}
    <Route path="/dm-admin/genera-npc" element={<GeneraNPC />} />
    <Route path="/dm-admin/strumenti" element={<DmTools />} />
    <Route path="/dm-admin/foundry-item" element={<FoundryItemForm />} />
    <Route path="/dm-admin/foundry-npc" element={<FoundryNpcForm />} />
    <Route path="/dm-admin" element={<AdminPanel />} />
    <Route path="/dm-admin/world-boss" element={<WorldBossAdmin />} />
    <Route path="/dm-admin/quests" element={<QuestAdmin />} />
    <Route path="/dm-admin/market" element={<MarketAdmin />} />
    <Route path="/dm-admin/sessions" element={<AdminSessions />} />
    <Route path="/dm-admin/videos" element={<VideoAdmin />} />
    <Route path="/dm-admin/summaries" element={<SummaryAdmin />} />
    <Route path="/dm-admin/scriba" element={<LoScribaAdmin />} />
    <Route path="/dm-admin/platinum" element={<PlatinumAdmin />} />
    <Route path="/dm-admin/pet-points" element={<PetPointsAdmin />} />
    <Route path="/dm-admin/reputation" element={<ReputationAdmin />} />
    <Route path="/dm-admin/geo" element={<GeoAdmin />} />
    <Route path="/dm-admin/send-notif" element={<SendNotification />} />
    <Route path="/dm-admin/player-sprites" element={<PlayerSpritesAdmin />} />
    <Route path="/dm-admin/battle-maps" element={<BattleMapEditor />} />
  </Routes>
</main>
```
