// api/genera-immagine.js
// "Immagini": riceve i dati dell'NPC, chiama Gemini (Nano Banana), restituisce il ritratto.
// Vive su Vercel. La chiave Gemini resta qui, nascosta. Il tier gratuito basta e avanza.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST" });
  }

  const { npc } = req.body || {};
  if (!npc || !npc.nome) {
    return res.status(400).json({ error: "Mancano i dati dell'NPC." });
  }

  // Costruiamo la descrizione del ritratto a partire dalla scheda dell'NPC.
  const prompt = `Ritratto fantasy di un personaggio per gioco di ruolo.
Nome: ${npc.nome}. Razza: ${npc.razza}. Ruolo: ${npc.ruolo}.
Aspetto: ${npc.aspetto}.
Stile: illustrazione digitale, mezzobusto, sfondo semplice, luce d'atmosfera. Niente testo nell'immagine.`;

  try {
    const r = await fetch(
      // Modello gratuito "Nano Banana". Se un giorno dà errore, cambia solo questo nome modello.
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY // la chiave la metti su Vercel
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await r.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    // L'immagine torna come dato base64 dentro le "parts".
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const part = parts.find(p => p.inlineData || p.inline_data);
    const inline = part && (part.inlineData || part.inline_data);
    if (!inline) {
      return res.status(500).json({ error: "Nessuna immagine ricevuta." });
    }

    const mime = inline.mimeType || inline.mime_type || "image/png";
    const dataUrl = `data:${mime};base64,${inline.data}`;
    return res.status(200).json({ immagine: dataUrl });
  } catch (e) {
    return res.status(500).json({ error: "Generazione immagine fallita: " + e.message });
  }
}
