// api/recap-bullets.js
// "Leggi i riassunti": legge TUTTI i riassunti di UN party e restituisce
//   1) un FAST RECAP delle ultime 3 sessioni (pochi bullet brevissimi);
//   2) i TEMI/FILI importanti dell'intera campagna, come voci cliccabili
//      ("Il Corvo", "La Mummia"…), ciascuna con una nota che spiega cos'è.
// Cliccando una voce nel client, quel filo viene passato al generatore perché
// torni nella sessione in scrittura. Strumento privato (solo master).
//
// Input (POST JSON):
//   party           // discriminante (solo per contesto nel prompt)
//   summaries[]     // [{ sessionNumber, title, text }] in ordine cronologico
//
// Output (JSON):
//   { recent: [{ sessionNumber, title, bullets: ["…"] }],
//     topics: [{ label: "Il Corvo", note: "…" }] }

// Opus + molti riassunti può superare i timeout brevi: Fluid Compute permette 300s.
export const config = { maxDuration: 300 };

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

const SYSTEM = `Sei l'archivista del Dungeon Master. Ricevi TUTTI i riassunti delle sessioni passate di UN gruppo di gioco, in ordine cronologico. Produci due cose distinte.

PARTE 1 — FAST RECAP DELLE ULTIME 3 SESSIONI
- Prendi SOLO le 3 sessioni più recenti (i numeri più alti). Se ce ne sono meno di 3, usa quelle che ci sono.
- Per ognuna, da 2 a 4 bullet BREVISSIMI (max ~15 parole), giusto l'essenziale per ricordare cosa è successo: dove sono, cosa hanno fatto, cosa è rimasto in sospeso.
- Ordine cronologico (dalla meno recente delle tre alla più recente).

PARTE 2 — TEMI E FILI DELLA CAMPAGNA (voci cliccabili)
- Scorri TUTTE le sessioni ed estrai gli elementi RICORRENTI o IMPORTANTI che meritano di poter tornare in una sessione futura: PNG chiave, creature/nemici memorabili, misteri irrisolti, oggetti/artefatti, luoghi cardine, fazioni, promesse/debiti aperti, minacce incombenti.
- Ogni voce ha:
  · una ETICHETTA breve e riconoscibile, come la userebbe il DM al tavolo (es. "Il Corvo", "La Mummia", "Il Pendolo di Vethrik", "Olwen", "Il debito coi Cacciatori del Sale").
  · una NOTA di una riga che spiega cos'è, il suo stato attuale e perché è rilevante — così chi genera la sessione sa come reintegrarlo con senso.
- Da 6 a 14 voci, le più significative. Niente doppioni. Metti prima le più importanti/aperte.
- Non inventare: usa solo ciò che compare nei riassunti; nomi ed etichette esatti come nel testo.

Scrivi in ITALIANO. Non aggiungere altro testo.

FORMATO DI OUTPUT ESATTO (testo semplice, NIENTE JSON, niente backtick):
=== RECENTI ===
## <numero> | <titolo>
- <bullet breve>
- <bullet breve>
## <numero> | <titolo>
- <bullet breve>
=== TEMI ===
* <Etichetta> :: <nota di una riga>
* <Etichetta> :: <nota di una riga>

Esempio illustrativo della forma:
=== RECENTI ===
## 32 | La Cripta del Sale
- Tornano a Nolborg e si riforniscono in taverna
- Scoprono che la Mummia è sfuggita al sigillo
=== TEMI ===
* Il Corvo :: uccello che pedina il gruppo dalla sessione 8, forse spia di un negromante ancora ignoto
* La Mummia :: guardiana risvegliata nella cripta, ora libera e a caccia del Pendolo`;

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

Ecco TUTTI i riassunti delle sessioni passate, in ordine cronologico. Produci il FAST RECAP delle ultime 3 e i TEMI come da istruzioni.

${blocks}`;
}

// Parsa il formato a righe in due sezioni (=== RECENTI === / === TEMI ===).
// Robusto ai troncamenti: una risposta tagliata perde al più l'ultima voce.
function parseOutput(text) {
  const clean = String(text || "").replace(/```/g, "");
  const lines = clean.split(/\r?\n/);
  const recent = [];
  const topics = [];
  let section = "recent"; // default: se manca l'header, trattiamo come recap
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^={2,}\s*RECENTI/i.test(line)) { section = "recent"; continue; }
    if (/^={2,}\s*TEMI/i.test(line)) { section = "topics"; continue; }

    if (section === "recent") {
      if (line.startsWith("#")) {
        if (cur && cur.bullets.length) recent.push(cur);
        const head = line.match(/^#{1,3}\s*(\d+)?\s*\|?\s*(.*)$/);
        const num = head && head[1] ? Number(head[1]) : null;
        const title = head ? String(head[2] || "").replace(/^\|\s*/, "").trim() : "";
        cur = { sessionNumber: num, title, bullets: [] };
        continue;
      }
      const bullet = line.replace(/^[-–•]\s*/, "").trim();
      if (bullet && cur) cur.bullets.push(bullet);
    } else {
      // Voce tema: "* Etichetta :: nota"  (accetta anche "- Etichetta :: nota")
      const item = line.replace(/^[*\-–•]\s*/, "").trim();
      if (!item) continue;
      const sep = item.indexOf("::");
      const label = (sep >= 0 ? item.slice(0, sep) : item).trim();
      const note = sep >= 0 ? item.slice(sep + 2).trim() : "";
      if (label) topics.push({ label, note });
    }
  }
  if (cur && cur.bullets.length) recent.push(cur);
  return { recent, topics };
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
        max_tokens: 5000,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserMessage({ party, summaries }) }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map((b) => b.text || "").join("");
    const parsed = parseOutput(testo);
    const recent = parsed.recent
      .map((it) => ({
        sessionNumber: it.sessionNumber,
        title: it.title,
        bullets: it.bullets.map((x) => String(x || "").trim()).filter(Boolean),
      }))
      .filter((it) => it.bullets.length > 0)
      .slice(-3);
    const topics = parsed.topics
      .map((t) => ({ label: String(t.label || "").trim(), note: String(t.note || "").trim() }))
      .filter((t) => t.label);

    if (recent.length === 0 && topics.length === 0) {
      return res.status(500).json({ error: "Il modello non ha restituito nulla di leggibile. Riprova." });
    }
    return res.status(200).json({ recent, topics });
  } catch (e) {
    return res.status(500).json({ error: "Lettura fallita: " + e.message });
  }
}
