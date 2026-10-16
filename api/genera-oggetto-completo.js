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

import { paroleVietate, violazioniNome, troppoSimile, tiraDadiNome, istruzioniNome } from "../src/data/marketIdeas.js";

export const config = { maxDuration: 60 };

const callClaude = async (apiKey, body) => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  return r.json();
};

const pulisciNome = (t) => String(t || "").trim().split("\n")[0].replace(/^["'«»*]+|["'«».*]+$/g, "").trim();

// Il nome uscito usa parole vietate o copia un nome esistente? Lo rifà Haiku,
// con un'altra forma tirata ai dadi (max 2 tentativi; se fallisce tiene l'ultimo).
async function rinominaSeServe(apiKey, oggetto, { vietate, nomiEsistenti, prompt }) {
  let nome = oggetto.name;
  for (let i = 0; i < 2; i++) {
    const colpe = violazioniNome(nome, vietate);
    if (!colpe.length && !troppoSimile(nome, nomiEsistenti)) return nome;
    const testo = [
      `Dai un NUOVO nome, in italiano, a questo oggetto di un mercato nero fantasy.`,
      `Richiesta del master: "${prompt}". Categoria: ${oggetto.type}. Rarità: ${oggetto.class}.`,
      `Scheda: ${String(oggetto.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600)}`,
      `Il nome proposto "${nome}" NON va bene${colpe.length ? ` (usa parole vietate: ${colpe.join(", ")})` : " (esiste già)"}.`,
      istruzioniNome({ dadi: tiraDadiNome(), vietate, nomiEsistenti }),
      `Rispondi SOLO con il nome, senza virgolette né punto finale.`,
    ].join("\n");
    const d = await callClaude(apiKey, { model: "claude-haiku-4-5", max_tokens: 60, temperature: 1, messages: [{ role: "user", content: testo }] });
    const nuovo = pulisciNome((d.content || []).map((b) => b.text || "").join(""));
    if (nuovo) nome = nuovo;
  }
  return nome;
}

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
      name: { type: "string", description: "Nome in ITALIANO, nella FORMA indicata dalle regole del NOME nel messaggio, senza virgolette." },
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

// ── SET ──────────────────────────────────────────────────────────────
// I bonus di un set valgono per QUANTI pezzi diversi del set si portano, e sono
// gli stessi per tutti i pezzi: si scrivono una volta per il set intero.
const BONUS_RULES = [
  "REGOLE DEI BONUS DEL SET:",
  "- Si attivano portando QUEL NUMERO di pezzi diversi del set; sono gli stessi per ogni pezzo (contano solo quanti pezzi hai).",
  "- Una soglia da 2 pezzi in su, fino al set completo (es. set da 3: 2 e 3; da 4: 2, 3, 4; da 5: 2, 3, 5 oppure 2, 4, 5). Mai una soglia da 1.",
  "- Crescono con le soglie: quella del set completo è la più forte e la più caratteristica.",
  "- Effetti D&D 5e brevi e concreti, in italiano, al massimo ~90 caratteri ciascuno. Esempi di forma: \"CA +1\", \"Resistenza ai danni da freddo\", \"+1 ai TS su Saggezza\", \"+1d4 danni necrotici con le armi\", \"1 volta per riposo lungo: Passo Nebbioso\".",
  "- Calibrati sulla rarità dei pezzi; niente bonus che rompono il gioco (niente CA +3, immunità a tutto, PF infiniti).",
  "- Coerenti col tema e col nome del set.",
].join("\n");

const SET_PROP = {
  type: "object",
  description: "Il SET inventato di cui questo oggetto è il primo pezzo.",
  properties: {
    name: { type: "string", description: "Nome del set in italiano, es. \"Set del Pellegrino Cinereo\" o \"Paramenti della Marea Spenta\"." },
    size: { type: "integer", description: "Pezzi totali del set (da 3 a 5, salvo indicazioni del master)." },
    bonuses: {
      type: "array",
      description: "Bonus per soglia di pezzi posseduti.",
      items: {
        type: "object",
        properties: {
          pieces: { type: "integer", description: "Pezzi diversi del set necessari (≥ 2)." },
          effect: { type: "string", description: "Effetto breve, in italiano." },
        },
        required: ["pieces", "effect"],
      },
    },
  },
  required: ["name", "size", "bonuses"],
};

const BONUS_TOOL = {
  name: "bonus_set",
  description: "Registra i bonus per soglia di un set di oggetti.",
  input_schema: {
    type: "object",
    properties: { bonuses: SET_PROP.properties.bonuses },
    required: ["bonuses"],
  },
};

// Ripulisce i bonus: soglie intere fra 2 e il totale, una per soglia, in ordine.
const cleanBonuses = (list, size) => {
  const bySoglia = new Map();
  for (const b of Array.isArray(list) ? list : []) {
    const pieces = Math.max(2, Math.min(size, Math.round(Number(b?.pieces) || 0)));
    const effect = String(b?.effect || "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!effect) continue;
    bySoglia.set(pieces, bySoglia.has(pieces) ? `${bySoglia.get(pieces)} · ${effect}` : effect);
  }
  return [...bySoglia.entries()].sort((a, b) => a[0] - b[0]).map(([pieces, effect]) => ({ pieces, effect }));
};

const clampSize = (n, dflt = 4) => Math.max(2, Math.min(12, Math.round(Number(n) || dflt)));

const pezziTesto = (pieces) => (Array.isArray(pieces) ? pieces : [])
  .slice(0, 20)
  .map((p) => `- ${String(p?.name || "").trim()}${p?.type ? ` (${p.type}${p.class ? `, ${p.class}` : ""})` : ""}`)
  .filter((r) => r.length > 3)
  .join("\n");

const bonusTesto = (bonuses, size) => (Array.isArray(bonuses) ? bonuses : [])
  .filter((b) => String(b?.effect || "").trim())
  .map((b) => `- ${b.pieces}/${size}: ${String(b.effect).trim()}`)
  .join("\n");

// Pezzo di un set esistente o primo pezzo di un set nuovo: righe da aggiungere al prompt.
const setText = (set, setEsistenti) => {
  if (!set || !set.mode) return [];
  if (set.mode === "esistente") {
    const size = clampSize(set.size, 5);
    const pz = pezziTesto(set.pieces);
    const bn = bonusTesto(set.bonuses, size);
    return [
      `QUESTO OGGETTO È UN NUOVO PEZZO del set «${String(set.name || "").trim()}» (${size} pezzi in tutto).`,
      pz ? `Pezzi già forgiati:\n${pz}` : "È il primo pezzo forgiato di questo set.",
      bn ? `Bonus del set (già decisi, NON cambiarli e NON ripeterli nella descrizione):\n${bn}` : "",
      "Deve essere un pezzo DIVERSO da quelli già forgiati (un altro slot: elmo, guanti, stivali, mantello, anello, amuleto, arma, scudo…) e riconoscibile come parte dello stesso set: stessi materiali, stesso motivo, stessa origine. Il nome può richiamare il set.",
      "Le Proprietà Speciali nella descrizione sono SOLO dell'oggetto; i bonus del set stanno a parte.",
      "",
    ].filter(Boolean);
  }
  const esist = (Array.isArray(setEsistenti) ? setEsistenti : []).map((n) => String(n || "").trim()).filter(Boolean).slice(0, 60);
  return [
    "INVENTA ANCHE UN SET: questo oggetto è il PRIMO PEZZO di un set nuovo. Compila il campo \"set\" dello strumento con nome, pezzi totali e bonus per soglia.",
    set.size ? `Pezzi totali del set: ${clampSize(set.size)} (deciso dal master).` : "Pezzi totali: scegli tu fra 3 e 5.",
    set.idea ? `Idea del master per il set: "${String(set.idea).trim().slice(0, 400)}".` : "",
    esist.length ? `Set che esistono già (il nome deve essere DIVERSO): ${esist.join(", ")}.` : "",
    BONUS_RULES,
    "Le Proprietà Speciali nella descrizione sono SOLO dell'oggetto; i bonus del set stanno nel campo \"set\", non ripeterli nella descrizione.",
    "",
  ].filter(Boolean);
};

// Solo i bonus di un set (bottone "✨ Genera bonus" nella scheda Crea a mano).
async function generaBonusSet(apiKey, { set }) {
  const size = clampSize(set?.size, 5);
  const name = String(set?.name || "").trim();
  const pz = pezziTesto(set?.pieces);
  const testo = [
    `Scrivi i BONUS DI SET per il set «${name || "senza nome"}» della campagna dark fantasy "Eldoria" (D&D 5e), ${size} pezzi in tutto.`,
    pz ? `Pezzi del set (fra cui quello che il master sta creando):\n${pz}` : "",
    set?.description ? `Il pezzo che il master sta creando: ${String(set.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 700)}` : "",
    set?.idea ? `Indicazioni del master: "${String(set.idea).trim().slice(0, 400)}".` : "",
    set?.current?.length ? `Bonus attuali (rifalli diversi, a meno che il master non dica altro):\n${bonusTesto(set.current, size)}` : "",
    "",
    BONUS_RULES,
    "Rispondi SOLO usando lo strumento bonus_set.",
  ].filter(Boolean).join("\n");
  const data = await callClaude(apiKey, {
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    temperature: 1,
    tools: [BONUS_TOOL],
    tool_choice: { type: "tool", name: "bonus_set" },
    messages: [{ role: "user", content: testo }],
  });
  if (data.error) throw new Error(data.error.message);
  const tb = (data.content || []).find((b) => b.type === "tool_use" && b.name === "bonus_set");
  const bonuses = cleanBonuses(tb?.input?.bonuses, size);
  if (!bonuses.length) throw new Error("Nessun bonus generato.");
  return bonuses;
}

const buildUserText = ({ prompt, img, rarita, tipoOggetto, mode, nomeRegole, vietate, set, setEsistenti }) => {
  const richiesta = [
    `Progetta UN oggetto per il Mercato Nero della campagna dark fantasy "Eldoria" (D&D 5e) a partire da questa richiesta del master:`,
    `"${String(prompt || "").trim()}"`,
    img ? "Osserva ANCHE l'immagine allegata e rendi i dati coerenti con ciò che si vede." : "",
    "",
    nomeRegole,
    `Anche nella DESCRIZIONE evita le parole vietate (${vietate.radici.map((r) => r.label).join(", ")}) e i cliché: niente draghi, rune o abissi se il master non li chiede.`,
    "",
    ...setText(set, setEsistenti),
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

  const { prompt, img, rarita, tipoOggetto, mode, azione, setEsistenti } = req.body || {};
  const set = req.body?.set && ["nuovo", "esistente"].includes(req.body.set.mode) ? req.body.set : null;
  const nomiEsistenti = (Array.isArray(req.body?.nomiEsistenti) ? req.body.nomiEsistenti : [])
    .map((n) => String(n || "").trim()).filter(Boolean).slice(-150);
  const isGdr = mode === "gdr";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Chiave Anthropic mancante." });

  // Solo i bonus di un set (stesso endpoint: niente funzioni Vercel in più).
  if (azione === "bonusSet") {
    try {
      return res.status(200).json({ bonuses: await generaBonusSet(apiKey, req.body || {}) });
    } catch (e) {
      return res.status(500).json({ error: "Bonus non generati: " + e.message });
    }
  }

  if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "Serve un prompt che descriva l'oggetto." });

  try {
    const imageBlock = await fetchImageAsBlock(img);
    const content = [];
    if (imageBlock) content.push(imageBlock);
    const vietate = paroleVietate(nomiEsistenti, prompt);
    const nomeRegole = istruzioniNome({ dadi: tiraDadiNome(), vietate, nomiEsistenti });
    content.push({ type: "text", text: buildUserText({ prompt, img: !!imageBlock, rarita, tipoOggetto, mode, nomeRegole, vietate, set, setEsistenti }) });

    // Set nuovo = lo strumento chiede anche il campo "set" (obbligatorio).
    const tool = set?.mode === "nuovo"
      ? { ...TOOL, input_schema: { ...TOOL.input_schema, properties: { ...TOOL.input_schema.properties, set: SET_PROP }, required: [...TOOL.input_schema.required, "set"] } }
      : TOOL;

    const data = await callClaude(apiKey, {
      model: "claude-sonnet-4-6",
      max_tokens: set?.mode === "nuovo" ? 2200 : 1500,
      temperature: 1,
      tools: [tool],
      tool_choice: { type: "tool", name: "crea_oggetto" },
      messages: [{ role: "user", content }],
    });
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

    try {
      oggetto.name = await rinominaSeServe(apiKey, oggetto, { vietate, nomiEsistenti, prompt });
    } catch { /* il nome originale resta */ }

    // Set inventato: nome, pezzi totali e bonus ripuliti.
    if (set?.mode === "nuovo" && o.set) {
      const size = set.size ? clampSize(set.size) : clampSize(o.set.size, 4);
      const nomeSet = String(o.set.name || "").replace(/^["'«»]+|["'«».]+$/g, "").trim();
      if (nomeSet) oggetto.set = { name: nomeSet, size, bonuses: cleanBonuses(o.set.bonuses, size) };
    }

    return res.status(200).json({ oggetto });
  } catch (e) {
    return res.status(500).json({ error: "Generazione fallita: " + e.message });
  }
}
