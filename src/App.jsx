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

// PAGES

import Home from "./pages/Home";
import Party from "./pages/Party";
import Notifications from "./pages/Notifications";
import Riassunti from "./pages/Riassunti";
import Mercato from "./pages/Mercato";
import Geo from "./pages/Geo";
import ItemDetail from "./pages/ItemDetail";
import AdminPanel from "./pages/AdminPanel";
import MarketAdmin from "./pages/MarketAdmin";
import SummaryAdmin from "./pages/SummaryAdmin";
import PgSheetEditor from "./pages/PgSheetEditor";
import PlatinumAdmin from "./pages/PlatinumAdmin";
import RattiLore from "./pages/RattiLore";
import Bacheca from "./pages/Bacheca";
import QuestAdmin from "./pages/QuestAdmin";
import QuestDetail from "./pages/QuestDetail";
import ReputationAdmin from "./pages/ReputazioneAdmin";
import VideoAdmin from "./pages/VideoAdmin";
import Cinema from "./pages/Cinema";
import GeoAdmin from "./pages/GeoAdmin";
import WorldMap from "./pages/WorldMap";
import AdminSessions from "./pages/AdminSessions";
import WorldBoss from "./pages/WorldBoss";
import WorldBossAdmin from "./pages/WorldBossAdmin";
import Arena from "./pages/Arena";
import ArenaMarket from "./pages/ArenaMarket";
import BossTactics from "./pages/tactics/BossTactics";
import BattleMapEditor from "./pages/tactics/BattleMapEditor";
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
import Feedback from "./pages/Feedback";
import Updates from "./pages/Updates";
import GlobalChat from "./components/GlobalChat"; // Importa il nuovo componente
import SendNotification from "./components/SendNotification";
import NotificationOptIn from "./components/NotificationOptIn";
import FirestoreErrorGuard from "./components/FirestoreErrorGuard";
import PlayerSpritesAdmin from "./pages/PlayerSpritesAdmin";
import DiceRollHost from "./components/DiceRoll";

// CONFIG
const MASTER_EMAIL_UI = "santomassimo85@gmail.com";
const APP_VERSION = "2.2.1"; // <--- CAMBIA QUESTO NUMERO PER FORZARE IL REFRESH GLOBALE

// --- Dropdown menu component ---
function NavDropdown({ label, children, closeAll }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChildClick = () => {
    setOpen(false);
    closeAll();
  };

  return (
    <div className={`nav-dd${open ? " nav-dd--open" : ""}`} ref={ref}>
      <button
        className="nav-dd-trigger"
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

// --- Componente Link Admin Condizionale ---
const AdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email === MASTER_EMAIL_UI) {
    return (
      <NavLink
        to="/dm-admin"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={{ backgroundColor: "var(--gold)", color: "var(--red)", fontWeight: "bold" }}
      >
        DM ADMIN
      </NavLink>
    );
  }
  return null;
};

// --- Link dedicato al solo collaboratore dei riassunti (non vede il resto del pannello DM) ---
const SUMMARY_EDITOR_EMAIL = "ripperti96@gmail.com";
const SummaryAdminNavLink = ({ closeMenu }) => {
  const { currentUser } = useAuth();
  if (currentUser?.email === SUMMARY_EDITOR_EMAIL) {
    return (
      <NavLink
        to="/dm-admin/summaries"
        className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}
        onClick={closeMenu}
        style={{ backgroundColor: "var(--gold)", color: "var(--red)", fontWeight: "bold" }}
      >
        RIASSUNTI
      </NavLink>
    );
  }
  return null;
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
  const location = useLocation();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  // Fullscreen battle pages hide the top nav to give the fight more room.
  const FULLSCREEN_ROUTES = ["/boss-tactics", "/world-boss-fight", "/dm-admin/battle-maps"];
  const hideChrome = FULLSCREEN_ROUTES.includes(location.pathname);
  // Nella pagina Arena (e sottosezioni: fight, tabellone, ecc.) nascondi la chat globale.
  const isArenaPage = location.pathname.startsWith("/arena");
  // Reset the temporary "reveal nav" whenever the route changes.
  useEffect(() => { setForceShowNav(false); }, [location.pathname]);

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
        <NavLink to="/" className="logo" onClick={closeMenu} aria-label="Crit Happens — Home">
          <img src="/assets/CritHappensLOGO.png" alt="" className="logo-img" />
          <span className="logo-wordmark">
            <span className="logo-word logo-word--crit">Crit</span>
            <span className="logo-word logo-word--happens">Happens</span>
          </span>
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

        <nav className={menuOpen ? "active" : ""}>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/updates" onClick={closeMenu}>UPDATE</NavLink>

          <NavDropdown label="Mondo" closeAll={closeMenu}>
            <NavLink to="/world-map">Mappa</NavLink>
            <NavLink to="/Geo">Archivio Geomatico</NavLink>
          </NavDropdown>

          <NavDropdown label="Eroi" closeAll={closeMenu}>
            <NavLink to="/party">Party</NavLink>
            <NavLink to="/npc">NPC</NavLink>
            <NavLink to="/riassunti">Riassunti</NavLink>
          </NavDropdown>

          <NavDropdown label="Gilda" closeAll={closeMenu}>
            <NavLink to="/mercato">Mercato Nero</NavLink>
            <MasterPricingLink closeMenu={closeMenu} />
            <NavLink to="/bacheca">Bacheca</NavLink>
            <NavLink to="/crafting">Crafting</NavLink>
            <NavLink to="/ratti-lore">Gilda dei Ratti</NavLink>
            <NavLink to="/cinema">Cinema</NavLink>
            <NavLink to="/feedback">💬 Feedback</NavLink>
          </NavDropdown>

          <NavDropdown label="Battaglia" closeAll={closeMenu}>
            <NavLink to="/arena">Arena</NavLink>
            <NavLink to="/arena-bottega">Bottega Arena</NavLink>
            {/* <NavLink to="/pet">Pet Hub</NavLink> */}
            <TcgNavLink />
            <NavLink to="/world-boss-fight">World Fight</NavLink>
          </NavDropdown>

          <AdminNavLink closeMenu={closeMenu} />
          <SummaryAdminNavLink closeMenu={closeMenu} />
        </nav>
      </header>
      )}

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
          <Route path="/npc" element={<NPC />} />
          <Route path="/world-map" element={<WorldMap />} />
          <Route path="/Geo" element={<Geo />} />
          <Route path="/riassunti" element={<Riassunti />} />
          <Route path="/ratti-lore" element={<RattiLore />} />
          <Route path="/bacheca" element={<Bacheca />} />
          <Route path="/quest/:id" element={<QuestDetail />} />
          <Route path="/cinema" element={<Cinema />} />
          <Route path="/my-pg" element={<PgSheetEditor />} />
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
          <Route path="/dm-admin" element={<AdminPanel />} />
          <Route path="/dm-admin/world-boss" element={<WorldBossAdmin />} />
          <Route path="/dm-admin/quests" element={<QuestAdmin />} />
          <Route path="/dm-admin/market" element={<MarketAdmin />} />
          <Route path="/dm-admin/sessions" element={<AdminSessions />} />
          <Route path="/dm-admin/videos" element={<VideoAdmin />} />
          <Route path="/dm-admin/summaries" element={<SummaryAdmin />} />
          <Route path="/dm-admin/platinum" element={<PlatinumAdmin />} />
          <Route path="/dm-admin/pet-points" element={<PetPointsAdmin />} />
          <Route path="/dm-admin/reputation" element={<ReputationAdmin />} />
          <Route path="/dm-admin/geo" element={<GeoAdmin />} />
          <Route path="/dm-admin/send-notif" element={<SendNotification />} />
          <Route path="/dm-admin/player-sprites" element={<PlayerSpritesAdmin />} />
          <Route path="/dm-admin/battle-maps" element={<BattleMapEditor />} />
        </Routes>
      </main>

{!hideChrome && !isArenaPage && <GlobalChat />}
      <DiceRollHost />
      {!hideChrome && <OnlinePresence />}
      <FirestoreErrorGuard />

      <footer>
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