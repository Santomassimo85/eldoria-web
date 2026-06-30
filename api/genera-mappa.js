// api/genera-mappa.js
// Genera una MAPPA tattica per il Boss Fight: una griglia di terreni con quote,
// prop e punti di spawn. Per restare leggera, la mappa torna in formato COMPATTO
// a righe di caratteri (una lettera = un terreno) + quote a cifre; il client
// (BattleMapEditor) la espande in tiles. La chiave Anthropic resta su Vercel.

const TERR_CODES = {
  g: "grass", s: "stone", a: "sand", d: "dirt", w: "wood",
  n: "snow", "~": "water", l: "lava", c: "acid", ".": "void",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const body = req.body || {};
  const seme = Math.floor(Math.random() * 1e9);
  const w = Math.max(8, Math.min(16, parseInt(body.w) || 12));
  const h = Math.max(8, Math.min(16, parseInt(body.h) || 12));
  const tema = String(body.tema || body.contesto || "").trim();

  const legenda = Object.entries(TERR_CODES).map(([k, v]) => `${k}=${v}`).join(", ");

  const PROMPT = `Sei un level designer di mappe tattiche per un gioco a griglia isometrica (stile Final Fantasy Tactics) nel mondo fantasy di Eldoria.
Progetta UNA mappa di battaglia ${w} larga × ${h} alta, interessante e GIOCABILE: coperture, dislivelli, un paio di ostacoli naturali, due zone di schieramento contrapposte (eroi vs nemici) ai lati opposti.

Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
{"name":"","w":${w},"h":${h},"rows":[],"elevation":[],"props":[{"x":0,"y":0,"p":"tree"}],"spawns":{"hero":[[0,0]],"enemy":[[0,0]]}}

REGOLE FERREE:
- "rows": ESATTAMENTE ${h} stringhe, ognuna di ESATTAMENTE ${w} caratteri. Ogni carattere è un terreno. Legenda: ${legenda}.
- Usa principalmente terreni transitabili (g,s,a,d,w,n); usa ~ (acqua), l (lava), c (acido) con parsimonia come pericoli; usa . (vuoto/precipizio) solo per bordi o crepacci, MAI tutta la mappa.
- "elevation": ESATTAMENTE ${h} stringhe di ${w} cifre (0-9), la quota di ogni casella. Tieni il grosso a 0-2, con qualche rialzo (3-5) per collinette/piattaforme. Niente picchi isolati ovunque.
- "props": pochi (3-10) oggetti che bloccano il passaggio, SOLO con "p" tra: tree, boulder, column. Coordinate dentro la griglia (x 0-${w - 1}, y 0-${h - 1}).
- "spawns": 3-6 caselle "hero" su un lato e 3-6 "enemy" sul lato opposto, su terreno transitabile (mai ~,l,c,. e mai su un prop).
- "name": nome evocativo della mappa, NON italiano-stereotipato.

Coerenza tematica${tema ? ` col tema richiesto: "${tema}"` : " (inventa un ambiente)"} — es. cripta in pietra, radura boscosa, ghiacciaio, caverna lavica, rovine desertiche. Varia (seme ${seme}).`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        temperature: 1,
        messages: [{ role: "user", content: PROMPT }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const testo = (data.content || []).map((b) => b.text || "").join("");
    let pulito = testo.replace(/```json|```/g, "").trim();
    const s = pulito.indexOf("{"), e = pulito.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) pulito = pulito.slice(s, e + 1);
    const out = JSON.parse(pulito);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Generazione mappa fallita: " + e.message });
  }
}
