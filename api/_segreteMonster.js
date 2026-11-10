// api/_segreteMonster.js
// Mostri delle Segrete (2026-11-07): Claude scrive la scheda COMPLETA di un mostro
// del bestiario dei dungeon con uno strumento forzato (JSON sempre valido):
// nome, icona, taglia, aspetto (italiano + inglese per lo sprite), livello, PF, CA,
// iniziativa, TS, resistenze/vulnerabilità/immunità D&D e azioni nel formato del
// World Boss (con lo stato che infliggono). La chiama api/genera-boss.js con
// { tipo: "segrete" }. Prima si usava lo schema dei minion del World Boss con uno
// spunto fisso ("mostro base di D&D"): uscivano sempre gli stessi e senza difese.

const DMG = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const ACT_DMG = ["fisico", "fuoco", "ghiaccio", "fulmine", "veleno", "oscurità", "sacro", "arcano"];
const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const STATUS = ["none", "burn", "poison", "frozen", "paralyzed", "petrified", "frightened", "blinded", "slow", "confused"];
const SAVES = ["str", "dex", "con", "int", "wis", "cha"];
const CREATURES = ["bestia", "non morto", "costrutto", "aberrazione", "elementale", "umanoide (bandito, cultista, soldato…)", "immondo", "folletto", "melma", "vegetale", "mostruosità", "drago o draconide", "gigante", "goblinoide", "insetto o aracnide gigante"];
const TACTICS = ["bruto che picchia duro", "schermagliatore veloce", "tiratore a distanza", "controllore che mette stati", "soldato corazzato", "agguato e veleno", "lanciatore di incantesimi", "branco che si aiuta", "guaritore o sostegno degli altri"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const ACTION = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["attack", "heal", "buff_ca", "buff_adv", "debuff_dis"], description: "attack = colpo o incantesimo offensivo; heal = cura sé o un alleato; buff_ca = +CA a sé; buff_adv = vantaggio ai suoi attacchi; debuff_dis = svantaggio agli eroi" },
    name: { type: "string", description: "Nome dell'azione in italiano, evocativo (es. Morso Gelido, Ragnatela Appiccicosa)" },
    diceNum: { type: "integer", minimum: 1, maximum: 10 },
    diceType: { type: "string", enum: ["d4", "d6", "d8", "d10", "d12"] },
    bonus: { type: "integer", minimum: 0, maximum: 14, description: "attack con hitMode hit: bonus a colpire; heal: PF in più" },
    acBonus: { type: "integer", minimum: 1, maximum: 5, description: "solo buff_ca" },
    durationTurns: { type: "integer", minimum: 1, maximum: 4, description: "turni che durano buff_ca / buff_adv / debuff_dis" },
    aoeShape: { type: "string", enum: ["single", "sphere", "cone", "line", "square"], description: "single = un bersaglio; le altre = area su tutti gli eroi (solo per attack, di solito con hitMode save)" },
    dmgType: { type: "string", enum: ACT_DMG, description: "elemento del danno; fisico per armi, artigli, morsi" },
    hitMode: { type: "string", enum: ["hit", "save"], description: "hit = tiro per colpire; save = tiro salvezza degli eroi contro la CD" },
    saveAbility: { type: "string", enum: SAVES },
    saveDC: { type: "integer", minimum: 8, maximum: 22 },
    halfOnSave: { type: "boolean" },
    inflict: {
      type: "object",
      description: "Stato che l'azione può mettere all'eroe colpito. key none = nessuno (altrimenti il motore ne deduce uno dal tipo di danno).",
      properties: { key: { type: "string", enum: STATUS }, chance: { type: "integer", minimum: 5, maximum: 60 }, save: { type: "string", enum: SAVES } },
      required: ["key"],
    },
  },
  required: ["type", "name", "diceNum", "diceType", "dmgType", "hitMode"],
};

const TOOL = {
  name: "mostro_segrete",
  description: "Scheda di un mostro del bestiario delle Segrete (dungeon a turni, regole tipo D&D 5e).",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome in italiano o di fantasia, breve (max 4 parole)" },
      icon: { type: "string", description: "UNA emoji che lo rappresenta" },
      creature: { type: "string", description: "Tipo di creatura in italiano (es. non morto, bestia, costrutto)" },
      size: { type: "string", enum: SIZES },
      desc: { type: "string", description: "1-2 frasi in italiano: aspetto e come si comporta. La leggono i giocatori." },
      look: { type: "string", description: "IN INGLESE, solo aspetto fisico per il disegno: corpo, colori, armi, vestiti, materiale. 1-2 frasi, niente sfondo." },
      metalProtection: { type: "boolean", description: "true SOLO se indossa un'armatura metallica o ha corpo/carapace di metallo. Armi e piccoli accessori metallici NON contano. Golem di pietra/argilla/carne false; golem di ferro true. I danni acidi contro il metallo sono ×1,5." },
      level: { type: "integer", minimum: 1, maximum: 20 },
      hp: { type: "integer", minimum: 4, maximum: 600 },
      ac: { type: "integer", minimum: 8, maximum: 22 },
      init: { type: "integer", minimum: -2, maximum: 8 },
      save: { type: "integer", minimum: 0, maximum: 10 },
      resistances: { type: "array", items: { type: "string", enum: DMG }, description: "Danni che subisce a metà" },
      vulnerabilities: { type: "array", items: { type: "string", enum: DMG }, description: "Danni che subisce doppi (le sue debolezze)" },
      immunities: { type: "array", items: { type: "string", enum: DMG }, description: "Danni che non lo feriscono" },
      actions: { type: "array", minItems: 1, maxItems: 5, items: ACTION },
    },
    required: ["name", "icon", "creature", "size", "desc", "look", "metalProtection", "level", "hp", "ac", "init", "save", "resistances", "vulnerabilities", "immunities", "actions"],
  },
};

const RUOLI = {
  minion: "GREGARIO: esce in gruppo nelle sale normali. 1-2 azioni semplici (un attacco, al massimo una seconda mossa). PF circa 8 + 5×livello, CA 11-14.",
  elite: "ÉLITE: più forte, da solo o con qualche gregario. 2-3 azioni (un attacco forte + qualcosa di tattico: area piccola, stato, +CA o cura). PF circa 20 + 10×livello, CA 13-16.",
  boss: "BOSS dell'ultima sala: memorabile. 3-5 azioni varie: almeno un attacco singolo forte, almeno un'area (aoeShape non single, hitMode save, halfOnSave) e una mossa tattica (cura, +CA, vantaggio o svantaggio agli eroi). PF circa 50 + 22×livello, CA 15-18. Taglia di solito Grande o più.",
};

async function claude(model, body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, ...body }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function generaMostroSegrete(body, res) {
  const { dungeon = {}, role = "minion", level = 1, spunto = "", evita = [], current = null } = body || {};
  const ruolo = RUOLI[role] ? role : "minion";
  const lv = Math.max(1, Math.min(20, parseInt(level, 10) || 1));
  const hint = String(spunto || "").trim().slice(0, 600);
  // Varietà vera: senza spunto si tira a sorte il tipo di creatura e il modo di combattere
  const creature = hint ? "" : pick(CREATURES);
  const tactic = pick(TACTICS);
  const seme = Math.floor(Math.random() * 1e9);
  const names = (Array.isArray(evita) ? evita : []).map((n) => String(n || "").trim()).filter(Boolean).slice(0, 80);
  const dName = String(dungeon.name || "").slice(0, 60), dDesc = String(dungeon.desc || "").slice(0, 400);
  const cur = current && current.name ? `\nScheda attuale (riscrivila migliorandola e completandola, tieni il concetto): ${JSON.stringify({ name: current.name, desc: current.desc, level: current.level, role: current.role }).slice(0, 600)}` : "";

  const PROMPT = `Sei il game designer dei mostri delle "Segrete" della campagna dark fantasy Eldoria: dungeon a turni con regole tipo D&D 5e, mostri ispirati al Manuale dei Mostri ma con nomi e dettagli propri.
Crea UN mostro per questo dungeon.

Dungeon: ${dName || "un dungeon qualsiasi"}${dDesc ? ` — ${dDesc}` : ""}
Ruolo: ${RUOLI[ruolo]}
Livello: ${lv} (i numeri devono essere coerenti con questo livello).
${hint ? `Spunto del Master (rispettalo): ${hint}` : `Tipo di creatura (estratto a sorte, adattalo al dungeon): ${creature}`}
Modo di combattere: ${tactic}.${cur}

REGOLE
- Coerente col dungeon: abitanti, elementi e materiali del luogo (gelo nel ghiacciaio, fuoco nel magma, fango e marcio nella palude…).
- RESISTENZE E DEBOLEZZE come in D&D, SEMPRE pensate: un non morto è immune al veleno e vulnerabile al radioso, un elementale del fuoco immune al fuoco e vulnerabile al freddo, uno scheletro vulnerabile al contundente, un costrutto resiste al veleno e allo psichico, un melma resiste all'acido… Almeno UNA voce fra resistenze, vulnerabilità e immunità (una creatura davvero comune può avere solo una debolezza). Mai lo stesso tipo in due liste.
- Azioni: dmgType coerente col nome e con le difese (chi è immune al fuoco spesso attacca col fuoco). inflict: lo stato che ha senso (veleno per un morso velenoso, frozen per il gelo, paralyzed per una tossina, petrified per uno sguardo di pietra, frightened per un urlo, blinded per spruzzi o luce, slow per ragnatele o fango, confused per incantesimi della mente, burn per fiamme) con chance 15-40, oppure key "none".
- Aree solo con hitMode "save" e una CD (saveDC) di 10 + livello/2 circa. Gli attacchi hit hanno bonus circa 3 + livello/2.
- desc in italiano per i giocatori; look IN INGLESE solo l'aspetto, per disegnare lo sprite.
- Originale: niente nomi banali o già usati. Seme di varietà: ${seme}.${names.length ? `\n- Nomi GIÀ nel bestiario, NON ripeterli e non fare la stessa creatura con un altro nome: ${names.join(", ")}` : ""}

Compila lo strumento mostro_segrete.`;

  const req = {
    max_tokens: 3000,
    temperature: 1,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: PROMPT }],
  };
  try {
    let out = await claude("claude-sonnet-5-5", req);
    if (!out.ok && (out.status === 404 || out.status === 400 || out.data?.error?.type === "not_found_error")) out = await claude("claude-sonnet-4-6", req);
    if (!out.ok || out.data.error) throw new Error(out.data?.error?.message || `HTTP ${out.status}`);
    const tool = (out.data.content || []).find((b) => b.type === "tool_use");
    if (!tool?.input) throw new Error("risposta senza scheda");
    const m = tool.input;
    // niente doppioni fra le liste: l'immunità vince sulla resistenza, la resistenza sulla vulnerabilità
    const imm = [...new Set((m.immunities || []).filter((k) => DMG.includes(k)))];
    const resi = [...new Set((m.resistances || []).filter((k) => DMG.includes(k) && !imm.includes(k)))];
    const vul = [...new Set((m.vulnerabilities || []).filter((k) => DMG.includes(k) && !imm.includes(k) && !resi.includes(k)))];
    return res.status(200).json({ monster: { ...m, immunities: imm, resistances: resi, vulnerabilities: vul }, usage: out.data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: "Mostro non generato: " + (err.message || err) });
  }
}
