// ── Arena · driver server-side dei PG-bot di RISERVA del torneo ──────────────
// Gira periodicamente (schedulata da index.js). Per ogni match di torneo che
// contiene un PG-bot di riserva (m.ai === true, id AI_BOT_*), quando è il turno
// del bot ne risolve iniziativa e azione (attacco/i + pozione se sotto soglia),
// poi passa il turno all'umano o chiude il match. Così i bot vanno avanti da soli,
// senza bisogno che il Master (o chiunque) tenga aperta la pagina Arena.
//
// Motore volutamente SEMPLICE (l'utente accetta un bot "casuale"): niente DoT,
// buff di classe, elementali o sottoclassi — solo colpo base plausibile ed equo.
// Le Sfide Libere contro l'IA (kind "fun") restano pilotate dal client e vengono
// ignorate qui.

const ARENA_TURN_DURATION = 60 * 60 * 1000; // 1h (allineato al client)
const AI_BOT_PREFIX = "AI_BOT_";

function rollDice(formula) {
  // Supporta un singolo termine "NdM" con eventuale "+K"/"-K".
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(formula || "").replace(/\s/g, ""));
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  let total = 0;
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * sides);
  if (m[3]) total += parseInt(m[3], 10);
  return total;
}

function avgDmg(formula) {
  const m = /^(\d+)d(\d+)/.exec(String(formula || ""));
  if (!m) return 0;
  return (parseInt(m[1], 10) * (parseInt(m[2], 10) + 1)) / 2;
}

// Azioni offensive (armi o spell con dado di danno), ordinate per danno medio desc.
function offensiveActions(snap) {
  const acts = Array.isArray(snap && snap.selectedActions) ? snap.selectedActions : [];
  const off = acts.filter(
      (a) => (a.type === "weapon" || a.type === "spell") && /^\d+d\d+/.test(String(a.damage || "")),
  );
  off.sort((a, b) => avgDmg(b.damage) - avgDmg(a.damage));
  return off;
}

// Attacchi per turno: ladro/monaco 2, resto 1.
function attacksPerTurn(cls) {
  const c = (cls || "").toLowerCase();
  return (c.includes("rogue") || c.includes("ladr") || c.includes("monk") || c.includes("monaco")) ? 2 : 1;
}

const upper = (s) => String(s || "?").toUpperCase();

/**
 * Esegue un tick del driver dei bot d'Arena.
 * @param {import("firebase-admin")} admin  istanza firebase-admin inizializzata
 */
async function runArenaBotTurns(admin) {
  const db = admin.firestore();
  const ref = db.doc("arena_meta/global");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data();
    if (data.phase !== "combat") return;      // solo a torneo in corso
    if (data.timerPaused) return;             // arena in pausa dal Master: fermi

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const snaps = data.characterSnapshots || {};
    let changed = false;

    const newMatches = matches.map((m) => {
      if (!m || m.ai !== true || !m.aiId) return m;
      if (m.kind === "fun") return m;                                   // sfide libere: client-side
      if (m.status !== "initiative" && m.status !== "active") return m; // niente da fare

      const aiId = m.aiId;
      const players = Array.isArray(m.players) ? m.players.map((p) => ({ ...p })) : [];
      const aiP = players.find((p) => p.id === aiId);
      const aiSnap = snaps[aiId];
      if (!aiP || !aiSnap) return m;

      // ── INIZIATIVA ────────────────────────────────────────────────────────
      if (m.status === "initiative") {
        if ((aiP.init || 0) > 0) return m; // il bot ha già tirato: aspetta l'umano
        const dex = (aiSnap.stats && aiSnap.stats.dex) || 0;
        aiP.init = 1 + Math.floor(Math.random() * 20) + dex;
        changed = true;
        const logs = [...(m.logs || []), `🎲 ${aiSnap.name} tira iniziativa: ${aiP.init}`];
        const allRolled = players.every((p) => (p.init || 0) > 0);
        if (!allRolled) return { ...m, players, logs };
        const sorted = [...players].sort((a, b) => (b.init || 0) - (a.init || 0));
        return {
          ...m,
          players,
          status: "active",
          turn: sorted[0].id,
          turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(),
          fightStartAt: m.fightStartAt || new Date().toISOString(),
          logs,
        };
      }

      // ── TURNO ATTIVO ──────────────────────────────────────────────────────
      if (m.turn !== aiId) return m; // non tocca al bot: gioca l'umano

      // Bot morto (per DoT/veleno applicati dall'umano) → chiudi il match.
      if ((aiP.hp || 0) <= 0) {
        const alive = players.filter((p) => (p.hp || 0) > 0);
        if (alive.length === 1) {
          changed = true;
          return { ...m, players, status: "finished", winner: alive[0].id, logs: [...(m.logs || []), `🏆 ${upper(alive[0].name)} È IL VINCITORE!`] };
        }
        return m;
      }

      const target = players.find((p) => p.id !== aiId && (p.hp || 0) > 0);
      if (!target) {
        changed = true;
        return { ...m, players, status: "finished", winner: aiId, logs: [...(m.logs || []), `🏆 ${upper(aiSnap.name)} È IL VINCITORE!`] };
      }
      const targetSnap = snaps[target.id] || {};
      const logs = [...(m.logs || [])];

      // Pozione di cura se sotto il 35% degli HP (azione gratuita, un po' "smart").
      const maxHp = (aiSnap.stats && aiSnap.stats.maxHp) || aiP.maxHp || 1;
      const potLeft = (aiP.itemUsesLeft && aiP.itemUsesLeft.pozione_cura) || 0;
      if (aiP.hp / maxHp < 0.35 && potLeft > 0) {
        const heal = rollDice("2d12");
        aiP.hp = Math.min(maxHp, aiP.hp + heal);
        aiP.itemUsesLeft = { ...(aiP.itemUsesLeft || {}), pozione_cura: potLeft - 1 };
        logs.push(`🧪 ${aiSnap.name} usa una Pozione di Cura (+${heal}) → ${aiP.hp} HP`);
      }

      // Attacco/i.
      const off = offensiveActions(aiSnap);
      const cls = (aiSnap.class || "").toLowerCase();
      const armorPenalty = (aiSnap.selectedArmor && aiSnap.selectedArmor.hitPenalty) || 0;
      const isFighter = cls.includes("fighter") || cls.includes("guerr");
      const critThresh = isFighter ? 19 : 20;
      const targetAc = (targetSnap.stats && targetSnap.stats.ac) || 12;

      if (off.length === 0) {
        logs.push(`⏭ ${aiSnap.name} non ha azioni offensive e passa il turno.`);
      } else {
        const nAtt = attacksPerTurn(cls);
        for (let i = 0; i < nAtt; i++) {
          if ((target.hp || 0) <= 0) break;
          const chosen = nAtt > 1 ? off[i % off.length] : off[0];
          const statKey = chosen.statKey || "str";
          const statMod = (aiSnap.stats && aiSnap.stats[statKey]) || 0;
          const d20 = 1 + Math.floor(Math.random() * 20);
          const isCrit = d20 >= critThresh;
          const hitTotal = d20 + (chosen.hitBonus || 0) + statMod + armorPenalty;
          if (isCrit || hitTotal >= targetAc) {
            const critMult = isCrit ? 2 : 1;
            const barb = cls.includes("barbar") ? 2 : 0;
            const dmg = Math.max(1, (rollDice(chosen.damage) + statMod + barb) * critMult);
            target.hp = Math.max(0, (target.hp || 0) - dmg);
            logs.push(`💥 ${aiSnap.name} colpisce ${target.name} con ${chosen.name}${isCrit ? " ★CRITICO★" : ""} — ${dmg} danni (${target.hp} HP)`);
          } else {
            logs.push(`🛡️ ${aiSnap.name} manca ${target.name} con ${chosen.name} (${hitTotal} vs CA ${targetAc})`);
          }
        }
        aiP.aiAttacksMade = (aiP.aiAttacksMade || 0) + nAtt;
      }
      changed = true;

      // Esito: vincitore o passaggio del turno all'umano.
      const alive = players.filter((p) => (p.hp || 0) > 0);
      if (alive.length === 1) {
        logs.push(`🏆 ${upper(alive[0].name)} È IL VINCITORE!`);
        return { ...m, players, status: "finished", winner: alive[0].id, logs };
      }
      return {
        ...m,
        players,
        turn: target.id,
        turnExpiry: new Date(Date.now() + ARENA_TURN_DURATION).toISOString(),
        logs,
      };
    });

    if (changed) tx.update(ref, { matches: newMatches });
  });
}

module.exports = { runArenaBotTurns, AI_BOT_PREFIX };
