export const RACE_CHANGE_COST = 1000;
export const RACES = {
  human: { name: "Umano", icon: "🧑", count: 2, stats: ["str", "dex", "con", "int", "wis", "cha"], desc: "+1 a due caratteristiche diverse." },
  elf: { name: "Elfo", icon: "🧝", count: 1, stats: ["wis", "int"], chance: .03, desc: "+1 SAG o INT · 3% di dimezzare un attacco magico." },
  halfling: { name: "Halfling", icon: "🍀", count: 1, stats: ["dex", "cha"], chance: .05, size: "small", desc: "+1 DES o CAR · taglia piccola · 5% di vantaggio con le armi." },
  dragonborn: { name: "Dragonide", icon: "🐲", count: 1, stats: ["con", "str"], chance: .05, desc: "+1 COS o FOR · 5% di dimezzare i danni fisici." },
  orc: { name: "Orco", icon: "👹", count: 1, stats: ["str", "con"], chance: .20, desc: "+1 FOR o COS · sotto il 30% PF, 20% di infliggere +5 danni con le armi." },
};

export function hasRace(hero) {
  const race = RACES[hero?.race], stats = hero?.raceStats;
  return !!race && Array.isArray(stats) && stats.length === race.count && new Set(stats).size === stats.length && stats.every((s) => race.stats.includes(s));
}

export function raceBonuses(hero) {
  return hasRace(hero) ? Object.fromEntries(hero.raceStats.map((s) => [s, 1])) : {};
}

// Il server applica questo risultato dentro la transazione della scheda.
export function chooseHeroRace(data, cls, race, stats) {
  const hero = data?.storyChars?.[cls];
  if (!hero) throw new Error("Crea prima l'eroe.");
  const choice = { race, raceStats: stats };
  if (!hasRace(choice)) throw new Error("Scegli la razza e le caratteristiche indicate, senza duplicati.");
  const same = hasRace(hero) && hero.race === race && stats.every((s) => hero.raceStats.includes(s));
  const cost = !hasRace(hero) || same ? 0 : RACE_CHANGE_COST;
  const coins = Math.max(0, Math.floor(Number(data.storyCoins) || 0));
  if (coins < cost) throw new Error(`Servono ${RACE_CHANGE_COST} Monete Antiche.`);
  return { race, raceStats: [...stats].sort(), cost, coins: coins - cost };
}
