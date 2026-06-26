// api/oracolo-frasi.js
//
// Genera al volo 3 frasi pronte per l'Oracolo (Alaric, l'oracolo bendato),
// relative a una singola carta dei Tarocchi nel suo orientamento (dritto o
// rovescio). Usato dal banco di lettura: l'oracolo clicca "Genera" e sceglie
// una frase, oppure ne scrive una a mano.
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
        generationConfig: { temperature: 1.0, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  return r.json();
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { carta, orientamento, significato, domanda, richiedente } = req.body || {};
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: "Chiave Gemini mancante." });
  if (!carta) return res.status(400).json({ error: "Carta mancante." });

  const verso = orientamento === "rovescio" ? "rovesciata (significato d'ombra)" : "dritta (significato pieno)";

  const prompt = `Sei Alaric, l'oracolo bendato di un mondo fantasy dark. Stai leggendo i Tarocchi a un consultante.
Carta uscita: "${carta}", ${verso}.
Significato di riferimento: ${significato || "(usa il senso tradizionale della carta)"}.
${domanda ? `Domanda del consultante: "${domanda}".` : ""}
${richiedente ? `Il consultante si chiama ${richiedente}.` : ""}

Scrivi ESATTAMENTE 3 frasi diverse, pronte da pronunciare ad alta voce a questo consultante, una per riga.
Regole:
- In italiano, tono mistico ma comprensibile, evocativo, da oracolo bendato.
- Rivolte al consultante con il "tu".
- Ogni frase è UNA frase completa di 10-22 parole, coerente col significato indicato.
- Le 3 frasi siano davvero diverse fra loro (angolazioni diverse), non parafrasi.
- NON numerare, NON usare trattini o elenchi puntati, NESSUNA virgoletta. Solo 3 righe di testo.`;

  try {
    const data = await callGemini(geminiKey, prompt);
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = extractText(data);
    const frasi = text
      .split("\n")
      .map((l) => l.replace(/^\s*(?:\d+[.)]\s*|[-–•]\s*)/, "").replace(/^["'«»]+|["'«»]+$/g, "").trim())
      .filter((l) => l.length > 8)
      .slice(0, 3);
    if (frasi.length === 0) return res.status(500).json({ error: "Nessuna frase generata." });
    return res.status(200).json({ frasi });
  } catch (e) {
    return res.status(500).json({ error: "Errore generazione: " + e.message });
  }
}
