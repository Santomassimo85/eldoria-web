// src/pages/ItemDetail.jsx
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
  writeBatch // <-- AGGIUNGI QUESTO
} from "firebase/firestore";

const MASTER_EMAIL = "santomassimo85@gmail.com";

/**
 * Componente Countdown per le aste
 */
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
   * ACQUISTO IMMEDIATO (Prezzo Fisso)
   */
  const handleBuyNow = async () => {
    if (!currentUser || item.saleType !== "fixed" || item.isSold) return;
    if (!window.confirm(`Comprare ${item.name} per ${item.price} MP?`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "characters", currentUser.uid);
        const itemRef = doc(db, "items", id);
        const charSnap = await transaction.get(userRef);
        const itemSnap = await transaction.get(itemRef);

        const currentPlat = charSnap.data().platinum || 0;
        if (currentPlat < item.price) throw "Fondi insufficienti!";
        if (itemSnap.data().isSold) throw "Già venduto!";

        transaction.update(userRef, { 
            platinum: currentPlat - item.price,
            rattoPoints: increment(1) 
        });
        transaction.update(itemRef, { 
            isSold: true, 
            buyerName: charSnap.data().name || currentUser.email.split("@")[0],
            soldAt: new Date().toISOString()
        });
      });
      alert("Acquisto completato!");
    } catch (err) {
      setMessage(`❌ Errore: ${err}`);
    }
  };
/**
 * Funzione Master: Rimuove una singola offerta e rimborsa il player
 */
const handleMasterRemoveBid = async (itemId, playerUid, amount) => {
  if (!window.confirm(`Rimborsare ${amount} MP e rimuovere l'offerta di questo player?`)) return;

  try {
    await runTransaction(db, async (transaction) => {
      const charRef = doc(db, "characters", playerUid);
      const itemRef = doc(db, "items", itemId);
      
      const charSnap = await transaction.get(charRef);
      if (!charSnap.exists()) throw "Personaggio non trovato.";

      // 1. Rimborsa i soldi
      transaction.update(charRef, {
        platinum: increment(amount)
      });

      // 2. Rimuove l'offerta dall'item
      transaction.update(itemRef, {
        [`bids.${playerUid}`]: deleteField(),
        [`bidderEmails.${playerUid}`]: deleteField()
      });
    });
    alert("✅ Offerta rimossa e player rimborsato.");
  } catch (error) {
    console.error("Errore rimborso:", error);
    alert("Errore durante il rimborso.");
  }
};

/**
 * Funzione Master: Rimborsa TUTTI i partecipanti di un'asta e la svuota
 */
const handleMasterClearAllBids = async (itemId, allBids) => {
  if (!window.confirm("Vuoi davvero rimborsare TUTTI i player e svuotare le offerte di questo oggetto?")) return;

  try {
    const batch = writeBatch(db); // Usiamo batch per velocità se sono molti
    const itemRef = doc(db, "items", itemId);

    for (const [uid, bid] of Object.entries(allBids)) {
      const charRef = doc(db, "characters", uid);
      const amount = bid.amount || bid;
      batch.update(charRef, { platinum: increment(amount) });
    }

    batch.update(itemRef, {
      bids: deleteField(),
      bidderEmails: deleteField()
    });

    await batch.commit();
    alert("✅ Tutte le offerte sono state rimborsate e cancellate.");
  } catch (error) {
    console.error("Errore pulizia totale:", error);
  }
};


  /**
   * OFFERTA ALLA CIECA (Asta)
   */
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    const amount = parseInt(offer);
    if (!currentUser || amount < (item.startingBid || 0)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "characters", currentUser.uid);
        const itemRef = doc(db, "items", id);
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
      });
      setMessage("✅ Offerta registrata!");
      setOffer("");
    } catch (err) {
      setMessage(`❌ Errore: ${err}`);
    }
  };

  if (loading) return <section className="item-detail-page"><p className="loading-text">Caricamento...</p></section>;
  if (!item) return <section className="item-detail-page"><p className="error-text">Oggetto non trovato.</p></section>;

  return (
    <section className={`item-detail-page ${statusClass}`}>
      <button onClick={() => navigate("/mercato")} className="back-button">← Torna al Mercato</button>

      <div className="detail-content">
        <img src={item.img || "/assets/placeholder.jpg"} alt={item.name} className="detail-image" />

        <div className="detail-info">
          <h1 className="detail-title">{item.name} {item.isSold && "(VENDUTO)"}</h1>

          <div className="item-specs">
            <p><strong>Tipo:</strong> {item.type}</p>
            <p><strong>Rarità:</strong> {item.class}</p>
          </div>

          <p className="detail-price">
            {item.saleType === "auction" ? "Base d'Asta:" : "Prezzo:"} 
            <span className="price-value"> {item.startingBid || item.price} MP</span>
          </p>

          {item.saleType === "auction" && item.endDate && !item.isSold && (
            <div className="auction-timer-box">
              <Countdown endDate={item.endDate} />
            </div>
          )}

          <div className="detail-description" dangerouslySetInnerHTML={{ __html: item.description }} />

          {/* LOGICA TRANSAZIONI */}
          <div className="item-interaction-area">
            {!item.isSold && currentUser && (
              item.saleType === "fixed" ? (
                <button onClick={handleBuyNow} className="buy-now-button">Acquista Ora</button>
              ) : (
                !userBid && statusClass !== "expired-item" && (
                  <form onSubmit={handleSubmitOffer} className="offer-form">
                    <input 
                      type="number" 
                      value={offer} 
                      onChange={(e) => setOffer(e.target.value)} 
                      placeholder="Inserisci offerta..." 
                      min={item.startingBid} 
                      required 
                    />
                    <button type="submit" className="offer-button">Piazza Offerta alla Cieca</button>
                  </form>
                )
              )
            )}

            {/* INFO OFFERTE / ACQUIRENTE */}
            <div className="item-bids-summary">
              {item.isSold && item.buyerName && (
                <div className="sold-info-box">
                  <p>💰 Acquistato da: <strong>{item.buyerName}</strong></p>
                </div>
              )}

              {item.saleType === "auction" && (
                <div className="auction-info-display">
                  {isMaster ? (
                    <div className="master-bids-list">
                      <h3>Lista Offerte (DM)</h3>
                      {item.bids && Object.keys(item.bids).length > 0 ? (
                        <ul>
                          {Object.entries(item.bids).map(([uid, bid]) => (
                            <li key={uid}>
                              <strong>{bid.charName}</strong>: {bid.amount} MP
                            </li>
                          ))}
                        </ul>
                      ) : <p>Nessuna offerta.</p>}
                    </div>
                  ) : (
                    userBid && (
                      <div className="player-bid-confirmation">
                        <p>✅ Hai offerto <strong>{userBid.amount} MP</strong></p>
                        <small>L'esito verrà comunicato alla chiusura.</small>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {message && <p className="status-message">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}