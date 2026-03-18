import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../AuthContext";
import "./PgSheetEditor.css";

const ARENA_CHAMPION = {
  name: "Dante Ivio",
  class: "Campione Arena", // Campo classe aggiunto
  level: 10,
  image: "https://via.placeholder.com/150", 
  stats: { hp: 85, maxHp: 85, ac: 18, str: 4, dex: 2, con: 3, int: -1, wis: 1, cha: 0 },
  actions: [
    { name: "Spada Lunga Vorpal", category: "Armi", bonus: "+9", damage: "1d8+6", description: "Un'arma leggendaria per l'arena." },
    { name: "Sguardo del Campione", category: "Abilità", bonus: "+5", damage: "2d6", description: "Intimidisce l'avversario infliggendo danni psichici." },
    { name: "Palla di Fuoco (Lv 3)", category: "Livello 3", bonus: "+7", damage: "8d6", description: "Un classico esplosivo." }
  ],
};

export default function PgSheetEditor({ isArenaView = false }) {
  const { currentUser } = useAuth();
  const [normalChar, setNormalChar] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    if (isArenaView) { setLoading(false); return; }

    const unsubNormal = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
      if (snap.exists()) { setNormalChar(snap.data()); }
      setLoading(false);
    });
    return () => unsubNormal();
  }, [currentUser, isArenaView]);

  const handleRoll = async (charName, itemName, formula, bonus, isArena) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonusNum = parseInt(bonus?.replace(/[^0-9+-]/g, "")) || 0;
    
    try {
      await addDoc(collection(db, "rolls"), {
        characterName: charName,
        itemName,
        toHit: d20 + bonusNum,
        isArenaRoll: isArena,
        timestamp: serverTimestamp(),
        uid: currentUser.uid,
      });
      alert(`🎲 ${isArena ? 'ARENA' : 'PG'}: ${itemName} -> ${d20 + bonusNum}`);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading-screen">Caricamento Eroi...</div>;

  return (
    <div className="pg-editor-container">
      {!isArenaView && (
        <div className="pg-display-section">
          <h2 className="gold-title">📜 Personaggio Attuale</h2>
          {normalChar ? (
            <RenderSheet data={normalChar} isArena={false} onRoll={handleRoll} />
          ) : (
            <div className="no-data-msg">Nessun dato. Fai il fetch da Foundry!</div>
          )}
        </div>
      )}

      <div className="pg-display-section">
        <h2 className="gold-title">⚔️ Campione dell'Arena</h2>
        <RenderSheet data={ARENA_CHAMPION} isArena={true} onRoll={handleRoll} />
      </div>
    </div>
  );
}

function RenderSheet({ data, isArena, onRoll }) {
  if (!data) return null;

  // Raggruppamento azioni per categoria
  const weapons = data.actions?.filter(a => a.category === "Armi") || [];
  const spells = data.actions?.filter(a => a.category.toLowerCase().includes("livello") || a.category === "Trucchetto") || [];
  const abilities = data.actions?.filter(a => a.category === "Abilità" || a.category === "Azione" || a.category === "Feat") || [];

  const ActionBox = ({ act, typeClass }) => (
    <button 
      className={`action-roll-btn ${typeClass}`}
      onClick={() => onRoll(data.name, act.name, act.damage, act.bonus, isArena)}
    >
      <div className="btn-main-row">
        <div className="btn-left-info">
          <span className="action-name">{act.name}</span>
          <span className="action-category">{act.category}</span>
        </div>
        <span className="action-dmg-tag">{act.damage !== "0" ? act.damage : "Utilizzo"}</span>
      </div>
      {act.description && <p className="action-description-text">{act.description}</p>}
    </button>
  );

  return (
    <div className={`pg-sheet-card ${isArena ? "arena-theme" : "hero-theme"}`}>
      <div className="pg-header">
        <div className="pg-avatar-wrapper">
          <img src={data.image || "/assets/default-avatar.png"} alt={data.name} className="pg-avatar-img" />
          <div className="pg-level-badge">Lv. {data.level}</div>
        </div>
        <div className="pg-info-text">
          <h4 className="pg-name">{data.name}</h4>
          <span className="pg-class-text">{data.class || "Viandante"}</span>
        </div>
      </div>
      
      <div className="pg-stats-grid">
        <div className="stat-box hp">
          <span className="stat-label">Salute</span>
          <span className="stat-value">{data.stats?.hp} / {data.stats?.maxHp}</span>
          <div className="stat-bar"><div className="stat-fill red" style={{width: `${(data.stats?.hp/data.stats?.maxHp)*100}%`}}></div></div>
        </div>
        <div className="stat-box ac">
          <span className="stat-label">Difesa</span>
          <span className="stat-value">🛡️ {data.stats?.ac} CA</span>
        </div>
      </div>

      <div className="pg-actions-container">
        {/* SEZIONE ARMI */}
        {weapons.length > 0 && (
          <div className="category-block">
            <h5 className="cat-title weapon-color">⚔️ Armi</h5>
            <div className="actions-list">
              {weapons.map((act, i) => <ActionBox key={i} act={act} typeClass="weapon-item" />)}
            </div>
          </div>
        )}
 

        {/* SEZIONE INCANTESIMI */}
        {spells.length > 0 && (
          <div className="category-block">
            <h5 className="cat-title spell-color">✨ Incantesimi</h5>
            <div className="actions-list">
              {spells.map((act, i) => <ActionBox key={i} act={act} typeClass="spell-item" />)}
            </div>
          </div>
        )}

        {/* SEZIONE ABILITÀ */}
        {abilities.length > 0 && (
          <div className="category-block">
            <h5 className="cat-title feat-color">🛡️ Abilità & Talenti</h5>
            <div className="actions-list">
              {abilities.map((act, i) => <ActionBox key={i} act={act} typeClass="feat-item" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}