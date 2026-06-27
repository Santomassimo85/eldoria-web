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

// Quante Proprietà Speciali in base alla rarità (con un po' di varietà random).
// Più l'oggetto è raro, più effetti può avere.
const PROP_COUNT = {
  "Comune":      [1, 1],
  "Non comune":  [1, 1],
  "Rara":        [1, 2],
  "Molto rara":  [2, 2],
  "Leggendaria": [2, 3],
  "Artefatto":   [3, 3],
  // legacy
  "Raro": [1, 2], "Magico": [2, 2], "Epico": [2, 2], "Leggendario": [2, 3],
};

// Decide, per QUESTA generazione, quante proprietà e quale blocco extra
// (a volte nessuno). La maledizione è volutamente rara.
function planDescription(rarita) {
  const [lo, hi] = PROP_COUNT[rarita] || [1, 2];
  const propCount = lo + Math.floor(Math.random() * (hi - lo + 1));

  // Blocco extra opzionale, con pesi: spesso nessuno, maledizione rara.
  const pool = [
    { kind: "niente",     w: 5 },
    { kind: "Bonus",      w: 3 },
    { kind: "Malus",      w: 2 },
    { kind: "Effetto",    w: 3 },
    { kind: "Requisiti",  w: 1 },
    { kind: "Maledizione", w: 1 },
  ];
  const total = pool.reduce((s, o) => s + o.w, 0);
  let roll = Math.random() * total;
  let extra = "niente";
  for (const o of pool) { roll -= o.w; if (roll <= 0) { extra = o.kind; break; } }

  return { propCount, extra };
}

const PROMPT_DESC = ({ nome, rarita, tipoOggetto, plan }) => {
  const { propCount, extra } = plan;
  const propLine = propCount === 1
    ? `2. <p><strong>Proprietà Speciale:</strong> …</p> — UN effetto meccanico coerente con D&D 5e.`
    : `2. Da 2 a 3 effetti distinti: scrivi ESATTAMENTE ${propCount} paragrafi separati, ciascuno <p><strong>Proprietà Speciale:</strong> …</p>, con effetti DIVERSI tra loro.`;
  const extraLine = extra === "niente"
    ? `3. NESSUN blocco aggiuntivo: fermati alle Proprietà Speciali.`
    : `3. Aggiungi inoltre UN paragrafo <p><strong>${extra}:</strong> …</p> coerente con l'oggetto${extra === "Maledizione" ? " (un effetto negativo che chi lo usa subisce)" : extra === "Malus" ? " (uno svantaggio o penalità d'uso)" : ""}.`;

  return `Sei il cronista degli oggetti magici per la campagna fantasy dark "Eldoria" (D&D 5e).
Osserva ATTENTAMENTE l'immagine dell'oggetto e scrivi la sua scheda, in ITALIANO.
${nome ? `L'oggetto si chiama "${nome}".` : ""}
Indizi: rarità "${rarita || "?"}", categoria "${tipoOggetto || "?"}".

Restituisci SOLO HTML, con questa struttura:
1. <p><em>…</em></p> — descrizione estetica: forma, materiali, colori, dettagli visibili nell'immagine, atmosfera. 2-4 frasi.
${propLine}
   Negli effetti usa elementi concreti di D&D 5e: danni (es. "1d8+1d6 da forza sonora"), bonus a tiri/CA, tiri salvezza con CD, abilità "1 volta al giorno", ecc. Calibra la potenza sulla rarità.
${extraLine}

Regole:
- Basati su ciò che VEDI: tipo d'arma/armatura/accessorio, elementi magici, simboli.
- Usa SOLO i tag <p>, <em>, <strong>. NON ripetere il nome dell'oggetto come titolo (è gestito a parte).
- Rispetta ESATTAMENTE i blocchi richiesti sopra: non aggiungere né togliere sezioni.
- Niente backtick, niente \`\`\`html, niente testo fuori dall'HTML. Tono evocativo ma conciso.`;
};

// Oggetto "da GdR": simpatico, di colore, NON utile in combattimento ma utile
// (o spassoso) nel gioco di ruolo. Niente danni/CA/iniziativa.
const PROMPT_GDR = ({ nome, tipoOggetto }) =>
`Sei il cronista degli oggetti curiosi della campagna fantasy dark "Eldoria" (D&D 5e).
Osserva ATTENTAMENTE l'immagine e scrivi la scheda di un oggetto SIMPATICO e DI COLORE,
INUTILE in combattimento ma utile o spassoso nel gioco di ruolo. In ITALIANO.
${nome ? `L'oggetto si chiama "${nome}".` : ""}
Indizio sulla categoria: "${tipoOggetto || "?"}".

Restituisci SOLO HTML, con questa struttura:
1. <p><em>…</em></p> — descrizione estetica e atmosfera: forma, materiali, dettagli visibili nell'immagine, con un tocco di ironia o stranezza. 2-4 frasi.
2. <p><strong>Utilità da Gioco:</strong> …</p> — a cosa serve fuori dal combattimento: scena sociale, esplorazione, indagine, intrattenimento, piccoli trucchi magici innocui, comodità quotidiane. Può dare al massimo vantaggio a una prova di abilità di tanto in tanto, MAI bonus a danni/CA/iniziativa/TS in battaglia.
3. Opzionale: <p><strong>Stranezza:</strong> …</p> — un difetto buffo, un effetto collaterale comico o una mania dell'oggetto.

Regole:
- Niente danni, niente tiri salvezza in combattimento, niente "1 volta al giorno" da arma. È roba da TAVOLO e da interpretazione.
- Basati su ciò che VEDI nell'immagine; se l'oggetto sembra un'arma, rendilo comunque inoffensivo e ridicolo.
- Usa SOLO i tag <p>, <em>, <strong>. NON ripetere il nome come titolo.
- Niente backtick, niente \`\`\`html, niente testo fuori dall'HTML. Tono leggero e divertente.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { tipo, img, nome, rarita, tipoOggetto } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Chiave Anthropic mancante." });
  if (!img) return res.status(400).json({ error: "Carica prima un'immagine." });
  if (tipo !== "nome" && tipo !== "descrizione" && tipo !== "gdr")
    return res.status(400).json({ error: "Tipo non valido (usa 'nome', 'descrizione' o 'gdr')." });

  try {
    const imageBlock = await fetchImageAsBlock(img);
    const isNome = tipo === "nome";
    const prompt =
      isNome          ? PROMPT_NOME({ rarita, tipoOggetto }) :
      tipo === "gdr"  ? PROMPT_GDR({ nome, tipoOggetto }) :
                        PROMPT_DESC({ nome, rarita, tipoOggetto, plan: planDescription(rarita) });

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
