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

// Opus + molti riassunti può superare i timeout brevi: Fluid Compute permette 300s.
export const config = { maxDuration: 300 };

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

const SYSTEM = `Sei l'archivista del Dungeon Master. Ricevi i riassunti delle sessioni passate di UN gruppo di gioco, in ordine cronologico. Per ogni sessione ricostruisci lo SVOLGIMENTO completo della trama, così che il DM possa ricordare cosa è successo e riprendere il filo.

COSA SCRIVERE
- Per ogni sessione, da 5 a 10 bullet: uno SCORRIMENTO cronologico degli eventi di quella sessione, dall'inizio alla fine, come un resoconto passo-passo.
- Ogni bullet è una frase COMPLETA e ARTICOLATA (indicativamente 20-35 parole) che si capisce da sola, con contesto e conseguenza — non un'etichetta telegrafica.
- Racconta TUTTO ciò che ha peso sulla trama, non solo i combattimenti: spostamenti e viaggi (dove sono andati, dove sono tornati), scene sociali (chiacchierate in taverna, trattative, litigi, decisioni prese insieme), incontri con PNG (nome, ruolo, cosa si sono detti), scoperte e indizi, oggetti/bottino, patti e promesse, e naturalmente scontri con il loro esito. Se sono tornati a Nolborg e hanno parlato in taverna, DEVE comparire.
- Segui l'ordine reale dei fatti dentro la sessione. Collega gli eventi tra loro quando serve alla continuità.

COSA EVITARE
- Non ridurre la sessione ai soli combattimenti: i momenti di viaggio e di dialogo sono importanti quanto le battaglie.
- Niente meccaniche pure (tiri, PF, iniziativa) se non hanno conseguenze narrative; niente riempitivi d'atmosfera fini a sé stessi.
- Non inventare: se un dettaglio non è nel riassunto, non aggiungerlo.
- Mantieni RIGOROSAMENTE l'ordine cronologico delle sessioni; nomi propri e termini di gioco esatti come nel testo.

Scrivi in ITALIANO, in terza persona, con frasi scorrevoli e ben formate (punteggiatura inclusa).

FORMATO DI OUTPUT (testo semplice, NIENTE JSON, niente backtick, niente altro testo):
Per ogni sessione, una riga di intestazione che inizia con "## " seguita da numero, una barra "|" e il titolo, poi una riga per bullet che inizia con "- ".
Esempio ESATTO della forma (contenuto illustrativo):
## 12 | Il Ponte di Vethrik
- Il gruppo lascia le rovine all'alba e viaggia due giorni lungo il fiume prima di rientrare a Nolborg per rifornirsi e cercare informazioni.
- In taverna, davanti a un boccale, discutono a lungo sul da farsi e decidono di dare la caccia al Pendolo, nonostante i dubbi di Caius.
- Incontrano Olwen, mercante di reliquie, che rivela l'esistenza del Pendolo ma pretende in cambio un favore ancora da definire, aprendo un debito con lui.
- Nella cripta allagata affrontano i guardiani non-morti e recuperano il Pendolo di Vethrik, che reagisce alla presenza di Caius suggerendo un legame di sangue.`;

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
        max_tokens: 8000,
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
