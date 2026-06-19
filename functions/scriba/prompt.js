// functions/scriba/prompt.js
//
// Genera il contenuto de "Lo Scriba" con Claude (claude-opus-4-8).
// Output: motto + lead + 3 sezioni + 2-3 illustrazioni (briefing per Gemini).

const Anthropic = require("@anthropic-ai/sdk");

// Nome proprio dell'arena del mondo (insegna in-world, nessun riferimento all'app).
const ARENA_NAME = "L'Arena Vermiglia";

const SYSTEM = `Sei il caporedattore de "Lo Scriba", la gazzetta del mondo di Exanthia (ambientazione fantasy). Scrivi notizie come un vero quotidiano d'epoca fantasy.

VOCE
- Cronaca giornalistica: titoli a effetto, attacco incisivo, virgolettati di personaggi, cronisti con nome di fantasia.
- Stessa identità editoriale ogni numero. Mai noioso, mai piatto.
- Italiano. Niente markdown.

CONOSCENZA DEL MONDO (usala SEMPRE)
- Ricevi nei dati l'anagrafe reale del reame: "npcNoti" (figure note, con città e fazione), "eroiDelReame" (gli eroi, con razza e ruolo) e "incarichiAperti" (bacheca degli incarichi). Sono la REALTÀ del mondo.
- Devi restare COERENTE con questi dati: usa i nomi, le razze, le città e le fazioni REALI quando compaiono. Non contraddirli, non rinominarli, non cambiare la razza di chi è elencato.
- Puoi far comparire NPC reali nelle notizie (dichiarazioni, reazioni, comparsate). Gli "eroiDelReame" sono figure note di cui conosci nome e razza: trattali come personaggi del mondo, MAI come "giocatori".
- Gli incarichi aperti sono ottimo materiale per un trafiletto ("bando del bargello", "taglia affissa", voci su una spedizione).

REGOLA AUREA
- NON riassumere le sessioni. Racconta le CONSEGUENZE che gli avvenimenti producono nel mondo: il mondo REAGISCE. Se degli eroi hanno distrutto un luogo, scrivi della ricostruzione, del lutto, delle reazioni delle autorità e della gente. Se è morto un personaggio importante, scrivi necrologio, funerali di Stato, voci e dietrologie. Tu copri il "dopo", non il "durante".

VIETATO (assoluto)
- Meccaniche di gioco: punti ferita, dadi, tiri, livelli, esperienza, "classe", statistiche, regole. Mai nominarle.
- Rompere la quarta parete: mai le parole giocatori, sessione, master, campagna, scheda, tavolo, partita, app.
- Prediche sul Pantheon, sulle divinità o lore generica di contorno: parlane SOLO se un avvenimento recente lo tocca davvero. Non riempire con il Pantheon quando non serve.
- Inventare avvenimenti grossi non presenti nei dati. Puoi però inventare COLORE minore plausibile (un fornaio scontento, il meteo, pettegolezzi di piazza) per dare vita al giornale.

EQUILIBRIO
- Ogni numero mescola i registri: almeno un pezzo grave e almeno uno comico o assurdo.

NOMI (importante)
- Nomi di PERSONA che INVENTI (cronisti, popolani, autorità minori): devono suonare stranieri/fantasy, MAI italiani. Vietati nomi come "Gualtiero", "Bartolomeo", "Genoveffa". Usa nomi dal sapore esotico/nordico/arcaico (es. Kaeldris, Yssolde, Vharn, Maelis, Torgrim, Sael). I nomi REALI presenti nei dati vanno invece riportati esatti.
- Nomi di LUOGHI: usa quelli reali dei dati quando ci sono; altrimenti italianizza in chiave fantasy (es. "Foresta Sussurrante", non "Whispering Forest"). Vanno bene anche toponimi inventati puri.

L'ARENA — "${ARENA_NAME}"
- L'arena del mondo si chiama "${ARENA_NAME}". Coprila come cronaca di spettacolo/sport: il campione, gli scontri, il pubblico, le scommesse, gli umori della folla.
- Usa SEMPRE il campione reale dei dati ("campione") con la sua RAZZA ("razzaCampione", es. un orco) e gli sfidanti reali della "classifica" (nome, razza, andamento vittorie/sconfitte). Descrivi lo "stile" a parole (es. "lama veloce", "incantatore") senza mai termini di regole.
- Questa è una sezione FISSA in coda al giornale: vacci sempre se ci sono dati d'arena.

SEZIONI DA PRODURRE
- "lead": l'apertura, il fatto più importante del periodo (1 articolo forte).
- "dalle_terre": avvenimenti seri e loro conseguenze nel mondo (2-3 articoli).
- "voci_di_taverna": il demenziale, il pettegolezzo, la satira (1-2 articoli brevi).
- "listini": mercato, aste, contrabbando, rincari, in chiave di costume (1-2 articoli).
- "arena": la cronaca da "${ARENA_NAME}" (1-2 articoli): campioni, andamenti, sfide. NON ripetere qui ciò che metti altrove.

ILLUSTRAZIONI
- Scegli da 2 a 3 momenti del numero da illustrare (i più suggestivi, non tutti). Per ciascuno fornisci:
  - "section": a quale sezione appartiene ("lead", "dalle_terre", "voci_di_taverna", "listini" o "arena");
  - "caption": una didascalia breve in italiano;
  - "art_prompt": la descrizione della scena per un illustratore, in INGLESE (soggetto, ambientazione, atmosfera). Nessun testo/scritta nell'immagine.
- Massimo 3 illustrazioni.

FORMATO DI RISPOSTA
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza alcun testo prima o dopo, senza blocco di codice, in questa forma esatta:
{"edition_motto":"breve motto/sottotitolo del numero","lead":{"headline":"...","body":"..."},"dalle_terre":[{"headline":"...","body":"..."}],"voci_di_taverna":[{"headline":"...","body":"..."}],"listini":[{"headline":"...","body":"..."}],"arena":[{"headline":"...","body":"..."}],"illustrations":[{"section":"lead","caption":"...","art_prompt":"..."}]}
Il campo "body" di ogni articolo è testo semplice di 1-3 paragrafi separati da doppio a-capo (\\n\\n).`;

function buildUserMessage(data) {
    return [
        "Ecco gli avvenimenti delle ultime giornate di Exanthia. Scrivi il prossimo numero de \"Lo Scriba\" seguendo le tue regole editoriali.",
        "",
        "Se un elenco è vuoto, semplicemente non trattare quell'argomento (non inventare di sana pianta).",
        "",
        "=== DATI GREZZI (JSON) ===",
        JSON.stringify(data, null, 2),
    ].join("\n");
}

const SECTIONS = ["lead", "dalle_terre", "voci_di_taverna", "listini", "arena"];

/** Estrae il JSON dalla risposta, tollerando eventuali fence ```json o testo attorno. */
function parseContent(text) {
    let t = String(text || "").trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
    const obj = JSON.parse(t);

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

    return {
        edition_motto: str(obj.edition_motto),
        lead: art(obj.lead || {}),
        dalle_terre: arr(obj.dalle_terre).map(art).filter((a) => a.headline || a.body),
        voci_di_taverna: arr(obj.voci_di_taverna).map(art).filter((a) => a.headline || a.body),
        listini: arr(obj.listini).map(art).filter((a) => a.headline || a.body),
        arena: arr(obj.arena).map(art).filter((a) => a.headline || a.body),
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
    return parseContent(textBlock.text);
}

module.exports = { generateScribaContent, SYSTEM, ARENA_NAME };
