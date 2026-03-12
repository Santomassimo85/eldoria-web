import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  doc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

export default function PgSheetEditor() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({ "Armi": true });

  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), (doc) => {
      if (doc.exists()) {
        setCharData(doc.data());
      }
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const handleRoll = async (itemName, formula, bonus) => {
  // --- 1. TIRO PER COLPIRE ---
  const d20 = Math.floor(Math.random() * 20) + 1;
  const bonusNum = parseInt(bonus?.replace(/[^0-9+-]/g, "")) || 0;
  const toHitTotal = d20 + bonusNum;

  // --- 2. TIRO PER IL DANNO ---
  // Funzione interna per calcolare i dadi (es. "2d6 + 5")
  const rollDamage = (dmgFormula) => {
    try {
      // Puliamo la formula da spazi
      const cleanFormula = dmgFormula.replace(/\s+/g, '');
      // Separiamo la parte dei dadi dai bonus fissi (es. ["1d6", "5"])
      const parts = cleanFormula.split('+');
      let totalDmg = 0;
      let detailedDmg = "";

      parts.forEach(part => {
        if (part.includes('d')) {
          // È un dado: es. "1d6"
          const [num, sides] = part.split('d').map(Number);
          for (let i = 0; i < (num || 1); i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            totalDmg += roll;
            detailedDmg += (detailedDmg ? " + " : "") + roll;
          }
        } else {
          // È un numero fisso: es. "5"
          const val = parseInt(part) || 0;
          totalDmg += val;
          detailedDmg += (detailedDmg ? " + " : "") + val;
        }
      });
      return { total: totalDmg, detail: detailedDmg };
    } catch (e) {
      return { total: 0, detail: "errore" };
    }
  };

  const damageResult = rollDamage(formula);

  // --- 3. INVIO A FIREBASE ---
  try {
    await addDoc(collection(db, "rolls"), {
      characterName: charData?.name || "Eroe",
      itemName: itemName,
      toHit: toHitTotal,
      toHitDetails: `${d20} + ${bonusNum}`,
      damage: damageResult.total,
      damageDetails: damageResult.detail,
      timestamp: serverTimestamp(),
      uid: currentUser.uid
    });

    // --- 4. FEEDBACK VISIVO ---
    alert(
      `🎲 LANCIO: ${itemName.toUpperCase()}\n` +
      `🎯 COLPIRE: ${toHitTotal} (d20: ${d20} + Mod: ${bonusNum})\n` +
      `💥 DANNO: ${damageResult.total} [${damageResult.detail}]`
    );
  } catch (err) {
    console.error("Errore permessi Firebase:", err);
    alert("Errore nell'invio del lancio. Controlla la console.");
  }
};

  if (loading) return <div className="loading-screen">Caricamento Scheda Eroica...</div>;

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const groupedActions = charData?.actions?.reduce((acc, action) => {
    const cat = action.category || "Altro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(action);
    return acc;
  }, {});

  const sortedCategories = groupedActions ? Object.keys(groupedActions).sort((a, b) => {
    if (a === "Armi") return -1;
    if (b === "Armi") return 1;
    return a.localeCompare(b);
  }) : [];

  return (
    <div className="pg-editor-container">
      <header className="pg-header">
        <div className="header-top">
          <h1 className="pg-name">{charData?.name || "Eroe Senza Nome"}</h1>
          {charData?.image && (
  <img 
    src={charData.image} 
    alt="Token Avatar" 
    style={{ width: '80px', height: '80px', borderRadius: '50%',  objectFit: 'cover' }} 
  />
)}
          <div className="level-badge">LIV. {charData?.level || "1"}</div>
        </div>
        <p className="sync-status">Status Sincronizzato</p>
        
        {charData?.spellSlots && Object.keys(charData.spellSlots).length > 0 && (
          <div className="spell-slots-container">
            {Object.entries(charData.spellSlots).map(([lvl, data]) => (
              <div key={lvl} className="slot-badge">
                <span className="slot-label">{lvl.toUpperCase()}</span>
                <strong className="slot-value">{data.value} / {data.max}</strong>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-label">SALUTE</span>
          <div className="stat-value">
            {charData?.stats?.hp ?? 0} <span className="stat-max">/ {charData?.stats?.maxHp ?? 0}</span>
          </div>
        </div>
        <div className="stat-box">
          <span className="stat-label">DIFESA (CA)</span>
          <div className="stat-value">{charData?.stats?.ac ?? 0}</div>
        </div>
        <div className="stat-box">
          <span className="stat-label">GRUPPO</span>
          <div className="group-name">{charData?.party || "Eroe Solitario"}</div>
        </div>
      </div>

      {sortedCategories.map(cat => (
        <div key={cat} className="section-wrapper">
          <button onClick={() => toggleSection(cat)} className="toggle-button">
            <span>{cat.startsWith("Livello") || cat === "Trucchetto" ? `✨ ${cat}` : cat === "Armi" ? `⚔️ ${cat}` : `📜 ${cat}`}</span>
            <span>{openSections[cat] ? "▲" : "▼"}</span>
          </button>
          
          {openSections[cat] && (
            <div className="actions-grid">
              {groupedActions[cat].map((item, idx) => (
                <ActionCard key={idx} item={item} onRoll={handleRoll} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionCard({ item, onRoll }) {
  const categoryClass = item.category?.includes("Livello") || item.category?.includes("Trucchetto") 
    ? "card-spell" 
    : "card-weapon";

  return (
    <div className={`action-card ${categoryClass}`} onClick={() => onRoll(item.name, item.damage, item.bonus)}>
      <div className="card-name">{item.name}</div>
      {item.description && <div className="card-description">{item.description}</div>}
      <div className="card-footer">
        <span>🎯 {item.bonus}</span>
        <span>💥 <strong>{item.damage}</strong></span>
      </div>
    </div>
  );
}