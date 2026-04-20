import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { db } from "../firebase";
import { doc, collection, onSnapshot, updateDoc, increment } from "firebase/firestore";
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
    description: "+1 ai tiri per colpire con arma e +1 ai danni per tutta la durata del torneo.",
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

export default function ArenaMarket() {
  const { currentUser } = useAuth();
  const [charData, setCharData] = useState(null);
  const [message, setMessage] = useState(null);

  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, "characters", currentUser.uid), snap => {
      if (snap.exists()) setCharData(snap.data());
    });
    return () => unsub();
  }, [currentUser]);

  const coins = charData?.arenaCoins ?? 0;
  const buffs = charData?.arenaBuffs ?? {};

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
    await updateDoc(doc(db, "characters", currentUser.uid), updates);
    showMsg(`Acquistato: ${item.name}!`);
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

      <div className="am-how">
        <h3 className="am-how-title">Come guadagnare Monete Arena</h3>
        <ul className="am-how-list">
          <li>🪙 <strong>+1 MA</strong> per aver partecipato a un torneo</li>
          <li>🪙 <strong>+1 MA</strong> per ogni round vinto</li>
          <li>🪙 <strong>+5 MA</strong> se vinci il torneo</li>
        </ul>
      </div>

      <div className="am-grid">
        {SHOP_ITEMS.map(item => {
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

      {isMaster && <MasterCoinPanel />}
    </div>
  );
}

const ITEM_FIELDS = [
  { field: "weaponBonus",    label: "Arma +1",              icon: "⚔️" },
  { field: "armorBonus",     label: "Armatura +1",          icon: "🛡️" },
  { field: "healingPotions", label: "Pozione Cura Media",   icon: "💚" },
];

function MasterCoinPanel() {
  const [allChars, setAllChars] = useState([]);
  const [editCoins, setEditCoins] = useState({});

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
    await updateDoc(doc(db, "characters", uid), { [`arenaBuffs.${field}`]: 0 });
  };

  return (
    <div className="am-master-panel">
      <h3 className="am-master-panel-title">🪙 Gestione Monete Arena</h3>
      <p className="am-master-note">Modifica le Monete Arena di qualsiasi giocatore.</p>
      <div className="am-coin-list">
        {allChars.map(ch => {
          const buffs = ch.arenaBuffs || {};
          const ownedItems = ITEM_FIELDS.filter(it => (buffs[it.field] ?? 0) > 0);
          return (
          <div key={ch.uid} className="am-coin-row">
            <span className="am-coin-name">{ch.name || ch.uid}</span>
            <span className="am-coin-val">{ch.arenaCoins ?? 0} MA</span>
            <input
              className="am-coin-input"
              type="number"
              min={0}
              placeholder="nuovo valore"
              value={editCoins[ch.uid] ?? ""}
              onChange={e => setEditCoins(prev => ({ ...prev, [ch.uid]: e.target.value }))}
            />
            <button className="am-coin-save" onClick={() => saveCoins(ch.uid)}>Salva</button>
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
