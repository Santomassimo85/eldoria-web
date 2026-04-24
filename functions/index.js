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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { FieldValue } = require("firebase-admin/firestore");

const PLAYER_TURN_DURATION_MS = 3 * 60 * 60 * 1000;
const BOSS_TURN_DURATION_MS = 1 * 60 * 60 * 1000;
const BOSS_SYSTEM_UID = "BOSS_MSG";

exports.autoSwitchBossTurn = onSchedule(
    { schedule: "every 1 minutes", timeZone: "Europe/Rome", region: "us-central1" },
    async () => {
        const dbAdmin = admin.firestore();
        const turnRef = dbAdmin.doc("battle_meta/turn_tracker");

        // Pre-check: se non c'è un boss attivo vivo, non switchiamo nulla.
        const bossesSnap = await dbAdmin.collection("bosses").where("isActive", "==", true).get();
        const hasLiveBoss = bossesSnap.docs.some((d) => (d.data().hp ?? 0) > 0);
        if (!hasLiveBoss) {
            console.log("⏸ Nessun boss attivo vivo, skip.");
            return;
        }

        let didSwitch = false;
        let newPhaseName = "";

        try {
            await dbAdmin.runTransaction(async (tx) => {
                const snap = await tx.get(turnRef);
                if (!snap.exists) return;
                const data = snap.data();

                if (data.fightStarted !== true) return;
                if (!data.expiryDate) return;

                const nowMs = Date.now();
                const expiryMs = data.expiryDate.toMillis
                    ? data.expiryDate.toMillis()
                    : new Date(data.expiryDate).getTime();
                if (nowMs < expiryMs) return;

                if (data.lastSwitchedAt) {
                    const lastMs = data.lastSwitchedAt.toMillis
                        ? data.lastSwitchedAt.toMillis()
                        : new Date(data.lastSwitchedAt).getTime();
                    if (nowMs - lastMs < 10000) return;
                }

                newPhaseName = data.phase === "players" ? "boss" : "players";
                const duration = newPhaseName === "players" ? PLAYER_TURN_DURATION_MS : BOSS_TURN_DURATION_MS;

                tx.update(turnRef, {
                    phase: newPhaseName,
                    expiryDate: new Date(nowMs + duration),
                    actedPlayers: [],
                    turnNumber: newPhaseName === "players" ? (data.turnNumber || 0) + 1 : data.turnNumber,
                    lastSwitchedAt: FieldValue.serverTimestamp(),
                });
                didSwitch = true;
            });

            if (didSwitch) {
                const turnMsg = newPhaseName === "boss"
                    ? "⚠️ TEMPO SCADUTO! Il Boss entra in azione!"
                    : "🛡️ IL BOSS tace... Eroi, tocca a voi!";
                await dbAdmin.collection("world_boss_chat").add({
                    text: turnMsg,
                    senderName: "SISTEMA",
                    uid: BOSS_SYSTEM_UID,
                    content: turnMsg,
                    category: "Turno",
                    timestamp: FieldValue.serverTimestamp(),
                    isSystem: true,
                });
                console.log(`✅ Turno commutato a: ${newPhaseName}`);
            }
        } catch (err) {
            console.error("❌ autoSwitchBossTurn fallita:", err);
        }
    },
);

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
