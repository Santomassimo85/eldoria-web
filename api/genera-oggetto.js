// api/genera-oggetto.js
//
// Genera NOME o DESCRIZIONE di un oggetto del Mercato Nero a partire
// DALL'IMMAGINE dell'oggetto (vision). Usato dai due tastini nel pannello
// MarketAdmin: il master decide se scrivere a mano o lasciar fare all'IA.
//
// La descrizione segue il formato delle schede oggetto D&D di Eldoria:
//   <p><em>flavor estetico…</em></p>
//   <p><strong>Proprietà Speciale:</strong> danni / bonus / TS / 1 volta al giorno…</p>
//   (eventuale <p><strong>Maledizione:</strong> …</p>)
//
// Powered by Claude (stessa chiave del generatore NPC: ANTHROPIC_API_KEY).

// Scarica l'immagine e la converte in base64 (source affidabile per la vision,
// anche con URL firmati di Firebase Storage). Gestisce anche le data: URI.
async function fetchImageAsBlock(img) {
  if (!img) throw new Error("Immagine mancante.");
  if (img.startsWith("data:")) {
    const m = img.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) throw new Error("Data URI non valida.");
    const mediaType = m[1] || "image/png";
    const data = m[2] ? m[3] : Buffer.from(decodeURIComponent(m[3])).toString("base64");
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  }
  const r = await fetch(img);
  if (!r.ok) throw new Error("Download immagine fallito (" + r.status + ").");
  const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const buf = Buffer.from(await r.arrayBuffer());
  return { type: "image", source: { type: "base64", media_type: ct, data: buf.toString("base64") } };
}

const PROMPT_NOME = ({ rarita, tipoOggetto }) =>
`Sei il nomenclatore di oggetti magici per la campagna fantasy dark "Eldoria" (D&D 5e).
Osserva l'immagine dell'oggetto e proponi UN solo nome, in ITALIANO, evocativo e in stile fantasy.
Indizi: rarità "${rarita || "?"}", categoria "${tipoOggetto || "?"}".
Regole:
- Da 2 a 4 parole, niente articoli iniziali superflui.
- Coerente con ciò che VEDI nell'immagine.
- Rispondi SOLO con il nome, senza virgolette, senza punto finale, senza altro testo.`;

const PROMPT_DESC = ({ nome, rarita, tipoOggetto }) =>
`Sei il cronista degli oggetti magici per la campagna fantasy dark "Eldoria" (D&D 5e).
Osserva ATTENTAMENTE l'immagine dell'oggetto e scrivi la sua scheda, in ITALIANO.
${nome ? `L'oggetto si chiama "${nome}".` : ""}
Indizi: rarità "${rarita || "?"}", categoria "${tipoOggetto || "?"}".

Restituisci SOLO HTML, con questa struttura esatta:
1. <p><em>…</em></p> — descrizione estetica: forma, materiali, colori, dettagli visibili nell'immagine, atmosfera. 2-4 frasi.
2. <p><strong>Proprietà Speciale:</strong> …</p> — effetti meccanici coerenti con D&D 5e: danni (es. "1d8+1d6 da forza sonora"), bonus a tiri/CA, tiri salvezza con CD, abilità "1 volta al giorno", ecc. Calibra la potenza sulla rarità indicata.
3. Solo se ha senso, aggiungi UN ulteriore paragrafo tra: <p><strong>Maledizione:</strong> …</p>, <p><strong>Bonus:</strong> …</p> o <p><strong>Requisiti:</strong> …</p>.

Regole:
- Basati su ciò che VEDI: tipo d'arma/armatura/accessorio, elementi magici, simboli.
- Usa SOLO i tag <p>, <em>, <strong>. NON ripetere il nome dell'oggetto come titolo (è gestito a parte).
- Niente backtick, niente \`\`\`html, niente testo fuori dall'HTML. Tono evocativo ma conciso.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { tipo, img, nome, rarita, tipoOggetto } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Chiave Anthropic mancante." });
  if (!img) return res.status(400).json({ error: "Carica prima un'immagine." });
  if (tipo !== "nome" && tipo !== "descrizione")
    return res.status(400).json({ error: "Tipo non valido (usa 'nome' o 'descrizione')." });

  try {
    const imageBlock = await fetchImageAsBlock(img);
    const isNome = tipo === "nome";
    const prompt = isNome
      ? PROMPT_NOME({ rarita, tipoOggetto })
      : PROMPT_DESC({ nome, rarita, tipoOggetto });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: isNome ? "claude-haiku-4-5" : "claude-sonnet-4-6",
        max_tokens: isNome ? 60 : 700,
        messages: [{ role: "user", content: [imageBlock, { type: "text", text: prompt }] }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let testo = (data.content || []).map(b => b.text || "").join("").trim();
    testo = testo.replace(/```html|```/g, "").trim();

    if (isNome) {
      // Una riga sola, niente virgolette o punteggiatura finale.
      testo = testo.split("\n")[0].replace(/^["'«»]+|["'«».]+$/g, "").trim();
      return res.status(200).json({ nome: testo });
    }
    return res.status(200).json({ descrizione: testo });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
