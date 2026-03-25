import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./WorldMap.css";
import TimerDisplay from "../components/TimerDisplay";
import { useAuth } from "../AuthContext"; // Importiamo l'auth per distinguere Master/Player

export default function WorldMap() {
  const [activeBosses, setActiveBosses] = useState([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const MASTER_EMAIL = "santomassimo85@gmail.com";
  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
  const unsub = onSnapshot(collection(db, "bosses"), (snap) => {
    const bosses = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((b) => 
        b.isActive === true && 
        b.hp > 0 // <--- AGGIUNGI QUESTO: Nasconde il boss dalla mappa se HP <= 0
      ); 
    setActiveBosses(bosses);
  });
  return () => unsub();
}, []);

  return (
    <div className="map-page">
      <h1 className="gold-text" style={{ textAlign: "center" }}>
        Mappa delle Minacce di Eldoria
      </h1>

      <div className="map-container">
        <img
          src="/assets/Eldoria.jpg"
          className="world-map-img"
          alt="Mappa Mondo"
        />

        {activeBosses.map((boss) => (
          <div
            key={boss.id}
            className="boss-anchor"
            style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}
          >
            {/* Cerchio che pulsa */}
            <div className="ping-visual"></div>

            {/* Pop-up Info Boss */}
            <div className="ping-tooltip">
              <div className="tooltip-image-container">
                <img src={boss.imageUrl} alt={boss.name} />
              </div>

              <div className="tooltip-content">
                <h3>{boss.name}</h3>
                
                <span className="gs-badge">
                  Grado Sfida {boss.gradoSfida || "??"}
                </span>

                {/* RICOMPENSE - Giallo Glow */}
                {boss.rewards && (
                  <div className="map-reward-box">
                    <span className="reward-label">🎁 RICOMPENSA</span>
                    <p className="reward-text">{boss.rewards}</p>
                  </div>
                )}

                <div className="mini-timer" >
                  ⏳ <TimerDisplay expiryDate={boss.expiryDate} />
                </div>

                {/* Barra HP */}
                <div className="hp-container-mini">
                  <div
                    className="hp-bar-fill-mini"
                    style={{
                      width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                    }}
                  ></div>
                </div>

                {/* Info HP: Solo il Master vede i numeri esatti */}
                <div className="hp-info">
                  {isMaster ? (
                    <>❤️ {boss.hp} / {boss.maxHp}</>
                  ) : (
                    <>❤️ Stato Salute</>
                  )}
                </div>

                <button
                  className="btn-go-fight"
                  onClick={() => navigate("/world-boss-fight")}
                >
                  ⚔️ COMBATTI
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}