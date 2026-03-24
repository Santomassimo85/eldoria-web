import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";

const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo" },
  { lv: 1, min: 5, name: "Simpatizzante" },
  { lv: 2, min: 15, name: "Informatore" },
  { lv: 3, min: 30, name: "Ricettatore" },
  { lv: 4, min: 50, name: "Veterano" },
  { lv: 5, min: 80, name: "Ombra di Obia" },
];

const getRattoLevel = (points) => {
  return (
    [...RATTO_LEVELS].reverse().find((l) => points >= l.min) || RATTO_LEVELS[0]
  );
};

const LoginDropdown = ({ closeMenu = () => {} }) => {
  const { currentUser, logout, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState(null);

  // Listener unico per i dati del personaggio (Saldo + Rango)
  useEffect(() => {
    if (!currentUser) {
      setUserData(null);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "characters", currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
      },
      (err) => {
        console.error("Errore snapshot Login:", err);
      },
    );

    return () => unsub();
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      login(email, password);
      setIsOpen(false);
      closeMenu();
    } catch {
      setError("Credenziali non valide.");
    }
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    closeMenu();
    navigate("/");
  };

  if (currentUser) {
    const points = userData?.rattoPoints || 0;
    const currentLevel = getRattoLevel(points);

    return (
      <div className="login-dropdown-container">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="logged-user-button nav-button"
        >
          {currentUser.email.split("@")[0]}
          <span className={`dropdown-arrow ${isOpen ? "open" : ""}`}>▼</span>
        </button>

        {isOpen && (
          <div className="dropdown-menu">
            <div className="menu-item-info">
              💰 <strong>Saldo:</strong> {userData?.platinum ?? 0} MP
            </div>
            <div
              className="menu-item-info"
              style={{ fontSize: "0.8rem", color: "var(--gold)" }}
            >
              🐀 <strong>Rango:</strong> {currentLevel.name} (Lv.
              {currentLevel.lv})
            </div>
            <hr className="menu-divider" />
            <button
              onClick={() => {
                navigate("/my-pg");
                setIsOpen(false);
                closeMenu();
              }}
              className="menu-item"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                font: "inherit",
                color: "black",
              }}
            >
              Scheda Personaggio
            </button>
            <a onClick={handleLogout} className="menu-item logout-link">
              Logout
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="login-dropdown-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="login-button nav-button"
      >
        Accedi
      </button>
      {isOpen && (
        <div className="login-dropdown-content">
          {error && <p className="login-error">{error}</p>}
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Entra</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default LoginDropdown;
