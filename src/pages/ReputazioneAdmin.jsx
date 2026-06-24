import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { Link } from "react-router-dom";
import { isHiddenChar } from "../data/hiddenPlayers";
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
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const fetchCharacters = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "characters"));
      const chars = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        rattoPoints: doc.data().rattoPoints || 0,
      })).filter((c) => !isHiddenChar(c));
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

  const stats = useMemo(() => {
    const total = characters.length;
    const ombre = characters.filter((c) => c.rattoPoints >= 80).length;
    const top = characters[0];
    return { total, ombre, top: top ? (top.name || top.charName || "—") : "—" };
  }, [characters]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((c) => (c.name || c.charName || "").toLowerCase().includes(q));
  }, [characters, query]);

  return (
    <section className="adm" style={{ "--cine-accent": "#7a2e1a", "--cine-accent-2": "#a9781a" }}>
      <Link to="/dm-admin" className="adm-back">← Console del Master</Link>

      <div className="adm-masthead">
        <div className="adm-mast-main">
          <span className="adm-eyebrow">🐀 Gilda di Obia</span>
          <h1 className="adm-title">Reputazione della Gilda</h1>
          <p className="adm-sub">Gestisci la lealtà dei player e i loro gradi nel sottosuolo.</p>
        </div>
        <div className="adm-mast-aside">
          <div className="adm-stat"><span>Membri</span><strong>{stats.total}</strong></div>
          <div className="adm-stat"><span>Ombre di Obia</span><strong>{stats.ombre}</strong></div>
        </div>
      </div>

      <div className="adm-panel" style={{ marginBottom: 18 }}>
        <input
          className="adm-input"
          placeholder="🔎 Cerca un personaggio…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="adm-empty">Sguinzagliando i ratti spia…</p>
      ) : visible.length === 0 ? (
        <p className="adm-empty">Nessun personaggio corrisponde alla ricerca.</p>
      ) : (
        <div className="adm-grid-3">
          {visible.map((char) => {
            const progress = getProgressData(char.rattoPoints);
            return (
              <div key={char.id} className="adm-panel rep-card">
                <div className="rep-card-head">
                  <h3 className="rep-card-name">{char.name || char.charName}</h3>
                  <span className="rep-card-rank">{progress.rankName}</span>
                </div>

                <div className="rep-bar">
                  <div className="rep-bar-fill" style={{ width: `${progress.percent}%` }} />
                  <span className="rep-bar-text">{progress.text}</span>
                </div>

                <div className="rep-card-controls">
                  <button onClick={() => updatePoints(char.id, -1)} className="adm-btn adm-btn--danger rep-mini">−1</button>
                  <button onClick={() => updatePoints(char.id, 1)}  className="adm-btn adm-btn--gold rep-mini">+1</button>
                  <button onClick={() => updatePoints(char.id, 5)}  className="adm-btn adm-btn--gold rep-mini">+5</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
