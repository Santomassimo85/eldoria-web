import React, { useState, useEffect, useRef } from "react";
import { isAdminEmail } from "./utils/roles";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { PET_DEX } from "./data/petDex";
import { classColor, MASTER_COLOR } from "./utils/classColor";
import { LoginTrack } from "./components/LoginRewards";
import { loginState, monthLabel, romeMonthKey } from "./data/loginRewards";
import "./LoginDropdown.css";

// Mascotte del Rifugio dei Pet (2026-10-31): il pet scelto come mascotte
// (characters.petDen.mascot) respira accanto all'avatar. La pixel art sta
// in pet_dex/{specie}; finché non c'è si vede l'emoji.
const mascotArt = {};
function HeaderMascot({ charData, onOpen }) {
  const den = charData?.petDen;
  const pet = den?.mascot ? (den.pets || []).find((p) => p.id === den.mascot) : null;
  const species = pet?.species;
  const [img, setImg] = useState(species ? mascotArt[species] : null);
  useEffect(() => {
    if (!species) return undefined;
    if (mascotArt[species] !== undefined) { setImg(mascotArt[species]); return undefined; }
    let alive = true;
    getDoc(doc(db, "pet_dex", species))
      .then((s) => { mascotArt[species] = s.data()?.image || null; if (alive) setImg(mascotArt[species]); })
      .catch(() => { mascotArt[species] = null; });
    return () => { alive = false; };
  }, [species]);
  if (!pet || !PET_DEX[species]) return null;
  const name = pet.nick || PET_DEX[species].name;
  return (
    <button type="button" className="ld-mascot" onClick={onOpen} title={`${name} · la tua mascotte`} aria-label={`Mascotte: ${name}`}>
      <span className="ld-mascot-breathe">
        {img ? <img src={img} alt="" draggable="false" /> : <span className="ld-mascot-emoji">{PET_DEX[species].icon}</span>}
      </span>
    </button>
  );
}

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
  const [loginOpen, setLoginOpen] = useState(false);
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

  const loginMonth = romeMonthKey();
  const loginInfo = loginState(charData?.loginRewards, loginMonth);
  const rattoRank = getRattoRank(charData?.rattoPoints ?? 0);
  // colore di classe del PG (solo presentazione); il Master veste l'oro chiaro
  const cls = isMaster ? MASTER_COLOR : classColor(charData?.class);

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
    <div className="ld-container" ref={dropdownRef} style={{ "--cls": cls }}>
      <HeaderMascot charData={charData} onOpen={() => navigate("/pet")} />
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
              {(isMaster || charData?.class) && (
                <span className="ld-char-class">{isMaster ? "Master" : charData.class}</span>
              )}
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

          {/* Premi del login quotidiano: quanti login nel mese, premi vinti e mancanti */}
          {!isMaster && (
            <div className="ld-login">
              <button
                type="button"
                className="ld-menu-item ld-login-toggle"
                aria-expanded={loginOpen}
                onClick={() => setLoginOpen((v) => !v)}
              >
                <span>🗓 Login di {monthLabel(loginMonth)}</span>
                <span className="ld-login-count">
                  {loginInfo.count}{loginInfo.next ? ` · prossimo al ${loginInfo.next.n}°` : " · completo"} {loginOpen ? "▴" : "▾"}
                </span>
              </button>
              {loginOpen && (
                <div className="ld-login-body">
                  <LoginTrack compact count={loginInfo.count} month={loginMonth} />
                </div>
              )}
            </div>
          )}

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
            onClick={() => { navigate("/scheda-pg"); setIsOpen(false); }}
          >
            📜 Scheda Personaggio
          </button>

          {/* Resoconto (2026-10-31): login del mese, punti pet e cosa si è già letto. */}
          <button className="ld-menu-item" onClick={() => { navigate("/resoconto"); setIsOpen(false); }}>
            <span>📊 Resoconto · login e letture</span>
            {!isMaster && <span className="ld-login-count">{loginInfo.count} login</span>}
          </button>

          {/* Le pagine "di servizio" stanno qui, non nei gruppi del gioco (2026-10-27). */}
          <button className="ld-menu-item" onClick={() => { navigate("/updates"); setIsOpen(false); }}>
            ✨ Novità del sito
          </button>
          <button className="ld-menu-item" onClick={() => { navigate("/cinema"); setIsOpen(false); }}>
            🎬 Cinema
          </button>
          <button className="ld-menu-item" onClick={() => { navigate("/feedback"); setIsOpen(false); }}>
            💬 Feedback
          </button>

          {isAdminEmail(currentUser?.email) && (
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
