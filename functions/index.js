import * as functions from 'firebase-functions';
import admin from "firebase-admin";
admin.initializeApp();

import sgMail from '@sendgrid/mail';

// --- VARIABILI DI CONFIGURAZIONE ---
// Questa riga fallirà se la chiave non è settata, causando l'errore di deploy
sgMail.setApiKey(functions.config().sendgrid.key); 

const DM_EMAIL = 'santomassimo85@gmail.com';
const SENDER_EMAIL = 'santomassimo85@gmail.com';

// --- FUNZIONE PRINCIPALE ---
export const notifyMasterOnBid = functions.firestore
    .document('items/{itemId}')
    .onUpdate(async (change, context) => {
        
        // 🚀 DEBUG START: LOG DI AVVIO FUNZIONE
        console.log("DEBUG START: Funzione notifyMasterOnBid avviata per Item ID:", context.params.itemId);

        const newData = change.after.data();
        const previousData = change.before.data();

        // Controlla se l'offerta è cambiata o se è la prima (mappa con valore zero)
        if (newData.currentBid === previousData.currentBid) {
            console.log("DEBUG: Nessun cambio di offerta rilevato. Uscita.");
            return null;
        }

        // Regola di controllo: la nuova offerta deve essere maggiore della precedente
        // (o maggiore di zero, se l'offerta precedente era zero o non esisteva)
        if (!newData.currentBid || newData.currentBid < (previousData.currentBid || previousData.startingBid || 0)) {
            console.log("DEBUG: Nuova offerta non valida/inferiore. Uscita.");
            return null;
        }

        const itemName = newData.name || 'Oggetto Sconosciuto';
        const newBid = newData.currentBid || 'N/A';
        const bidder = newData.bidderEmail || 'Anonimo';
        const itemId = context.params.itemId;

        const msg = {
            to: DM_EMAIL,
            from: SENDER_EMAIL,
            subject: `NUOVA OFFERTA AL MERCATO NERO per ${itemName}`,
            html: `
                <h2>Allarme Mercato Nero!</h2>
                <p>Nuova offerta registrata:</p>
                <ul>
                    <li><strong>Oggetto:</strong> ${itemName}</li>
                    <li><strong>Offerta:</strong> ${newBid} G.P.</li>
                    <li><strong>Offerente:</strong> ${bidder}</li>
                    <li><strong>ID Database:</strong> ${itemId}</li>
                </ul>
            `,
        };

        try {
            await sgMail.send(msg);
            // LOG DI SUCCESSO
            console.log(`DEBUG SUCCESS: Email inviata a ${DM_EMAIL} per ${itemName}`);
            return true;
        } catch (error) {
            // LOG DI ERRORE DETTAGLIATO
            console.error('ERRORE CRITICO INVIO EMAIL:', error.response?.body || error);
            return false;
        }
    });