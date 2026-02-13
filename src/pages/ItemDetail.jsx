// src/pages/ItemDetail.jsx
// Component for displaying item details with support for both fixed-price and auction sales
// Features: Real-time Firestore sync, blind bidding system, instant purchase, countdown timer

import { useState, useEffect } from "react";
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

// CRITICAL VARIABLE: Discord webhook URL for notifications
const NOTIFICATION_WEBHOOK_URL = "https://eoftih1a36e46sq.m.pipedream.net";
// Base URL for constructing item links in notifications
const APP_BASE_URL = window.location.origin;

/**
 * Countdown Component
 * Displays a live countdown timer for auction end dates
 * @param {string} endDate - ISO string of auction end date
 */
const Countdown = ({ endDate }) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  /**
   * Calculates remaining time until auction end
   * @returns {object} Object with days, hours, minutes, seconds properties
   */
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

    // Exit early if auction has already ended
    if (+new Date(endDate) <= +new Date()) {
      setTimeLeft({});
      return;
    }

    // Update timer every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate, calculateTimeLeft]);

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

/**
 * ItemDetail Page Component
 * Main component for displaying item details and handling marketplace interactions
 * Supports fixed-price purchases and blind auction bidding with real-time Firestore sync
 */
export default function ItemDetail() {
  const { currentUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  // State management
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [statusClass, setStatusClass] = useState(""); // CSS class for B&W/overlay effects

  /**
   * Real-time Firestore synchronization
   * Listens for item data changes and updates UI accordingly
   */
  useEffect(() => {
    if (!db || !id) return;

    setLoading(true);

    const itemRef = doc(db, "items", id);

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      itemRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setItem(data);
          setMessage("");

          // Update UI state based on current item data
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
          setMessage("Item not found in database.");
          setItem(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("onSnapshot error:", error);
        setMessage("Database connection error.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Computed variables derived from item state
  const basePrice = item ? item.startingBid || item.price : 0;
  const isAuction = item?.saleType === "auction";
  const isFixedPrice = item?.saleType === "fixed";

  // Status flags updated via statusClass
  const isSold = statusClass === "sold-item";
  const hasExpired = statusClass === "expired-item";
  const canInteract = !hasExpired && !isSold;

  // Check if current user has an existing bid (auction only)
  const userBid = currentUser && item?.bids ? item.bids[currentUser.uid] : null;

  /**
   * Handles instant purchase for fixed-price items
   * Updates item status, grants player points, and sends Discord notification
   */
  const handleBuyNow = async () => {
    if (!currentUser || !isFixedPrice || !canInteract) return;

    if (
      !window.confirm(
        `Sei sicuro di voler acquistare ${item.name} per ${item.price} MP? L'acquisto è definitivo.`
      )
    )
      return;

    const itemRef = doc(db, "items", id);
    const userRef = doc(db, "characters", currentUser.uid);

    try {
      // Usiamo una transazione per essere sicuri che i soldi ci siano 
      // e che l'oggetto non venga venduto a due persone contemporaneamente
      await runTransaction(db, async (transaction) => {
        const charDoc = await transaction.get(userRef);
        const itemDoc = await transaction.get(itemRef);

        if (!charDoc.exists()) throw "Saldo personaggio non trovato.";
        if (itemDoc.data().isSold) throw "Oggetto già venduto!";

        const currentPlatinum = charDoc.data().platinum || 0;
        const itemPrice = itemDoc.data().price;

        // VERIFICA FONDI
        if (currentPlatinum < itemPrice) {
          throw `Fondi insufficienti. Hai ${currentPlatinum} MP, ma ne servono ${itemPrice}.`;
        }

        // 1. SCALA I SOLDI
        transaction.update(userRef, {
          platinum: currentPlatinum - itemPrice,
          rattoPoints: increment(1) // Premio reputazione
        });

        // 2. SEGNA COME VENDUTO
        transaction.update(itemRef, {
          isSold: true,
          soldTo: currentUser.email,
          soldAt: new Date().toISOString(),
          auctionStatus: "Venduto (Prezzo Fisso)"
        });
      });

      alert("Acquisto completato! Le monete sono state scalate e hai guadagnato 1 Punto Ratto.");

      // Notifica Webhook (Pipedream/Discord)
      const notificationPayload = {
        type: "VENDITA_FISSA_IMMEDIATA",
        purchasePrice: item.price,
        buyerName: currentUser.email.split("@")[0],
        item: { name: item.name, id: id },
        timestamp: new Date().toISOString(),
      };

      fetch(NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      });

    } catch (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      setMessage(`❌ Errore acquisto: ${errorMessage}`);
    }
  };

  /**
   * Handles blind auction bidding
   * Uses Firestore transactions to ensure atomic updates of bids and player balance
   * @param {Event} e - Form submission event
   */
  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    setMessage("");

    const numericOffer = parseInt(offer, 10);
    const minBid = item.startingBid || 1;

    // Validation checks
    if (!currentUser) {
      setMessage("You must be logged in to place a bid.");
      return;
    }

    if (userBid) {
      setMessage(
        "You already have a bid on this item. Cancel it first if you want to change it."
      );
      return;
    }

    if (isNaN(numericOffer) || numericOffer < minBid) {
      setMessage(
        `Your bid must be valid and at least ${minBid} MP.`
      );
      return;
    }

    if (!canInteract) {
      setMessage("Cannot interact with an expired or sold auction.");
      return;
    }

    const itemRef = doc(db, "items", id);
    const charRef = doc(db, "characters", currentUser.uid);

    try {
      // Execute atomic transaction
      await runTransaction(db, async (transaction) => {
        // 1. READ player balance
        const charDoc = await transaction.get(charRef);

        if (!charDoc.exists()) {
          throw "Player balance not found. Contact DM.";
        }

        const currentPlatinum = charDoc.data().platinum || 0;

        // 2. VALIDATE balance
        if (currentPlatinum < numericOffer) {
          throw `Insufficient balance. You have ${currentPlatinum} MP, but bid is ${numericOffer} MP.`;
        }

        // 3. UPDATE player balance (deduct bid amount)
        const newPlatinum = currentPlatinum - numericOffer;
        transaction.update(charRef, {
          platinum: newPlatinum,
        });

        // 4. UPDATE item with new bid
        const newBidMap = {
          [`bids.${currentUser.uid}`]: numericOffer,
          [`bidderEmails.${currentUser.uid}`]: currentUser.email,
        };
        transaction.update(itemRef, newBidMap);
      });

      // Send Discord notification if transaction succeeds
      const payload = {
        type: "NUOVA_OFFERTA_ASTA",
        offerAmount: numericOffer,
        bidderName: currentUser.email.split("@")[0],
        bidderEmail: currentUser.email,
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

      setMessage(
        `✅ Bid of ${numericOffer} MP registered! Funds locked. You cannot modify until auction ends.`
      );
      setOffer("");
    } catch (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      setMessage(`❌ Bid error: ${errorMessage}`);
      console.error("Transaction failed:", error);
    }
  };

  /**
   * Handles bid cancellation with full refund
   * Uses transaction to ensure atomic refund and bid removal
   */
  const handleDeleteOffer = async () => {
    if (!currentUser || !userBid) return;

    const offerToRefund = userBid;

    if (
      !window.confirm(
        `Cancel bid of ${offerToRefund} MP? Amount will be refunded immediately.`
      )
    )
      return;

    const itemRef = doc(db, "items", id);
    const charRef = doc(db, "characters", currentUser.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const charDoc = await transaction.get(charRef);

        if (!charDoc.exists()) {
          throw "Error: Player balance not found for refund.";
        }

        // 1. REFUND player balance
        const currentPlatinum = charDoc.data().platinum || 0;
        const newPlatinum = currentPlatinum + offerToRefund;

        transaction.update(charRef, {
          platinum: newPlatinum,
        });

        // 2. REMOVE bid from item
        transaction.update(itemRef, {
          [`bids.${currentUser.uid}`]: deleteField(),
          [`bidderEmails.${currentUser.uid}`]: deleteField(),
        });
      });

      setMessage(
        `Bid of ${offerToRefund} MP cancelled! Amount refunded successfully.`
      );
      setOffer("");
    } catch (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      setMessage(`❌ Cancellation error: ${errorMessage}`);
      console.error("Refund transaction failed:", error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <section className="item-detail-page">
        <p style={{ textAlign: "center" }}>Loading Item Details...</p>
      </section>
    );
  }

  // Item not found state
  if (!item) {
    return (
      <section className="item-detail-page">
        <p style={{ textAlign: "center" }}>
          {message || "Item details unavailable."}
        </p>
      </section>
    );
  }

  // Computed display values
  const currentPriceDisplay = item.startingBid || item.price;
  const itemRarity = item.class || "Unspecified";

  return (
    <section className={`item-detail-page ${statusClass}`}>
      <button onClick={() => navigate("/mercato")} className="back-button">
        ← Back to Market
      </button>

      <div className="detail-content">
        {/* Item image with grayscale filter if sold/expired */}
        <img
          src={item.img || "/assets/placeholder.jpg"}
          alt={item.name}
          className={`detail-image ${isSold || hasExpired ? "grayscale" : ""}`}
        />

        <div className="detail-info">
          <h1>
            {item.name} {isSold && "(SOLD)"}
          </h1>

          <div className="item-specs">
            <p>
              <strong>Type:</strong> {item.type || "Generic"}
            </p>
            <p>
              <strong>Rarity:</strong> {itemRarity}
            </p>
          </div>

          <p className="detail-price">
            {isAuction ? "Auction Starting Price" : "Fixed Price"}:
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

          {/* Countdown timer - only shown for active auctions */}
          {isAuction && item.endDate && (
            <h3 className="countdown-title">
              <Countdown endDate={item.endDate} />
            </h3>
          )}

          {/* Status messages */}
          {hasExpired && (
            <p className="offer-message error">
              Auction ended! Item will be assigned by DM.
            </p>
          )}
          {userBid && (
            <p className="last-bid-info success">
              Your current bid: {userBid} MP.
            </p>
          )}

          <hr />

          <h2>Description</h2>
          {/* Item description rendered as HTML */}
          <div
            className="detail-description"
            dangerouslySetInnerHTML={{ __html: item.description }}
          />

          {/* Interaction section - only visible if user can interact with item */}
          {canInteract && currentUser ? (
            isFixedPrice ? (
              // Buy now button for fixed-price items
              <button onClick={handleBuyNow} className="buy-now-button">
                Buy Now for {item.price} MP
              </button>
            ) : (
              // Bidding form for auctions (only if user hasn't bid yet)
              !userBid && (
                <div className="offer-section">
                  <form onSubmit={handleSubmitOffer}>
                    <input
                      type="number"
                      placeholder={`Bid at least ${basePrice} MP`}
                      value={offer}
                      onChange={(e) => setOffer(e.target.value)}
                      min={basePrice}
                      required
                    />
                    <button type="submit" className="offer-button">
                      Place Blind Bid
                    </button>
                  </form>
                </div>
              )
            )
          ) : (
            // Message for non-logged users
            !currentUser && (
              <p className="offer-message error">
                Log in to interact with the marketplace.
              </p>
            )
          )}

          {/* Feedback messages */}
          {message && (
            <p
              className={`offer-message ${
                message.includes("registered") || message.includes("sold")
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
