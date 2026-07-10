// api/genera-oggetto-completo.js
//
// Genera un OGGETTO COMPLETO del Mercato Nero a partire da un PROMPT testuale
// del master (e, opzionalmente, dall'immagine appena generata): nome, tipo,
// rarità, descrizione in stile Eldoria e i DATI DI COMBATTIMENTO Foundry
// (pronti per il fetch su Foundry). Usato dal tab "Genera con AI" di MarketAdmin.
//
// Per garantire JSON sempre valido usiamo il TOOL USE di Claude: l'API restituisce
// direttamente l'input strutturato dello strumento (già parsato), niente JSON.parse
// a mano (che altrove ci ha dato "Expected ',' or ']'…").
//
// Powered by Claude (ANTHROPIC_API_KEY, stessa del generatore NPC/oggetti).

export const config = { maxDuration: 45 };

// Scarica l'immagine (o legge la data: URI) come blocco vision per Claude.
async function fetchImageAsBlock(img) {
  if (!img) return null;
  if (img.startsWith("data:")) {
    const m = img.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return null;
    const mediaType = m[1] || "image/png";
    const data = m[2] ? m[3] : Buffer.from(decodeURIComponent(m[3])).toString("base64");
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  }
  try {
    const r = await fetch(img);
    if (!r.ok) return null;
    const ct = (r.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    const buf = Buffer.from(await r.arrayBuffer());
    return { type: "image", source: { type: "base64", media_type: ct, data: buf.toString("base64") } };
  } catch { return null; }
}

// Enum allineati a src/utils/foundryMap.js e MarketAdmin (ITEM_TYPES / RARITIES).
const ITEM_TYPES = ["Arma", "Armatura", "Accessori", "Artefatto Magico", "Pozioni", "Pergamene", "Reagenti", "Varie"];
const RARITIES = ["Comune", "Non comune", "Rara", "Molto rara", "Leggendaria", "Artefatto"];
const FOUNDRY_TYPES = ["weapon", "equipment", "consumable", "loot", "tool"];
const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "acid", "poison", "necrotic", "radiant", "psychic", "force"];
const ACTION_TYPES = ["", "mwak", "rwak", "msak", "rsak", "save"];
const WEAPON_PROPS = ["fin", "ver", "two", "thr", "lgt", "hvy", "rch", "amm", "mgc"];
const ARMOR_TYPES = ["", "light", "medium", "heavy", "shield"];
const ABILITIES = ["", "str", "dex", "con", "int", "wis", "cha"];

const TOOL = {
  name: "crea_oggetto",
  description: "Registra l'oggetto magico progettato con tutti i suoi dati (scheda + combattimento Foundry).",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome evocativo in ITALIANO, 2-4 parole, senza virgolette." },
      type: { type: "string", enum: ITEM_TYPES, description: "Categoria dell'oggetto." },
      class: { type: "string", enum: RARITIES, description: "Rarità." },
      description: {
        type: "string",
        description:
          "HTML: un <p><em>…</em></p> di descrizione estetica, poi da 1 a 3 <p><strong>Proprietà Speciale:</strong> …</p> con effetti D&D 5e coerenti con la rarità. SOLO i tag <p>, <em>, <strong>. In italiano. Niente titolo col nome.",
      },
      startingBid: { type: "integer", description: "Prezzo base d'asta in Corone, entro il range della rarità." },
      foundry: {
        type: "object",
        description: "Dati di combattimento per l'import su Foundry (dnd5e).",
        properties: {
          foundryType: { type: "string", enum: FOUNDRY_TYPES, description: "weapon per armi, equipment per armature/accessori, consumable per pozioni/pergamene, loot per il resto." },
          actionType: { type: "string", enum: ACTION_TYPES, description: "mwak mischia, rwak distanza, save solo TS; vuoto se passivo." },
          damageFormula: { type: "string", description: "Es. '1d8+1'. Vuoto se non infligge danni." },
          damageType: { type: "string", enum: DAMAGE_TYPES },
          damage2Formula: { type: "string", description: "Danno extra opzionale, es. '1d6'. Vuoto se assente." },
          damage2Type: { type: "string", enum: ["", ...DAMAGE_TYPES] },
          versatileFormula: { type: "string", description: "Danno a due mani per armi versatili, es. '1d10'. Vuoto se non versatile." },
          attackBonus: { type: "integer", description: "Bonus magico al colpire (0 se nessuno)." },
          properties: { type: "array", items: { type: "string", enum: WEAPON_PROPS }, description: "Proprietà d'arma (solo per le armi)." },
          armorType: { type: "string", enum: ARMOR_TYPES, description: "Solo per equipment/armature." },
          armorValue: { type: "integer", description: "Valore di CA per armature/scudi (0 se non pertinente)." },
          saveAbility: { type: "string", enum: ABILITIES, description: "Caratteristica del TS imposto, se presente." },
          saveDC: { type: "integer", description: "CD del tiro salvezza (0 se nessuno)." },
          weight: { type: "number", description: "Peso in lb." },
          quantity: { type: "integer", description: "Quantità (default 1)." },
          proficient: { type: "boolean", description: "Competenza (default true per le armi)." },
        },
        required: ["foundryType"],
      },
    },
    required: ["name", "type", "class", "description", "startingBid", "foundry"],
  },
};

const buildUserText = ({ prompt, img, rarita, tipoOggetto, mode }) => {
  const richiesta = [
    `Progetta UN oggetto per il Mercato Nero della campagna dark fantasy "Eldoria" (D&D 5e) a partire da questa richiesta del master:`,
    `"${String(prompt || "").trim()}"`,
    img ? "Osserva ANCHE l'immagine allegata e rendi i dati coerenti con ciò che si vede." : "",
  ];

  if (mode === "gdr") {
    // Oggetto SOLO da gioco di ruolo: simpatico e di colore, INUTILE in
    // combattimento, di valore basso. Nessun dato di combattimento.
    return [
      ...richiesta,
      tipoOggetto ? `Categoria desiderata: ${tipoOggetto}.` : "Scegli una categoria adatta (di solito \"Varie\" o \"Accessori\").",
      "",
      "Questo è un OGGETTO DA GIOCO DI RUOLO: simpatico, di colore, con un mix di UTILITÀ fuori dal combattimento e un tocco DIVERTENTE/bizzarro. NON deve essere utile in battaglia.",
      "REGOLE FERREE:",
      "- Rarità: \"Comune\" o al massimo \"Non comune\". VALORE BASSO: prezzo base tra 3 e 25 Corone.",
      "- NESSUN dato di combattimento: foundryType='loot', damageFormula='', armorValue=0, saveDC=0, properties=[], actionType=''. Niente danni, CA, TS, iniziativa.",
      "- Descrizione in HTML, SOLO tag <p>,<em>,<strong>, in italiano:",
      "  1) <p><em>…</em></p> descrizione estetica e atmosfera, con un tocco d'ironia (2-4 frasi).",
      "  2) <p><strong>Utilità da Gioco:</strong> …</p> a cosa serve FUORI dal combattimento (scena sociale, esplorazione, indagine, intrattenimento, comodità). Al massimo vantaggio occasionale a una prova di abilità, MAI bonus in battaglia.",
      "  3) opzionale <p><strong>Stranezza:</strong> …</p> un difetto buffo o effetto collaterale comico.",
      "Rispondi SOLO usando lo strumento crea_oggetto.",
    ].filter(Boolean).join("\n");
  }

  // Oggetto NORMALE (default): utile in combattimento, dati Foundry completi.
  return [
    ...richiesta,
    rarita ? `Rarità desiderata: ${rarita}.` : "Scegli tu una rarità adeguata all'oggetto.",
    tipoOggetto ? `Categoria desiderata: ${tipoOggetto}.` : "Scegli tu la categoria più adatta.",
    "",
    "Calibra la POTENZA sulla rarità. Prezzo base indicativo (Corone): Comune 5–15, Non comune 20–50, Rara 60–120, Molto rara 150–280, Leggendaria 350–600, Artefatto 800+.",
    "Per le ARMI compila damageFormula/damageType (ed eventuali danni extra/versatile) e le proprietà; imposta foundryType='weapon' e actionType coerente.",
    "Per le ARMATURE/scudi imposta foundryType='equipment', armorType e armorValue (CA). Per pozioni/pergamene usa foundryType='consumable'. Per il resto 'loot'.",
    "Lascia VUOTI (\"\") o a 0 i campi non pertinenti al tipo scelto.",
    "Rispondi SOLO usando lo strumento crea_oggetto.",
  ].filter(Boolean).join("\n");
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const { prompt, img, rarita, tipoOggetto, mode } = req.body || {};
  const isGdr = mode === "gdr";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Chiave Anthropic mancante." });
  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "Serve un prompt che descriva l'oggetto." });

  try {
    const imageBlock = await fetchImageAsBlock(img);
    const content = [];
    if (imageBlock) content.push(imageBlock);
    content.push({ type: "text", text: buildUserText({ prompt, img: !!imageBlock, rarita, tipoOggetto, mode }) });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "crea_oggetto" },
        messages: [{ role: "user", content }],
      }),
    });

    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const toolBlock = (data.content || []).find((b) => b.type === "tool_use" && b.name === "crea_oggetto");
    if (!toolBlock?.input) return res.status(500).json({ error: "Nessun oggetto generato." });

    const o = toolBlock.input;
    // Normalizza/ripulisci contro gli enum, con default sicuri.
    const f = o.foundry || {};
    const pick = (val, list, dflt) => (list.includes(val) ? val : dflt);
    const oggetto = {
      name: String(o.name || "").trim(),
      type: pick(o.type, ITEM_TYPES, "Arma"),
      class: pick(o.class, RARITIES, "Comune"),
      description: String(o.description || "").replace(/```html|```/g, "").trim(),
      startingBid: Math.max(0, Math.round(Number(o.startingBid) || 0)),
      foundry: {
        foundryType: pick(f.foundryType, FOUNDRY_TYPES, "loot"),
        actionType: pick(f.actionType, ACTION_TYPES, ""),
        damageFormula: String(f.damageFormula || "").trim(),
        damageType: pick(f.damageType, DAMAGE_TYPES, "slashing"),
        damage2Formula: String(f.damage2Formula || "").trim(),
        damage2Type: pick(f.damage2Type, ["", ...DAMAGE_TYPES], ""),
        versatileFormula: String(f.versatileFormula || "").trim(),
        attackBonus: Number.isFinite(Number(f.attackBonus)) ? Number(f.attackBonus) : "",
        properties: Array.isArray(f.properties) ? f.properties.filter((p) => WEAPON_PROPS.includes(p)) : [],
        armorType: pick(f.armorType, ARMOR_TYPES, ""),
        armorValue: Number.isFinite(Number(f.armorValue)) && Number(f.armorValue) > 0 ? Number(f.armorValue) : "",
        saveAbility: pick(f.saveAbility, ABILITIES, ""),
        saveDC: Number.isFinite(Number(f.saveDC)) && Number(f.saveDC) > 0 ? Number(f.saveDC) : "",
        weight: Number.isFinite(Number(f.weight)) ? Number(f.weight) : "",
        quantity: Number.isFinite(Number(f.quantity)) && Number(f.quantity) > 0 ? Number(f.quantity) : 1,
        proficient: f.proficient !== false,
      },
    };

    // Modalità GdR: garantiamo comunque niente combattimento e valore basso,
    // anche se il modello avesse sbordato.
    if (isGdr) {
      oggetto.class = RARITIES.includes(oggetto.class) && ["Comune", "Non comune"].includes(oggetto.class) ? oggetto.class : "Comune";
      oggetto.startingBid = Math.min(oggetto.startingBid || 0, 25) || 5;
      oggetto.foundry = {
        ...oggetto.foundry,
        foundryType: "loot",
        actionType: "",
        damageFormula: "", damageType: "slashing",
        damage2Formula: "", damage2Type: "",
        versatileFormula: "", attackBonus: "",
        properties: [], armorType: "", armorValue: "",
        saveAbility: "", saveDC: "",
      };
    }

    return res.status(200).json({ oggetto });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
