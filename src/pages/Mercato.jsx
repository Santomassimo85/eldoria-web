import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthContext"; 
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; 
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  increment,
  deleteField,
  writeBatch,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import "../styles/cinematic.css";
import "./Mercato.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const MASTER_EMAIL = "santomassimo85@gmail.com";
const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/padithas.png";
const DIVIDER_IMAGE = "/assets/PhotoStory/GruppoENOX/serpenteArcanite.png";

const ITEM_TYPES = [
  "Arma", "Armatura", "Accessori", "Artefatto Magico",
  "Pozioni", "Pergamene", "Reagenti", "Varie",
];

// Rarità canoniche (allineate a MarketAdmin). Il match nel filtro avviene per
// rank, così aggancia anche gli oggetti legacy (Raro/Magico/Epico…).
const RARITIES = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto"];

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

// Rarità → numero di "gemme" (1–5), stile vecchio GDR.
const RARITY_TIER = {
  Comune: 1, Comune2: 1,
  Noncomune: 2, Raro: 2, Rara: 2,
  Magico: 3, Moltorara: 3,
  Epico: 4,
  Leggendario: 5, Leggendaria: 5, Artefatto: 5,
};
const rarityStars = (rarity) => {
  const tier = RARITY_TIER[(rarity || "Comune").replace(/\s/g, "")] || 1;
  return "★".repeat(tier) + "☆".repeat(5 - tier);
};

// Rank rarità per l'ordinamento (canonico + legacy). Più basso = più comune.
const RARITY_RANK = {
  Comune: 0,
  "Non comune": 1, Noncomune: 1,
  Rara: 2, Raro: 2,
  "Molto rara": 3, Moltorara: 3, Magico: 3, Epico: 3,
  Leggendaria: 4, Leggendario: 4,
  Artefatto: 5,
};
const rarityRank = (rarity) => RARITY_RANK[rarity] ?? RARITY_RANK[(rarity || "").replace(/\s/g, "")] ?? -1;

// Nome del rango Ratto richiesto da un oggetto (0–5).
const rattoLevelName = (lv = 0) => RATTO_LEVELS.find((l) => l.lv === lv)?.name || "Estraneo";

const ItemCard = ({ item, isMaster = false, onRemoveBid, onClearAllBids, onDeliver }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isSold = item.isSold === true;
  const isAuction = item.saleType === "auction";

  const userBidObj = (isAuction && item.bids && currentUser) ? item.bids[currentUser.uid] : null;
  const bids = item.bids ? Object.entries(item.bids) : [];
  const topBid = bids.length ? Math.max(...bids.map(([, b]) => b?.amount ?? b ?? 0)) : 0;

  const rarityName = item.class || "Comune";
  const rarityKey = rarityName.replace(/\s/g, "");
  // Il Master può aprire anche gli oggetti venduti; i player no.
  const open = () => { if (isSold && !isMaster) return; navigate(`/mercato/${item.id}`); };
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={`item-card rarity-bg-${rarityKey} ${isSold ? "sold" : ""} ${isMaster ? "is-admin" : ""}`}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      role="button"
      tabIndex={0}
      title={isSold && !isMaster ? "Oggetto venduto" : `Apri ${item.name}`}
    >
      {/* Rarità in primo piano — banner stile loot RPG */}
      <div className={`ic-rarity-banner rarity-${rarityKey}`}>
        <span className="ic-rarity-stars" aria-hidden="true">{rarityStars(rarityName)}</span>
        <span className="ic-rarity-label">{rarityName}</span>
      </div>

      {/* Immagine grande */}
      <div className="ic-image-frame">
        <img src={item.img || "/assets/placeholder.jpg"} alt={item.name} className="item-image" />
        {item.setPayload?.name && (
          <span className="item-set-badge" title={`Set: ${item.setPayload.name} (${item.setPayload.size || "?"} pezzi)`}>
            ⛓ {item.setPayload.name}{item.setPayload.size ? <small> · {item.setPayload.size}p</small> : null}
          </span>
        )}
        {isMaster && (
          <span className={`ic-state-badge ${isSold ? "sold" : "active"}`}>
            {isSold ? "✅ Venduto" : isAuction ? "🟢 Asta" : "🟢 Fisso"}
          </span>
        )}
        {(Number(item.minLevel) || 0) > 0 && (
          <span className="ic-ratto-badge" title={`Riservato dal rango ${rattoLevelName(Number(item.minLevel) || 0)}`}>
            🐀 Lv {Number(item.minLevel) || 0} · {rattoLevelName(Number(item.minLevel) || 0)}
          </span>
        )}
        {!isSold && !isMaster && <span className="ic-inspect">🔍 Ispeziona</span>}
        {isSold && <span className="ic-sold-stamp">Venduto</span>}
      </div>

      {/* Targhetta */}
      <div className="ic-footer">
        <p className="item-name">{item.name}</p>
        <div className="ic-meta">
          <span className="item-price">
            {isSold
              ? (item.buyerName ? `Preso da ${item.buyerName}` : "Venduto")
              : item.saleType === "fixed"
                ? `${item.price} MP`
                : `Base ${item.startingBid} MP`}
          </span>
          {!isSold && !isMaster && <span className="ic-open">Apri →</span>}
          {isMaster && !isSold && topBid > 0 && <span className="ic-topbid">Top {topBid} MP</span>}
        </div>
        {userBidObj && !isMaster && (
          <span className="your-bid-tag">La tua offerta: {userBidObj.amount || userBidObj} MP</span>
        )}

        {/* ── Pannello Master: offerte + azioni rapide ── */}
        {isMaster && !isSold && (
          <div className="ic-admin" onClick={stop}>
            {bids.length > 0 ? (
              <>
                <div className="ic-bids">
                  {bids
                    .sort((a, b) => (b[1]?.amount ?? b[1] ?? 0) - (a[1]?.amount ?? a[1] ?? 0))
                    .map(([uid, bid]) => {
                      const amount = bid?.amount ?? bid;
                      return (
                        <div key={uid} className="ic-bid-row">
                          <span className="ic-bid-who">{bid?.charName || "Eroe"}</span>
                          <span className="ic-bid-amount">{amount} MP</span>
                          <button
                            className="ic-bid-refund"
                            title="Rimborsa questa offerta"
                            onClick={() => onRemoveBid(item, uid, amount)}
                          >✕</button>
                        </div>
                      );
                    })}
                </div>
                <div className="ic-admin-actions">
                  <button className="ic-act deliver" onClick={() => onDeliver(item)}>
                    🏆 Assegna al vincitore
                  </button>
                  <button className="ic-act refund-all" onClick={() => onClearAllBids(item)}>
                    💰 Rimborsa tutti
                  </button>
                </div>
              </>
            ) : (
              <span className="ic-no-bids">Nessuna offerta</span>
            )}
            <button className="ic-act detail" onClick={() => navigate(`/mercato/${item.id}`)}>
              ↗ Dettaglio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MarketAdminTable = ({ items, onRemoveBid, onClearAllBids, onDeliver }) => {
  const stats = useMemo(() => {
    const total = items.length;
    const sold = items.filter((i) => i.isSold).length;
    const auctions = items.filter((i) => i.saleType === "auction" && !i.isSold).length;
    const totalBids = items.reduce((s, i) => s + (i.bids ? Object.keys(i.bids).length : 0), 0);
    const volume = items.reduce((s, i) => {
      if (!i.bids) return s;
      return s + Object.values(i.bids).reduce((a, b) => a + (b?.amount ?? b ?? 0), 0);
    }, 0);
    return { total, sold, auctions, totalBids, volume };
  }, [items]);

  return (
    <div className="market-admin-wrap">
      <div className="mat-stats">
        <div className="mat-stat"><span>Oggetti</span><strong>{stats.total}</strong></div>
        <div className="mat-stat"><span>Aste attive</span><strong>{stats.auctions}</strong></div>
        <div className="mat-stat"><span>Venduti</span><strong>{stats.sold}</strong></div>
        <div className="mat-stat"><span>Offerte tot.</span><strong>{stats.totalBids}</strong></div>
        <div className="mat-stat highlight"><span>Volume MP</span><strong>{stats.volume}</strong></div>
      </div>

      {/* Stesse card del mercato + controlli Master rapidi su ognuna */}
      <div className="items-grid">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isMaster
            onRemoveBid={onRemoveBid}
            onClearAllBids={onClearAllBids}
            onDeliver={onDeliver}
          />
        ))}
      </div>
    </div>
  );
};

export default function Mercato() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL;

  const [items, setItems] = useState([]);
  const [marketConfig, setMarketConfig] = useState(null);
  const [userRattoPoints, setUserRattoPoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  const [filterSold, setFilterSold] = useState("all"); // all | available | sold
  const [sortBy, setSortBy] = useState("none");

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

  // FUNZIONE MASTER: CONSEGNA, VINCITORE RANDOM, NOTIFICHE E PUNTI RATTO
  const handleMasterDeliver = async (item) => {
    if (!item.bids || Object.keys(item.bids).length === 0) return alert("Nessuna offerta presente.");
    if (!window.confirm(`Consegnare "${item.name}"? In caso di pareggio sceglierò un vincitore a caso.`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const bidsEntries = Object.entries(item.bids);
        
        // 1. Trova l'importo massimo offerto
        const maxAmount = Math.max(...bidsEntries.map(([_, b]) => (typeof b === 'object' ? b.amount : b)));
        
        // 2. Filtra i potenziali vincitori (pareggio alla stessa cifra massima)
        const topBidders = bidsEntries.filter(([_, b]) => {
          const amount = (typeof b === 'object' ? b.amount : b);
          return amount === maxAmount;
        });
        
        // 3. Selezione Casuale tra i migliori offerenti
        const winnerIndex = Math.floor(Math.random() * topBidders.length);
        const [winnerUid, winnerBidData] = topBidders[winnerIndex];
        const winnerAmount = typeof winnerBidData === 'object' ? winnerBidData.amount : winnerBidData;

        // --- Riferimento al personaggio del vincitore ---
        const charRef = doc(db, "characters", winnerUid);

        // --- NOTIFICA AL VINCITORE ---
        const winnerNotifyRef = doc(collection(db, "notifications"));
        transaction.set(winnerNotifyRef, {
          userId: winnerUid,
          title: "Asta Vinta! 🏆",
          message: `Ottimo lavoro! Hai vinto l'asta per "${item.name}" con un'offerta di ${winnerAmount} MP. Guadagni +1 Punto Ratto!`,
          read: false,
          timestamp: serverTimestamp()
        });

        // --- AGGIORNA PERSONAGGIO (PUNTI RATTO +1) ---
        transaction.update(charRef, {
          rattoPoints: increment(1)
        });

        // Aggiorna l'oggetto nel mercato
        transaction.update(doc(db, "items", item.id), {
          isSold: true,
          buyerName: (winnerBidData && winnerBidData.charName) ? winnerBidData.charName : "Un eroe",
          finalPrice: winnerAmount,
          soldAt: new Date().toISOString()
        });

        // --- RIMBORSO E NOTIFICA AGLI SCONFITTI ---
        for (const [uid, bid] of bidsEntries) {
          if (uid !== winnerUid) {
            const amount = typeof bid === 'object' ? bid.amount : bid;
            const loserCharRef = doc(db, "characters", uid);
            const loserNotifyRef = doc(collection(db, "notifications"));

            transaction.update(loserCharRef, { platinum: increment(amount) });
            transaction.set(loserNotifyRef, {
              userId: uid,
              title: "Asta Conclusa ⛔",
              message: `L'asta per "${item.name}" si è conclusa. Non sei il vincitore; i tuoi ${amount} MP sono stati rimborsati nel saldo.`,
              read: false,
              timestamp: serverTimestamp()
            });
          }
        }
      });
      alert("✅ Oggetto consegnato, player notificati e +1 Punto Ratto assegnato!");
    } catch (err) {
      console.error("Errore durante la consegna:", err);
      alert("Errore durante la consegna. Controlla la console.");
    }
  };

  const handleMasterRemoveBid = async (item, playerUid, amount) => {
    if (!window.confirm(`Rimborsare ${amount} MP e inviare notifica a questo player?`)) return;
    try {
      await runTransaction(db, async (transaction) => {
        const charRef = doc(db, "characters", playerUid);
        const itemRef = doc(db, "items", item.id);
        const notifyRef = doc(collection(db, "notifications"));

        const charSnap = await transaction.get(charRef);
        if (!charSnap.exists()) throw "Personaggio non trovato.";

        transaction.update(charRef, { platinum: increment(amount) });
        transaction.update(itemRef, { 
          [`bids.${playerUid}`]: deleteField(), 
          [`bidderEmails.${playerUid}`]: deleteField() 
        });

        transaction.set(notifyRef, {
          userId: playerUid,
          title: "Offerta Rimborsata 💰",
          message: `La tua offerta di ${amount} MP per "${item.name}" è stata rimossa dal Master e le monete rimborsate.`,
          read: false,
          timestamp: serverTimestamp()
        });
      });
      alert("✅ Offerta rimossa e player notificato.");
    } catch (err) {
      console.error(err);
      alert("Errore durante il rimborso.");
    }
  };

  const handleMasterClearAllBids = async (item) => {
    const allBids = item.bids || {};
    if (Object.keys(allBids).length === 0) return alert("Nessuna offerta da rimuovere.");
    if (!window.confirm("Rimborsare TUTTI i player e inviare notifiche?")) return;

    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, "items", item.id);

      for (const [uid, bid] of Object.entries(allBids)) {
        const amount = bid.amount || bid;
        const charRef = doc(db, "characters", uid);
        const notifyRef = doc(collection(db, "notifications"));

        batch.update(charRef, { platinum: increment(amount) });
        batch.set(notifyRef, {
          userId: uid,
          title: "Asta Annullata 📢",
          message: `L'asta per "${item.name}" è stata resettata dal Master. I tuoi ${amount} MP sono stati rimborsati.`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      batch.update(itemRef, { bids: deleteField(), bidderEmails: deleteField() });
      await batch.commit();
      alert("✅ Asta azzerata e tutti notificati.");
    } catch (err) {
      console.error(err);
      alert("Errore durante la pulizia.");
    }
  };

  const ratto = useMemo(() => getRattoStats(userRattoPoints), [userRattoPoints]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const isMarketOpen = typeof marketConfig?.isOpen === "boolean"
      ? marketConfig.isOpen
      : (marketConfig?.nextOpening ? now >= new Date(marketConfig.nextOpening) : true);
    const list = items.filter((item) => {
      if (!isMaster && !isMarketOpen) return false;
      // Livello Ratto: la riserva scatta solo dal livello 2 in su.
      // Liv 0 e liv 1 vedono le STESSE cose (tutto ciò che è sotto il liv 2);
      // dal liv 2 si sbloccano progressivamente gli oggetti riservati.
      // Il Master vede tutto, a prescindere dalla soglia.
      if (!isMaster && (Number(item.minLevel) || 0) > Math.max(ratto.lv, 1)) return false;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || item.type === filterType;
      const matchesRarity = filterRarity === "all" || rarityRank(item.class) === rarityRank(filterRarity);
      const matchesSold =
        filterSold === "all" ||
        (filterSold === "sold" ? item.isSold === true : item.isSold !== true);
      return matchesSearch && matchesType && matchesRarity && matchesSold;
    });

    if (sortBy === "none") return list;
    const priceOf = (i) => Number(i.startingBid ?? i.price ?? 0);
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "price-asc":  return priceOf(a) - priceOf(b);
        case "price-desc": return priceOf(b) - priceOf(a);
        case "rarity-asc":  return rarityRank(a.class) - rarityRank(b.class);
        case "rarity-desc": return rarityRank(b.class) - rarityRank(a.class);
        default: return 0;
      }
    });
  }, [items, marketConfig, searchTerm, filterType, filterRarity, filterSold, sortBy, isMaster, ratto.lv]);

  return (
    <section className="cine-page mercato-page" style={{ "--cine-accent": "#7a2e6e", "--cine-accent-2": "#a3479a" }}>
      {/* ── HERO ── */}
      <section className="cine-hero cine-hero--short" aria-label="Mercato Nero di Exanthia">
        <div className="cine-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-hero-vignette" />
          <div className="cine-hero-gradient" />
          <div className="cine-hero-pattern" />
        </div>
        <div className="cine-hero-content">
          <span className="cine-eyebrow">Il Sottosuolo · Gilda dei Ratti</span>
          <h1 className="cine-hero-title">Mercato Nero di Exanthia</h1>
          <p className="cine-hero-tagline">
            Reagenti proibiti, artefatti rubati e aste cieche. Ogni affare aumenta la tua influenza nell'ombra.
          </p>
        </div>
        <div className="cine-hero-scroll-hint" aria-hidden="true">
          <span>Scorri</span>
          <span className="cine-hero-arrow">↓</span>
        </div>
      </section>

      <div className="cine-wrap cine-wrap--wide mercato-body">
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
        <select onChange={(e) => setFilterSold(e.target.value)} value={filterSold} className="filter-select">
          <option value="all">Venduti e non</option>
          <option value="available">Solo disponibili</option>
          <option value="sold">Solo venduti</option>
        </select>
        <select onChange={(e) => setSortBy(e.target.value)} value={sortBy} className="filter-select">
          <option value="none">Ordina per…</option>
          <option value="price-asc">Prezzo ↑ (basso → alto)</option>
          <option value="price-desc">Prezzo ↓ (alto → basso)</option>
          <option value="rarity-asc">Rarità ↑ (comune → rara)</option>
          <option value="rarity-desc">Rarità ↓ (rara → comune)</option>
        </select>
      </div>
      </div>

      {/* ── DIVISORE: La Merce ── */}
      <section className="cine-scrolly cine-scrolly--short" aria-label="La Merce">
        <div className="cine-scrolly-media" aria-hidden="true">
          <img src={DIVIDER_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-scrolly-bottom-fade" aria-hidden="true" />
        </div>
        <div className="cine-scrolly-content">
          <div className="cine-scrolly-frame">
            <span className="cine-scrolly-eyebrow">Banco del Contrabbando</span>
            <h2 className="cine-scrolly-title">La Merce</h2>
            <p className="cine-scrolly-text">Ciò che nessuna bottega onesta oserebbe esporre.</p>
          </div>
        </div>
      </section>

      <div className="cine-wrap cine-wrap--wide mercato-body">
      {filteredItems.length === 0 ? (
        <div className="market-closed-container">
          <h2 className="closed-title">Il Mercato è Chiuso</h2>
          {marketConfig?.nextOpening && new Date(marketConfig.nextOpening) > new Date() && (
            <MarketTimer targetDate={marketConfig.nextOpening} />
          )}
        </div>
      ) : isMaster ? (
        <MarketAdminTable
          items={filteredItems}
          onRemoveBid={handleMasterRemoveBid}
          onClearAllBids={handleMasterClearAllBids}
          onDeliver={handleMasterDeliver}
        />
      ) : (
        <div className="items-grid">
          {filteredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
      </div>
    </section>
  );
}