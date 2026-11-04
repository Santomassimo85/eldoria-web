/* ============================================================
   LE SEGRETE · motore del combattimento (fase 3, 2026-11-04)
   PURO: niente Firebase. Lo esegue il SERVER (functions/segreteBundle.js,
   `npm run build:segrete`) con dadi crypto; il sito lo usa solo per i testi.
   Stato della partita = dungeon_runs/{roomId}:
     { type, bg, floor, floors, boss, status fight|cleared|won|lost, round,
       order: [id], turn, turnAt, heroes: [c], foes: [c], log: [...], seq }
   Combattente c = { id, side h|f, name, level, hp, maxHp, ac, init, save,
     fx: {ac:[{v,until}], adv, dis, dmg:{v,until}, rage, stun, dodge}, uses,
     (eroi) uid, cls, img; (mostri) actions WB, res/vul/imm, role, img… }
   Gli effetti a turni valgono finché `round < until`.
   ============================================================ */
import { kitOf, heroActions, heroMaxHp, heroDc, heroHit, modOf, profOf, cantripMult, attacksOf, DEFEND } from "./segreteKits";

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
export function makeHero(m) {
  const lv = Math.max(1, Math.min(20, m.level || 1));
  const kit = kitOf(m.cls);
  const maxHp = heroMaxHp(m.cls, lv);
  const uses = {};
  heroActions(m.cls, lv).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
  return {
    id: `h_${m.uid}`, side: "h", uid: m.uid, name: m.name, cls: m.cls, level: lv, img: m.avatar || "",
    hp: maxHp, maxHp, ac: kit.ac, init: kit.stat === "dex" ? modOf(lv) : 1, save: 1 + Math.floor(profOf(lv) / 2),
    fx: {}, uses,
  };
}
/* Il mostro si adatta al livello del gruppo (2026-11-04, simulato): più debole del
   gruppo = più PF e colpi più forti; più forte = un po' meno. Élite e boss
   crescono anche col numero di eroi; i gregari crescono di numero. */
export const ADAPT = { hpUp: 0.25, hpDown: 0.16, hpMin: 0.35, dmgPer: 0.6, hitPer: 0.34, bigBase: 0.31, bigPer: 0.32, multUp: 0.05, multDown: 0.12, multMin: 0.5, soloHp: 1.3 };
function makeFoe(src, idx, partySize, suffix, partyLv = 1) {
  const diff = partyLv - (Number(src.level) || 1);
  const lvScale = diff >= 0 ? 1 + ADAPT.hpUp * diff : Math.max(ADAPT.hpMin, 1 + ADAPT.hpDown * diff);
  const scale = (src.role === "minion" ? 1 : ADAPT.bigBase + ADAPT.bigPer * partySize) * lvScale;
  const maxHp = Math.max(1, Math.round((Number(src.hp) || 10) * scale));
  return {
    id: `f${idx}`, side: "f", name: suffix ? `${src.name} ${suffix}` : src.name, src: src.id, role: src.role || "minion",
    level: Number(src.level) || 1, hp: maxHp, maxHp, ac: Math.max(8, (Number(src.ac) || 12) + (diff > 0 ? Math.floor(diff / 3) : Math.ceil(diff / 3))), init: Number(src.init) || 0, save: (Number(src.save) || 0) + Math.round(diff * ADAPT.hitPer),
    img: src.imageUrl || "", deadImg: src.deadImageUrl || "", icon: src.icon || "", facing: src.facing || "left",
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
    let count = Math.min(6, partySize + (floor >= 2 && partySize >= 2 ? 1 : 0) + (partySize >= 3 ? 1 : 0));
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
export const current = (s) => byId(s, s.order[s.turn]);
const fxOn = (s, e) => !!e && (typeof e === "number" ? s.round < e : s.round < e.until);
function acOf(s, c) {
  let ac = c.ac;
  (c.fx.ac || []).forEach((e) => { if (fxOn(s, e)) ac += e.v; });
  if (c.fx.dodge) ac += 4;
  if (fxOn(s, c.fx.reckless)) ac -= 2;
  return ac;
}
function log(s, txt, extra = {}) {
  s.seq = (s.seq || 0) + 1;
  s.log = [...(s.log || []), { i: s.seq, txt, ...extra }].slice(-LOG_MAX);
}
function rollInitiative(s) {
  const all = everyone(s).filter(alive).map((c) => ({ id: c.id, v: d20() + (c.init || 0) + rnd() }));
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
    floors: dungeon.floors || 3, floor: 1, status: "fight", round: 1, order: [], turn: 0, turnAt: now,
    heroes: heroes.map(makeHero).map((h, _i, arr) => (arr.length === 1 ? { ...h, hp: Math.round(h.maxHp * ADAPT.soloHp), maxHp: Math.round(h.maxHp * ADAPT.soloHp) } : h)), foes: [], log: [], seq: 0, bestiary: bestiary.map((m) => m.id || m.name),
  };
  startFloor(s, bestiary, now);
  return s;
}
function partyLevel(s) { return Math.round(s.heroes.reduce((t, h) => t + h.level, 0) / Math.max(1, s.heroes.length)); }
function startFloor(s, bestiary, now) {
  s.boss = s.floor > s.floors;
  s.foes = buildEncounter(bestiary, { floor: s.floor, floors: s.floors, partyLevel: partyLevel(s), partySize: s.heroes.length });
  s.heroes.forEach((h) => { h.fx = {}; });
  s.status = "fight";
  rollInitiative(s);
  log(s, s.boss
    ? `👑 Sala del boss! Davanti a voi: ${s.foes.map((f) => f.name).join(", ")}.`
    : `🚪 Sala ${s.floor} di ${s.floors}: ${s.foes.map((f) => f.name).join(", ")}.`, { kind: "room" });
  s.turnAt = now;
  advanceToActor(s, now, true);
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
  return heroActions(h.cls, h.level).map((a) => ({ ...a, left: a.uses ? (h.uses?.[a.id] ?? a.uses) : null }));
}
function diceFor(a, lv) {
  let [n, sides] = parseDice(a.dice);
  if (a.scale) n *= cantripMult(lv);
  if (a.grow) n += Math.max(0, Math.floor((lv - (a.unlock || 1)) / 4));
  return [n, sides];
}
// Cosa serve scegliere: "foe" | "ally" | null
export function targetKind(a) {
  if (a.kind === "weapon" || a.kind === "spell" || a.kind === "missile" || (a.kind === "save" && !a.area)) return "foe";
  if (a.kind === "heal" && !a.self) return "ally";
  if (a.kind === "buff" && !a.self && !a.allParty) return "ally";
  return null;
}

function heroAct(s, h, a, target) {
  const lv = h.level;
  const hit = heroHit(lv) + (fxOn(s, h.fx.bless) ? 0 : 0);
  const mod = modOf(lv);
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
      log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: ${r.crit ? "CRITICO! " : ""}${total} danni ${DMG_IT[a.dmg] || ""}${extra ? ` (di cui${extra})` : ""} (🎲${r.nat}+${hit}=${r.total})${advTag(r)}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`,
        { kind: r.crit ? "crit" : "hit", actor: h.id, targets: [target.id], dmg: total });
    }
    return ev;
  }
  if (a.kind === "missile") {
    const [dn, ds] = diceFor(a, lv);
    const notes = [];
    const dmg = applyDamage(s, target, roll(dn, ds).t + (a.flat || 0), a.dmg, notes);
    log(s, `${a.icon} ${h.name} → ${a.name} su ${target.name}: colpisce sempre, ${dmg} danni ${DMG_IT[a.dmg]}${notes.length ? ` · ${notes.join(", ")}` : ""}.${downTxt(target)}`, { kind: "hit", actor: h.id, targets: [target.id], dmg });
    return ev;
  }
  if (a.kind === "save") {
    const dc = heroDc(lv);
    const targets = a.area ? s.foes.filter(alive) : [target];
    const [dn, ds] = diceFor(a, lv);
    const base = roll(dn, ds).t;
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
      if (a.flat === "lv*5") amt = lv * 5;
      else { const [dn, ds] = diceFor(a, lv); amt = roll(dn, ds).t + (a.plusMod ? mod : 0) + (a.plusLevel ? lv : 0); }
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amt);
      return `${t.name} +${t.hp - before}${before <= 0 && t.hp > 0 ? " (rialzato!)" : ""}`;
    });
    log(s, `${a.icon} ${h.name} → ${a.name}: ${parts.join(" · ")}.`, { kind: "heal", actor: h.id, targets: tg.map((t) => t.id) });
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
  const turns = Math.max(1, Number(a.durationTurns) || 2);

  if (a.type === "heal") {
    const t = hurt || f;
    const amt = roll(Number(a.diceNum) || 1, parseDice(`1${a.diceType || "d8"}`)[1]).t + (Number(a.bonus) || 0);
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
    const dc = (Number(a.saveDC) || 12) + (f.adapt?.hit || 0);
    const base = Math.max(1, Math.round((roll(n, sides).t + lvlBonus) * (f.adapt?.mult || 1)));
    const parts = tg.map((t) => {
      const sv = d20() + (t.save || 0) - (fxOn(s, t.fx.dis) ? 0 : 0);
      const ok = sv >= dc;
      const dmg = ok ? (a.halfOnSave !== false ? applyDamage(s, t, Math.floor(base / 2), type, []) : 0) : applyDamage(s, t, base, type, []);
      return `${t.name} ${ok ? "resiste" : "fallisce"} (${sv}) −${dmg}${t.hp <= 0 ? " 💀" : ""}`;
    });
    log(s, `🌀 ${f.name} → ${nm} (TS ${String(a.saveAbility || "dex").toUpperCase()} CD ${dc}): ${parts.join(" · ")}.`, { kind: "hit", actor: f.id, targets: tg.map((t) => t.id) });
    return;
  }
  const bonus = (Number(a.bonus) || 3) + (f.adapt?.hit || 0);
  const r = attackRoll(s, f, tgt, bonus);
  if (!r.hit) { log(s, `⚔ ${f.name} → ${nm} su ${tgt.name}: manca (🎲${r.nat}+${bonus}=${r.total} vs CA ${r.ac})${advTag(r)}.`, { kind: "miss", actor: f.id, targets: [tgt.id] }); return; }
  const dmg = applyDamage(s, tgt, Math.max(1, Math.round((roll(r.crit ? n * 2 : n, sides).t + lvlBonus) * (f.adapt?.mult || 1))), type, []);
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
function nextIndex(s) {
  s.turn += 1;
  if (s.turn >= s.order.length) { s.turn = 0; s.round += 1; }
}
// Passa al prossimo che può agire; fa agire i mostri; si ferma su un eroe vivo.
function advanceToActor(s, now, fresh = false) {
  let guard = 0;
  if (!fresh) nextIndex(s);
  while (guard++ < 200) {
    if (checkEnd(s)) return;
    const c = current(s);
    if (!alive(c)) { nextIndex(s); continue; }
    c.fx.dodge = false;
    if (c.fx.stun) { c.fx.stun = false; log(s, `💫 ${c.name} è stordito e salta il turno.`, { kind: "debuff", actor: c.id }); nextIndex(s); continue; }
    if (c.side === "h") { s.turnAt = now; return; }
    foeAct(s, c);
    nextIndex(s);
  }
}

/* ── operazioni (le chiama il server) ────────────────── */
export function act(s, uid, { actionId, targetId }, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const h = current(s);
  if (!h || h.side !== "h" || h.uid !== uid) throw new Error("Non è il tuo turno.");
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
  const ev = heroAct(s, h, a, target);
  if (target && target.side === "f") target.lastHitBy = h.id;
  advanceToActor(s, now);
  return ev;
}
// Chi sparisce per AFK_MS: si difende da solo (lo chiede chiunque del gruppo).
export function timeout(s, now) {
  if (s.status !== "fight") throw new Error("Non si combatte adesso.");
  const h = current(s);
  if (!h || h.side !== "h") throw new Error("Tocca ai mostri.");
  if (now - (s.turnAt || 0) < AFK_MS) throw new Error("Il suo tempo non è ancora finito.");
  log(s, `⏰ ${h.name} non risponde da 10 minuti: si difende da solo.`, { kind: "buff", actor: h.id });
  h.fx.dodge = true;
  advanceToActor(s, now);
}
// Sala ripulita → la prossima (breve riposo: +30% PF, chi era a terra si rialza al 25%, usi ricaricati).
export function nextFloor(s, bestiary, now) {
  if (s.status !== "cleared") throw new Error("La sala non è ancora ripulita.");
  s.heroes.forEach((h) => {
    if (h.fled) return;
    h.hp = h.hp <= 0 ? Math.ceil(h.maxHp * 0.25) : Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * 0.3));
    const uses = {}; heroActions(h.cls, h.level).forEach((a) => { if (a.uses) uses[a.id] = a.uses; });
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
  if (s.status === "fight") { if (current(s)?.id === h.id) advanceToActor(s, now); else checkEnd(s); }
  else if (!s.heroes.some(alive) && s.status === "cleared") { s.status = "lost"; log(s, "☠ Non resta nessuno a proseguire: tutto è perduto.", { kind: "end" }); }
}
