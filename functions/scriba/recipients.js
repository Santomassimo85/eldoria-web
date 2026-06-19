// functions/scriba/recipients.js
//
// Destinatari de "Lo Scriba": LISTA FISSA decisa dal DM (sempre la stessa).
// I nomi sono nomi di PERSONAGGIO (collection `characters`, il cui id è l'uid di
// Firebase Auth); l'email viene letta da Firebase Auth.
//   • "master" = il DM (email diretta, sempre incluso salvo opt-out).
//   • opt-out: campo `newsletterOptIn === false` sul personaggio (lo imposta il
//     link "Disiscriviti" in fondo alla mail → scribaUnsubscribe).

// Lista permanente (per nome personaggio, case-insensitive). "master" a parte.
const SCRIBA_LIST = [
    "garroth", "caius", "tanagar", "master", "cleofe", "temistocle",
    "alaric", "makenna", "zethir", "dago", "aksel", "soran",
];
const DM_EMAIL = "santomassimo85@gmail.com"; // "master"

const norm = (s) => String(s || "").trim().toLowerCase();

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {import('firebase-admin')} admin
 * @returns {Promise<Array<{uid:string, email:string, name:string}>>}
 */
async function getScribaRecipients(db, admin) {
    let docs = [];
    try {
        const snap = await db.collection("characters").get();
        docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    } catch (e) {
        console.error("[scriba] lettura characters:", e);
    }

    // Risolve un token (nome) → personaggio. Match su nome intero, prima parola
    // o prefisso (così "tanagar" prende "Tanagar il Coraggioso").
    const findChar = (token) =>
        docs.find((c) => {
            const n = norm(c.name);
            return n === token || n.split(/\s+/)[0] === token || n.startsWith(token);
        });

    const wanted = [];        // {uid, name}
    const seen = new Set();
    const unmatched = [];
    let masterOptedOut = false;

    for (const token of SCRIBA_LIST) {
        if (token === "master") {
            // Il DM può comunque disiscriversi (personaggio con quel nome opt-out).
            const c = findChar("master");
            if (c && c.newsletterOptIn === false) masterOptedOut = true;
            continue;
        }
        const c = findChar(token);
        if (!c) { unmatched.push(token); continue; }
        if (c.newsletterOptIn === false) { console.log(`[scriba] "${token}" disiscritto, salto.`); continue; }
        if (!seen.has(c.uid)) { seen.add(c.uid); wanted.push({ uid: c.uid, name: c.name || token }); }
    }

    const out = [];
    const nameByUid = new Map(wanted.map((w) => [w.uid, w.name]));
    for (let i = 0; i < wanted.length; i += 100) {
        const chunk = wanted.slice(i, i + 100).map((w) => ({ uid: w.uid }));
        try {
            const res = await admin.auth().getUsers(chunk);
            for (const u of res.users) {
                if (u.email) out.push({ uid: u.uid, email: u.email, name: nameByUid.get(u.uid) || "" });
            }
        } catch (e) {
            console.error("[scriba] getUsers:", e.message);
        }
    }

    // Il DM ("master"): incluso per email salvo opt-out e salvo già presente.
    if (!masterOptedOut && !out.some((o) => norm(o.email) === norm(DM_EMAIL))) {
        out.push({ uid: "master", email: DM_EMAIL, name: "Master" });
    }

    if (unmatched.length) {
        console.warn("[scriba] destinatari NON trovati tra i characters:", unmatched.join(", "));
    }
    console.log(`[scriba] destinatari risolti: ${out.length} (${out.map((o) => o.email).join(", ")})`);
    return out;
}

module.exports = { getScribaRecipients, SCRIBA_LIST };
