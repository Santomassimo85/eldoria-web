// src/pages/Mercato.jsx (Aggiornato per Blind Bid)

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import LoginDropdown from '../LoginDropdown';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../firebase'; 
import { collection, getDocs } from 'firebase/firestore'; 

// --- COMPONENTE CARD ---
const ItemCard = ({ item }) => {
    const navigate = useNavigate();

    const handleCardClick = () => {
        navigate(`/mercato/${item.id}`); 
    };

    // La card mostra SOLO il prezzo iniziale (o il prezzo fisso), non l'offerta più alta (è un blind bid).
    const displayPrice = item.startingBid > 0 
        ? `Prezzo Base: ${item.startingBid} GP`
        : `Prezzo Fisso: ${item.price} GP`;

    return (
        <div className="item-card" onClick={handleCardClick}>
            <img src={item.img} alt={item.name} className="item-image" />
            <div className="item-details">
                <p className="item-name"><strong>{item.name}</strong></p>
                <p className="item-type">{item.type}</p>
                <p className="item-class">{item.class}</p>
                <p className="item-price">{displayPrice}</p>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE MERCATO NERO ---
export default function Mercato() {
    const { currentUser } = useAuth();
    const [itemsData, setItemsData] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterClass, setFilterClass] = useState('all');

    // Carica i dati da Firestore
    useEffect(() => {
        const fetchItems = async () => {
            if (!db) return;
            try {
                const itemsCollection = collection(db, 'items');
                const itemSnapshot = await getDocs(itemsCollection);
                const itemsList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                setItemsData(itemsList);
            } catch (error) {
                console.error("Errore nel caricamento del mercato:", error);
            } finally {
                setLoading(false);
            }
        };
        if (currentUser) {
             fetchItems();
        } else {
             setLoading(false);
        }
    }, [currentUser]); 

    // Estrai opzioni uniche per i filtri (logica invariata)
    const itemTypes = useMemo(() => [...new Set(itemsData.map(item => item.type))], [itemsData]);
    const itemClasses = useMemo(() => [...new Set(itemsData.map(item => item.class))], [itemsData]);

    // Logica di Filtro e Ricerca (invariata)
    const filteredItems = useMemo(() => {
        if (loading) return [];
        return itemsData.filter(item => {
            const matchesType = filterType === 'all' || item.type === filterType;
            const matchesClass = filterClass === 'all' || item.class === filterClass;
            const lowerCaseSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm.length < 3 || 
                                  item.name.toLowerCase().includes(lowerCaseSearch) ||
                                  item.type.toLowerCase().includes(lowerCaseSearch) ||
                                  item.class.toLowerCase().includes(lowerCaseSearch);
            return matchesType && matchesClass && matchesSearch;
        }).sort((a, b) => (a.startingBid || a.price) - (b.startingBid || b.price)); // Ordina per prezzo base
    }, [searchTerm, filterType, filterClass, itemsData, loading]);

    // ... (PROTEZIONE: Visualizzazione non loggata e caricamento) ...
    if (!currentUser) {
        return (
            <section style={{ textAlign: 'center', paddingTop: '100px' }}>
                <h1 style={{ color: 'var(--red)' }}>Accesso Negato</h1>
                <p>Devi effettuare l'accesso per visualizzare il **Mercato Nero**.</p>
                <div style={{ marginTop: '30px' }}>
                    <LoginDropdown standalone={true} /> 
                </div>
            </section>
        );
    }
    if (loading) {
        return <div style={{ textAlign: 'center', paddingTop: '50px' }}>Caricamento oggetti del Mercato...</div>;
    }

    // CONTENUTO PRINCIPALE (Utente Loggato)
    return (
        <section className="mercato-page">
            <h1>Mercato Nero Segreto</h1>
            <p className="mercato-welcome">Benvenuto {currentUser.email.split('@')[0]}, i contratti ti aspettano!</p>

            {/* BARRA DI CONTROLLO (Filtri) - Invariata */}
            <div className="mercato-controls">
                {/* ... (input e select qui) ... */}
                <input
                    type="text"
                    placeholder="Cerca per nome, tipo o classe (min. 3 caratteri)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-bar"
                />

                <select onChange={(e) => setFilterType(e.target.value)} value={filterType}>
                    <option value="all">Tutte le Tipologie</option>
                    {itemTypes.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>

                <select onChange={(e) => setFilterClass(e.target.value)} value={filterClass}>
                    <option value="all">Tutte le Classi</option>
                    {itemClasses.map(itemClass => (<option key={itemClass} value={itemClass}>{itemClass}</option>))}
                </select>
            </div>

            {/* VISUALIZZAZIONE DELLE CARD */}
            <div className="items-grid">
                {filteredItems.length > 0 ? (
                    filteredItems.map(item => (<ItemCard key={item.id} item={item} />))
                ) : (
                    <p className="no-results">Nessun oggetto trovato che corrisponda ai criteri.</p>
                )}
            </div>
            
        </section>
    );
}