import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom"; // Per il salto alla battaglia
import "./WorldMap.css";
import TimerDisplay from "../components/TimerDisplay"; // Importazione del componente TimerDisplay

export default function WorldMap() {
  const [activeBosses, setActiveBosses] = useState([]);
  const navigate = useNavigate();



  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bosses"), (snap) => {
      const bosses = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((b) => b.isActive === true); // Mostra solo i boss attivi sulla mappa
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
            className="boss-anchor" // Nuovo contenitore fisso
            style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}
          >
            {/* <div className="countdown-mini">
              {boss.expiryDate ? (
                <TimerDisplay expiryDate={boss.expiryDate} />
              ) : (
                ""
              )}
            </div> */}
            {/* Cerchio che pulsa (Indipendente) */}
            <div className="ping-visual"></div>

            {/* Pop-up (Indipendente e Fisso) */}
            <div className="ping-tooltip">
              <div className="tooltip-image-container">
                <img src={boss.imageUrl} alt={boss.name} />
              </div>
              {/* <div className="countdown-mini">
                {boss.expiryDate ? (
                  <TimerDisplay expiryDate={boss.expiryDate} />
                ) : (
                  ""
                )}
              </div> */}
              {/* AGGIUNTA TIMER MINI */}
  {/* <div className="mini-timer">
    ⏳ <TimerDisplay expiryDate={boss.expiryDate} />
  </div> */}
              <div className="tooltip-content">
                <h3>{boss.name}</h3>
                {/* Mostra il Grado Sfida qui */}
                <span className="gs-badge">
                  Grado Sfida {boss.gradoSfida || "Grado ??"}
                </span>

                <div className="mini-timer" style={{color: '#d4af37', fontSize: '0.9rem'}}>
  ⏳ <TimerDisplay expiryDate={boss.expiryDate} />
</div>

                {/* Nuova struttura barra HP visibile */}
                <div className="hp-container-mini">
                  <div
                    className="hp-bar-fill-mini"
                    style={{
                      width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                    }}
                  ></div>
                </div>

                <div className="hp-info">
                  ❤️ {boss.hp} / {boss.maxHp}
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
