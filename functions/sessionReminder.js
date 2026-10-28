// Promemoria della sessione (2026-10-28): REMIND_BEFORE_MS prima dell'ora scritta
// nel calendario del Master (/dm-admin/sessions → `sessions/{Gruppo}`), ogni
// giocatore attivo del gruppo riceve una notifica (doc in `notifications` →
// campanella + push con pushOnNotification). Sessione alle 22:00 → avviso alle 14:00.
// Una volta per data: `reminderFor` = la `date` già avvisata; cambiare la data
// riarma il promemoria. Se la sessione si salva quando mancano già meno di 8 ore,
// l'avviso parte al primo giro utile.
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { loadHidden } = require("./worldBossAuto");

const REMIND_BEFORE_MS = 8 * 60 * 60 * 1000;
const TZ = "Europe/Rome";

// Copia di src/data/partyMembers.js (nomi propri): tenerla allineata.
const PARTY_FIRST_NAMES = {
  AMEA: ["Garroth", "Tanagar", "Caius"],
  LAC: ["Horn", "Thoki", "Cleofe"],
  LEAF: ["Soran", "Zethir", "Dago", "Karlberht"],
  ENOX: ["Makenna", "Temistocle", "Lael", "Palar"],
};

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Gruppo di una scheda: campo `party`, altrimenti il nome proprio (come partyOfChar del sito).
function partyOfChar(c) {
  const p = String(c?.party || "").toUpperCase();
  if (PARTY_FIRST_NAMES[p]) return p;
  const first = norm(String(c?.name || "").split(/\s+/)[0]);
  return Object.keys(PARTY_FIRST_NAMES).find((k) => PARTY_FIRST_NAMES[k].some((n) => norm(n) === first)) || null;
}

// Minuti di scarto fra l'ora di Roma e UTC in quell'istante.
function romeOffsetMin(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

// "YYYY-MM-DDTHH:MM" (ora di Roma, come lo scrive il DateTimePicker) → millisecondi.
// Il server gira in UTC: un `new Date(date)` sbaglierebbe di 1–2 ore.
function sessionStartMs(s) {
  if (Number.isFinite(s?.startsAt)) return s.startsAt;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(s?.date || ""));
  if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const first = guess - romeOffsetMin(guess) * 60000;
  return guess - romeOffsetMin(first) * 60000;
}

const romeLabel = (ms, opts) => new Intl.DateTimeFormat("it-IT", { timeZone: TZ, ...opts }).format(new Date(ms));

async function sendSessionReminders() {
  const db = admin.firestore();
  const now = Date.now();
  const snap = await db.collection("sessions").get();
  const due = snap.docs.filter((d) => {
    const s = d.data();
    const start = sessionStartMs(s);
    return s.date && Number.isFinite(start) && start > now
      && start - REMIND_BEFORE_MS <= now && s.reminderFor !== s.date;
  });
  if (!due.length) return;

  const [chars, hidden] = await Promise.all([db.collection("characters").get(), loadHidden()]);
  for (const d of due) {
    const s = d.data();
    // prenota prima di scrivere: un giro ripetuto non manda doppioni
    const claimed = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(d.ref)).data();
      if (!cur || cur.date !== s.date || cur.reminderFor === s.date) return false;
      tx.update(d.ref, { reminderFor: s.date, reminderSentAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (!claimed) continue;

    const party = String(d.id).toUpperCase();
    const uids = chars.docs.filter((c) => {
      const data = c.data();
      const first = String(data.name || "").trim().split(/\s+/)[0].toLowerCase();
      return !hidden.uids.has(c.id) && !hidden.names.has(first) && partyOfChar(data) === party;
    }).map((c) => c.id);

    const start = sessionStartMs(s);
    const hours = Math.max(1, Math.round((start - now) / 3600000));
    const time = romeLabel(start, { hour: "2-digit", minute: "2-digit" });
    const day = romeLabel(start, { weekday: "long", day: "numeric", month: "long" });
    const batch = db.batch();
    uids.forEach((uid) => batch.set(db.collection("notifications").doc(), {
      userId: uid,
      title: `📅 Sessione ${d.id} alle ${time}`,
      message: `Tra ${hours === 1 ? "un'ora" : `${hours} ore`} si gioca: ${day} alle ${time}. Preparate dadi e scheda!`,
      read: false,
      timestamp: FieldValue.serverTimestamp(),
    }));
    await batch.commit();
    console.log(`📅 promemoria sessione ${d.id} (${s.date}) a ${uids.length} giocatori`);
  }
}

module.exports = { sendSessionReminders, sessionStartMs, REMIND_BEFORE_MS };
