# Shared Layout Components — eldoria-web ("Crit Happens")

La shell dell'app vive interamente in `src/App.jsx`: header/top-bar con nav inline desktop (>1300px), drawer mobile, **MobileBottomNav** (bottom-bar ≤1300px + bottom-sheet per categoria), presenza online (FAB master-only), footer, host globali (DiceRollHost, FirestoreErrorGuard, NotificationOptIn). Il CSS della shell è in `src/style.css` (base), `src/styles/shell.css` (header/drawer), `src/styles/layout.css` (bottom-bar/FAB/safe-area), `src/styles/light-theme.css` (override pergamena) — dump completi in `theme.md`.

## Entry: `src/main.jsx`
Ordine di caricamento CSS (l'ultimo vince): style → theme → shell → light-theme → layout.

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./style.css";
import "./styles/theme.css"; // design system "Arcanum Nocturne" — dopo style.css per rimappare i token
import "./styles/shell.css"; // restyle header/navigazione (scuro premium + drawer mobile)
import "./styles/light-theme.css"; // tema chiaro "Pergamena Antica" — caricato per ultimo (vince)
import "./styles/layout.css"; // posizionamento flottanti coerente + safe-area iOS
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

## `index.html` (font + PWA)
Google Fonts caricate: **Cardo**, **Cinzel** (500/600/700), **Cinzel Decorative** (400/700/900), **Manrope** (400–800), **EB Garamond** (regular + italic).

```html
<link href="https://fonts.googleapis.com/css2?family=Cardo&family=Cinzel:wght@500;600;700&family=Cinzel+Decorative:wght@400;700;900&family=Manrope:wght@400;500;600;700;800&family=EB+Garamond:ital@0;1&display=swap" rel="stylesheet">
```

---

## App shell + nav (desktop top-bar, drawer mobile, MobileBottomNav, OnlinePresence, footer)
- Path: `src/App.jsx` — FILE COMPLETO (contiene anche la config delle route, vedi `routes.md`).
- Renderizza: `<header class="app-nav">` (logo + LoginDropdown + burger + `<nav>` con NavDropdown a fisarmonica), `<main><Routes>…`, `MobileBottomNav` (bottom-bar `Home · Mondo · Biblioteca · Gilda · Menu` con bottom-sheet), `OnlinePresence` (FAB master), `DiceRollHost`, `FirestoreErrorGuard`, `<footer>` con link YouTube.
- Note: pagine fullscreen (`/boss-tactics`, `/world-boss-fight`, `/dm-admin/battle-maps`) nascondono la chrome; le pagine di gioco (arena/tcg/world-boss/pet/battle-maps) impostano `body.theme-dark`.
- La bottom-bar è un `<div role="navigation">` (NON `<nav>`, altrimenti eredita lo stile drawer di shell.css). Z-index 1065.

```jsx
import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import "./style.css";

// AUTH & CONTEXT
import { AuthProvider, useAuth } from "./AuthContext";
import LoginDropdown from "./LoginDropdown";

// FIREBASE
import { db } from "./firebase";
import {
  doc, updateDoc, setDoc, onSnapshot, collection,
  serverTimestamp,
} from "firebase/firestore";
import { isHiddenChar } from "./data/hiddenPlayers";

// PAGES

import Home from "./pages/Home";
import Party from "./pages/Party";
import Notifications from "./pages/Notifications";
import Riassunti from "./pages/Riassunti";
import RiassuntoSingolo from "./pages/RiassuntoSingolo";
import SessionDetail from "./pages/SessionDetail";
import GenerateSession from "./pages/GenerateSession";
import Mercato from "./pages/Mercato";
import Geo from "./pages/Geo";
import ItemDetail from "./pages/ItemDetail";
import AdminPanel from "./pages/AdminPanel";
import MarketAdmin from "./pages/MarketAdmin";
import SummaryAdmin from "./pages/SummaryAdmin";
import LoScribaAdmin from "./pages/LoScribaAdmin";
import Scriba from "./pages/Scriba";
import ScribaSingolo from "./pages/ScribaSingolo";
import Almanacco from "./pages/Almanacco";
import SchedaPG from "./pages/SchedaPG";
import PlatinumAdmin from "./pages/PlatinumAdmin";
import RattiLore from "./pages/RattiLore";
import Diario from "./pages/Diario";
import Bacheca from "./pages/Bacheca";
import QuestAdmin from "./pages/QuestAdmin";
import QuestDetail from "./pages/QuestDetail";
import ReputationAdmin from "./pages/ReputazioneAdmin";
import VideoAdmin from "./pages/VideoAdmin";
import Cinema from "./pages/Cinema";
import Tarocchi from "./pages/Tarocchi";
import GeoAdmin from "./pages/GeoAdmin";
import WorldMap from "./pages/WorldMap";
import AdminSessions from "./pages/AdminSessions";
import WorldBoss from "./pages/WorldBoss";
import WorldBossAdmin from "./pages/WorldBossAdmin";
import Arena from "./pages/Arena";
import ArenaMarket from "./pages/ArenaMarket";
import BossTactics from "./pages/tactics/BossTactics";
import BattleMapEditor from "./pages/tactics/BattleMapEditor";
import DmTools from "./pages/DmTools";
import Assistente from "./pages/Assistente";
import Concilio from "./pages/Concilio";
// PET SYSTEM — temporarily disabled. Re-enable by uncommenting these
// imports and the matching nav link / routes below.
// import PetArena from "./pages/PetArena";
// import PetHub from "./pages/PetHub";
import Tcg from "./pages/Tcg";
import { isTcgUnlockedFor } from "./tcg/access";
import Crafting from "./pages/Crafting";
import PetPointsAdmin from "./pages/PetPointsAdmin";
import NPC from "./pages/NPC";
import GeneraNPC from "./GeneraNPC";
import FoundryItemForm from "./pages/FoundryItemForm";
import FoundryNpcForm from "./pages/FoundryNpcForm";
import Feedback from "./pages/Feedback";
import Updates from "./pages/Updates";
import SendNotification from "./components/SendNotification";
import NotificationOptIn from "./components/NotificationOptIn";
import FirestoreErrorGuard from "./components/FirestoreErrorGuard";
import PlayerSpritesAdmin from "./pages/PlayerSpritesAdmin";
import DiceRollHost from "./components/DiceRoll";

// CONFIG
const MASTER_EMAIL_UI = "santomassimo85@gmail.com";
const APP_VERSION = "2.2.1"; // <--- CAMBIA QUESTO NUMERO PER FORZARE IL REFRESH GLOBALE

// --- Dropdown menu component ---
function NavDropdown({ label, children, closeAll, id, openId, setOpenId }) {
  // Modalità "fisarmonica" se controllato (id + setOpenId): un solo menu aperto per volta.
  const controlled = id !== undefined && typeof setOpenId === "function";
  const [openU, setOpenU] = useState(false);
  const open = controlled ? openId === id : openU;
  const setOpen = (v) => {
    const next = typeof v === "function" ? v(open) : v;
    if (controlled) setOpenId(next ? id : null);
    else setOpenU(next);
  };
  const ref = useRef(null);

  // Click-fuori: solo in modalità NON controllata. In accordion (controllato)
  // se ne occupa un singolo listener nel padre, altrimenti i fratelli si
  // interferiscono e il re-click non chiude il sottomenu.
  useEffect(() => {
    if (controlled) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenU(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [controlled]);

  const handleChildClick = () => {
    setOpen(false);
    closeAll();
  };

  return (
    <div className={`nav-dd${open ? " nav-dd--open" : ""}`} ref={ref}>
      <button
        className="nav-dd-trigger"
        data-dd={id}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="nav-dd-arrow">▾</span>
      </button>
      <div className="nav-dd-menu">
        {React.Children.map(children, (child) =>
          child
            ? React.cloneElement(child, { onClick: handleChildClick })
            : null
        )}
      </div>
    </div>
  );
}

// Elenco dei co-master: hanno accesso agli strumenti DM ma non al pannello admin completo.
const CO_MASTER_EMAILS = ["ripperti96@gmail.com"];
const isDmUser = (email) => email === MASTER_EMAIL_UI || CO_MASTER_EMAILS.includes(email);

// --- Link al Generatore NPC (master + co-master) ---
const NpcGenNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return (
    <NavLink to="/dm-admin/genera-npc" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>
      Genera NPC
    </NavLink>
  );
};
// --- Link agli strumenti DM (master + co-master) ---
const DmToolsNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return <NavLink to="/dm-admin/strumenti" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>Strumenti DM</NavLink>;
};

// --- Link al form "Crea Oggetto → Foundry" (master + co-master) ---
const FoundryItemNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return <NavLink to="/dm-admin/foundry-item" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "var(--red)", fontWeight: 700 })}>Oggetto → Foundry</NavLink>;
};

// --- Menu raggruppato "DM Tools" (master + co-master) ---
const DmToolsDropdown = ({ closeMenu, openId, setOpenId }) => {
  const { currentUser } = useAuth();
  if (!isDmUser(currentUser?.email)) return null;
  return (
    <NavDropdown label="DM Tools" closeAll={closeMenu} id="dmtools" openId={openId} setOpenId={setOpenId}>
      <NavLink to="/dm-admin/genera-npc">Genera NPC</NavLink>
      <NavLink to="/dm-admin/strumenti">Strumenti DM</NavLink>
      <NavLink to="/dm/generate-session">Genera Sessione</NavLink>
      <NavLink to="/dm-admin/foundry-item">Oggetto → Foundry</NavLink>
      <NavLink to="/dm-admin/foundry-npc">NPC → Foundry</NavLink>
    </NavDropdown>
  );
};

// --- Link "Agenti" (Il Concilio) — solo Master, voce di primo livello ---
const ConcilioNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email !== MASTER_EMAIL_UI) return null;
  return (
    <NavLink
      to="/agenti"
      className={({ isActive }) => isActive ? "active admin-link admin-link-red" : "admin-link admin-link-red"}
      onClick={closeMenu}
      style={{ backgroundColor: "var(--red)", color: "#ffe7a8", fontWeight: "bold" }}
      title="Il Concilio — i tuoi agenti AI"
    >
      🜂 AGENTI
    </NavLink>
  );
};

// --- Componente Link Admin Condizionale ---
const AdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email === MASTER_EMAIL_UI) {
    return (
      <NavLink
        to="/dm-admin"
        className={({ isActive }) => isActive ? "active admin-link admin-link-red" : "admin-link admin-link-red"}
        onClick={closeMenu}
        style={{ backgroundColor: "var(--red)", color: "#ffe7a8", fontWeight: "bold" }}
      >
        DM ADMIN
      </NavLink>
    );
  }
  return null;
};

// --- Link DM dedicati al co-master (summaries + black market) ---
const SummaryAdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (!CO_MASTER_EMAILS.includes(currentUser?.email)) return null;
  const linkStyle = { backgroundColor: "var(--gold)", color: "var(--red)", fontWeight: "bold" };
  return (
    <>
      <NavLink
        to="/dm-admin/summaries"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        RIASSUNTI
      </NavLink>
      <NavLink
        to="/dm-admin/market"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        MARKET
      </NavLink>
      <NavLink
        to="/dm/generate-session"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={linkStyle}
      >
        GENERA SESSIONE
      </NavLink>
    </>
  );
};

// --- TCG nav link — hidden while the page is locked unless the
//     current account is on the TCG allow-list (master, testers). ---
const TcgNavLink = ({ onClick }) => {
  const { currentUser } = useAuth();
  if (!isTcgUnlockedFor(currentUser?.email)) return null;
  return (
    <NavLink to="/tcg" onClick={onClick}>🎴 TCG</NavLink>
  );
};

// --- Master-only link to the offline pricing tool (opens in a new tab) ---
const MasterPricingLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email !== MASTER_EMAIL_UI) return null;
  return (
    <a
      href="/mercato-nero-pricing.html"
      target="_blank"
      rel="noopener noreferrer"
      onClick={closeMenu}
      style={{ color: "var(--gold)", fontStyle: "italic" }}
      title="Listino prezzi del Mercato Nero · solo Master"
    >
      💀 Listino MN (DM)
    </a>
  );
};

// ── NAV MOBILE — bottom-bar (≤1300px) + bottom-sheet per categoria ──────────────
// Sistema di navigazione responsive: le rotte sono ESATTAMENTE quelle del menu
// esistente (nessun link/route nuovo). "Menu" apre il drawer completo (tutto il
// resto: Agent, Update, Battaglia, DM Tools, DM Admin).
const MOBILE_GROUPS = {
  mondo: { rune: "ᛗ", label: "Mondo", links: [
    { to: "/world-map", label: "Mappa" },
    { to: "/Geo", label: "Archivio Geomantico" },
  ]},
  biblioteca: { rune: "ᛒ", label: "Biblioteca", links: [
    { to: "/scriba", label: "Lo Scriba" },
    { to: "/riassunti", label: "Riassunti" },
    { to: "/diario", label: "Diario di Bordo" },
  ]},
  gilda: { rune: "ᚷ", label: "Gilda", links: [
    { to: "/mercato", label: "Mercato Nero" },
    { to: "/bacheca", label: "Bacheca" },
    { to: "/cinema", label: "Cinema" },
    { to: "/tarocchi", label: "L'Oracolo" },
    { to: "/feedback", label: "Feedback" },
  ]},
};

function MobileBottomNav({ openMenu }) {
  const location = useLocation();
  const [sheet, setSheet] = useState(null);
  const p = location.pathname;

  // chiudi la sheet a ogni cambio rotta
  useEffect(() => { setSheet(null); }, [p]);

  const group =
    p === "/" ? "home"
    : ["/world-map", "/Geo"].includes(p) ? "mondo"
    : ["/scriba", "/riassunti", "/diario"].includes(p) ? "biblioteca"
    : ["/mercato", "/bacheca", "/cinema", "/tarocchi", "/feedback"].some((x) => p.startsWith(x)) ? "gilda"
    : null;

  const g = sheet ? MOBILE_GROUPS[sheet] : null;
  const toggle = (key) => setSheet((s) => (s === key ? null : key));

  return (
    <>
      {g && <div className="mnav-backdrop" onClick={() => setSheet(null)} aria-hidden="true" />}
      {g && (
        <div className="mnav-sheet" role="dialog" aria-label={g.label}>
          <span className="mnav-sheet-grip" aria-hidden="true" />
          <div className="mnav-sheet-head"><span className="mnav-sheet-rune" aria-hidden="true">{g.rune}</span> {g.label}</div>
          <div className="mnav-sheet-links">
            {g.links.map((l) => (
              <NavLink key={l.to} to={l.to} className="mnav-sheet-link" onClick={() => setSheet(null)}>
                {l.label}
              </NavLink>
            ))}
            {sheet === "gilda" && <MasterPricingLink closeMenu={() => setSheet(null)} />}
          </div>
        </div>
      )}
      <div className="app-bottom-nav" role="navigation" aria-label="Navigazione rapida">
        <NavLink to="/" end className="mnav-tab" onClick={() => setSheet(null)}>
          <span className="mnav-ic mnav-rune" aria-hidden="true">ᚺ</span><span className="mnav-lb">Home</span>
        </NavLink>
        <button type="button" className={`mnav-tab${group === "mondo" || sheet === "mondo" ? " is-active" : ""}`} onClick={() => toggle("mondo")}>
          <span className="mnav-ic mnav-rune" aria-hidden="true">ᛗ</span><span className="mnav-lb">Mondo</span>
        </button>
        <button type="button" className={`mnav-tab${group === "biblioteca" || sheet === "biblioteca" ? " is-active" : ""}`} onClick={() => toggle("biblioteca")}>
          <span className="mnav-ic mnav-rune" aria-hidden="true">ᛒ</span><span className="mnav-lb">Biblioteca</span>
        </button>
        <button type="button" className={`mnav-tab${group === "gilda" || sheet === "gilda" ? " is-active" : ""}`} onClick={() => toggle("gilda")}>
          <span className="mnav-ic mnav-rune" aria-hidden="true">ᚷ</span><span className="mnav-lb">Gilda</span>
        </button>
        <button type="button" className="mnav-tab" onClick={() => { setSheet(null); openMenu(); }}>
          <span className="mnav-ic" aria-hidden="true">☰</span><span className="mnav-lb">Menu</span>
        </button>
      </div>
    </>
  );
}

// ── PRESENZA ONLINE ───────────────────────────────────────────────────────────
function relTime(ms) {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60)   return `${sec}s fa`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min fa`;
  return `${Math.floor(sec / 3600)}h fa`;
}

function OnlinePresence() {
  const { currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [open, setOpen]               = useState(false);
  const [, setTick]                   = useState(0);
  const lastWriteRef                  = useRef(0);
  const isMaster = currentUser?.email === MASTER_EMAIL_UI;

  // Scrivi lastSeen in characters/{uid} — usa la collection che ha già le regole
  const writePresence = useRef(null);
  writePresence.current = async () => {
    if (!currentUser) return;
    const now = Date.now();
    if (now - lastWriteRef.current < 8000) return; // debounce 8s
    lastWriteRef.current = now;
    try {
      await setDoc(doc(db, "characters", currentUser.uid), {
        lastSeen: serverTimestamp(),
      }, { merge: true });
    } catch (_) {
      // ignora silenziosamente
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const init = setTimeout(() => writePresence.current?.(), 1500);
    const hb   = setInterval(() => writePresence.current?.(), 30000);
    const act  = () => writePresence.current?.();
    window.addEventListener("click",      act);
    window.addEventListener("keydown",    act);
    window.addEventListener("touchstart", act);
    window.addEventListener("scroll",     act, { passive: true });
    const onVis = () => { if (document.visibilityState === "visible") writePresence.current?.(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(init); clearInterval(hb);
      window.removeEventListener("click",      act);
      window.removeEventListener("keydown",    act);
      window.removeEventListener("touchstart", act);
      window.removeEventListener("scroll",     act);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [currentUser]);

  // Solo master: ascolta characters collection
  useEffect(() => {
    if (!isMaster) return;
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(p => !isHiddenChar(p))
        .filter(p => {
          if (!p.lastSeen) return false;
          const ms = p.lastSeen.toMillis ? p.lastSeen.toMillis() : new Date(p.lastSeen).getTime();
          return now - ms < 15 * 60 * 1000; // ultimi 15 minuti
        });
      setOnlineUsers(active);
    });
    return () => unsub();
  }, [isMaster]);

  // Tick per aggiornare i tempi relativi ogni 5s
  useEffect(() => {
    if (!isMaster) return;
    const t = setInterval(() => setTick(v => v + 1), 5000);
    return () => clearInterval(t);
  }, [isMaster]);

  if (!isMaster) return null;

  return (
    <>
      {/* Pallino fluttuante */}
      <button
        className={`online-fab${open ? " open" : ""}`}
        onClick={() => setOpen(v => !v)}
        title="Giocatori online"
      >
        <span className="online-fab-dot" />
        {onlineUsers.length > 0 && (
          <span className="online-fab-count">{onlineUsers.length}</span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div className="online-popup">
          <div className="online-popup-title">
            <span className="online-dot-sm" /> Giocatori online
          </div>
          {onlineUsers.length === 0 ? (
            <div className="online-popup-empty">Nessuno attivo di recente</div>
          ) : (
            onlineUsers.map(u => {
              const ms = u.lastSeen?.toMillis ? u.lastSeen.toMillis() : new Date(u.lastSeen || 0).getTime();
              return (
                <div key={u.uid} className="online-popup-row">
                  <span className="online-popup-name">{u.name || "Eroe"}</span>
                  <span className="online-popup-time">{relTime(ms)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [forceShowNav, setForceShowNav] = useState(false);
  const [openDd, setOpenDd] = useState(null); // dropdown nav aperto (fisarmonica: uno solo)
  const location = useLocation();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => { setMenuOpen(false); setOpenDd(null); };

  // Chiude il dropdown aperto cliccando fuori da qualsiasi .nav-dd (un solo listener).
  useEffect(() => {
    if (!openDd) return;
    const h = (e) => { if (!e.target.closest || !e.target.closest(".nav-dd")) setOpenDd(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openDd]);

  // Fullscreen battle pages hide the top nav to give the fight more room.
  const FULLSCREEN_ROUTES = ["/boss-tactics", "/world-boss-fight", "/dm-admin/battle-maps"];
  const hideChrome = FULLSCREEN_ROUTES.includes(location.pathname);
  // Nella pagina Arena (e sottosezioni: fight, tabellone, ecc.) nascondi la chat globale.
  const isArenaPage = location.pathname.startsWith("/arena");
  // Reset the temporary "reveal nav" whenever the route changes.
  useEffect(() => { setForceShowNav(false); }, [location.pathname]);

  // TEMA: il sito è light "pergamena" di default; le pagine immersive di gioco
  // (arena, tcg, world boss tattico, pet) restano scure → body.theme-dark.
  useEffect(() => {
    const p = location.pathname;
    const isDarkGamePage =
      p.startsWith("/arena") ||
      p === "/tcg" ||
      p.startsWith("/world-boss") ||
      p === "/boss-tactics" ||
      p.startsWith("/pet") ||
      p === "/dm-admin/battle-maps";
    document.body.classList.toggle("theme-dark", isDarkGamePage);
    return () => document.body.classList.remove("theme-dark");
  }, [location.pathname]);

  // --- LOGICA REFRESH & CACHE BUSTING ---
  useEffect(() => {
    // 1. Controllo Versione (LocalStorage)
    const lastVersion = localStorage.getItem("app_version");
    if (lastVersion !== APP_VERSION) {
      localStorage.setItem("app_version", APP_VERSION);
      // Pulisce cache dei Service Workers se presenti
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) registration.unregister();
        });
      }
      // Forza ricaricamento ignorando la cache
      window.location.reload(true);
    }

    // 2. Listener per aggiornamenti Service Worker "al volo"
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            };
          }
        };
      });
    }
  }, []);

  return (
    <AuthProvider>
      <NotificationOptIn />
      {hideChrome && !forceShowNav && (
        <button className="battle-nav-reopen" onClick={() => setForceShowNav(true)} aria-label="Apri menu">
          ☰
        </button>
      )}
      {(!hideChrome || forceShowNav) && (
      <header className="app-nav">
        <NavLink to="/" className="logo logo--img-only" onClick={closeMenu} aria-label="Crit Happens — Home">
          <img src="/logo.png" alt="Crit Happens" className="logo-img" />
        </NavLink>

        {/* Destra header: avatar sempre visibile + burger su mobile */}
        <div className="header-right">
          <LoginDropdown closeMenu={closeMenu} />

          <div className={`burger ${menuOpen ? "open" : ""}`} onClick={toggleMenu} aria-label="Apri menu">
            <span className="line line-1"></span>
            <span className="line line-2"></span>
            <span className="line line-3"></span>
          </div>

          {/* On fullscreen pages the header is only revealed via ☰ — this X
              hides it again and returns to the fullscreen view. */}
          {hideChrome && (
            <button
              className="nav-hide-btn"
              onClick={() => { setForceShowNav(false); setMenuOpen(false); }}
              aria-label="Nascondi menu"
              title="Nascondi menu"
            >
              ✕
            </button>
          )}
        </div>

        {menuOpen && <div className="nav-backdrop" onClick={closeMenu} aria-hidden="true" />}
        <nav
          className={menuOpen ? "active" : ""}
          onClick={(e) => { if (e.target === e.currentTarget) closeMenu(); }}
        >
          <button type="button" className="nav-close" onClick={closeMenu} aria-label="Chiudi menu">×</button>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/assistente" onClick={closeMenu} style={({ isActive }) => ({ color: isActive ? "#fff" : "#0e4d75", fontWeight: 700 })}>Agent</NavLink>
          <NavLink to="/updates" onClick={closeMenu}>UPDATE</NavLink>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᛗ</span> Mondo</>} closeAll={closeMenu} id="mondo" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/world-map">Mappa</NavLink>
            <NavLink to="/Geo">Archivio Geomantico</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᛒ</span> Biblioteca</>} closeAll={closeMenu} id="biblioteca" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/scriba">Lo Scriba</NavLink>
            <NavLink to="/riassunti">Riassunti</NavLink>
            <NavLink to="/diario">Diario di Bordo</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᚱ</span> Guide</>} closeAll={closeMenu} id="guide" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/almanacco">Almanacco del Mondo</NavLink>
            <NavLink to="/crafting">Crafting</NavLink>
            <NavLink to="/ratti-lore">Gilda dei Ratti</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᛖ</span> Eroi</>} closeAll={closeMenu} id="eroi" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/party">Party</NavLink>
            <NavLink to="/scheda-pg">Scheda PG</NavLink>
            <NavLink to="/npc">NPC</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᚷ</span> Gilda</>} closeAll={closeMenu} id="gilda" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/mercato">Mercato Nero</NavLink>
            <MasterPricingLink closeMenu={closeMenu} />
            <NavLink to="/bacheca">Bacheca</NavLink>
            <NavLink to="/cinema">Cinema</NavLink>
            <NavLink to="/tarocchi">🔮 L'Oracolo</NavLink>
            <NavLink to="/feedback">💬 Feedback</NavLink>
          </NavDropdown>

          <NavDropdown label={<><span className="nav-rune" aria-hidden="true">ᚦ</span> Battaglia</>} closeAll={closeMenu} id="battaglia" openId={openDd} setOpenId={setOpenDd}>
            <NavLink to="/arena">Arena</NavLink>
            <NavLink to="/arena-bottega">Bottega Arena</NavLink>
            {/* <NavLink to="/pet">Pet Hub</NavLink> */}
            <TcgNavLink />
            <NavLink to="/world-boss-fight">World Fight</NavLink>
          </NavDropdown>

          <DmToolsDropdown closeMenu={closeMenu} openId={openDd} setOpenId={setOpenDd} />
          <ConcilioNavLink closeMenu={closeMenu} />
          <AdminNavLink closeMenu={closeMenu} />
          <SummaryAdminNavLink closeMenu={closeMenu} />
        </nav>
      </header>
      )}

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

      <DiceRollHost />
      {!hideChrome && <OnlinePresence />}
      <FirestoreErrorGuard />

      {!hideChrome && <MobileBottomNav openMenu={() => setMenuOpen(true)} />}

      <footer>
        <a
          className="footer-yt"
          href="https://www.youtube.com/@Crit_Happens-p9e"
          target="_blank"
          rel="noreferrer"
          aria-label="Crit Happens su YouTube"
        >
          <img src="/assets/critHappensMark.svg" alt="" className="footer-yt-logo" />
          Guardaci su YouTube
        </a>
        <p>
          © {new Date().getFullYear()}{" "}
          <strong>
            <a href="https://designbyorpheus.it/" target="_blank" rel="noreferrer">OrpheusDesign</a>
          </strong>
        </p>
      </footer>
    </AuthProvider>
  );
}
```

---

## LoginDropdown (avatar/login nell'header)
- Path: `src/LoginDropdown.jsx` (+ `src/LoginDropdown.css`)
- Bottone "Accedi" con form dropdown (non loggato) oppure avatar con badge notifiche e pannello utente (nome PG, corone, rango Ratto, link Notifiche/Scheda/Master Panel/Logout). Presente nell'header su OGNI pagina.

```jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
} from "firebase/firestore";
import "./LoginDropdown.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const RATTO_LEVELS = [
  { min: 0,  name: "Estraneo" },
  { min: 5,  name: "Simpatizzante" },
  { min: 15, name: "Informatore" },
  { min: 30, name: "Ricettatore" },
  { min: 50, name: "Veterano" },
  { min: 80, name: "Ombra di Obia" },
];

function getRattoRank(points = 0) {
  let rank = RATTO_LEVELS[0].name;
  for (const lvl of RATTO_LEVELS) {
    if (points >= lvl.min) rank = lvl.name;
  }
  return rank;
}

export default function LoginDropdown() {
  const { currentUser, login, logout } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [charData, setCharData] = useState(null);
  const dropdownRef = useRef(null);

  const isMaster = currentUser?.email === MASTER_EMAIL;

  // Chiusura animata: avvia l'animazione di "ri-arrotolamento" e poi smonta il pannello.
  const closePanel = () => {
    setIsClosing(true);
    setTimeout(() => { setIsClosing(false); setIsOpen(false); }, 240);
  };
  const togglePanel = () => { if (isOpen) closePanel(); else setIsOpen(true); };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (isOpen) closePanel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubChar = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
      if (snap.exists()) setCharData(snap.data());
    });

    const qNotify = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("read", "==", false)
    );
    const unsubNotify = onSnapshot(qNotify, (snap) => {
      setUnreadCount(snap.docs.length);
    });

    return () => { unsubChar(); unsubNotify(); };
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      setIsOpen(false);
      setEmail("");
      setPassword("");
    } catch {
      setError("Credenziali non valide.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
      navigate("/");
    } catch (err) {
      console.error("Errore logout:", err);
    }
  };

  const rattoRank = getRattoRank(charData?.rattoPoints ?? 0);

  // --- NON LOGGATO ---
  if (!currentUser) {
    return (
      <div className="ld-container" ref={dropdownRef}>
        <button onClick={togglePanel} className="ld-login-btn">
          Accedi
        </button>
        {(isOpen || isClosing) && (
          <div className={`ld-panel ld-panel--login${isClosing ? " ld-panel--closing" : ""}`}>
            {error && <p className="ld-error">{error}</p>}
            <form onSubmit={handleLogin} className="ld-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="ld-input"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="ld-input"
              />
              <button type="submit" className="ld-submit-btn">Entra</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --- LOGGATO ---
  return (
    <div className="ld-container" ref={dropdownRef}>
      <button className="ld-avatar-btn" onClick={togglePanel}>
        <img
          src={charData?.image || "/assets/player/default.png"}
          alt="Avatar"
          className={`ld-avatar ${unreadCount > 0 ? "ld-avatar--notify" : ""}`}
        />
        {unreadCount > 0 && (
          <span className="ld-badge">{unreadCount}</span>
        )}
      </button>

      {(isOpen || isClosing) && (
        <div className={`ld-panel ld-panel--user${isClosing ? " ld-panel--closing" : ""}`}>
          {/* Header personaggio */}
          <div className="ld-char-header">
            <img
              src={charData?.image || "/assets/player/default.png"}
              alt="Avatar"
              className="ld-char-avatar"
            />
            <div className="ld-char-info">
              <p className="ld-char-name">{charData?.name || currentUser.email}</p>
              <p className="ld-char-email">{currentUser.email}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="ld-stats-row">
            <div className="ld-stat">
              <span className="ld-stat-icon">💰</span>
              <span className="ld-stat-value">{charData?.platinum ?? charData?.money ?? 0}</span>
              <span className="ld-stat-label">Corone</span>
            </div>
            <div className="ld-stat-divider" />
            <div className="ld-stat">
              <span className="ld-stat-icon">🐀</span>
              <span className="ld-stat-value ld-stat-value--ratto">{rattoRank}</span>
            </div>
          </div>

          <div className="ld-divider" />

          <button
            className="ld-menu-item"
            onClick={() => { navigate("/notifications"); setIsOpen(false); }}
          >
            <span>🔔 Notifiche</span>
            {unreadCount > 0 && <span className="ld-inline-badge">{unreadCount}</span>}
          </button>

          <button
            className="ld-menu-item"
            onClick={() => { navigate("/my-pg"); setIsOpen(false); }}
          >
            📜 Scheda Personaggio
          </button>

          {isMaster && (
            <>
              <div className="ld-divider" />
              <p className="ld-section-label">Master Panel</p>
              <button
                className="ld-menu-item ld-menu-item--gold"
                onClick={() => { navigate("/dm-admin"); setIsOpen(false); }}
              >
                ⚙️ Gestione Mondo
              </button>
            </>
          )}

          <div className="ld-divider" />
          <button onClick={handleLogout} className="ld-menu-item ld-menu-item--logout">
            Esci
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## AuthContext (provider che avvolge tutta la shell)
- Path: `src/AuthContext.jsx`

```jsx
// src/AuthContext.jsx

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ensureBaseCharacter } from './utils/ensureBaseCharacter';

// Struttura del contesto per il valore iniziale e per evitare errori di tipizzazione
const initialContextValue = {
    currentUser: null,
    login: () => null,
    logout: () => null,
};

// Crea il contesto
const AuthContext = createContext(initialContextValue);

// Hook personalizzato per accedere al contesto (useAuth)
// Questo è il codice corretto che stavi cercando di dichiarare:
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Funzione per il login con email e password
  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Funzione per il logout
  const logout = () => {
    return signOut(auth);
  };

  // Ascolta i cambiamenti di stato (quando l'utente si logga o slogga)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      setLoading(false);
      // Player senza PG → assegna una volta sola il guerriero base (Lv4).
      if (user) ensureBaseCharacter(user);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};
```

---

## GlobalChat (chat flottante "Locanda di Exanthia")
- Path: `src/components/GlobalChat.jsx`
- FAB 💬 in basso a destra + finestra chat realtime su Firestore `global_chat`. NOTA: al momento NON è montato in `App.jsx` (nessun import attivo) — il CSS del dock in `layout.css` (`.chat-toggle-btn`, `.global-chat-window`) resta pronto.

```jsx
import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  serverTimestamp, doc, getDoc, getDocs, deleteDoc
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function GlobalChat() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [charName, setCharName] = useState("Eroe");

  const chatEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatWindowRef = useRef(null);
  const isOpenRef = useRef(false);
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const scrollToBottom = (behavior = "smooth") => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // keep isOpenRef in sync with state (so the snapshot callback can read it without re-subscribing)
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => scrollToBottom("instant"), 50);
    }
  }, [isOpen]);

  // chiusura al click esterno
  useEffect(() => {
    function handleClickOutside(event) {
      if (chatWindowRef.current && !chatWindowRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // nome personaggio
  useEffect(() => {
    if (!currentUser || isMaster) return;
    getDoc(doc(db, "characters", currentUser.uid))
      .then(snap => { if (snap.exists()) setCharName(snap.data().name); })
      .catch(() => {});
  }, [currentUser, isMaster]);

  // listener messaggi — dipende solo da currentUser, non da isOpen
  useEffect(() => {
    if (!currentUser) return;
    let initialLoad = true;

    // desc + slice→reverse: prendiamo gli ULTIMI 50 messaggi (non i primi 50 della cronologia totale).
    // Con asc+limit(50) i nuovi messaggi cadevano oltre la finestra e non comparivano mai.
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        setMessages(msgs);

        if (initialLoad) {
          initialLoad = false;
          return;
        }

        if (!isOpenRef.current) {
          setUnreadCount(prev => prev + 1);
        } else {
          const container = messagesContainerRef.current;
          if (container) {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
            if (isAtBottom) scrollToBottom("smooth");
          }
        }
      },
      (err) => { console.error("Global chat listener error:", err); }
    );
    return () => unsub();
  }, [currentUser]);

  // pulizia massiva
  const handleManualCleanup = async () => {
    if (!window.confirm("Vuoi ripulire la locanda? (Resteranno i 10 più recenti)")) return;
    try {
      const snap = await getDocs(query(collection(db, "global_chat"), orderBy("timestamp", "desc")));
      if (snap.size > 10) {
        await Promise.all(snap.docs.slice(10).map(d => deleteDoc(doc(db, "global_chat", d.id))));
      }
    } catch (err) { console.error("Cleanup error:", err); }
  };

  const deleteSingleMessage = async (messageId) => {
    if (!window.confirm("Vuoi eliminare questo messaggio?")) return;
    await deleteDoc(doc(db, "global_chat", messageId)).catch(console.error);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, "global_chat"), {
        uid: currentUser.uid,
        displayName: isMaster ? "Il Master" : charName,
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      setText("");
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err) { console.error("Send error:", err); }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const d = ts.toDate();
    return `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  };

  if (!currentUser) return null;

  return (
    <div ref={chatWindowRef}>
      {/* Toggle button */}
      <button className={`chat-toggle-btn ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(v => !v)}>
        {isOpen ? "✕" : "💬"}
        {unreadCount > 0 && !isOpen && (
          <span className="chat-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {/* Chat window */}
      <div className={`global-chat-window ${isOpen ? "visible" : ""}`}>
        <div className="chat-header">
          <span className="chat-header-title">Locanda di Exanthia</span>
          {isMaster && (
            <button className="master-cleanup-btn" onClick={handleManualCleanup} title="Ripulisci chat">🗑</button>
          )}
        </div>

        <div className="chat-messages" ref={messagesContainerRef}>
          {messages.map((m) => {
            const isOwn = m.uid === currentUser.uid;
            const isMasterMsg = m.displayName === "Il Master";
            return (
              <div key={m.id} className={`chat-msg ${isOwn ? "own" : ""} ${isMasterMsg ? "master-msg" : ""}`}>
                <div className="msg-meta">
                  <span className="msg-user">{m.displayName}</span>
                  {m.timestamp && <span className="msg-timestamp">{formatTimestamp(m.timestamp)}</span>}
                  {(isMaster || m.uid === currentUser.uid) && (
                    <span className="msg-delete" onClick={() => deleteSingleMessage(m.id)} title="Elimina">✕</span>
                  )}
                </div>
                <p className="msg-text">{m.text}</p>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-area">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isMaster ? "Parla come Master…" : `Parla come ${charName}…`}
            className="chat-input"
          />
          <button type="submit" className="chat-send-btn">Invia</button>
        </form>
      </div>
    </div>
  );
}
```

---

## NotificationOptIn (headless, montato in App)
- Path: `src/components/NotificationOptIn.jsx`
- Non renderizza nulla: chiede il permesso notifiche e registra il token FCM su `characters/{uid}.fcmTokens`.

```jsx
import { useEffect, useRef } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, getMessagingIfSupported, VAPID_KEY } from "../firebase";
import { useAuth } from "../AuthContext";

/**
 * Auto-prompts the logged-in user for notification permission and
 * registers their FCM token to characters/{uid}.fcmTokens.
 * Renders nothing.
 */
export default function NotificationOptIn() {
  const { currentUser } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    if (triedRef.current) return;
    triedRef.current = true;

    (async () => {
      if (!("Notification" in window)) return;
      if (!VAPID_KEY) {
        console.warn("[fcm] VITE_FIREBASE_VAPID_KEY missing in env");
        return;
      }

      const messaging = await getMessagingIfSupported();
      if (!messaging) return;

      // Auto-prompt if status is "default" (never asked).
      let perm = Notification.permission;
      if (perm === "default") {
        try { perm = await Notification.requestPermission(); }
        catch { return; }
      }
      if (perm !== "granted") return;

      try {
        const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!token) return;

        // Save token on the character doc (array — supports multiple devices).
        await updateDoc(doc(db, "characters", currentUser.uid), {
          fcmTokens: arrayUnion(token),
        }).catch(async () => {
          // Doc might not exist; create minimal stub
          const { setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, "characters", currentUser.uid), { fcmTokens: [token] }, { merge: true });
        });

        // Foreground messages — show a small in-page toast via the SW so
        // the OS notification is consistent whether app is open or not.
        onMessage(messaging, (payload) => {
          const title = payload?.notification?.title || payload?.data?.title || "Crit Happens";
          const body  = payload?.notification?.body  || payload?.data?.body  || "";
          const url   = payload?.data?.url || "/";
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body,
              icon: "/logo192.png",
              badge: "/logo192.png",
              data: { url },
            });
          }
        });
      } catch (err) {
        console.warn("[fcm] setup failed:", err);
      }
    })();
  }, [currentUser?.uid]);

  return null;
}
```

---

## FirestoreErrorGuard (banner fisso bottom-right, montato in App)
- Path: `src/components/FirestoreErrorGuard.jsx`
- Intercetta le assertion interne dell'SDK Firestore e mostra un banner "Ricarica pagina" con stile inline pergamena.

```jsx
import React, { useState, useEffect } from "react";

/* ============================================================
   FirestoreErrorGuard — silent listener that catches Firestore
   "INTERNAL ASSERTION FAILED" errors (b815, ca9, etc.). These
   are SDK state-machine glitches caused by StrictMode + HMR or
   rapid concurrent writes; they don't actually break Firestore
   writes (which already went through), but they do bubble up
   as window.alert in some browsers.

   When detected, suppresses the alert and shows a small banner
   asking the user to reload — which fully resets SDK state.
   ============================================================ */

const ASSERTION_RE = /INTERNAL ASSERTION FAILED|Unexpected state \(ID: [a-z0-9]+\)/i;

export default function FirestoreErrorGuard() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onError = (event) => {
      const msg = event?.error?.message || event?.message || "";
      const reasonMsg = event?.reason?.message || "";
      if (ASSERTION_RE.test(msg) || ASSERTION_RE.test(reasonMsg)) {
        // Prevent the default alert/log noise but keep the console trace.
        if (typeof event.preventDefault === "function") event.preventDefault();
        console.warn("[FirestoreErrorGuard] suppressed Firestore SDK assertion. The write probably went through; SDK state is wedged. Reload recommended.");
        setShown(true);
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);

  if (!shown) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 16, right: 16,
      zIndex: 99999,
      maxWidth: 360,
      background: "#fffdf6",
      border: "2px solid #c9a961",
      borderRadius: 12,
      boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
      padding: "14px 16px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "#2d2418",
      animation: "firestoreGuardIn 0.25s ease-out",
    }}>
      <style>{`@keyframes firestoreGuardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: "1.2rem" }}>⚠</span>
        <strong style={{ color: "#7d2929", letterSpacing: "0.04em" }}>Firestore: stato bloccato</strong>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: "0.84rem", lineHeight: 1.45, color: "#6f6453" }}>
        I dati sono stati salvati correttamente, ma l'SDK ha bisogno di un refresh per riprendersi.
        Ricarica la pagina per continuare.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(180deg, #b91c1c, #7d2929)",
            color: "#fdf2dc",
            border: "1.5px solid #5a1818",
            borderRadius: 8,
            padding: "7px 14px",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.84rem",
          }}
        >
          🔄 Ricarica pagina
        </button>
        <button
          onClick={() => setShown(false)}
          style={{
            background: "transparent",
            color: "#6f6453",
            border: "1.5px solid #e0cf9d",
            borderRadius: 8,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: "0.84rem",
          }}
        >
          Ignora
        </button>
      </div>
    </div>
  );
}
```
