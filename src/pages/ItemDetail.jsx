// src/pages/ItemDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext'; 
import { db } from '../firebase';
// Usiamo arrayUnion/arrayRemove per aggiornare un array (anche se useremo i Map qui)
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'; 

// 🎯 VARIABILE CRITICA: L'URL DEL TUO WEBHOOK DI PIPEDREAM!
const NOTIFICATION_WEBHOOK_URL = "https://eoftih1a36e46sq.m.pipedream.net"; 

export default function ItemDetail() {
    const { currentUser } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [offer, setOffer] = useState('');
    const [message, setMessage] = useState('');

    // Sincronizzazione in Tempo Reale (Firestore)
    useEffect(() => {
        if (!db || !id) return;
        
        setLoading(true); 

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

        return () => unsubscribe(); 
    }, [id]);

    // Variabili calcolate
    // ⚠️ ELIMINAZIONE DEL WARNING: Dichiariamo solo basePrice qui.
    const basePrice = item ? (item.startingBid || item.price) : 0;
    
    // Calcolo per il render: l'asta è attiva se c'è un prezzo base o se ci sono offerte.
    const isAuction = item ? (item.startingBid > 0) : false; 
    
    // Controlla se l'utente corrente ha già fatto un'offerta
    const userBid = currentUser && item?.bids ? item.bids[currentUser.uid] : null;

    // Gestisce l'invio dell'offerta (Aggiornamento Firestore + Webhook)
    const handleSubmitOffer = async (e) => {
        e.preventDefault();
        setMessage('');

        const numericOffer = parseInt(offer);
        const minBid = basePrice; // Prezzo minimo è il prezzo di partenza

        if (isNaN(numericOffer) || numericOffer < minBid) {
            setMessage(`L'offerta deve essere un numero maggiore o uguale a ${minBid} GP.`);
            return;
        }
        if (!currentUser) {
            setMessage("Devi essere loggato per fare un'offerta.");
            return;
        }
        if (userBid) {
             setMessage("⚠️ Hai già piazzato la tua offerta singola per questo item.");
             return;
        }

        try {
            // 1. AGGIORNA FIRESTORE: Inserisce l'offerta nella sottomappa 'bids'
            const itemRef = doc(db, 'items', id);
            
            // Usiamo l'ID dell'utente (currentUser.uid) come chiave per l'offerta unica
            const newBidMap = {
                [`bids.${currentUser.uid}`]: numericOffer,
                [`bidderEmails.${currentUser.uid}`]: currentUser.email
            };
            
            await updateDoc(itemRef, newBidMap);
            
            // 2. INVIA NOTIFICA VIA WEBHOOK (Pipedream)
            const notificationPayload = {
                itemId: id,
                itemName: item.name,
                // Usiamo il nome disincantato dall'email
                bidderName: currentUser.email.split('@')[0], 
                bidderEmail: currentUser.email,
                bidAmount: numericOffer,
            };

            const webhookResponse = await fetch(NOTIFICATION_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationPayload),
            });

            if (!webhookResponse.ok) {
                throw new Error('Offerta registrata, ma la notifica via email è fallita.');
            }
            
            // 3. Successo
            setMessage(`✅ Offerta di ${numericOffer} GP registrata! NON PUOI più modificarla.`);
            setOffer('');

        } catch (error) {
            console.error("Errore finale:", error);
            setMessage(`Offerta registrata, ma errore: ${error.message}`);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', paddingTop: '50px' }}>Caricamento dettagli...</div>;
    }

    if (!item) {
        return (
            <section style={{ textAlign: 'center', paddingTop: '50px' }}>
                <h1>Oggetto Non Trovato</h1>
                <p>Nessun documento trovato con ID: {id}</p>
                <button onClick={() => navigate('/mercato')} className="back-button">
                    ← Torna al Mercato
                </button>
            </section>
        );
    }
    
    // Per il render:
    const currentPriceDisplay = item.startingBid || item.price; // Mostra solo il prezzo base

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
                        {isAuction ? "Prezzo Base Asta" : "Prezzo Fisso"}: 
                        <strong style={{ color: isAuction ? 'var(--red)' : 'var(--gold)', fontSize: '1.2em', marginLeft: '10px' }}>
                            {currentPriceDisplay} G.P.
                        </strong>
                    </p>
                    
                    {/* TRACCIA OFFERTA UTENTE CORRENTE */}
                    {userBid && (
                        <p className="last-bid-info success">
                           **Hai già piazzato la tua offerta: {userBid} GP.** </p>
                    )}
                    
                    <hr />
                    <h2>Descrizione</h2>
                    <p className="detail-description">{item.description}</p>
                    
                    {/* SEZIONE OFFERTA (solo se loggato, è un'asta E l'utente non ha offerto) */}
                    {currentUser && isAuction && !userBid && (
                        <div className="offer-section">
                            <form onSubmit={handleSubmitOffer}>
                                <input
                                    type="number"
                                    placeholder={`Offri almeno ${basePrice} GP`}
                                    value={offer}
                                    onChange={(e) => setOffer(e.target.value)}
                                    min={basePrice} // Minimo è il prezzo base
                                    required
                                />
                                <button type="submit" className="offer-button">Fai la tua Offerta</button>
                            </form>
                            {/* ... (Messaggio di successo/errore) ... */}
                        </div>
                    )}
                    
                    {message && <p className={`offer-message ${message.includes('registrata') ? 'success' : 'error'}`}>{message}</p>}
                </div>
            </div>
        </section>
    );
}