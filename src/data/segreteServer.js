/* Ingresso del bundle del SERVER delle Segrete (functions/segreteBundle.js,
   `npm run build:segrete`): il motore + i dati che servono alla callable segreteDo.
   Da rifare dopo ogni modifica a segreteEngine / segreteKits / segrete.js. */
export { newRun, act, useItem, timeout, nextFloor, flee, withRng, AFK_MS, xpGain } from "./segreteEngine";
export { mergeDungeons, mergeMonsters, diffOf, DEFAULT_FLOORS, storyLevelOf, heroOf, runsOf, nextRunsPatch, nextDailyPatch, DAILY_TOTAL, DAILY_RUNS, WEEKLY_RUNS, RUN_COUNTS_AFTER } from "./segrete";
export { MAX_STORY_LEVEL, validRespec, RESPEC_COST, validNewHero, weaponChoices, heroActions, heroPending, hpPending, poolFor, heroStats, levelOfXp, heroXp, heroLevel, XP_VERSION, STAT_KEYS, STAT_MAX, KITS, armorChoices, canWear, armorProf } from "./segreteKits";
export { currentWeekKey } from "./arenaWeek";
export { wonItemInboxDoc } from "../utils/foundryMap";
export { itemOf, isGear, battleItem, SHOP_ITEMS, bagOf, coinsOf, boughtToday, dailyLimit, romeDay, GIFT_FEE, GIFT_DAILY, giftsToday } from "./segreteItems";
