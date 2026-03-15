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

const ARENA_CHAMPION = {
  name: "Dante Ivio - Campione Arena",
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

  if (isArenaView) {
    return (
      <div className="arena-only-wrapper">
        <RenderSheet data={ARENA_CHAMPION} isArena={true} onRoll={handleRoll} />
      </div>
    );
  }

  return (
    <div className="pg-multi-display">
      <div className="pg-display-box">
        <h2 className="section-title-gold">📜 PERSONAGGIO ATTUALE</h2>
        {normalChar ? (
          <RenderSheet data={normalChar} isArena={false} onRoll={handleRoll} />
        ) : (
          <p className="no-data">Nessun dato. Fai il fetch da Foundry!</p>
        )}
      </div>

      <div className="pg-display-box">
        <h2 className="section-title-gold">⚔️ CAMPIONE ARENA (LV. 10)</h2>
        <RenderSheet data={ARENA_CHAMPION} isArena={true} onRoll={handleRoll} />
      </div>
    </div>
  );
}

function RenderSheet({ data, isArena, onRoll }) {
  if (!data) return null;
  return (
    <div className={`mini-card-pg ${isArena ? "arena-style" : "normal-style"}`}>
      <div className="mini-card-header">
        <div className="mini-card-titles">
          <h4 className="mini-char-name">{data.name}</h4>
          <span className="mini-level">LIV. {data.level}</span>
        </div>
        {data.image && <img src={data.image} alt="Avatar" className="mini-avatar" />}
      </div>
      
      <div className="mini-stats-row">
        <span>❤️ HP: {data.stats?.hp}/{data.stats?.maxHp}</span>
        <span>🛡️ CA: {data.stats?.ac}</span>
      </div>

      <div className="mini-actions-grid">
        {data.actions?.map((act, i) => (
          <button 
            key={i} 
            className="mini-action-btn"
            onClick={() => onRoll(data.name, act.name, act.damage, act.bonus, isArena)}
          >
            <span className="mini-btn-name">{act.name}</span>
            <span className="mini-btn-dmg">{act.damage}</span>
          </button>
        ))}
      </div>
    </div>
  );
}