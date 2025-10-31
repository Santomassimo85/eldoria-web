const functions = require('firebase-functions');
const admin = require("firebase-admin");
admin.initializeApp();

const sgMail = require('@sendgrid/mail');

// --- VARIABILI DI CONFIGURAZIONE ---
sgMail.setApiKey(functions.config().sendgrid.key); 

const DM_EMAIL = 'santomassimo85@gmail.com';
const SENDER_EMAIL = 'santomassimo85@gmail.com';

// --- FUNZIONE PRINCIPALE ---
exports.notifyMasterOnBid = functions.firestore
    .document('items/{itemId}')
    .onUpdate(async (change, context) => {

        const newData = change.after.data();
        const previousData = change.before.data();

        if (newData.currentBid === previousData.currentBid) return null;
        if (!newData.currentBid || newData.currentBid < (previousData.currentBid || previousData.startingBid || 0)) return null;

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
            console.log(`Notifica inviata a ${DM_EMAIL} per ${itemName}`);
            return true;
        } catch (error) {
            console.error('Errore nell\'invio dell\'email:', error.response?.body || error);
            return false;
        }
    });
