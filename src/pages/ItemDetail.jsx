// src/pages/ItemDetail.jsx (AGGIORNATO CON COUNTDOWN, COMPRA ORA E LOGICA ASTA)

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { db } from "../firebase"; // Assicurati che il percorso sia corretto
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

// ⚠️ VARIABILE CRITICA: L'URL DEL TUO WEBHOOK PER LE NOTIFICHE AL DM
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

      setMessage(
        `✅ Oggetto venduto a te per ${item.price} MP! Contatta il DM per la consegna.`
      );

      // Invia notifica di vendita immediata al DM
      const notificationPayload = {
        type: "VENDITA_FISSA_IMMEDIATA",
        itemName: item.name,
        itemId: id, // ID corretto
        price: item.price,
        buyerName: currentUser.email.split("@")[0], // Nome utente
        buyerEmail: currentUser.email,
        itemLink: `${APP_BASE_URL}/mercato/${id}`, // Link corretto all'oggetto
      };
      fetch(NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      });
    } catch (error) {
      setMessage(`❌ Errore durante l'acquisto: ${error.message}`);
    }
  };

  // --- LOGICA OFFERTA ASTA (BLIND BID) ---
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    setMessage("");

    const numericOffer = parseInt(offer, 10);
    const minBid = basePrice;

    if (!currentUser) {
      setMessage("Devi essere loggato per fare un'offerta.");
      return;
    }
    if (userBid) {
      setMessage("Hai già piazzato la tua offerta e non puoi modificarla.");
      return;
    }
    if (isNaN(numericOffer) || numericOffer < minBid) {
      setMessage(
        `L'offerta deve essere un numero valido, maggiore o uguale al prezzo base (${minBid} MP).`
      );
      return;
    }
    if (!canInteract) {
      setMessage(isSold ? "L'oggetto è stato venduto." : "L'asta è terminata.");
      return;
    }

    try {
      const itemRef = doc(db, "items", id);

      // 1) Aggiorna Firestore con la mappatura delle offerte
      const newBidMap = {
        [`bids.${currentUser.uid}`]: numericOffer,
        [`bidderEmails.${currentUser.uid}`]: currentUser.email,
      };
      await updateDoc(itemRef, newBidMap);

      // 2) Prepara e invia il payload al webhook (contiene prezzo, email offerente e dati item)
      const itemDataForNotification = {
        id,
        name: item?.name,
        description: item?.description,
        type: item?.type,
        rarity: item?.class,
        img: item?.img,
        startingBid: item?.startingBid ?? item?.price,
        endDate: item?.endDate,
      };

      const notificationPayload = {
        type: "NUOVA_OFFERTA_ASTA",
        offerAmount: numericOffer,
        bidderEmail: currentUser.email,
        bidderName: currentUser.email.split("@")[0],
        item: itemDataForNotification,
        itemLink: `${APP_BASE_URL}/mercato/${id}`,
        timestamp: new Date().toISOString(),
      };

      let webhookOk = true;
      try {
        const webhookResponse = await fetch(NOTIFICATION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notificationPayload),
        });
        if (!webhookResponse.ok) webhookOk = false;
      } catch (err) {
        console.error("Errore invio webhook:", err);
        webhookOk = false;
      }

      // 3) Messaggio utente in base al risultato
      if (webhookOk) {
        setMessage(
          `✅ Offerta di ${numericOffer} MP registrata! Notifica inviata al DM. Non puoi più modificarla fino alla fine dell'asta.`
        );
      } else {
        setMessage(
          `✅ Offerta di ${numericOffer} MP registrata! Tuttavia la notifica non è stata inviata correttamente. Contatta il DM manualmente.`
        );
      }

      setOffer("");
    } catch (error) {
      console.error("Errore nell'offerta:", error);
      setMessage(
        `❌ Errore durante la registrazione dell'offerta: ${error.message}`
      );
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

          {/* 🎯 COUNTDOWN (h3) Condizionale per Aste */}
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
          {/* ⚠️ Descrizione renderizzata come HTML */}
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
