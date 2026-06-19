// functions/scriba/collectEvents.js
//
// Raccoglie la MATERIA PRIMA per "Lo Scriba": non solo gli avvenimenti recenti,
// ma anche la CONOSCENZA DEL MONDO (NPC noti, eroi del reame, incarichi aperti)
// così che Claude scriva restando coerente con nomi, luoghi e figure reali del
// mondo. Fonti: riassunti di sessione, arene (tornei), mercato, NPC, eroi,
// bacheca incarichi. NESSUN boss (esclusione voluta dal DM).
//
// Tutte le collection del progetto sono piccole (campagna privata): leggiamo
// tutto e filtriamo in memoria, così non servono indici compositi.

const stripHtml = (html) =>
    String(html ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

const truncate = (s, n) => {
    const t = String(s ?? "");
    return t.length > n ? t.slice(0, n).trim() + "…" : t;
};

/** ms del campo `ts`/`createdAt`, qualunque sia il formato (Timestamp | ISO | Date). */
function toMillis(v) {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v === "string") { const m = Date.parse(v); return Number.isNaN(m) ? 0 : m; }
    if (v instanceof Date) return v.getTime();
    if (typeof v._seconds === "number") return v._seconds * 1000;
    return 0;
}

// ── Anagrafe del reame (eroi): serve a conoscere RAZZA e ruolo di chi compare ─
async function loadCharacters(db) {
    try {
        const snap = await db.collection("characters").get();
        return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] characters:", e);
        return [];
    }
}

// ── Riassunti di sessione (fonte primaria: il mondo reagisce a questi) ──────
async function collectSummaries(db, fromMs) {
    let docs = [];
    try {
        const snap = await db.collection("summaries").get();
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] summaries:", e);
        return [];
    }
    docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    let inWindow = docs.filter((s) => toMillis(s.createdAt) >= fromMs);
    // Garantiamo materia anche nei periodi tranquilli: almeno i 3 più recenti.
    if (inWindow.length < 3) inWindow = docs.slice(0, 3);

    return inWindow.slice(0, 8).map((s) => ({
        titolo: s.title || "Senza titolo",
        sottotitolo: s.subTitle || "",
        data: s.date || "",
        racconto: truncate(stripHtml(s.content), 900),
    }));
}

// ── Arene / tornei di gladiatori (con RAZZA dei combattenti) ────────────────
async function collectArenas(db, fromMs, characters) {
    let docs = [];
    try {
        const snap = await db.collection("arena_tournament_history").get();
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] arena_tournament_history:", e);
        return [];
    }
    docs.sort((a, b) => toMillis(b.ts) - toMillis(a.ts));

    // Mappe per arricchire i combattenti con la razza (la storia tornei non la
    // salva: la peschiamo dall'anagrafe eroi, per uid o per nome).
    const norm = (s) => String(s || "").trim().toLowerCase();
    const raceByUid = new Map();
    const raceByName = new Map();
    for (const c of characters) {
        if (c.race) {
            if (c.uid) raceByUid.set(c.uid, c.race);
            if (c.name) raceByName.set(norm(c.name), c.race);
        }
    }
    const raceOf = (uid, name) =>
        raceByUid.get(uid) || raceByName.get(norm(name)) || "";

    let inWindow = docs.filter((a) => toMillis(a.ts) >= fromMs);
    // Il DM vuole sempre notizie dalle arene: se nel periodo non ce ne sono,
    // riportiamo comunque l'ultima disputata.
    if (inWindow.length === 0) inWindow = docs.slice(0, 1);

    return inWindow.slice(0, 4).map((a) => {
        const parts = Array.isArray(a.participants) ? a.participants : [];
        const classifica = [...parts]
            .sort((x, y) => (y.matchWins || 0) - (x.matchWins || 0))
            .slice(0, 6)
            .map((p) => ({
                nome: p.name || "Ignoto",
                razza: raceOf(p.uid, p.name),
                stile: p.class || "",            // stile di combattimento (NON "classe meccanica")
                vittorie: p.matchWins || 0,
                sconfitte: p.matchLosses || 0,
            }));
        return {
            campione: a.winnerName || "Ignoto",
            razzaCampione: raceOf(a.winnerId, a.winnerName),
            stileCampione: a.winnerClass || "",
            partecipanti: parts.length,
            classifica,
        };
    });
}

// ── Mercato / aste / contrabbando ───────────────────────────────────────────
async function collectMarket(db, fromMs) {
    let docs = [];
    try {
        const snap = await db.collection("items").get();
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] items:", e);
        return { venduti: [], inVendita: [] };
    }

    const priceOf = (it) =>
        Number(it.currentBid ?? it.finalPrice ?? it.price ?? it.startingBid ?? 0) || 0;

    const venduti = docs
        .filter((it) => it.winner || it.soldTo || it.status === "sold")
        .filter((it) => {
            const t = toMillis(it.soldAt || it.endDate || it.updatedAt);
            return t === 0 || t >= fromMs; // se manca la data, lo includiamo comunque
        })
        .sort((a, b) => priceOf(b) - priceOf(a))
        .slice(0, 6)
        .map((it) => ({
            oggetto: it.name || "Oggetto ignoto",
            rarita: it.class || "",
            prezzo: priceOf(it),
        }));

    const inVendita = docs
        .filter((it) => !it.winner && !it.soldTo && it.status !== "sold")
        .sort((a, b) => priceOf(b) - priceOf(a))
        .slice(0, 6)
        .map((it) => ({
            oggetto: it.name || "Oggetto ignoto",
            rarita: it.class || "",
            base: priceOf(it),
        }));

    return { venduti, inVendita };
}

// ── NPC noti del mondo (anagrafe: nomi, città, fazioni reali) ───────────────
async function collectNpcs(db) {
    let docs = [];
    try {
        const snap = await db.collection("npcs").get();
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] npcs:", e);
        return [];
    }
    return docs.slice(0, 40).map((n) => ({
        nome: n.name || "Senza nome",
        citta: n.linkedCity || n.location || "",
        fazione: n.faction || "",
        descrizione: truncate(stripHtml(n.description), 220),
    })).filter((n) => n.nome && n.nome !== "Senza nome");
}

// ── Eroi del reame (roster: per non sbagliare nomi/razze, NON come "giocatori") ─
function summarizeHeroes(characters) {
    return characters.slice(0, 30).map((c) => ({
        nome: c.name || "",
        razza: c.race || "",
        ruolo: c.class || "",            // archetipo (guerriero, mago…) come colore, non meccanica
    })).filter((h) => h.nome);
}

// ── Bacheca incarichi (cosa bolle in pentola nel reame) ─────────────────────
async function collectQuests(db) {
    let docs = [];
    try {
        const snap = await db.collection("quests").get();
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] quests:", e);
        return [];
    }
    // Solo gli incarichi ancora aperti o appena conclusi sono "notizia".
    return docs
        .filter((q) => q.status !== "completed")
        .slice(0, 12)
        .map((q) => ({
            titolo: q.title || "Incarico senza nome",
            zona: q.zone || "",
            difficolta: q.difficulty || "",
            ricompensa: q.rewardGold ? `${q.rewardGold} monete d'oro` : (q.rewardItem || q.rewardOther || ""),
            descrizione: truncate(stripHtml(q.desc), 220),
            stato: q.status || "available",
        }))
        .filter((q) => q.titolo && q.titolo !== "Incarico senza nome");
}

/**
 * Raccoglie il briefing per Lo Scriba.
 * @param {FirebaseFirestore.Firestore} db
 * @param {{days?: number}} opts
 */
async function collectScribaData(db, { days = 10 } = {}) {
    const toMs = Date.now();
    const fromMs = toMs - days * 24 * 60 * 60 * 1000;

    const characters = await loadCharacters(db);

    const [riassunti, arene, mercato, npcs, incarichi] = await Promise.all([
        collectSummaries(db, fromMs),
        collectArenas(db, fromMs, characters),
        collectMarket(db, fromMs),
        collectNpcs(db),
        collectQuests(db),
    ]);

    return {
        periodoGiorni: days,
        dal: new Date(fromMs).toISOString(),
        al: new Date(toMs).toISOString(),
        riassunti,
        arene,
        mercato,
        // Conoscenza del mondo: contesto per coerenza, NON necessariamente da pubblicare.
        npcNoti: npcs,
        eroiDelReame: summarizeHeroes(characters),
        incarichiAperti: incarichi,
    };
}

module.exports = { collectScribaData };
