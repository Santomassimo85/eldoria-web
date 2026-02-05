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
  arrayUnion,
  arrayRemove,
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

  const itemRef = doc(db, 'items', item.id);
  const userEmail = currentUser.email;

  // 1. Prepariamo i nuovi array localmente per un aggiornamento istantaneo
  let newUp = [...(item.votes?.up || [])];
  let newDown = [...(item.votes?.down || [])];

  if (type === 'up') {
    if (newUp.includes(userEmail)) {
      newUp = newUp.filter(email => email !== userEmail); // Togli Like
    } else {
      newUp.push(userEmail); // Metti Like
      newDown = newDown.filter(email => email !== userEmail); // Togli eventuale Dislike
    }
  } else {
    if (newDown.includes(userEmail)) {
      newDown = newDown.filter(email => email !== userEmail); // Togli Dislike
    } else {
      newDown.push(userEmail); // Metti Dislike
      newUp = newUp.filter(email => email !== userEmail); // Togli eventuale Like
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
              <img
                src="/assets/like.png"
                alt="Like"
                className="vote-icon"
              />
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterRarity, setFilterRarity] = useState("all");

  // --- LOGICA DI CARICAMENTO DATI ---
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
    // Aggiorna la lista ogni 60 secondi per riflettere le scadenze
    const interval = setInterval(fetchItems, 60000);
    return () => clearInterval(interval);
  }, []);

  // --- LOGICA FILTRI E RICERCA ---
  const filteredItems = useMemo(() => {
    let filtered = items;

    const lowerCaseSearch = searchTerm.toLowerCase();

    // 1. Filtra per Ricerca (nome, classe, tipo) - Attiva solo con >= 3 caratteri
    if (searchTerm.length >= 3) {
      filtered = filtered.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(lowerCaseSearch) ||
          (item.class || "").toLowerCase().includes(lowerCaseSearch) || // Usa item.class
          (item.type || "").toLowerCase().includes(lowerCaseSearch),
      );
    }

    // 2. Filtra per Tipologia
    if (filterType !== "all") {
      filtered = filtered.filter((item) => item.type === filterType);
    }

    // 3. Filtra per Rarità
    if (filterRarity !== "all") {
      // Usa item.class come campo di rarità primario
      filtered = filtered.filter((item) => item.class === filterRarity);
    }

    // Ordina per item non venduti/scaduti, poi per prezzo
    return filtered.sort((a, b) => {
      const aStatus =
        a.isSold ||
        (a.saleType === "auction" && new Date(a.endDate) < new Date())
          ? 1
          : 0;
      const bStatus =
        b.isSold ||
        (b.saleType === "auction" && new Date(b.endDate) < new Date())
          ? 1
          : 0;
      if (aStatus !== bStatus) return aStatus - bStatus;

      return (a.price || a.startingBid) - (b.price || b.startingBid);
    });
  }, [items, searchTerm, filterType, filterRarity]);

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
        {filteredItems.map((item) => (
          // Passa la prop isMaster al componente ItemCard
          <ItemCard key={item.id} item={item} isMaster={isMaster} 
          onVoteLocal={(itemId, newVotes) => {
      setItems(prev => prev.map(i => i.id === itemId ? {...i, votes: newVotes} : i));
    }}/>
        ))}
        {!loading && filteredItems.length === 0 && (
          <p style={{ gridColumn: "1 / -1", textAlign: "center" }}>
            Nessun oggetto trovato con i criteri di ricerca.
          </p>
        )}
      </div>
    </section>
  );
}
