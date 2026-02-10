import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

// Copiamo la logica dei livelli dal Mercato per coerenza
const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo" },
  { lv: 1, min: 5, name: "Simpatizzante" },
  { lv: 2, min: 15, name: "Informatore" },
  { lv: 3, min: 30, name: "Ricettatore" },
  { lv: 4, min: 50, name: "Veterano" },
  { lv: 5, min: 80, name: "Ombra di Obia" },
];

export default function ReputationAdmin() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carica i personaggi
  const fetchCharacters = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "characters"));
      const chars = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Se non ha il campo, lo consideriamo 0
        rattoPoints: doc.data().rattoPoints || 0, 
      }));
      // Ordiniamo per chi ha più reputazione
      setCharacters(chars.sort((a, b) => b.rattoPoints - a.rattoPoints));
    } catch (error) {
      console.error("Errore caricamento PG:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters();
  }, []);

  // Funzione per modificare i punti manualmente
  const updatePoints = async (id, amount) => {
    const charRef = doc(db, "characters", id);
    await updateDoc(charRef, {
      rattoPoints: increment(amount)
    });
    fetchCharacters(); // Ricarica la lista
  };

  // Calcola i dati per la barra
  const getProgressData = (points) => {
    // Trova il livello attuale
    let currentRank = RATTO_LEVELS[0];
    let nextRank = RATTO_LEVELS[1];

    for (let i = 0; i < RATTO_LEVELS.length; i++) {
      if (points >= RATTO_LEVELS[i].min) {
        currentRank = RATTO_LEVELS[i];
        nextRank = RATTO_LEVELS[i + 1] || null; // Null se è livello massimo
      }
    }

    if (!nextRank) {
      // Livello Massimo Raggiunto
      return {
        rankName: currentRank.name,
        percent: 100,
        text: "Massima Reputazione!",
        isMax: true
      };
    }

    // Calcolo percentuale progresso verso il prossimo livello
    const pointsNeeded = nextRank.min - currentRank.min;
    const pointsEarned = points - currentRank.min;
    let percent = (pointsEarned / pointsNeeded) * 100;
    
    // Evitiamo percentuali negative strane se i punti scendono sotto zero
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;

    return {
      rankName: currentRank.name,
      nextRankName: nextRank.name,
      percent: percent.toFixed(0),
      text: `${points} / ${nextRank.min} per ${nextRank.name}`,
      isMax: false
    };
  };

  return (
    <section style={{ padding: "40px 20px", color: "white", maxWidth: "800px", margin: "0 auto" }}>
      <button onClick={() => navigate("/dm-admin")} style={{ marginBottom: "20px", background: "none", border: "1px solid var(--gold)", color: "var(--gold)", padding: "5px 10px", cursor: "pointer" }}>
        ← Torna al Pannello Admin
      </button>

      <h1 style={{ color: "var(--gold)", textAlign: "center", marginBottom: "40px" }}>🐀 Reputazione della Gilda</h1>

      <div className="rep-list">
        {loading ? <p>Sguinzagliando i ratti spia...</p> : characters.map((char) => {
          const progress = getProgressData(char.rattoPoints);
          
          return (
            <div key={char.id} style={{ 
              background: "#343232", 
              marginBottom: "20px", 
              padding: "20px", 
              borderRadius: "10px", 
              border: "1px solid #444",
              boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, color: "var(--gold)" }}>{char.name || char.charName}</h3>
                <span style={{ fontSize: "0.9rem", color: "#888" }}>{progress.rankName}</span>
              </div>

            {/* BARRA DI PROGRESSO */}
                          <div style={{ position: "relative", height: "25px", background: "#444", borderRadius: "12px", overflow: "hidden", marginBottom: "15px", alignItems: "center", display: "flex" }}>
                            <div style={{
                              width: `${progress.percent}%`,
                              height: "100%",
                              background: progress.isMax 
                                ? "linear-gradient(90deg, #FFD700, #FFED4E)" // Light gold when maxed
                                : `linear-gradient(90deg, #00c6ff ${Math.max(0, 100 - progress.percent)}%, #FFD700 ${Math.min(100, 100 + progress.percent / 2)}%)`, // Blue to gold transition
                              transition: "width 0.5s ease-in-out",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              paddingRight: "5px"
                            }}>
                              {/* Icona che si muove con la barra */}
                  {/* <span style={{ fontSize: "14px", lineHeight: "1" }}>🐀</span> */}
                </div>
                {/* Testo sopra la barra */}
                <span style={{ 
                  position: "absolute", 
                  width: "100%", 
                  textAlign: "center", 
                  top: "0", 
                  lineHeight: "25px", 
                  fontSize: "12px", 
                  fontWeight: "bold", 
                  textShadow: "1px 1px 2px black" 
                }}>
                  {progress.text}
                </span>
              </div>

              {/* CONTROLLI RAPIDI */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", alignItems: "center" }}>
                <small style={{ marginRight: "10px" }}>Modifica rapida:</small>
                <button onClick={() => updatePoints(char.id, -1)} style={btnStyleRed}>-1</button>
                <button onClick={() => updatePoints(char.id, 1)} style={btnStyleGreen}>+1</button>
                <button onClick={() => updatePoints(char.id, 5)} style={btnStyleGreen}>+5</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Stili veloci per i bottoni
const btnStyleGreen = { background: "#2ecc71", border: "none", color: "black", fontWeight: "bold", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" };
const btnStyleRed = { background: "#e74c3c", border: "none", color: "white", fontWeight: "bold", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" };