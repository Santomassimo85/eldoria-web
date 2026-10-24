// World Boss: effetti a TURNI e RESISTENZE (2026-10-24). Solo calcoli, niente Firestore.
//
// Durata: i "+CA", "vantaggio" e "svantaggio" delle azioni di boss/minion durano
// `durationTurns` turni (scelti nell'editor dell'admin). Il turno è `turnNumber` del
// turn_tracker, che sale di 1 a ogni turno degli eroi: un effetto preso al turno T con
// durata D vale finché turnNumber <= T + D (D turni degli eroi + i turni del boss in mezzo).
//   · CA: `acBuffs = [{bonus, untilTurn, source}]` sul nemico; `ac` resta la CA base
//     (quella che il Master alza/abbassa a mano). CA vera = enemyAc(e, turn).
//   · Vantaggio/svantaggio: `nextTurnCondition` + `condUntilTurn`. Senza `condUntilTurn`
//     è il vecchio effetto "sul prossimo tiro" (si consuma); con, dura e non si consuma.
//     Chi mette un effetto da un tiro solo scrive anche ONE_SHOT, così non eredita la scadenza.
// Copia lato server in functions/worldBossAuto.js: tenerle allineate.

export const EFFECT_TURNS_DEFAULT = 2;
export const EFFECT_TURNS_MAX = 10;
export const effectTurns = (action) =>
  Math.max(1, Math.min(EFFECT_TURNS_MAX, parseInt(action?.durationTurns) || EFFECT_TURNS_DEFAULT));

export const ONE_SHOT = { condUntilTurn: null };

// Condizione attiva (advantage/disadvantage) o null se assente/scaduta.
export function activeCond(e, turn) {
  const c = e?.nextTurnCondition;
  if (c !== "advantage" && c !== "disadvantage") return null;
  if (e.condUntilTurn != null && Number(turn) > Number(e.condUntilTurn)) return null;
  return c;
}
// Turni rimasti di una condizione a durata (null = da un tiro solo).
export function condTurnsLeft(e, turn) {
  if (!activeCond(e, turn) || e.condUntilTurn == null) return null;
  return Number(e.condUntilTurn) - Number(turn) + 1;
}
// Cosa scrivere dopo aver usato la condizione: null = dura ancora, non si tocca.
export function condConsumePatch(e) {
  return e?.condUntilTurn != null ? null : { nextTurnCondition: null, debuffSource: null };
}
export function lastingCondPatch(cond, turn, turns, source = null) {
  return { nextTurnCondition: cond, condUntilTurn: Number(turn || 1) + turns, debuffSource: source };
}

export const activeAcBuffs = (e, turn) =>
  (Array.isArray(e?.acBuffs) ? e.acBuffs : []).filter((b) => b && Number(turn) <= Number(b.untilTurn));
export const acBuffTotal = (e, turn) => activeAcBuffs(e, turn).reduce((s, b) => s + (parseInt(b.bonus) || 0), 0);
export const enemyAc = (e, turn) => (parseInt(e?.ac) || 10) + acBuffTotal(e, turn);
export const addAcBuffPatch = (e, turn, bonus, turns, source) => ({
  acBuffs: [...activeAcBuffs(e, turn), { bonus, untilTurn: Number(turn || 1) + turns, source: source || null }],
});

// ── Tipi di danno D&D e resistenze ─────────────────────────────────────────
export const DAMAGE_TYPES = [
  { key: "slashing",    icon: "🗡", label: "Tagliente" },
  { key: "piercing",    icon: "🏹", label: "Perforante" },
  { key: "bludgeoning", icon: "🔨", label: "Contundente" },
  { key: "fire",        icon: "🔥", label: "Fuoco" },
  { key: "cold",        icon: "❄", label: "Freddo" },
  { key: "lightning",   icon: "⚡", label: "Fulmine" },
  { key: "thunder",     icon: "🔊", label: "Tuono" },
  { key: "acid",        icon: "🧪", label: "Acido" },
  { key: "poison",      icon: "☠", label: "Veleno" },
  { key: "necrotic",    icon: "🌑", label: "Necrotico" },
  { key: "radiant",     icon: "✨", label: "Radioso" },
  { key: "force",       icon: "💫", label: "Forza" },
  { key: "psychic",     icon: "🧠", label: "Psichico" },
];
export const DAMAGE_TYPE_KEYS = DAMAGE_TYPES.map((d) => d.key);
export const damageTypeLabel = (k) => {
  const d = DAMAGE_TYPES.find((x) => x.key === k);
  return d ? `${d.icon} ${d.label}` : k === "physical" ? "⚔ Fisico" : k;
};
const PHYSICAL = ["slashing", "piercing", "bludgeoning"];

// Parola del tipo di danno (inglese SRD o italiano) → chiave.
const WORDS = [
  [/^(slashing|taglient\w*)$/, "slashing"], [/^(piercing|perforant\w*)$/, "piercing"],
  [/^(bludgeoning|contundent\w*)$/, "bludgeoning"], [/^(fire|fuoco)$/, "fire"],
  [/^(cold|freddo|gelo|ghiaccio)$/, "cold"], [/^(lightning|fulmine|elettric\w*)$/, "lightning"],
  [/^(thunder|tuono)$/, "thunder"], [/^(acid|acido|acidi)$/, "acid"], [/^(poison|veleno)$/, "poison"],
  [/^(necrotic|necrotic[io])$/, "necrotic"], [/^(radiant|radios[io]|sacro)$/, "radiant"],
  [/^(force|forza)$/, "force"], [/^(psychic|psichic[io])$/, "psychic"],
];
const wordType = (w) => { for (const [re, k] of WORDS) if (re.test(w)) return k; return null; };

// Tipo dell'editor boss/minion (dmgType italiano).
const DMGTYPE_KEY = { fuoco: "fire", ghiaccio: "cold", fulmine: "lightning", veleno: "poison", "oscurità": "necrotic", oscurita: "necrotic", sacro: "radiant", arcano: "force", fisico: "physical" };

const plain = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();

// Tipo di danno di un'azione (attacco/incantesimo di un PG o di un nemico).
// "physical" = fisico ma non si sa quale dei tre.
export function damageTypeFor(action) {
  if (!action) return "physical";
  const explicit = String(action.dmgType || "").toLowerCase().trim();
  if (DMGTYPE_KEY[explicit]) return DMGTYPE_KEY[explicit];
  if (DAMAGE_TYPE_KEYS.includes(explicit)) return explicit;
  const desc = plain(action.description);
  const m = desc.match(/\b(?:\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(?:extra\s+)?([a-z]+)\s+damage\b/) || desc.match(/\b([a-z]+)\s+damage\b/);
  const it = desc.match(/danni\s+(?:da\s+|di\s+)?([a-zàèéìòù]+)/);
  for (const x of [m, it]) { const k = x && wordType(x[1]); if (k) return k; }
  const name = plain(action.name);
  // armi: prima le perforanti col nome di una spada, poi le altre
  if (/spada corta|shortsword|short sword|rapier|stocco|striscia|morning ?star|morningstar/.test(name)) return "piercing";
  if (/spada|sword|ascia|\baxe\b|scimitar|falcione|glaive|alabarda|halberd|falce|sickle|scythe|frusta|whip|katana|sciabola|artigli|claw/.test(name)) return "slashing";
  if (/pugnale|dagger|lancia|spear|\barco\b|\bbow\b|longbow|shortbow|balestra|crossbow|dardo|dart|tridente|trident|picca|\bpike\b|giavellotto|javelin|piccone|\bpick\b|frecci|arrow|morso|bite|zanna|fang/.test(name)) return "piercing";
  if (/martello|hammer|mazza|\bmace\b|\bclub\b|randello|bastone|staff|flagello|flail|\bmaul\b|pugno|unarmed|senz.armi|fionda|sling|calcio|testata|ram\b/.test(name)) return "bludgeoning";
  if (/fuoco|fiamm|\bfire\b|brucia|burning|scorching|flam(e|ing)|rovente|infern|ardent/.test(name)) return "fire";
  if (/ghiacc|\bgelo\b|\bice\b|freddo|\bfrost\b|cold|gelid|chill/.test(name)) return "cold";
  if (/tuono|thunder|shatter|frantum/.test(name)) return "thunder";
  if (/fulmin|lightning|elettr|shock|scossa|saetta|storm|tempesta|spark|witch bolt/.test(name)) return "lightning";
  if (/acid|corros|caustic/.test(name)) return "acid";
  if (/veleno|poison|tossic|toxic/.test(name)) return "poison";
  if (/necro|oscur|tenebr|ombra|dark|toll the dead|inflict|vampir|wither/.test(name)) return "necrotic";
  if (/sacr|radian|\bluce\b|divin|holy|smite|guiding bolt|sacred|celest|punizion|moonbeam|sunbeam|sunburst/.test(name)) return "radiant";
  if (/psich|psychic|mente|mind|dissonan|vicious mockery|beffa/.test(name)) return "psychic";
  if (/forza|force|eldritch|deflagraz|dardo incantato|magic missile|arcan/.test(name)) return "force";
  return "physical";
}

const listOf = (e, key) => (Array.isArray(e?.[key]) ? e[key] : []);
// "physical" generico vale solo se la lista ha tutti e tre i tipi fisici.
const inList = (list, dtype) => dtype === "physical" ? PHYSICAL.every((k) => list.includes(k)) : list.includes(dtype);

export function resistOf(enemy, dtype) {
  if (inList(listOf(enemy, "immunities"), dtype)) return "immune";
  if (inList(listOf(enemy, "resistances"), dtype)) return "resist";
  if (inList(listOf(enemy, "vulnerabilities"), dtype)) return "vuln";
  return null;
}
export const hasDefenses = (e) => ["immunities", "resistances", "vulnerabilities"].some((k) => listOf(e, k).length > 0);

// Danno dopo resistenze/immunità/vulnerabilità del nemico, con la nota per la chat.
export function applyResist(enemy, dtype, dmg) {
  const r = resistOf(enemy, dtype);
  const lbl = damageTypeLabel(dtype);
  if (r === "immune") return { dmg: 0, note: ` 🚫 immune a ${lbl}`, r };
  if (r === "resist") return { dmg: Math.floor(dmg / 2), note: ` 🛡 resiste a ${lbl} (metà)`, r };
  if (r === "vuln") return { dmg: dmg * 2, note: ` 💥 vulnerabile a ${lbl} (×2)`, r };
  return { dmg, note: "", r: null };
}
