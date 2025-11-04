// src/utils/itemTemplates.js

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
export const createMarketItem = ({
    name,
    type,
    itemClass, // Usiamo 'itemClass' per evitare conflitto con 'class' di JS
    price = 0,
    startingBid = 0,
    description,
    img,
}) => {
    // Conversione dei prezzi in numeri per sicurezza
    const priceNum = Number(price);
    const startingBidNum = Number(startingBid);

    return {
        // Dati Base
        name: name || "NUOVO ITEM SENZA NOME",
        type: type || "Generico",
        class: itemClass || "Comune",
        price: priceNum,
        startingBid: startingBidNum,
        description: description || "Nessuna descrizione fornita dal Master.",
        img: img || "/assets/placeholder.jpg",
        
        // Dati dell'Asta (Stato Iniziale)
        currentBid: 0, // 👈 Importante: L'offerta attuale parte da 0
        bids: {}, // 👈 Mappa vuota per le offerte uniche degli utenti
        bidderEmails: {}, // Mappa vuota per le email degli offerenti (per tua traccia)
        lastUpdated: new Date().getTime(),
    };
};