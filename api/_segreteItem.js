// api/_segreteItem.js
// Oggetti delle Segrete (2026-11-08): Claude scrive un oggetto nel formato del motore delle Segrete
// (src/data/segreteItems.js → normalizeCustomItem) con uno strumento forzato, così il JSON è sempre
// valido. La chiama api/genera-boss.js con { tipo: "segreteItem" }. Il client manda il vocabolario
// (armi, armature, chi le porta) così l'IA sceglie solo cose che il gioco conosce.
// Prima si generava dalla Forgia del Mercato con lo schema degli oggetti di Foundry: non c'entrava.

const DMG = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "force", "psychic"];
const KINDS = ["weapon", "armor", "shield", "heal", "revive", "cleanse", "cleanse_party", "panacea", "buff", "throw", "throw_area"];
const DICE = { type: "string", description: "Dadi, es. 1d4, 2d6, 1d8" };
const DOT = { type: "object", properties: { chance: { type: "integer", minimum: 5, maximum: 60 }, dice: DICE, turns: { type: "integer", minimum: 1, maximum: 4 } }, required: ["chance", "dice", "turns"] };

const TOOL = {
  name: "oggetto_segrete",
  description: "Un oggetto del gioco «Le Segrete» (dungeon a turni, regole tipo D&D 5e).",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome in italiano, evocativo, max 5 parole" },
      icon: { type: "string", description: "UNA emoji" },
      kind: { type: "string", enum: KINDS },
      rarity: { type: "string", enum: ["common", "uncommon", "rare", "veryRare"] },
      desc: { type: "string", description: "1 frase breve in italiano per i giocatori: cosa fa (con i numeri) e un tocco di colore. Max 140 caratteri." },
      look: { type: "string", description: "IN INGLESE, solo l'aspetto per disegnarlo: materiali, colori, decorazioni. Per le armature descrivi MANICHE, AVAMBRACCI e GUANTI (è quello che si vede in prima persona)." },
      price: { type: "integer", minimum: 0, maximum: 5000, description: "Monete Antiche in bottega; 0 = si trova solo nei dungeon. Riferimento: pozione 25, pozione superiore 250, arma +1 1200, piastre 1500" },
      base: { type: "string", description: "weapon: chiave dell'arma base; armor: chiave dell'armatura base (dal vocabolario)" },
      plus: { type: "integer", minimum: 0, maximum: 3, description: "weapon: +N a colpire e danni; armor/shield: +N alla CA" },
      fx: {
        type: "object", description: "SOLO per weapon: effetti al colpo (metti solo quelli che servono, 1 o 2)",
        properties: {
          extra: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "[dadi, tipo] danno in più a ogni colpo, es. [\"1d4\",\"fire\"]" },
          burn: DOT, poison: DOT,
          slow: { type: "object", properties: { chance: { type: "integer", minimum: 5, maximum: 60 }, turns: { type: "integer", minimum: 1, maximum: 3 } }, required: ["chance", "turns"] },
          stun: { type: "object", properties: { chance: { type: "integer", minimum: 5, maximum: 30 } }, required: ["chance"] },
          drain: { type: "integer", minimum: 10, maximum: 100, description: "% del danno extra che cura chi colpisce (serve extra)" },
          crit: { type: "integer", minimum: 18, maximum: 19, description: "critico da 19 o 18" },
          multi: { type: "object", properties: { double: { type: "integer", minimum: 5, maximum: 40 }, none: { type: "integer", minimum: 0, maximum: 20 } }, required: ["double", "none"], description: "% colpo doppio / % colpo a vuoto" },
        },
      },
      res: { type: "array", items: { type: "string", enum: DMG }, description: "armor/shield: resistenze ai danni (max 2)" },
      saveBonus: { type: "integer", minimum: 0, maximum: 2, description: "armor/shield: +N ai tiri salvezza" },
      thorns: { type: "object", properties: { chance: { type: "integer", minimum: 5, maximum: 50 }, dice: DICE, dmg: { type: "string", enum: DMG } }, required: ["chance", "dice", "dmg"], description: "armor/shield: chi colpisce in mischia a volte si fa male" },
      dice: { ...DICE, description: "heal: PF curati; throw/throw_area: danni" },
      flat: { type: "integer", minimum: 0, maximum: 30, description: "heal: PF fissi in più" },
      pct: { type: "integer", minimum: 10, maximum: 100, description: "revive: % dei PF" },
      buff: { type: "string", enum: ["ac", "adv"] },
      value: { type: "integer", minimum: 1, maximum: 4, description: "buff ac: +N CA" },
      turns: { type: "integer", minimum: 1, maximum: 5, description: "buff: round" },
      dmg: { type: "string", enum: DMG, description: "throw/throw_area: tipo di danno" },
      save: { type: "string", enum: ["str", "dex", "con", "wis"], description: "throw_area: tiro salvezza" },
      dc: { type: "integer", minimum: 10, maximum: 18 },
    },
    required: ["name", "icon", "kind", "rarity", "desc", "look", "price"],
  },
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

export async function generaOggettoSegrete(body, res) {
  const { kind = "", base = "", rarity = "", idea = "", dungeon = {}, vocab = {}, evita = [] } = body || {};
  const seme = Math.floor(Math.random() * 1e9);
  const w = vocab.weapons || {}, a = vocab.armors || {};
  const wList = Object.entries(w).map(([k, v]) => `${k} = ${v.name} (${v.dice} ${v.dmg}; classi: ${(v.classes || []).join(", ") || "nessuna"})`).join("\n");
  const aList = Object.entries(a).map(([k, v]) => `${k} = ${v.name} (${v.cat}, CA ${v.ac}; classi: ${(v.classes || []).join(", ") || "nessuna"})`).join("\n");
  const PROMPT = `Sei il game designer degli oggetti delle "Segrete" della campagna dark fantasy Eldoria: dungeon a turni, regole tipo D&D 5e, valuta = Monete Antiche (~40 a dungeon per eroe).
Crea UN oggetto.

Richiesta del Master:
- Tipo: ${KINDS.includes(kind) ? kind : "scegli tu"}${base ? ` (base: ${base})` : ""}
- Rarità: ${rarity || "scegli tu"}
- Dungeon: ${dungeon.name ? `${dungeon.name}${dungeon.desc ? ` — ${String(dungeon.desc).slice(0, 300)}` : ""}` : "qualsiasi"}
${idea ? `- Idea (rispettala): ${String(idea).slice(0, 600)}` : "- Nessuna idea: sorprendimi, ma resta utile e coerente."}

VOCABOLARIO (usa SOLO queste chiavi)
Armi (base per weapon):
${wList}
Armature (base per armor; le classi che le portano dipendono dalla base: scegli la base in modo che la usino le classi giuste):
${aList}
Tipi di danno: ${DMG.join(", ")}.

REGOLE
- weapon: base + plus 0-2 + 1 o 2 effetti in fx coerenti col tema (il fuoco brucia, il gelo rallenta, il veleno avvelena…). Niente fx sulle altre categorie.
- armor/shield: plus 0-2, al massimo 2 resistenze, saveBonus/thorns solo se ha senso. Una veste da mago usa base "abiti" o "magica".
- Equilibrio per rarità: common = poco (un +1 o un effetto debole), uncommon = un effetto, rare = +1 e un effetto, veryRare = +2 o due effetti. Le probabilità restano basse (15-35%).
- Consumabili: numeri come le pozioni di D&D (Guarigione 2d4+2, Superiore 8d4+8; Fuoco dell'Alchimista 2d6).
- price 0 se è un oggetto da trovare (armi e armature speciali di solito 0), altrimenti in linea coi riferimenti.
- L'oggetto fa SOLO quello che i campi dello strumento permettono: niente effetti inventati (niente "sordo", "accecato", cure nel tempo… se non c'è un campo apposta). throw = danno sicuro a UN nemico, niente tiro salvezza; throw_area = danno a tutti i nemici con TS per metà.
- desc breve in italiano con i numeri veri e i tipi di danno IN ITALIANO (fuoco, freddo, necrotico, forza…); look in inglese solo aspetto (per le armature maniche, avambracci e guanti).
- Originale, niente nomi banali. Seme: ${seme}.${Array.isArray(evita) && evita.length ? `\n- Nomi già usati: ${evita.slice(0, 80).join(", ")}` : ""}

Compila lo strumento oggetto_segrete.`;
  const req = { max_tokens: 2000, temperature: 1, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content: PROMPT }] };
  try {
    let out = await claude("claude-sonnet-5-5", req);
    if (!out.ok && (out.status === 404 || out.status === 400 || out.data?.error?.type === "not_found_error")) out = await claude("claude-sonnet-4-6", req);
    if (!out.ok || out.data.error) throw new Error(out.data?.error?.message || `HTTP ${out.status}`);
    const tool = (out.data.content || []).find((b) => b.type === "tool_use");
    if (!tool?.input) throw new Error("risposta senza oggetto");
    return res.status(200).json({ item: tool.input, usage: out.data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: "Oggetto non generato: " + (err.message || err) });
  }
}
