/**
 * Funzione costruttrice per creare un oggetto Item Market standard per Firestore.
 * @param {object} data - Dati specifici dell'item.
 * @param {string} data.name - Nome dell'oggetto.
 * @param {string} data.type - Tipologia (es. "Arma Contundente").
 * @param {string} data.class - Classe di rarità (es. "Rara").
 * @param {number} data.price - Prezzo fisso (se non è un'asta).
 * @param {number} data.startingBid - Prezzo base d'asta (0 se non è un'asta).
 * @param {string} data.description - Descrizione completa.
 * @param {string} data.img - Percorso immagine (es. "/assets/items/martello.jpg").
 * @returns {object} Oggetto Item formattato per Firestore.
 */
// src/utils/itemTemplates.js

export const createMarketItem = (data) => {
  // Tutti gli oggetti ora sono aste alla cieca
  const endDateISO = data.endDate ? new Date(data.endDate).toISOString() : null;

  return {
    // Dati base dell'oggetto
    name: data.name || "NUOVO ITEM SENZA NOME",
    type: data.type || "Generico",
    class: data.class || "Comune",
    saleType: "auction",

    // Dati Economici / Asta
    price: 0,
    startingBid: Number(data.startingBid || 0),
    endDate: endDateISO,

    // Estetica e Info
    description: data.description || "Nessuna descrizione fornita dal Master.",
    img: data.img || "/assets/placeholder.jpg",

    // --- SISTEMA FEEDBACK ---
    votes: {
      up: [],   // Array delle email dei player che mettono Like
      down: [], // Array delle email dei player che mettono Dislike
    },

    // --- REQUISITI SISTEMA RATTI ---
    minLevel: Number(data.minLevel || 0), // Livello minimo richiesto per vedere l'oggetto

    /* PET payload — present when the listing is an egg or a pet item from
       the catalog. The buyer-delivery flow uses this to know what to
       hand out: { kind: "egg", rarity } or { kind: "petItem", itemKey }. */
    petPayload: data.petPayload || null,

    // Logica di Mercato e Stato
    isSold: false,
    isRefunded: false,
    currentBid: 0,
    bids: {},
    bidderEmails: {},
    createdAt: new Date().toISOString(),
  };
};