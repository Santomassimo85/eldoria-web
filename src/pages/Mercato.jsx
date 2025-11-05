// src/pages/Mercato.jsx (AGGIORNATO CON STATO VENDUTO/SCADUTO)

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; // Assicurati che il percorso sia corretto
import { collection, getDocs } from "firebase/firestore";

// ARRAY USATI PER I FILTRI (DEVONO CORRISPONDERE A MarketAdmin.jsx)
const ITEM_TYPES = [
  "Arma",
  "Armatura",
  "Accessori",
  "Artefatto Magico",
  "Pozioni",
  "Pergamne",
  "Reagenti",
];
const RARITIES = ["Comune", "Raro", "Magico", "Epico", "Leggendario"];
const MASTER_EMAIL = "santomassimo85@gmail.com"; // 🎯 Definisci MASTER_EMAIL qui

// --- COMPONENTE CARD ---
const ItemCard = ({ item, isMaster }) => {
  const navigate = useNavigate();
  
  

  // NUOVI CHECK: isSold e hasExpired
  const isAuction = item.saleType === "auction";
  const isFixedPrice = item.saleType === "fixed";
  const isSold = item.isSold === true;
  const hasExpired =
    isAuction && item.endDate && new Date(item.endDate) < new Date();
  const statusClass = isSold ? "sold" : hasExpired ? "expired" : "";

  // Logica offerte (solo per DM)
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
          : "Spiacente, quest'asta è terminata."
      );
    }
  };

  let displayPrice;
  if (isSold) {
    displayPrice = `VENDUTO`;
  } else if (isFixedPrice) {
    displayPrice = `Prezzo Fisso: ${item.price} MP`;
  } else if (hasExpired) {
    displayPrice = `ASTA TERMINATA`;
  } else {
    displayPrice = `Base Asta: ${item.startingBid} MP`;
  }

  // Usa 'class' per la rarità e normalizza la classe per un eventuale stile CSS
  const rarityClass = (item.class || "Comune").replace(/\s/g, "");

  /// 🎯 LOGICA VISTA DM
    let dmInfo = null;
    if (isMaster) {
        if (isFixedPrice && isSold) {
            dmInfo = <p style={{color: '#4CAF50', fontWeight: 'bold'}}>Acquirente: {item.soldTo.split('@')[0]}</p>;
        } else if (isAuction) {
            dmInfo = highestBid ? (
                <p style={{color: '#f39c12', fontWeight: 'bold'}}>Max Offerta: {highestBid.amount} MP</p>
            ) : (
                <p style={{color: '#aaa'}}>Nessuna Offerta</p>
            );
    }
  }

  return (
        <div 
            className={`item-card ${statusClass}`} 
            // 🎯 Master clicca sempre, Giocatori solo se attivo
            onClick={isMaster ? () => navigate(`/mercato/${item.id}`) : handleCardClick} 
            title={isSold ? "Venduto" : hasExpired ? "Asta Terminata" : "Clicca per dettagli/offerta"}
        >
            <img 
                src={item.img || '/assets/placeholder.jpg'} 
                alt={item.name} 
                className={`item-image ${statusClass}`} 
            />
            <div className="item-details">
                <p className={`item-rarity item-rarity-${rarityClass}`}>
                    {item.class || 'Comune'}
                </p>
                <p className="item-name"><strong>{item.name}</strong></p>
                <p className="item-type">{item.type}</p>
                <p className="item-class">{item.itemClass}</p>
                <p className={`item-price ${statusClass}`}>{displayPrice}</p>
                {dmInfo} {/* MOSTRA INFORMAZIONI SOLO AL MASTER */}
            </div>

            {/* 🎯 NUOVA SEZIONE: LISTA OFFERTE INLINE ESPANDIBILE PER DM */}
            {isMaster && isAuction && bidsArray.length > 0 && (
                <div style={{ padding: '5px', borderTop: '1px solid #555', zIndex: 5 }}>
                    
                    
                    {/* 🎯 3. Il contenuto è sempre presente, ma nascosto dal CSS se non expanded */}
                    <div className="bid-list-content"> 
                        <ul style={{ listStyleType: 'none', padding: '0', margin: '5px 0 0' }}>
                            {bidsArray.map((bid, index) => (
                                <li key={bid.uid} style={{ fontSize: '0.8em', color: index === 0 ? '#f39c12' : '#ccc' }}>
                                    {index === 0 && '👑'} {bid.email.split('@')[0]}: **{bid.amount} MP**
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
  const isMaster = currentUser && currentUser.email === MASTER_EMAIL; // 🎯 Check Master

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
    // Aggiorna la lista ogni 60 secondi per riflettere le scadenze (approssimativo)
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
          (item.type || "").toLowerCase().includes(lowerCaseSearch)
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
                <p style={{color: 'var(--red)', fontWeight: 'bold', border: '1px solid var(--red)', padding: '10px'}}>
                    ⚠️ VISTA MASTER ATTIVA: Dettagli Offerte visibili.
                </p>
            )}
            <p>Qui puoi trovare oggetti rari e potenti. Le offerte sono *blind bid*, quindi l'offerta più alta vince allo scadere del tempo!</p>

            {loading && <p style={{textAlign: 'center'}}>Caricamento Item...</p>}
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
          // 🎯 Passa la prop isMaster al componente ItemCard
<ItemCard key={item.id} item={item} isMaster={isMaster} />
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
