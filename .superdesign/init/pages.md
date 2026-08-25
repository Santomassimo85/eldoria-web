# Pages — dependency trees (import locali ricorsivi, no node_modules)

Ogni pagina è montata dentro la shell di `src/App.jsx` (header + MobileBottomNav + footer, vedi `layouts.md`) e riceve i CSS globali da `src/main.jsx` (`style.css`, `styles/theme.css`, `styles/shell.css`, `styles/light-theme.css`, `styles/layout.css` — vedi `theme.md`).

**Sotto-albero comune (via shell, condiviso da tutte le pagine):**
```
src/App.jsx
- src/AuthContext.jsx
  - src/firebase.js
  - src/utils/ensureBaseCharacter.js
    - src/firebase.js
- src/LoginDropdown.jsx
  - src/LoginDropdown.css
  - src/AuthContext.jsx · src/firebase.js
- src/data/hiddenPlayers.js
- src/components/SendNotification.jsx (+ .css)
- src/components/NotificationOptIn.jsx
- src/components/FirestoreErrorGuard.jsx
- src/components/DiceRoll.jsx (+ DiceRoll.css)
- src/tcg/access.js
```
Nei tree sotto, i moduli del sotto-albero comune (`../firebase`, `../AuthContext`) sono elencati ma non ri-espansi.

---

## / (Home)
Entry: `src/pages/Home.jsx` — hero asimmetrico parallax + lore manoscritto + PantheonGrid (componente inline, dati pantheon hardcoded nel file) + countdown sessioni da Firestore.
```
src/pages/Home.jsx
- src/components/Countdown.jsx
- src/firebase.js
- src/pages/Home.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
```
Context file consigliati per il design: `Home.jsx`, `Home.css`, `cinematic.css` (token in theme.md).

## /party (Eroi / Party — "Registro Araldico")
Entry: `src/pages/Party.jsx`
```
src/pages/Party.jsx
- src/pages/Party.css
- src/styles/cinematic.css
- src/firebase.js
- src/hooks/useParallaxScroll.js
- src/components/AmbientFX.jsx
  - src/components/AmbientFX.css
- src/components/CineToolbar.jsx        (stile in styles/cinematic.css)
- src/data/hiddenPlayers.js
```

## /npc (NPC — "Schedario dei Volti")
Entry: `src/pages/NPC.jsx`
```
src/pages/NPC.jsx
- src/firebase.js
- src/AuthContext.jsx
- src/utils/pet.js
  - src/firebase.js
  - src/data/petSpecies.js
  - src/data/petMoves.js
- src/pages/NPC.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
- src/components/AmbientFX.jsx
  - src/components/AmbientFX.css
- src/components/CineToolbar.jsx
```

## /Geo (Archivio Geomantico — "Atlante Geomantico")
Entry: `src/pages/Geo.jsx` (monta anche GeoAdmin per il master)
```
src/pages/Geo.jsx
- src/firebase.js
- src/pages/ToggleSection.jsx
  - src/pages/ToggleSection.css
- src/AuthContext.jsx
- src/pages/GeoAdmin.jsx
  - src/firebase.js (db, storage)
  - src/AuthContext.jsx
  - src/components/HtmlToolbar.jsx
  - src/data/citiesHub.js
  - src/pages/admin.css
- src/utils/pet.js
  - src/firebase.js · src/data/petSpecies.js · src/data/petMoves.js
- src/utils/loreLinks.js
  - src/data/citiesHub.js
  - src/data/hiddenPlayers.js
- src/pages/Geo.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
- src/components/AmbientFX.jsx (+ AmbientFX.css)
- src/components/CineToolbar.jsx
```

## /mercato (Mercato Nero — "Banco del Contrabbando")
Entry: `src/pages/Mercato.jsx`
```
src/pages/Mercato.jsx
- src/AuthContext.jsx
- src/firebase.js
- src/styles/cinematic.css
- src/pages/Mercato.css
- src/hooks/useParallaxScroll.js
```
Pagina collegata `/mercato/:id`:
```
src/pages/ItemDetail.jsx
- src/AuthContext.jsx
- src/firebase.js
- src/styles/cinematic.css
- src/pages/ItemDetail.css
```
Nota: molte classi delle loot-card (`mc-*`, `mat-*`) vivono nel legacy `src/style.css`.

## /bacheca (Bacheca — "Albo degli Incarichi")
Entry: `src/pages/Bacheca.jsx`
```
src/pages/Bacheca.jsx
- src/firebase.js
- src/pages/Bacheca.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
- src/components/AmbientFX.jsx (+ AmbientFX.css)
- src/components/CineToolbar.jsx
- src/AuthContext.jsx
```
Pagina collegata `/quest/:id`:
```
src/pages/QuestDetail.jsx
- src/firebase.js
- src/AuthContext.jsx
- src/pages/admin.css
- src/styles/cinematic.css
- src/pages/QuestDetail.css
- src/hooks/useParallaxScroll.js
```

## /riassunti (Riassunti — "Codice delle Memorie")
Entry: `src/pages/Riassunti.jsx`
```
src/pages/Riassunti.jsx
- src/pages/ToggleSection.jsx
  - src/pages/ToggleSection.css
- src/firebase.js
- src/AuthContext.jsx
- src/utils/pet.js
  - src/firebase.js · src/data/petSpecies.js · src/data/petMoves.js
- src/utils/loreLinks.js
  - src/data/citiesHub.js
  - src/data/hiddenPlayers.js
- src/pages/Riassunti.css
```
(Niente cinematic.css: usa il proprio layout "doppia pagina" in Riassunti.css.)

## /crafting (Crafting — "Tomo dell'Artigiano")
Entry: `src/pages/Crafting.jsx` — pagina interamente statica sui dati di `crafting.js` (72KB di ricette).
```
src/pages/Crafting.jsx
- src/data/crafting.js
- src/pages/Crafting.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
```

## /cinema (Cinema)
Entry: `src/pages/Cinema.jsx`
```
src/pages/Cinema.jsx
- src/firebase.js
- src/AuthContext.jsx
- src/pages/Cinema.css
- src/styles/cinematic.css
- src/hooks/useParallaxScroll.js
```

## /world-map (WorldMap)
Entry: `src/pages/WorldMap.jsx` — mappa interattiva con zoom/pan, cartiglio cartografico, timer eventi.
```
src/pages/WorldMap.jsx
- src/firebase.js
- src/pages/WorldMap.css
- src/styles/cinematic.css
- src/components/TimerDisplay.jsx
- src/AuthContext.jsx
- src/data/citiesHub.js          ← FONTE UNICA città (condivisa con GeoAdmin, mai duplicare)
```

---

### Payload hints
- Le pagine "cine" condividono `styles/cinematic.css` + `hooks/useParallaxScroll.js`: passali una volta sola (o usa il sommario token in `theme.md`).
- `utils/pet.js` (26KB) serve alle pagine solo per `awardPetPoints` (gamification): per un task di puro design è omissibile.
- `data/crafting.js` (72KB), `data/petSpecies.js` (44KB), `changelog.json` (162KB) sono dati, non UI: non passarli come contesto design.
