// api/genera-npc.js
// "Cervello": riceve un contesto, chiama Claude Haiku, restituisce l'NPC in JSON.
// Vive su Vercel. La chiave Anthropic resta qui, nascosta.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST" });
  }

  const { contesto, evita } = req.body || {};
  if (!contesto) {
    return res.status(400).json({ error: "Manca il 'contesto'." });
  }

  // Seme casuale: forza variazione vera ad ogni "genera di nuovo" anche con lo
  // stesso contesto (altrimenti Haiku tende a ridare lo stesso nome/dettagli).
  const seme = Math.floor(Math.random() * 1e9);
  // Origini linguistiche pescate a caso per spezzare i nomi fantasy stereotipati.
  const ORIGINI = [
    "nordica", "latina", "slava", "araba", "celtica", "germanica",
    "greca", "persiana", "nipponica", "africana", "ispanica", "elfica arcaica",
  ];
  const origine = ORIGINI[seme % ORIGINI.length];
  // Nomi gia' usati da evitare (il client puo' passarli per non ripetersi).
  const daEvitare = Array.isArray(evita) && evita.length
    ? `\nNON usare questi nomi gia' apparsi: ${evita.slice(-12).join(", ")}.`
    : "";

  const PROMPT = `Sei il generatore di NPC per la campagna fantasy Eldoria.
Crea un NPC ORIGINALE e coerente dato il contesto.
Rispondi SOLO con questo JSON, senza testo prima o dopo, senza backtick:
{
  "nome":"", "razza":"", "ruolo":"",
  "aspetto":"", "personalita":"", "voce":"", "segreto":"",
  "statblock":{ "CA":0, "PF":0, "tiri_salvezza":"", "azione":"" }
}
Non scrivere mai azioni o dialoghi dei personaggi dei giocatori.
Tieni ogni campo molto breve: massimo una frase.

VARIETA' OBBLIGATORIA (seme casuale ${seme}):
- Inventa un nome NUOVO ogni volta: evita i soliti nomi fantasy triti (Aldwin, Theron, Lyra, Elara, Garrick...).
- Dai al nome una sonorita' di ispirazione ${origine}.
- Varia razza, eta', corporatura, difetti e segreto: due generazioni non devono somigliarsi.
- Rispetta SEMPRE i dettagli specifici chiesti nel contesto (es. un tatuaggio, una cicatrice, un occhio mancante) e mettili nell'"aspetto".${daEvitare}

Contesto: ${contesto}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // la chiave la metti su Vercel
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1000,
        temperature: 1,
        messages: [{ role: "user", content: PROMPT }]
      })
    });

    const data = await r.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const testo = (data.content || []).map(b => b.text || "").join("");
    const pulito = testo.replace(/```json|```/g, "").trim();
    const npc = JSON.parse(pulito);
    return res.status(200).json(npc);
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
