// src/pages/Mercato.jsx (AGGIORNATO CON STATO VENDUTO/SCADUTO)

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../firebase'; // Assicurati che il percorso sia corretto
import { collection, getDocs } from 'firebase/firestore'; 

// ARRAY USATI PER I FILTRI (DEVONO CORRISPONDERE A MarketAdmin.jsx)
const ITEM_TYPES = ['Arma', 'Armatura', 'Accessori', 'Artefatto Magico', 'Pozioni', 'Pergamne', 'Reagenti'];
const RARITIES = ['Comune', 'Raro', 'Magico', 'Epico', 'Leggendario'];


// --- COMPONENTE CARD ---
const ItemCard = ({ item }) => {
    const navigate = useNavigate();
    
    // NUOVI CHECK: isSold e hasExpired
    const isAuction = item.saleType === 'auction';
    const isFixedPrice = item.saleType === 'fixed';
    
    // Lo stato isSold viene impostato dopo l'acquisto con prezzo fisso O DOPO l'assegnazione da parte del DM (logica esterna)
    const isSold = item.isSold === true; 
    
    // L'asta è scaduta se la data esiste ed è nel passato
    const hasExpired = isAuction && item.endDate && new Date(item.endDate) < new Date();

    // Determina la classe CSS per lo stato (per styling B&N e hover)
    const statusClass = isSold ? 'sold' : (hasExpired ? 'expired' : '');

    const handleCardClick = () => {
        // Blocca l'interazione se l'oggetto è venduto o l'asta è scaduta
        if (statusClass === '') {
            navigate(`/mercato/${item.id}`); 
        } else {
            alert(isSold ? "Spiacente, questo oggetto è stato venduto." : "Spiacente, quest'asta è terminata.");
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
    const rarityClass = (item.class || 'Comune').replace(/\s/g, ''); 

    return (
        <div 
            className={`item-card ${statusClass}`} 
            onClick={handleCardClick} 
            title={isSold ? "Venduto" : hasExpired ? "Asta Terminata" : "Clicca per dettagli/offerta"}
        >
            {/* Immagine con filtro grayscale se Venduto o Scaduto */}
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
            </div>
        </div>
    );
};

export default function Mercato() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterRarity, setFilterRarity] = useState('all');

    // --- LOGICA DI CARICAMENTO DATI ---
    const fetchItems = async () => {
        setLoading(true);
        try {
            const itemsCollection = collection(db, 'items');
            const itemSnapshot = await getDocs(itemsCollection);
            const itemsList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            filtered = filtered.filter(item => 
                (item.name || '').toLowerCase().includes(lowerCaseSearch) ||
                (item.class || '').toLowerCase().includes(lowerCaseSearch) || // Usa item.class
                (item.type || '').toLowerCase().includes(lowerCaseSearch)
            );
        }

        // 2. Filtra per Tipologia
        if (filterType !== 'all') {
            filtered = filtered.filter(item => item.type === filterType);
        }

        // 3. Filtra per Rarità
        if (filterRarity !== 'all') {
            // Usa item.class come campo di rarità primario
            filtered = filtered.filter(item => item.class === filterRarity);
        }

        // Ordina per item non venduti/scaduti, poi per prezzo
        return filtered.sort((a, b) => {
            const aStatus = (a.isSold || (a.saleType === 'auction' && new Date(a.endDate) < new Date())) ? 1 : 0;
            const bStatus = (b.isSold || (b.saleType === 'auction' && new Date(b.endDate) < new Date())) ? 1 : 0;
            if (aStatus !== bStatus) return aStatus - bStatus;
            
            return (a.price || a.startingBid) - (b.price || b.startingBid);
        });
    }, [items, searchTerm, filterType, filterRarity]);


    return (
        <section className="mercato-page">
            <h1>Mercato Nero di Eldoria</h1>
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

                <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
                    <option value="all">Tutte le Tipologie</option>
                    {ITEM_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>
                
                <select onChange={(e) => setFilterRarity(e.target.value)} value={filterRarity}>
                    <option value="all">Tutte le Rarità</option>
                    {RARITIES.map(rarity => (<option key={rarity} value={rarity}>{rarity}</option>))}
                </select>

            </div>

            <div className="items-grid">
                {filteredItems.map(item => (
                    <ItemCard key={item.id} item={item} />
                ))}
                {!loading && filteredItems.length === 0 && <p style={{gridColumn: '1 / -1', textAlign: 'center'}}>Nessun oggetto trovato con i criteri di ricerca.</p>}
            </div>
            
        </section>
    );
}