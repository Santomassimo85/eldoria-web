// src/pages/ItemDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext'; 
// Importazioni Firebase per Firestore
import { db } from '../firebase';
// Modificato: non usiamo più getDoc, ma onSnapshot per l'aggiornamento in tempo reale
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'; 

export default function ItemDetail() {
    const { currentUser } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [offer, setOffer] = useState('');
    const [message, setMessage] = useState('');

    const MASTER_EMAIL = "santomassimo85@gmail.com"; 

    // 🚀 NUOVA LOGICA: Sottoscrizione in Tempo Reale (onSnapshot)
    useEffect(() => {
        // Verifica che 'db' e 'id' siano pronti
        if (!db || !id) return;
        
        setLoading(true); // Imposta il caricamento finché non riceviamo il primo dato

        const itemRef = doc(db, 'items', id);
        
        // onSnapshot: Ascolta i cambiamenti in tempo reale
        const unsubscribe = onSnapshot(itemRef, (docSnap) => {
            if (docSnap.exists()) {
                setItem(docSnap.data()); 
                setMessage('');
            } else {
                setMessage("Oggetto non trovato nel database.");
                setItem(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Errore onSnapshot:", error);
            setMessage("Errore di connessione al database.");
            setLoading(false);
        });

        // La funzione di cleanup (necessaria con i listener)
        return () => unsubscribe(); 

    }, [id]); // Ricarica solo se l'ID cambia

    // Variabili calcolate
    const basePrice = item ? (item.currentBid || item.startingBid || item.price) : 0;
    const isAuction = item ? (item.currentBid > 0 || item.startingBid > 0) : false; 
    const currentBidDisplay = item ? (item.currentBid || item.startingBid || item.price) : 0;
    
    // Gestisce l'invio dell'offerta (Aggiornamento Firestore)
    const handleSubmitOffer = async (e) => {
        e.preventDefault();
        setMessage('');

        const numericOffer = parseInt(offer);
        if (isNaN(numericOffer) || numericOffer <= basePrice) {
            setMessage(`L'offerta deve essere un numero maggiore di ${basePrice} GP.`);
            return;
        }
        if (!currentUser) {
            setMessage("Devi essere loggato per fare un'offerta.");
            return;
        }

        try {
            // 1. AGGIORNA FIRESTORE (Questo triggera la Cloud Function e onSnapshot su tutti i client)
            const itemRef = doc(db, 'items', id);
            await updateDoc(itemRef, {
                currentBid: numericOffer,
                bidderEmail: currentUser.email,
                lastBidTimestamp: new Date().getTime(),
            });
            
            // Non serve più aggiornare lo stato locale (setItem) perché onSnapshot lo farà.
            
            setMessage(`Offerta di ${numericOffer} GP registrata! Il Master (${MASTER_EMAIL}) riceverà la notifica.`);
            setOffer('');

        } catch (error) {
            console.error("Errore nell'invio dell'offerta:", error);
            setMessage(`Si è verificato un errore durante l'invio. Riprova. (Codice errore: ${error.code || 'ignoto'})`);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', paddingTop: '50px' }}>Caricamento dettagli...</div>;
    }

    if (!item) {
        return (
            <section style={{ textAlign: 'center', paddingTop: '50px' }}>
                <h1>Oggetto Non Trovato</h1>
                <p>{message}</p>
                <button onClick={() => navigate('/mercato')} className="back-button">
                    ← Torna al Mercato
                </button>
            </section>
        );
    }
    
    // L'errore isMaster è stato rimosso in quanto non utilizzato nel file

    return (
        <section className="item-detail-page">
            <button onClick={() => navigate('/mercato')} className="back-button">
                ← Torna al Mercato
            </button>

            <div className="detail-content">
                <img src={item.img} alt={item.name} className="detail-image" />
                <div className="detail-info">
                    <h1>{item.name}</h1>
                    <p className="detail-price">
                        {isAuction ? "Offerta Attuale" : "Prezzo Fisso"}: 
                        <strong style={{ color: isAuction ? 'var(--red)' : 'var(--gold)', fontSize: '1.2em', marginLeft: '10px' }}>
                            {currentBidDisplay} G.P.
                        </strong>
                    </p>
                    
                    {/* SEZIONE TRACCIA VISIVA */}
                    {item.bidderEmail && (
                        <p className="last-bid-info">
                            Ultima Offerta registrata da: **{item.bidderEmail.split('@')[0]}**
                        </p>
                    )}
                    
                    <hr />
                    <h2>Descrizione</h2>
                    <p className="detail-description">{item.description}</p>
                    
                    {/* SEZIONE OFFERTA (solo se loggato e se è un'asta) */}
                    {currentUser && isAuction && (
                        <div className="offer-section">
                            <form onSubmit={handleSubmitOffer}>
                                <input
                                    type="number"
                                    placeholder={`Offri almeno ${basePrice + 1} GP`}
                                    value={offer}
                                    onChange={(e) => setOffer(e.target.value)}
                                    min={basePrice + 1}
                                    required
                                />
                                <button type="submit" className="offer-button">Fai la tua Offerta</button>
                            </form>
                            {message && <p className={`offer-message ${message.includes('registrata') ? 'success' : 'error'}`}>{message}</p>}
                        </div>
                    )}
                    {currentUser && !isAuction && <p style={{ marginTop: '20px' }}>Questo è un oggetto a prezzo fisso.</p>}
                </div>
            </div>
        </section>
    );
}