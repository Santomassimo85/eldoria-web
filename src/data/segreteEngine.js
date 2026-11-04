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
import { kitOf, heroActions, heroMaxHp, HERO_HP_BASE, heroDc, heroHit, heroAc, heroStats, mainMod, profOf, cantripMult, attacksOf, levelOfXp, xpForLevel, MAX_STORY_LEVEL, DEFEND } from "./segreteKits";

export const LOG_MAX = 80;
export const AFK_MS = 10 * 60 * 1000;

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
  { id: "fb-orco", name: "Orco", icon: "👹", role: "elite", level: 3, hp: 30, ac: 13, init: 1, save: 2, actions: [A("Ascia Bipenne", 1, "d12", 5), { type: "buff_adv", name: "Grido di Guerra", durationTurns: 2 }] },
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
  const uses = {};
  heroActions(m.cls, lv, picks).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
  return {
    id: `h_${m.uid}`, side: "h", uid: m.uid, name: m.name, cls: m.cls, level: lv, img: m.avatar || "",
    hp: maxHp, maxHp, ac: heroAc(m.cls, st), init: st.dex || 0, save: Math.floor(profOf(lv) / 2), st, picks,
    fx: {}, uses,
  };
}
/* PE alla vittoria: una fetta del salto verso il livello dopo (8% a sala + 12% il boss:
   con 3 sale ~36% → ~3 dungeon per livello, con 3 dungeon a settimana ~1 livello a settimana). */
export function xpGain(level, floors) {
  if (level >= MAX_STORY_LEVEL) return 0;
  return Math.round((xpForLevel(level + 1) - xpForLevel(level)) * (0.08 * (floors || 3) + 0.12));
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
    img: src.imageUrl || "", deadImg: src.deadImageUrl || "", icon: src.icon || "", facing: src.facing || "left",
    cap: { hit: cap.hit, dc: cap.dc, dmg: cap.dmg },
    adapt: { mult: diff >= 0 ? 1 + ADAPT.multUp * diff : Math.max(ADAPT.multMin, 1 + ADAPT.multDown * diff), dmg: Math.round(diff * ADAPT.dmgPer), hit: Math.round(diff * ADAPT.hitPer), ac: diff > 0 ? Math.floor(diff / 3) : Math.ceil(diff / 3) },
    actions: (src.actions || []).slice(0, 5), res: src.resistances || [], vul: src.vulnerabilities || [], imm: src.immunities || [],
    fx: {}, uses: {},
  };
}

/* Sala n (1-based): normale = gregari (e a volte un'élite), ultima = boss. */
export function buildEncounter(bestiary, { floor, floors, partyLevel, partySize }) {
  const boss = floor > floors;
  const all = bestiary.length ? bestiary : FALLBACK_MONSTERS;
  const fit = (role, max) => {
    const of = all.filter((m) => (m.role || "minion") === role);
    const ok = of.filter((m) => (Number(m.level) || 1) <= max);
    return ok.length ? ok : of.length ? [of.reduce((a, b) => ((Number(a.level) || 1) <= (Number(b.level) || 1) ? a : b))] : [];
  };
  const picks = [];
  if (boss) {
    let bosses = fit("boss", partyLevel + 3);
    if (!bosses.length) bosses = fit("elite", partyLevel + 3);
    if (!bosses.length) bosses = FALLBACK_MONSTERS.filter((m) => m.role === "boss");
    picks.push(pick(bosses));
    const mins = fit("minion", partyLevel + 1);
    for (let i = 0; i < Math.floor(partySize / 2) && mins.length; i++) picks.push(pick(mins));
  } else {
    let mins = fit("minion", partyLevel + 1);
    const elites = fit("elite", partyLevel + 2);
    if (!mins.length) mins = elites.length ? elites : FALLBACK_MONSTERS.filter((m) => m.role === "minion");
    let count = Math.min(5, partySize + (floor >= 2 ? 1 : 0));
    if (floor >= 2 && elites.length && rnd() < 0.45) { picks.push(pick(elites)); count = Math.max(partySize >= 2 ? 1 : 0, count - 2); }
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
function log(s, txt, extra = {}) {
  s.seq = (s.seq || 0) + 1;
  const row = { i: s.seq, txt, ...(curVfx && extra.targets ? curVfx : {}), ...extra };
  if (row.fx && row.targets && row.kind !== "miss") {
    const dead = row.targets.filter((id) => (byId(s, id)?.hp ?? 1) <= 0);
    if (dead.length) row.kill = dead;
  }
  s.log = [...(s.log || []), row].slice(-LOG_MAX);
}
const EL_OF = { fire: "fire", cold: "frost", lightning: "lightning", thunder: "lightning", poison: "poison", acid: "poison", necrotic: "darkness", radiant: "radiant", force: "arcane", psychic: "arcane" };
export const elOf = (type) => EL_OF[type] || "physical";
const RANGED = new Set(["arco", "doppio", "lancio"]);
function heroVfx(a) {
  if (a.kind === "defend") return { fx: "shield", el: "arcane" };
  if (a.kind === "weapon") return { fx: RANGED.has(a.id) ? "arrow" : "slash", el: a.riderDmg && elOf(a.riderDmg) !== "physical" ? elOf(a.riderDmg) : elOf(a.dmg) };
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
  // in gruppo gli eroi si coprono a vicenda (cure, focus): ogni eroe in più vale un po' di più
  groupHp: 0.12, groupDmg: 0.1,
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
  foes.forEach((f) => {
    const share = w(f) / sumW;
    const g = live.length - 1;
    f.maxHp = f.hp = Math.max(3, Math.round(heroOff * kind.hp * (1 + BUDGET.groupHp * g) * share));
    f.cap = { ...(f.cap || {}), dmg: Math.max(1.5, heroHp * kind.dmg * (1 + BUDGET.groupDmg * g) * share * (foes.length > 1 ? 1.15 : 1)) };
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
    if (target.imm.includes(type)) { dmg = 0; notes.push("immune"); }
    else if (target.res.includes(type)) { dmg = Math.floor(dmg / 2); notes.push("resiste"); }
    else if (target.vul.includes(type)) { dmg *= 2; notes.push("vulnerabile!"); }
  } else if (fxOn(s, target.fx.rage) && PHYS.includes(type)) { dmg = Math.floor(dmg / 2); notes.push("in furia"); }
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
  return heroActions(h.cls, h.level, h.picks || []).map((a) => ({ ...a, left: a.uses ? (h.uses?.[a.id] ?? a.uses) : null }));
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
  if (a.kind === "defend") {
    h.fx.dodge = true;
    log(s, `🛡 ${h.name} si mette in difesa (+4 CA fino al suo turno).`, { kind: "buff", actor: h.id, targets: [h.id] });
    return ev;
  }
  if (a.kind === "weapon" || a.kind === "spell") {
    const n = attacksOf(h.cls, lv, a);
    if (a.selfDis) h.fx.reckless = s.round + 1;
    for (let k = 0; k < n; k++) {
      if (!alive(target)) {
        const others = s.foes.filter(alive);
        if (!others.length) break;
        target = others[0];
      }
      const r = attackRoll(s, h, target, hit, { adv: !!a.adv });
      if (k === 0) ev.roll = { nat: r.nat, dice: r.dice };
      if (!r.hit) { log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: manca (🎲${r.nat}+${hit}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: h.id, targets: [target.id] }); continue; }
      let [dn, ds] = diceFor(a, lv);
      if (r.crit) dn *= 2;
      let dmg = roll(dn, ds).t + (a.kind === "weapon" ? mod + dmgBonusOf(s, h) : 0);
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
      log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (🎲${r.nat}+${hit}=${r.total})${advTag(r)}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total });
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
  if (hurt && heals.length && rnd() < 0.8) a = pick(heals);
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
  // targets = quanti eroi colpisce: un'area divide il budget del mostro fra tutti (×1,4)
  const capMult = (n, sides, targets = 1) => {
    const avg = (avgDice(n, sides) + lvlBonus) * (f.adapt?.mult || 1);
    const max = (f.cap?.dmg || 99) * (targets > 1 ? Math.min(1, 1.1 / targets) : 1);
    return avg > max ? max / avg : 1;
  };
  const turns = Math.max(1, Number(a.durationTurns) || 2);
  curVfx = { ...foeVfx(a, wbDmgType(a)), from: f.id };

  if (a.type === "heal") {
    const t = hurt || f;
    const hn = Number(a.diceNum) || 1, hs = parseDice(`1${a.diceType || "d8"}`)[1];
    const raw = roll(hn, hs).t + (Number(a.bonus) || 0);
    const hmax = (f.cap?.dmg || 99) * 1.2;
    const amt = Math.max(1, Math.round(raw * Math.min(1, hmax / Math.max(1, avgDice(hn, hs) + (Number(a.bonus) || 0)))));
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
  if (!r.hit) { log(s, `⚔ ${f.name} → ${nm} su ${tgt.name}: manca (🎲${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id] }); return; }
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((roll(r.crit ? n * 2 : n, sides).t + lvlBonus) * (f.adapt?.mult || 1) * capMult(n, sides, 1))), type, []);
  log(s, `⚔ ${f.name} → ${nm} su ${tgt.name}: ${r.crit ? "CRITICO! " : ""}${dmg} danni ${DMG_IT[type] || ""} (🎲${r.nat}+${bonus}=${r.total})${advTag(r)}.${downTxt(tgt)}`, { kind: r.crit ? "crit" : "hit", actor: f.id, targets: [tgt.id], dmg });
}

/* ── giro dei turni ──────────────────────────────────── */
function checkEnd(s) {
  if (!s.heroes.some(alive)) { s.status = "lost"; log(s, "☠ Il gruppo è caduto. Le Segrete si richiudono su di voi: tutto è perduto.", { kind: "end" }); return true; }
  if (!s.foes.some(alive)) {
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
  s.heroes.forEach((h) => { h.fx.dodge = false; });
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
  if (tk === "foe") { target = byId(s, targetId); if (!target || target.side !== "f" || !alive(target)) throw new Error("Scegli un nemico in piedi."); }
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
  afterHeroAction(s, now);
  return ev;
}
// Chi sparisce per AFK_MS: si difende da solo (lo chiede chiunque del gruppo).
export function timeout(s, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const late = pendingHeroes(s);
  if (!late.length) throw new Error("Hanno già agito tutti.");
  if (now - (s.phaseAt || s.turnAt || 0) < AFK_MS) throw new Error("I 10 minuti non sono ancora finiti.");
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
    const uses = {}; heroActions(h.cls, h.level, h.picks || []).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
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
