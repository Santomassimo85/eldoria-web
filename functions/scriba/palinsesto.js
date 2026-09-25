// functions/scriba/palinsesto.js
//
// IL PALINSESTO — la "riunione di redazione" tirata a sorte prima di ogni numero.
// Senza questo, Claude ricadeva sempre sugli stessi temi (il caldo del mese, i
// fiumi in secca, la scena in locanda): gli davamo sempre gli stessi dati e lui
// sceglieva sempre la via più ovvia. Qui invece ogni numero riceve un piano
// DIVERSO, pescato a caso da pool larghi:
//   · un ARGOMENTO per ogni articolo (guerre di frontiera, morti, crimini,
//     politica, arcano, bestie, scandali…), sempre diversi fra loro;
//   · un LUOGO per ogni articolo, evitando quelli usati nei numeri recenti;
//   · un TONO e un FORMATO (dispaccio dal fronte, necrologio, verbale…);
//   · la SCENA delle voci di popolo (lavatoio, caserma, bagni… raramente l'osteria);
//   · un paio di INGREDIENTI imprevisti da infilare da qualche parte;
//   · le PAROLE ABUSATE negli ultimi numeri, da evitare (si aggiorna da sola).
// Il piano viene salvato sul doc del numero (`palinsesto`) così il giro dopo
// sa cosa è già stato usato e sceglie altro.

const { CONTINENTI } = require("./places");

// ── utilità casuali ─────────────────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
/** Pesca pesata: items = [{…, w}] */
function weighted(items) {
    const tot = items.reduce((s, i) => s + (i.w || 1), 0);
    let r = Math.random() * tot;
    for (const i of items) { r -= (i.w || 1); if (r <= 0) return i; }
    return items[items.length - 1];
}

// ── ARGOMENTI ───────────────────────────────────────────────────────────────
// `cat` serve a non avere due pezzi della stessa famiglia; `grave` = adatto
// all'apertura; `spunti` = esempi da cui Claude parte (ne mandiamo uno a caso).
const ARGOMENTI = [
    { cat: "guerra", grave: true, nome: "Guerra di frontiera", spunti: [
        "scaramucce fra due villaggi per un pozzo, un ponte o un confine segnato male",
        "un fortino di frontiera assediato da settimane, dispacci che arrivano a singhiozzo",
        "una faida fra clan che si allarga: alleanze, tradimenti, un armistizio fragile",
        "bande di mercenari rimasti senza paga che taglieggiano le campagne",
        "una battaglia vera e propria in una valle sperduta: numeri dei caduti, reduci che raccontano",
        "reclutamento forzato nei borghi, madri che nascondono i figli nei fienili",
        "un signorotto minore che dichiara guerra al vicino per un'offesa ridicola, ma si muore davvero",
    ] },
    { cat: "morte", grave: true, nome: "Morti e necrologi", spunti: [
        "la morte improvvisa di un notabile minore, con un testamento che scatena il putiferio",
        "un necrologio solenne (e involontariamente comico) di un personaggio pittoresco",
        "morti misteriose in serie in un borgo: nessun segno, solo un odore di cannella",
        "un duello all'alba finito male, e ora due famiglie si guardano in cagnesco",
        "una malattia strana che colpisce solo i fabbri, o solo i mancini",
        "un funerale che diventa rissa, festa o processione di protesta",
        "un naufragio o una frana: i nomi dei dispersi, le ricerche",
    ] },
    { cat: "crimine", grave: true, nome: "Cronaca nera", spunti: [
        "un omicidio in una casa chiusa dall'interno; la guardia brancola",
        "una banda di tagliagole che rapina le carovane con un metodo mai visto",
        "un falsario di monete così bravo che nessuno sa più cosa vale il proprio denaro",
        "un'evasione rocambolesca dalle segrete, e il fuggiasco scrive lettere di scherno",
        "un rapimento con richiesta di riscatto in forma di indovinello",
        "una gilda di ladri che pubblica le sue 'regole di buona condotta'",
        "un avvelenatore seriale, un sospettato insospettabile",
        "un furto sacrilego in un tempio: sparita una reliquia",
    ] },
    { cat: "truffa", nome: "Truffe e raggiri", spunti: [
        "un ciarlatano vende elisir di giovinezza e mezzo borgo ci casca",
        "un finto nobile ha sposato tre dame in tre città diverse",
        "una lotteria truccata scoperta per caso",
        "mappe del tesoro false vendute a cercatori creduloni",
    ] },
    { cat: "politica", grave: true, nome: "Politica e potere", spunti: [
        "un'elezione di borgomastro combattuta a colpi di calunnie e salsicce gratis",
        "un editto nuovo e impopolare (tassa sulle finestre, divieto di fischiettare…)",
        "uno scandalo di corruzione in un consiglio cittadino",
        "un trattato fra due fazioni firmato, e subito contestato",
        "un'ambasceria da una terra lontana con richieste strane",
        "una successione contesa dopo che il signore non ha lasciato eredi",
    ] },
    { cat: "giustizia", nome: "Tribunali e processi", spunti: [
        "un processo assurdo (a un gallo, a una statua, a un fantasma)",
        "una sentenza che divide la città",
        "un avvocato celebre per non aver mai perso una causa, finalmente sconfitto",
        "un bando di taglia su un fuorilegge dal soprannome memorabile",
    ] },
    { cat: "arcano", grave: true, nome: "Fatti arcani", spunti: [
        "un esperimento magico andato storto: una piazza che ora cade verso l'alto",
        "una stella caduta in un campo, e chi l'ha toccata sogna la stessa cosa",
        "un apprendista mago sparito lasciando solo le scarpe",
        "un oggetto incantato che passa di mano in mano portando sfortuna",
        "un portale che si apre ogni notte alla stessa ora in una cantina",
    ] },
    { cat: "bestie", grave: true, nome: "Bestie e mostri", spunti: [
        "avvistamento di una creatura mai vista, con testimoni che non si mettono d'accordo",
        "qualcosa che ruba le pecore lasciando impronte impossibili",
        "una migrazione di bestie enormi che blocca una strada commerciale",
        "un cucciolo di creatura pericolosa adottato da un villaggio",
        "cacciatori di mostri in concorrenza per la stessa taglia",
    ] },
    { cat: "religione", nome: "Templi e culti", spunti: [
        "un miracolo contestato: la statua piange, ma forse è il tetto che perde",
        "una setta nuova che predica cose stravaganti e fa proseliti",
        "uno scisma fra due sacerdoti dello stesso tempio",
        "un pellegrinaggio che si trasforma in qualcosa d'altro",
        "un'eresia processata in piazza",
    ] },
    { cat: "commercio", nome: "Commercio e botteghe", spunti: [
        "una corporazione in sciopero (gondolieri, fornai, becchini…)",
        "la bancarotta clamorosa di una casa mercantile",
        "una nuova rotta commerciale che rovina chi viveva della vecchia",
        "un monopolio sulle spezie e la gente che si arrangia",
    ] },
    { cat: "invenzioni", nome: "Invenzioni e scoperte", spunti: [
        "un'invenzione gnomica che promette miracoli e produce disastri",
        "una scoperta in una rovina che riscrive una leggenda",
        "un cartografo che giura di aver trovato un'isola che non c'è",
        "una macchina volante, un orologio che predice, una stufa parlante",
    ] },
    { cat: "cultura", nome: "Teatro, bardi e arti", spunti: [
        "uno spettacolo teatrale che ha offeso qualcuno di potente",
        "una gara di bardi finita in rissa",
        "un pittore che ritrae le persone come saranno fra vent'anni",
        "una canzone proibita che tutti fischiettano",
    ] },
    { cat: "rosa", nome: "Cronaca rosa", spunti: [
        "una fuga d'amore fra rampolli di famiglie nemiche",
        "un matrimonio sontuoso con un invitato indesiderato",
        "un'eredità contesa fra un nipote e un gatto",
        "un corteggiamento pubblico a suon di serenate che ha stufato il quartiere",
    ] },
    { cat: "disastro", grave: true, nome: "Disastri e incidenti", spunti: [
        "un incendio in un quartiere di legno, e il sospetto del dolo",
        "il crollo di una miniera con minatori intrappolati",
        "un ponte crollato durante una processione",
        "un'esplosione in una bottega di alchimista",
    ] },
    { cat: "viaggi", nome: "Viaggi ed esplorazioni", spunti: [
        "una spedizione partita mesi fa torna con metà dei membri e storie incredibili",
        "un viaggiatore straniero racconta usanze bizzarre della sua terra",
        "carovane che spariscono su una strada nota",
    ] },
    { cat: "costume", nome: "Costume e usanze", spunti: [
        "una moda assurda che dilaga (cappelli con campanelli, barbe intrecciate)",
        "una ricetta nuova che ha diviso la città in due partiti",
        "una gara popolare stravagante (lancio del formaggio, corsa delle capre)",
        "un galateo nuovo imposto dall'alto che nessuno rispetta",
    ] },
    { cat: "scuola", nome: "Scuole e sapienti", spunti: [
        "l'esame di una scuola di magia con un esito scandaloso",
        "due sapienti che si sfidano a colpi di pamphlet",
        "una biblioteca che ha perso un libro pericoloso",
    ] },
];

// Solo per la sezione dei listini (mercato/soldi).
const LISTINI_ANGOLI = [
    "un'asta andata alle stelle per un oggetto insignificante",
    "moneta falsa in circolazione e mercanti che mordono ogni moneta",
    "il contrabbando che prospera su una rotta secondaria",
    "il prezzo di una merce comune che è impazzito per un motivo assurdo",
    "una corporazione che fissa i prezzi e il popolo che protesta",
    "una bancarotta e i creditori in fila con i forconi",
    "un mercato nero di reliquie (vere o false)",
    "i pegni di un usuraio svelati in piazza",
    "una partita di merce avariata spacciata per pregiata",
];

// Le "voci di popolo": DOVE si raccolgono le chiacchiere. L'osteria c'è ma è rara.
const SCENE_VOCI = [
    "al lavatoio, fra le lavandaie", "nella bottega del barbiere", "ai bagni pubblici",
    "alla caserma della guardia, durante il cambio", "sul molo, fra gli scaricatori",
    "sul sagrato dopo la funzione", "in una carovana ferma per la notte", "nel cortile di una prigione",
    "al mercato del pesce all'alba", "in un cantiere", "a una veglia funebre", "in una scuola di scherma",
    "fra i becchini del cimitero", "in una sala d'attesa di un notaio", "su una chiatta fluviale",
    "in una stalla di posta", "dietro le quinte di un teatro", "in una bottega di sarto",
    { s: "in un'osteria", w: 0.3 },
];

const TONI = [
    "grave e asciutto", "ironico e pungente", "grottesco", "noir, da giallo",
    "epico, da cronaca di guerra", "pettegolo", "burocratico-satirico (verbale che scivola nell'assurdo)",
    "commovente", "allarmistico, da strillone", "surreale ma raccontato serissimo",
];

const FORMATI = [
    "cronaca classica", "intervista a un testimone", "lettera al direttore",
    "verbale di processo", "bando o taglia pubblicata", "reportage da inviato",
    "botta e risposta fra due parti", "diario di un protagonista", "comunicato ufficiale commentato",
];

const INGREDIENTI = [
    "una capra", "un testamento", "un'eclissi", "un sosia", "un anello nel pane", "una campana che suona da sola",
    "un cane con un messaggio al collare", "un barile di vino avvelenato", "una mappa strappata a metà",
    "un gemello mai conosciuto", "un pappagallo che sa troppo", "una tempesta di rane", "un debito di gioco",
    "un sigillo falsificato", "uno stivale solo", "una profezia sbagliata di un giorno", "un tatuaggio misterioso",
    "un nano che non ha mai visto una miniera", "una statua spostata di notte", "un matrimonio annullato",
    "una lettera arrivata con trent'anni di ritardo", "un topo addestrato", "un duello di cucina",
    "una scommessa", "una chiave che non apre nulla", "un orco vegetariano", "un'epidemia di singhiozzo",
    "un corvo parlante", "un ritratto che cambia espressione", "un'ape regina rubata",
];

// Città "importanti": qui la guerra NON arriva (le guerre stanno ai margini).
const CITTA_IMPORTANTI = new Set([
    "Tirrendale", "Il Sacello Antico di Tirrendale", "Yotta", "Castello Dorato", "Thelén Dhir",
    "Helmvil", "Torre dell'Arcano",
]);

// Luoghi minori dove comunque la guerra non arriva, per lore (Gossvill: "sempre indenne").
const MAI_GUERRA = new Set(["Gossvill"]);

// Frontiere dove si combatte davvero (oltre ai luoghi minori reali).
const FRONTI_MINORI = [
    "le badlands ocra a oriente di Vathriddon", "gli speroni rocciosi del sud di Vathriddon",
    "i fiordi dell'ovest di Vathriddon", "la tundra interna di Ehkia", "le coste gelate di Ehkia",
    "le dune del sud di Ohzkie", "gli isolotti rocciosi al largo di Ohzkie", "le colline terrazzate del nord di Ohzkie",
];

const TUTTI_I_LUOGHI = CONTINENTI.flatMap((c) => c.luoghi.map((l) => ({ nome: l.nome, continente: c.nome })));

// Temi triti da tenere lontani a meno che il palinsesto non li chieda.
const TEMI_USURATI = [
    "caldo, afa, siccità e sole cocente", "fiumi, pozzi o fonti in secca", "scene ambientate in locanda/osteria/taverna",
    "l'oste che commenta i fatti", "il meteo del mese in generale",
];

// ── parole abusate negli ultimi numeri (si aggiorna da sola) ────────────────
const STOP = new Set(("della delle degli dello dalla dalle dagli nella nelle negli sulla sulle sugli " +
    "questo questa questi queste quello quella quelli quelle anche ancora sempre perché mentre dopo prima " +
    "come sono stato stata hanno aveva avevano essere tutto tutti tutte ogni altro altra altri altre " +
    "fatto fatta dove quando senza sopra sotto verso contro fino proprio però quindi nessuno qualcuno " +
    "città borgo gente popolo scriba numero giorno giorni notte anno tempo cosa cose volta ormai dunque " +
    "poiché mentre abbia sarebbe potrebbe dicono detto dice solo molto molti poco pochi").split(" "));

function wordsOf(text) {
    return new Set(String(text || "").toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .split(/[^a-z]+/).filter((w) => w.length >= 5 && !STOP.has(w)));
}

/** Parole che compaiono in almeno metà dei numeri recenti (min 2): sono il "tic" da evitare. */
function overusedWords(recent) {
    if (!recent.length) return [];
    const count = new Map();
    for (const r of recent) for (const w of wordsOf(r.testo)) count.set(w, (count.get(w) || 0) + 1);
    const soglia = Math.max(2, Math.ceil(recent.length / 2));
    return [...count.entries()]
        .filter(([, n]) => n >= soglia)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([w]) => w);
}

// ── scelta dei luoghi, lontano da quelli usati di recente ───────────────────
function pickPlaces(n, usedRecently) {
    const used = new Set(usedRecently);
    const fresh = shuffle(TUTTI_I_LUOGHI.filter((l) => !used.has(l.nome)));
    const stale = shuffle(TUTTI_I_LUOGHI.filter((l) => used.has(l.nome)));
    // I continenti devono girare: provo a non mettere tutto su Vathriddon.
    const out = [];
    const perCont = {};
    for (const l of [...fresh, ...stale]) {
        if (out.length >= n) break;
        if ((perCont[l.continente] || 0) >= Math.ceil(n / 2)) continue;
        out.push(l);
        perCont[l.continente] = (perCont[l.continente] || 0) + 1;
    }
    while (out.length < n) out.push(pick(TUTTI_I_LUOGHI));
    return out;
}

function luogoGuerra(usedRecently) {
    const minori = TUTTI_I_LUOGHI.filter((l) => !CITTA_IMPORTANTI.has(l.nome) && !MAI_GUERRA.has(l.nome) && !usedRecently.includes(l.nome));
    // Metà delle volte un luogo reale minore, metà una frontiera (con villaggi inventati).
    if (minori.length && Math.random() < 0.5) return pick(minori);
    return { nome: pick(FRONTI_MINORI), continente: "", inventabile: true };
}

/**
 * Tira a sorte il piano del numero.
 * @param {{recent: Array<{numero:number, testo:string, titoli:string[], palinsesto?:object}>}} args
 */
function buildPalinsesto({ recent = [] } = {}) {
    const lastPlans = recent.map((r) => r.palinsesto).filter(Boolean);
    const usedCats = new Set(lastPlans.slice(0, 2).flatMap((p) => (p.articoli || []).map((a) => a.cat)));
    const usedPlaces = lastPlans.slice(0, 3).flatMap((p) => (p.articoli || []).map((a) => a.luogo)).filter(Boolean);
    const lastLeadCat = lastPlans[0]?.articoli?.find((a) => a.sezione === "lead")?.cat;

    // Le famiglie del numero precedente scendono di peso, ma non spariscono.
    const pesati = ARGOMENTI.map((a) => ({ ...a, w: usedCats.has(a.cat) ? 0.35 : 1 }));
    // Guerra, morti e crimine li vuole il direttore: un po' più probabili.
    for (const a of pesati) if (["guerra", "morte", "crimine"].includes(a.cat)) a.w *= 1.6;

    const takenCats = new Set();
    const drawTopic = (filter = () => true) => {
        const pool = pesati.filter((a) => !takenCats.has(a.cat) && filter(a));
        const t = weighted(pool.length ? pool : pesati.filter((a) => !takenCats.has(a.cat)));
        takenCats.add(t.cat);
        return t;
    };

    const nTerre = 2 + rnd(2); // 2 o 3
    const luoghi = pickPlaces(1 + nTerre + 1, usedPlaces);

    const articoli = [];
    const formati = new Set();
    const lead = drawTopic((a) => a.grave && a.cat !== lastLeadCat);
    articoli.push({ sezione: "lead", ...slot(lead, luoghi[0], usedPlaces, formati) });
    for (let i = 0; i < nTerre; i++) {
        articoli.push({ sezione: "dalle_terre", ...slot(drawTopic(), luoghi[1 + i], usedPlaces, formati) });
    }

    // Almeno UNO fra guerra/morte/crimine deve esserci sempre.
    if (!articoli.some((a) => ["guerra", "morte", "crimine"].includes(a.cat))) {
        const forced = weighted(pesati.filter((a) => ["guerra", "morte", "crimine"].includes(a.cat)));
        articoli[articoli.length - 1] = { sezione: "dalle_terre", ...slot(forced, luoghi[nTerre], usedPlaces, formati) };
    }

    const scena = weighted(SCENE_VOCI.map((s) => (typeof s === "string" ? { s, w: 1 } : s))).s;
    const voci = { sezione: "voci_di_taverna", scena, luogo: luoghi[luoghi.length - 1].nome, tono: pick(["comico", "assurdo", "satirico", "pettegolo"]) };
    const listini = { sezione: "listini", angolo: pick(LISTINI_ANGOLI), tono: pick(TONI) };

    // Un filo dal passato (non sempre): il mondo prosegue, ma non si ripete.
    const vecchiTitoli = recent.flatMap((r) => r.titoli || []);
    const filo = vecchiTitoli.length && Math.random() < 0.55 ? pick(vecchiTitoli) : "";

    return {
        articoli,
        voci,
        listini,
        ingredienti: shuffle(INGREDIENTI).slice(0, 2),
        filoDaRiprendere: filo,
        climaNelNumero: Math.random() < 0.2, // 1 volta su 5 il meteo può entrare in UN pezzo
        temiUsurati: TEMI_USURATI,
        paroleAbusate: overusedWords(recent),
        motto: pick(["ironico", "solenne", "minaccioso", "proverbiale", "sibillino", "da strillone"]),
    };
}

/** Un formato che nel numero non c'è ancora; dispaccio e necrologio solo dove hanno senso. */
function formatoPer(cat, used) {
    let f;
    if (cat === "guerra" && !used.has("dispaccio dal fronte") && Math.random() < 0.6) f = "dispaccio dal fronte";
    else if (cat === "morte" && !used.has("necrologio") && Math.random() < 0.5) f = "necrologio";
    else {
        const liberi = FORMATI.filter((x) => !used.has(x));
        f = pick(liberi.length ? liberi : FORMATI);
    }
    used.add(f);
    return f;
}

function slot(topic, luogo, usedPlaces, usedFormats = new Set()) {
    const guerra = topic.cat === "guerra";
    const l = guerra ? luogoGuerra(usedPlaces) : luogo;
    return {
        cat: topic.cat,
        argomento: topic.nome,
        spunto: pick(topic.spunti),
        luogo: l.nome,
        continente: l.continente || "",
        ...(l.inventabile ? { nota: "inventa tu il villaggio o il fortino in questa zona" } : {}),
        tono: pick(TONI),
        formato: formatoPer(topic.cat, usedFormats),
    };
}

module.exports = { buildPalinsesto, CITTA_IMPORTANTI };
