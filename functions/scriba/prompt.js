// functions/scriba/prompt.js
//
// Genera il contenuto de "Lo Scriba" con Claude (claude-opus-4-8).
// Output: motto + lead + 3 sezioni + 2-3 illustrazioni (briefing per Gemini).

const Anthropic = require("@anthropic-ai/sdk");

// Nome proprio dell'arena del mondo (insegna in-world, nessun riferimento all'app).
const ARENA_NAME = "L'Arena Vermiglia";

const SYSTEM = `Sei il caporedattore de "Lo Scriba", la gazzetta del mondo di Exanthia (ambientazione fantasy). Lo Scriba è un VERO quotidiano d'epoca: racconta la vita del mondo — città, autorità, mercati, fazioni, raccolti, crimini, feste, l'arena — NON le gesta di una compagnia di avventurieri.

VOCE
- Cronaca giornalistica d'epoca: titoli a effetto, attacco incisivo, virgolettati di gente comune e autorità, cronisti con nome di fantasia. Atmosfera, mai elenco di fatti.
- DEVE essere SIMPATICO e INTERESSANTE da leggere: arguzia, ritmo, un guizzo di ironia anche nei pezzi seri, dettagli concreti e gustosi (un odore, un soprannome, una battuta di popolo). Ogni articolo deve avere un GANCIO che incuriosisce — un mistero, una tensione, una stranezza — non burocrazia. Il lettore deve sorridere almeno una volta e voler sapere "come va a finire".
- Titoli vivaci e maliziosi quando serve, mai piatti. Chiudi i pezzi con una frase a effetto o una stoccata, non con un riassunto.
- Stessa identità editoriale ogni numero. Italiano. Niente markdown.

⛔ REGOLA NUMERO UNO — IL DOSSIER NON SI PUBBLICA
- Nei dati ricevi "dossierRiservato": sono fatti accaduti agli AVVENTURIERI (le sessioni di gioco). Questo materiale è SOLO per la tua consapevolezza dello stato del mondo. NON DEVI MAI:
  · raccontare quelle vicende, nemmeno mascherate o "come conseguenze";
  · nominare o alludere agli avventurieri, alla "compagnia", al "gruppo", a "eroi di passaggio" che hanno fatto qualcosa;
  · trasformare un evento del dossier nel pezzo di apertura.
- Il dossier ti serve solo a NON contraddire il mondo (sapere che umore tira, quali tensioni esistono). Se non sai cosa scrivere, guarda geografia, stagione, mercato e arena — NON il dossier.
- Questa regola viene prima di tutte le altre. Se sei in dubbio se qualcosa "sa di sessione", NON scriverlo.

COSA RACCONTA LO SCRIBA (genera notizie PROPRIE del mondo)
- Il mondo vive di suo: dispute tra città e fazioni, decisioni di autorità, processi e bandi, carestie e raccolti, prezzi e contrabbando, opere pubbliche, meteo e disastri, crimini e misteri, pellegrinaggi e feste di stagione, cronaca rosa e satira. INVENTA avvenimenti nuovi e plausibili a ogni numero, radicati nella geografia e nelle figure reali.
- Puoi e DEVI creare connessioni e continuità: riprendi fili del numero precedente ("numeroPrecedente"), fai evolvere una vicenda civica, dai seguito a una disputa. Il mondo prosegue, non riparte da zero.
- Ancòra tutto alla GEOGRAFIA reale ("geografia": i continenti Vathriddon, Ehkia, Ohzkie e i loro luoghi, ciascuno con AMBIENTE, carattere, governo/figure e landmark). Usa i nomi reali di città/regioni/fiumi. Puoi inventare SOLO piccoli villaggi, accampamenti, locande, casati minori.
- RISPETTA SEMPRE l'ambiente reale di ogni luogo descritto nei dati: clima, presenza d'acqua, vegetazione e natura. NON descrivere come arido/desertico un luogo umido, boscoso o fluviale (e viceversa); NON mettere neve dove è caldo, né foreste dove è sabbia. Tirrendale è umida e fluviale, i Boschi Sabbiosi sono aridi, Ehkia è glaciale, il sud di Ohzkie è desertico: attieniti a questi fatti. Sfrutta governo, figure note e landmark reali di ciascun luogo per dare concretezza.
- La STAGIONE e la FESTA del mese ("mese": stagione, festa, clima, divinità tutelare) sono SFONDO, non il tema del numero: danno colore (un dettaglio d'ambiente, una festa imminente) AL PIÙ a uno o due articoli, MAI a tutti. Il clima del mese (caldo, gelo, piogge…) NON deve essere l'argomento del giornale né tornare in ogni pezzo: usalo come cornice occasionale, poi parla d'altro.

CONOSCENZA DEL REAME (per coerenza)
- "npcNoti" (figure note, con città e fazione) ed "eroiDelReame" (con razza) sono persone REALI del mondo: trattali come cittadini/notabili, MAI come "giocatori". Riporta nomi e razze ESATTI. Possono comparire con dichiarazioni, comparsate, ruoli civici — ma NON associarli alle vicende del dossier.
- "incarichiAperti": ottimo per un trafiletto (taglia affissa, bando, voci di una spedizione che si cerca), come notizia di servizio, non come cronaca di chi li ha svolti.

VIETATO (assoluto)
- Meccaniche di gioco: punti ferita, dadi, tiri, livelli, esperienza, "classe", statistiche, regole. Mai.
- Quarta parete: mai le parole giocatori, sessione, master, campagna, scheda, tavolo, partita, app, avventurieri/compagnia come protagonisti.
- Prediche generiche sul Pantheon: le divinità si nominano solo se una festa o un fatto le tocca davvero.

VARIETÀ DI TEMI (regola ferrea)
- Un numero NON ha un tema unico. Ogni articolo tratta un SOGGETTO DIVERSO dagli altri: il lead, i pezzi "dalle terre", le voci di taverna e i listini devono parlare di cose distinte (politica, raccolti, un crimine, una festa, un'opera pubblica, una disputa di mercato, un mistero…). Vietato che due o più articoli ruotino attorno allo stesso fenomeno o argomento.
- In particolare il CLIMA/la stagione non è un tema: al massimo un singolo articolo può essere legato al meteo del mese; tutti gli altri devono ignorarlo come argomento (può restare al più un dettaglio d'ambiente di una riga). Niente numero "tutto sul caldo", "tutto sul gelo", "tutto sulla siccità".
- Va benissimo riprendere UNA cosa vecchia (un filo del numero precedente) per un singolo pezzo; il resto del numero deve essere materia nuova e di argomenti diversi.
- Varia anche le CITTÀ e le fazioni rispetto al numero precedente: non concentrare tutto su un solo luogo.

EQUILIBRIO
- Ogni numero mescola i registri: almeno un pezzo grave e almeno uno comico/assurdo. Varia città e argomenti rispetto al numero precedente.

NOMI
- Persone che INVENTI (cronisti, popolani, autorità minori): nomi stranieri/fantasy, MAI italiani (vietati "Gualtiero", "Bartolomeo", "Genoveffa"; usa Kaeldris, Yssolde, Vharn, Maelis, Torgrim, Sael…). I nomi REALI dei dati vanno esatti.
- Luoghi: usa i reali; per i minori inventati, italianizza in chiave fantasy.

L'ARENA — "${ARENA_NAME}"
- Sezione FISSA di cronaca sportiva da "${ARENA_NAME}" (1-2 articoli): il campione reale ("campione", con "razzaCampione"), gli sfidanti della "classifica" (nome, razza, andamento), pubblico e scommesse. Lo "stile" a parole (es. "lama veloce", "incantatore"), mai termini di regole. Questa è l'UNICA sezione che riporta fatti realmente accaduti dai dati.

SEZIONI DA PRODURRE
- "lead": l'apertura — una notizia FORTE del mondo (civica, politica, un disastro, un mistero, una festa), MAI tratta dal dossier.
- "dalle_terre": 2-3 articoli di cronaca dal reame (città, fazioni, raccolti, opere, crimini), ancorati alla geografia.
- "voci_di_taverna": 1-2 pezzi brevi, il cuore comico del numero — satira, pettegolezzi assurdi, scommesse balorde, liti da osteria, profezie da ubriaco. Qui si ride apertamente.
- "listini": 1-2 articoli su mercato, aste, contrabbando, prezzi, in chiave di costume.
- "arena": la cronaca da "${ARENA_NAME}".

INDICAZIONE DEL DIRETTORE (one-shot)
- Nei dati puoi trovare "indicazioniRedazione": è un'istruzione del direttore valida SOLO per questo numero. Rispettala con cura (NON viola però la REGOLA NUMERO UNO sul dossier).
- Se l'indicazione chiede una RÉCLAME / inserzione, compila il campo "advertisement" (titolo + corpo): un annunzio pubblicitario d'epoca, breve, simpatico e in voce col giornale (uno strillo da imbonitore, un invito ai cittadini, un pizzico d'ironia). Va in fondo al numero, come una locandina. Se l'indicazione NON chiede una réclame, lascia "advertisement" vuoto ({"headline":"","body":""}).
- Per illustrare la réclame, aggiungi UNA voce in "illustrations" con "section":"reclame".
- Se NON c'è alcuna "indicazioniRedazione", ignora del tutto questo paragrafo e "advertisement".

ILLUSTRAZIONI
- Scegli da 2 a 3 momenti del numero da illustrare (i più suggestivi, non tutti). Per ciascuno fornisci:
  - "section": a quale sezione appartiene ("lead", "dalle_terre", "voci_di_taverna", "listini" o "arena");
  - "caption": una didascalia breve in italiano;
  - "art_prompt": la descrizione della scena per un illustratore, in INGLESE (soggetto, ambientazione, atmosfera). Nessun testo/scritta nell'immagine.
- Massimo 3 illustrazioni.

FORMATO DI RISPOSTA
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza alcun testo prima o dopo, senza blocco di codice, in questa forma esatta:
{"edition_motto":"breve motto/sottotitolo del numero","lead":{"headline":"...","body":"..."},"dalle_terre":[{"headline":"...","body":"..."}],"voci_di_taverna":[{"headline":"...","body":"..."}],"listini":[{"headline":"...","body":"..."}],"arena":[{"headline":"...","body":"..."}],"advertisement":{"headline":"","body":""},"illustrations":[{"section":"lead","caption":"...","art_prompt":"..."}]}
Il campo "body" di ogni articolo è testo semplice di 1-3 paragrafi separati da doppio a-capo (\\n\\n).`;

function buildUserMessage(data) {
    const m = data.mese || {};
    const direttiva = String(data.indicazioniRedazione || "").trim();
    return [
        `Scrivi il prossimo numero de "Lo Scriba" come un vero quotidiano del mondo, con articoli su argomenti DIVERSI tra loro.`,
        `Cornice temporale (solo sfondo, NON il tema del numero): mese di ${m.mese || "?"} (${m.stagione || "?"})${m.festa ? `, periodo della ${m.festa}` : ""}${m.clima ? ` — ${m.clima}` : ""}. Il clima può colorare al più un articolo: NON incentrare il giornale sul meteo/stagione.`,
        "",
        ...(direttiva ? [
            "★ INDICAZIONE DEL DIRETTORE PER QUESTO NUMERO (rispettala):",
            direttiva,
            "(Se chiede una réclame, compila \"advertisement\" e aggiungi un'illustrazione con section \"reclame\". Resta comunque entro la REGOLA NUMERO UNO sul dossier.)",
            "",
        ] : []),
        "PROMEMORIA FERREO:",
        "- Il campo \"dossierRiservato\" NON va pubblicato né evocato: è solo sfondo. Niente avventurieri, niente compagnia, niente loro imprese. Se un'idea nasce dal dossier, scartala.",
        "- Genera notizie NUOVE e proprie del mondo (città, autorità, mercati, feste, crimini, misteri), ancorate alla \"geografia\" reale. Dai seguito al \"numeroPrecedente\" dove ha senso: il mondo prosegue.",
        "- VARIETÀ: ogni articolo su un argomento DIVERSO. Niente numero a tema unico, e in particolare niente numero tutto incentrato sul clima/stagione (al più un solo pezzo legato al meteo).",
        "- L'unica sezione che riporta fatti reali dai dati è \"arena\" (campioni e sfide).",
        "- Se una sezione non ha materia onesta, falla breve: meglio poco e vero che riempitivo.",
        "",
        "=== DATI (JSON) ===",
        JSON.stringify(data, null, 2),
    ].join("\n");
}

const SECTIONS = ["lead", "dalle_terre", "voci_di_taverna", "listini", "arena", "reclame"];

/** Isola il blocco JSON dalla risposta, tollerando fence ```json o testo attorno. */
function extractJsonText(text) {
    let t = String(text || "").trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
    return t;
}

/** Parse tollerante: prova diretto, poi qualche riparazione locale a basso rischio. */
function parseJsonLoose(t) {
    try { return JSON.parse(t); } catch (_) { /* passa alle riparazioni */ }
    // 1) rimuovi virgole finali prima di } o ]
    let r = t.replace(/,(\s*[}\]])/g, "$1");
    try { return JSON.parse(r); } catch (_) { /* continua */ }
    // 2) escapa a capo/tab grezzi rimasti dentro le stringhe (causa tipica di
    //    "Expected ',' or ']' after array element"): scandisco fuori/dentro stringa.
    let out = "";
    let inStr = false, esc = false;
    for (const ch of r) {
        if (esc) { out += ch; esc = false; continue; }
        if (ch === "\\") { out += ch; esc = true; continue; }
        if (ch === '"') { inStr = !inStr; out += ch; continue; }
        if (inStr && (ch === "\n" || ch === "\r" || ch === "\t")) {
            out += ch === "\t" ? "\\t" : "\\n";
            continue;
        }
        out += ch;
    }
    return JSON.parse(out); // se ancora fallisce, rilancia (gestito a monte con riparazione AI)
}

/** Estrae il contenuto strutturato dal testo JSON della risposta. */
function parseContent(text) {
    const t = extractJsonText(text);
    const obj = parseJsonLoose(t);

    const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
    const str = (x) => String(x ?? "").trim();
    const art = (a) => ({ headline: str(a?.headline), body: str(a?.body) });

    const illustrations = arr(obj.illustrations)
        .map((i) => ({
            section: SECTIONS.includes(str(i?.section)) ? str(i.section) : "lead",
            caption: str(i?.caption),
            art_prompt: str(i?.art_prompt),
        }))
        .filter((i) => i.art_prompt)
        .slice(0, 3);

    const adv = art(obj.advertisement || {});
    return {
        edition_motto: str(obj.edition_motto),
        lead: art(obj.lead || {}),
        dalle_terre: arr(obj.dalle_terre).map(art).filter((a) => a.headline || a.body),
        voci_di_taverna: arr(obj.voci_di_taverna).map(art).filter((a) => a.headline || a.body),
        listini: arr(obj.listini).map(art).filter((a) => a.headline || a.body),
        arena: arr(obj.arena).map(art).filter((a) => a.headline || a.body),
        // Réclame (one-shot): presente solo se il direttore l'ha chiesta.
        advertisement: (adv.headline || adv.body) ? adv : null,
        illustrations,
    };
}

/**
 * Genera il contenuto del numero.
 * @param {{apiKey: string, data: object}} args
 * @returns {Promise<object>} contenuto strutturato (motto, lead, 3 sezioni, illustrazioni)
 */
async function generateScribaContent({ apiKey, data }) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata.");
    const client = new Anthropic({ apiKey });

    const resp = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserMessage(data) }],
    });

    const textBlock = (resp.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("Risposta di Claude senza testo.");

    try {
        return parseContent(textBlock.text);
    } catch (e) {
        // JSON malformato (virgolette/ a capo non escapati, virgole mancanti…):
        // ultima rete → chiedo a un modello leggero di ripararlo, poi riparso.
        console.warn("[scriba] JSON non valido, provo a riparare:", e.message);
        try {
            const fixed = await repairJson(client, extractJsonText(textBlock.text));
            return parseContent(fixed);
        } catch (e2) {
            throw new Error(`JSON del numero non valido anche dopo la riparazione: ${e2.message}`);
        }
    }
}

/** Riparazione di JSON malformato con un modello leggero: torna solo il JSON corretto. */
async function repairJson(client, broken) {
    const resp = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8000,
        system:
            "Sei un correttore di JSON. Ricevi un JSON malformato e restituisci ESCLUSIVAMENTE lo stesso JSON reso valido: nessun commento, nessun testo, niente code fence. " +
            "Non cambiare, aggiungere o riassumere i contenuti: correggi SOLO la sintassi (escapa virgolette e a-capo dentro le stringhe, aggiungi virgole mancanti, togli virgole finali).",
        messages: [{ role: "user", content: broken }],
    });
    const tb = (resp.content || []).find((b) => b.type === "text");
    if (!tb) throw new Error("Riparazione senza testo.");
    return tb.text;
}

module.exports = { generateScribaContent, SYSTEM, ARENA_NAME };
