// World Boss: il boss agisce DA SOLO quando il Master non c'è.
// Se il turno del boss è iniziato da AUTO_AFTER_MS e il Master non ha fatto nessuna
// azione (turn_tracker.bossActs vuoto per questo turno), il server fa 2 azioni:
//   1) un attacco a caso del boss contro da 1 a 6 eroi a caso (vivi, attivi, mai doppi);
//   2) una cura (l'azione di cura del boss, o una rigenerazione di riserva).
// Poi il turno passa agli eroi. Stesse regole del pannello del Master in WorldBoss.jsx
// (tiro per colpire contro la CA + buff, scudo prima dei PF, un solo tiro di danni).
const crypto = require("crypto");

const AUTO_AFTER_MS = 55 * 60 * 1000;
const MAX_TARGETS = 6;
const FALLBACK_ATTACK = { name: "Colpo furioso", diceNum: 1, diceType: "d10", bonus: 5 };
const FALLBACK_HEAL = { name: "Rigenerazione", diceNum: 2, diceType: "d8", bonus: 0 };
const HIDDEN_URL = "https://raw.githubusercontent.com/Santomassimo85/eldoria-web/main/src/data/hiddenPlayers.js";

const rnd = (n) => crypto.randomInt(1, n + 1);
const toMs = (v) => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : NaN);

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

  const boss = { id: bossSnap.id, ...bossSnap.data() };
  const bossRef = bossSnap.ref;
  const actions = Array.isArray(boss.actions) ? boss.actions.filter((a) => a && a.name) : [];
  const chat = dbAdmin.collection("world_boss_chat");

  // ── 1) ATTACCO a caso contro 1–6 eroi a caso ──
  const hidden = await loadHidden();
  const heroes = (await dbAdmin.collection("characters").get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => {
      const first = String(p.name || "").trim().split(/\s+/)[0].toLowerCase();
      return (p.stats?.hp ?? 0) > 0 && !/^master$/i.test(String(p.name || "").trim())
        && !hidden.uids.has(p.id) && !hidden.names.has(first);
    });
  const attacks = actions.filter((a) => (a.type || "attack") === "attack" && a.hitMode !== "save");
  const attack = attacks.length ? attacks[crypto.randomInt(0, attacks.length)] : FALLBACK_ATTACK;
  if (heroes.length) {
    const n = crypto.randomInt(1, Math.min(MAX_TARGETS, heroes.length) + 1);
    const targets = shuffle(heroes).slice(0, n);
    const cond = boss.nextTurnCondition;
    let d20, rollLabel;
    if (cond === "advantage" || cond === "disadvantage") {
      const r1 = rnd(20), r2 = rnd(20);
      d20 = cond === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
      rollLabel = `${cond === "advantage" ? "⬆ Vantaggio" : "⬇ Svantaggio"}[${r1},${r2}]→${d20}`;
      await bossRef.update({ nextTurnCondition: null, debuffSource: null });
    } else {
      d20 = rnd(20);
      rollLabel = `d20(${d20})`;
    }
    const bonus = parseInt(attack.bonus) || 0;
    const hitTotal = d20 + bonus;
    const dmgFormula = formulaOf(attack, false);
    const dmg = rollDice(dmgFormula);
    const results = [];
    const batch = dbAdmin.batch();
    for (const p of targets) {
      const baseCA = p.stats?.ac || 10;
      const buff = p.selfAcBonus || 0;
      const ca = baseCA + buff;
      const hit = hitTotal >= ca;
      const hp = p.stats?.hp || 0;
      let newHp = hp;
      if (hit) {
        let rem = dmg;
        let shield = p.stats?.shield || 0;
        if (shield > 0) { if (shield >= rem) { shield -= rem; rem = 0; } else { rem -= shield; shield = 0; } }
        newHp = Math.max(0, hp - rem);
        batch.update(dbAdmin.doc(`characters/${p.id}`), { "stats.hp": newHp, "stats.shield": shield });
      }
      results.push({
        id: p.id, name: String(p.name || "Eroe").split(" ")[0], hit,
        roll: `${hitTotal} (${d20}+${bonus}) vs CA ${ca}${buff ? ` (${baseCA}+${buff})` : ""}`,
        dmg: hit ? dmg : 0, killed: hit && hp > 0 && newHp <= 0,
      });
    }
    await batch.commit();
    const hitNames = results.filter((r) => r.hit).map((r) => r.name).join(", ");
    const missNames = results.filter((r) => !r.hit).map((r) => r.name).join(", ");
    const condTag = cond === "disadvantage" ? " 🌑(svantaggio)" : cond === "advantage" ? " ⬆(vantaggio)" : "";
    await chat.add({
      uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Attacco Boss",
      actionName: `${attack.name} (automatico)`,
      description: `Il Boss si scatena da solo con ${attack.name}${condTag} · Tiro: ${rollLabel} + ${bonus} = ${hitTotal} (Danni: ${dmg})! ${hitNames ? "Colpisce: " + hitNames : ""}${missNames ? ". Mancati: " + missNames : ""}`,
      masterDetails: results, timestamp: FieldValue.serverTimestamp(),
      effect: "slash", effectEl: "physical", effectFrom: "boss",
      effectTargets: results.map((r) => `player-${r.id}`),
      effectMissTargets: results.filter((r) => !r.hit).map((r) => `player-${r.id}`),
      effectKill: results.filter((r) => r.killed).map((r) => `player-${r.id}`),
    });
  }

  // ── 2) CURA ──
  const heals = actions.filter((a) => a.type === "heal");
  const heal = heals.length ? heals[crypto.randomInt(0, heals.length)] : FALLBACK_HEAL;
  const healFormula = formulaOf(heal, true);
  const healed = rollDice(healFormula);
  const freshHp = (await bossRef.get()).data()?.hp ?? boss.hp ?? 0;
  const maxHp = boss.maxHp ?? freshHp;
  const newHp = Math.min(maxHp, freshHp + healed);
  await bossRef.update({ hp: newHp });
  await chat.add({
    uid: BOSS_SYSTEM_UID, senderName: boss.name, type: "action", category: "Cura Boss",
    actionName: `${heal.name} (automatico)`,
    description: `Il Boss invoca ${heal.name} e si cura di 💖 ${newHp - freshHp} HP (${healFormula} = ${healed}). HP: ${newHp}/${maxHp ?? "?"}.`,
    effect: "heal", effectEl: "radiant", effectTargets: ["boss"],
    timestamp: FieldValue.serverTimestamp(),
  });

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
  console.log(`[wb-auto] ${boss.name}: ${attack.name} + ${heal.name}, turno agli eroi.`);
  return true;
}

module.exports = { maybeAutoBossTurn, AUTO_AFTER_MS };
