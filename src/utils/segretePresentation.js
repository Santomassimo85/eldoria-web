// Le risposte del server non sono ancora gli esiti mostrati al giocatore.
export function presentCombatRow(run, row) {
  if (!run) return run;
  const apply = (c) => row.nums?.[c.id] == null ? c : { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp + row.nums[c.id])) };
  return { ...run, heroes: run.heroes.map(apply), foes: run.foes.map(apply),
    log: [...run.log.filter((l) => l.i !== row.i), row].slice(-80) };
}

export function hideChestRewards(run) {
  if (!run?.chest) return run;
  const gains = {}, spoils = {};
  for (const [uid, rows] of Object.entries(run.gains || {})) {
    gains[uid] = rows.filter((g) => g.src !== 'scrigno');
    const old = run.spoils?.[uid] || { coins: 0, items: {} };
    const items = { ...old.items };
    let coins = old.coins || 0;
    for (const g of rows.filter((g) => g.src === 'scrigno')) {
      coins -= g.c || 0;
      if (g.it) { items[g.it] = Math.max(0, (items[g.it] || 0) - 1); if (!items[g.it]) delete items[g.it]; }
    }
    spoils[uid] = { ...old, coins: Math.max(0, coins), items };
  }
  return { ...run, gains, spoils: { ...run.spoils, ...spoils },
    log: run.log.filter((l) => !l.chestReveal && !(l.kind === 'loot' && /apre lo scrigno/.test(l.txt || '')) && l.kind !== 'end') };
}

export function chestRollBatches(item) {
  if (item.solo || (item.rolls || []).length < 2) return [];
  return [item.rolls, ...(item.rerolls || [])].filter((batch) => batch.length > 1);
}
