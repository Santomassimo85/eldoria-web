// src/pages/Mercato.jsx (Aggiornato)

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import LoginDropdown from '../LoginDropdown';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../firebase'; // Importa Firestore
import { collection, getDocs } from 'firebase/firestore'; // Importa funzioni DB

// --- COMPONENTE CARD ---
const ItemCard = ({ item }) => {
    const navigate = useNavigate();

    const handleCardClick = () => {
        // L'ID del documento Firestore è una stringa, usiamo item.id
        navigate(`/mercato/${item.id}`); 
    };

    // Usa currentBid se > 0, altrimenti startingBid se > 0, altrimenti price
    const displayPrice = item.currentBid > 0 
        ? `Offerta attuale: ${item.currentBid} GP`
        : item.startingBid > 0
        ? `Base Asta: ${item.startingBid} GP`
        : `Prezzo: ${item.price} GP`;

    return (
        <div className="item-card" onClick={handleCardClick}>
            <img src={item.img} alt={item.name} className="item-image" />
            <div className="item-details">
                <p className="item-name"><strong>{item.name}</strong></p>
                <p className="item-type">{item.type}</p>
                <p className="item-class">{item.class}</p>
                <p className="item-price">{displayPrice}</p>
                {item.bidderEmail && <p className="item-bidder">Offerente: {item.bidderEmail.split('@')[0]}</p>}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPALE MERCATO NERO ---
export default function Mercato() {
    const { currentUser } = useAuth();
    const [itemsData, setItemsData] = useState([]); // Stato per i dati da Firestore
    const [loading, setLoading] = useState(true); // Stato di caricamento
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterClass, setFilterClass] = useState('all');

    // Carica i dati da Firestore all'avvio
    useEffect(() => {
        const fetchItems = async () => {
            if (!db) return; // Uscita se DB non inizializzato
            
            try {
                const itemsCollection = collection(db, 'items');
                const itemSnapshot = await getDocs(itemsCollection);
                // Mappa i documenti includendo l'ID del documento stesso
                const itemsList = itemSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
                setItemsData(itemsList);
            } catch (error) {
                console.error("Errore nel caricamento del mercato:", error);
            } finally {
                setLoading(false);
            }
        };
        // Carica i dati solo se l'utente è loggato, altrimenti aspetta la schermata di login
        if (currentUser) {
             fetchItems();
        } else {
             setLoading(false); // Finito di caricare (niente da mostrare finché non si logga)
        }
    }, [currentUser]); 

    // Estrai opzioni uniche per i filtri
    const itemTypes = useMemo(() => [...new Set(itemsData.map(item => item.type))], [itemsData]);
    const itemClasses = useMemo(() => [...new Set(itemsData.map(item => item.class))], [itemsData]);

    // Logica di Filtro e Ricerca
    const filteredItems = useMemo(() => {
        // La logica di ordinamento è basata sul prezzo/offerta (vedi ItemDetail per i campi)
        return itemsData.filter(item => {
            const matchesType = filterType === 'all' || item.type === filterType;
            const matchesClass = filterClass === 'all' || item.class === filterClass;
            const lowerCaseSearch = searchTerm.toLowerCase();
            const matchesSearch = searchTerm.length < 3 || 
                                  item.name.toLowerCase().includes(lowerCaseSearch) ||
                                  item.type.toLowerCase().includes(lowerCaseSearch) ||
                                  item.class.toLowerCase().includes(lowerCaseSearch);
            return matchesType && matchesClass && matchesSearch;
        }).sort((a, b) => (a.currentBid || a.startingBid || a.price) - (b.currentBid || b.startingBid || b.price));
    }, [searchTerm, filterType, filterClass, itemsData]);

    // PROTEZIONE: Visualizzazione non loggata
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
    
    // Mostra caricamento finché non arrivano i dati
    if (loading) {
        return <div style={{ textAlign: 'center', paddingTop: '50px' }}>Caricamento oggetti del Mercato...</div>;
    }

    // CONTENUTO PRINCIPALE (Utente Loggato)
    return (
        <section className="mercato-page">
            <h1>Mercato Nero Segreto</h1>
            <p className="mercato-welcome">Benvenuto {currentUser.email.split('@')[0]}, i contratti ti aspettano!</p>

            {/* BARRA DI FILTRO E RICERCA (Invariata) */}
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