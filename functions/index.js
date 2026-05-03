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
            from: `"Mercato Nero di Exanthia" <${gmailEmail}>`,
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

// ========================================================================
//  PUSH NOTIFICATIONS (Firebase Cloud Messaging)
// ========================================================================

const { onDocumentCreated } = require("firebase-functions/v2/firestore");

/** Send a push to a list of user uids. Cleans up invalid tokens. */
async function sendPush({ uids, title, body, url, tag }) {
  if (!uids || uids.length === 0) return;
  const dbAdmin = admin.firestore();

  // Read fcmTokens from each character doc
  const tokenToUid = new Map();
  const reads = await Promise.all(uids.map(uid => dbAdmin.doc(`characters/${uid}`).get()));
  reads.forEach((snap, i) => {
    const tokens = snap.data()?.fcmTokens || [];
    tokens.forEach(t => tokenToUid.set(t, uids[i]));
  });
  const tokens = [...tokenToUid.keys()];
  if (tokens.length === 0) return;

  const messaging = admin.messaging();
  const safeTitle = title || "Exanthia";
  const safeBody  = body  || "Apri l'app per i dettagli.";
  // Keep url in `data` so onMessage / SW notificationclick can read it,
  // but put title/body inside webpush.notification so the OS can render the
  // notification even when the service worker is asleep (much more reliable
  // than data-only payloads on installed PWAs).
  const message = {
    tokens,
    data: { url: url || "/" },
    webpush: {
      notification: {
        title: safeTitle,
        body:  safeBody,
        icon:  "/logo192.png",
        badge: "/logo192.png",
        ...(tag ? { tag } : {}),
      },
      fcmOptions: { link: url || "/" },
    },
  };

  let res;
  try {
    res = await messaging.sendEachForMulticast(message);
  } catch (err) {
    console.error("[push] sendEachForMulticast error:", err);
    return;
  }

  // Remove invalid tokens
  const invalidByUid = new Map();
  res.responses.forEach((r, idx) => {
    if (r.success) return;
    const code = r.error?.code || "";
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      const t = tokens[idx];
      const uid = tokenToUid.get(t);
      if (!invalidByUid.has(uid)) invalidByUid.set(uid, []);
      invalidByUid.get(uid).push(t);
    }
  });
  for (const [uid, badTokens] of invalidByUid.entries()) {
    try {
      await dbAdmin.doc(`characters/${uid}`).update({
        fcmTokens: FieldValue.arrayRemove(...badTokens),
      });
    } catch { /* ignore */ }
  }
  console.log(`[push] sent "${title}" to ${tokens.length} tokens (${res.successCount} ok, ${res.failureCount} fail)`);
}

async function getAllUids() {
  const snap = await admin.firestore().collection("characters").get();
  return snap.docs.map(d => d.id);
}

// 1) Auto-push on any in-app notification doc create
//    Covers: champion invite, bet wins, item won/lost, master "Send notification", etc.
exports.pushOnNotification = onDocumentCreated('notifications/{id}', async (event) => {
  const data = event.data?.data();
  if (!data?.userId) return;
  await sendPush({
    uids: [data.userId],
    title: data.title || "Exanthia",
    body: data.message || "",
    url: "/notifications",
    tag: `notif-${event.params.id}`,
  });
});

// 2) Boss appeared (new boss doc created with isActive:true, OR isActive flips on)
exports.pushOnBossSpawn = onDocumentCreated('bosses/{id}', async (event) => {
  const data = event.data?.data();
  if (!data?.isActive) return;
  const uids = await getAllUids();
  await sendPush({
    uids,
    title: "⚔️ Un Boss è apparso!",
    body: `${data.name || "Una nuova minaccia"} ti aspetta. Entra in battaglia!`,
    url: "/world-boss",
    tag: `boss-spawn-${event.params.id}`,
  });
});

exports.pushOnBossUpdate = onDocumentUpdated('bosses/{id}', async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;

  // Boss reactivated
  if (!before.isActive && after.isActive) {
    const uids = await getAllUids();
    await sendPush({
      uids,
      title: "⚔️ Un Boss è apparso!",
      body: `${after.name || "Una nuova minaccia"} ti aspetta!`,
      url: "/world-boss",
      tag: `boss-spawn-${event.params.id}`,
    });
  }

  // Boss death — hp dropped to 0
  const wasAlive = (before.hp ?? 0) > 0;
  const nowDead  = (after.hp ?? 0) <= 0;
  if (wasAlive && nowDead) {
    const uids = await getAllUids();
    await sendPush({
      uids,
      title: "🏆 Boss Sconfitto!",
      body: `${after.name || "Il boss"} è caduto. Vittoria per gli eroi di Exanthia!`,
      url: "/world-boss",
      tag: `boss-death-${event.params.id}`,
    });
  }
});

// 3) Player turn begins in boss fight
exports.pushOnTurnPhase = onDocumentUpdated('battle_meta/turn_tracker', async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;
  if (before.phase === "players" || after.phase !== "players") return;

  const dbAdmin = admin.firestore();
  const charsSnap = await dbAdmin.collection("characters").get();
  const aliveUids = charsSnap.docs.filter(d => (d.data().hp ?? 0) > 0).map(d => d.id);
  await sendPush({
    uids: aliveUids,
    title: "⚡ World Boss — Tocca a te!",
    body: "Il tuo turno è iniziato: entra in battaglia e colpisci il Boss.",
    url: "/world-boss",
    tag: `boss-turn-${after.turnNumber || ""}`,
  });
});

// 4) Player death (hp drops to 0 in any context)
exports.pushOnCharacterDeath = onDocumentUpdated('characters/{uid}', async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;
  if ((before.hp ?? 1) <= 0) return; // already dead before
  if ((after.hp  ?? 1) > 0)  return; // still alive
  await sendPush({
    uids: [event.params.uid],
    title: "💀 Sei caduto!",
    body: "Il tuo personaggio è stato sconfitto.",
    url: "/world-boss",
    tag: `death-${event.params.uid}`,
  });
});

// 5) Arena tournament events (registration open, fight start, your turn, fight winners, tournament winner)
exports.pushOnArenaUpdate = onDocumentUpdated('arena_meta/global', async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;

  const championsOnly = !!after.championsOnly;
  const arenaName = championsOnly ? "Arena dei Campioni" : "Arena dei Campioni";

  // Registration opened (broadcast — for champions-only the client already invites champions)
  if (before.phase !== "registration" && after.phase === "registration") {
    if (!championsOnly) {
      const uids = await getAllUids();
      await sendPush({
        uids,
        title: "🏛 Arena — Iscrizioni aperte!",
        body: "Le iscrizioni al torneo sono aperte. Entra nell'Arena dei Campioni!",
        url: "/arena",
        tag: "arena-open",
      });
    }
  }

  // Tournament concluded — broadcast
  if (before.phase !== "finished" && after.phase === "finished" && after.tournamentWinner) {
    const uids = await getAllUids();
    const winnerName = after.lastChampion?.name
      || after.characterSnapshots?.[after.tournamentWinner]?.name
      || "Un campione";
    await sendPush({
      uids,
      title: `🏆 ${arenaName} — Campione!`,
      body: `${winnerName} ha vinto il torneo!`,
      url: "/arena",
      tag: `tournament-end-${after.tournamentWinner}`,
    });
  }

  // Per-match transitions
  const beforeMatches = before.matches || [];
  const afterMatches  = after.matches || [];
  for (const a of afterMatches) {
    const b = beforeMatches.find(m => m.matchId === a.matchId);
    if (!b) continue;

    // Fight started
    if (b.status !== "active" && a.status === "active") {
      const fighters = (a.players || []).map(p => p.id);
      const matchup  = (a.players || []).map(p => p.name).join(" vs ");
      await sendPush({
        uids: fighters,
        title: "⚔️ Il match è iniziato!",
        body: matchup || "Combattimento in corso",
        url: "/arena",
        tag: `arena-fight-start-${a.matchId}`,
      });
    }

    // Whose turn changed
    if (a.status === "active" && a.turn && a.turn !== b.turn) {
      await sendPush({
        uids: [a.turn],
        title: "⚡ Tocca a te nell'arena!",
        body: "Compi la tua azione.",
        url: "/arena",
        tag: `arena-turn-${a.matchId}`,
      });
    }

    // Match concluded
    if (b.status !== "finished" && a.status === "finished" && a.winner) {
      const winnerId = a.winner;
      const losers   = (a.players || []).filter(p => p.id !== winnerId).map(p => p.id);
      const winnerName = (a.players || []).find(p => p.id === winnerId)?.name || "Sfidante";
      await sendPush({
        uids: [winnerId],
        title: "🏆 Hai vinto il match!",
        body: "Avanzi nel torneo. Ben fatto!",
        url: "/arena",
        tag: `arena-match-win-${a.matchId}`,
      });
      if (losers.length > 0) {
        await sendPush({
          uids: losers,
          title: "💀 Sei stato sconfitto",
          body: `${winnerName} ti ha battuto.`,
          url: "/arena",
          tag: `arena-match-loss-${a.matchId}`,
        });
      }
    }
  }
});

// 6) Market — open/close toggled by master via settings/market_config.isOpen
async function broadcastMarketState(nowOpen) {
  const uids = await getAllUids();
  if (nowOpen) {
    await sendPush({
      uids,
      title: "🛒 Mercato Nero aperto!",
      body: "Le aste del Mercato Nero sono ora attive. Fai le tue offerte!",
      url: "/mercato",
      tag: "market-open",
    });
  } else {
    await sendPush({
      uids,
      title: "🛒 Mercato Nero chiuso",
      body: "Il Mercato Nero ha chiuso le sue porte. Le aste sono terminate.",
      url: "/mercato",
      tag: "market-closed",
    });
  }
}

exports.pushOnMarketOpenChange = onDocumentUpdated('settings/market_config', async (event) => {
  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};
  const wasOpen = !!before.isOpen;
  const nowOpen = !!after.isOpen;
  if (wasOpen === nowOpen) return;
  await broadcastMarketState(nowOpen);
});

exports.pushOnMarketConfigCreated = onDocumentCreated('settings/market_config', async (event) => {
  const data = event.data?.data() || {};
  if (!data.isOpen) return;
  await broadcastMarketState(true);
});
