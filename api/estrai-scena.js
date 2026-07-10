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

CHARACTER SELECTION (important)
- Feature ONLY the party characters that are actually mentioned/involved in the chosen moment of the chronicle text. Use their exact names (the cast is provided below with race and class).
- If the chosen moment does not clearly involve any specific character (or you cannot tell), feature the WHOLE group.
- For pure environment/creature shots, characters may be absent (empty list).
- Never invent characters not in the cast list.

RULES
- Describe ONE scene only: subject, setting, action, mood, lighting, framing. 2 to 4 sentences.
- When you name a character, describe them consistent with their race and class (e.g. a halfling is very short; a half-orc is tall and muscular; a mage wears arcane robes, a ranger wears leathers).
- Stay faithful to what the chronicle says: do not add major events that are not implied.
- Never mention players, dice, sessions, rules, hit points or game mechanics. No fourth wall.
- The image must contain no text, lettering, speech bubbles, frames or borders.

Reply with ONLY a valid JSON object, no prose, no backticks, in this exact form:
{"scena":"", "personaggi":[]}
where "personaggi" lists the exact names of the cast members featured in the scene (empty if none).`;

const COVER_SYSTEM = `You are the cover-art director for the "Chronicles of Eldoria".
Given the text of an EXISTING session chronicle, choose the SINGLE most iconic, emblematic subject that best represents THIS session as its COVER: an important event that happened, a striking place they visited, or a memorable being/creature/artifact they encountered. It must evoke the session at a glance.

RULES
- This is EVOCATIVE KEY ART, not a group portrait. Prefer a place, a creature, an artifact, or one dramatic event. Party characters are OPTIONAL — if present, keep them small, distant or in silhouette; the SUBJECT is the session's icon, not the roster.
- Describe ONE strong image: subject, setting, mood, lighting, framing. 2 to 4 sentences. Cinematic, atmospheric, poster-like.
- Faithful to the chronicle. Never mention players, dice, rules or game mechanics. No fourth wall.
- The image must contain no text, lettering, frames or borders.

Reply with ONLY a valid JSON object, no prose, no backticks, in this exact form:
{"scena":"", "personaggi":[]}
(for a cover, "personaggi" is normally empty — the subject is the session's icon, not the roster.)`;

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
    const o = JSON.parse(t);
    return {
      scena: String(o.scena || "").trim(),
      personaggi: Array.isArray(o.personaggi) ? o.personaggi.map((s) => String(s || "").trim()).filter(Boolean) : [],
    };
  } catch {
    return { scena: String(text || "").replace(/```json|```/g, "").trim(), personaggi: [] };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { content, roster, party, mode, members, focus } = req.body || {};
  const testo = String(content || "").trim();
  // Passaggio scelto dal DM: quando presente, illustriamo QUEL pezzo (niente
  // più scelta casuale che ripescava sempre la stessa scena).
  const foco = String(focus || "").trim();
  if (!testo && !foco) return res.status(400).json({ error: "Serve il testo del riassunto." });

  // Cast con razza/classe (preferito); fallback alla vecchia stringa `roster`.
  const cast = Array.isArray(members) && members.length
    ? members.map((m) => `${m.name}${m.race || m.class ? ` (${[m.race, m.class].filter(Boolean).join(", ")})` : ""}`).join("; ")
    : String(roster || "");

  const isCover = mode === "cover";
  const seme = Math.floor(Math.random() * 1e9);

  // Brief di composizione random (solo per le scene): tipo di shot + su chi
  // eventualmente concentrarsi, così le immagini variano davvero.
  const names = Array.isArray(members) && members.length
    ? members.map((m) => m.name).filter(Boolean)
    : String(roster || "").split(",").map((s) => s.trim()).filter(Boolean);

  let brief = "";
  if (!isCover && !foco) {
    // Modalità "scena a caso": varia inquadratura e personaggi a ogni chiamata.
    const shot = SHOTS[Math.floor(Math.random() * SHOTS.length)];
    let who = "";
    if (names.length) {
      const r = Math.random();
      if (r < 0.5) who = `Prefer a moment that involves: ${names[Math.floor(Math.random() * names.length)]} (only if the chronicle supports it).`;
      else if (r < 0.8) who = "Prefer a moment with the whole group together (only if the chronicle supports it).";
      else who = "Prefer an environment/creature framing with characters minimal or absent.";
    }
    brief = `COMPOSITION BRIEF for THIS image: ${shot}. ${who} Remember: only feature characters actually involved in the chosen moment; if none, feature the whole group.`.trim();
  } else if (!isCover && foco) {
    // Modalità "passaggio scelto": illustra QUEL pezzo, fedelmente.
    brief = "COMPOSITION BRIEF: The director has CHOSEN the specific passage below to illustrate. Pick the single most visually striking moment WITHIN that passage and illustrate it faithfully. Do NOT depict events from other parts of the chronicle. Only feature characters actually involved in this passage; if none is clearly involved, feature whoever the passage is about (or the whole group).";
  }

  // Con un passaggio scelto il modello lavora su QUEL testo; altrimenti sull'intero.
  const chronicle = foco || testo;

  const userMsg = [
    party ? `Group "${party}".` : "",
    cast ? `CAST (name — race, class): ${cast}.` : "",
    foco
      ? `Seed ${seme}: use it only to vary framing/mood slightly between regenerations; keep the SAME chosen passage as the subject.`
      : `Random seed ${seme}: use it to pick a DIFFERENT subject each time you are asked, even for the same chronicle.`,
    brief,
    "",
    foco ? "CHOSEN PASSAGE TO ILLUSTRATE:" : "CHRONICLE TEXT:",
    chronicle.slice(0, 6000),
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
    const { scena, personaggi } = parseScene(testoOut);
    if (!scena) return res.status(500).json({ error: "Nessun soggetto estratto." });
    return res.status(200).json({ scena, personaggi });
  } catch (e) {
    return res.status(500).json({ error: "Estrazione fallita: " + e.message });
  }
}
