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
// src/utils/itemTemplates.js

export const createMarketItem = (data) => {
    // Gestisce la conversione della data in formato ISO per l'asta
    const endDateISO = data.saleType === 'auction' && data.endDate 
        ? new Date(data.endDate).toISOString() 
        : null;

    return {
        name: data.name || "NUOVO ITEM SENZA NOME",
        type: data.type || "Generico",
        class: data.class || "Comune",
        saleType: data.saleType,
        
        // Dati Prezzo/Asta
        price: data.saleType === 'fixed' ? Number(data.price || 0) : 0,
        startingBid: data.saleType === 'auction' ? Number(data.startingBid || 0) : 0,
        endDate: endDateISO,

        description: data.description || "Nessuna descrizione fornita dal Master.",
        img: data.img || "/assets/placeholder.jpg",
        
        // Campi per la logica di mercato
        isSold: false, // Inizializzazione: l'oggetto non è ancora venduto
        currentBid: 0, // Offerta più alta corrente
        bids: {}, // Offerte cieche (blind bid)
        bidderEmails: {},
        createdAt: new Date().toISOString(),
    };
};