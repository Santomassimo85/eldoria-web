// api/genera-npc.js
// "Cervello": riceve un contesto, chiama Claude Haiku, restituisce l'NPC in JSON.
// Vive su Vercel. La chiave Anthropic resta qui, nascosta.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST" });
  }

  const { contesto } = req.body || {};
  if (!contesto) {
    return res.status(400).json({ error: "Manca il 'contesto'." });
  }

  const PROMPT = `Sei il generatore di NPC per la campagna fantasy Eldoria.
Crea un NPC originale e coerente dato il contesto.
Rispondi SOLO con questo JSON, senza testo prima o dopo, senza backtick:
{
  "nome":"", "razza":"", "ruolo":"",
  "aspetto":"", "personalita":"", "voce":"", "segreto":"",
  "statblock":{ "CA":0, "PF":0, "tiri_salvezza":"", "azione":"" }
}
Non scrivere mai azioni o dialoghi dei personaggi dei giocatori.
Tieni ogni campo molto breve: massimo una frase.

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
