import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, collection, onSnapshot, updateDoc, setDoc, increment } from "firebase/firestore";
import "./ArenaMarket.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const SHOP_ITEMS = [
  {
    key: "pozione_cura_media",
    name: "Pozione di Cura Media",
    description: "Cura 2d8 PF durante un fight nell'Arena.",
    icon: "💚",
    price: 3,
    field: "healingPotions",
    max: 3,
  },
  {
    key: "arma_plus1",
    name: "Arma +1",
    description: "+1 ai tiri per colpire con arma e +1 alla Classe Armatura. Permanente.",
    icon: "⚔️",
    price: 6,
    field: "weaponBonus",
    max: 1,
  },
  {
    key: "armatura_plus1",
    name: "Armatura +1",
    description: "+1 alla Classe Armatura per tutta la durata del torneo.",
    icon: "🛡️",
    price: 6,
    field: "armorBonus",
    max: 1,
  },
];

export const ARENA_CLASSES = [
  { key: "fighter",   name: "Guerriero",  icon: "⚔️" },
  { key: "barbarian", name: "Barbaro",    icon: "🪓" },
  { key: "paladin",   name: "Paladino",   icon: "🛡️" },
  { key: "rogue",     name: "Ladro",      icon: "🗡️" },
  { key: "ranger",    name: "Ranger",     icon: "🏹" },
  { key: "monk",      name: "Monaco",     icon: "👊" },
  { key: "wizard",    name: "Mago",       icon: "🔮" },
  { key: "sorcerer",  name: "Stregone",   icon: "✨" },
  { key: "warlock",   name: "Warlock",    icon: "🌑" },
  { key: "bard",      name: "Bardo",      icon: "🎵" },
  { key: "cleric",    name: "Chierico",   icon: "⛪" },
  { key: "druid",     name: "Druido",     icon: "🌿" },
];

const HIT_DICE = {
  fighter: 10, barbarian: 10, paladin: 10, rogue: 10, ranger: 10,
  monk: 10, wizard: 10, sorcerer: 10, warlock: 10, bard: 10, cleric: 10, druid: 10,
};

const LEVEL_UP_KEY = "level_up_cost";
const LEVEL_UP_DEFAULT = 10;

export default function ArenaMarket() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [arenaMeta, setArenaMeta] = useState(null);
  const [message, setMessage] = useState(null);
  const [customPrices, setCustomPrices] = useState({});

  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setCharData(snap.data());
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_meta", "global"), snap => {
      if (snap.exists()) setArenaMeta(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "arena_config", "shop"), snap => {
      if (snap.exists()) setCustomPrices(snap.data().prices ?? {});
    });
    return () => unsub();
  }, []);

  const effectiveItems = SHOP_ITEMS.map(item => ({
    ...item,
    price: customPrices[item.key] ?? item.price,
  }));

  const levelUpCost = customPrices[LEVEL_UP_KEY] ?? LEVEL_UP_DEFAULT;
  const coins    = charData?.arenaCoins ?? 0;
  const buffs    = charData?.arenaBuffs ?? {};
  const classLvls = charData?.classLevels ?? {};

  const showMsg = (text, type = "ok") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const buyItem = async (item) => {
    if (!currentUser || !charData) return;
    if (coins < item.price) { showMsg("Monete insufficienti.", "err"); return; }
    const currentVal = buffs[item.field] ?? 0;
    if (currentVal >= item.max) { showMsg("Hai già questo potenziamento al massimo.", "err"); return; }
    const updates = {
      arenaCoins: increment(-item.price),
      [`arenaBuffs.${item.field}`]: increment(1),
    };
    if (item.key === "arma_plus1" && !(buffs.armorBonus >= 1)) {
      updates["arenaBuffs.armorBonus"] = increment(1);
    }
    await updateDoc(doc(db, "characters", currentUser.uid), updates);
    showMsg(`Acquistato: ${item.name}!`);
  };

  const levelUpClass = async (cls) => {
    if (!currentUser || !charData) return;
    if (coins < levelUpCost) { showMsg("Monete Arena insufficienti.", "err"); return; }
    const currentLv = classLvls[cls.key] ?? 1;
    const die = HIT_DICE[cls.key] ?? 8;
    // CON modifier from the arena character snapshot (stored as modifier, e.g. +2)
    const mySnap = arenaMeta?.characterSnapshots?.[currentUser.uid];
    const conMod = mySnap?.stats?.con ?? 0;
    const dieRoll = Math.floor(Math.random() * die) + 1;
    const hpGain = Math.max(1, dieRoll + conMod);
    await updateDoc(doc(db, "characters", currentUser.uid), {
      arenaCoins: increment(-levelUpCost),
      [`classLevels.${cls.key}`]: currentLv + 1,
      arenaHpBonus: increment(hpGain),
    });
    // Keep the arena snapshot in sync so generateMatches picks up the bonus
    if (mySnap) {
      await updateDoc(doc(db, "arena_meta", "global"), {
        [`characterSnapshots.${currentUser.uid}.arenaHpBonus`]: increment(hpGain),
      });
    }
    const conStr = conMod !== 0 ? ` + CON ${conMod > 0 ? "+" : ""}${conMod}` : "";
    showMsg(`${cls.name} → Lv.${currentLv + 1}! +${hpGain} PF (1d${die}=${dieRoll}${conStr})`);
  };

  if (!currentUser) {
    return (
      <div className="am-page">
        <p className="am-login-notice">Accedi per visitare la Bottega dell'Arena.</p>
      </div>
    );
  }

  return (
    <div className="am-page">
      <div className="am-header">
        <h1 className="am-title">⚔ Bottega dell'Arena</h1>
        <p className="am-subtitle">Spendi le tue Monete Arena per potenziamenti esclusivi.</p>
        <div className="am-balance">
          <span className="am-balance-icon">🪙</span>
          <span className="am-balance-value">{coins}</span>
          <span className="am-balance-label">Monete Arena</span>
        </div>
      </div>

      {message && (
        <div className={`am-message ${message.type === "err" ? "am-message--err" : ""}`}>
          {message.text}
        </div>
      )}

      {/* ── CLASSI ARENA ── */}
      <div className="am-classes-section">
        <h3 className="am-how-title">Classi Arena</h3>
        <p className="am-classes-sub">
          Ogni classe parte da Lv.1 — salire di livello costa <strong>{levelUpCost} MA</strong> e aggiunge <strong>+1d10</strong> al tiro HP della prossima Arena (base: 7d10 per tutte le classi).
          {(charData?.arenaHpBonus ?? 0) > 0 && (
            <span className="am-hp-bonus-tag"> • +{charData.arenaHpBonus} PF bonus da livelli</span>
          )}
        </p>
        <div className="am-classes-grid">
          {ARENA_CLASSES.map(cls => {
            const lv = classLvls[cls.key] ?? 1;
            const canAfford = coins >= levelUpCost;
            return (
              <div key={cls.key} className="am-class-card">
                <div className="am-class-icon">{cls.icon}</div>
                <div className="am-class-name">{cls.name}</div>
                <div className="am-class-level">Lv. {lv}</div>
                <button
                  className="am-class-lvup-btn"
                  disabled={!canAfford}
                  onClick={() => levelUpClass(cls)}
                  title={canAfford ? `Sali a Lv.${lv + 1} (${levelUpCost} MA)` : "Monete insufficienti"}
                >
                  ▲ Lv. Up
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="am-how">
        <h3 className="am-how-title">Come guadagnare Monete Arena</h3>
        <ul className="am-how-list">
          <li>🪙 <strong>+1 MA</strong> per aver partecipato a un torneo</li>
          <li>🪙 <strong>+1 MA</strong> per ogni round vinto</li>
          <li>🪙 <strong>+5 MA</strong> se vinci il torneo</li>
        </ul>
      </div>

      <div className="am-how am-bets-section">
        <h3 className="am-how-title">🎲 Scommesse Arena — Vincite in MP</h3>
        <p className="am-classes-sub" style={{ marginBottom: "10px" }}>
          Le scommesse usano <strong>Monete di Platino (MP)</strong>. Puoi scommettere su singoli fight o sul vincitore del torneo.
          Le scommesse chiudono quando un combattente scende sotto il <strong>50% HP</strong>.
        </p>
        <div className="am-bet-tables">
          <div className="am-bet-table">
            <div className="am-bet-table-title">⚔️ Fight singolo — x2</div>
            <div className="am-bet-rows">
              <div className="am-bet-row"><span className="am-bet-stake">1 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">2 MP</span><span className="am-bet-profit">+1 MP</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">2 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">4 MP</span><span className="am-bet-profit">+2 MP</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">3 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">6 MP</span><span className="am-bet-profit">+3 MP</span></div>
            </div>
          </div>
          <div className="am-bet-table">
            <div className="am-bet-table-title">🏆 Vincitore torneo — x3</div>
            <div className="am-bet-rows">
              <div className="am-bet-row"><span className="am-bet-stake">1 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">3 MP</span><span className="am-bet-profit">+2 MP</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">2 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">6 MP</span><span className="am-bet-profit">+4 MP</span></div>
              <div className="am-bet-row"><span className="am-bet-stake">3 MP</span><span className="am-bet-arrow">→</span><span className="am-bet-win">9 MP</span><span className="am-bet-profit">+6 MP</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="am-grid">
        {effectiveItems.map(item => {
          const owned = buffs[item.field] ?? 0;
          const maxed = owned >= item.max;
          const canAfford = coins >= item.price;
          return (
            <div key={item.key} className={`am-card ${maxed ? "am-card--maxed" : ""}`}>
              <div className="am-card-icon">{item.icon}</div>
              <div className="am-card-name">{item.name}</div>
              <div className="am-card-desc">{item.description}</div>
              <div className="am-card-price">
                <span className="am-coin-icon">🪙</span>
                <span>{item.price} MA</span>
              </div>
              {owned > 0 && (
                <div className="am-owned-badge">
                  {maxed ? "✔ Posseduto" : `Hai: ${owned}`}
                </div>
              )}
              <button
                className="am-buy-btn"
                onClick={() => buyItem(item)}
                disabled={maxed || !canAfford}
              >
                {maxed ? "Già acquistato" : !canAfford ? "Monete insufficienti" : "Acquista"}
              </button>
            </div>
          );
        })}
      </div>

      {isMaster && <MasterCoinPanel effectiveItems={effectiveItems} levelUpCost={levelUpCost} arenaMeta={arenaMeta} />}
    </div>
  );
}

const ITEM_FIELDS = [
  { field: "weaponBonus",    label: "Arma +1",              icon: "⚔️" },
  { field: "armorBonus",     label: "Armatura +1",          icon: "🛡️" },
  { field: "healingPotions", label: "Pozione Cura Media",   icon: "💚" },
];

function MasterCoinPanel({ effectiveItems, levelUpCost, arenaMeta }) {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});
  const [editPrices, setEditPrices] = useState({});
  const [editLevels, setEditLevels] = useState({});
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setAllChars(list);
    });
    return () => unsub();
  }, []);

  const saveCoins = async (uid) => {
    const val = parseInt(editCoins[uid], 10);
    if (isNaN(val)) return;
    await updateDoc(doc(db, "characters", uid), { arenaCoins: val });
    setEditCoins(prev => { const n = { ...prev }; delete n[uid]; return n; });
  };

  const removeItem = async (uid, field) => {
    const updates = { [`arenaBuffs.${field}`]: 0 };
    if (field === "weaponBonus") updates["arenaBuffs.armorBonus"] = 0;
    await updateDoc(doc(db, "characters", uid), updates);
  };

  const savePrice = async (key) => {
    const val = parseInt(editPrices[key], 10);
    if (isNaN(val) || val < 0) return;
    await setDoc(doc(db, "arena_config", "shop"), { prices: { [key]: val } }, { merge: true });
    setEditPrices(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const saveClassLevel = async (uid, classKey) => {
    const inputKey = `${uid}_${classKey}`;
    const val = parseInt(editLevels[inputKey], 10);
    if (isNaN(val) || val < 1) return;
    await updateDoc(doc(db, "characters", uid), { [`classLevels.${classKey}`]: val });
    setEditLevels(prev => { const n = { ...prev }; delete n[inputKey]; return n; });
  };

  const levelDownClass = async (uid, cls) => {
    const char = allChars.find(c => c.uid === uid);
    if (!char) return;
    const currentLv = (char.classLevels ?? {})[cls.key] ?? 1;
    if (currentLv <= 1) return;
    const die = HIT_DICE[cls.key] ?? 8;
    const mySnap = arenaMeta?.characterSnapshots?.[uid];
    const conMod = mySnap?.stats?.con ?? 0;
    // Reverse an average-roll HP gain (ceil of average + CON, minimum 1)
    const hpToRemove = Math.max(1, Math.ceil(die / 2) + conMod);
    const newHpBonus = Math.max(0, (char.arenaHpBonus ?? 0) - hpToRemove);
    await updateDoc(doc(db, "characters", uid), {
      [`classLevels.${cls.key}`]: currentLv - 1,
      arenaHpBonus: newHpBonus,
    });
    if (mySnap) {
      const newSnapBonus = Math.max(0, (mySnap.arenaHpBonus ?? 0) - hpToRemove);
      await updateDoc(doc(db, "arena_meta", "global"), {
        [`characterSnapshots.${uid}.arenaHpBonus`]: newSnapBonus,
      });
    }
  };

  return (
    <div className="am-master-panel">
      <h3 className="am-master-panel-title">🪙 Pannello Master</h3>

      {/* Prezzi oggetti + costo level-up */}
      <div className="am-price-editor">
        <p className="am-master-note">Prezzi oggetti e costo salita di livello.</p>

        <div className="am-price-row">
          <span className="am-price-icon">📈</span>
          <span className="am-price-name">Costo Lv. Up (tutte le classi)</span>
          <span className="am-price-current">{levelUpCost} MA</span>
          <input
            className="am-coin-input"
            type="number"
            min={0}
            placeholder="nuovo costo"
            value={editPrices[LEVEL_UP_KEY] ?? ""}
            onChange={e => setEditPrices(prev => ({ ...prev, [LEVEL_UP_KEY]: e.target.value }))}
          />
          <button className="am-coin-save" onClick={() => savePrice(LEVEL_UP_KEY)}>Salva</button>
        </div>

        {effectiveItems.map(item => (
          <div key={item.key} className="am-price-row">
            <span className="am-price-icon">{item.icon}</span>
            <span className="am-price-name">{item.name}</span>
            <span className="am-price-current">{item.price} MA</span>
            <input
              className="am-coin-input"
              type="number"
              min={0}
              placeholder="nuovo prezzo"
              value={editPrices[item.key] ?? ""}
              onChange={e => setEditPrices(prev => ({ ...prev, [item.key]: e.target.value }))}
            />
            <button className="am-coin-save" onClick={() => savePrice(item.key)}>Salva</button>
          </div>
        ))}
      </div>

      {/* Giocatori */}
      <p className="am-master-note" style={{ marginTop: "18px" }}>Giocatori — monete e livelli classe.</p>
      <div className="am-coin-list">
        {allChars.map(ch => {
          const buffsData  = ch.arenaBuffs || {};
          const ownedItems = ITEM_FIELDS.filter(it => (buffsData[it.field] ?? 0) > 0);
          const classLvls  = ch.classLevels ?? {};
          const isOpen     = !!expanded[ch.uid];

          return (
            <div key={ch.uid} className="am-coin-row am-coin-row--stacked">
              <div className="am-coin-row-top">
                <span className="am-coin-name">{ch.name || ch.uid}</span>
                <span className="am-coin-val">{ch.arenaCoins ?? 0} MA</span>
                <input
                  className="am-coin-input"
                  type="number"
                  min={0}
                  placeholder="monete"
                  value={editCoins[ch.uid] ?? ""}
                  onChange={e => setEditCoins(prev => ({ ...prev, [ch.uid]: e.target.value }))}
                />
                <button className="am-coin-save" onClick={() => saveCoins(ch.uid)}>Salva</button>
                <button
                  className="am-coin-save am-btn-toggle"
                  onClick={() => setExpanded(prev => ({ ...prev, [ch.uid]: !isOpen }))}
                >
                  {isOpen ? "▲ Classi" : "▼ Classi"}
                </button>
              </div>

              {isOpen && (
                <div className="am-master-classes">
                  {ARENA_CLASSES.map(cls => {
                    const lv = classLvls[cls.key] ?? 1;
                    const inputKey = `${ch.uid}_${cls.key}`;
                    return (
                      <div key={cls.key} className="am-master-class-row">
                        <span className="am-master-class-label">{cls.icon} {cls.name}</span>
                        <span className="am-class-lv-badge">Lv. {lv}</span>
                        <button
                          className="am-coin-save am-lvdown-btn"
                          title={`Scendi a Lv.${lv - 1}`}
                          disabled={lv <= 1}
                          onClick={() => levelDownClass(ch.uid, cls)}
                        >−</button>
                        <input
                          className="am-coin-input am-coin-input--sm"
                          type="number"
                          min={1}
                          placeholder="lv"
                          value={editLevels[inputKey] ?? ""}
                          onChange={e => setEditLevels(prev => ({ ...prev, [inputKey]: e.target.value }))}
                        />
                        <button className="am-coin-save" onClick={() => saveClassLevel(ch.uid, cls.key)}>Salva</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {ownedItems.length > 0 && (
                <div className="am-owned-items">
                  {ownedItems.map(it => (
                    <button
                      key={it.field}
                      className="am-remove-item-btn"
                      title={`Rimuovi ${it.label}`}
                      onClick={() => removeItem(ch.uid, it.field)}
                    >
                      {it.icon} {it.label} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
