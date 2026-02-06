// src/pages/ItemDetail.jsx (AGGIORNATO CON COUNTDOWN, COMPRA ORA E LOGICA ASTA)

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
  increment
} from "firebase/firestore";


// VARIABILE CRITICA: L'URL DEL TUO WEBHOOK PER LE NOTIFICHE AL DM
const NOTIFICATION_WEBHOOK_URL = "https://eoftih1a36e46sq.m.pipedream.net";
// Definizione del percorso base della tua applicazione per costruire il link
const APP_BASE_URL = window.location.origin;

// --- COMPONENTE COUNTDOWN ---
const Countdown = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = +new Date(endDate) - +new Date();
    if (difference < 0) return {};

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  useEffect(() => {
    if (!endDate) return;

    // Se la data è già scaduta al momento del mount, non attivare il timer
    if (+new Date(endDate) <= +new Date()) {
      setTimeLeft({});
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  if (Object.keys(timeLeft).length === 0) {
    return <span className="countdown-expired">Asta Terminata!</span>;
  }

  const timerComponents = [
    timeLeft.days > 0 ? `${timeLeft.days}g` : null,
    `${timeLeft.hours}h`,
    `${timeLeft.minutes}m`,
    `${timeLeft.seconds}s`,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className="countdown-timer">Scadenza: {timerComponents}</span>;
};

export default function ItemDetail() {
  const { currentUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [statusClass, setStatusClass] = useState(""); // Per applicare B&N/Overlay

  // Sincronizzazione in Tempo Reale (Firestore)
  useEffect(() => {
    if (!db || !id) return;

    setLoading(true);

    const itemRef = doc(db, "items", id);

    // onSnapshot: Ascolta i cambiamenti in tempo reale
    const unsubscribe = onSnapshot(
      itemRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setItem(data);
          setMessage("");

          // Aggiorna lo stato di visualizzazione in base ai dati in tempo reale
          const isSoldNow = data?.isSold === true;
          const isAuctionNow = data?.saleType === "auction";
          const hasExpiredNow =
            isAuctionNow && data.endDate && new Date(data.endDate) < new Date();

          if (isSoldNow) {
            setStatusClass("sold-item");
          } else if (hasExpiredNow) {
            setStatusClass("expired-item");
          } else {
            setStatusClass("");
          }
        } else {
          setMessage("Oggetto non trovato nel database.");
          setItem(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Errore onSnapshot:", error);
        setMessage("Errore di connessione al database.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Variabili Calcolate derivanti dallo stato 'item'
  const basePrice = item ? item.startingBid || item.price : 0;
  const isAuction = item?.saleType === "auction";
  const isFixedPrice = item?.saleType === "fixed";

  // Lo stato di interazione viene gestito principalmente dallo statusClass aggiornato in useEffect
  const isSold = statusClass === "sold-item";
  const hasExpired = statusClass === "expired-item";
  const canInteract = !hasExpired && !isSold; // Può fare offerta o comprare

  // Check per offerta utente esistente (solo aste)
  const userBid = currentUser && item?.bids ? item.bids[currentUser.uid] : null;

  // --- LOGICA ACQUISTO IMMEDIATO (PREZZO FISSO) ---
  const handleBuyNow = async () => {
    if (!currentUser || !isFixedPrice || !canInteract) return;

    if (
      !window.confirm(
        `Sei sicuro di voler acquistare ${item.name} per ${item.price} MP? L'acquisto è definitivo.`
      )
    )
      return;

    try {
      const itemRef = doc(db, "items", id);
      await updateDoc(itemRef, {
        isSold: true,
        soldTo: currentUser.email,
        soldAt: new Date().toISOString(),
      });

      // setMessage(
      //   `✅ Oggetto venduto a te per ${item.price} MP! Contatta il DM per la consegna.`
      // );

const userRef = doc(db, 'characters', currentUser.uid);
        await updateDoc(userRef, {
            rattoPoints: increment(1)
        });

        alert("Acquisto completato! Hai guadagnato 1 Punto Ratto.");

      // AGGIORNAMENTO PAYLOAD VENDITA FISSA
      const itemDataForNotification = {
        id,
        name: item?.name,
        description: item?.description,
        type: item?.type,
        rarity: item?.class,
        img: item?.img,
        price: item.price, // Prezzo finale di vendita
      };

      const notificationPayload = {
        type: "VENDITA_FISSA_IMMEDIATA",
        purchasePrice: item.price, // Importo speso
        buyerEmail: currentUser.email,
        buyerName: currentUser.email.split("@")[0],
        item: itemDataForNotification,
        itemLink: `${APP_BASE_URL}/mercato/${id}`,
        timestamp: new Date().toISOString(),
      };

      // Invio webhook
      fetch(NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      });
      // La gestione degli errori del webhook è gestita nel blocco di offerta per completezza
    } catch (error) {
      setMessage(`❌ Errore durante l'acquisto: ${error.message}`);
    }
  };

  // --- LOGICA OFFERTA ASTA (BLIND BID) ---
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    setMessage("");

    // 'offer' è lo stato locale dell'input
    const numericOffer = parseInt(offer, 10);
    // basePrice è una variabile che devi definire nel componente (item.startingBid o 1)
    const basePrice = item.startingBid || 1;

    // Per questa logica Blind Bid (singola offerta), minBid è semplicemente basePrice
    const minBid = basePrice;

    // Controlli preliminari
    if (!currentUser) {
      setMessage("Devi essere loggato per fare un'offerta.");
      return;
    }

    // userBid è una variabile che devi definire nel componente: const userBid = item.bids?.[currentUser.uid];
    if (userBid) {
      setMessage(
        "Hai già piazzato la tua offerta e non puoi modificarla. Annulla prima l'offerta precedente."
      );
      return;
    }
    if (isNaN(numericOffer) || numericOffer < minBid) {
      setMessage(
        `L'offerta deve essere un numero valido e non inferiore al prezzo base di ${minBid} MP.`
      );
      return;
    }

    // canInteract è una variabile che devi definire nel componente: const canInteract = !item.isSold && !hasExpired;
    if (!canInteract) {
      setMessage("Non puoi interagire con un'asta scaduta o venduta.");
      return;
    }

    // Riferimenti ai documenti Firestore
    const itemRef = doc(db, "items", id);
    const charRef = doc(db, "characters", currentUser.uid); // Riferimento al saldo PG (Collezione 'characters')

    try {
      // Avvia la Transazione per garantire l'atomicità
      await runTransaction(db, async (transaction) => {
        // 1. LEGGI IL SALDO DEL PG
        const charDoc = await transaction.get(charRef);

        if (!charDoc.exists()) {
          throw "Saldo Monete non trovato. Contatta il DM.";
        }

        const currentPlatinum = charDoc.data().platinum || 0;

        // 2. CONTROLLO SALDO E INTERROMPI SE INSUFFICIENTE
        if (currentPlatinum < numericOffer) {
          throw `Saldo insufficiente. Hai solo ${currentPlatinum} MP, ma l'offerta è di ${numericOffer} MP.`;
        }

        // 3. AGGIORNA SALDO PG (SOTTRAI MONETE)
        const newPlatinum = currentPlatinum - numericOffer;
        transaction.update(charRef, {
          platinum: newPlatinum,
        });

        // 4. AGGIORNA L'ITEM CON L'OFFERTA
        const newBidMap = {
          [`bids.${currentUser.uid}`]: numericOffer,
          [`bidderEmails.${currentUser.uid}`]: currentUser.email,
        };
        transaction.update(itemRef, newBidMap);
      });

      // --- LOGICA DI NOTIFICA (Eseguita SOLO se la Transazione ha successo) ---
      // Se la transazione ha successo, invia la notifica al DM (Pipedream)
      const payload = {
        type: "NUOVA_OFFERTA_ASTA",
        offerAmount: numericOffer,
        bidderName: currentUser.email.split("@")[0],
        bidderEmail: currentUser.email,
        // Usa la struttura item: { name, id } che hai corretto per Pipedream
        item: {
          name: item.name,
          id: id,
          rarity: item.rarity || item.class,
        },
        itemLink: `${APP_BASE_URL}/mercato/${id}`,
      };

      await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // --- FINE LOGICA DI NOTIFICA ---

      setMessage(
        `✅ Offerta di ${numericOffer} MP registrata! Monete impegnate. Non puoi più modificarla fino alla fine dell'asta.`
      );
      setOffer(""); // Pulisce l'input
    } catch (error) {
      // Gestione degli errori (inclusi quelli sollevati dal blocco 'throw')
      let errorMessage = typeof error === "string" ? error : error.message;
      setMessage(`❌ Errore durante l'offerta: ${errorMessage}`);
      console.error("Transazione fallita:", error);
    }
  };

  // FUNZIONE: ELIMINA OFFERTA E RIMBORSA
  const handleDeleteOffer = async () => {
    if (!currentUser || !userBid) return; // userBid è l'offerta attuale dell'utente

    const offerToRefund = userBid;

    if (
      !window.confirm(
        `Sei sicuro di voler annullare l'offerta di ${offerToRefund} MP? L'importo ti verrà rimborsato immediatamente.`
      )
    )
      return;

    const itemRef = doc(db, "items", id);
    const charRef = doc(db, "characters", currentUser.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const charDoc = await transaction.get(charRef);

        if (!charDoc.exists()) {
          throw "Errore: Saldo Monete non trovato per il rimborso.";
        }

        // 1. RIMBORSA SALDO PG (Incrementa)
        const currentPlatinum = charDoc.data().platinum || 0;
        const newPlatinum = currentPlatinum + offerToRefund;

        transaction.update(charRef, {
          platinum: newPlatinum,
        });

        // 2. ELIMINA OFFERTA DALL'ITEM (usa FieldValue.delete)
        // Rimuove l'utente dai 'bids' e 'bidderEmails'
        transaction.update(itemRef, {
          [`bids.${currentUser.uid}`]: deleteField(),
          [`bidderEmails.${currentUser.uid}`]: deleteField(),
        });
      });

      setMessage(
        `Offerta di ${offerToRefund} MP annullata con successo! L'importo è stato rimborsato.`
      );
      setOffer("");

      
    } catch (error) {
      let errorMessage = typeof error === "string" ? error : error.message;
      setMessage(`❌ Errore durante l'annullamento: ${errorMessage}`);
      console.error("Transazione di rimborso fallita:", error);
    }
  };

  if (loading) {
    return (
      <section className="item-detail-page">
        <p style={{ textAlign: "center" }}>Caricamento Dettagli Item...</p>
      </section>
    );
  }
  if (!item) {
    return (
      <section className="item-detail-page">
        <p style={{ textAlign: "center" }}>
          {message || "Dettagli Item non disponibili."}
        </p>
      </section>
    );
  }

  // Per il render:
  const currentPriceDisplay = item.startingBid || item.price;
  const itemRarity = item.class || "Non Specificata";

  return (
    <section className={`item-detail-page ${statusClass}`}>
      <button onClick={() => navigate("/mercato")} className="back-button">
        ← Torna al Mercato
      </button>

      <div className="detail-content">
        {/* Immagine con filtro B&N se Venduto/Scaduto */}
        <img
          src={item.img || "/assets/placeholder.jpg"}
          alt={item.name}
          className={`detail-image ${isSold || hasExpired ? "grayscale" : ""}`}
        />

        <div className="detail-info">
          <h1>
            {item.name} {isSold && "(VENDUTO)"}
          </h1>

          <div className="item-specs">
            <p>
              <strong>Tipologia:</strong> {item.type || "Generico"}
            </p>
            <p>
              <strong>Rarità:</strong> {itemRarity}
            </p>
          </div>

          <p className="detail-price">
            {isAuction ? "Prezzo Base Asta" : "Prezzo Fisso"}:
            <strong
              style={{
                color: isAuction ? "var(--red)" : "var(--gold)",
                fontSize: "1.2em",
                marginLeft: "10px",
              }}
            >
              {currentPriceDisplay} MP.
            </strong>
          </p>

          {/* COUNTDOWN (h3) Condizionale per Aste */}
          {isAuction && item.endDate && (
            <h3 className="countdown-title">
              <Countdown endDate={item.endDate} />
            </h3>
          )}

          {
            /* Messaggi di stato */
            hasExpired && (
              <p className="offer-message error">
                Asta scaduta! L'oggetto verrà assegnato dal DM.
              </p>
            )
          }
          {userBid && (
            <p className="last-bid-info success">
              Hai già piazzato la tua offerta: {userBid} MP.
            </p>
          )}

          <hr />

          <h2>Descrizione</h2>
          {/* Descrizione renderizzata come HTML */}
          <div
            className="detail-description"
            dangerouslySetInnerHTML={{ __html: item.description }}
          />

          {/* --- SEZIONE INTERAZIONE (VISIBILE SOLO SE canInteract È TRUE) --- */}
          {canInteract && currentUser ? (
            isFixedPrice ? (
              // Pulsante Compra Ora
              <button onClick={handleBuyNow} className="buy-now-button">
                Compra Ora a {item.price} MP
              </button>
            ) : (
              // Form Offerta Asta (visibile solo se non ha ancora offerto)
              !userBid && (
                <div className="offer-section">
                  <form onSubmit={handleSubmitOffer}>
                    <input
                      type="number"
                      placeholder={`Offri almeno ${basePrice} MP`}
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      min={basePrice}
                      required
                    />
                    <button type="submit" className="offer-button">
                      Fai la tua Offerta Cieca
                    </button>
                  </form>
                </div>
              )
            )
          ) : (
            // Messaggi per utente non loggato o interazione bloccata
            !currentUser && (
              <p className="offer-message error">
                Effettua il Login per interagire con il mercato.
              </p>
            )
          )}

          {message && (
            <p
              className={`offer-message ${
                message.includes("registrata") || message.includes("venduto")
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
