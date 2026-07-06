// api/recap-bullets.js
// "Leggi i riassunti": condensa i riassunti delle sessioni passate di UN party in
// bullet point brevi e in ordine cronologico, così il DM sa cosa è successo prima e
// può scrivere il focus della nuova sessione. Strumento privato (solo master) —
// l'autorizzazione è lato client/rotta. La chiave Anthropic resta qui (Vercel).
//
// Input (POST JSON):
//   party           // discriminante (solo per contesto nel prompt)
//   summaries[]     // [{ sessionNumber, title, text }] in ordine cronologico
//
// Output (JSON): { recap: [{ sessionNumber, title, bullets: ["…", "…"] }] }

const MODEL = "claude-haiku-4-5";

const SYSTEM = `Sei l'archivista del Dungeon Master. Ricevi i riassunti delle sessioni passate di UN gruppo di gioco, in ordine cronologico. Il tuo compito è estrarne SOLO le informazioni che al DM servono per preparare la sessione successiva.

REGOLE
- Per ogni sessione produci pochi bullet BREVISSIMI (max 8-12 parole ciascuno), da 1 a 4 per sessione.
- Includi SOLO cose che pesano sulla continuità: PNG incontrati (con nome), luoghi raggiunti, oggetti/bottino chiave, patti/promesse, minacce e nemici, misteri aperti, cliffhanger, decisioni importanti del gruppo.
- ESCLUDI atmosfera, prosa, dettagli irrilevanti, combattimenti di passaggio senza conseguenze.
- Mantieni RIGOROSAMENTE l'ordine cronologico delle sessioni.
- Se una sessione non ha nulla di rilevante, dai un solo bullet essenziale.
- Nomi propri e termini di gioco vanno riportati esatti come nel testo.
- Scrivi in ITALIANO, telegrafico, senza punteggiatura finale.

FORMATO DI OUTPUT (testo semplice, NIENTE JSON, niente backtick, niente altro testo):
Per ogni sessione, una riga di intestazione che inizia con "## " seguita da numero, una barra "|" e il titolo, poi una riga per bullet che inizia con "- ".
Esempio ESATTO della forma:
## 12 | Il Ponte di Vethrik
- Incontrano il mercante Olwen, alleato
- Recuperano il Pendolo di Vethrik
## 13 | La Torre Sommersa
- Il patto con Olwen salta, ora ostile`;

function buildUserMessage({ party, summaries }) {
  const blocks = (summaries || [])
    .map((s) => {
      const n = s.sessionNumber ?? "?";
      const t = s.title ? ` — "${s.title}"` : "";
      const body = String(s.text || "").trim() || "(nessun riassunto)";
      return `### Sessione ${n}${t}\n${body}`;
    })
    .join("\n\n");
  return `Gruppo: ${party || "—"}.

Ecco i riassunti delle sessioni passate, in ordine cronologico. Estrai i bullet come da istruzioni.

${blocks}`;
}

// Parsa il formato a righe "## n | titolo" + "- bullet". Robusto ai troncamenti:
// una risposta tagliata a metà perde al più l'ultimo bullet, non l'intero recap.
function parseRecap(text) {
  const lines = String(text || "").replace(/```/g, "").split(/\r?\n/);
  const recap = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.match(/^#{1,3}\s*(\d+)?\s*\|?\s*(.*)$/);
    if (line.startsWith("#")) {
      if (cur && cur.bullets.length) recap.push(cur);
      const num = head && head[1] ? Number(head[1]) : null;
      const title = head ? String(head[2] || "").replace(/^\|\s*/, "").trim() : "";
      cur = { sessionNumber: num, title, bullets: [] };
      continue;
    }
    const bullet = line.replace(/^[-*•]\s*/, "").trim();
    if (bullet && cur) cur.bullets.push(bullet);
  }
  if (cur && cur.bullets.length) recap.push(cur);
  return recap;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY mancante" });

  const { party, summaries } = req.body || {};
  if (!Array.isArray(summaries) || summaries.length === 0) {
    return res.status(400).json({ error: "Nessun riassunto da leggere per questo gruppo." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserMessage({ party, summaries }) }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map((b) => b.text || "").join("");
    const recap = parseRecap(testo)
      .map((it) => ({
        sessionNumber: it.sessionNumber,
        title: it.title,
        bullets: it.bullets.map((x) => String(x || "").trim()).filter(Boolean),
      }))
      .filter((it) => it.bullets.length > 0);
    if (recap.length === 0) return res.status(500).json({ error: "Il modello non ha restituito bullet leggibili. Riprova." });
    return res.status(200).json({ recap });
  } catch (e) {
    return res.status(500).json({ error: "Lettura fallita: " + e.message });
  }
}
