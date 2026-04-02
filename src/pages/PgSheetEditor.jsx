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

const ARENA_CHAMPION = {
  name: "Dante Ivio",
  class: "Campione Arena", // Campo classe aggiunto
  level: 10,
  image: "https://via.placeholder.com/150",
  stats: {
    hp: 85,
    maxHp: 85,
    ac: 18,
    str: 4,
    dex: 2,
    con: 3,
    int: -1,
    wis: 1,
    cha: 0,
  },
  actions: [
    {
      name: "Spada Lunga Vorpal",
      category: "Armi",
      bonus: "+9",
      damage: "1d8+6",
      description: "Un'arma leggendaria per l'arena.",
    },
    {
      name: "Sguardo del Campione",
      category: "Abilità",
      bonus: "+5",
      damage: "2d6",
      description: "Intimidisce l'avversario infliggendo danni psichici.",
    },
    {
      name: "Palla di Fuoco (Lv 3)",
      category: "Livello 3",
      bonus: "+7",
      damage: "8d6",
      description: "Un classico esplosivo.",
    },
  ],
};

export default function PgSheetEditor({ isArenaView = false }) {
  const { currentUser } = useAuth();
  const [normalChar, setNormalChar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    if (isArenaView) {
      setLoading(false);
      return;
    }

    const unsubNormal = onSnapshot(
      doc(db, "characters", currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          setNormalChar(snap.data());
        }
        setLoading(false);
      },
    );
    return () => unsubNormal();
  }, [currentUser, isArenaView]);

  const handleRoll = async (charData, action, isArena) => {
    if (!charData || !action) return;

    const d20 = Math.floor(Math.random() * 20) + 1;
    const bonusToHit = parseInt(action.bonus?.replace(/[^0-9+-]/g, "")) || 0;
    const hitTotal = d20 + bonusToHit;
    const targetAC = 1;
    const isCritical = d20 === 20;

    let finalDamage = 0;
    let allDiceDetails = []; // Per mostrare i risultati di ogni pezzo della formula

    if (isCritical || hitTotal >= targetAC) {
      // Es action.damage: "2d6 + 5 + 1d8"
      const formulaParts = action.damage.split("+").map((p) => p.trim());

      formulaParts.forEach((part) => {
        if (part.includes("d")) {
          // Lancio del dado (es: 2d6 o 1d8)
          const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
          let partTotal = 0;
          let rolls = [];
          for (let i = 0; i < num; i++) {
            const r = Math.floor(Math.random() * sides) + 1;
            partTotal += r;
            rolls.push(r);
          }
          finalDamage += partTotal;
          allDiceDetails.push(`${num}d${sides} (${rolls.join("+")})`);
        } else {
          // Bonus statico (es: 5)
          const bonus = parseInt(part) || 0;
          finalDamage += bonus;
          if (bonus !== 0) allDiceDetails.push(`+${bonus}`);
        }
      });

      if (isCritical) finalDamage *= 2;

      // Aggiunta Furtivo se Ladro
      if (
        charData.class?.toLowerCase() === "ladro" ||
        charData.class?.toLowerCase() === "rogue"
      ) {
        const sneak = Math.floor(Math.random() * 6) + 1;
        finalDamage += sneak;
        allDiceDetails.push(`+ Furtivo (${sneak})`);
      }
    }

    // --- LOG STILIZZATO ---
    console.log(
      `%c--- ⚔️ ATTACCO: ${action.name} ---`,
      "color: gold; font-weight: bold;",
    );
    console.log(
      `Colpire: ${hitTotal} (${d20}+${bonusToHit}) vs CA ${targetAC}`,
    );

    if (finalDamage > 0) {
      const msg = `${isCritical ? "🔥 CRITICO! " : "🎯 COLPITO! "}${action.name}: ${finalDamage} danni! [Dettaglio: ${allDiceDetails.join(" ")}]`;
      console.log(`%c${msg}`, "color: #27ae60; font-weight: bold;");
    } else {
      console.log(`%c🛡️ MANCATO! (${hitTotal})`, "color: #e74c3c;");
    }

    // Invio al DB (come prima)
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

  if (loading) return <div className="loading-screen">Caricamento Eroi...</div>;

  return (
    <div className="pg-editor-container">
      {!isArenaView && (
        <div className="pg-display-section">
          <h2 className="gold-title">📜 Personaggio Attuale</h2>
          {normalChar ? (
            <RenderSheet
              data={normalChar}
              isArena={false}
              onRoll={handleRoll}
            />
          ) : (
            <div className="no-data-msg">
              Nessun dato. Fai il fetch da Foundry!
            </div>
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
  console.log("Dati ricevuti per", data.name, ":", data); // <--- AGGIUNGI QUESTO
  // Raggruppamento azioni per categoria
  const weapons = data.actions?.filter((a) => a.category === "Armi") || [];
  const spells =
    data.actions?.filter(
      (a) =>
        a.category.toLowerCase().includes("livello") ||
        a.category === "Trucchetto",
    ) || [];
  const abilities =
    data.actions?.filter(
      (a) =>
        a.category === "Abilità" ||
        a.category === "Azione" ||
        a.category === "Feat",
    ) || [];

  const ActionBox = ({ act, typeClass }) => (
    <button
      className={`action-roll-btn ${typeClass}`}
      // CAMBIA QUI: Passa 'data' (personaggio intero) e 'act' (azione intera)
      onClick={() => onRoll(data, act, isArena)}
    >
      <div className="btn-main-row">
        <div className="btn-left-info">
          <span className="action-name">{act.name}</span>
          <span className="action-category">{act.category}</span>
        </div>
        <span className="action-dmg-tag">
          {act.damage !== "0" ? act.damage : "Utilizzo"}
        </span>
      </div>
      {/* Visualizzazione completa della descrizione */}
      {act.description && (
        <div className="action-description-container">
          <p className="action-description-text">{act.description}</p>
        </div>
      )}
    </button>
  );

  return (
    <div className={`pg-sheet-card ${isArena ? "arena-theme" : "hero-theme"}`}>
      <div className="pg-header">
        <div className="pg-avatar-wrapper">
          <img
            src={data.image || "/assets/default-avatar.png"}
            alt={data.name}
            className="pg-avatar-img"
          />
          <div className="pg-level-badge">Lv. {data.level}</div>
        </div>
        <div className="pg-info-text">
          <h4 className="pg-name">{data.name}</h4>
          <span className="pg-class-text">
            {data.class && data.class.trim() !== "" ? data.class : "Viandante"}
          </span>{" "}
        </div>
      </div>

      <div className="pg-stats-grid">
        <div className="stat-box hp">
          <span className="stat-label">Salute</span>
          <span className="stat-value">
            {data.stats?.hp} / {data.stats?.maxHp}
          </span>
          <div className="stat-bar">
            <div
              className="stat-fill red"
              style={{
                width: `${(data.stats?.hp / data.stats?.maxHp) * 100}%`,
              }}
            ></div>
          </div>
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
              {weapons.map((act, i) => (
                <ActionBox key={i} act={act} typeClass="weapon-item" />
              ))}
            </div>
          </div>
        )}

        {/* SEZIONE INCANTESIMI */}
        {spells.length > 0 && (
          <div className="category-block">
            <h5 className="cat-title spell-color">✨ Incantesimi</h5>
            <div className="actions-list">
              {spells.map((act, i) => (
                <ActionBox key={i} act={act} typeClass="spell-item" />
              ))}
            </div>
          </div>
        )}

        {/* SEZIONE ABILITÀ */}
        {abilities.length > 0 && (
          <div className="category-block">
            <h5 className="cat-title feat-color">🛡️ Abilità & Talenti</h5>
            <div className="actions-list">
              {abilities.map((act, i) => (
                <ActionBox key={i} act={act} typeClass="feat-item" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
