import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db } from "../firebase"; 
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  runTransaction,
  increment,
  writeBatch,
  addDoc,           // AGGIUNTO per notifiche
  collection,       // AGGIUNTO per notifiche
  serverTimestamp   // AGGIUNTO per notifiche
} from "firebase/firestore";
import "../styles/cinematic.css";
import "./ItemDetail.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

// Riquadro che mostra le info del set tematico dell'oggetto.
// Render solo se setPayload è valorizzato con almeno un bonus.
const SetBonusBlock = ({ setPayload }) => {
  if (!setPayload || !setPayload.name) return null;
  const bonuses = Array.isArray(setPayload.bonuses) ? setPayload.bonuses : [];
  const sorted = [...bonuses]
    .filter(b => b && b.effect && Number(b.pieces) > 0)
    .sort((a, b) => Number(a.pieces) - Number(b.pieces));
  const size = Number(setPayload.size) || 0;
  return (
    <div className="ps-set-block">
      <div className="ps-set-head">
        <span className="ps-set-icon">⛓</span>
        <div>
          <strong className="ps-set-name">{setPayload.name}</strong>
          {size > 0 && <small className="ps-set-size"> · {size} pezzi</small>}
        </div>
      </div>
      {sorted.length > 0 && (
        <ul className="ps-set-bonus-list">
          {sorted.map((b, i) => (
            <li key={i} className="ps-set-bonus-item">
              <span className="ps-set-bonus-frac">{b.pieces}/{size || "?"}</span>
              <span className="ps-set-bonus-effect">{b.effect}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Countdown = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!endDate) return;
    const timer = setInterval(() => {
      const diff = new Date(endDate) - new Date();
      if (diff <= 0) {
        setTimeLeft("ASTA SCADUTA");
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
  }, [endDate]);

  return <span className="countdown-timer">{timeLeft}</span>;
};

export default function ItemDetail() {
  const { currentUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [statusClass, setStatusClass] = useState("");

  useEffect(() => {
    if (!id) return;
    const itemRef = doc(db, "items", id);
    const unsubscribe = onSnapshot(itemRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setItem(data);
        if (data.isSold) setStatusClass("sold-item");
        else if (data.saleType === "auction" && data.endDate && new Date(data.endDate) < new Date()) {
          setStatusClass("expired-item");
        } else setStatusClass("");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const userBid = (currentUser && item?.bids) ? item.bids[currentUser.uid] : null;

  /**
   * ACQUISTO IMMEDIATO (Prezzo Fisso) + NOTIFICA
   */
  const handleBuyNow = async () => {
    if (!currentUser || item.saleType !== "fixed" || item.isSold) return;
    if (!window.confirm(`Comprare ${item.name} per ${item.price} MP?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "characters", currentUser.uid);
        const itemRef = doc(db, "items", id);
        const notifyRef = doc(collection(db, "notifications")); // Ref per la notifica
        
        const charSnap = await transaction.get(userRef);
        const itemSnap = await transaction.get(itemRef);

        const currentPlat = charSnap.data().platinum || 0;
        if (currentPlat < item.price) throw "Fondi insufficienti!";
        if (itemSnap.data().isSold) throw "Già venduto!";

        // 1. Aggiorna Personaggio
        transaction.update(userRef, { 
            platinum: currentPlat - item.price,
            rattoPoints: increment(1) 
        });

        // 2. Aggiorna Oggetto
        transaction.update(itemRef, { 
            isSold: true, 
            buyerName: charSnap.data().name || currentUser.email.split("@")[0],
            soldAt: new Date().toISOString()
        });

        // 3. Invia Notifica di Conferma Acquisto
        transaction.set(notifyRef, {
          userId: currentUser.uid,
          title: "Acquisto Confermato! 🛒",
          message: `Hai acquistato "${item.name}" per ${item.price} MP. L'oggetto è ora tuo!`,
          read: false,
          timestamp: serverTimestamp()
        });
      });
      alert("Acquisto completato!");
    } catch (err) {
      setMessage(`❌ Errore: ${err}`);
    }
  };



  
  /**
   * Funzione Master: Rimuove una singola offerta, rimborsa e NOTIFICA
   */
  const handleMasterRemoveBid = async (itemId, playerUid, amount) => {
    if (!window.confirm(`Rimborsare ${amount} MP e inviare notifica a questo player?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const charRef = doc(db, "characters", playerUid);
        const itemRef = doc(db, "items", itemId);
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
          message: `La tua offerta per "${item.name}" è stata rimossa dal Master. Ti sono stati rimborsati ${amount} MP.`,
          read: false,
          timestamp: serverTimestamp()
        });
      });
      alert("✅ Offerta rimossa, player rimborsato e notificato.");
    } catch (error) {
      console.error("Errore rimborso:", error);
    }
  };

  /**
   * Funzione Master: Rimborsa TUTTI e NOTIFICA TUTTI
   */
  const handleMasterClearAllBids = async (itemId, allBids) => {
    if (!window.confirm("Rimborsare TUTTI i player e svuotare le offerte? Verranno inviate notifiche automatiche.")) return;

    try {
      const batch = writeBatch(db);
      const itemRef = doc(db, "items", itemId);

      for (const [uid, bid] of Object.entries(allBids)) {
        const charRef = doc(db, "characters", uid);
        const notifyRef = doc(collection(db, "notifications"));
        const amount = bid.amount || bid;

        batch.update(charRef, { platinum: increment(amount) });
        batch.set(notifyRef, {
          userId: uid,
          title: "Asta Annullata 📢",
          message: `L'asta per "${item.name}" è stata resettata. Ricevi un rimborso di ${amount} MP.`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      batch.update(itemRef, { bids: deleteField(), bidderEmails: deleteField() });
      await batch.commit();
      alert("✅ Tutte le offerte rimborsate e player notificati.");
    } catch (error) {
      console.error("Errore pulizia totale:", error);
    }
  };

  /**
   * OFFERTA ALLA CIECA (Asta) + NOTIFICA
   */
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    const amount = parseInt(offer);
    if (!currentUser || amount < (item.startingBid || 0)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "characters", currentUser.uid);
        const itemRef = doc(db, "items", id);
        const notifyRef = doc(collection(db, "notifications"));
        const charSnap = await transaction.get(userRef);

        const currentPlat = charSnap.data().platinum || 0;
        if (currentPlat < amount) throw "Fondi insufficienti per l'offerta!";

        transaction.update(userRef, { platinum: currentPlat - amount });
        transaction.update(itemRef, {
          [`bids.${currentUser.uid}`]: {
            amount: amount,
            charName: charSnap.data().name || currentUser.email.split("@")[0],
            timestamp: new Date().toISOString()
          }
        });

        transaction.set(notifyRef, {
          userId: currentUser.uid,
          title: "Offerta Piazzata! 🎲",
          message: `Hai puntato ${amount} MP per "${item.name}". Incrocia le dita!`,
          read: false,
          timestamp: serverTimestamp()
        });
      });
      setMessage("✅ Offerta registrata!");
      setOffer("");
      // 🐣 pet system: +1 point (capped 5/day)
      try {
        const { awardPetPoints } = await import("../utils/pet");
        awardPetPoints(currentUser.uid, "market_bid", { resourceKey: id });
      } catch {}
    } catch (err) {
      setMessage(`❌ Errore: ${err}`);
    }
  };

  if (loading) return <section className="cine-page item-detail-page"><p className="loading-text">Caricamento...</p></section>;
  if (!item) return <section className="cine-page item-detail-page"><p className="error-text">Oggetto non trovato.</p></section>;

  const rarityKey = (item.class || "Comune").replace(/\s/g, "");
  const bidEntries = item.bids ? Object.entries(item.bids) : [];
  const bidVolume = bidEntries.reduce((s, [, b]) => s + (b?.amount ?? b ?? 0), 0);
  const bidHighest = bidEntries.reduce((m, [, b]) => Math.max(m, b?.amount ?? b ?? 0), 0);

  return (
    <section className={`cine-page item-detail-page ${statusClass} ${isMaster ? "view-master" : "view-player"}`} style={{ "--cine-accent": "#7a2e6e", "--cine-accent-2": "#a3479a" }}>
      <button
        onClick={() => navigate("/mercato")}
        className={`back-button ${isMaster ? "admin-back-button" : ""}`}
      >
        ← Torna al Mercato
      </button>

      {isMaster ? (
        // ─────────────────────────────  MASTER CONSOLE  ─────────────────────────────
        <div className="master-console">
          <div className="mc-header">
            <img src={item.img || "/assets/placeholder.jpg"} alt={item.name} className="mc-thumb" />
            <div className="mc-meta">
              <h1 className="mc-title">{item.name}</h1>
              <div className="mc-tags">
                <span className={`mc-tag rarity-${rarityKey}`}>{item.class || "Comune"}</span>
                <span className="mc-tag">{item.type}</span>
                <span className={`mc-tag tag-${item.saleType}`}>
                  {item.saleType === "auction" ? "ASTA CIECA" : "PREZZO FISSO"}
                </span>
                {item.isSold && <span className="mc-tag tag-sold">VENDUTO</span>}
              </div>
              <p className="mc-price">
                <span>{item.saleType === "auction" ? "Base d'asta" : "Prezzo"}</span>
                <strong>{item.startingBid || item.price} MP</strong>
              </p>
              {item.saleType === "auction" && item.endDate && !item.isSold && (
                <div className="mc-timer">
                  <span className="mc-timer-label">Scadenza:</span>
                  <Countdown endDate={item.endDate} />
                </div>
              )}
            </div>
          </div>

          {item.description && (
            <details className="mc-description">
              <summary>Descrizione oggetto</summary>
              <div dangerouslySetInnerHTML={{ __html: item.description }} />
            </details>
          )}

          <SetBonusBlock setPayload={item.setPayload} />

          {item.saleType === "auction" && (
            <>
              <div className="mc-stats">
                <div className="mc-stat">
                  <span>Offerte ricevute</span>
                  <strong>{bidEntries.length}</strong>
                </div>
                <div className="mc-stat">
                  <span>Volume totale</span>
                  <strong>{bidVolume} <small>MP</small></strong>
                </div>
                <div className="mc-stat highlight">
                  <span>Offerta più alta</span>
                  <strong>{bidHighest} <small>MP</small></strong>
                </div>
              </div>

              <div className="mc-bids">
                <div className="mc-bids-head">
                  <h3>📋 Lista Offerte</h3>
                  {bidEntries.length > 0 && (
                    <button
                      onClick={() => handleMasterClearAllBids(id, item.bids)}
                      className="mc-btn danger"
                    >
                      Svuota & Rimborsa Tutti
                    </button>
                  )}
                </div>
                {bidEntries.length > 0 ? (
                  <div className="mc-bids-table-wrap">
                    <table className="mc-bids-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Personaggio</th>
                          <th>Offerta</th>
                          <th>Quando</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bidEntries
                          .sort(([, a], [, b]) => (b?.amount ?? b ?? 0) - (a?.amount ?? a ?? 0))
                          .map(([uid, bid], idx) => {
                            const amount = bid?.amount ?? bid;
                            const charName = bid?.charName || "Eroe Anonimo";
                            const ts = bid?.timestamp ? new Date(bid.timestamp).toLocaleString("it-IT") : "—";
                            const isTop = (bid?.amount ?? bid) === bidHighest;
                            return (
                              <tr key={uid} className={isTop ? "top-bid" : ""}>
                                <td className="mc-rank">{idx + 1}</td>
                                <td><strong>{charName}</strong></td>
                                <td className="mc-bid-amount">{amount} MP</td>
                                <td className="mc-bid-time">{ts}</td>
                                <td>
                                  <button
                                    onClick={() => handleMasterRemoveBid(id, uid, amount)}
                                    className="mc-btn ghost"
                                  >
                                    ↩ Rimborsa
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mc-empty">Nessuna offerta ancora ricevuta.</p>
                )}
              </div>
            </>
          )}

          {item.isSold && item.buyerName && (
            <div className="mc-sold-banner">
              💰 Venduto a <strong>{item.buyerName}</strong>
              {item.finalPrice && <> per <strong>{item.finalPrice} MP</strong></>}
            </div>
          )}

          {message && <p className="status-message">{message}</p>}
        </div>
      ) : (
        // ─────────────────────────────  PLAYER SHOWCASE  ─────────────────────────────
        <div className={`player-showcase rarity-bg-${rarityKey}`}>
          <div className="ps-image-wrap">
            <img src={item.img || "/assets/placeholder.jpg"} alt={item.name} className="ps-image" />
            <span className={`ps-rarity-badge rarity-${rarityKey}`}>{item.class || "Comune"}</span>
            {item.isSold && <div className="ps-sold-overlay">VENDUTO</div>}
            {statusClass === "expired-item" && !item.isSold && <div className="ps-sold-overlay expired">SCADUTA</div>}
          </div>

          <div className="ps-info">
            <p className="ps-type">{item.type}</p>
            <h1 className="ps-title">{item.name}</h1>

            <div className="ps-price-row">
              <span className="ps-price-label">
                {item.saleType === "auction" ? "Base d'asta" : "Prezzo"}
              </span>
              <span className="ps-price-value">
                {item.startingBid || item.price}<small> MP</small>
              </span>
            </div>

            {item.saleType === "auction" && item.endDate && !item.isSold && (
              <div className="ps-timer">
                <span className="ps-timer-label">⏳ Tempo rimasto</span>
                <Countdown endDate={item.endDate} />
              </div>
            )}

            <div className="ps-description" dangerouslySetInnerHTML={{ __html: item.description }} />

            <SetBonusBlock setPayload={item.setPayload} />

            {!item.isSold && currentUser && (
              item.saleType === "fixed" ? (
                <button onClick={handleBuyNow} className="ps-buy-btn">⚡ Acquista Ora · {item.price} MP</button>
              ) : (
                !userBid && statusClass !== "expired-item" && (
                  <form onSubmit={handleSubmitOffer} className="ps-offer-form">
                    <input
                      type="number"
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      placeholder={`Min ${item.startingBid} MP`}
                      min={item.startingBid}
                      required
                    />
                    <button type="submit" className="ps-bid-btn">🎲 Offerta alla Cieca</button>
                  </form>
                )
              )
            )}

            {userBid && (
              <div className="ps-your-bid">
                <span className="ps-bid-tag">La tua offerta segreta</span>
                <strong>{userBid.amount} MP</strong>
                <small>L'esito ti arriverà nelle notifiche alla chiusura.</small>
              </div>
            )}

            {item.isSold && item.buyerName && (
              <div className="ps-sold-info">💰 Acquistato da <strong>{item.buyerName}</strong></div>
            )}

            {message && <p className="status-message">{message}</p>}
          </div>
        </div>
      )}
    </section>
  );
}