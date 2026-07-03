// api/estrai-scena.js
// Dato il testo di un riassunto GIÀ scritto, sceglie UN momento vivido a caso
// e ne fa un prompt d'illustrazione in inglese, coinvolgendo i personaggi del
// gruppo. Serve al bottone "Genera immagine di scena" dello Scriptorium.
// La chiave Anthropic resta qui, nascosta (Vercel).

export const config = { maxDuration: 30 };

const SYSTEM = `You are the illustrator's brief-writer for the "Chronicles of Eldoria".
Given the text of an EXISTING session chronicle, pick ONE single vivid, visually striking moment AT RANDOM from it and turn it into a concise English image prompt for a fantasy illustrator.

RULES
- Describe ONE scene only: subject, setting, action, mood, lighting, framing. 2 to 4 sentences.
- Feature the party characters that are actually involved in that specific moment (use their names, provided below). Do not invent characters that are not in the text.
- Stay faithful to what the chronicle says: do not add major events that are not implied.
- Never mention players, dice, sessions, rules, hit points or game mechanics. No fourth wall.
- The image must contain no text, lettering, speech bubbles, frames or borders.

Reply with ONLY a valid JSON object, no prose, no backticks, in this exact form:
{"scena":""}`;

function parseScene(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) t = t.slice(a, b + 1);
  try {
    return String(JSON.parse(t).scena || "").trim();
  } catch {
    // Fallback: usa il testo grezzo se il JSON non è interpretabile.
    return String(text || "").replace(/```json|```/g, "").trim();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { content, roster, party } = req.body || {};
  const testo = String(content || "").trim();
  if (!testo) return res.status(400).json({ error: "Serve il testo del riassunto." });

  const seme = Math.floor(Math.random() * 1e9);
  const userMsg = [
    party ? `Group "${party}"${roster ? ` — characters: ${roster}` : ""}.` : "",
    `Random seed ${seme}: use it to pick a DIFFERENT moment each time you are asked, even for the same chronicle.`,
    "",
    "CHRONICLE TEXT:",
    testo.slice(0, 6000),
  ].filter(Boolean).join("\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testoOut = (data.content || []).map((b) => b.text || "").join("");
    const scena = parseScene(testoOut);
    if (!scena) return res.status(500).json({ error: "Nessuna scena estratta." });
    return res.status(200).json({ scena });
  } catch (e) {
    return res.status(500).json({ error: "Estrazione scena fallita: " + e.message });
  }
}
