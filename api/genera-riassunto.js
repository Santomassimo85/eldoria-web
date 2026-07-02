// api/genera-riassunto.js
// "Cervello" della cronaca di sessione. Riceve le linee guida di ciò che è
// accaduto e le espande in un riassunto nello stile delle memorie di Eldoria
// (voce del "Monaco Errante"). Restituisce JSON pronto per la pagina /riassunti.
// La chiave Anthropic resta qui, nascosta (Vercel).

const SYSTEM = `Sei il Monaco Errante, cronista delle "Cronache di Eldoria": raccogli le gesta delle compagnie di avventurieri sessione dopo sessione e le trascrivi come memorie del reame.

VOCE E STILE
- Prosa narrativa evocativa in ITALIANO, in terza persona, tono da cronaca fantasy d'epoca: atmosfera, immagini vivide, ritmo. Racconti, non elenchi.
- I PROTAGONISTI sono i personaggi del gruppo indicato (usa i loro nomi, che ti vengono forniti). Sono eroi reali del mondo, non "giocatori": non nominare MAI giocatori, sessioni, master, dadi, punti ferita, tiri, livelli, classi, meccaniche o regole. Nessuna quarta parete.
- Resta FEDELE alle linee guida ricevute: racconta ciò che è accaduto, senza inventare svolte importanti non implicate. Puoi arricchire con atmosfera, dettagli sensoriali e dialoghi brevi plausibili, ma non stravolgere i fatti.
- Ancòra i luoghi e le figure ai nomi citati nelle linee guida. Non contraddire l'ambientazione.

FORMATO
- "title": un titolo evocativo e memorabile per questa cronaca (breve, senza numeri di sessione).
- "subTitle": un sottotitolo poetico di una riga, nello spirito di "…dalla penna del Monaco Errante".
- "contentHtml": la cronaca completa in HTML semplice. USA SOLO questi tag: <p> per i paragrafi, <h3> per eventuali sottotitoli di scena, <blockquote> per una citazione o presagio, <em> e <strong> per enfasi. NIENTE <html>, <body>, <script>, stili inline, immagini o link. Da 4 a 8 paragrafi, coerenti con la mole delle linee guida.
- "scenePrompt": la descrizione, in INGLESE, della scena PIÙ suggestiva della sessione, pensata per un illustratore (soggetto, ambientazione, atmosfera, luce). Nessun testo o scritta nell'immagine, nessuna cornice.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza backtick, in questa forma esatta:
{"title":"","subTitle":"","contentHtml":"","scenePrompt":""}`;

function buildUserMessage({ party, roster, date, linee, seme }) {
  const gruppo = party ? `Gruppo "${party}"${roster ? ` (${roster})` : ""}` : "una compagnia di avventurieri";
  return [
    `Scrivi la cronaca dell'ultima sessione per ${gruppo}.`,
    date ? `Data in gioco: ${date}.` : "",
    "",
    "LINEE GUIDA DI CIÒ CHE È ACCADUTO (fonte di verità, rispettale):",
    String(linee || "").trim() || "(nessun dettaglio fornito: componi una cronaca breve e sobria)",
    "",
    `Seme di variazione ${seme}: se ti viene chiesto di rigenerare, cambia taglio, incipit e immagini pur restando fedele agli stessi fatti.`,
  ].filter(Boolean).join("\n");
}

// Estrae il JSON tollerando fence o testo attorno, e chiude un JSON troncato.
function parseContent(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    // Ultimo tentativo: taglia all'ultimo campo completo e richiudi.
    const cut = Math.max(t.lastIndexOf('",'), t.lastIndexOf('"}'));
    if (cut > 0) {
      let p = t.substring(0, cut + 2);
      const openO = (p.match(/\{/g) || []).length - (p.match(/\}/g) || []).length;
      p += "}".repeat(Math.max(0, openO));
      return JSON.parse(p);
    }
    throw new Error("JSON non interpretabile.");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { party, roster, date, linee } = req.body || {};
  if (!String(linee || "").trim()) {
    return res.status(400).json({ error: "Servono le linee guida di ciò che è accaduto." });
  }
  const seme = Math.floor(Math.random() * 1e9);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        temperature: 0.9,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserMessage({ party, roster, date, linee, seme }) }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map((b) => b.text || "").join("");
    const out = parseContent(testo);
    return res.status(200).json({
      title: String(out.title || "").trim(),
      subTitle: String(out.subTitle || "").trim(),
      contentHtml: String(out.contentHtml || "").trim(),
      scenePrompt: String(out.scenePrompt || "").trim(),
    });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
