import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  runTransaction,
  increment,
  deleteField,
  writeBatch
} from "firebase/firestore";

const MASTER_EMAIL = "santomassimo85@gmail.com";

const ITEM_TYPES = [
  "Arma", "Armatura", "Accessori", "Artefatto Magico",
  "Pozioni", "Pergamene", "Reagenti", "Varie",
];

const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];

const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo" },
  { lv: 1, min: 5, name: "Simpatizzante" },
  { lv: 2, min: 15, name: "Informatore" },
  { lv: 3, min: 30, name: "Ricettatore" },
  { lv: 4, min: 50, name: "Veterano" },
  { lv: 5, min: 80, name: "Ombra di Obia" },
];

const getRattoStats = (points = 0) => {
  const current = [...RATTO_LEVELS].reverse().find((l) => points >= l.min) || RATTO_LEVELS[0];
  const next = RATTO_LEVELS[current.lv + 1] || null;
  let progress = 100;
  if (next) {
    const range = next.min - current.min;
    const earned = points - current.min;
    progress = Math.min(Math.max((earned / range) * 100, 0), 100);
  }
  return { ...current, next, progress };
};

const MarketTimer = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!targetDate) return;
    const timer = setInterval(() => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) {
        setTimeLeft("APERTURA!");
        clearInterval(timer);
      } else {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${d}g ${h}h ${m}m ${s}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);
  return <div className="timer-display">{timeLeft}</div>;
};

const ItemCard = ({ item, isMaster, onRemoveBid, onClearAllBids }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isSold = item.isSold === true;
  const isAuction = item.saleType === "auction";

  // Recupero offerta del player corrente per feedback visivo
  const userBidObj = (isAuction && item.bids && currentUser) ? item.bids[currentUser.uid] : null;

  return (
    <div className={`item-card ${isSold ? "sold" : ""} ${isMaster ? "admin-card-expanded" : ""}`} onClick={() => !isSold && navigate(`/mercato/${item.id}`)}>
      <img src={item.img || "/assets/placeholder.jpg"} alt={item.name} className="item-image" />
      
      <div className="item-details">
        <p className={`item-rarity item-rarity-${(item.class || "Comune").replace(/\s/g, "")}`}>
          {item.class || "Comune"}
        </p>
        <p className="item-name"><strong>{item.name}</strong></p>
        <p className="item-price">
          {isSold ? "VENDUTO" : item.saleType === "fixed" ? `${item.price} MP` : `Base: ${item.startingBid} MP`}
        </p>

        {/* --- NUOVA SEZIONE: DESCRIZIONE --- */}
        <div 
          className="item-card-description"
          dangerouslySetInnerHTML={{ __html: item.description }}
        />

        <div className="item-bids-summary">
          {isMaster && item.bids && Object.keys(item.bids).length > 0 && (
            <div className="master-bids-view">
              <p className="bid-title">📢 Offerte ({Object.keys(item.bids).length}):</p>
              {Object.entries(item.bids).map(([uid, bid]) => (
                <div key={uid} className="bid-row-admin" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <small>{bid.charName || "Eroe"}: <strong>{bid.amount || bid} MP</strong></small>
                  <button 
                    className="btn-remove-bid" 
                    title="Rimborsa e Rimuovi"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onRemoveBid(item.id, uid, bid.amount || bid); 
                    }}
                    style={{color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold'}}
                  >✕</button>
                </div>
              ))}
              <button 
                className="btn-clear-all-bids" 
                onClick={(e) => { e.stopPropagation(); onClearAllBids(item.id, item.bids); }}
                style={{width: '100%', marginTop: '10px', background: '#c0392b', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer'}}
              >Svuota e Rimborsa Tutti</button>
            </div>
          )}

          {!isMaster && userBidObj && (
            <div className="player-bid-view">
              <span className="your-bid-tag">Hai offerto: {userBidObj.amount || userBidObj} MP</span>
            </div>
          )}
          
          {isSold && item.buyerName && (
            <div className="sold-to-info">
              <small>Preso da: {item.buyerName}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Mercato() {
  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL;

  const [items, setItems] = useState([]);
  const [marketConfig, setMarketConfig] = useState(null);
  const [userRattoPoints, setUserRattoPoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "settings", "market_config"), (snap) => snap.exists() && setMarketConfig(snap.data()));
    const unsubItems = onSnapshot(collection(db, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    let unsubUser = () => {};
    if (currentUser) {
      unsubUser = onSnapshot(doc(db, "characters", currentUser.uid), (snap) => {
        if (snap.exists()) setUserRattoPoints(snap.data().rattoPoints || 0);
      });
    }

    return () => { unsubConfig(); unsubItems(); unsubUser(); };
  }, [currentUser]);

  const handleMasterRemoveBid = async (itemId, playerUid, amount) => {
    if (!window.confirm(`Rimborsare ${amount} MP e rimuovere l'offerta di questo player?`)) return;
    try {
      await runTransaction(db, async (transaction) => {
        const charRef = doc(db, "characters", playerUid);
        const itemRef = doc(db, "items", itemId);
        const charSnap = await transaction.get(charRef);
        if (!charSnap.exists()) throw "Personaggio non trovato.";
        transaction.update(charRef, { platinum: increment(amount) });
        transaction.update(itemRef, { [`bids.${playerUid}`]: deleteField(), [`bidderEmails.${playerUid}`]: deleteField() });
      });
      alert("✅ Offerta rimossa e player rimborsato.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il rimborso.");
    }
  };

  const handleMasterClearAllBids = async (itemId, allBids) => {
    if (!window.confirm("Rimborsare TUTTI i player e svuotare le offerte di questo oggetto?")) return;
    try {
      const batch = writeBatch(db);
      for (const [uid, bid] of Object.entries(allBids)) {
        const amount = bid.amount || bid;
        batch.update(doc(db, "characters", uid), { platinum: increment(amount) });
      }
      batch.update(doc(db, "items", itemId), { bids: deleteField(), bidderEmails: deleteField() });
      await batch.commit();
      alert("✅ Tutte le offerte rimborsate e cancellate.");
    } catch (err) {
      console.error(err);
      alert("Errore durante la pulizia.");
    }
  };

  const ratto = useMemo(() => getRattoStats(userRattoPoints), [userRattoPoints]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const isMarketOpen = marketConfig?.nextOpening ? now >= new Date(marketConfig.nextOpening) : true;
    return items.filter((item) => {
      if (!isMaster && !isMarketOpen) return false;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || item.type === filterType;
      const matchesRarity = filterRarity === "all" || item.class === filterRarity;
      return matchesSearch && matchesType && matchesRarity;
    });
  }, [items, marketConfig, searchTerm, filterType, filterRarity, isMaster]);

  return (
    <section className="mercato-page">
      <h1 className="main-title">Mercato Nero di Eldoria</h1>

      {currentUser && (
        <div className="ratto-status-container">
          <div className="ratto-info">
            <span className="ratto-label">Rango Ratto:</span>
            <span className="ratto-name">{ratto.name}</span>
            <span className="ratto-points">({userRattoPoints} pt)</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${ratto.progress}%` }}></div>
          </div>
          {ratto.next && (
            <small className="ratto-next-info">
              Mancano {ratto.next.min - userRattoPoints} punti a {ratto.next.name}
            </small>
          )}
        </div>
      )}

      {isMaster && <div className="admin-notice">⚠️ VISTA MASTER ATTIVA</div>}

      <div className="mercato-controls">
        <input
          type="text"
          placeholder="Cerca..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
        <select onChange={(e) => setFilterType(e.target.value)} value={filterType} className="filter-select">
          <option value="all">Tutti i Tipi</option>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select onChange={(e) => setFilterRarity(e.target.value)} value={filterRarity} className="filter-select">
          <option value="all">Tutte le Rarità</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="items-grid">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isMaster={isMaster}
              onRemoveBid={handleMasterRemoveBid}
              onClearAllBids={handleMasterClearAllBids}
            />
          ))
        ) : (
          <div className="market-closed-container">
            <h2 className="closed-title">Il Mercato è Chiuso</h2>
            {marketConfig?.nextOpening && new Date(marketConfig.nextOpening) > new Date() && (
              <MarketTimer targetDate={marketConfig.nextOpening} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}