import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./WorldMap.css";
import TimerDisplay from "../components/TimerDisplay";
import { useAuth } from "../AuthContext";

// --- CONFIGURAZIONE COORDINATE CITTA' ---
const CITIES_HUB = [
  { name: "Tirrendale", x: 50.55, y: 62.23 },
  { name: "Helmvil", x: 53.87, y: 37.42 },
  { name: "Yotta", x: 26.44, y: 31.82 },
  { name: "Foresta del Tiglio Bianco", x: 23.40, y: 43.20 },
  { name: "Castello Dorato", x: 67.53, y: 20.68 },
  { name: "Gossvill", x: 86.37, y: 31.81 },
  { name: "Clan dei Senza Onore", x: 26.82, y: 75.41 },
  { name: "Clan dei Demoni Grigi", x: 44.32, y: 44.38 },
  { name: "Nerocastello", x: 11.41, y: 35.18 },
  { name: "Thenduin Village", x: 92.45, y: 30.12 },
  { name: "Monaci delle Sabbie", x: 91.69, y: 41.26 },
  { name: "Torre dell'Arcano", x: 72.29, y: 21.02 },
  { name: "Tassio", x: 60.88, y: 53.40 },
  { name: "Hopeclif", x: 74.38, y: 64.79 }
];

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function WorldMap() {
  const [activeBosses, setActiveBosses] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [selectedNpc, setSelectedNpc] = useState(null); // Stato per l'NPC espanso
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    // Listener Boss attivi
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) => {
      setActiveBosses(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((b) => b.isActive && b.hp > 0)
      );
    });

    // Listener NPC
    const unsubNpc = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBoss();
      unsubNpc();
    };
  }, []);

  // Funzione per gestire l'apertura del dettaglio NPC
  const handleNpcClick = (e, npc) => {
    e.stopPropagation();
    setSelectedNpc(npc);
  };

  return (
    <div className="map-page">
      <h1 className="gold-text" style={{ textAlign: "center" }}>
        Mappa delle Minacce di Eldoria
      </h1>

      <div className="map-container">
        <img src="/assets/Eldoria.jpg" className="world-map-img" alt="Mappa Mondo" />

        {/* 1. RENDER BOSS (Ping Rossi) */}
        {activeBosses.map((boss) => (
          <div key={boss.id} className="boss-anchor" style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}>
            <div className="ping-visual"></div>
            <div className="ping-tooltip">
              <div className="tooltip-image-container">
                <img src={boss.imageUrl} alt={boss.name} />
              </div>
              <div className="tooltip-content">
                <h3>{boss.name}</h3>
                <span className="gs-badge">GS {boss.gradoSfida || "??"}</span>
                {boss.rewards && (
                  <div className="map-reward-box">
                    <span className="reward-label">🎁 RICOMPENSA</span>
                    <p className="reward-text">{boss.rewards}</p>
                  </div>
                )}
                <div className="mini-timer">⏳ <TimerDisplay expiryDate={boss.expiryDate} /></div>
                <div className="hp-container-mini">
                  <div className="hp-bar-fill-mini" style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}></div>
                </div>
                <div className="hp-info">{isMaster ? `❤️ ${boss.hp}/${boss.maxHp}` : "❤️ Stato Salute"}</div>
                <button className="btn-go-fight" onClick={() => navigate("/world-boss-fight")}>⚔️ COMBATTI</button>
              </div>
            </div>
          </div>
        ))}

        {/* 2. RENDER CITTA' HUB (Ping raggruppati) */}
        {CITIES_HUB.map((city) => {
          const localNpcs = npcs.filter((n) => n.linkedCity === city.name);
          if (localNpcs.length === 0) return null;

          return (
            <div key={city.name} className="city-anchor" style={{ left: `${city.x}%`, top: `${city.y}%` }}>
              <div className="city-ping">
                <span className="city-count">{localNpcs.length}</span>
              </div>
              <div className="city-tooltip">
                <h4 className="city-title">{city.name}</h4>
                <div className="npc-scroll-list">
                  {localNpcs.map((npc) => (
                    <div 
                      key={npc.id} 
                      className="npc-mini-card" 
                      onClick={(e) => handleNpcClick(e, npc)}
                    >
                      <img src={npc.image || "/assets/player/default.png"} alt={npc.name} />
                      <div className="npc-mini-info">
                        <strong>{npc.name}</strong>
                        <span>{npc.faction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. RENDER NPC LIBERI (Ping Gialli individuali) */}
        {npcs
          .filter((n) => !n.linkedCity && n.mapX && n.mapY)
          .map((npc) => (
            <div 
              key={npc.id} 
              className="npc-anchor" 
              style={{ left: `${npc.mapX}%`, top: `${npc.mapY}%` }}
              onClick={(e) => handleNpcClick(e, npc)}
            >
              <div className="npc-ping-visual"></div>
              <div className="ping-tooltip npc-tooltip">
                <div className="tooltip-image-container">
                  <img src={npc.image || "/assets/player/default.png"} alt={npc.name} />
                </div>
                <div className="tooltip-content">
                  <h3>{npc.name}</h3>
                  <span className="faction-badge">{npc.faction}</span>
                  <p className="npc-loc-text">📍 {npc.location}</p>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* MODAL DETTAGLIO NPC (ESPANSIONE) */}
      {selectedNpc && (
        <div className="npc-expanded-overlay" onClick={() => setSelectedNpc(null)}>
          <div className="npc-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedNpc(null)}>×</button>
            <div className="modal-header">
              <img src={selectedNpc.image || "/assets/player/default.png"} alt={selectedNpc.name} />
              <div className="header-text">
                <h2>{selectedNpc.name}</h2>
                <span className="faction-tag">{selectedNpc.faction}</span>
                <p className="loc-tag">📍 {selectedNpc.location}</p>
              </div>
            </div>
            <div className="modal-body">
              <h4>Biografia e Note</h4>
              <p>{selectedNpc.description || "Nessuna informazione aggiuntiva disponibile."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}