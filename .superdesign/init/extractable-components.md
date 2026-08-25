# Extractable Components — eldoria-web ("Crit Happens")

Catalogo dei componenti estraibili come `DraftComponent` Superdesign. Codice completo in `components.md` / `layouts.md` — qui solo il "menu".

---

## Layout components (presenti su quasi tutte le pagine)

## AppHeader
- Source: `src/App.jsx` (JSX dentro `App()`, classi `.app-nav`; stile: `style.css` + `shell.css` + `light-theme.css`)
- Category: layout
- Description: Top-bar pergamena semitrasparente con logo, nav inline desktop (>1300px) a dropdown runici, avatar/login a destra, burger nascosto su mobile.
- Extractable props: `activeRoute` (string, default "/"), `isLoggedIn` (boolean, default false), `isMaster` (boolean, default false — mostra AGENTI/DM ADMIN/DM Tools)
- Hardcoded: logo `/logo.png`, etichette voci (Home, Agent, UPDATE, Mondo, Biblioteca, Guide, Eroi, Gilda, Battaglia), rune ᛗᛒᚱᛖᚷᚦ, tutte le classi CSS.

## NavDropdown
- Source: `src/App.jsx` (funzione `NavDropdown`)
- Category: layout
- Description: Voce di nav a dropdown/fisarmonica (trigger + freccia ▾ + menu di NavLink), un solo menu aperto per volta.
- Extractable props: `label` (string), `open` (boolean, default false)
- Hardcoded: struttura trigger+menu, classi `.nav-dd*`, animazione ch-pop.

## MobileBottomNav
- Source: `src/App.jsx` (funzione `MobileBottomNav`; stile: `styles/layout.css`)
- Category: layout
- Description: Bottom-bar fissa ≤1300px con 5 tab runiche (Home ᚺ · Mondo ᛗ · Biblioteca ᛒ · Gilda ᚷ · Menu ☰); le categorie aprono una bottom-sheet a griglia 2 colonne con grip e backdrop.
- Extractable props: `activeTab` (string: "home"|"mondo"|"biblioteca"|"gilda", default "home"), `openSheet` (string|null, default null)
- Hardcoded: rune e label delle tab, link dei gruppi (MOBILE_GROUPS), classi `.app-bottom-nav .mnav-*`, gradiente carta e sigillo runico attivo.

## MobileDrawer
- Source: `src/App.jsx` (il `<nav className="active">` in versione mobile; stile: `shell.css` @media ≤1300px + override chiaro in `light-theme.css`)
- Category: layout
- Description: Drawer laterale a tutta altezza da destra (86vw max 380px) con backdrop blur, X di chiusura, ingresso link a cascata.
- Extractable props: `open` (boolean, default false)
- Hardcoded: voci di menu (le stesse della top-bar), animazioni ch-fade-up con delay incrementali.

## LoginDropdown
- Source: `src/LoginDropdown.jsx` (+ `src/LoginDropdown.css`)
- Category: layout
- Description: Avatar utente nell'header con badge notifiche; pannello dropdown con scheda personaggio (nome, email, Corone 💰, rango Ratto 🐀), voci Notifiche/Scheda PG/Master Panel/Esci; variante "Accedi" con form email+password.
- Extractable props: `isLoggedIn` (boolean, default true), `unreadCount` (number, default 0), `isMaster` (boolean, default false), `avatarSrc` (string, default "/assets/player/default.png")
- Hardcoded: etichette menu, icone emoji, soglie rango Ratto, classi `.ld-*`, animazione arrotolamento pergamena.

## AppFooter
- Source: `src/App.jsx` (blocco `<footer>`; stile in `style.css`)
- Category: layout
- Description: Footer con CTA YouTube (logo svg + "Guardaci su YouTube") e copyright OrpheusDesign.
- Extractable props: nessuna (statico)
- Hardcoded: link YouTube, `/assets/critHappensMark.svg`, testo copyright con anno dinamico.

## OnlinePresenceFab
- Source: `src/App.jsx` (funzione `OnlinePresence`; stile `.online-*` in `style.css`, posizione in `layout.css`)
- Category: layout
- Description: FAB in basso a sinistra (solo master) con pallino verde + contatore; popup con lista giocatori online e tempo relativo.
- Extractable props: `count` (number, default 0), `open` (boolean, default false)
- Hardcoded: titolo "Giocatori online", empty state, classi `.online-fab/.online-popup`.

## CineHero
- Source: pattern condiviso in `src/styles/cinematic.css` (markup ripetuto in ogni pagina cine: `.cine-hero > .cine-hero-media > img + .cine-hero-vignette + .cine-hero-gradient + .cine-hero-pattern`, `.cine-hero-content` con eyebrow/title/tagline/meta, `.cine-hero-scroll-hint`)
- Category: layout
- Description: Hero full-bleed 86-96vh con immagine antichizzata in parallax che sfuma nella pergamena; eyebrow a pillola, titolo gradient-clip oro, tagline, pill meta, scroll-cue ad anello.
- Extractable props: `imageSrc` (string), `eyebrow` (string), `title` (string), `tagline` (string), `compact` (boolean, default false — variante `.cine-compact`/`--short`)
- Hardcoded: vignette/gradienti/pattern, animazioni cine-rise/cine-bounce, tutte le classi.

## CineScrollyDivider
- Source: `src/styles/cinematic.css` (`.cine-scrolly*`; markup ripetuto nelle pagine)
- Category: layout
- Description: Divisore di sezione "scrollytell": immagine parallax full-bleed (o banner compatto in `.cine-compact`) con frame-pergamena centrale (eyebrow + titolo + testo).
- Extractable props: `imageSrc` (string), `eyebrow` (string), `title` (string), `text` (string), `compact` (boolean, default false)
- Hardcoded: overlay seppia, ken-burns della variante compatta, classi.

---

## Basic components (riusati tra pagine)

## CineToolbar
- Source: `src/components/CineToolbar.jsx` (stile `.cine-toolbar` in `styles/cinematic.css`)
- Category: basic
- Description: Toolbar sticky di ricerca con input 🔍, chip di filtro pillola e contatore risultati.
- Extractable props: `query` (string, default ""), `activeChip` (string|null, default null), `count` (number), `placeholder` (string, default "Cerca…"), `countNoun` (string, default "risultati")
- Hardcoded: icona 🔍, bottone clear ✕, stile chips/attivo.

## ToggleSection
- Source: `src/pages/ToggleSection.jsx` (+ `ToggleSection.css`)
- Category: basic
- Description: Sezione accordion con titolo h3 cliccabile e chevron ▼ ruotante.
- Extractable props: `defaultOpen` (boolean, default false), `title` (string)
- Hardcoded: chevron &#9660;, classi `.toggle-*`.

## CineButton
- Source: classi `.cine-btn`, `.cine-btn--gold`, `.cine-btn--ghost` in `src/styles/cinematic.css`
- Category: basic
- Description: Bottone maiuscolo Cinzel a gradiente (viola arcano di default; oro; ghost pergamena) con lift all'hover.
- Extractable props: `variant` (string: "accent"|"gold"|"ghost", default "accent"), `label` (string)
- Hardcoded: font/letterspacing, radius 12px, ombre.

## ChButton
- Source: classi `.ch-btn(--amber|--arc|--crit|--ghost)` in `src/styles/theme.css`
- Category: basic
- Description: Bottone pill del design system con ripple al click e glow per variante (usato soprattutto nelle pagine dark).
- Extractable props: `variant` (string: "default"|"amber"|"arc"|"crit"|"ghost"), `disabled` (boolean, default false)
- Hardcoded: ripple ::after, gradienti firma, radius pill.

## CineCard / CinePanel
- Source: classi `.cine-card`, `.cine-panel`, `.cine-panel-dark` in `src/styles/cinematic.css`
- Category: basic
- Description: Card/pannello pergamena con bordo sinistro accent 4px, filetto superiore a gradiente accent→oro, lift all'hover e reveal scroll-driven.
- Extractable props: `variant` (string: "card"|"panel"|"panel-dark", default "card")
- Hardcoded: gradienti carta, ombre calde, radius `--cine-radius` 22px.

## ChCard / ChChip / ChField
- Source: classi `.ch-card`, `.ch-chip(--amber|--crit)`, `.ch-field/.ch-label/.ch-input/.ch-select/.ch-textarea` in `src/styles/theme.css`
- Category: basic
- Description: Card con bagliore d'angolo hover; chip uppercase pillola; campo form con label Cinzel e focus ring arcano. Tema-aware (chiaro/scuro via token).
- Extractable props: chip: `variant` ("arc"|"amber"|"crit"); field: `label` (string), `placeholder` (string)
- Hardcoded: tutte le classi e transizioni.

## CinePill / CineEyebrow / CineSectionTitle
- Source: classi `.cine-pill(--accent)`, `.cine-eyebrow`, `.cine-section-title` + `.cine-section-sub` in `src/styles/cinematic.css`
- Category: basic
- Description: Meta-pillole per hero, eyebrow a cartiglio, titolo di sezione gradient-clip oro con sottotitolo corsivo.
- Extractable props: `text` (string); pill: `accent` (boolean, default false)
- Hardcoded: tipografia Cinzel, letterspacing, gradienti.

## Countdown
- Source: `src/components/Countdown.jsx` (stile `.countdown-*` in `style.css`)
- Category: basic
- Description: Countdown sessione con 4 cifre (Giorni/Ore/Minuti/Secondi), nome party in Cinzel Decorative oro e CTA "Entra su Foundry VTT".
- Extractable props: `partyName` (string), `targetDate` (string ISO)
- Hardcoded: link Foundry, messaggio "sessione in corso", label unità.

## TimerDisplay
- Source: `src/components/TimerDisplay.jsx`
- Category: basic
- Description: Countdown inline "Xh Ym Zs" / "TEMPO SCADUTO".
- Extractable props: `expiryDate` (string ISO)
- Hardcoded: formato testo, classe `.timer-countdown-text`.

## DieIcon
- Source: `src/components/DieIcon.jsx`
- Category: basic
- Description: Icona SVG di dado poliedrico (d4–d20) con numero centrale.
- Extractable props: `sides` (number: 4|6|8|10|12|20, default 6)
- Hardcoded: geometrie poligoni, classi `.die-icon*`.

## AmbientFX
- Source: `src/components/AmbientFX.jsx` (+ `AmbientFX.css`)
- Category: basic
- Description: Layer decorativo di particelle animate a tutta pagina.
- Extractable props: `variant` (string: "fire"|"water"|"leaves"|"cosmos"|"fireflies", default "fire")
- Hardcoded: conteggi particelle, seed pseudo-random, keyframes.

## DiceRollOverlay
- Source: `src/components/DiceRoll.jsx` (+ `DiceRoll.css`)
- Category: basic
- Description: Overlay fullscreen del tiro d20 animato (tumble→settle→hold→fade) con skin e tag CRITICO!/FALLIMENTO.
- Extractable props: `value` (number 1–20), `skin` (string id da DICE_SKINS, default "classic"), `label` (string, default "")
- Hardcoded: timing animazione, 10 skin, classi `.dice-*`.

## DateTimePicker
- Source: `src/components/DateTimePicker.jsx` (+ `DateTimePicker.css`)
- Category: basic
- Description: Picker data+ora con calendario mensile, stepper ore/minuti, quick-times e preset contestuali.
- Extractable props: `value` (string "YYYY-MM-DDTHH:MM", default ""), `presets` (string: "auction"|"opening"|"session"|"none", default "auction"), `placeholder` (string)
- Hardcoded: nomi mesi/giorni IT, quick-times, classi `.dtp-*`.

## PantheonGrid (pattern "card grid + modal")
- Source: `src/pages/Home.jsx` (funzione inline)
- Category: basic
- Description: Griglia di carte divinità (ritratto + nome/epiteto/dominio + cue "Scopri ›") con modale di dettaglio al tap.
- Extractable props: `list` (array di deity objects)
- Hardcoded: split nome–epiteto, layout carta/modale, classi `.deity-*` (in `Home.css`).

## PetAvatar
- Source: `src/components/PetAvatar.jsx` (+ `PetAvatar.css`)
- Category: basic
- Description: Avatar specie pet con fallback emoji.
- Extractable props: `size` (number), `species` (object)
- Hardcoded: classi `.pet-avatar*`.

## GlobalChat (FAB + finestra)
- Source: `src/components/GlobalChat.jsx` (stile `.chat-*` in `style.css`, dock in `layout.css`)
- Category: basic
- Description: FAB 💬 con badge non letti + finestra chat "Locanda di Exanthia" (header, lista messaggi own/master, input). NOTA: attualmente non montato in App.jsx.
- Extractable props: `open` (boolean, default false), `unreadCount` (number, default 0)
- Hardcoded: titolo locanda, placeholder, classi.
