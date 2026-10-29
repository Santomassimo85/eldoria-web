// api/_enemy.js
// Forgia dei Nemici (2026-10-29): Claude scrive la scheda COMPLETA di un nemico
// D&D 5e (regole 2014) come strumento forzato, così il JSON è sempre valido.
// La chiama api/genera-boss.js con { tipo: "nemico" } (niente funzioni Vercel
// in più). Il sito la trasforma in un attore dnd5e con src/data/enemyFoundry.js.
import { SRD_SPELLS } from "./_srdSpells.js";

const TYPES = ["humanoid", "beast", "undead", "fiend", "dragon", "aberration", "monstrosity", "construct", "elemental", "fey", "giant", "celestial", "ooze", "plant"];
const SIZES = ["tiny", "sm", "med", "lg", "huge", "grg"];
const AB = ["str", "dex", "con", "int", "wis", "cha"];
const DMG = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const COND = ["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const SKILLS = ["acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv", "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur"];
const WEAPONS = ["natural", "club", "dagger", "greatclub", "handaxe", "javelin", "lighthammer", "mace", "quarterstaff", "sickle", "spear", "lightcrossbow", "dart", "shortbow", "sling", "battleaxe", "flail", "glaive", "greataxe", "greatsword", "halberd", "lance", "longsword", "maul", "morningstar", "pike", "rapier", "scimitar", "shortsword", "trident", "warpick", "warhammer", "whip", "handcrossbow", "heavycrossbow", "longbow"];
const ARMOR = ["natural", "padded", "leather", "studded", "hide", "chainshirt", "scalemail", "breastplate", "halfplate", "ringmail", "chainmail", "splint", "plate"];
const ALL_SPELLS = Object.values(SRD_SPELLS).flat();

const dmgObj = { type: "object", properties: { formula: { type: "string", description: "es. 2d6+3 o 8d6" }, type: { type: "string", enum: DMG } }, required: ["formula", "type"] };

const TOOL = {
  name: "scheda_nemico",
  description: "Scheda completa di un nemico D&D 5e (2014) per Foundry VTT.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome evocativo (italiano o di fantasia)" },
      creatureType: { type: "string", enum: TYPES },
      subtype: { type: "string", description: "es. orco, goblinoide, demone; vuoto se nessuno" },
      size: { type: "string", enum: SIZES },
      alignment: { type: "string", description: "In italiano, es. caotico malvagio" },
      cr: { type: "number", description: "Grado di sfida: 0, 0.125, 0.25, 0.5, 1..30" },
      description: { type: "string", description: "2-3 frasi in italiano: chi è e cosa vuole" },
      appearance: { type: "string", description: "1-2 frasi in italiano, solo l'aspetto fisico (serve per il ritratto)" },
      tactics: { type: "string", description: "1-2 frasi: come combatte" },
      loot: { type: "string", description: "Bottino plausibile, breve" },
      abilities: { type: "object", properties: Object.fromEntries(AB.map((k) => [k, { type: "integer", minimum: 1, maximum: 30 }])), required: AB },
      saves: { type: "array", items: { type: "string", enum: AB }, description: "Tiri salvezza con competenza" },
      skills: { type: "array", items: { type: "object", properties: { key: { type: "string", enum: SKILLS }, expertise: { type: "boolean" } }, required: ["key"] } },
      hitDice: { type: "object", properties: { count: { type: "integer", minimum: 1, maximum: 40 }, die: { type: "integer", enum: [4, 6, 8, 10, 12, 20] } }, required: ["count", "die"], description: "Dado vita secondo la taglia (minuscola d4, piccola d6, media d8, grande d10, enorme d12, mastodontica d20)" },
      armor: {
        type: "object",
        properties: {
          base: { type: "string", enum: ARMOR, description: "natural = armatura naturale o vestiti" },
          ac: { type: "integer", description: "Solo per natural: la CA totale" },
          shield: { type: "boolean" },
          name: { type: "string", description: "Nome in italiano dell'armatura (facoltativo)" },
        },
        required: ["base"],
      },
      speed: { type: "object", properties: { walk: { type: "integer" }, fly: { type: "integer" }, swim: { type: "integer" }, climb: { type: "integer" }, burrow: { type: "integer" }, hover: { type: "boolean" } }, required: ["walk"] },
      senses: { type: "object", properties: { darkvision: { type: "integer" }, blindsight: { type: "integer" }, tremorsense: { type: "integer" }, truesight: { type: "integer" } } },
      languages: { type: "string", description: "In italiano, es. Comune, Orchesco" },
      resistances: { type: "array", items: { type: "string", enum: DMG } },
      immunities: { type: "array", items: { type: "string", enum: DMG } },
      vulnerabilities: { type: "array", items: { type: "string", enum: DMG } },
      conditionImmunities: { type: "array", items: { type: "string", enum: COND } },
      multiattack: { type: "string", description: "Se attacca più volte: es. 'Compie due attacchi con la spada lunga'. Vuoto se no." },
      weapons: {
        type: "array",
        description: "Armi impugnate (base SRD) e armi naturali (base natural: morso, artigli, coda…)",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome in italiano (es. Spada lunga dentellata, Morso)" },
            base: { type: "string", enum: WEAPONS },
            damage: { type: "string", description: "Solo per natural: dado del danno senza modificatore, es. 2d6" },
            damageType: { type: "string", enum: DMG, description: "Solo per natural" },
            ranged: { type: "boolean", description: "Solo per natural (es. aculei lanciati)" },
            range: { type: "integer", description: "Solo per natural a distanza, in piedi" },
            reach: { type: "integer", description: "Portata in piedi (5 o 10)" },
            ability: { type: "string", enum: ["", "str", "dex"], description: "Vuoto = automatico" },
            magicBonus: { type: "integer", minimum: 0, maximum: 3 },
            extra: { ...dmgObj, description: "Danno in più a ogni colpo (es. 2d6 veleno), facoltativo" },
            description: { type: "string", description: "Breve, facoltativa (effetti a parte come prono, afferrato…)" },
            legendaryCost: { type: "integer", description: "Solo se è usabile come azione leggendaria" },
          },
          required: ["name", "base"],
        },
      },
      features: {
        type: "array",
        description: "Tratti passivi, azioni speciali, azioni bonus, reazioni, azioni leggendarie",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            kind: { type: "string", enum: ["passive", "action", "bonus", "reaction", "legendary"] },
            description: { type: "string", description: "Testo in italiano con l'effetto in regole 5e" },
            save: { type: "object", properties: { ability: { type: "string", enum: AB } }, description: "Tiro salvezza richiesto ai bersagli" },
            dcAbility: { type: "string", enum: AB, description: "Caratteristica che fissa la CD (8 + competenza + mod)" },
            onSave: { type: "string", enum: ["half", "none"] },
            attack: { type: "object", properties: { ability: { type: "string", enum: AB }, ranged: { type: "boolean" } }, description: "Se è un tiro per colpire (non arma)" },
            damage: dmgObj,
            heal: { type: "string", description: "Formula di cura su di sé, es. 2d8+4" },
            area: { type: "object", properties: { type: { type: "string", enum: ["cone", "sphere", "line", "cube", "cylinder"] }, size: { type: "integer" } } },
            range: { type: "integer" },
            uses: { type: "object", properties: { per: { type: "string", enum: ["recharge", "day", "sr", "lr"] }, max: { type: "integer" }, recharge: { type: "integer", description: "Ricarica 5-6 = 5" } } },
            legendaryCost: { type: "integer" },
          },
          required: ["name", "kind", "description"],
        },
      },
      spellcasting: {
        type: "object",
        description: "Solo se lancia incantesimi",
        properties: {
          ability: { type: "string", enum: ["int", "wis", "cha"] },
          level: { type: "integer", minimum: 1, maximum: 20, description: "Livello da incantatore" },
          spells: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome INGLESE esatto, preso SOLO dalla lista fornita" },
                level: { type: "integer", minimum: 0, maximum: 9 },
                mode: { type: "string", enum: ["spell", "atwill", "innate"], description: "spell = slot; atwill = a volontà; innate = N al giorno" },
                perDay: { type: "integer" },
              },
              required: ["name", "level"],
            },
          },
        },
        required: ["ability", "level", "spells"],
      },
      legendaryActions: { type: "integer", minimum: 0, maximum: 3 },
      legendaryResistances: { type: "integer", minimum: 0, maximum: 3 },
    },
    required: ["name", "creatureType", "size", "cr", "description", "appearance", "abilities", "hitDice", "armor", "speed", "weapons", "features"],
  },
};

const RUOLI = {
  bruto: "bruto da mischia: tanti PF, colpi pesanti",
  cecchino: "combattente a distanza, mobile",
  incantatore: "incantatore: incantesimi come arma principale, fragile",
  capo: "capo/comandante: rafforza gli alleati, carismatico, duro",
  sgherro: "sgherro: semplice, da usare in gruppo",
  furtivo: "assassino furtivo: imboscate, veleni, colpi critici",
  supporto: "supporto: cure, controllo, maledizioni",
  boss: "boss solitario: azioni leggendarie, resistenze leggendarie, area d'effetto",
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

export async function generaNemico(body, res) {
  const { creatureType = "", cr = "", ruolo = "", spunto = "", evita = [] } = body || {};
  const seme = Math.floor(Math.random() * 1e9);
  const tipo = TYPES.includes(creatureType) ? creatureType : "";
  const gs = cr === "" || cr == null ? "" : Number(cr);
  const spellList = Object.entries(SRD_SPELLS).map(([l, names]) => `${l === "0" ? "Trucchetti" : `Livello ${l}`}: ${names.join(", ")}`).join("\n");
  const PROMPT = `Sei il game designer dei nemici della campagna dark fantasy "Eldoria" (D&D 5e, regole 2014, Foundry VTT).
Crea UN nemico ORIGINALE e giocabile, con statistiche coerenti con le tabelle del Dungeon Master's Guide per il suo GS (PF, CA, bonus a colpire, danni per round, CD).

Richiesta del Master:
- Tipo di creatura: ${tipo || "scegli tu (sorprendimi)"}
- Grado di sfida: ${gs !== "" && Number.isFinite(gs) ? gs : "scegli tu un GS sensato fra 1/4 e 12"}
- Ruolo: ${RUOLI[ruolo] || "scegli tu"}
${spunto ? `- Spunto (rispettalo): ${String(spunto).slice(0, 800)}` : ""}

REGOLE
- Testi in italiano. Nomi delle magie in INGLESE esatto, presi SOLO da questa lista (sono quelle del compendio):
${spellList}
- Armi: se impugna armi vere usa la base SRD (longsword, shortbow…); il nome in italiano può essere personalizzato. Mostri e bestie usano base "natural" con damage (solo dadi) e damageType. Il modificatore lo aggiunge Foundry: NON scriverlo nel dado.
- Armatura: un umanoide armato usa un'armatura SRD (base) e magari lo scudo; mostri e bestie "natural" con la CA totale in "ac".
- PF: scegli hitDice coerenti con la taglia; i PF = dadi + COS × numero di dadi.
- Capacità (features): 1-4, con effetti in regole chiare. Per i soffi e le aree usa save + area + damage + uses (ricarica). Le passive (es. Tattiche di branco, Sensibilità alla luce) kind "passive".
- NON ripetere gli incantesimi fra le capacità: un incantesimo sta SOLO in spellcasting. Formule di danno e cura SOLO dadi e numeri (es. 3d6+4), mai testo.
- Incantesimi solo per chi li lancia davvero: livello d'incantatore coerente col GS, al massimo 8-10 incantesimi, solo di livelli che il suo livello d'incantatore permette.
- Azioni e resistenze leggendarie SOLO per boss/GS alto.
- Niente cliché (niente "Signore Oscuro", "Ombra Antica"). Seme di varietà: ${seme}.${Array.isArray(evita) && evita.length ? `\n- Nomi già usati, da NON ripetere: ${evita.slice(-15).join(", ")}` : ""}

Compila lo strumento scheda_nemico.`;

  const req = {
    max_tokens: 6000,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: PROMPT }],
  };
  try {
    let out = await claude("claude-sonnet-5-5", req);
    if (!out.ok && (out.status === 404 || out.data?.error?.type === "not_found_error" || out.status === 400)) out = await claude("claude-sonnet-4-6", req);
    if (!out.ok || out.data.error) throw new Error(out.data?.error?.message || `HTTP ${out.status}`);
    const tool = (out.data.content || []).find((b) => b.type === "tool_use");
    if (!tool?.input) throw new Error("risposta senza scheda");
    const e = tool.input;
    // Magie che non esistono nel compendio: via (meglio una in meno che una rotta).
    if (e.spellcasting?.spells) {
      const norm = (s) => String(s || "").toLowerCase().trim();
      const known = new Map(ALL_SPELLS.map((n) => [norm(n), n]));
      e.spellcasting.spells = e.spellcasting.spells.filter((s) => known.has(norm(s.name))).map((s) => ({ ...s, name: known.get(norm(s.name)) }));
      if (!e.spellcasting.spells.length) delete e.spellcasting;
    }
    return res.status(200).json({ enemy: e, usage: out.data.usage || null });
  } catch (err) {
    return res.status(500).json({ error: "Nemico non generato: " + (err.message || err) });
  }
}
