import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Party from "./pages/Party";
import Riassunti from "./pages/Riassunti";
import Mercato from "./pages/Mercato";
import "./style.css";

function SwordIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {/* lama */}
      <rect x="29" y="5" width="6" height="40" fill="#d4af37" />
      {/* punta */}
      <polygon points="32 2 28 10 36 10" fill="#d4af37" />
      {/* guardia */}
      <rect x="24" y="40" width="16" height="4" fill="#7a0e0e" />
      {/* impugnatura */}
      <rect x="28" y="44" width="8" height="12" fill="#7a0e0e" />
    </svg>
  );
}


export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* HEADER */}
      <header>
<div className="logo">E L D O R I A <br />
 <span>Chronicles</span></div>

        {/* Burger button */}
      <div
  className={`burger ${menuOpen ? "open" : ""}`}
  onClick={() => {
    toggleMenu();
   
  }}
  aria-label="Apri menu"
>
  <img
    src={menuOpen ? "/assets/blood.svg" : "/assets/sword2.svg"}
    alt="spada"
    className="sword sword-1"
  />
  {/* <img
    src="/assets/swor.svg"
    alt="spada"
    className="sword sword-2"
  />
  <img
    src="/assets/swor.svg"
    alt="spada"
    className="sword sword-3"
  /> */}
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
          © {new Date().getFullYear()} <strong><a href="https://designbyorpheus.it/">OrpheusDesign</a></strong>
        </p>
      </footer>
    </>
  );
}
