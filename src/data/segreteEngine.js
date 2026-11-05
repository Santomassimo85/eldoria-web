/* ============================================================
   LE SEGRETE · motore del combattimento (fase 3, 2026-11-04)
   PURO: niente Firebase. Lo esegue il SERVER (functions/segreteBundle.js,
   `npm run build:segrete`) con dadi crypto; il sito lo usa solo per i testi.
   Stato della partita = dungeon_runs/{roomId}:
     { type, bg, floor, floors, boss, status fight|cleared|won|lost, round,
       order: [id mostri], acted: {idEroe: true}, phaseAt, heroes: [c], foes: [c], log, seq }
   Turni a fasi: tutti gli eroi insieme (max AFK_MS), poi tutti i mostri.
   Combattente c = { id, side h|f, name, level, hp, maxHp, ac, init, save,
     fx: {ac:[{v,until}], adv, dis, dmg:{v,until}, rage, stun, dodge}, uses,
     (eroi) uid, cls, img; (mostri) actions WB, res/vul/imm, role, img… }
   Gli effetti a turni valgono finché `round < until`.
   ============================================================ */
import { battleItem, itemOf, itemTarget, DROP_CHANCE, FLOOR_COINS_DIE, rollDropItem } from "./segreteItems";
import { kitOf, heroActions, weaponMod, weaponChoices, heroMaxHp, HERO_HP_BASE, heroDc, heroHit, heroAc, heroStats, mainMod, profOf, cantripMult, attacksOf, levelOfXp, xpForLevel, MAX_STORY_LEVEL, DEFEND } from "./segreteKits";
import { sizeOf } from "./segrete";

export const LOG_MAX = 80;
export const AFK_MS = 5 * 60 * 1000; // 5 minuti per agire (2026-11-05, prima 10)

/* ── dadi ─────────────────────────────────────────────── */
let rnd = Math.random;
export function withRng(fn, body) { const prev = rnd; rnd = fn; try { return body(); } finally { rnd = prev; } }
const die = (s) => 1 + Math.floor(rnd() * s);
const d20 = () => die(20);
function parseDice(str) { const m = /^(\d+)d(\d+)$/.exec(String(str || "").trim()); return m ? [Number(m[1]), Number(m[2])] : [1, 6]; }
function roll(n, s) { let t = 0; const r = []; for (let i = 0; i < n; i++) { const v = die(s); r.push(v); t += v; } return { t, r }; }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/* ── tipi di danno dei mostri (editor del World Boss in italiano) ── */
const WB_DMG = { fuoco: "fire", ghiaccio: "cold", fulmine: "lightning", veleno: "poison", "oscurità": "necrotic", sacro: "radiant", fisico: "slashing", arcano: "force" };
export const DMG_IT = { slashing: "taglienti", piercing: "perforanti", bludgeoning: "contundenti", fire: "da fuoco", cold: "da freddo", lightning: "da fulmine", thunder: "da tuono", acid: "da acido", poison: "da veleno", necrotic: "necrotici", radiant: "radiosi", force: "da forza", psychic: "psichici" };
function wbDmgType(a) {
  if (WB_DMG[a.dmgType]) return WB_DMG[a.dmgType];
  const n = String(a.name || "").toLowerCase();
  if (/fuoc|fiamm|brac|lava|incend/.test(n)) return "fire";
  if (/gel|ghiacc|brin/.test(n)) return "cold";
  if (/fulmin|scoss|elettr/.test(n)) return "lightning";
  if (/velen|tossic/.test(n)) return "poison";
  if (/acid/.test(n)) return "acid";
  if (/necro|ombra|oscur|morte/.test(n)) return "necrotic";
  if (/sacr|luce|radios/.test(n)) return "radiant";
  if (/morso|artigl|zann|pugnal|frecc|lancia|dard/.test(n)) return "piercing";
  if (/mazz|pugno|clava|schiacc|martell|coda/.test(n)) return "bludgeoning";
  return "slashing";
}
const PHYS = ["slashing", "piercing", "bludgeoning"];

/* ── mostri di riserva (se il bestiario di quel dungeon è vuoto) ── */
const A = (name, diceNum, diceType, bonus, extra = {}) => ({ type: "attack", name, diceNum, diceType, bonus, hitMode: "hit", aoeShape: "single", ...extra });
export const FALLBACK_MONSTERS = [
  { id: "fb-goblin", name: "Goblin", icon: "👺", role: "minion", level: 1, hp: 9, ac: 13, init: 2, save: 0, actions: [A("Scimitarra", 1, "d6", 4), A("Arco Corto", 1, "d6", 4, { dmgType: "" })] },
  { id: "fb-scheletro", name: "Scheletro", icon: "💀", role: "minion", level: 1, hp: 13, ac: 13, init: 2, save: 0, vulnerabilities: ["bludgeoning"], immunities: ["poison"], actions: [A("Spada Corta", 1, "d6", 4)] },
  { id: "fb-ratto", name: "Ratto Gigante", icon: "🐀", role: "minion", level: 1, hp: 7, ac: 12, init: 2, save: 0, actions: [A("Morso", 1, "d4", 4, { dmgType: "veleno" })] },
  { id: "fb-orco", name: "Orco", icon: "👹", role: "elite", size: "large", level: 3, hp: 30, ac: 13, init: 1, save: 2, actions: [A("Ascia Bipenne", 1, "d12", 5), { type: "buff_adv", name: "Grido di Guerra", durationTurns: 2 }] },
  { id: "fb-cultista", name: "Cultista", icon: "🧟", role: "elite", level: 3, hp: 22, ac: 12, init: 1, save: 2, actions: [A("Dardo Necrotico", 2, "d6", 5, { dmgType: "oscurità" }), { type: "heal", name: "Patto Oscuro", diceNum: 2, diceType: "d6", bonus: 2 }] },
  { id: "fb-capo", name: "Capoguerra Orco", icon: "👑", role: "boss", level: 5, hp: 75, ac: 16, init: 2, save: 4, actions: [A("Ascia Spezzaossa", 2, "d10", 7), A("Turbine d'Acciaio", 2, "d8", 0, { hitMode: "save", aoeShape: "sphere", saveAbility: "dex", saveDC: 14, halfOnSave: true }), { type: "buff_ca", name: "Scudo di Ferro", acBonus: 2, durationTurns: 2 }] },
];

/* ── costruzione dei combattenti ─────────────────────── */
// m = { uid, name, cls, avatar, hero: characters.storyChars[cls] } (livello dai PE della scheda)
export function makeHero(m) {
  const hero = m.hero || {};
  const lv = levelOfXp(hero.xp);
  const st = heroStats(hero);
  const picks = Array.isArray(hero.picks) ? hero.picks : [];
  const maxHp = heroMaxHp(m.cls, lv, st, hero.hpRolls || []);
  // arma magica equipaggiata: vale solo se è di uno dei due tipi d'arma della classe
  const wItem = itemOf(hero.weaponItem);
  const okItem = wItem?.kind === "weapon" && weaponChoices(m.cls).some((w) => w.key === wItem.base);
  const weaponKey = okItem ? wItem.base : hero.weapon || null;
  const weaponPlus = okItem ? wItem.plus || 0 : 0;
  const uses = {};
  heroActions(m.cls, lv, picks, weaponKey, weaponPlus).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
  return {
    id: `h_${m.uid}`, side: "h", uid: m.uid, name: m.name, cls: m.cls, level: lv, img: m.avatar || "",
    hp: maxHp, maxHp, ac: heroAc(m.cls, st), init: st.dex || 0, save: Math.floor(profOf(lv) / 2), st, picks, weapon: weaponKey, weaponPlus,
    fx: {}, uses,
    // aiuto (2026-11-05): ha finito i dungeon di oggi/settimana con quella classe (o i 3 del giorno):
    // gioca per aiutare il gruppo ma non prende PE, monete, oggetti né Corone
    ...(m.helper ? { helper: true } : {}),
  };
}
/* PE alla vittoria: una fetta del salto verso il livello dopo (8% a sala + 12% il boss:
   con 3 sale ~36% → ~3 dungeon per livello, con 3 dungeon a settimana ~1 livello a settimana). */
export function xpGain(level, floors) {
  if (level >= MAX_STORY_LEVEL) return 0;
  // 2026-11-06: con 3 dungeon al giorno per classe i PE sono scesi di circa un terzo
  // (3 sale: 23% del salto invece del 36% → ~4–5 vittorie a livello invece di ~3)
  return Math.round((xpForLevel(level + 1) - xpForLevel(level)) * (0.05 * (floors || 3) + 0.08));
}
/* Il mostro si adatta al livello del gruppo (2026-11-04, simulato): più debole del
   gruppo = più PF e colpi più forti; più forte = un po' meno. Élite e boss
   crescono anche col numero di eroi; i gregari crescono di numero. */
export const ADAPT = { hpUp: 0.22, hpDown: 0.16, hpMin: 0.35, dmgPer: 0.55, hitPer: 0.36, bigBase: 0.3, bigPer: 0.55, multUp: 0.04, multDown: 0.12, multMin: 0.5, soloHp: 1.2, minionPer: 0.22 };
/* TETTI PER IL LIVELLO DEL GRUPPO (2026-11-04): un mostro del bestiario (anche un boss
   importato dal World Boss, pensato per tutto il server) non può superare quello che è
   giusto per eroi di quel livello. Valori "da D&D" per ruolo, crescono col livello del
   gruppo; i PF di élite e boss crescono anche col numero di eroi.
   hit = bonus al colpire massimo · dc = CD massima · dmg = danno medio massimo a colpo
   (le aree ×0,6) · hp = PF massimi (gregario per uno, élite/boss per gruppo da 1). */
export const CAPS = {
  minion: { hit: 3, dc: 11, dmg: 4, hp: 9, ac: 13, save: 1 },
  elite: { hit: 4, dc: 12, dmg: 6.5, hp: 18, ac: 14, save: 2 },
  boss: { hit: 5, dc: 13, dmg: 8, hp: 30, ac: 14, save: 3 },
  perLevel: { dmg: 0.32, hp: 0.42 },
};
export function capsFor(role, partyLv, partySize) {
  const c = CAPS[role] || CAPS.minion;
  const L = Math.max(1, partyLv);
  const prof = 2 + Math.floor((L - 1) / 4);
  const big = role === "minion" ? 1 : ADAPT.bigBase + ADAPT.bigPer * partySize;
  return {
    hit: c.hit + prof - 2,
    dc: c.dc + prof - 2,
    dmg: c.dmg * (1 + CAPS.perLevel.dmg * (L - 1)),
    ac: c.ac + Math.floor((L - 1) / 3),
    save: c.save + prof - 2,
    hp: Math.round(c.hp * (1 + CAPS.perLevel.hp * (L - 1)) * big),
  };
}
const avgDice = (n, sides) => (n * (sides + 1)) / 2;

function makeFoe(src, idx, partySize, suffix, partyLv = 1) {
  const diff = partyLv - (Number(src.level) || 1);
  const lvScale = diff >= 0 ? 1 + ADAPT.hpUp * diff : Math.max(ADAPT.hpMin, 1 + ADAPT.hpDown * diff);
  const scale = (src.role === "minion" ? 1 + ADAPT.minionPer * (partySize - 1) : ADAPT.bigBase + ADAPT.bigPer * partySize) * lvScale;
  const cap = capsFor(src.role || "minion", partyLv, partySize);
  const maxHp = Math.max(1, Math.min(cap.hp, Math.round((Number(src.hp) || 10) * scale)));
  return {
    id: `f${idx}`, side: "f", name: suffix ? `${src.name} ${suffix}` : src.name, src: src.id, role: src.role || "minion",
    level: Number(src.level) || 1, hp: maxHp, maxHp, ac: cap.ac, init: Number(src.init) || 0, save: cap.save,
    img: src.imageUrl || "", deadImg: src.deadImageUrl || "", icon: src.icon || "", facing: src.facing || "left", size: sizeOf(src),
    cap: { hit: cap.hit, dc: cap.dc, dmg: cap.dmg },
    adapt: { mult: diff >= 0 ? 1 + ADAPT.multUp * diff : Math.max(ADAPT.multMin, 1 + ADAPT.multDown * diff), dmg: Math.round(diff * ADAPT.dmgPer), hit: Math.round(diff * ADAPT.hitPer), ac: diff > 0 ? Math.floor(diff / 3) : Math.ceil(diff / 3) },
    actions: (src.actions || []).slice(0, 5), res: src.resistances || [], vul: src.vulnerabilities || [], imm: src.immunities || [],
    fx: {}, uses: {},
  };
}

/* Sala n (1-based): normale = gregari (e a volte un'élite), ultima = boss. */
export function buildEncounter(bestiary, { floor, floors, partyLevel, partySize }) {
  const boss = floor > floors;
  // `_anyBoss` = boss di altri dungeon (li passa il server): si usano solo se questo dungeon non ha un boss suo
  const own = bestiary.filter((m) => !m._anyBoss);
  const all = own.length ? own : FALLBACK_MONSTERS;
  const fit = (role, max, list = all) => {
    const of = list.filter((m) => (m.role || "minion") === role);
    const ok = of.filter((m) => (Number(m.level) || 1) <= max);
    return ok.length ? ok : of.length ? [of.reduce((a, b) => ((Number(a.level) || 1) <= (Number(b.level) || 1) ? a : b))] : [];
  };
  const picks = [];
  if (boss) {
    // SALA DEL BOSS (2026-11-05): sempre UN boss vero (mai un'élite al suo posto) e al massimo
    // 2 di scorta fra gregari ed élite: da soli 0–1, in 2 uno, in 3–4 due.
    let bosses = fit("boss", partyLevel + 3);
    if (!bosses.length) bosses = fit("boss", partyLevel + 3, bestiary.filter((m) => m._anyBoss));
    if (!bosses.length) bosses = FALLBACK_MONSTERS.filter((m) => m.role === "boss");
    picks.push(pick(bosses));
    let mins = fit("minion", partyLevel + 1);
    if (!mins.length) mins = FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    const elites = fit("elite", partyLevel + 1);
    const escort = partySize <= 1 ? (rnd() < 0.5 ? 1 : 0) : partySize === 2 ? 1 : 2;
    for (let i = 0; i < escort; i++) picks.push(elites.length && rnd() < 0.3 ? pick(elites) : pick(mins));
  } else {
    let mins = fit("minion", partyLevel + 1);
    const elites = fit("elite", partyLevel + 2);
    if (!mins.length) mins = elites.length ? elites : FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    // QUANTI MOSTRI (2026-11-04): da soli 1–3 (1–2 nella prima sala), in gruppo fra
    // eroi e eroi+1 (max 5). Il numero cambia solo la forma della sala: PF e danni totali
    // li decide il budget (balanceFoes), quindi più mostri = mostri più deboli.
    const [lo, hi] = partySize <= 1 ? (floor >= 2 ? [2, 3] : [1, 2]) : [partySize, Math.min(5, partySize + 1)];
    let count = lo + Math.floor(rnd() * (hi - lo + 1));
    if (floor >= 2 && elites.length && rnd() < 0.4) { picks.push(pick(elites)); count = Math.max(0, count - 2); }
    for (let i = 0; i < count; i++) picks.push(pick(mins));
  }
  // nomi doppi → "Goblin A", "Goblin B"
  const tot = {}; picks.forEach((p) => { tot[p.name] = (tot[p.name] || 0) + 1; });
  const seen = {};
  return picks.map((p, i) => {
    const n = (seen[p.name] = (seen[p.name] || 0) + 1);
    return makeFoe(p, i, partySize, tot[p.name] > 1 ? String.fromCharCode(64 + n) : "", partyLevel);
  });
}

/* ── stato ───────────────────────────────────────────── */
const alive = (c) => c && c.hp > 0;
const everyone = (s) => [...s.heroes, ...s.foes];
export const byId = (s, id) => everyone(s).find((c) => c.id === id) || null;
export const current = (s) => pendingHeroes(s)[0] || null; // (compatibilità) un eroe che deve ancora agire
const fxOn = (s, e) => !!e && (typeof e === "number" ? s.round < e : s.round < e.until);
function acOf(s, c) {
  let ac = c.ac;
  (c.fx.ac || []).forEach((e) => { if (fxOn(s, e)) ac += e.v; });
  if (c.fx.dodge) ac += 4;
  if (fxOn(s, c.fx.reckless)) ac -= 2;
  return ac;
}
// Ogni riga porta (se c'è un effetto) fx = forma (slash·arrow·bolt·aoe·heal·buff·shield·debuff),
// el = elemento (fire·frost·lightning·poison·darkness·radiant·arcane·physical), from = chi agisce
// e kill = chi è caduto: il sito ci disegna sopra gli effetti pixel e i suoni (VfxLayer).
let curVfx = null;
// scritte sotto il numero (IMMUNE / RESISTE / VULNERABILE / FURIA) raccolte da applyDamage fino alla prossima riga
let curTags = {};
function log(s, txt, extra = {}) {
  s.seq = (s.seq || 0) + 1;
  const row = { i: s.seq, txt, ...(curVfx && extra.targets ? curVfx : {}), ...extra };
  if (row.fx && row.targets && row.kind !== "miss") {
    const dead = row.targets.filter((id) => (byId(s, id)?.hp ?? 1) <= 0);
    if (dead.length) row.kill = dead;
  }
  // 2026-11-04: PF cambiati per bersaglio da questa riga (numeri che saltano sugli sprite).
  // s.hpSeen = PF di tutti all'ultima riga: quello che cambia senza bersagli si assorbe in silenzio.
  const seen = s.hpSeen || {};
  const all = [...(s.heroes || []), ...(s.foes || [])];
  if (row.targets) {
    const nums = {};
    row.targets.forEach((id) => { const f = byId(s, id); if (f && seen[id] != null && f.hp !== seen[id]) nums[id] = f.hp - seen[id]; });
    if (Object.keys(nums).length) row.nums = nums;
  }
  if (row.targets) {
    const tags = {};
    row.targets.forEach((id) => { if (curTags[id]) tags[id] = curTags[id]; });
    if (Object.keys(tags).length) row.tags = tags;
  }
  curTags = {};
  const nextSeen = {};
  all.forEach((f) => { nextSeen[f.id] = f.hp; });
  s.hpSeen = nextSeen;
  s.log = [...(s.log || []), row].slice(-LOG_MAX);
}
const EL_OF = { fire: "fire", cold: "frost", lightning: "lightning", thunder: "lightning", poison: "poison", acid: "poison", necrotic: "darkness", radiant: "radiant", force: "arcane", psychic: "arcane" };
export const elOf = (type) => EL_OF[type] || "physical";
const RANGED = new Set(["arco", "doppio", "lancio"]);
function heroVfx(a) {
  if (a.kind === "defend") return { fx: "shield", el: "arcane" };
  if (a.kind === "weapon") return { fx: a.ranged || RANGED.has(a.id) ? "arrow" : "slash", el: a.riderDmg && elOf(a.riderDmg) !== "physical" ? elOf(a.riderDmg) : elOf(a.dmg) };
  if (a.kind === "spell" || a.kind === "missile") return { fx: "bolt", el: elOf(a.dmg) };
  if (a.kind === "save") return { fx: a.area ? "aoe" : "bolt", el: elOf(a.dmg) };
  if (a.kind === "heal" || a.kind === "heal_all") return { fx: "heal", el: "radiant" };
  if (a.kind === "buff") return { fx: a.buff === "ac" ? "shield" : "buff", el: a.buff === "rage" ? "fire" : "radiant" };
  if (a.kind === "debuff") return { fx: "debuff", el: "darkness" };
  return null;
}
function foeVfx(a, type) {
  if (a.type === "heal") return { fx: "heal", el: "radiant" };
  if (a.type === "buff_ca") return { fx: "shield", el: "arcane" };
  if (a.type === "buff_adv") return { fx: "buff", el: "fire" };
  if (a.type === "debuff_dis") return { fx: "debuff", el: "darkness" };
  const area = a.aoeShape && a.aoeShape !== "single";
  const el = elOf(type);
  if (area) return { fx: "aoe", el };
  if (el === "physical" && a.hitMode !== "save") return { fx: /arco|frecc|balest|giavell|fionda|lancio/i.test(a.name || "") ? "arrow" : "slash", el };
  return { fx: "bolt", el };
}
// TURNI A FASI (2026-11-04): prima TUTTI gli eroi insieme (un'azione a testa, in
// qualsiasi ordine, max AFK_MS), poi tutti i mostri nell'ordine d'iniziativa.
// s.order = solo i mostri; s.acted = {idEroe: true} della fase in corso.
function rollInitiative(s) {
  const all = s.foes.filter(alive).map((c) => ({ id: c.id, v: d20() + (c.init || 0) + rnd() }));
  all.sort((a, b) => b.v - a.v);
  s.order = all.map((x) => x.id);
  s.turn = 0;
  s.round = 1;
}

export function newRun({ room, heroes, bestiary, dungeon, now }) {
  const s = {
    roomId: room.id, type: room.type, week: room.weekKey || "", startKey: room.startKey,
    dungeonName: dungeon.name, dungeonIcon: dungeon.icon || "🗝",
    bg: (dungeon.backgrounds || []).length ? pick(dungeon.backgrounds) : "",
    floors: dungeon.floors || 3, floor: 1, status: "fight",
    corone: Number.isFinite(Number(dungeon.corone)) ? Number(dungeon.corone) : 5,
    lootChance: Number.isFinite(Number(dungeon.lootChance)) ? Number(dungeon.lootChance) : 35, round: 1, order: [], turn: 0, turnAt: now,
    heroes: heroes.map(makeHero).map((h, _i, arr) => (arr.length === 1 ? { ...h, hp: Math.round(h.maxHp * ADAPT.soloHp), maxHp: Math.round(h.maxHp * ADAPT.soloHp) } : h)), foes: [], log: [], seq: 0, bestiary: bestiary.map((m) => m.id || m.name),
  };
  const helpers = s.heroes.filter((h) => h.helper);
  if (helpers.length) log(s, `🤝 ${helpers.map((h) => h.name).join(", ")} ${helpers.length === 1 ? "partecipa" : "partecipano"} come aiuto: niente PE, monete né bottino per ${helpers.length === 1 ? "lui" : "loro"} (limiti già pieni).`, { kind: "info" });
  startFloor(s, bestiary, now);
  return s;
}
function partyLevel(s) { return Math.round(s.heroes.reduce((t, h) => t + h.level, 0) / Math.max(1, s.heroes.length)); }
/* BUDGET DELLA SALA (2026-11-04): segnalato "4 eroi Lv 1 da ~13 PF contro 5 nemici da 27".
   I PF e il danno dei mostri si ricavano dagli EROI VERI della partita (quanti sono e i loro
   PF massimi): PF totali dei mostri = PF degli eroi × BUDGET.hp, danno medio per round di
   tutti i mostri insieme = PF degli eroi × BUDGET.dmg; si dividono fra i mostri in base al
   ruolo (gregario 1, élite 2,5, boss 5). Il mostro tiene i suoi dadi e le sue mosse: i
   numeri si scalano in proporzione (f.cap.dmg = suo danno medio massimo a colpo). */
export const BUDGET = {
  normal: { hp: 1, dmg: 0.15 },
  elite: { hp: 1.1, dmg: 0.16 },
  boss: { hp: 1.3, dmg: 0.16 },
  weight: { minion: 1, elite: 2.5, boss: 5 },
  // PF dei mostri per ogni eroe = forza d'attacco di un eroe di quel livello
  hpPerHero: 19, hpPerLevel: 0.2,
  // ritocco per numero di eroi (tarato con le simulazioni: stessa difficoltà da 1 a 4)
  size: { 1: { hp: 1.17, dmg: 1.17 }, 2: { hp: 1.38, dmg: 1.38 }, 3: { hp: 1.58, dmg: 1.58 }, 4: { hp: 1.75, dmg: 1.75 } },
  // ritocco per livello del gruppo (gli eroi crescono a scatti: Lv 5 attacco extra…)
  level: (lv) => { const k = lv <= 1 ? 1.05 : lv === 2 ? 0.92 : lv === 3 ? 0.95 : lv === 4 ? 0.85 : lv <= 8 ? 1 : lv <= 12 ? 0.97 : lv <= 16 ? 0.9 : 0.85; return { hp: k, dmg: k }; },
};
// Forza d'attacco di un eroe (≈ PF di mostri che "regge" una sala): cresce col livello,
// con un salto all'attacco extra / incantesimi più forti del Lv 5.
const heroOffense = (lv) => BUDGET.hpPerHero * (1 + BUDGET.hpPerLevel * (Math.max(1, lv) - 1) + (lv >= 5 ? 0.25 : 0));
export function balanceFoes(foes, heroes, isBoss) {
  const live = heroes.filter((h) => !h.fled);
  // i +10 PF di base degli eroi sono un vantaggio vero: non alzano il danno dei mostri
  const heroHp = live.reduce((t, h) => t + Math.max(5, (h.maxHp || 10) - HERO_HP_BASE), 0) || 10;
  const heroOff = live.reduce((t, h) => t + heroOffense(h.level || 1), 0) || BUDGET.hpPerHero;
  const kind = isBoss ? BUDGET.boss : foes.some((f) => f.role === "elite") ? BUDGET.elite : BUDGET.normal;
  const w = (f) => BUDGET.weight[f.role] || 1;
  const sumW = foes.reduce((t, f) => t + w(f), 0) || 1;
  const sz = BUDGET.size[Math.min(4, Math.max(1, live.length))] || BUDGET.size[4];
  const lvT = BUDGET.level(Math.round(live.reduce((t, h) => t + (h.level || 1), 0) / Math.max(1, live.length)));
  foes.forEach((f) => {
    const share = w(f) / sumW;
    f.maxHp = f.hp = Math.max(3, Math.round(heroOff * kind.hp * sz.hp * lvT.hp * share));
    f.cap = { ...(f.cap || {}), dmg: Math.max(1.5, heroHp * kind.dmg * sz.dmg * lvT.dmg * share * (foes.length > 1 ? 1.15 : 1)) };
  });
  return foes;
}
function startFloor(s, bestiary, now) {
  s.boss = s.floor > s.floors;
  s.foes = balanceFoes(buildEncounter(bestiary, { floor: s.floor, floors: s.floors, partyLevel: partyLevel(s), partySize: s.heroes.filter((h) => !h.fled).length }), s.heroes, s.boss);
  s.heroes.forEach((h) => { h.fx = {}; });
  s.status = "fight";
  rollInitiative(s);
  log(s, s.boss
    ? `👑 Sala del boss! Davanti a voi: ${s.foes.map((f) => f.name).join(", ")}.`
    : `🚪 Sala ${s.floor} di ${s.floors}: ${s.foes.map((f) => f.name).join(", ")}.`, { kind: "room" });
  startHeroPhase(s, now);
}

/* ── danni ───────────────────────────────────────────── */
function applyDamage(s, target, amount, type, notes) {
  let dmg = Math.max(0, Math.round(amount));
  if (target.side === "f") {
    if (target.imm.includes(type)) { dmg = 0; notes.push("immune"); curTags[target.id] = "imm"; }
    else if (target.res.includes(type)) { dmg = Math.floor(dmg / 2); notes.push("resiste"); curTags[target.id] = "res"; }
    else if (target.vul.includes(type)) { dmg *= 2; notes.push("vulnerabile!"); curTags[target.id] = "vul"; }
  } else if (fxOn(s, target.fx.rage) && PHYS.includes(type)) { dmg = Math.floor(dmg / 2); notes.push("in furia"); curTags[target.id] = "rage"; }
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}
function attackRoll(s, att, def, bonus, { adv = false } = {}) {
  let a = adv || fxOn(s, att.fx.adv);
  let d = fxOn(s, att.fx.dis);
  if (a && d) { a = false; d = false; }
  const r1 = d20(); const r2 = a || d ? d20() : null;
  const nat = r2 == null ? r1 : a ? Math.max(r1, r2) : Math.min(r1, r2);
  const total = nat + bonus;
  const ac = acOf(s, def);
  return { nat, dice: r2 == null ? [r1] : [r1, r2], total, ac, hit: nat === 20 || (nat !== 1 && total >= ac), crit: nat === 20, adv: a, dis: d };
}
const advTag = (r) => (r.adv ? " (vantaggio)" : r.dis ? " (svantaggio)" : "");
const dmgBonusOf = (s, c) => (fxOn(s, c.fx.dmg) ? c.fx.dmg.v : 0) + (fxOn(s, c.fx.rage) ? c.fx.rage.v : 0);
const downTxt = (t) => (t.hp <= 0 ? (t.side === "f" ? ` 💀 ${t.name} cade!` : ` 💀 ${t.name} è a terra!`) : "");

/* ── azioni degli eroi ───────────────────────────────── */
export function heroActionList(h) {
  return heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0).map((a) => ({ ...a, left: a.uses ? (h.uses?.[a.id] ?? a.uses) : null }));
}
function diceFor(a, lv) {
  let [n, sides] = parseDice(a.dice);
  if (a.scale) n *= cantripMult(lv);
  if (a.grow) n += Math.max(0, Math.floor((lv - (a.min || 1)) / 4));
  return [n, sides];
}
// Cosa serve scegliere: "foe" | "ally" | null
export function targetKind(a) {
  if (a.kind === "weapon" || a.kind === "spell" || a.kind === "missile" || (a.kind === "save" && !a.area)) return "foe";
  if (a.kind === "heal" && !a.self) return "ally";
  if (a.kind === "debuff" && !a.area) return "foe";
  if (a.kind === "buff" && !a.self && !a.allParty) return "ally";
  return null;
}

function heroAct(s, h, a, target) {
  const lv = h.level;
  const st = h.st || {};
  const hit = heroHit(h.cls, lv, st);
  const mod = mainMod(h.cls, st);
  const healMod = st[kitOf(h.cls).healStat] ?? mod;
  const flatOf = (f) => { const m = /^lv\*(\d+)$/.exec(String(f || "")); return m ? lv * Number(m[1]) : Number(f) || 0; };
  const ev = { actor: h.id, roll: null };
  // "In difesa" dura fino alla prossima azione dell'eroe (prima spariva all'inizio del round: l'icona non si vedeva mai)
  h.fx.dodge = false;
  if (a.kind === "defend") {
    h.fx.dodge = true;
    log(s, `🛡 ${h.name} si mette in difesa (+4 CA fino al suo turno).`, { kind: "buff", actor: h.id, targets: [h.id] });
    return ev;
  }
  if (a.kind === "weapon" || a.kind === "spell") {
    const n = attacksOf(h.cls, lv, a);
    // le armi usano la loro caratteristica (FOR, DES o la migliore delle due), gli incantesimi quella della classe
    const wm = a.kind === "weapon" ? weaponMod(h.cls, st, a) : mod;
    const hitW = a.kind === "weapon" ? profOf(lv) + wm + (a.plus || 0) : hit;
    // Attacco Irruento (2026-11-06): vantaggio e −2 CA per 2 turni (questo e il prossimo)
    if (a.selfDis) { h.fx.reckless = s.round + 2; h.fx.adv = Math.max(Number(h.fx.adv) || 0, s.round + 2); }
    for (let k = 0; k < n; k++) {
      if (!alive(target)) {
        const others = s.foes.filter(alive);
        if (!others.length) break;
        target = others[0];
      }
      const r = attackRoll(s, h, target, hitW, { adv: !!a.adv });
      if (k === 0) ev.roll = { nat: r.nat, dice: r.dice };
      if (!r.hit) { log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: manca (🎲${r.nat}+${hitW}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: h.id, targets: [target.id], roll: { nat: r.nat, dice: r.dice } }); continue; }
      let [dn, ds] = diceFor(a, lv);
      if (r.crit) dn *= 2;
      let dmg = roll(dn, ds).t + (a.kind === "weapon" ? wm + (a.plus || 0) + dmgBonusOf(s, h) : 0);
      if (a.bonusDmg === "lv/2") dmg += Math.floor(lv / 2);
      const notes = [];
      let total = applyDamage(s, target, dmg, a.dmg, notes);
      let extra = "";
      if (a.rider && k === 0 && alive(target)) {
        let rn, rs;
        if (a.rider === "sneak") { rn = Math.ceil(lv / 2); rs = 6; } else { [rn, rs] = diceFor({ ...a, dice: a.rider }, lv); }
        if (r.crit) rn *= 2;
        const rd = applyDamage(s, target, roll(rn, rs).t, a.riderDmg || a.dmg, notes);
        total += rd; extra = ` +${rd} ${DMG_IT[a.riderDmg] || ""}`;
      }
      if (a.riderDis && alive(target)) { target.fx.dis = s.round + 1 + a.riderDis; extra += " · a svantaggio"; }
      if (a.stunSave && alive(target)) {
        const sv = d20() + (target.save || 0);
        if (sv < heroDc(h.cls, lv, st)) { target.fx.stun = true; extra += ` · 💫 stordito (TS ${sv})`; } else extra += ` · resiste allo stordimento (${sv})`;
      }
      if (a.drain && total > 0) { const before = h.hp; h.hp = Math.min(h.maxHp, h.hp + Math.floor(total / 2)); extra += ` · si cura di ${h.hp - before}`; }
      log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (🎲${r.nat}+${hitW}=${r.total})${advTag(r)}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total, roll: { nat: r.nat, dice: r.dice } });
    }
    return ev;
  }
  if (a.kind === "missile") {
    const [dn, ds] = diceFor(a, lv);
    const notes = [];
    const dmg = applyDamage(s, target, roll(dn, ds).t + flatOf(a.flat) + (a.plusMod ? mod : 0), a.dmg, notes);
    log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: colpisce sempre, ${dmg} danni ${DMG_IT[a.dmg]}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
    return ev;
  }
  if (a.kind === "save") {
    const dc = heroDc(h.cls, lv, st);
    const targets = a.area ? s.foes.filter(alive) : [target];
    const [dn, ds] = diceFor(a, lv);
    const base = roll(dn, ds).t + flatOf(a.flat);
    const parts = [];
    targets.forEach((t) => {
      const sv = d20() + (t.save || 0);
      const ok = sv >= dc;
      const notes = [];
      const dmg = ok ? (a.half ? applyDamage(s, t, Math.floor(base / 2), a.dmg, notes) : 0) : applyDamage(s, t, base, a.dmg, notes);
      if (!ok && a.stun && alive(t)) t.fx.stun = true;
      if (!ok && a.dis && alive(t)) t.fx.dis = s.round + 1 + a.dis;
      parts.push(`${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) −${dmg}${notes.length ? ` ${notes.join(",")}` : ""}${!ok && a.stun && alive(t) ? " 💫 stordito" : ""}${t.hp <= 0 ? " 💀" : ""}`);
    });
    log(s, `${a.icon} ${h.name} → ${a.name} (TS ${a.save.toUpperCase()} CD ${dc}): ${parts.join(" · ")}.`, { kind: "hit", actor: h.id, targets: targets.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "heal" || a.kind === "heal_all") {
    const tg = a.kind === "heal_all" ? s.heroes.filter((x) => !x.fled) : [a.self ? h : target];
    const parts = tg.map((t) => {
      let amt;
      if (a.flat) amt = flatOf(a.flat);
      else { const [dn, ds] = diceFor(a, lv); amt = roll(dn, ds).t + (a.plusMod ? healMod : 0) + (a.plusLevel ? lv : 0); }
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amt);
      return `${t.name} +${t.hp - before}${before <= 0 && t.hp > 0 ? " (rialzato!)" : ""}`;
    });
    log(s, `${a.icon} ${h.name} → ${a.name}: ${parts.join(" · ")}.`, { kind: "heal", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "debuff") {
    const tg = a.area ? s.foes.filter(alive) : [target];
    tg.forEach((t) => { t.fx.dis = s.round + (a.turns || 1) + 1; });
    log(s, `${a.icon} ${h.name} → ${a.name}: ${tg.map((t) => t.name).join(", ")} a svantaggio per ${a.turns} ${a.turns === 1 ? "turno" : "turni"}.`, { kind: "debuff", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  if (a.kind === "buff") {
    const tg = a.allParty ? s.heroes.filter(alive) : [a.self ? h : target];
    tg.forEach((t) => {
      const until = s.round + (a.turns || 1) + 1;
      if (a.buff === "ac") t.fx.ac = [...(t.fx.ac || []).filter((e) => fxOn(s, e)), { v: a.value, until }];
      if (a.buff === "adv") t.fx.adv = until;
      if (a.buff === "dmg") t.fx.dmg = { v: a.value, until };
      if (a.buff === "rage") t.fx.rage = { v: a.value, until };
    });
    const what = a.buff === "ac" ? `+${a.value} CA` : a.buff === "adv" ? "vantaggio agli attacchi" : a.buff === "rage" ? `+${a.value} danni e danni fisici dimezzati` : `+${a.value} danni`;
    log(s, `${a.icon} ${h.name} → ${a.name}: ${tg.map((t) => t.name).join(", ")} ${what} per ${a.turns} ${a.turns === 1 ? "turno" : "turni"}.`, { kind: "buff", actor: h.id, targets: tg.map((t) => t.id) });
    return ev;
  }
  return ev;
}

/* ── IA dei mostri ───────────────────────────────────── */
const HEAL_COOLDOWN = 3;
const HEAL_MAX = 3;
function foeAct(s, f) {
  const heroes = s.heroes.filter(alive);
  if (!heroes.length) return;
  const acts = f.actions.length ? f.actions : [A("Colpo", 1, "d6", 3)];
  const allies = s.foes.filter(alive);
  const hurt = allies.filter((x) => x.hp / x.maxHp < 0.4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const heals = acts.filter((a) => a.type === "heal");
  const areas = acts.filter((a) => a.type === "attack" && a.aoeShape && a.aoeShape !== "single");
  const singles = acts.filter((a) => a.type === "attack" && (!a.aoeShape || a.aoeShape === "single"));
  const buffs = acts.filter((a) => (a.type === "buff_ca" && !(f.fx.ac || []).some((e) => fxOn(s, e))) || (a.type === "buff_adv" && !fxOn(s, f.fx.adv)));
  const debuffs = acts.filter((a) => a.type === "debuff_dis");
  let a;
  // CURE DEI MOSTRI (2026-11-05, segnalato Kraelthar che si curava a ogni turno): al massimo una
  // cura ogni 3 round per mostro (HEAL_COOLDOWN), 3 cure per sala (HEAL_MAX), probabilità 50% invece di 80%
  const canHeal = (f.heals || 0) < HEAL_MAX && !(f.healRound && s.round - f.healRound < HEAL_COOLDOWN);
  if (hurt && heals.length && canHeal && rnd() < 0.5) a = pick(heals);
  else if (areas.length && heroes.length >= 2 && rnd() < 0.55) a = pick(areas);
  else if (buffs.length && rnd() < 0.25) a = pick(buffs);
  else if (debuffs.length && rnd() < 0.25) a = pick(debuffs);
  else a = singles.length ? pick(singles) : pick(acts);
  // bersaglio: spesso il più ferito, a volte chi lo ha colpito per ultimo, sennò a caso
  const weakest = [...heroes].sort((x, y) => x.hp - y.hp)[0];
  const lastHitter = heroes.find((h) => h.id === f.lastHitBy);
  const tgt = rnd() < 0.45 ? weakest : lastHitter && rnd() < 0.5 ? lastHitter : pick(heroes);
  const nm = a.name || "Attacco";
  const lvlBonus = Math.max(-3, Math.floor((f.level || 1) / 3) + (f.adapt?.dmg || 0));
  // danno medio oltre il tetto del gruppo → si riduce in proporzione
  // targets = quanti eroi colpisce: un'area divide il budget del mostro fra tutti. L'area
  // non manca mai (TS: metà danni a chi lo supera), quindi in totale vale ~0,8 di un colpo
  // (un attacco singolo va a segno ~60% delle volte): così in gruppo non pesa il doppio.
  const capMult = (n, sides, targets = 1) => {
    const avg = (avgDice(n, sides) + lvlBonus) * (f.adapt?.mult || 1);
    const max = (f.cap?.dmg || 99) * (targets > 1 ? Math.min(1, 0.8 / targets) : 1);
    return avg > max ? max / avg : 1;
  };
  const turns = Math.max(1, Number(a.durationTurns) || 2);
  curVfx = { ...foeVfx(a, wbDmgType(a)), from: f.id };

  if (a.type === "heal") {
    const t = hurt || f;
    const hn = Number(a.diceNum) || 1, hs = parseDice(`1${a.diceType || "d8"}`)[1];
    const raw = roll(hn, hs).t + (Number(a.bonus) || 0);
    // cura a METÀ (2026-11-05): tetto 0,6 del danno medio del mostro (era 1,2) e il tiro dimezzato
    const hmax = (f.cap?.dmg || 99) * 0.6;
    const amt = Math.max(1, Math.round(raw * 0.5 * Math.min(1, hmax / Math.max(1, (avgDice(hn, hs) + (Number(a.bonus) || 0)) * 0.5))));
    f.heals = (f.heals || 0) + 1; f.healRound = s.round;
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt);
    log(s, `💚 ${f.name} → ${nm}: ${t.name} +${t.hp - before} PF.`, { kind: "heal", actor: f.id, targets: [t.id] });
    return;
  }
  if (a.type === "buff_ca") { f.fx.ac = [...(f.fx.ac || []), { v: Number(a.acBonus) || 2, until: s.round + turns + 1 }]; log(s, `🛡 ${f.name} → ${nm}: +${Number(a.acBonus) || 2} CA per ${turns} turni.`, { kind: "buff", actor: f.id, targets: [f.id] }); return; }
  if (a.type === "buff_adv") { f.fx.adv = s.round + turns + 1; log(s, `⬆ ${f.name} → ${nm}: vantaggio agli attacchi per ${turns} turni.`, { kind: "buff", actor: f.id, targets: [f.id] }); return; }
  if (a.type === "debuff_dis") {
    const tg = a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
    tg.forEach((t) => { t.fx.dis = s.round + turns + 1; });
    log(s, `⬇ ${f.name} → ${nm}: ${tg.map((t) => t.name).join(", ")} a svantaggio per ${turns} turni.`, { kind: "debuff", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  // attacco: tiro per colpire o tiro salvezza (singolo o ad area)
  const type = wbDmgType(a);
  const n = Math.max(1, Number(a.diceNum) || 1);
  const sides = parseDice(`1${a.diceType || "d6"}`)[1];
  const isSave = a.hitMode === "save" || (a.aoeShape && a.aoeShape !== "single");
  if (isSave) {
    const tg = a.aoeShape && a.aoeShape !== "single" ? heroes : [tgt];
    const dc = f.cap?.dc ?? ((Number(a.saveDC) || 12) + (f.adapt?.hit || 0));
    const base = Math.max(1, Math.round((roll(n, sides).t + lvlBonus) * (f.adapt?.mult || 1) * capMult(n, sides, tg.length)));
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0) + (t.st?.[a.saveAbility || "dex"] || 0);
      const ok = sv >= dc;
      const dmg = ok ? (a.halfOnSave !== false ? applyDamage(s, t, Math.floor(base / 2), type, []) : 0) : applyDamage(s, t, base, type, []);
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) −${dmg}${t.hp <= 0 ? " 💀" : ""}`;
    });
    log(s, `🌀 ${f.name} → ${nm} (TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${dc}): ${parts.join(" · ")}.`, { kind: "hit", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  const bonus = f.cap?.hit ?? ((Number(a.bonus) || 3) + (f.adapt?.hit || 0));
  const r = attackRoll(s, f, tgt, bonus);
  if (!r.hit) { log(s, `⚔ ${f.name} → ${nm} su ${tgt.name}: manca (🎲${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id], roll: { nat: r.nat, dice: r.dice } }); return; }
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((roll(r.crit ? n * 2 : n, sides).t + lvlBonus) * (f.adapt?.mult || 1) * capMult(n, sides, 1))), type, []);
  log(s, `⚔ ${f.name} → ${nm} su ${tgt.name}: ${r.crit ? "CRITICO! " : ""}${dmg} danni ${DMG_IT[type] || ""} (🎲${r.nat}+${bonus}=${r.total})${advTag(r)}.${downTxt(tgt)}`, { kind: r.crit ? "crit" : "hit", actor: f.id, targets: [tgt.id], dmg, roll: { nat: r.nat, dice: r.dice } });
}

/* ── giro dei turni ──────────────────────────────────── */
function checkEnd(s) {
  if (!s.heroes.some(alive)) { s.status = "lost"; log(s, "☠ Il gruppo è caduto. Le Segrete si richiudono su di voi: tutto è perduto.", { kind: "end" }); return true; }
  if (!s.foes.some(alive)) {
    floorCoins(s);
    if (s.boss) { s.status = "won"; log(s, `🏆 Il boss è caduto! Avete conquistato ${s.dungeonName}.`, { kind: "end" }); }
    else { s.status = "cleared"; log(s, `✅ Sala ${s.floor} ripulita! Riprendete fiato prima della prossima.`, { kind: "end" }); }
    return true;
  }
  return false;
}
export const pendingHeroes = (s) => s.heroes.filter((h) => alive(h) && !(s.acted || {})[h.id]);
function startHeroPhase(s, now) {
  s.acted = {};
  s.phaseAt = now;
  s.turnAt = now;
}
// Tutti i mostri, uno dopo l'altro; poi nuovo round e di nuovo tocca agli eroi.
function monsterPhase(s, now) {
  for (const id of s.order) {
    if (checkEnd(s)) return;
    const f = byId(s, id);
    if (!alive(f) || f.side !== "f") continue; // le partite di prima del cambio avevano anche gli eroi in order
    if (f.fx.stun) { f.fx.stun = false; log(s, `💫 ${f.name} è stordito e salta il turno.`, { kind: "debuff", actor: f.id }); continue; }
    foeAct(s, f);
    curVfx = null;
  }
  if (checkEnd(s)) return;
  s.round += 1;
  startHeroPhase(s, now);
}
// Dopo ogni azione di un eroe: se hanno agito tutti i vivi, tocca ai mostri.
function afterHeroAction(s, now) {
  if (checkEnd(s)) return;
  if (pendingHeroes(s).length) return;
  monsterPhase(s, now);
}

/* ── operazioni (le chiama il server) ────────────────── */
export function act(s, uid, { actionId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  s.acted = s.acted || {};
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (!alive(h)) throw new Error("Sei a terra: aspetta che un alleato ti curi.");
  if (s.acted[h.id]) throw new Error("Hai già agito in questo round: aspetta gli altri e i mostri.");
  const a = actionId === DEFEND.id ? DEFEND : heroActionList(h).find((x) => x.id === actionId);
  if (!a) throw new Error("Azione non disponibile.");
  if (a.uses && (h.uses?.[a.id] ?? a.uses) <= 0) throw new Error("Hai finito gli usi di questa azione per questa sala.");
  const tk = targetKind(a);
  let target = null;
  if (tk === "foe") target = foeTarget(s, h, targetId);
  if (tk === "ally") {
    target = byId(s, targetId);
    const heal = a.kind === "heal";
    if (!target || target.side !== "h" || target.fled || (!heal && !alive(target))) throw new Error("Scegli un alleato.");
  }
  if (a.uses) h.uses = { ...h.uses, [a.id]: (h.uses?.[a.id] ?? a.uses) - 1 };
  curVfx = heroVfx(a) ? { ...heroVfx(a), from: h.id } : null;
  let ev;
  try { ev = heroAct(s, h, a, target); } finally { curVfx = null; }
  if (target && target.side === "f") target.lastHitBy = h.id;
  s.acted = { ...s.acted, [h.id]: true };
  lootDead(s);
  afterHeroAction(s, now);
  return ev;
}

/* Bersaglio del nemico (2026-11-04): in gruppo si sceglie tutti insieme, e il nemico scelto
   può essere già caduto per mano di un compagno. Allora si punta da soli il nemico in piedi
   più ferito (in percentuale), e la cronaca lo dice. */
function foeTarget(s, h, targetId) {
  const t = byId(s, targetId);
  if (t && t.side === "f" && alive(t)) return t;
  const live = s.foes.filter(alive);
  if (!live.length) throw new Error("Non ci sono nemici in piedi.");
  const next = live.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  log(s, `🎯 ${t && t.side === "f" ? `${t.name} è già caduto: ` : ""}${h.name} punta ${next.name}.`, { kind: "info", actor: h.id });
  return next;
}

/* ── bottino (2026-11-04) ───────────────────────────────
   s.spoils = { uid: { coins, items: {id: n} } } = bottino della spedizione: si porta a casa
   solo se il gruppo vince il dungeon (lo consegna il server), se cade si perde. */
function addSpoil(s, uid, { coins = 0, item = null, src = "" } = {}) {
  // storico di cosa ha preso ognuno, sala per sala (2026-11-05): s.gains[uid] = [{fl, c, it, src}]
  const g = { ...(s.gains || {}) };
  g[uid] = [...(g[uid] || []), { fl: s.floor, c: coins || 0, it: item || null, src: String(src || "") }].slice(-60);
  s.gains = g;
  const sp = { ...(s.spoils || {}) };
  const cur = sp[uid] || { coins: 0, items: {} };
  const items = { ...(cur.items || {}) };
  if (item) items[item] = (items[item] || 0) + 1;
  sp[uid] = { coins: (cur.coins || 0) + coins, items };
  s.spoils = sp;
}
// Ogni sala vinta (e il boss): 1d20 Monete Antiche a ogni eroe rimasto (anche a terra, non a chi è fuggito).
function floorCoins(s) {
  if (s.coinsFloor === s.floor) return;
  s.coinsFloor = s.floor;
  const got = s.heroes.filter((h) => !h.fled && !h.helper).map((h) => { const c = die(FLOOR_COINS_DIE); addSpoil(s, h.uid, { coins: c, src: s.boss ? "boss sconfitto" : `sala ${s.floor} ripulita` }); return `${h.name} ${c}`; });
  if (got.length) log(s, `🪙 Monete Antiche dalla sala: ${got.join(" · ")}.`, { kind: "loot" });
}
// Mostri appena caduti: a volte lasciano Monete o un oggetto (a chi li ha abbattuti, sennò a caso).
export function lootDead(s) {
  // chi aiuta (limiti pieni) non entra nel tiro del bottino; se aiutano tutti, i mostri non lasciano niente
  const heroes = s.heroes.filter((h) => !h.fled && !h.helper);
  if (!heroes.length) return;
  const bases = [...new Set(heroes.map((h) => h.weapon).filter(Boolean))];
  s.foes.forEach((f) => {
    if (alive(f) || f.looted) return;
    f.looted = true;
    const ch = DROP_CHANCE[f.role] || DROP_CHANCE.minion;
    // A CHI VA (2026-11-05): sempre a sorte con un dado da 2×eroi facce (2 eroi d4, 3 d6, 4 d8):
    // 1–2 = primo eroe, 3–4 = secondo… (prima andava a chi dava il colpo finale)
    const faces = heroes.length * 2;
    const r = die(faces);
    const who = heroes[Math.min(heroes.length - 1, Math.ceil(r / 2) - 1)];
    const parts = [];
    if (die(100) <= ch.coins) {
      const c = roll(ch.coinDice[0], ch.coinDice[1]).t;
      addSpoil(s, who.uid, { coins: c, src: f.name });
      parts.push(`🪙 ${c} Monete Antiche`);
    }
    if (die(100) <= ch.item) {
      const id = rollDropItem(rnd, bases, f.role);
      const it = itemOf(id);
      if (it) { addSpoil(s, who.uid, { item: id, src: f.name }); parts.push(`${it.icon} ${it.name}`); }
    }
    if (parts.length) log(s, `🎁 ${f.name} lascia cadere ${parts.join(" e ")}: ${heroes.length > 1 ? `🎲 d${faces} = ${r} → ` : ""}va a ${who.name}.`, { kind: "loot", actor: who.id });
  });
}

/* Oggetto dallo zaino (usarlo è l'azione del round). Il server controlla e toglie dallo zaino. */
export function useItem(s, uid, { itemId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  s.acted = s.acted || {};
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (!alive(h)) throw new Error("Sei a terra: aspetta che un alleato ti curi.");
  if (s.acted[h.id]) throw new Error("Hai già agito in questo round: aspetta gli altri e i mostri.");
  const it = battleItem(itemId);
  if (!it) throw new Error("Oggetto non usabile in lotta.");
  const tk = itemTarget(it);
  let target = null;
  if (tk === "foe") target = foeTarget(s, h, targetId);
  if (tk === "ally" || tk === "downed") {
    target = byId(s, targetId) || h;
    if (target.side !== "h" || target.fled) throw new Error("Scegli un alleato.");
    if (tk === "ally" && !alive(target)) throw new Error("È a terra: per rialzarlo serve la Piuma della Fenice.");
    if (tk === "downed" && alive(target)) throw new Error("La Piuma della Fenice serve per un alleato a terra.");
  }
  const flatN = Number(it.flat) || 0;
  const on = target && target !== h ? ` su ${target.name}` : "";
  if (it.kind === "heal") {
    curVfx = { fx: "heal", el: "radiant", from: h.id };
    const [n, sd] = parseDice(it.dice);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + roll(n, sd).t + flatN);
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: +${target.hp - before} PF.`, { kind: "heal", actor: h.id, targets: [target.id] });
  } else if (it.kind === "revive") {
    curVfx = { fx: "heal", el: "radiant", from: h.id };
    target.hp = Math.max(1, Math.ceil((target.maxHp * (it.pct || 50)) / 100));
    log(s, `${it.icon} ${h.name} usa ${it.name}: ${target.name} si rialza con ${target.hp} PF!`, { kind: "heal", actor: h.id, targets: [target.id] });
  } else if (it.kind === "cleanse") {
    curVfx = { fx: "buff", el: "radiant", from: h.id };
    target.fx = { ...target.fx, dis: 0, stun: false, reckless: 0 };
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: via svantaggio e stordimento.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "buff") {
    curVfx = { fx: it.buff === "ac" ? "shield" : "buff", el: "arcane", from: h.id };
    const until = s.round + (it.turns || 1) + 1;
    if (it.buff === "ac") target.fx.ac = [...(target.fx.ac || []).filter((e) => fxOn(s, e)), { v: it.value, until }];
    if (it.buff === "adv") target.fx.adv = until;
    log(s, `${it.icon} ${h.name} usa ${it.name}${on}: ${it.buff === "ac" ? `+${it.value} CA` : "vantaggio agli attacchi"} per ${it.turns} round.`, { kind: "buff", actor: h.id, targets: [target.id] });
  } else if (it.kind === "throw") {
    curVfx = { fx: "bolt", el: elOf(it.dmg), from: h.id };
    const [n, sd] = parseDice(it.dice);
    const notes = [];
    const dmg = applyDamage(s, target, roll(n, sd).t, it.dmg, notes);
    target.lastHitBy = h.id;
    log(s, `${it.icon} ${h.name} lancia ${it.name} su ${target.name}: ${dmg} danni ${DMG_IT[it.dmg] || ""}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
  } else if (it.kind === "throw_area") {
    curVfx = { fx: "aoe", el: elOf(it.dmg), from: h.id };
    const [n, sd] = parseDice(it.dice);
    const base = roll(n, sd).t;
    const tg = s.foes.filter(alive);
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0);
      const ok = sv >= (it.dc || 13);
      const notes = [];
      const dmg = applyDamage(s, t, ok ? Math.floor(base / 2) : base, it.dmg, notes);
      t.lastHitBy = h.id;
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) −${dmg}${notes.length ? ` ${notes.join(",")}` : ""}${t.hp <= 0 ? " 💀" : ""}`;
    });
    log(s, `${it.icon} ${h.name} lancia ${it.name} (TS ${String(it.save).toUpperCase()} CD ${it.dc}): ${parts.join(" · ")}.`, { kind: "hit", actor: h.id, targets: tg.map((t) => t.id) });
  }
  curVfx = null;
  s.acted = { ...s.acted, [h.id]: true };
  lootDead(s);
  afterHeroAction(s, now);
  return { actor: h.id, roll: null, item: itemId };
}

// Chi sparisce per AFK_MS: si difende da solo (lo chiede chiunque del gruppo).
export function timeout(s, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const late = pendingHeroes(s);
  if (!late.length) throw new Error("Hanno già agito tutti.");
  if (now - (s.phaseAt || s.turnAt || 0) < AFK_MS) throw new Error("I 5 minuti non sono ancora finiti.");
  late.forEach((h) => { h.fx.dodge = true; s.acted = { ...(s.acted || {}), [h.id]: true }; });
  log(s, `⏰ Tempo scaduto: ${late.map((h) => h.name).join(", ")} si ${late.length === 1 ? "difende" : "difendono"} da ${late.length === 1 ? "solo" : "soli"}.`, { kind: "buff", targets: late.map((h) => h.id) });
  afterHeroAction(s, now);
}
// Sala ripulita → la prossima (breve riposo: +30% PF, chi era a terra si rialza al 25%, usi ricaricati).
export function nextFloor(s, bestiary, now) {
  if (s.status !== "cleared") throw new Error("La sala non è ancora ripulita.");
  s.heroes.forEach((h) => {
    if (h.fled) return;
    h.hp = h.hp <= 0 ? Math.ceil(h.maxHp * 0.25) : Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * 0.3));
    const uses = {}; heroActions(h.cls, h.level, h.picks || [], h.weapon, h.weaponPlus || 0).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
    h.uses = uses;
  });
  s.floor += 1;
  log(s, "🔥 Breve riposo: recuperate fiato e incantesimi.", { kind: "room" });
  startFloor(s, bestiary, now);
}
// Un giocatore abbandona: il suo eroe fugge (conta come a terra).
export function flee(s, uid, now) {
  const h = s.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error("Non sei in questa partita.");
  if (h.hp > 0) { h.hp = 0; h.fled = true; log(s, `🏃 ${h.name} fugge dalle Segrete.`, { kind: "down", actor: h.id }); }
  if (s.status === "fight") afterHeroAction(s, now);
  else if (!s.heroes.some(alive) && s.status === "cleared") { s.status = "lost"; log(s, "☠ Non resta nessuno a proseguire: tutto è perduto.", { kind: "end" }); }
}
