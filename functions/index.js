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
// Chiave API di Anthropic (Claude) per "Lo Scriba".
const anthropicKeyParam = defineString("ANTHROPIC_API_KEY");
// Chiave API di Google Gemini per le illustrazioni de "Lo Scriba".
const geminiKeyParam = defineString("GEMINI_API_KEY");
// Segreto per i token di disiscrizione; URL (opzionale) della funzione di disiscrizione.
const scribaSecretParam = defineString("SCRIBA_SECRET");
const scribaUnsubUrlParam = defineString("SCRIBA_UNSUB_URL");

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
  const safeTitle = title || "Crit Happens";
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
    title: data.title || "Crit Happens",
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

// 7) TCG Tournament — broadcast eventi globali (iscrizioni aperte, campione).
//    Gli eventi MIRATI (match del round pronto, sfida accettata, verdetto
//    del master) sono gestiti client-side via doc `notifications` (che a
//    loro volta fanno scattare pushOnNotification). Qui solo i broadcast a
//    tutti i giocatori, per non intasare il log in-app di ognuno.
exports.pushOnTcgTournamentUpdate = onDocumentUpdated('tcg_tournament/global', async (event) => {
  const before = event.data?.before?.data();
  const after  = event.data?.after?.data();
  if (!before || !after) return;

  // Iscrizioni aperte
  if (before.status !== "open" && after.status === "open") {
    const uids = await getAllUids();
    await sendPush({
      uids,
      title: "🃏 Torneo TCG — Iscrizioni aperte!",
      body: `${after.name || "Il Torneo dei Regni"} apre le iscrizioni. Schiera il tuo mazzo!`,
      url: "/tcg",
      tag: "tcg-tournament-open",
    });
  }

  // Torneo concluso — campione proclamato (broadcast a tutti)
  if (before.status !== "ended" && after.status === "ended" && after.champion) {
    const uids = await getAllUids();
    const champName = after.champion?.name || "Un campione";
    await sendPush({
      uids,
      title: "🏆 Torneo TCG — Campione!",
      body: `${champName} ha vinto ${after.name || "il Torneo dei Regni"}!`,
      url: "/tcg",
      tag: `tcg-tournament-end-${after.champion?.uid || ""}`,
    });
  }
});

// ========================================================================
//  LO SCRIBA — gazzetta periodica del mondo, scritta da Claude
// ========================================================================

const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { collectScribaData } = require("./scriba/collectEvents");
const { generateScribaContent } = require("./scriba/prompt");
const { renderScribaHtml, italianDateLabel } = require("./scriba/renderHtml");
const { generateIllustrations } = require("./scriba/images");
const { getScribaRecipients } = require("./scriba/recipients");

// Master + co-master: gli unici che possono pilotare Lo Scriba a mano.
const SCRIBA_MASTERS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];
const SCRIBA_INTERVAL_DAYS = 10; // cadenza
const SCRIBA_REVIEW_HOURS = 24;  // finestra di revisione prima dell'auto-invio (A1)

function buildGmailTransporter() {
  const gmailEmail = gmailEmailParam.value();
  const gmailAppPassword = gmailAppPasswordParam.value();
  if (!gmailEmail || !gmailAppPassword) {
    throw new Error("Credenziali Gmail non configurate.");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailEmail, pass: gmailAppPassword },
  });
}

function scribaFrom() {
  return `"Lo Scriba" <${gmailEmailParam.value()}>`;
}

// --- Disiscrizione: token HMAC + URL (link funzione se configurata, altrimenti mailto) ---
function scribaUnsubToken(uid) {
  const secret = scribaSecretParam.value() || "scriba-fallback-secret";
  return crypto.createHmac("sha256", secret).update(String(uid)).digest("hex");
}
function scribaUnsubUrlFor(uid) {
  const base = (scribaUnsubUrlParam.value() || "").trim();
  if (!base) return `mailto:${DM_EMAIL}?subject=${encodeURIComponent("Disiscrizione da Lo Scriba")}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}uid=${encodeURIComponent(uid)}&t=${scribaUnsubToken(uid)}`;
}

// --- Approvazione: il numero parte SOLO quando il direttore clicca il bottone
// nella mail. Token HMAC sull'id del numero; base = URL della funzione (progetto
// fisso, quindi cablata: niente param da valorizzare a ogni deploy).
const SCRIBA_FN_BASE = "https://us-central1-eldoria-web.cloudfunctions.net";
function scribaApproveToken(id) {
  const secret = scribaSecretParam.value() || "scriba-fallback-secret";
  return crypto.createHmac("sha256", secret).update("approve:" + String(id)).digest("hex");
}
function scribaApproveUrlFor(id) {
  return `${SCRIBA_FN_BASE}/scribaApprove?id=${encodeURIComponent(id)}&t=${scribaApproveToken(id)}`;
}
function scribaRegenToken(id) {
  const secret = scribaSecretParam.value() || "scriba-fallback-secret";
  return crypto.createHmac("sha256", secret).update("regen:" + String(id)).digest("hex");
}
function scribaRegenUrlFor(id) {
  return `${SCRIBA_FN_BASE}/scribaRegenerate?id=${encodeURIComponent(id)}&t=${scribaRegenToken(id)}`;
}

const sourceCountsOf = (data) => ({
  dossier: (data.dossierRiservato || []).length,
  arene: (data.arene || []).length,
  npc: (data.npcNoti || []).length,
  incarichi: (data.incarichiAperti || []).length,
  mercatoVenduti: (data.mercato?.venduti || []).length,
  mercatoInVendita: (data.mercato?.inVendita || []).length,
});

/**
 * Costruisce un numero completo: dati → testo (Claude) → 2-3 immagini (Gemini,
 * best-effort) caricate su Storage sotto `scriba/<assetPrefix>/`.
 */
async function buildScribaEdition(dbAdmin, { days, assetPrefix, edition = 1 }) {
  const data = await collectScribaData(dbAdmin, { days, edition });
  const content = await generateScribaContent({ apiKey: anthropicKeyParam.value(), data });
  let images = [];
  try {
    images = await generateIllustrations({
      geminiKey: geminiKeyParam.value(),
      illustrations: content.illustrations || [],
      bucket: admin.storage().bucket(),
      prefix: `scriba/${assetPrefix}`,
    });
  } catch (e) {
    console.error("[scriba] immagini fallite:", e.message);
  }
  return { data, content, images };
}

/** Invia un numero salvato a tutti i giocatori iscritti. Ritorna il conteggio. */
async function sendScribaToPlayers(dbAdmin, editionDoc) {
  const recipients = await getScribaRecipients(dbAdmin, admin);
  if (!recipients.length) return 0;
  const transporter = buildGmailTransporter();
  const from = scribaFrom();
  const subject = `📜 Lo Scriba N. ${editionDoc.number} — ${italianDateLabel(editionDoc.number)}`;
  let sent = 0;
  for (const r of recipients) {
    const html = renderScribaHtml({
      content: editionDoc.content,
      edition: editionDoc.number,
      images: editionDoc.images || [],
      unsubUrl: scribaUnsubUrlFor(r.uid),
    });
    try {
      await transporter.sendMail({ to: r.email, from, subject, html });
      sent++;
    } catch (e) {
      console.error(`[scriba] invio a ${r.email} fallito:`, e.message);
    }
  }
  return sent;
}

/**
 * Salva un numero come BOZZA e ne manda l'anteprima al direttore (master) CON
 * il bottone di approvazione. NON invia ai giocatori: parte solo al click.
 * Restituisce { id, edition }.
 */
async function proposeEditionToMaster(dbAdmin, { edition, built, createdBy = "auto", to = DM_EMAIL }) {
  // L'html ARCHIVIATO è la copia pulita (senza bottone): è ciò che vedranno i
  // lettori e l'archivio. Il bottone esiste solo nella mail al direttore.
  const cleanHtml = renderScribaHtml({
    content: built.content, edition, images: built.images, unsubUrl: scribaUnsubUrlFor("anteprima"),
  });
  const docRef = await dbAdmin.collection("newsletters").add({
    number: edition, status: "draft", content: built.content, images: built.images, html: cleanHtml,
    sources: sourceCountsOf(built.data), createdAt: FieldValue.serverTimestamp(), createdBy,
  });

  const masterHtml = renderScribaHtml({
    content: built.content, edition, images: built.images,
    unsubUrl: scribaUnsubUrlFor("anteprima"),
    approveUrl: scribaApproveUrlFor(docRef.id),
    regenerateUrl: scribaRegenUrlFor(docRef.id),
  });
  await buildGmailTransporter().sendMail({
    to, from: scribaFrom(),
    subject: `📜 [DA APPROVARE] Lo Scriba N. ${edition} — ${italianDateLabel(edition)}`,
    html: masterHtml,
  });
  return { id: docRef.id, edition };
}

/**
 * scribaPreview — genera un numero e lo manda al direttore con il BOTTONE di
 * approvazione (come l'automatismo). Non invia ai giocatori finché non approvi.
 */
exports.scribaPreview = onCall(
  { region: "us-central1", timeoutSeconds: 540, memory: "1GiB" },
  async (request) => {
    const email = request.auth?.token?.email;
    if (!email || !SCRIBA_MASTERS.includes(email)) {
      throw new HttpsError("permission-denied", "Solo il master può generare Lo Scriba.");
    }
    const dbAdmin = admin.firestore();
    const days = Number(request.data?.days) || SCRIBA_INTERVAL_DAYS;

    let edition = 1;
    try {
      const cfg = await dbAdmin.doc("settings/scriba").get();
      edition = (cfg.data()?.lastNumber || 0) + 1;
    } catch (_) { /* default 1 */ }

    let built;
    try {
      built = await buildScribaEdition(dbAdmin, { days, assetPrefix: `preview-${edition}`, edition });
    } catch (e) {
      console.error("[scriba] generazione fallita:", e);
      throw new HttpsError("internal", `Generazione fallita: ${e.message}`);
    }

    let proposed;
    try {
      proposed = await proposeEditionToMaster(dbAdmin, { edition, built, createdBy: email, to: email });
    } catch (e) {
      console.error("[scriba] invio anteprima fallito:", e);
      throw new HttpsError("internal", `Numero generato ma invio mail fallito: ${e.message}`);
    }

    return { ok: true, id: proposed.id, edition, sentTo: email, images: built.images.length, sources: sourceCountsOf(built.data) };
  }
);

/** scribaSendNow — invia subito un numero ai giocatori (pulsante "Invia ora" del pannello). */
exports.scribaSendNow = onCall(
  { region: "us-central1", timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const email = request.auth?.token?.email;
    if (!email || !SCRIBA_MASTERS.includes(email)) {
      throw new HttpsError("permission-denied", "Solo il master può inviare Lo Scriba.");
    }
    const id = String(request.data?.id || "");
    if (!id) throw new HttpsError("invalid-argument", "id del numero mancante.");

    const dbAdmin = admin.firestore();
    const ref = dbAdmin.collection("newsletters").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Numero inesistente.");
    const d = snap.data();
    if (d.status === "sent") throw new HttpsError("failed-precondition", "Numero già inviato.");

    const sent = await sendScribaToPlayers(dbAdmin, d);
    await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp(), recipientCount: sent });
    await dbAdmin.doc("settings/scriba").set(
      { lastNumber: d.number, lastSentAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { ok: true, sent };
  }
);

/**
 * scribaTick — l'automatismo (gira ogni ora). NESSUN timer di auto-invio: quando
 * è passato l'intervallo dall'ultimo numero e non c'è già una bozza in attesa,
 * genera il numero e lo manda al DIRETTORE con il bottone di approvazione. Parte
 * ai giocatori SOLO quando il direttore clicca (scribaApprove).
 */
exports.scribaTick = onSchedule(
  { schedule: "every 1 hours", timeZone: "Europe/Rome", region: "us-central1", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const dbAdmin = admin.firestore();
    const cfgRef = dbAdmin.doc("settings/scriba");
    const cfgSnap = await cfgRef.get();

    if (!cfgSnap.exists) {
      await cfgRef.set({
        enabled: true,
        intervalDays: SCRIBA_INTERVAL_DAYS,
        lastNumber: 0,
        lastSentAt: FieldValue.serverTimestamp(),
      });
      console.log("[scriba] config creata. Primo numero tra ~10 giorni.");
      return;
    }

    const cfg = cfgSnap.data();
    if (cfg.enabled === false) { console.log("[scriba] disattivato."); return; }

    const intervalDays = cfg.intervalDays || SCRIBA_INTERVAL_DAYS;
    const nowMs = Date.now();

    // C'è già una bozza che aspetta l'approvazione del direttore? Non generarne
    // un'altra: aspetta che approvi (o annulli dal pannello).
    const pending = await dbAdmin.collection("newsletters")
      .where("status", "in", ["draft", "approved"]).limit(1).get();
    if (!pending.empty) {
      console.log("[scriba] bozza già in attesa di approvazione del direttore.");
      return;
    }

    // È passato l'intervallo dall'ultimo invio?
    const lastSentMs = cfg.lastSentAt?.toMillis ? cfg.lastSentAt.toMillis() : 0;
    if (lastSentMs && (nowMs - lastSentMs) < intervalDays * 24 * 60 * 60 * 1000) return;

    const edition = (cfg.lastNumber || 0) + 1;
    let built;
    try {
      built = await buildScribaEdition(dbAdmin, { days: intervalDays, assetPrefix: String(edition), edition });
    } catch (e) {
      console.error("[scriba] generazione automatica fallita:", e);
      return; // riproverà al prossimo tick
    }

    try {
      const r = await proposeEditionToMaster(dbAdmin, { edition, built, createdBy: "auto" });
      console.log(`[scriba] bozza ${edition} (${r.id}) inviata al direttore per approvazione.`);
    } catch (e) {
      console.error("[scriba] proposta al direttore fallita:", e.message);
    }
  }
);

/** scribaUnsubscribe — disiscrive un giocatore (link in fondo alla mail). */
exports.scribaUnsubscribe = onRequest({ region: "us-central1" }, async (req, res) => {
  const page = (msg) =>
    `<!doctype html><meta charset="utf-8"><body style="font-family:Georgia,serif;background:#f4efe3;color:#1c1813;text-align:center;padding:60px 20px;">
     <h1 style="color:#7a1f12;">Lo Scriba</h1><p style="font-size:18px;">${msg}</p></body>`;
  const uid = String(req.query.uid || "");
  const t = String(req.query.t || "");
  if (!uid || !t || t !== scribaUnsubToken(uid)) {
    res.status(400).send(page("Link di disiscrizione non valido."));
    return;
  }
  try {
    await admin.firestore().doc(`characters/${uid}`).set({ newsletterOptIn: false }, { merge: true });
  } catch (e) {
    console.error("[scriba] unsubscribe:", e);
    res.status(500).send(page("Errore momentaneo. Riprova più tardi."));
    return;
  }
  res.status(200).send(page("Sei stato disiscritto da Lo Scriba. Non riceverai più la gazzetta."));
});

/**
 * scribaApprove — il bottone "Approva e invia" nella mail del direttore. Spedisce
 * il numero (bozza) alla lista de Lo Scriba e lo marca come inviato. È l'UNICA
 * via per cui un numero raggiunge i giocatori (nessun timer).
 */
exports.scribaApprove = onRequest({ region: "us-central1", timeoutSeconds: 300, memory: "512MiB" }, async (req, res) => {
  const page = (msg, ok = true) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Georgia,serif;background:#f4efe3;color:#1c1813;text-align:center;padding:60px 20px;">
     <h1 style="color:${ok ? "#2f5d2a" : "#8a261c"};">Lo Scriba</h1><p style="font-size:18px;line-height:1.5;">${msg}</p></body>`;
  const id = String(req.query.id || "");
  const t = String(req.query.t || "");
  if (!id || !t || t !== scribaApproveToken(id)) {
    res.status(400).send(page("Link di approvazione non valido o scaduto.", false));
    return;
  }
  const dbAdmin = admin.firestore();
  const ref = dbAdmin.collection("newsletters").doc(id);
  let d;
  try {
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).send(page("Numero inesistente.", false)); return; }
    d = snap.data();
  } catch (e) {
    res.status(500).send(page("Errore di lettura. Riprova.", false));
    return;
  }
  if (d.status === "sent") {
    res.status(200).send(page(`Il numero ${d.number} era già stato inviato. Nessuna azione.`));
    return;
  }
  try {
    const sent = await sendScribaToPlayers(dbAdmin, d);
    await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp(), recipientCount: sent });
    await dbAdmin.doc("settings/scriba").set(
      { lastNumber: d.number, lastSentAt: FieldValue.serverTimestamp() }, { merge: true },
    );
    res.status(200).send(page(`✓ Numero ${d.number} approvato e inviato a ${sent} lettori. Ora compare nell'archivio.`));
  } catch (e) {
    console.error("[scriba] approve:", e);
    res.status(500).send(page("Errore nell'invio: " + (e.message || e), false));
  }
});

/**
 * scribaRegenerate — il bottone "Non mi piace, scrivine un'altra" nella mail del
 * direttore. Scarta la bozza corrente (status → cancelled), genera un NUOVO
 * numero con lo stesso numero d'edizione e lo ripropone al direttore.
 */
exports.scribaRegenerate = onRequest({ region: "us-central1", timeoutSeconds: 540, memory: "1GiB" }, async (req, res) => {
  const page = (msg, ok = true) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Georgia,serif;background:#f4efe3;color:#1c1813;text-align:center;padding:60px 20px;">
     <h1 style="color:${ok ? "#7a1f12" : "#8a261c"};">Lo Scriba</h1><p style="font-size:18px;line-height:1.5;">${msg}</p></body>`;
  const id = String(req.query.id || "");
  const t = String(req.query.t || "");
  if (!id || !t || t !== scribaRegenToken(id)) {
    res.status(400).send(page("Link non valido o scaduto.", false));
    return;
  }
  const dbAdmin = admin.firestore();
  const ref = dbAdmin.collection("newsletters").doc(id);
  let d;
  try {
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).send(page("Numero inesistente.", false)); return; }
    d = snap.data();
  } catch (e) {
    res.status(500).send(page("Errore di lettura. Riprova.", false));
    return;
  }
  if (d.status === "sent") {
    res.status(200).send(page(`Il numero ${d.number} è già stato inviato: non posso riscriverlo.`, false));
    return;
  }
  try {
    // Scarta la bozza rifiutata e generane un'altra con lo stesso numero.
    await ref.update({ status: "cancelled" });
    const edition = d.number || 1;
    const built = await buildScribaEdition(dbAdmin, { days: SCRIBA_INTERVAL_DAYS, assetPrefix: `regen-${edition}`, edition });
    const r = await proposeEditionToMaster(dbAdmin, { edition, built, createdBy: "regenerate" });
    res.status(200).send(page(`✓ Ho cestinato quel numero e te ne ho scritto un altro (N. ${r.edition}). Controlla la tua casella: trovi la nuova anteprima con i bottoni per approvarla o farne riscrivere ancora.`));
  } catch (e) {
    console.error("[scriba] regenerate:", e);
    res.status(500).send(page("Errore nella riscrittura: " + (e.message || e), false));
  }
});

/**
 * scribaKickoff — genera il prossimo numero dai dati reali e lo manda al
 * DIRETTORE con il bottone di approvazione (NON ai giocatori). Protetto da
 * SCRIBA_SECRET. Utile per innescare a mano una proposta.
 *   ?secret=...            → obbligatorio
 *   ?dry=1                 → NON salva/invia: restituisce anteprima testo
 *   ?recipientsOnly=1      → (con dry) solo l'elenco destinatari finali
 */
exports.scribaKickoff = onRequest(
  { region: "us-central1", timeoutSeconds: 540, memory: "1GiB" },
  async (req, res) => {
    const secret = String(req.query.secret || req.get("x-scriba-secret") || "");
    if (!secret || secret !== scribaSecretParam.value()) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const dbAdmin = admin.firestore();
    const dry = String(req.query.dry || "") === "1";

    try {
      const recipients = await getScribaRecipients(dbAdmin, admin);

      if (dry && String(req.query.recipientsOnly || "") === "1") {
        res.json({ dry: true, count: recipients.length, recipients });
        return;
      }

      const cfg = await dbAdmin.doc("settings/scriba").get();
      const edition = (cfg.data()?.lastNumber || 0) + 1;

      const built = await buildScribaEdition(dbAdmin, { days: SCRIBA_INTERVAL_DAYS, assetPrefix: String(edition), edition });

      if (dry) {
        res.json({
          dry: true, edition, recipients: recipients.map((r) => r.email),
          motto: built.content.edition_motto,
          lead: built.content.lead?.headline,
          dalle_terre: (built.content.dalle_terre || []).map((a) => a.headline),
          arena: (built.content.arena || []).map((a) => a.headline),
          sources: sourceCountsOf(built.data),
          images: built.images.length,
        });
        return;
      }

      // NON invia ai giocatori: salva la bozza e manda la proposta al direttore
      // con il bottone di approvazione.
      const proposed = await proposeEditionToMaster(dbAdmin, { edition, built, createdBy: "kickoff" });
      res.json({ ok: true, id: proposed.id, edition, proposedTo: DM_EMAIL, willSendTo: recipients.map((r) => r.email) });
    } catch (e) {
      console.error("[scriba] kickoff:", e);
      res.status(500).json({ error: String(e.message || e) });
    }
  },
);
