import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Party from "./pages/Party";
import Riassunti from "./pages/Riassunti";
import Mercato from "./pages/Mercato";
import "./style.css";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* HEADER */}
      <header>
        <div className="logo">E L D O R I A</div>

        {/* Burger button */}
        <div
          className={`burger ${menuOpen ? "open" : ""}`}
          onClick={toggleMenu}
          aria-label="Apri menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* NAVBAR */}
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
        </nav>
      </header>

      {/* CONTENUTO */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
          <Route path="/riassunti" element={<Riassunti />} />
          <Route path="/mercato" element={<Mercato />} />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer>
        <p>
          Parte del portfolio di <strong>OrpheusDesign</strong>
        </p>
      </footer>
    </>
  );
}
