// World Boss: il boss agisce DA SOLO quando il Master non c'è.
// Se il turno del boss è iniziato da AUTO_AFTER_MS e il Master non ha fatto nessuna
// azione (turn_tracker.bossActs vuoto per questo turno), il server fa AUTO_ACTIONS
// azioni pescate a caso fra TUTTE quelle del boss (attacco, area, cura, +CA, vantaggio,
// svantaggio: niente di fisso), due diverse quando ne ha almeno due.
// Bersagli: attacchi singoli e svantaggio = da 1 a 6 eroi a caso (vivi, attivi, mai doppi);
// aree = tutti gli eroi vivi. Poi il turno passa agli eroi.
// Stesse regole del pannello del Master in WorldBoss.jsx (tiro per colpire contro la CA +
// buff, TS degli eroi contro la CD, scudo prima dei PF, un solo tiro di danni) e stessi
// effetti a durata di src/pages/worldBossEffects.js (acBuffs, condUntilTurn): tenerli allineati.
const crypto = require("crypto");

const AUTO_AFTER_MS = 55 * 60 * 1000;
const AUTO_ACTIONS = 2;
const MAX_TARGETS = 6;
const EFFECT_TURNS_DEFAULT = 2;
const EFFECT_TURNS_MAX = 10;
const FALLBACK_ATTACK = { type: "attack", name: "Colpo furioso", diceNum: 1, diceType: "d10", bonus: 5 };
const HIDDEN_URL = "https://raw.githubusercontent.com/Santomassimo85/eldoria-web/main/src/data/hiddenPlayers.js";
const SAVE_IT = { str: "FOR", dex: "DES", con: "COS", int: "INT", wis: "SAG", cha: "CAR" };
// tipo di danno dell'editor → elemento dell'effetto a schermo (come worldBossSpells.js)
const DMG_EL = { fuoco: "fire", ghiaccio: "frost", fulmine: "lightning", veleno: "poison", "oscurità": "darkness", oscurita: "darkness", sacro: "radiant", fisico: "physical", arcano: "arcane" };

const rnd = (n) => crypto.randomInt(1, n + 1);
const toMs = (v) => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : NaN);
const firstName = (p) => String(p.name || "Eroe").split(" ")[0];

function rollDice(formula) {
  return String(formula || "").replace(/\s+/g, "").split("+").reduce((acc, part) => {
    if (part.includes("d")) {
      const [num, sides] = part.split("d").map((n) => parseInt(n) || 1);
      for (let i = 0; i < num; i++) acc += rnd(sides);
    } else acc += parseInt(part) || 0;
    return acc;
  }, 0);
}
const formulaOf = (a, withBonus) => a.damage && !withBonus
  ? a.damage
  : `${parseInt(a.diceNum) || 1}${a.diceType || "d6"}${withBonus && parseInt(a.bonus) ? "+" + parseInt(a.bonus) : ""}`;
const effectTurns = (a) => Math.max(1, Math.min(EFFECT_TURNS_MAX, parseInt(a?.durationTurns) || EFFECT_TURNS_DEFAULT));

// ── effetti a durata (copia di worldBossEffects.js) ──
function activeCond(e, turn) {
  const c = e?.nextTurnCondition;
  if (c !== "advantage" && c !== "disadvantage") return null;
  if (e.condUntilTurn != null && Number(turn) > Number(e.condUntilTurn)) return null;
  return c;
}
const condConsumePatch = (e) => (e?.condUntilTurn != null ? null : { nextTurnCondition: null, debuffSource: null });
const activeAcBuffs = (e, turn) => (Array.isArray(e?.acBuffs) ? e.acBuffs : []).filter((b) => b && Number(turn) <= Number(b.untilTurn));

// Modificatore al TS di un PG (formato {score, mod, save} della sync o numero).
function statSave(p, key) {
  const s = p?.stats || {};
  const raw = s[key] ?? (key === "con" ? s.cos : undefined);
  if (raw == null) return 0;
  if (typeof raw === "object") {
    if (raw.save != null) return Number(raw.save) || 0;
    if (raw.mod != null) return Number(raw.mod) || 0;
    return raw.score != null ? Math.floor((Number(raw.score) - 10) / 2) : 0;
  }
  return Number(raw) || 0;
}

// Lista dei PG disattivati: la stessa src/data/hiddenPlayers.js del sito, letta da GitHub.
async function loadHidden() {
  try {
    const res = await fetch(HIDDEN_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(res.status);
    const txt = await res.text();
    const block = (name) => (txt.split(name)[1] || "").split("]);")[0];
    const uids = new Set([...block("HIDDEN_PLAYER_UIDS").matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    const names = new Set([...block("HIDDEN_PLAYER_NAMES").matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase()));
    return { uids, names };
  } catch (e) {
    console.warn("[wb-auto] hiddenPlayers non letto:", e.message);
    return { uids: new Set(), names: new Set() };
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Le azioni del giro: AUTO_ACTIONS pescate a caso, diverse finché ce ne sono.
function pickActions(actions) {
  if (!actions.length) return [FALLBACK_ATTACK];
  const out = shuffle(actions).slice(0, AUTO_ACTIONS);
  while (out.length < AUTO_ACTIONS) out.push(actions[crypto.randomInt(0, actions.length)]);
  return out;
}

// Danno su un eroe: prima lo scudo, poi i PF. Restituisce i nuovi valori.
function hurt(p, dmg) {
  let rem = dmg;
  let shield = p.stats?.shield || 0;
  const hp = p.stats?.hp || 0;
  if (shield > 0) { if (shield >= rem) { shield -= rem; rem = 0; } else { rem -= shield; shield = 0; } }
  const newHp = Math.max(0, hp - rem);
  return { newHp, shield, killed: hp > 0 && newHp <= 0 };
}

// true = ha agito (e il turno è già passato agli eroi).
async function maybeAutoBossTurn({ dbAdmin, FieldValue, BOSS_SYSTEM_UID, PLAYER_TURN_DURATION_MS, BOSS_TURN_DURATION_MS }) {
  const turnRef = dbAdmin.doc("battle_meta/turn_tracker");
  const pre = (await turnRef.get()).data();
  if (!pre || pre.fightStarted !== true || pre.phase !== "boss") return false;
  const startMs = toMs(pre.expiryDate) - BOSS_TURN_DURATION_MS;
  if (!Number.isFinite(startMs) || Date.now() - startMs < AUTO_AFTER_MS) return false;
  const acts = pre.bossActs?.t === pre.turnNumber ? pre.bossActs : null;
  if (acts && ((acts.boss || 0) > 0 || (acts.minion || 0) > 0)) return false;   // il Master ha agito
  if (pre.bossAutoTurn === pre.turnNumber) return false;

  const bossSnap = (await dbAdmin.collection("bosses").where("isActive", "==", true).get())
    .docs.find((d) => (d.data().hp ?? 0) > 0);
  if (!bossSnap) return false;

  // Prenotazione: un solo giro automatico per turno, anche se due esecuzioni si accavallano.
  let claimed = false;
  await dbAdmin.runTransaction(async (tx) => {
    const d = (await tx.get(turnRef)).data() || {};
    if (d.phase !== "boss" || d.bossAutoTurn === d.turnNumber) return;
    const a = d.bossActs?.t === d.turnNumber ? d.bossActs : null;
    if (a && ((a.boss || 0) > 0 || (a.minion || 0) > 0)) return;
    tx.update(turnRef, { bossAutoTurn: d.turnNumber });
    claimed = true;
  });
  if (!claimed) return false;

  const turn = pre.turnNumber || 1;
  const bossRef = bossSnap.ref;
  const baseBoss = { id: bossSnap.id, ...bossSnap.data() };
  const actions = Array.isArray(baseBoss.actions) ? baseBoss.actions.filter((a) => a && a.name) : [];
  const chat = dbAdmin.collection("world_boss_chat");
  const hidden = await loadHidden();
  const loadHeroes = async () => (await dbAdmin.collection("characters").get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => {
      const first = String(p.name || "").trim().split(/\s+/)[0].toLowerCase();
      return (p.stats?.hp ?? 0) > 0 && !/^master$/i.test(String(p.name || "").trim())
        && !hidden.uids.has(p.id) && !hidden.names.has(first);
    });
  const randomTargets = (heroes) => shuffle(heroes).slice(0, crypto.randomInt(1, Math.min(MAX_TARGETS, heroes.length) + 1));
  const say = (category, actionName, description, extra = {}) => chat.add({
    uid: BOSS_SYSTEM_UID, senderName: baseBoss.name, type: "action", category,
    actionName: `${actionName} (automatico)`, description, timestamp: FieldValue.serverTimestamp(), ...extra,
  });

  const picked = pickActions(actions);
  for (const action of picked) {
    // boss e eroi riletti a ogni azione: la prima può cambiare vantaggio, PF, scudi
    const boss = { ...baseBoss, ...((await bossRef.get()).data() || {}) };
    const type = action.type || "attack";
    const turns = effectTurns(action);
    const turnsTxt = `per ${turns} turn${turns === 1 ? "o" : "i"}`;
    const el = DMG_EL[String(action.dmgType || "").toLowerCase()] || "physical";

    if (type === "heal") {
      const formula = formulaOf(action, true);
      const healed = rollDice(formula);
      const hp = boss.hp ?? 0, maxHp = boss.maxHp ?? hp;
      const newHp = Math.min(maxHp, hp + healed);
      await bossRef.update({ hp: newHp });
      await say("Cura Boss", action.name, `Il Boss invoca ${action.name} e si cura di 💖 ${newHp - hp} HP (${formula} = ${healed}). HP: ${newHp}/${maxHp}.`,
        { effect: "heal", effectEl: "radiant", effectTargets: ["boss"] });
      continue;
    }

    if (type === "buff_ca") {
      const bump = parseInt(action.acBonus) || 2;
      const buffs = [...activeAcBuffs(boss, turn), { bonus: bump, untilTurn: turn + turns, source: action.name || null }];
      await bossRef.update({ acBuffs: buffs });
      const ac = (parseInt(boss.ac) || 10) + buffs.reduce((s, b) => s + (parseInt(b.bonus) || 0), 0);
      await say("Buff Boss", action.name, `Il Boss usa ${action.name}: 🛡 CA +${bump} ${turnsTxt} (ora ${ac}).`,
        { effect: "shield", effectEl: el, effectTargets: ["boss"] });
      continue;
    }

    if (type === "buff_adv") {
      await bossRef.update({ nextTurnCondition: "advantage", condUntilTurn: turn + turns, debuffSource: action.name || null });
      await say("Buff Boss", action.name, `Il Boss invoca ${action.name}: ⬆ vantaggio sui suoi attacchi ${turnsTxt}.`,
        { effect: "buff", effectEl: el, effectTargets: ["boss"] });
      continue;
    }

    const heroes = await loadHeroes();
    if (!heroes.length) continue;

    if (type === "debuff_dis") {
      const targets = randomTargets(heroes);
      const batch = dbAdmin.batch();
      targets.forEach((p) => batch.update(dbAdmin.doc(`characters/${p.id}`),
        { nextTurnCondition: "disadvantage", condUntilTurn: turn + turns, debuffSource: action.name || null }));
      await batch.commit();
      await say("Debuff Boss", action.name, `Il Boss colpisce con ${action.name}: ⬇ svantaggio ai tiri di ${targets.map(firstName).join(", ")} ${turnsTxt}.`,
        { effect: "debuff", effectEl: "darkness", effectFrom: "boss", effectTargets: targets.map((p) => `player-${p.id}`) });
      continue;
    }

    // ── attacco a TIRO SALVEZZA (scelto nell'editor) o ad AREA (forma diversa da "singolo") ──
    const isArea = action.aoeShape && action.aoeShape !== "single";
    if (action.hitMode === "save" || isArea) {
      const targets = isArea ? heroes : randomTargets(heroes);
      const save = action.saveAbility || "dex";
      const dc = parseInt(action.saveDC) || parseInt(boss.spellDC) || 13;
      const half = action.halfOnSave !== false;
      const formula = formulaOf(action, false);
      const total = rollDice(formula);
      const batch = dbAdmin.batch();
      const results = targets.map((p) => {
        const cond = activeCond(p, turn);
        const r1 = rnd(20), r2 = rnd(20);
        const roll = cond === "advantage" ? Math.max(r1, r2) : cond === "disadvantage" ? Math.min(r1, r2) : r1;
        const mod = statSave(p, save);
        const saved = roll + mod >= dc;
        const dmg = saved ? (half ? Math.floor(total / 2) : 0) : total;
        const h = hurt(p, dmg);
        const patch = {};
        if (dmg > 0) Object.assign(patch, { "stats.hp": h.newHp, "stats.shield": h.shield });
        if (cond) Object.assign(patch, condConsumePatch(p) || {});
        if (Object.keys(patch).length) batch.update(dbAdmin.doc(`characters/${p.id}`), patch);
        return {
          id: p.id, name: firstName(p), hit: dmg > 0, dmg, killed: dmg > 0 && h.killed,
          roll: `TS ${SAVE_IT[save] || save} d20(${roll})${mod ? (mod > 0 ? "+" : "") + mod : ""}=${roll + mod} vs CD ${dc}${saved ? " ✅" : " ❌"}`,
        };
      });
      await batch.commit();
      const line = results.map((r) => `${r.name} −${r.dmg}${r.dmg === 0 ? " (evitato)" : r.dmg < total ? " (metà)" : ""}${r.killed ? " ☠" : ""}`).join(", ");
      await say("Attacco Boss", `${action.name} ${isArea ? "AREA" : "TS"}`,
        `Il Boss scatena da solo ${action.name}${isArea ? " su tutta la zona" : ""} · CD ${dc}, TS ${SAVE_IT[save] || save} · Danni ${formula} = ${total} → ${line}`,
        {
          masterDetails: results, effect: isArea ? "aoe" : "bolt", effectEl: el, effectFrom: "boss",
          effectTargets: results.map((r) => `player-${r.id}`),
          effectMissTargets: results.filter((r) => r.dmg === 0).map((r) => `player-${r.id}`),
          effectKill: results.filter((r) => r.killed).map((r) => `player-${r.id}`),
        });
      continue;
    }

    // ── attacco col tiro per colpire contro la CA ──
    const targets = randomTargets(heroes);
    const cond = activeCond(boss, turn);
    let d20, rollLabel;
    if (cond) {
      const r1 = rnd(20), r2 = rnd(20);
      d20 = cond === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
      rollLabel = `${cond === "advantage" ? "⬆ Vantaggio" : "⬇ Svantaggio"}[${r1},${r2}]→${d20}`;
      const used = condConsumePatch(boss);
      if (used) await bossRef.update(used);
    } else {
      d20 = rnd(20);
      rollLabel = `d20(${d20})`;
    }
    const bonus = parseInt(action.bonus) || 0;
    const hitTotal = d20 + bonus;
    const dmg = rollDice(formulaOf(action, false));
    const batch = dbAdmin.batch();
    const results = targets.map((p) => {
      const baseCA = p.stats?.ac || 10;
      const buff = p.selfAcBonus || 0;
      const ca = baseCA + buff;
      const hit = hitTotal >= ca;
      let killed = false;
      if (hit) {
        const h = hurt(p, dmg);
        killed = h.killed;
        batch.update(dbAdmin.doc(`characters/${p.id}`), { "stats.hp": h.newHp, "stats.shield": h.shield });
      }
      return {
        id: p.id, name: firstName(p), hit, killed,
        roll: `${hitTotal} (${d20}+${bonus}) vs CA ${ca}${buff ? ` (${baseCA}+${buff})` : ""}`,
        dmg: hit ? dmg : 0,
      };
    });
    await batch.commit();
    const hitNames = results.filter((r) => r.hit).map((r) => r.name).join(", ");
    const missNames = results.filter((r) => !r.hit).map((r) => r.name).join(", ");
    const condTag = cond === "disadvantage" ? " 🌑(svantaggio)" : cond === "advantage" ? " ⬆(vantaggio)" : "";
    await say("Attacco Boss", action.name,
      `Il Boss si scatena da solo con ${action.name}${condTag} · Tiro: ${rollLabel} + ${bonus} = ${hitTotal} (Danni: ${dmg})! ${hitNames ? "Colpisce: " + hitNames : ""}${missNames ? ". Mancati: " + missNames : ""}`,
      {
        masterDetails: results, effect: "slash", effectEl: el, effectFrom: "boss",
        effectTargets: results.map((r) => `player-${r.id}`),
        effectMissTargets: results.filter((r) => !r.hit).map((r) => `player-${r.id}`),
        effectKill: results.filter((r) => r.killed).map((r) => `player-${r.id}`),
      });
  }

  // ── Turno agli eroi ──
  let passed = false;
  await dbAdmin.runTransaction(async (tx) => {
    const d = (await tx.get(turnRef)).data() || {};
    if (d.phase !== "boss") return;
    tx.update(turnRef, {
      phase: "players", expiryDate: new Date(Date.now() + PLAYER_TURN_DURATION_MS),
      actedPlayers: [], turnNumber: (d.turnNumber || 0) + 1, bossActs: null,
      lastSwitchedAt: FieldValue.serverTimestamp(),
    });
    passed = true;
  });
  if (passed) {
    const turnMsg = "🛡️ Il Boss ha agito da solo. Eroi, tocca a voi!";
    await chat.add({
      text: turnMsg, senderName: "SISTEMA", uid: BOSS_SYSTEM_UID, content: turnMsg,
      category: "Turno", timestamp: FieldValue.serverTimestamp(), isSystem: true,
    });
  }
  console.log(`[wb-auto] ${baseBoss.name}: ${picked.map((a) => a.name).join(" + ")}, turno agli eroi.`);
  return true;
}

module.exports = { maybeAutoBossTurn, AUTO_AFTER_MS, loadHidden };
