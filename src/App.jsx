import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Party from "./pages/Party";
import Riassunti from "./pages/Riassunti";
import Mercato from "./pages/Mercato";
import Geo from "./pages/Geo";
import ItemDetail from "./pages/ItemDetail";
import AdminPanel from "./pages/AdminPanel"; // Dashboard Admin
import MarketAdmin from "./pages/MarketAdmin"; // Gestione Item (CRUD)
import SummaryAdmin from "./pages/SummaryAdmin"; // Gestione Riassunti (CRUD)
import PgSheetEditor from "./pages/PgSheetEditor"; 
import PlatinumAdmin from "./pages/PlatinumAdmin"; 
import RattiLore from "./pages/RattiLore";

import "./style.css";

// UTH IMPORTS
import { AuthProvider, useAuth } from "./AuthContext";
import LoginDropdown from "./LoginDropdown";

// VARIABILE MASTER DEFINITA PER IL CONTROLLO DELLA UI
const MASTER_EMAIL_UI = "santomassimo85@gmail.com";

// --- Componente per la Navigazione Master Condizionale ---
const AuthChecker = ({ closeMenu }) => {
  const { currentUser } = useAuth();

  // Mostra il link solo se l'utente corrente è il Master
  if (currentUser && currentUser.email === MASTER_EMAIL_UI) {
    return (
      <NavLink
        to="/dm-admin"
        className={({ isActive }) =>
          isActive ? "active admin-link" : "admin-link"
        }
        onClick={closeMenu}
        style={{
          backgroundColor: "var(--gold)",
          color: "var(--red)",
          fontWeight: "bold",
        }}
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

  return (
    <AuthProvider>
      {/* HEADER */}
      <header>
        <div className="logo">
          E L D O R I A <br />
          <span>Chronicles</span>
        </div>

        {/* Burger button */}
        <div
          className={`burger ${menuOpen ? "open" : ""}`}
          onClick={() => {
            toggleMenu();
          }}
          aria-label="Apri menu"
        >
          {/* NUOVA STRUTTURA SEMPLICE: Tre linee <span> */}
          <span className="line line-1"></span>
          <span className="line line-2"></span>
          <span className="line line-3"></span>
        </div>

        
        <nav className={menuOpen ? "active" : ""}>
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "active disabled" : "")}
            onClick={closeMenu}
          >
            Home
          </NavLink>

          <NavLink
            to="/party"
            className={({ isActive }) => (isActive ? "active disabled" : "")}
            onClick={closeMenu}
          >
            Party
          </NavLink>
          <NavLink
            to="/Geo"
            className={({ isActive }) => (isActive ? "active disabled" : "")}
            onClick={closeMenu}
          >
            Archivio Geomatico
          </NavLink>
          <NavLink
            to="/riassunti"
            className={({ isActive }) => (isActive ? "active disabled" : "")}
            onClick={closeMenu}
          >
            Riassunti sessioni
          </NavLink>

          <NavLink
            to="/mercato"
            className={({ isActive }) => (isActive ? "active disabled" : "")}
            onClick={closeMenu}
          >
            Mercato nero
          </NavLink>

          <NavLink 
  to="/ratti-lore" 
  className={({ isActive }) => (isActive ? "active" : "")}
  onClick={closeMenu}
>
  Gilda dei Ratti
</NavLink>

          {/* LINK ADMIN CONDIZIONALE E LOGIN DROPDOWN */}
          <AuthChecker closeMenu={closeMenu} />
          <LoginDropdown closeMenu={closeMenu} />
        </nav>
      </header>

      {/* CONTENUTO */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
          <Route path="/Geo" element={<Geo />} />
          <Route path="/riassunti" element={<Riassunti />} />

          {/* ROTTA SCHEDA PERSONAGGIO */}
<Route path="/my-pg" element={<PgSheetEditor />} />
          {/* ROTTE MERCATO */}
          <Route path="/mercato" element={<Mercato />} />
          <Route path="/mercato/:id" element={<ItemDetail />} />

          {/* ROTTE ADMIN PANEL */}
<Route path="/dm-admin" element={<AdminPanel />} /> 
<Route path="/dm-admin/market" element={<MarketAdmin />} /> 
<Route path="/dm-admin/market/edit/:id" element={<MarketAdmin />} />
<Route path="/dm-admin/summaries" element={<SummaryAdmin />} />
<Route path="/dm-admin/platinum" element={<PlatinumAdmin />} />
<Route path="/ratti-lore" element={<RattiLore />} />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer>
        <p>
          © {new Date().getFullYear()}{" "}
          <strong>
            <a href="https://designbyorpheus.it/">OrpheusDesign</a>
          </strong>
        </p>
      </footer>
    </AuthProvider>
  );
}
