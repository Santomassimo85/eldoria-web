const functions = require('firebase-functions');
const admin = require("firebase-admin");
const nodemailer = require('nodemailer');
const { defineString } = require("firebase-functions/params");

// Inizializza Firebase Admin SDK
admin.initializeApp();

// --- VARIABILI DI CONFIGURAZIONE ---
const DM_EMAIL = 'santomassimo85@gmail.com';
// Le credenziali per l'invio verranno prese dalle variabili d'ambiente
const gmailEmailParam = defineString("GMAIL_EMAIL");
const gmailAppPasswordParam = defineString("GMAIL_APP_PASSWORD");

// --- RILEVAZIONE AMBIENTE ---
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_EMULATOR_HUB;
console.log(`🌍 Ambiente rilevato: ${isEmulator ? "LOCALE (emulator)" : "CLOUD (deploy)"}`);


const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

// --- FUNZIONE PRINCIPALE ---
exports.notifyMasterOnBid = onDocumentUpdated('items/{itemId}', async (event) => {
        const itemId = event.params.itemId;
        console.log("🚀 notifyMasterOnBid v2 attivata per Item ID:", itemId);

        const gmailEmail = gmailEmailParam.value();
        const gmailAppPassword = gmailAppPasswordParam.value();

        if (!gmailEmail || !gmailAppPassword) {
            console.error("❌ Credenziali Gmail non configurate. Email non inviata.");
            return null;
        }

        // Configura il transporter di Nodemailer
        const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                        user: gmailEmail,
                        pass: gmailAppPassword, // Usa una App Password di Google
                },
        });

        const newData = event.data.after.data();
        const previousData = event.data.before.data();

        if (newData.currentBid === previousData.currentBid) {
            console.log("ℹ️ Nessuna variazione di offerta rilevata.");
            return null;
        }

        const previousPrice = previousData.currentBid || previousData.startingBid || 0;
        if (!newData.currentBid || newData.currentBid <= previousPrice) {
            console.log(`⚠️ Offerta non valida (${newData.currentBid} <= ${previousPrice}).`);
            return null;
        }

        const itemName = newData.name || 'Oggetto Sconosciuto';
        const newBid = newData.currentBid || 'N/A';
        const bidder = newData.bidderEmail || 'Anonimo';

        const mailOptions = {
            to: DM_EMAIL,
            from: `"Mercato Nero di Eldoria" <${gmailEmail}>`,
            subject: `💰 Nuova Offerta al Mercato Nero: ${itemName}`,
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
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email inviata correttamente a ${DM_EMAIL} per ${itemName}`);
            return true;
        } catch (error) {
            console.error('❌ ERRORE INVIO EMAIL:', error);
            return false;
        }
    });
