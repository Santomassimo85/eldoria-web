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
              <span className="ld-stat-label">MP</span>
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
