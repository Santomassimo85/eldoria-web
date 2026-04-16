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
import "./pgSheetEditor.css";

export default function PgSheetEditor() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
      if (snap.exists()) setCharData(snap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleRoll = async (action) => {
  if (!charData || !action) return;

  const d20 = Math.floor(Math.random() * 20) + 1;
  const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
  const hitTotal = d20 + bonusToHit;
  const isCritical = d20 === 20;

  let finalDamage = 0;
  let allDiceDetails = [];

  const formulaParts = (action.damage && action.damage !== "0" 
    ? action.damage 
    : "1d4"
  ).split("+").map((p) => p.trim());

  formulaParts.forEach((part) => {
    if (part.includes("d")) {
      const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
      let partTotal = 0;
      let rolls = [];
      for (let i = 0; i < num; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        partTotal += r;
        rolls.push(r);
      }
      finalDamage += partTotal;
      allDiceDetails.push(`${num}d${sides}(${rolls.join("+")})`);
    } else {
      const bonus = parseInt(part) || 0;
      finalDamage += bonus;
      if (bonus !== 0) allDiceDetails.push(`+${bonus}`);
    }
  });

  if (isCritical) finalDamage *= 2;

  // 🔍 DEBUG LOG — vedi in console se i danni sono corretti
  console.log("=== TIRO AZIONE ===");
  console.log(`Azione: ${action.name}`);
  console.log(`Categoria: ${action.category}`);
  console.log(`Formula danno (da Firestore): ${action.damage}`);
  console.log(`d20: ${d20} + bonus colpo: ${bonusToHit} = ${hitTotal}`);
  console.log(`Dadi tirati: ${allDiceDetails.join(" ")}`);
  console.log(`Danno finale: ${finalDamage}${isCritical ? " (CRITICO x2!)" : ""}`);
  console.log("===================");

  try {
    await addDoc(collection(db, "rolls"), {
      characterName: charData.name,
      itemName: action.name,
      toHit: hitTotal,
      damageDealt: finalDamage,
      diceResults: allDiceDetails.join(" "),
      timestamp: serverTimestamp(),
      uid: currentUser.uid,
    });
  } catch (err) {
    console.error(err);
  }
};

  if (loading) return <div className="pgs-loading">Caricamento scheda...</div>;

  return (
    <div className="pgs-page">
      <h1 className="pgs-title">Scheda Personaggio</h1>
      <div className="pgs-divider"><span className="pgs-divider-icon">📜</span></div>

      {charData ? (
        <CharSheet data={charData} onRoll={handleRoll} />
      ) : (
        <div className="pgs-empty">
          Nessun dato personaggio trovato.
        </div>
      )}
    </div>
  );
}

function CharSheet({ data, onRoll }) {
  const weapons   = data.actions?.filter((a) => a.category === "Armi") || [];
  const spells    = data.actions?.filter((a) =>
    a.category?.toLowerCase().includes("livello") || a.category === "Trucchetto"
  ) || [];
  const abilities = data.actions?.filter((a) =>
    a.category === "Abilità" || a.category === "Azione" || a.category === "Feat"
  ) || [];

  const hpPct = Math.max(0, Math.min(100, (data.stats?.hp / data.stats?.maxHp) * 100));

  return (
    <div className="pgs-card">
      {/* Header */}
      <div className="pgs-header">
        <div className="pgs-avatar-wrap">
          <img
            src={data.image || "/assets/player/default.png"}
            alt={data.name}
            className="pgs-avatar"
          />
          {data.level && (
            <span className="pgs-level-badge">Lv. {data.level}</span>
          )}
        </div>
        <div className="pgs-identity">
          <h2 className="pgs-name">{data.name}</h2>
          {data.class && (
            <span className="pgs-class">{data.class}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="pgs-stats">
        <div className="pgs-hp-block">
          <div className="pgs-hp-labels">
            <span className="pgs-stat-label">Punti Ferita</span>
            <span className="pgs-hp-value">{data.stats?.hp} / {data.stats?.maxHp}</span>
          </div>
          <div className="pgs-hp-bar">
            <div className="pgs-hp-fill" style={{ width: `${hpPct}%` }} />
          </div>
        </div>

        <div className="pgs-stat-pills">
          <div className="pgs-pill">
            <span className="pgs-pill-label">CA</span>
            <span className="pgs-pill-value">🛡️ {data.stats?.ac}</span>
          </div>
          {["str","dex","con","int","wis","cha"].map((s) =>
            data.stats?.[s] !== undefined ? (
              <div key={s} className="pgs-pill">
                <span className="pgs-pill-label">{s.toUpperCase()}</span>
                <span className="pgs-pill-value">
                  {data.stats[s] >= 0 ? "+" : ""}{data.stats[s]}
                </span>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="pgs-actions">
        <ActionGroup title="⚔️ Armi" actions={weapons} typeClass="pgs-weapon" onRoll={onRoll} />
        <ActionGroup title="✨ Incantesimi" actions={spells} typeClass="pgs-spell" onRoll={onRoll} />
        <ActionGroup title="🛡️ Abilità & Talenti" actions={abilities} typeClass="pgs-feat" onRoll={onRoll} />
      </div>
    </div>
  );
}

function ActionGroup({ title, actions, typeClass, onRoll }) {
  if (!actions.length) return null;
  return (
    <div className="pgs-action-group">
      <h3 className={`pgs-group-title ${typeClass}-color`}>{title}</h3>
      {actions.map((act, i) => (
        <button
          key={i}
          className={`pgs-action-btn ${typeClass}`}
          onClick={() => onRoll(act)}
        >
          <div className="pgs-action-row">
            <div className="pgs-action-info">
              <span className="pgs-action-name">{act.name}</span>
              <span className="pgs-action-cat">{act.category}</span>
            </div>
            <span className={`pgs-action-dmg ${typeClass}-dmg`}>
              {act.damage && act.damage !== "0" ? act.damage : "Utilizzo"}
            </span>
          </div>
          {act.description && (
            <p className="pgs-action-desc">{act.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}
