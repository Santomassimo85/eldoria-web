// api/genera-immagine.js
// "Immagini": genera un'immagine con Gemini (Nano Banana). Tier gratuito.
// Accetta DUE modi:
//   { prompt: "..." }  -> usa il prompt cosi' com'e' (es. mappe citta')
//   { npc: {...} }     -> costruisce il prompt di un ritratto dall'NPC
// La chiave Gemini resta qui, nascosta.

// Diamo margine alla funzione (generazione Gemini + eventuali download).
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST" });
  }

  const { prompt, npc, stile, refs } = req.body || {};

  // Immagini di riferimento (es. avatar dei personaggi): vengono passate a
  // Gemini come input visivo affinché la scena ritragga fedelmente quei volti.
  // Le scarichiamo qui e le convertiamo in base64 (inlineData).
  async function buildRefParts(urls) {
    const list = Array.isArray(urls) ? urls.filter(Boolean).slice(0, 5) : [];
    const parts = [];
    for (const u of list) {
      try {
        // Caso comune: il client invia già un data URL (avatar ridotto).
        const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(u);
        if (m) {
          parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
          continue;
        }
        // Fallback: URL http(s) assoluto → lo scarichiamo.
        if (!/^https?:/i.test(u)) continue;
        const resp = await fetch(u);
        if (!resp.ok) continue;
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.length > 5 * 1024 * 1024) continue; // salta immagini troppo grandi
        const mime = resp.headers.get("content-type") || "image/png";
        if (!mime.startsWith("image/")) continue;
        parts.push({ inlineData: { mimeType: mime, data: buf.toString("base64") } });
      } catch { /* riferimento saltato */ }
    }
    return parts;
  }

  // Stili di disegno selezionabili dal Master. La chiave arriva dal frontend
  // (GeneraNPC.jsx) e qui viene tradotta nella riga di stile del prompt.
  const STILI = {
    olio: "Stile: dipinto a olio fantasy realistico e molto dettagliato, pennellate ricche, illuminazione cinematografica, come un'illustrazione classica da manuale di gioco di ruolo.",
    anime: "Stile: illustrazione anime/manga fantasy, cel-shading netto, linee pulite ed espressive, colori vivaci e saturi, occhi grandi e dettagliati.",
    acquerello: "Stile: illustrazione ad acquerello fantasy, pennellate morbide e sfumate, bordi delicati che sbavano, colori tenui che si fondono, aspetto dipinto a mano su carta ruvida.",
    fumetto: "Stile: illustrazione in stile fumetto/comic book occidentale, contorni a inchiostro spessi e marcati, ombreggiatura a campiture nette, colori saturi e alto contrasto.",
    epico: "Stile: arte epica dark fantasy, composizione cinematografica grandiosa, illuminazione drammatica con forte chiaroscuro e bagliori, atmosfera maestosa ed eroica, dettaglio elevato, colori profondi e ricchi, come una key art da poster di film fantasy.",
  };
  const stileLinea = STILI[stile] || STILI.olio;

  let finalPrompt = "";
  if (prompt && String(prompt).trim()) {
    finalPrompt = String(prompt).trim();
  } else if (npc && npc.nome) {
    // Varieta': inquadratura, luce e taglio cambiano ad ogni "genera ritratto".
    const seme = Math.floor(Math.random() * 1e9);
    const INQUADRATURE = ["primo piano", "mezzobusto", "ritratto a tre quarti", "piano americano"];
    const ANGOLI = ["di tre quarti", "frontale", "di profilo", "leggermente dall'alto"];
    const LUCI = [
      "luce calda di taverna", "luce fredda lunare", "controluce drammatico",
      "luce soffusa di candela", "luce diurna naturale", "atmosfera nebbiosa",
    ];
    const SFONDI = [
      "sfondo sfumato neutro", "interno fioco sullo sfondo", "paesaggio sfocato",
      "muro di pietra appena accennato", "fondale scuro semplice",
    ];
    const inq = INQUADRATURE[seme % INQUADRATURE.length];
    const ang = ANGOLI[(seme >> 2) % ANGOLI.length];
    const luce = LUCI[(seme >> 4) % LUCI.length];
    const sfondo = SFONDI[(seme >> 6) % SFONDI.length];

    finalPrompt = `Ritratto fantasy di un personaggio per gioco di ruolo (seme ${seme}).
Nome: ${npc.nome}. Razza: ${npc.razza}. Ruolo: ${npc.ruolo}.
Aspetto fisico (RIPRODUCI FEDELMENTE ogni dettaglio descritto — tatuaggi, cicatrici, colore di occhi/capelli, segni particolari nel punto esatto indicato): ${npc.aspetto}.
${npc.personalita ? `Carattere da trasmettere nell'espressione: ${npc.personalita}.` : ""}
Inquadratura: ${inq}, ${ang}. Illuminazione: ${luce}. Sfondo: ${sfondo}.
${stileLinea} Una sola persona, niente testo, niente scritte, niente cornici.`;
  } else {
    return res.status(400).json({ error: "Serve un 'prompt' oppure un 'npc'." });
  }

  try {
    const refParts = await buildRefParts(refs);
    if (refParts.length) {
      finalPrompt = `${finalPrompt}\nLe immagini di riferimento allegate mostrano i personaggi protagonisti (volti, capelli, colori, abiti, tratti distintivi): ritrai FEDELMENTE questi stessi personaggi nella scena, mantenendone l'aspetto. Non copiare lo sfondo delle immagini di riferimento, solo i personaggi.`;
    }
    // Le immagini di riferimento vanno PRIMA del testo nelle parts.
    const reqParts = [...refParts, { text: finalPrompt }];

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: reqParts }],
          generationConfig: { temperature: 1 }
        })
      }
    );

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const respParts = data?.candidates?.[0]?.content?.parts || [];
    const part = respParts.find(p => p.inlineData || p.inline_data);
    const inline = part && (part.inlineData || part.inline_data);
    if (!inline) return res.status(500).json({ error: "Nessuna immagine ricevuta." });

    const mime = inline.mimeType || inline.mime_type || "image/png";
    return res.status(200).json({ immagine: `data:${mime};base64,${inline.data}` });
  } catch (e) {
    return res.status(500).json({ error: "Generazione immagine fallita: " + e.message });
  }
}