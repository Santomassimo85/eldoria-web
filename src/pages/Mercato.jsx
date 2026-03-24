// src/pages/Mercato.jsx (AGGIORNATO CON STATO VENDUTO/SCADUTO)

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; // Assicurati che il percorso sia corretto
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  onSnapshot
} from "firebase/firestore";

// ARRAY USATI PER I FILTRI (DEVONO CORRISPONDERE A MarketAdmin.jsx)
const ITEM_TYPES = [
  "Arma",
  "Armatura",
  "Accessori",
  "Artefatto Magico",
  "Pozioni",
  "Pergamene",
  "Reagenti",
  "Varie",
];

const RATTO_LEVELS = [
    { lv: 0, min: 0, name: "Estraneo" },
    { lv: 1, min: 5, name: "Simpatizzante" },
    { lv: 2, min: 15, name: "Informatore" },
    { lv: 3, min: 30, name: "Ricettatore" },
    { lv: 4, min: 50, name: "Veterano" },
    { lv: 5, min: 80, name: "Ombra di Obia" },
  ];

  const getRattoLevel = (points) => {
    return (
      [...RATTO_LEVELS].reverse().find((l) => points >= l.min) ||
      RATTO_LEVELS[0]
    );
  };

  const getNextRattoLevel = (points) => {
  return RATTO_LEVELS.find(l => points < l.min) || null; // Ritorna il prossimo livello o null se è al max
};



// --- 1. COMPONENTE COUNTDOWN (Spostato fuori per essere definito correttamente) ---
const MarketTimer = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("Calcolo...");
  
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) {
        setTimeLeft("APERTURA!");
        clearInterval(timer);
        window.location.reload(); 
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

  return <div style={{ fontSize: "2.5rem", color: "var(--gold)", fontWeight: "bold" }}>{timeLeft}</div>;
};

const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const MASTER_EMAIL = "santomassimo85@gmail.com"; // Definisci MASTER_EMAIL qui

// --- COMPONENTE CARD ---
const ItemCard = ({ item, isMaster, onVoteLocal }) => {
  const { currentUser } = useAuth(); // Per sapere chi vota
  const navigate = useNavigate();

  // Funzione per votare

  const isAuction = item.saleType === "auction";
  const isFixedPrice = item.saleType === "fixed";
  const isSold = item.isSold === true;
  const hasExpired =
    isAuction && item.endDate && new Date(item.endDate) < new Date();
  const statusClass = isSold ? "sold" : hasExpired ? "expired" : "";

  // Logica offerte (solo per DM)
  const handleVote = async (e, type) => {
    e.stopPropagation();
    if (!currentUser) return alert("Devi essere loggato per votare!");

    const itemRef = doc(db, "items", item.id);
    const userEmail = currentUser.email;

    // 1. Prepariamo i nuovi array localmente per un aggiornamento istantaneo
    let newUp = [...(item.votes?.up || [])];
    let newDown = [...(item.votes?.down || [])];

    if (type === "up") {
      if (newUp.includes(userEmail)) {
        newUp = newUp.filter((email) => email !== userEmail); // Togli Like
      } else {
        newUp.push(userEmail); // Metti Like
        newDown = newDown.filter((email) => email !== userEmail); // Togli eventuale Dislike
      }
    } else {
      if (newDown.includes(userEmail)) {
        newDown = newDown.filter((email) => email !== userEmail); // Togli Dislike
      } else {
        newDown.push(userEmail); // Metti Dislike
        newUp = newUp.filter((email) => email !== userEmail); // Togli eventuale Like
      }
    }

    const newVotes = { up: newUp, down: newDown };

    // 2. Aggiorna l'interfaccia SUBITO (senza aspettare il database)
    onVoteLocal(item.id, newVotes);

    // 3. Invia al database "silenziosamente"
    try {
      await updateDoc(itemRef, { votes: newVotes });
    } catch (error) {
      console.error("Errore nel salvataggio voto:", error);
      alert("Errore nel salvataggio del voto!");
    }
  };

  const bidsArray =
    isAuction && item.bids
      ? Object.entries(item.bids)
          .map(([uid, amount]) => ({
            uid,
            amount,
            email: item.bidderEmails ? item.bidderEmails[uid] : "Sconosciuto",
          }))
          .sort((a, b) => b.amount - a.amount)
      : []; // Ordina dalla più alta alla più bassa

  const highestBid = bidsArray.length > 0 ? bidsArray[0] : null;

  const handleCardClick = () => {
    // Blocca l'interazione se l'oggetto è venduto o l'asta è scaduta
    if (statusClass === "") {
      navigate(`/mercato/${item.id}`);
    } else {
      alert(
        isSold
          ? "Spiacente, questo oggetto è stato venduto."
          : "Spiacente, quest'asta è terminata.",
      );
    }
  };

  let displayPrice;

  // LOGICA AGGIORNATA PER MOSTRARE IL VINCITORE DOPO LA FINALIZZAZIONE
  if (isSold && item.auctionStatus === "Venduto" && item.soldTo) {
    // Caso 1: Asta Finalizzata con vincitore
    displayPrice = `VENDUTO a ${item.soldTo.split("@")[0]}`;
  } else if (isSold && item.auctionStatus === "Scaduta senza offerte") {
    // Caso 2: Asta Finalizzata senza offerte
    displayPrice = `ASTA FALLITA`;
  } else if (isSold && isFixedPrice) {
    // Caso 3: Compra Subito
    displayPrice = `VENDUTO (Prezzo Fisso)`;
  } else if (isFixedPrice) {
    displayPrice = `Prezzo Fisso: ${item.price} MP`;
  } else if (hasExpired) {
    displayPrice = `ASTA TERMINATA`;
  } else {
    displayPrice = `Base Asta: ${item.startingBid} MP`;
  }

  

  // Usa 'class' per la rarità e normalizza la classe per un eventuale stile CSS
  const rarityClass = (item.class || "Comune").replace(/\s/g, "");

  /// LOGICA VISTA DM
  let dmInfo = null;
  if (isMaster) {
    if (isFixedPrice && isSold) {
      dmInfo = (
        <p style={{ color: "#4CAF50", fontWeight: "bold" }}>
          Acquirente: {item.soldTo.split("@")[0]}
        </p>
      );
    } else if (isAuction) {
      dmInfo = highestBid ? (
        <p style={{ color: "#f39c12", fontWeight: "bold" }}>
          Max Offerta: {highestBid.amount} MP
        </p>
      ) : (
        <p style={{ color: "#aaa" }}>Nessuna Offerta</p>
      );
    }
  }

  





  return (
    // APPLICA LA NUOVA CLASSE SOLO SE MASTER
    <div
      className={`item-card ${statusClass} ${isMaster ? "admin-card-expanded" : ""}`}
      onClick={handleCardClick}
      title={
        isSold
          ? "Venduto"
          : hasExpired
            ? "Asta Terminata"
            : "Clicca per dettagli/offerta"
      }
    >
      <img
        src={item.img || "/assets/placeholder.jpg"}
        alt={item.name}
        className={`item-image ${statusClass}`}
      />

      <div className="item-details">
        <p className={`item-rarity item-rarity-${rarityClass}`}>
          {item.class || "Comune"}
        </p>
        <p className="item-name">
          <strong>{item.name}</strong>
        </p>
        <p className="item-type">{item.type}</p>
        <p className="item-class">{item.itemClass}</p>
        <p className={`item-price ${statusClass}`}>{displayPrice}</p>
        {dmInfo} {/* MOSTRA INFORMAZIONI SOLO AL MASTER */}
        {/* SEZIONE FEEDBACK ITEM */}
        <div className="item-feedback-container">
          <div className="vote-buttons">
            {/* TASTO LIKE */}
            <div
              className={`vote-group ${item.votes?.up?.includes(currentUser?.email) ? "active-up" : ""}`}
              onClick={(e) => handleVote(e, "up")}
            >
              <img src="/assets/like.png" alt="Like" className="vote-icon" />
              <span className="vote-count">{item.votes?.up?.length || 0}</span>
            </div>

            {/* TASTO DISLIKE */}
            <div
              className={`vote-group ${item.votes?.down?.includes(currentUser?.email) ? "active-down" : ""}`}
              onClick={(e) => handleVote(e, "down")}
            >
              <img
                src="/assets/dislike.png"
                alt="Dislike"
                className="vote-icon"
              />
              <span className="vote-count">
                {item.votes?.down?.length || 0}
              </span>
            </div>
          </div>

          {/* INFO PER IL MASTER (Chi ha votato) */}
          {isMaster &&
            (item.votes?.up?.length > 0 || item.votes?.down?.length > 0) && (
              <div className="admin-voters-list">
                {item.votes?.up?.length > 0 && (
                  <p className="text-green">
                    L:{" "}
                    {item.votes.up
                      .map((email) => email.split("@")[0])
                      .join(", ")}
                  </p>
                )}
                {item.votes?.down?.length > 0 && (
                  <p className="text-red">
                    D:{" "}
                    {item.votes.down
                      .map((email) => email.split("@")[0])
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
        </div>
      </div>

      {/* LISTA OFFERTE SEMPRE VISIBILE PER DM (Ora contenuta nell'altezza auto) */}
      {isMaster && isAuction && bidsArray.length > 0 && (
        <div
          style={{
            padding: "5px",
            borderTop: "1px solid #555",
            backgroundColor: "#1c1c1c",
          }}
        >
          <h4
            style={{
              margin: "0 0 5px",
              fontSize: "0.9em",
              color: "var(--gold)",
            }}
          >
            Offerte Ricevute:
          </h4>
          <div className="bid-list-content">
            <ul style={{ listStyleType: "none", padding: "0", margin: "0" }}>
              {bidsArray.map((bid, index) => (
                <li
                  key={bid.uid}
                  style={{
                    fontSize: "0.8em",
                    color: index === 0 ? "#f39c12" : "#ccc",
                    padding: "2px 0",
                  }}
                >
                  {index === 0 && "👑"} {bid.email.split("@")[0]}: **
                  {bid.amount} MP**
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Mercato() {
  const { currentUser } = useAuth();
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL; // Check Master

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentUserData, setCurrentUserData] = useState(null);


// All'inizio del componente Mercato
const [marketConfig, setMarketConfig] = useState(null);

useEffect(() => {
  const unsub = onSnapshot(doc(db, "settings", "market_config"), (snap) => {
    if (snap.exists()) setMarketConfig(snap.data());
  });
  return () => unsub();
}, []);

 // --- NUOVA LOGICA: ASCOLTO PUNTI UTENTE IN TEMPO REALE ---
  useEffect(() => {
    if (!currentUser) return;

    // Crea un collegamento "live" col documento del personaggio
    const userRef = doc(db, "characters", currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserData(docSnap.data());
      }
    }, (error) => {
      console.error("Errore onSnapshot utente:", error);
    });

    // Pulisce il collegamento quando l'utente cambia pagina
    return () => unsubscribe();
  }, [currentUser]);

  // --- LOGICA DI CARICAMENTO ITEM (Resta simile ma pulita) ---
  const fetchItems = async () => {
    setLoading(true);
    try {
      const itemsCollection = collection(db, "items");
      const itemSnapshot = await getDocs(itemsCollection);
      const itemsList = itemSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemsList);
    } catch (error) {
      console.error("Errore nel caricamento degli item:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // Aggiorna la lista ogni 60 secondi per le scadenze aste
    const interval = setInterval(fetchItems, 60000);
    return () => clearInterval(interval);
  }, []);


  // --- AGGIUNGI QUESTO DOPO IL CARICAMENTO DEGLI ITEMS ---
useEffect(() => {
  const autoFinalize = async () => {
    const ora = new Date();
    
    // Filtriamo solo le aste scadute non ancora processate
    const expiredAuctions = items.filter(item => 
      item.saleType === "auction" && 
      item.endDate && 
      new Date(item.endDate) < ora && 
      !item.isSold && 
      !item.isRefunded
    );

    for (const item of expiredAuctions) {
      const bids = item.bids || {};
      const bidEntries = Object.entries(bids);

      if (bidEntries.length > 0) {
        // Troviamo il vincitore
        const [winnerName, amount] = bidEntries.reduce((prev, curr) => curr[1] > prev[1] ? curr : prev);

        try {
          // 1. Aggiorna il database
          const itemRef = doc(db, "items", item.id);
          await updateDoc(itemRef, { 
            isSold: true, 
            winner: winnerName, 
            finalPrice: amount 
          });

          // 2. Invia Mail tramite Pipedream
          await fetch("https://eoftih1a36e46sq.m.pipedream.net", { // Ho usato l'URL trovato nel tuo ItemDetail
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "AUCTION_CLOSED",
              itemName: item.name,
              winner: winnerName,
              price: amount,
              masterEmail: "santomassimo85@gmail.com"
            })
          });
          console.log(`Asta conclusa per ${item.name}`);
        } catch (e) {
          console.error("Errore auto-finalizzazione:", e);
        }
      }
    }
  };

  if (items.length > 0) autoFinalize();
}, [items]);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");
  
  // useEffect(() => {
  //   fetchItems();
  //   // Aggiorna la lista ogni 60 secondi per riflettere le scadenze
  //   const interval = setInterval(fetchItems, 60000);
  //   return () => clearInterval(interval);
  // }, []);

  // --- LOGICA FILTRI E RICERCA ---
  // 1. Determiniamo quali oggetti possono essere mostrati (Logica del Timer)
const visibleItems = useMemo(() => {
  const now = new Date();
  // Il mercato è considerato "Aperto" se non c'è una data o se la data è passata
  const isMarketOpen = marketConfig?.nextOpening 
    ? now >= new Date(marketConfig.nextOpening) 
    : true;

  return items.filter(item => {
    // Se l'oggetto ha la spunta "isVisible", lo mostriamo sempre
    if (item.isVisible) return true;
    // Altrimenti, lo mostriamo solo se il countdown è terminato
    return isMarketOpen;
  });
}, [items, marketConfig]);

// 2. Applichiamo i tuoi filtri esistenti (Ricerca, Tipo, Rarità) sugli oggetti visibili
const filteredItems = useMemo(() => {
  return visibleItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesRarity = filterRarity === "all" || item.class === filterRarity;
    return matchesSearch && matchesType && matchesRarity;
  });
}, [visibleItems, searchTerm, filterType, filterRarity]);
  return (
    <section className="mercato-page">
      <h1>Mercato Nero di Eldoria</h1>
      {isMaster && (
        <p
          style={{
            color: "var(--red)",
            fontWeight: "bold",
            border: "1px solid var(--red)",
            padding: "10px",
          }}
        >
          ⚠️ VISTA MASTER ATTIVA: Dettagli Offerte visibili.
        </p>
      )}

      {/* Cerca questo blocco in Mercato.jsx sotto il titolo H1 */}
{currentUserData && (
  <div className="ratto-progress-container" style={{
    backgroundColor: "rgba(187, 153, 73, 0.5)",
    padding: "15px",
    borderRadius: "8px",
    border: isMaster ? "1px solid var(--red)" : "1px solid var(--gold)", // Rosso se sei Master per distinguere
    marginBottom: "20px",
    textAlign: "center"
  }}>
    {isMaster && <span style={{ color: "var(--red)", fontSize: "0.7rem", fontWeight: "bold" }}>MODALITÀ TEST MASTER</span>}
    
    <p style={{ margin: "5px 0 10px 0", fontSize: "1.1rem" }}>
      Ciao <strong>{currentUser.email.split('@')[0]}</strong>, hai <strong>{currentUserData.platinum || 0} MP</strong>
    </p>
    
    <div className="ratto-status">
      <p style={{ margin: "5px 0" }}>
        Rango attuale: <span style={{ color: "var(--gold)" }}>{getRattoLevel(currentUserData.rattoPoints || 0).name} (Lv. {getRattoLevel(currentUserData.rattoPoints || 0).lv})</span>
      </p>
      
      {getNextRattoLevel(currentUserData.rattoPoints || 0) ? (
        <p style={{ fontSize: "0.9rem", color: "#ee5050" }}>
          Progresso: <strong>{currentUserData.rattoPoints || 0}</strong> / <strong>{getNextRattoLevel(currentUserData.rattoPoints || 0).min}</strong> PR 
          per il prossimo livello
        </p>
      ) : (
        <p style={{ color: "var(--gold)" }}>✨ Massimo rango raggiunto!</p>
      )}
      
      {/* Barra di progresso */}
      {getNextRattoLevel(currentUserData.rattoPoints || 0) && (
        <div style={{
          width: "100%", height: "8px", backgroundColor: "#222",
          borderRadius: "4px", marginTop: "10px", overflow: "hidden", border: "1px solid #444"
        }}>
          <div style={{
            width: `${Math.min((currentUserData.rattoPoints || 0) / getNextRattoLevel(currentUserData.rattoPoints || 0).min * 100, 100)}%`,
            height: "100%", backgroundColor: "var(--gold)", transition: "width 0.5s ease-in-out"
          }}></div>
        </div>
      )}
    </div>
  </div>
)}

      <p>
        Qui puoi trovare oggetti rari e potenti. Le offerte sono *blind bid*,
        quindi l'offerta più alta vince allo scadere del tempo!
      </p>

      {loading && <p style={{ textAlign: "center" }}>Caricamento Item...</p>}
      {/* CONTROLLO (Filtri) */}
      <div className="mercato-controls">
        <input
          type="text"
          placeholder="Cerca per nome, tipo o classe (min. 3 caratteri)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />

        <select
          onChange={(e) => setFilterType(e.target.value)}
          value={filterType}
        >
          <option value="all">Tutte le Tipologie</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => setFilterRarity(e.target.value)}
          value={filterRarity}
        >
          <option value="all">Tutte le Rarità</option>
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {rarity}
            </option>
          ))}
        </select>
      </div>

      <div className="items-grid">
  {filteredItems.length > 0 ? (
    // Se ci sono oggetti visibili, mostrali
    filteredItems.map((item) => (
      <ItemCard
        key={item.id}
        item={item}
        isMaster={isMaster}
        onVoteLocal={(itemId, newVotes) => {
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...i, votes: newVotes } : i))
          );
        }}
      />
    ))
  ) : (
    // SE LA LISTA È VUOTA: Mostriamo il Countdown
    <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 20px" }}>
      <h2 style={{ color: "var(--gold)", fontSize: "2rem" }}>🏛️ Il Mercato è Chiuso</h2>
      {marketConfig?.nextOpening ? (
        <>
          <p style={{ color: "#ccc", marginBottom: "20px" }}>I mercanti di Obia arriveranno tra:</p>
          {/* Qui richiami il componente MarketTimer che abbiamo creato prima */}
          <MarketTimer targetDate={marketConfig.nextOpening} />
        </>
      ) : (
        <p style={{ color: "#ccc" }}>Non ci sono merci disponibili al momento.</p>
      )}
    </div>
  )}
</div>
    </section>
  );
}
