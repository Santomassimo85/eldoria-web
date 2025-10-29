import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Party from "./pages/Party";
import Riassunti from "./pages/Riassunti";
import Mercato from "./pages/Mercato";
import Geo from "./pages/geo";
// import { Analytics } from "@vercel/analytics/next"
import "./style.css";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
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
          <img
            src={menuOpen ? "/assets/blood.svg" : "/assets/sword2.svg"}
            alt="spada"
            className="sword sword-1"
          />
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
            to="/geo"
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
        </nav>
      </header>

      {/* CONTENUTO */}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/party" element={<Party />} />
          <Route path="/geo" element={<Geo />} />
          <Route path="/riassunti" element={<Riassunti />} />
          <Route path="/mercato" element={<Mercato />} />
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
    </>
  );
}
