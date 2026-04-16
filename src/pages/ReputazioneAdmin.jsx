import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { Link } from "react-router-dom";
import "./admin.css";

const RATTO_LEVELS = [
  { lv: 0, min: 0,  name: "Estraneo" },
  { lv: 1, min: 5,  name: "Simpatizzante" },
  { lv: 2, min: 15, name: "Informatore" },
  { lv: 3, min: 30, name: "Ricettatore" },
  { lv: 4, min: 50, name: "Veterano" },
  { lv: 5, min: 80, name: "Ombra di Obia" },
];

export default function ReputationAdmin() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCharacters = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "characters"));
      const chars = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        rattoPoints: doc.data().rattoPoints || 0,
      }));
      setCharacters(chars.sort((a, b) => b.rattoPoints - a.rattoPoints));
    } catch (error) {
      console.error("Errore caricamento PG:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCharacters(); }, []);

  const updatePoints = async (id, amount) => {
    await updateDoc(doc(db, "characters", id), { rattoPoints: increment(amount) });
    fetchCharacters();
  };

  const getProgressData = (points) => {
    let currentRank = RATTO_LEVELS[0];
    let nextRank = RATTO_LEVELS[1];
    for (let i = 0; i < RATTO_LEVELS.length; i++) {
      if (points >= RATTO_LEVELS[i].min) {
        currentRank = RATTO_LEVELS[i];
        nextRank = RATTO_LEVELS[i + 1] || null;
      }
    }
    if (!nextRank) return { rankName: currentRank.name, percent: 100, text: "Massima Reputazione!", isMax: true };
    const pointsNeeded = nextRank.min - currentRank.min;
    const pointsEarned = points - currentRank.min;
    let percent = Math.max(0, Math.min(100, (pointsEarned / pointsNeeded) * 100));
    return {
      rankName: currentRank.name,
      nextRankName: nextRank.name,
      percent: percent.toFixed(0),
      text: `${points} / ${nextRank.min} per ${nextRank.name}`,
      isMax: false,
    };
  };

  return (
    <section className="admin-reputation-page">
      <Link to="/dm-admin" className="admin-back-link">← Dashboard Admin</Link>

      <h1 className="admin-page-title">Reputazione della Gilda</h1>
      <div className="admin-divider"><span className="admin-divider-icon">🐀</span></div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#aaa", fontStyle: "italic" }}>Sguinzagliando i ratti spia...</p>
      ) : (
        <div>
          {characters.map((char) => {
            const progress = getProgressData(char.rattoPoints);
            return (
              <div key={char.id} className="rep-char-card">
                <div className="rep-char-header">
                  <h3 className="rep-char-name">{char.name || char.charName}</h3>
                  <span className="rep-char-rank">{progress.rankName}</span>
                </div>

                <div className="rep-progress-bar-bg">
                  <div
                    className="rep-progress-bar-fill"
                    style={{ width: `${progress.percent}%` }}
                  />
                  <span className="rep-progress-text">{progress.text}</span>
                </div>

                <div className="rep-controls">
                  <small>Modifica rapida:</small>
                  <button onClick={() => updatePoints(char.id, -1)} className="btn-rep-minus">−1</button>
                  <button onClick={() => updatePoints(char.id, 1)}  className="btn-rep-plus">+1</button>
                  <button onClick={() => updatePoints(char.id, 5)}  className="btn-rep-plus">+5</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
