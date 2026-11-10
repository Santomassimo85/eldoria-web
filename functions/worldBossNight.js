const { worldBossNightWindow } = require("./worldBossSchedule");
const msOf = (v) => v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0;

// Lo stesso documento protegge le scritture all'01:00 esatta, prima del tick cron.
async function syncWorldBossNight({ dbAdmin, FieldValue, playerDuration }) {
  const turnRef = dbAdmin.doc("battle_meta/turn_tracker");
  const clockRef = dbAdmin.doc("world_boss_system/night_pause");
  let result = null;
  await dbAdmin.runTransaction(async (tx) => {
    result = null;
    const [turnSnap, clockSnap] = await Promise.all([tx.get(turnRef), tx.get(clockRef)]);
    const turn = turnSnap.data() || {}, prev = clockSnap.data() || {};
    const now = Date.now(), window = worldBossNightWindow(now);
    const missedPause = prev.endAt && msOf(prev.endAt) <= now;
    const resume = !window.paused && (turn.nightPaused || prev.paused || missedPause);
    // Anche la scadenza complessiva resta ferma: una notte non può far perdere
    // la battaglia mentre nessuno può giocare. La durata segue l'ora legale.
    if (turn.fightStarted && (window.paused || missedPause)) {
      const start = window.paused ? window.start : msOf(prev.startAt);
      const end = window.paused ? window.end : msOf(prev.endAt);
      const bosses = await tx.get(dbAdmin.collection("bosses").where("isActive", "==", true));
      for (const boss of bosses.docs) {
        const data = boss.data(), expiry = msOf(data.expiryDate);
        if (expiry > start && data.lastNightPauseStart !== start) {
          tx.update(boss.ref, { expiryDate: new Date(expiry + end - start).toISOString(), lastNightPauseStart: start });
        }
      }
    }
    if (msOf(prev.startAt) !== window.start || msOf(prev.endAt) !== window.end || prev.paused !== window.paused) {
      tx.set(clockRef, { startAt: new Date(window.start), endAt: new Date(window.end), paused: window.paused });
    }
    if (!turnSnap.exists) return;
    if (window.paused && !turn.nightPaused) {
      tx.update(turnRef, { nightPaused: true });
      result = turn.fightStarted ? "paused" : null;
    } else if (resume) {
      tx.update(turnRef, {
        nightPaused: false,
        ...(turn.fightStarted ? {
          phase: "players", expiryDate: new Date(now + playerDuration),
          actedPlayers: [], turnActions: {}, bossActs: null,
          bossAutoTurn: null, quorumTurn: null, turnNumber: (turn.turnNumber || 0) + 1,
          lastSwitchedAt: FieldValue.serverTimestamp(),
        } : {}),
      });
      result = turn.fightStarted ? "resumed" : null;
    }
  });
  return result;
}
module.exports = { syncWorldBossNight };
