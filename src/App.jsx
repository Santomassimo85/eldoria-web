import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import "./style.css";

// AUTH & CONTEXT
import { AuthProvider, useAuth } from "./AuthContext";
import LoginDropdown from "./LoginDropdown";

// PAGES
import Home from "./pages/Home";
import Party from "./pages/Party";
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
import GlobalChat from "./components/GlobalChat"; // Importa il nuovo componente


// CONFIG
const MASTER_EMAIL_UI = "santomassimo85@gmail.com";
const APP_VERSION = "2.2.1"; // <--- CAMBIA QUESTO NUMERO PER FORZARE IL REFRESH GLOBALE

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

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

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
      <header>
        <div className="logo">
          E L D O R I A <br />
          <span>Chronicles</span>
        </div>

        <div className={`burger ${menuOpen ? "open" : ""}`} onClick={toggleMenu} aria-label="Apri menu">
          <span className="line line-1"></span>
          <span className="line line-2"></span>
          <span className="line line-3"></span>
        </div>

        <nav className={menuOpen ? "active" : ""}>
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/world-map" onClick={closeMenu}>Mappa</NavLink>
          <NavLink to="/party" onClick={closeMenu}>Party</NavLink>
          <NavLink to="/Geo" onClick={closeMenu}>Archivio Geomatico</NavLink>
          <NavLink to="/riassunti" onClick={closeMenu}>Riassunti</NavLink>
          <NavLink to="/mercato" onClick={closeMenu}>Mercato Nero</NavLink>
          <NavLink to="/arena" onClick={closeMenu}>Arena</NavLink>
          <NavLink to="/world-boss-fight" onClick={closeMenu}>World Fight</NavLink>
          <NavLink to="/bacheca" onClick={closeMenu}>Bacheca</NavLink>
          <NavLink to="/ratti-lore" onClick={closeMenu}>Gilda dei Ratti</NavLink>
          <NavLink to="/cinema" onClick={closeMenu}>Cinema</NavLink>
          
          <AdminNavLink closeMenu={closeMenu} />
          <LoginDropdown closeMenu={closeMenu} />
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
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
          <Route path="/world-boss-fight" element={<WorldBoss />} />

          {/* ROTTE ADMIN */}
          <Route path="/dm-admin" element={<AdminPanel />} />
          <Route path="/dm-admin/world-boss" element={<WorldBossAdmin />} />
          <Route path="/dm-admin/quests" element={<QuestAdmin />} />
          <Route path="/dm-admin/market" element={<MarketAdmin />} />
          <Route path="/dm-admin/sessions" element={<AdminSessions />} />
          <Route path="/dm-admin/videos" element={<VideoAdmin />} />
          <Route path="/dm-admin/summaries" element={<SummaryAdmin />} />
          <Route path="/dm-admin/platinum" element={<PlatinumAdmin />} />
          <Route path="/dm-admin/reputation" element={<ReputationAdmin />} />
          <Route path="/dm-admin/geo" element={<GeoAdmin />} />
        </Routes>
      </main>

<GlobalChat />

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