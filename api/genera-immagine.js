// api/genera-immagine.js
// "Immagini": genera un'immagine con Gemini (Nano Banana). Tier gratuito.
// Accetta DUE modi:
//   { prompt: "..." }  -> usa il prompt cosi' com'e' (es. mappe citta')
//   { npc: {...} }     -> costruisce il prompt di un ritratto dall'NPC
// La chiave Gemini resta qui, nascosta.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST" });
  }

  const { prompt, npc } = req.body || {};

  let finalPrompt = "";
  if (prompt && String(prompt).trim()) {
    finalPrompt = String(prompt).trim();
  } else if (npc && npc.nome) {
    finalPrompt = `Ritratto fantasy di un personaggio per gioco di ruolo.
Nome: ${npc.nome}. Razza: ${npc.razza}. Ruolo: ${npc.ruolo}.
Aspetto: ${npc.aspetto}.
Stile: illustrazione digitale, mezzobusto, sfondo semplice, luce d'atmosfera. Niente testo nell'immagine.`;
  } else {
    return res.status(400).json({ error: "Serve un 'prompt' oppure un 'npc'." });
  }

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
      }
    );

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const part = parts.find(p => p.inlineData || p.inline_data);
    const inline = part && (part.inlineData || part.inline_data);
    if (!inline) return res.status(500).json({ error: "Nessuna immagine ricevuta." });

    const mime = inline.mimeType || inline.mime_type || "image/png";
    return res.status(200).json({ immagine: `data:${mime};base64,${inline.data}` });
  } catch (e) {
    return res.status(500).json({ error: "Generazione immagine fallita: " + e.message });
  }
}