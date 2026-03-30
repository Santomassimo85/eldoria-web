import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext"; // Percorso corretto
import { db } from "./firebase"; // Percorso corretto
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc 
} from "firebase/firestore";
import "./LoginDropdown.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function LoginDropdown() {
  const { currentUser, login, logout } = useAuth();
  const navigate = useNavigate();
  
  // Stati per il form e il menu
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // Stati per i dati dinamici
  const [unreadCount, setUnreadCount] = useState(0);
  const [charData, setCharData] = useState(null);
  const dropdownRef = useRef(null);

  const isMaster = currentUser?.email === MASTER_EMAIL;

  // Chiudi il menu se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listener per Notifiche e Dati Personaggio (solo se loggato)
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

    return () => {
      unsubChar();
      unsubNotify();
    };
  }, [currentUser]);

  // Gestione Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      setIsOpen(false);
      setEmail("");
      setPassword("");
    } catch (err) {
      setError("Credenziali non valide.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Errore logout:", error);
    }
  };

  // --- VISTA PER UTENTE NON LOGGATO (FORM A COMPARSA) ---
  if (!currentUser) {
    return (
      <div className="login-dropdown-container" ref={dropdownRef}>
        <button onClick={() => setIsOpen(!isOpen)} className="login-button nav-button">
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
  }

  // --- VISTA PER UTENTE LOGGATO (MENU PERSONAGGIO) ---
  return (
    <div className="login-dropdown-container" ref={dropdownRef}>
      <div className="avatar-trigger" onClick={() => setIsOpen(!isOpen)}>
        <img
          src={charData?.image || "/assets/player/default.png"}
          alt="Avatar"
          className={`nav-avatar ${unreadCount > 0 ? "notify-border" : ""}`}
        />
        {unreadCount > 0 && <span className="global-notify-badge">{unreadCount}</span>}
      </div>

      {isOpen && (
        <div className="login-dropdown-menu">
          <div className="dropdown-header">
            <p className="user-email">{currentUser.email}</p>
            <div className="user-stats-mini">
              <span>💰 {charData?.platinum ?? charData?.money ?? 0} MP</span>
              <span className="ratto-text">🐀 {charData?.rattoName || "Estraneo"}</span>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <button className="menu-item" onClick={() => { navigate("/notifications"); setIsOpen(false); }}>
            📩 Notifiche {unreadCount > 0 && <span className="inline-badge">{unreadCount}</span>}
          </button>

          <button className="menu-item" onClick={() => { navigate("/my-pg"); setIsOpen(false); }}>
            📜 Scheda Personaggio
          </button>

          {isMaster && (
            <>
              <div className="dropdown-divider"></div>
              <p className="admin-label">MASTER PANEL</p>
              <button className="menu-item gold" onClick={() => { navigate("/dm-admin"); setIsOpen(false); }}>
                ⚙️ Gestione Mondo
              </button>
            </>
          )}

          <div className="dropdown-divider"></div>
          <button onClick={handleLogout} className="menu-item logout-btn">🚪 Esci</button>
        </div>
      )}
    </div>
  );
}