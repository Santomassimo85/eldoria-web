// api/genera-missione.js
// "Bacheca di Hemile": Claude scrive una missione e la LETTERA del mittente.
// Riceve dal pannello del Master un estratto del mondo (NPC e luoghi del sito)
// e le sue indicazioni; usa quegli NPC/luoghi quando calzano, altrimenti ne
// inventa di nuovi (segnalandolo). Restituisce anche il prompt per l'immagine,
// che il client manda poi a /api/genera-immagine (Gemini).

export const config = { maxDuration: 60 };

const MODEL = "claude-opus-4-8";

const QUEST_TOOL = {
  name: "missione",
  description: "La missione da appendere alla Bacheca di Hemile.",
  input_schema: {
    type: "object",
    properties: {
      title:        { type: "string", description: "Titolo breve ed evocativo (max 6 parole)." },
      sender:       { type: "string", description: "Chi scrive la lettera: nome ed eventuale titolo, come firmerebbe." },
      senderIsNew:  { type: "boolean", description: "true se il mittente è inventato, false se è un NPC dell'elenco." },
      zona:         { type: "string", description: "Dove si svolge la missione." },
      zonaIsNew:    { type: "boolean", description: "true se il luogo è inventato (o un posto minore attorno a un luogo reale)." },
      letter:       { type: "string", description: "La lettera, in italiano, con a capo veri (\\n). Saluto, richiesta, firma." },
      diff:         { type: "string", enum: ["Facile", "Media", "Difficile", "Eroica"] },
      cr:           { type: "string", description: "Grado di sfida indicativo, es. \"3\"." },
      rewardGold:   { type: "integer", description: "Corone offerte." },
      rewardItem:   { type: "string", description: "Oggetto promesso, o stringa vuota." },
      rewardOther:  { type: "string", description: "Altra ricompensa (favore, informazione…), o stringa vuota." },
      imagePrompt:  { type: "string", description: "Descrizione della SCENA per l'illustrazione: luogo, luce, minaccia o oggetto della missione. Niente persone che leggono lettere, niente testo." },
      masterNote:   { type: "string", description: "Una o due frasi SOLO per il Master: cosa c'è davvero dietro la richiesta." },
    },
    required: ["title", "sender", "senderIsNew", "zona", "zonaIsNew", "letter", "diff", "cr", "rewardGold", "rewardItem", "rewardOther", "imagePrompt", "masterNote"],
  },
};

const GOLD_BY_DIFF = { Facile: "50–150", Media: "150–400", Difficile: "400–900", Eroica: "900–2500" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { idea = "", zona = "", diff = "", target = "All", npcs = [], places = [], recent = [] } = req.body || {};
  const seme = Math.floor(Math.random() * 1e9);

  const TONI = ["supplichevole", "freddo e d'affari", "minaccioso", "ironico", "disperato", "pomposo e burocratico", "misterioso e reticente", "affettuoso ma preoccupato"];
  const tono = TONI[seme % TONI.length];

  const npcList = (Array.isArray(npcs) ? npcs : []).slice(0, 80)
    .map((n) => `- ${n.name}${n.meta ? ` (${n.meta})` : ""}${n.desc ? `: ${n.desc}` : ""}`).join("\n");
  const placeList = (Array.isArray(places) ? places : []).slice(0, 50)
    .map((p) => `- ${p.name}${p.meta ? ` (${p.meta})` : ""}${p.desc ? `: ${p.desc}` : ""}`).join("\n");
  const recentList = (Array.isArray(recent) ? recent : []).slice(0, 15).join(" · ");

  const prompt = `Sei Hemile, la locandiera che appende le missive sulla sua bacheca, nel mondo fantasy di Exanthia (campagna D&D 5e "Eldoria").
Scrivi UNA missione nuova per i giocatori e la LETTERA con cui qualcuno la chiede.

## MONDO DELL'APP (usalo per primo)
NPC esistenti:
${npcList || "(nessuno)"}

Luoghi esistenti:
${placeList || "(nessuno)"}

## REGOLE
- Il MITTENTE: se un NPC dell'elenco ha un motivo credibile per scrivere, usa lui (nome identico) e senderIsNew=false. Altrimenti inventa una persona nuova (nome non banale, mestiere, luogo) e senderIsNew=true. Puoi citare nella lettera altri NPC dell'elenco.
- Il LUOGO: preferisci un luogo dell'elenco (nome identico, zonaIsNew=false). Se ne inventi uno, che sia un posto minore (una valle, una miniera, un mulino, un guado, un santuario) ATTORNO a un luogo reale, e scrivilo come "Miniera di X, presso <luogo reale>" con zonaIsNew=true. Non inventare città né regni.
- La LETTERA: 120–220 parole, in italiano, voce e grafia del mittente (tono ${tono}; un commerciante non scrive come un sacerdote). Saluto, cosa è successo, cosa chiede, cosa offre, firma. Dettagli concreti (nomi, luoghi, un indizio) ma lascia qualcosa di non detto. Niente formule da videogioco ("missione", "PE", "loot"). Non scrivere mai cosa fanno o dicono i personaggi dei giocatori.
- Ricompensa coerente con la difficoltà (Corone indicative: ${Object.entries(GOLD_BY_DIFF).map(([k, v]) => `${k} ${v}`).join(", ")}) e con chi paga: un contadino offre poco e magari un favore.
- imagePrompt: una scena illustrabile legata alla missione (il luogo, la minaccia, un indizio), in italiano, senza testo né scritte.
- Non ripetere titoli o trame di queste missioni già sulla bacheca: ${recentList || "(nessuna)"}.

## INDICAZIONI DEL MASTER
${idea ? `Idea: ${idea}` : "Nessuna idea: scegli tu, varia genere (indagine, caccia, scorta, recupero, diplomazia, orrore, furto…)."}
${zona ? `Zona richiesta: ${zona}` : ""}
${diff ? `Difficoltà richiesta: ${diff}` : ""}
${target && target !== "All" ? `Destinatario: ${["AMEA", "ENOX", "LAC", "LEAF"].includes(target) ? `il gruppo ${target}` : `il personaggio ${target}`} (la lettera può rivolgersi a loro).` : "Destinatario: chiunque legga la bacheca."}

Seme di varietà: ${seme}. Rispondi chiamando lo strumento "missione".`;

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
        max_tokens: 2500,
        tools: [QUEST_TOOL],
        tool_choice: { type: "tool", name: "missione" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const tool = (data.content || []).find((b) => b.type === "tool_use");
    if (!tool?.input) return res.status(500).json({ error: "Nessuna missione ricevuta." });
    return res.status(200).json({
      quest: tool.input,
      usage: { input: data.usage?.input_tokens, output: data.usage?.output_tokens },
    });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
