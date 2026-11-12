/* DEMO: il "server" del gioco gira qui, nel browser, col motore vero. */
import { readDoc, writeDoc } from "./store";
import { newRun, act, useItem, timeout, nextFloor, flee, openChest } from "../../src/data/segreteEngine";
import { mergeDungeons, mergeMonsters, heroOf } from "../../src/data/segrete";
import { KITS, validNewHero, hpPending, armorChoices, armorProf, weaponChoices, XP_VERSION } from "../../src/data/segreteKits";
import { battleItem } from "../../src/data/segreteItems";
import { chooseHeroRace } from "../../src/data/segreteRaces";
import { DEMO_UID, DEMO_ROOM, DEMO_DUNGEON, DEMO_FLOORS } from "../demoConfig";

const char = () => readDoc("characters", DEMO_UID) || {};
const saveHero = (cls, patch) => {
  const c = char();
  writeDoc("characters", DEMO_UID, { ...c, storyChars: { ...(c.storyChars || {}), [cls]: { ...(c.storyChars?.[cls] || {}), ...patch } } });
};
const bestiary = () => mergeMonsters([]).filter((m) => m.id !== "mimic" && (m.dungeons || []).includes(DEMO_DUNGEON));
const mimic = () => mergeMonsters([]).find((m) => m.id === "mimic");

function heroOp(op, d) {
  const cls = String(d.cls || "");
  if (!KITS[cls]) throw new Error("Classe sconosciuta.");
  const hero = heroOf(char(), cls);
  if (op === "heroCreate") {
    if (hero) throw new Error("Hai già un eroe di questa classe.");
    const bad = validNewHero(cls, d.stats, d.pick, d.weapon, d.armor || null);
    if (bad) throw new Error(bad);
    saveHero(cls, { stats: d.stats, asi: {}, picks: [d.pick], weapon: d.weapon, ...(d.armor ? { armor: d.armor } : {}), shield: d.shield !== false, xp: 0, xpv: XP_VERSION, createdAt: Date.now() });
    return { ok: true };
  }
  if (!hero) throw new Error("Prima crea l'eroe.");
  if (op === "heroHp") {
    if (hpPending(hero) <= 0) throw new Error("PF già tirati.");
    const die = KITS[cls].hitDie, roll = 1 + Math.floor(Math.random() * die);
    saveHero(cls, { hpRolls: [...(hero.hpRolls || []), roll] });
    return { ok: true, roll, die, level: (hero.hpRolls || []).length + 1 };
  }
  if (op === "heroRace") {
    const c = chooseHeroRace(char(), cls, String(d.race || ""), d.stats);
    saveHero(cls, { race: c.race, raceStats: c.raceStats });
    return { ok: true, cost: 0 };
  }
  if (op === "heroArmor") {
    if (d.shieldOnly) {
      if (!armorProf(cls).shield) throw new Error("Questa classe non usa lo scudo.");
      saveHero(cls, { shield: d.shield !== false });
      return { ok: true };
    }
    if (!armorChoices(cls).includes(String(d.armor || ""))) throw new Error("Armatura non adatta a questa classe.");
    saveHero(cls, { armor: String(d.armor), shield: d.shield !== false });
    return { ok: true };
  }
  if (op === "heroWeapon") {
    if (!weaponChoices(cls).some((w) => w.key === d.weapon)) throw new Error("Arma non valida per questa classe.");
    saveHero(cls, { weapon: d.weapon });
    return { ok: true };
  }
  throw new Error("Non disponibile nella demo.");
}

function runOp(op, d) {
  const now = Date.now();
  const room = readDoc("dungeon_rooms", DEMO_ROOM);
  if (!room) throw new Error("Nessuna partita.");
  const startKey = room.startKey;
  let run = readDoc("dungeon_runs", DEMO_ROOM);
  if (run && run.startKey !== startKey) run = null;
  if (op === "init") {
    if (run) return { ok: true, already: true };
    const m = room.members[0];
    const dungeon = mergeDungeons([]).find((x) => x.key === DEMO_DUNGEON);
    const fresh = newRun({
      room: { ...room, id: DEMO_ROOM, startKey },
      heroes: [{ uid: DEMO_UID, name: m.name, cls: m.cls, avatar: "", hero: heroOf(char(), m.cls) }],
      bestiary: bestiary(),
      dungeon: { ...dungeon, name: "Le Segrete · Demo", floors: DEMO_FLOORS, lootChance: 0 },
      now,
    });
    writeDoc("dungeon_runs", DEMO_ROOM, { ...fresh, members: [DEMO_UID], updatedAt: now });
    return { ok: true };
  }
  if (!run) throw new Error("La partita non è ancora iniziata.");
  if (op === "item") {
    const id = String(d.itemId || "");
    if (!battleItem(id)) throw new Error("Oggetto non usabile in lotta.");
    const c = char();
    if (!((c.storyBag || {})[id] > 0)) throw new Error("Non hai più questo oggetto nello zaino.");
    useItem(run, DEMO_UID, { itemId: id, targetId: d.targetId || null }, now);
    writeDoc("characters", DEMO_UID, { ...c, storyBag: { ...c.storyBag, [id]: c.storyBag[id] - 1 } });
  } else if (op === "act") act(run, DEMO_UID, { actionId: String(d.actionId || ""), targetId: d.targetId || null, amount: d.amount }, now);
  else if (op === "timeout") timeout(run, now, mimic());
  else if (op === "next") nextFloor(run, bestiary(), now);
  else if (op === "chest") openChest(run, DEMO_UID, now, mimic());
  else if (op === "flee") flee(run, DEMO_UID, now);
  else throw new Error("Non disponibile nella demo.");
  // bestiario scoperto: i mostri abbattuti diventano "conosciuti" nella scheda del nemico
  const known = { ...(readDoc("dungeon_meta", "known")?.sources || {}) };
  (run.foes || []).filter((f) => f.hp <= 0 && !f.recorded && f.src).forEach((f) => {
    f.recorded = true;
    known[f.src] = { name: String(f.name || "").replace(/ [A-Z]$/, ""), count: (known[f.src]?.count || 0) + 1, lastAt: now };
  });
  writeDoc("dungeon_meta", "known", { sources: known });
  writeDoc("dungeon_runs", DEMO_ROOM, { ...run, updatedAt: now });
  return { ok: true };
}

export const getFunctions = () => ({});
export function httpsCallable() {
  return async (data = {}) => {
    await new Promise((r) => setTimeout(r, 120));
    const op = String(data.op || "");
    return { data: op.startsWith("hero") ? heroOp(op, data) : runOp(op, data) };
  };
}
