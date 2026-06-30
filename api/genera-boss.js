// api/genera-boss.js
// "Cervello" del Boss Fight: riceve un tipo (boss|minion) + un eventuale spunto,
// chiama Claude e restituisce un boss o un minion completo di STATISTICHE e
// AZIONI/SPELL in JSON, conforme allo schema del pannello WorldBossAdmin.
// Vive su Vercel. La chiave Anthropic resta qui, nascosta.

// Enumerazioni VALIDE (devono combaciare con WorldBossAdmin / battleModel).
const TYPES = ["attack", "heal", "buff_ca", "buff_adv", "debuff_dis"];
const DICE = ["d4", "d6", "d8", "d10", "d12", "d20"];
const SHAPES = ["single", "sphere", "square", "line", "cone"];
const DMG = ["", "fuoco", "ghiaccio", "fulmine", "veleno", "oscurità", "sacro", "fisico", "arcano"];
const SAVES = ["dex", "con", "wis", "str", "int", "cha"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { tipo = "boss", contesto = "", evita } = req.body || {};
  const isMinion = tipo === "minion";
  const seme = Math.floor(Math.random() * 1e9);

  const daEvitare = Array.isArray(evita) && evita.length
    ? `\nNON usare questi nomi gia' apparsi: ${evita.slice(-12).join(", ")}.`
    : "";

  const schemaAzione =
`{"type":"attack","name":"","diceNum":1,"diceType":"d8","bonus":0,"acBonus":2,"range":1,"aoeShape":"single","aoeSize":1,"dmgType":"","saveAbility":"dex","halfOnSave":true}`;

  const schema = isMinion
    ? `{"name":"","hp":14,"ac":12,"actions":[${schemaAzione}]}`
    : `{"name":"","maxHp":420,"ac":17,"gradoSfida":"10","description":"","rewards":"","penalties":"","actions":[${schemaAzione}]}`;

  const regoleAzioni = `
REGOLE PER LE AZIONI (campo "actions"):
- "type" SOLO tra: ${TYPES.join(", ")}.
  · attack = colpo/incantesimo offensivo (usa dadi danno + bonus a colpire).
  · heal = il boss si cura (dadi+bonus di HP). buff_ca = alza la propria CA (acBonus).
  · buff_adv = vantaggio sul prossimo attacco. debuff_dis = svantaggio ai bersagli.
- "diceType" SOLO tra: ${DICE.join(", ")}. "diceNum" 1-8.
- "bonus" = bonus a colpire (attack) o agli HP (heal); intero 0-12. "acBonus" 1-6 (solo buff_ca).
- "range" = gittata in tile, 1-12 (1 = corpo a corpo).
- "aoeShape" SOLO tra: ${SHAPES.join(", ")} (l'area vale SOLO per "attack"; per gli altri usa "single").
- "aoeSize" 1-6 = raggio (cerchio/quadrato) o lunghezza (linea/cono); ha senso solo se aoeShape != single.
- "dmgType" SOLO tra: ${DMG.filter(Boolean).join(", ")} (oppure "" per automatico). Coerente col nome dell'azione.
- "saveAbility" SOLO tra: ${SAVES.join(", ")} (tiro salvezza per le aree). "halfOnSave" true/false.`;

  const PROMPT = isMinion
    ? `Sei il game designer dei nemici per la campagna fantasy Eldoria (gioco tattico a griglia, regole tipo D&D 5e).
Crea un MINION (sgherro riutilizzabile) ORIGINALE: debole-medio, 1-2 attacchi semplici.
Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
${schema}
${regoleAzioni}

EQUILIBRIO MINION: hp 8-30, ac 10-15, 1-2 azioni (perlopiu' "attack" a gittata bassa). Niente aree enormi.

VARIETA' (seme ${seme}): nome evocativo NON italiano e non trito; varia creatura/tema rispetto ai precedenti.${daEvitare}
${contesto ? `\nSpunto del master (rispettalo): ${contesto}` : ""}`
    : `Sei il game designer dei boss per la campagna fantasy Eldoria (gioco tattico a griglia, regole tipo D&D 5e).
Crea un BOSS (mostro/calamita') ORIGINALE, temibile e memorabile, con un kit di azioni vario e tematico.
Rispondi SOLO con questo JSON, senza testo prima/dopo, senza backtick:
${schema}
${regoleAzioni}

EQUILIBRIO BOSS: maxHp 200-600, ac 15-20, gradoSfida coerente (stringa, es. "8".."16"). Da 3 a 5 azioni: almeno un attacco ad AREA (sphere/cone/line) con tiro salvezza, almeno un colpo singolo forte, ed eventualmente una cura o un buff. Tipi di danno coerenti col tema.
"description" = 1-2 frasi epiche. "rewards" = bottino/XP plausibili. "penalties" = conseguenze se i player perdono.

VARIETA' (seme ${seme}): nome NON italiano e non trito; tema/elemento diverso dal solito.${daEvitare}
${contesto ? `\nSpunto del master (rispettalo): ${contesto}` : ""}`;

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
        max_tokens: 2000,
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
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
