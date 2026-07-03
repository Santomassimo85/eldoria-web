// api/estrai-scena.js
// Dato il testo di un riassunto GIÀ scritto, sceglie UN soggetto e ne fa un
// prompt d'illustrazione in inglese.
//   mode="scene" (default): un momento vivido, VARIANDO tipo di inquadratura e
//     personaggi coinvolti a ogni chiamata (a volte 1 PG, a volte tutto il
//     gruppo, a volte un fight, a volte un ambiente/creatura…).
//   mode="cover": KEY ART evocativa della sessione (un evento, un luogo, una
//     creatura/oggetto rappresentativo — NON un ritratto del gruppo).
// La chiave Anthropic resta qui, nascosta (Vercel).

export const config = { maxDuration: 30 };

const SCENE_SYSTEM = `You are the illustrator's brief-writer for the "Chronicles of Eldoria".
Given the text of an EXISTING session chronicle, pick ONE vivid, visually striking moment and turn it into a concise English image prompt for a fantasy illustrator.

You will receive a COMPOSITION BRIEF telling you what KIND of shot to compose THIS time (a single character, the whole party, a fight, a quiet beat, an environment, a creature/NPC, a discovery…). Follow it. VARY the subject every time — do NOT keep defaulting to the same characters or the same kind of moment.

RULES
- Describe ONE scene only: subject, setting, action, mood, lighting, framing. 2 to 4 sentences.
- Feature only the party characters that fit the brief AND are actually present in the text (use their names, provided below). Never invent characters not in the text. For environment/creature shots, characters may be small in frame or absent.
- Stay faithful to what the chronicle says: do not add major events that are not implied.
- Never mention players, dice, sessions, rules, hit points or game mechanics. No fourth wall.
- The image must contain no text, lettering, speech bubbles, frames or borders.

Reply with ONLY a valid JSON object, no prose, no backticks, in this exact form:
{"scena":""}`;

const COVER_SYSTEM = `You are the cover-art director for the "Chronicles of Eldoria".
Given the text of an EXISTING session chronicle, choose the SINGLE most iconic, emblematic subject that best represents THIS session as its COVER: an important event that happened, a striking place they visited, or a memorable being/creature/artifact they encountered. It must evoke the session at a glance.

RULES
- This is EVOCATIVE KEY ART, not a group portrait. Prefer a place, a creature, an artifact, or one dramatic event. Party characters are OPTIONAL — if present, keep them small, distant or in silhouette; the SUBJECT is the session's icon, not the roster.
- Describe ONE strong image: subject, setting, mood, lighting, framing. 2 to 4 sentences. Cinematic, atmospheric, poster-like.
- Faithful to the chronicle. Never mention players, dice, rules or game mechanics. No fourth wall.
- The image must contain no text, lettering, frames or borders.

Reply with ONLY a valid JSON object, no prose, no backticks, in this exact form:
{"scena":""}`;

// Tipi di inquadratura per la modalità scena (scelta random a ogni chiamata).
const SHOTS = [
  "an intense close-up on a SINGLE character in a defining personal moment",
  "an ensemble shot with the WHOLE party together",
  "a chaotic COMBAT / action scene mid-fight",
  "a quiet, emotional beat between two characters",
  "a wide ENVIRONMENT / location shot they explored (characters small or absent)",
  "an encounter with an NPC or a creature",
  "a moment of DISCOVERY (an object, a clue, a revelation)",
  "a tense stand-off or confrontation before violence erupts",
];

function parseScene(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) t = t.slice(a, b + 1);
  try {
    return String(JSON.parse(t).scena || "").trim();
  } catch {
    return String(text || "").replace(/```json|```/g, "").trim();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { content, roster, party, mode } = req.body || {};
  const testo = String(content || "").trim();
  if (!testo) return res.status(400).json({ error: "Serve il testo del riassunto." });

  const isCover = mode === "cover";
  const seme = Math.floor(Math.random() * 1e9);

  // Brief di composizione random (solo per le scene): tipo di shot + su chi
  // eventualmente concentrarsi, così le immagini variano davvero.
  let brief = "";
  if (!isCover) {
    const shot = SHOTS[Math.floor(Math.random() * SHOTS.length)];
    const names = String(roster || "").split(",").map((s) => s.trim()).filter(Boolean);
    let who = "";
    if (names.length) {
      const r = Math.random();
      if (r < 0.5) who = `If characters fit the shot, center it on: ${names[Math.floor(Math.random() * names.length)]}.`;
      else if (r < 0.8) who = "If characters fit the shot, show the whole group together.";
      else who = "Prefer an environment/creature framing with characters minimal or absent.";
    }
    brief = `COMPOSITION BRIEF for THIS image: ${shot}. ${who}`.trim();
  }

  const userMsg = [
    party ? `Group "${party}"${roster ? ` — characters: ${roster}` : ""}.` : "",
    `Random seed ${seme}: use it to pick a DIFFERENT subject each time you are asked, even for the same chronicle.`,
    brief,
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
        system: isCover ? COVER_SYSTEM : SCENE_SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testoOut = (data.content || []).map((b) => b.text || "").join("");
    const scena = parseScene(testoOut);
    if (!scena) return res.status(500).json({ error: "Nessun soggetto estratto." });
    return res.status(200).json({ scena });
  } catch (e) {
    return res.status(500).json({ error: "Estrazione fallita: " + e.message });
  }
}
