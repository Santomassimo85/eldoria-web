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

const MASTER_EMAIL = "santomassimo85@gmail.com";

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
                        <>
                          <ul>
                            {Object.entries(item.bids).map(([uid, bid]) => (
                              <li key={uid} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span><strong>{bid.charName}</strong>: {bid.amount} MP</span>
                                <button 
                                  onClick={() => handleMasterRemoveBid(id, uid, bid.amount)}
                                  style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}
                                >
                                  Rimborsa
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button 
                            onClick={() => handleMasterClearAllBids(id, item.bids)}
                            className="btn-clear-all"
                            style={{ marginTop: '10px', padding: '5px', background: '#8b0000', color: 'white', borderRadius: '4px' }}
                          >
                            Svuota e Rimborsa Tutti
                          </button>
                        </>
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