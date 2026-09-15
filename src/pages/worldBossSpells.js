// Riconoscimento delle azioni del World Boss: elemento (per l'effetto a schermo),
// forma dell'attacco (mischia / tiro / dardo magico / area), danno e tiro salvezza
// delle magie AD AREA. Le azioni dei PG arrivano dalla sync Foundry con
// {name, category, damage, bonus, description} (descrizione SRD in inglese o
// italiano); quelle di boss/minion dall'editor DM Admin con in più dmgType,
// aoeShape/aoeSize/saveAbility/halfOnSave. Solo testo: niente Firestore qui.

// ── Elemento ────────────────────────────────────────────────────────────────
export const ELEMENTS = ["fire", "frost", "lightning", "poison", "darkness", "radiant", "arcane", "physical"];

// Tipi di danno scelti nell'editor boss/minion (DM Admin → World Boss). Il `value`
// finisce in `dmgType` sull'azione e vince sul riconoscimento automatico; "" = auto.
export const DMG_TYPE_OPTIONS = [
  { value: "",          label: "Auto (dal nome)" },
  { value: "fuoco",     label: "🔥 Fuoco" },
  { value: "ghiaccio",  label: "❄ Ghiaccio" },
  { value: "fulmine",   label: "⚡ Fulmine" },
  { value: "veleno",    label: "☠ Veleno" },
  { value: "oscurità",  label: "🌑 Oscurità" },
  { value: "sacro",     label: "✨ Sacro" },
  { value: "fisico",    label: "⚔ Fisico" },
  { value: "arcano",    label: "🔮 Arcano" },
];

// Tipo di danno scelto nell'editor → elemento (valori italiani E chiavi inglesi legacy).
const DMGTYPE_ELEMENT = {
  fuoco: "fire", ghiaccio: "frost", fulmine: "lightning", veleno: "poison",
  "oscurità": "darkness", oscurita: "darkness", sacro: "radiant", fisico: "physical", arcano: "arcane",
  vuoto: "darkness",
  fire: "fire", frost: "frost", lightning: "lightning", poison: "poison",
  darkness: "darkness", radiant: "radiant", physical: "physical", arcane: "arcane",
};

// Parola del tipo di danno (SRD inglese / italiano) → elemento.
const DAMAGE_WORD_ELEMENT = [
  [/\b(fire|fuoco)\b/, "fire"],
  [/\b(cold|freddo|gelo)\b/, "frost"],
  [/\b(lightning|thunder|fulmine|tuono|elettric\w*)\b/, "lightning"],
  [/\b(acid|acido|poison|veleno)\b/, "poison"],
  [/\b(necrotic|necrotici|necrotico)\b/, "darkness"],
  [/\b(radiant|radiosi|radioso)\b/, "radiant"],
  [/\b(force|forza|psychic|psichici|psichico)\b/, "arcane"],
  [/\b(bludgeoning|piercing|slashing|contundenti|perforanti|taglienti)\b/, "physical"],
];

const plain = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();

// Elemento di un'azione. Ordine: dmgType esplicito → "N dado <tipo> damage" /
// "danni da <tipo>" nella descrizione → parole chiave nel nome → categoria.
export function elementFor(action) {
  if (!action) return "physical";
  const explicit = DMGTYPE_ELEMENT[String(action.dmgType || "").toLowerCase().trim()];
  if (explicit) return explicit;
  const desc = plain(action.description);
  // "takes 2d8 thunder damage" · "1d10 fire damage" · "danni da fuoco" · "danni necrotici"
  const en = desc.match(/\b(?:\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(?:extra\s+)?([a-z]+)\s+damage\b/) || desc.match(/\b([a-z]+)\s+damage\b/);
  const it = desc.match(/danni\s+(?:da\s+|di\s+)?([a-zàèéìòù]+)/);
  for (const m of [en, it]) {
    if (!m) continue;
    for (const [re, el] of DAMAGE_WORD_ELEMENT) if (re.test(m[1])) return el;
  }
  const name = plain(action.name);
  if (/fuoco|fiamm|\bfire\b|brucia|burning|scorching|flam(e|ing)|rovente|searing|infern/.test(name)) return "fire";
  if (/ghiacc|\bgelo\b|\bice\b|freddo|\bfrost\b|cold|gelid/.test(name)) return "frost";
  if (/fulmin|lightning|elettr|shock|scossa|saetta|tuono|thunder|storm|tempesta|spark|witch bolt/.test(name)) return "lightning";
  if (/veleno|poison|acid|tossic|toxic|caustic|corros/.test(name)) return "poison";
  if (/oscur|tenebr|ombra|dark|necro|toll the dead|chill touch|inflict|vampir|hex\b|wither/.test(name)) return "darkness";
  if (/sacr|radian|\bluce\b|divin|holy|smite|guiding bolt|sacred|celest|punizion|moonbeam|raggio di luna|sunbeam|sunburst/.test(name)) return "radiant";
  const cat = plain(action.category);
  if (/armi|arma|weapon/.test(cat)) return "physical";
  if (/trucchetto|livello|incantesim|spell|cantrip|magia/.test(cat)) return "arcane";
  return "physical";
}

// ── Forma dell'attacco (che animazione parte) ───────────────────────────────
const RANGED_WEAPON = /\b(arco|balestra|long ?bow|short ?bow|crossbow|fionda|sling|giavellotto|javelin|dardo|dart|pistol|musket|moschetto|fucile|rifle|gun|lancia da lancio|throwing|net)\b/;

// "slash" (mischia) · "arrow" (arma da tiro) · "bolt" (magia a bersaglio singolo)
// · "aoe" (magia ad area). Niente cure/buff qui: quelle le decide chi chiama.
export function attackShapeFor(action) {
  if (!action) return "slash";
  if (areaSpellFor(action)) return "aoe";
  const cat = plain(action.category);
  const name = plain(action.name);
  const isWeapon = /armi|arma|weapon/.test(cat);
  if (isWeapon) return RANGED_WEAPON.test(name) ? "arrow" : "slash";
  // Trucchetti "da mischia" (Shocking Grasp, Booming Blade…) restano un fendente.
  if (/shocking grasp|booming blade|green-flame blade|primal savagery|thorn whip|tocco|touch|grasp|artigli|morso|bite|claw|pugno|unarmed/.test(name)) return "slash";
  return "bolt";
}

// ── Danno ───────────────────────────────────────────────────────────────────
// Danno base (SRD) delle magie ad area più comuni: serve quando la sync Foundry
// ha salvato damage "0" e la descrizione è troncata prima della formula.
const AREA_DEFAULT_DMG = [
  [/burning hands|mani brucianti/, "3d6"],
  [/thunderwave|onda di tuono/, "2d8"],
  [/shatter|frantumare/, "3d8"],
  [/fireball|palla di fuoco/, "8d6"],
  [/lightning bolt|fulmine\b/, "8d6"],
  [/cone of cold|cono di freddo/, "8d8"],
  [/ice storm|tempesta di ghiaccio/, "2d8+4d6"],
  [/caustic brew/, "2d4"],
  [/flaming sphere|sfera infuocata/, "2d6"],
  [/moonbeam|raggio di luna/, "2d10"],
  [/spirit guardians|guardiani spirituali/, "3d8"],
  [/sleet storm/, "0"],
  [/cloud of daggers|nube di pugnali/, "4d4"],
];
// Formula del danno: quella salvata sull'azione, altrimenti la prima "NdM" della
// descrizione ("takes 2d8 thunder damage"), altrimenti la tabella SRD per le aree
// note, altrimenti il default richiesto.
export function damageFormulaFor(action, fallback = "1d6") {
  const saved = String(action?.damage || "").replace(/\s+/g, "");
  if (saved && saved !== "0") return saved;
  const m = plain(action?.description).match(/\b(\d+d\d+)(?:\s*\+\s*(\d+))?\b/);
  if (m) return m[2] ? `${m[1]}+${m[2]}` : m[1];
  const name = plain(action?.name);
  const known = AREA_DEFAULT_DMG.find(([re]) => re.test(name));
  if (known && known[1] !== "0") return known[1];
  return fallback;
}

// ── Magie ad AREA ───────────────────────────────────────────────────────────
// Ritorna {save, half, shape, label} se l'azione colpisce TUTTI i nemici, null se è a
// bersaglio singolo. Regole: campi dell'editor (aoeShape ≠ single) → nome nella
// tabella → descrizione con "cono/cubo/sfera/linea/cilindro di N piedi/metri" o
// "ogni creatura in/entro…". Le magie senza danno (Sonno, Nube di Nebbia…) NON
// sono attacchi ad area: restano fuori.
const SAVE_WORD = [
  [/dexterity|destrezza|\bdes\b|\bdex\b/, "dex"],
  [/constitution|costituzione|\bcos\b|\bcon\b/, "con"],
  [/wisdom|saggezza|\bsag\b|\bwis\b/, "wis"],
  [/strength|forza\b|\bfor\b|\bstr\b/, "str"],
  [/intelligence|intelligenza|\bint\b/, "int"],
  [/charisma|carisma|\bcar\b|\bcha\b/, "cha"],
];
const SHAPE_WORD = [
  [/\bcone\b|\bcono\b/, "cone"],
  [/\bcube\b|\bcubo\b/, "cube"],
  [/\bline\b|\blinea\b/, "line"],
  [/\bcylinder\b|\bcilindro\b/, "cylinder"],
  [/radius|sphere|sfera|raggio di \d+ (?:metri|piedi)|emanation|emanazione|aura/, "sphere"],
];
const AREA_NAMES = /thunderwave|onda di tuono|burning hands|mani brucianti|shatter|frantumare|fireball|palla di fuoco|cone of cold|cono di freddo|ice storm|tempesta di ghiaccio|lightning bolt|fulmine\b|caustic brew|color spray|spruzzo colorato|flaming sphere|sfera infuocata|moonbeam|raggio di luna|spirit guardians|guardiani spirituali|shatter|sleet storm|cloud of daggers|nube di pugnali|fire storm|meteor swarm|sunburst|circle of death|blade barrier|breath|soffio|nova|deflagraz|esplos|onda d.?urto/;
// Magie che citano un'area ma NON fanno danno a tutti: escluse a mano.
const NOT_AREA = /sleep|sonno|fog cloud|nube di nebbia|detect|individuazione|entangle|intrico|faerie fire|fuoco fatato|bless|benedizione|bane|sciagura|command|comando|silence|silenzio|darkness|oscurit|web|ragnatela|grease|unto|hypnotic|spike growth|shield of faith|aid|aiuto|heroism|eroismo|turn|scacciare|calm|calmare|zone of truth|healing|cura|guarigione|prayer|preghiera|mass /;

export function areaSpellFor(action) {
  if (!action) return null;
  const name = plain(action.name);
  const desc = plain(action.description);
  const text = `${name} ${desc}`;
  const cat = plain(action.category);
  // 1) campi dell'editor DM Admin (boss/minion): vincono su tutto
  if (action.aoeShape && action.aoeShape !== "single") {
    return {
      shape: action.aoeShape, save: action.saveAbility || "dex", half: action.halfOnSave !== false,
      label: `area · ${action.aoeShape}`,
    };
  }
  if (/armi|arma|weapon/.test(cat)) return null;                  // le armi non sono mai ad area
  if (NOT_AREA.test(name)) return null;
  // 2) nome noto  3) descrizione con forma + "ogni creatura"
  const byName = AREA_NAMES.test(name);
  const shapeHit = SHAPE_WORD.find(([re]) => re.test(desc));
  const everyone = /each creature|every creature|all creatures|ogni creatura|ciascuna creatura|tutte le creature|each target|ogni bersaglio/.test(desc);
  const footage = /\d+[- ](?:foot|feet|piedi|metri|metro)[- ]?(?:radius|cone|cube|line|cylinder|sphere|raggio|cono|cubo|linea|cilindro|sfera)/.test(desc)
    || /(?:cono|cubo|linea|sfera|cilindro|raggio)\s+(?:di|con)\s+\d+\s*(?:metri|piedi)/.test(desc);
  if (!byName && !(shapeHit && (everyone || footage))) return null;
  // Deve fare danno (formula sull'azione o nel testo), altrimenti è controllo, non attacco.
  if (damageFormulaFor(action, "") === "") return null;

  const shape = shapeHit ? shapeHit[1] : "sphere";
  let save = "dex";
  const saveHit = desc.match(/(dexterity|constitution|wisdom|strength|intelligence|charisma|destrezza|costituzione|saggezza|forza|intelligenza|carisma)\s+(?:saving throw|save)|tiro salvezza (?:su|di|sulla|sulla) (destrezza|costituzione|saggezza|forza|intelligenza|carisma)/);
  if (saveHit) {
    const w = saveHit[1] || saveHit[2];
    const f = SAVE_WORD.find(([re]) => re.test(w));
    if (f) save = f[1];
  }
  // Metà danni se superano il TS (Palla di Fuoco…); "must succeed … or take"
  // (Caustic Brew…) = niente danno a chi lo supera. Default: metà.
  const half = /half as much|half damage|metà (?:dei )?danni|la metà|dimezzat/.test(desc)
    ? true
    : /must succeed on|deve superare|no damage|nessun danno|niente danno/.test(desc) ? false : true;
  const SHAPE_IT = { cone: "cono", cube: "cubo", line: "linea", cylinder: "cilindro", sphere: "sfera" };
  return { shape, save, half, label: `area · ${SHAPE_IT[shape] || shape}`, text };
}

export const SAVE_LABEL_IT = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };

// ── Azione → {kind, el} per l'effetto a schermo ─────────────────────────────
// Una cura resta una cura anche con un tipo di danno assegnato. Il chiamante può
// forzare la forma (heal/buff/shield/debuff/aoe) passando `kind`.
export function pickEffectForAction(action, kind = null) {
  if (!action) return { kind: kind || "slash", el: "physical" };
  const name = plain(action.name);
  if (!kind && /(cura|cure|guari|heal|parola guaritrice|lay on hands|imposizione|ristora|goodberry|bacca)/.test(name)) return { kind: "heal", el: "radiant" };
  return { kind: kind || attackShapeFor(action), el: elementFor(action) };
}
