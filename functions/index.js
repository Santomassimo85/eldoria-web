const functions = require('firebase-functions');
const admin = require("firebase-admin");
const sgMail = require('@sendgrid/mail');

// Inizializza Firebase Admin SDK
admin.initializeApp();

// --- VARIABILI DI CONFIGURAZIONE ---
const DM_EMAIL = 'santomassimo85@gmail.com';
const SENDER_EMAIL = 'santomassimo85@gmail.com';

// --- RILEVAZIONE AMBIENTE ---
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_EMULATOR_HUB;
console.log(`🌍 Ambiente rilevato: ${isEmulator ? "LOCALE (emulator)" : "CLOUD (deploy)"}`);

// --- CONFIGURAZIONE SENDGRID ---
let sendgridApiKey;

try {
  if (isEmulator) {
    // 🔹 Lettura chiave da variabile ambiente locale (.env)
    require("dotenv").config();
    sendgridApiKey = process.env.SENDGRID_API_KEY;
    console.log("✅ Chiave SendGrid caricata da .env locale");
  } else {
    // 🔹 Lettura chiave da Firebase Functions Config
    sendgridApiKey = functions.config().sendgrid.key;
    console.log("✅ Chiave SendGrid caricata da Firebase Config");
  }

  if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
  } else {
    throw new Error("Chiave SendGrid non trovata");
  }

} catch (err) {
  console.error("❌ ERRORE CONFIGURAZIONE SENDGRID:", err.message);
}

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

// --- FUNZIONE PRINCIPALE ---
exports.notifyMasterOnBid = onDocumentUpdated('items/{itemId}', async (event) => {
    const itemId = event.params.itemId;
    console.log("🚀 notifyMasterOnBid v2 attivata per Item ID:", itemId);

    if (!sendgridApiKey) {
      console.error("❌ Nessuna chiave SendGrid disponibile. Email non inviata.");
      return null;
    }

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

    const msg = {
      to: DM_EMAIL,
      from: SENDER_EMAIL,
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
      await sgMail.send(msg);
      console.log(`✅ Email inviata correttamente a ${DM_EMAIL} per ${itemName}`);
      return true;
    } catch (error) {
      console.error('❌ ERRORE INVIO EMAIL:', error.response?.body || error);
      return false;
    }
  });
