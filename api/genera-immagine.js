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

  const { prompt, npc, stile, refs, characters } = req.body || {};

  // Nota di proporzioni corporee dedotta dalla razza (per non disegnare tutti
  // uguali: halfling bassissimi, mezz'orchi alti e possenti, ecc.).
  function raceHint(race) {
    const r = String(race || "").toLowerCase();
    if (/halfling|gnom/.test(r)) return "molto basso e minuto, circa 1 metro";
    if (/nano|dwarf/.test(r)) return "basso, tozzo e robusto";
    if (/mezz'?orco|orc/.test(r)) return "alto, muscoloso e possente, tratti orcheschi";
    if (/shadar/.test(r)) return "elfo dell'ombra: pelle pallida/cinerea, aspetto etereo e cupo, orecchie a punta";
    if (/mezz'?elfo|half.?elf/.test(r)) return "corporatura umana slanciata, orecchie lievemente a punta";
    if (/elfo|elf/.test(r)) return "alto e slanciato, lineamenti fini, orecchie a punta";
    if (/changeling/.test(r)) return "corporatura umana androgina, lineamenti pallidi";
    if (/umano|human/.test(r)) return "corporatura umana normale";
    return "";
  }

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
      const chars = Array.isArray(characters) ? characters : [];
      let castBlock = "";
      if (chars.length) {
        const lines = chars.slice(0, refParts.length).map((c, i) => {
          const hint = raceHint(c.race);
          const rc = [c.race, c.class].filter(Boolean).join(", ");
          return `${i + 1}) ${c.name || "personaggio"}${rc ? ` — ${rc}` : ""}${hint ? ` (${hint})` : ""}.`;
        });
        castBlock = `Le immagini di riferimento allegate corrispondono, NELL'ORDINE, a questi personaggi:\n${lines.join("\n")}\n`;
      }
      finalPrompt = `${finalPrompt}
${castBlock}ISTRUZIONI SUI RIFERIMENTI (IMPORTANTISSIMO):
- Usa ogni immagine di riferimento SOLO per il VOLTO e l'aspetto del rispettivo personaggio (lineamenti, capelli, colori, tratti distintivi, stile dell'abbigliamento). NON scambiare abiti, armi o tratti tra personaggi diversi: ognuno mantiene i propri.
- Le immagini di riferimento sono ritratti/primi piani: NON copiarne la posa, l'inquadratura, l'espressione o l'azione (es. NON disegnare archi tesi, armi sguainate o pose da combattimento solo perché compaiono nel ritratto). Dai a ciascun personaggio una posa NATURALE e coerente con la scena descritta.
- Rispetta razza e classe di ciascun personaggio per proporzioni, corporatura e abbigliamento (es. un halfling è molto più basso di un mezz'orco). Mantieni le proporzioni corrette tra i personaggi.
- Non riprodurre lo sfondo dei riferimenti: conta solo l'identità dei personaggi.`;
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