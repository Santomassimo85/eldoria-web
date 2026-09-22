// api/crafting-maledizione.js
//
// L'1 naturale all'Officina non distrugge più il lavoro: l'oggetto esce lo
// stesso, scadente e con una MALEDIZIONE che solo il Master vede. Questo
// endpoint la inventa al volo con Gemini, su misura per il tipo di oggetto e
// per l'impegno che il giocatore ci ha messo (rarità mirata, investimento,
// componenti, ritmo): più si è puntato in alto, più la maledizione morde.
//
// Il giocatore NON deve mai vedere questa risposta: la chiamata parte dal suo
// browser (come il resto del sito) ma il testo finisce solo nel registro del
// Master e nella coda "Crea Oggetto → Foundry". Se Gemini non risponde,
// craftingCurse.js pesca da una tabella locale: il tiro non fallisce mai.
//
// Powered by Gemini (stessa chiave dell'assistente: GEMINI_API_KEY).

async function callGemini(geminiKey, prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.15, maxOutputTokens: 700, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  return r.json();
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
}

// Cosa può mordere, per tipo di oggetto: indirizza Gemini senza ingabbiarlo.
const APPIGLI = {
  weapon: "si impugna e si combatte: tiri per colpire, danni, iniziativa, la mano di chi la stringe, il sonno di chi la tiene al fianco",
  equipment: "si indossa: CA, punti ferita massimi, velocità, prove di Destrezza o Furtività, il corpo di chi lo porta addosso",
  consumable: "si beve, si mangia o si consuma una volta sola: l'effetto sbaglia bersaglio, dura troppo, torna indietro, lascia uno strascico",
  tool: "si usa per lavorare: prove con gli strumenti, artigianato, riparazioni, la reputazione di chi se ne serve davanti alla gente",
  loot: "si porta con sé: sonno, sogni, fortuna, incontri, il modo in cui bestie e popolani reagiscono a chi lo possiede",
};

const GRAVITA = {
  lieve: "fastidiosa e soprattutto SCENICA: imbarazza, puzza, fa rumore, attira attenzioni sbagliate. Al massimo uno svantaggio circostanziale su un tipo di prova.",
  seria: "concreta ma sopportabile: svantaggio a una prova ricorrente, −1/−2 a un valore, qualche punto ferita massimo in meno, una condizione che scatta ogni tanto.",
  grave: "pesante e degna di una quest per spezzarla: si attacca a chi la usa (non si molla facilmente), toglie risorse vere, o chiama guai dall'esterno.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const {
    oggetto, tipo, professione, rarita, rarritaMirata, gravita,
    investimento, componenti, ritmo, artigiano, descrizione,
  } = req.body || {};
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: "Chiave Gemini mancante." });
  if (!oggetto) return res.status(400).json({ error: "Oggetto mancante." });

  const grav = GRAVITA[gravita] || GRAVITA.seria;
  const appiglio = APPIGLI[tipo] || APPIGLI.loot;

  const prompt = `Sei il Master di una campagna di D&D 5e in un mondo fantasy dark (Eldoria).
Un personaggio ha forgiato un oggetto all'Officina e ha tirato un 1 NATURALE: l'oggetto è uscito lo stesso, ma è MALEDETTO. Il giocatore non lo sa e non lo saprà finché non se ne accorge in gioco.

Oggetto: "${oggetto}"${descrizione ? ` — ${descrizione}` : ""}
Tipo meccanico (dnd5e): ${tipo || "loot"} — ${appiglio}
Professione dell'artigiano: ${professione || "?"}${artigiano ? ` (${artigiano})` : ""}
Rarità uscita: ${rarita || "Scarso"}${rarritaMirata ? `, mirava a ${rarritaMirata}` : ""}
Impegno messo nel lavoro: materiali ${investimento || "base"}, ${componenti?.length ? `componenti usati: ${componenti.join(", ")}` : "nessun componente"}, ritmo ${ritmo || "normale"}
Gravità richiesta: ${gravita || "seria"} — ${grav}

Inventa UNA maledizione su misura per QUESTO oggetto: deve nascere dal difetto di lavorazione (metallo raffreddato male, runa incisa storta, erba raccolta nell'ora sbagliata, sangue finito dove non doveva) e avere senso col tipo di oggetto.

Rispondi SOLO con un oggetto JSON con esattamente queste chiavi:
{
  "nome": "nome evocativo della maledizione, 2-4 parole, senza virgolette",
  "effetto": "1-2 frasi di colore: cosa fa l'oggetto di strano, raccontato al Master",
  "meccanica": "l'effetto in regole di D&D 5e, secco e applicabile subito (es. 'svantaggio alle prove di Percezione finché è equipaggiata', '−2 ai punti ferita massimi', 'ogni alba il portatore puzza di carogna: svantaggio alle prove di Persuasione per 8 ore')",
  "rivelazione": "come e quando il giocatore può accorgersene in gioco, 1 frase",
  "rimozione": "cosa serve per spezzarla, 1 frase (un rituale, un luogo, un NPC, una prova)"
}

Regole: italiano, tono dark fantasy asciutto, niente markdown, niente preamboli, nessun testo fuori dal JSON. La meccanica deve essere UNA sola e non deve rendere l'oggetto inutilizzabile.`;

  try {
    const data = await callGemini(geminiKey, prompt);
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = extractText(data);
    let c;
    try { c = JSON.parse(text); } catch { c = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
    const clean = (s, max) => String(s || "").replace(/^["'«»]+|["'«»]+$/g, "").trim().slice(0, max);
    const curse = {
      nome: clean(c?.nome, 60),
      effetto: clean(c?.effetto, 400),
      meccanica: clean(c?.meccanica, 300),
      rivelazione: clean(c?.rivelazione, 300),
      rimozione: clean(c?.rimozione, 300),
    };
    if (!curse.nome || !curse.meccanica) return res.status(500).json({ error: "Maledizione incompleta." });
    return res.status(200).json({ curse });
  } catch (e) {
    return res.status(500).json({ error: "Errore generazione: " + e.message });
  }
}
