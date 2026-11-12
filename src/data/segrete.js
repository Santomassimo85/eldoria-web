/* ============================================================
   LE SEGRETE (story mode della Sala della Gloria, 2026-11-04)
   Dati condivisi fra lobby, admin e (fase 3) motore del combattimento.
   - Gruppi da 1 a MAX_PARTY giocatori, si parte quando TUTTI premono Avvia.
   - Tipi di dungeon (caverna, segrete, magma…): quelli base qui sotto, il
     Master ne aggiunge/modifica in dungeon_types/{key} (fase 2). Ogni tipo
     ha i suoi mostri frontali e le texture in dungeon_tiles/{key}.
   - Eroi permanenti per classe: livello e progressione si accumulano giocando.
   ============================================================ */
import { ARENA_CLASSES } from "./arenaClassSprites";
import { currentWeekKey } from "./arenaWeek";
import { heroLevel } from "./segreteKits";

export const MAX_PARTY = 4;
/* COMPAGNIA (2026-11-10): incentivo a giocare in gruppo. Bonus leggeri che crescono col numero di eroi
   all'inizio del dungeon (aiuti compresi; resta fisso anche se qualcuno fugge o cade): TS, colpire e CD,
   PF (che NON alzano il danno dei mostri), Monete Antiche e PE (solo a chi i premi li prende), e in 4
   una possibilità in più di un oggetto nello scrigno. Da soli niente (restano ×1,2 PF e ×0,75 PE). */
export const COMPANY = {
  1: { save: 0, hit: 0, hp: 0, coins: 1, xp: 1, chest: 0 },
  2: { save: 1, hit: 0, hp: 0, coins: 1.1, xp: 1.05, chest: 0 },
  3: { save: 1, hit: 1, hp: 0, coins: 1.2, xp: 1.1, chest: 0 },
  4: { save: 1, hit: 1, hp: 0.05, coins: 1.3, xp: 1.15, chest: 0.25 },
};
export const companyOf = (n) => COMPANY[Math.max(1, Math.min(MAX_PARTY, Number(n) || 1))];
const pct = (m) => `+${Math.round((m - 1) * 100)}%`;
export function companyLines(n) {
  const c = companyOf(n), out = [];
  if (c.save) out.push(`+${c.save} ai tiri salvezza`);
  if (c.hit) out.push(`+${c.hit} a colpire e alla CD`);
  if (c.hp) out.push(`+${Math.round(c.hp * 100)}% PF`);
  if (c.coins > 1) out.push(`${pct(c.coins)} Monete Antiche`);
  if (c.xp > 1) out.push(`${pct(c.xp)} PE`);
  if (c.chest) out.push(`scrigno: ${Math.round(c.chest * 100)}% di un oggetto in più`);
  return out;
}
// Se qualcuno sparisce durante il dungeon: dopo 5 minuti (era 10 fino al 2026-11-05) il suo turno è difensivo.
export const AFK_DEFEND_MS = 5 * 60 * 1000;
// Stanze aperte e ferme da più di tanto si possono sciogliere (il Master o chi entra).
export const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;

export const DEFAULT_DUNGEONS = [
  { key: "torre_vethrik", name: "La Torre di Vethrik", icon: "🗼", isTower: true, floors: 100, desc: "100 piani sempre diversi: stanze, biomi e mostri si rigenerano ad ogni piano con difficoltà crescente. Solo il Capo spende 1 Sigillo. Dà PE ad ogni piano; ogni domenica alle 23:00 si resetta e assegna i Premi Unici del piano raggiunto." },
  { key: "segrete", name: "Le Segrete", icon: "⛓", desc: "Celle umide, catene e guardie che non dormono mai. Non morti e banditi." },
  { key: "caverna", name: "La Caverna", icon: "🕳", desc: "Gallerie strette nel buio: bestie, goblin e ragni giganti." },
  { key: "magma", name: "Caverna di Magma", icon: "🌋", desc: "Fiumi di lava e aria che brucia: elementali del fuoco e salamandre." },
  // 2026-11-06
  { key: "ghiaccio", name: "Il Ghiacciaio Eterno", icon: "🧊", desc: "Gallerie di ghiaccio azzurro e vento che taglia: lupi dell'inverno, mefiti di brina e la Regina di Brina." },
  { key: "palude", name: "La Palude Marcia", icon: "🐸", desc: "Acqua nera, nebbia e fango che risucchia: annegati che si rialzano e troll che non muoiono mai del tutto." },
  { key: "tempio", name: "Il Tempio Sepolto", icon: "🏛", desc: "Rovine di un culto dimenticato sotto la sabbia: guardiani di pietra, morti inquieti e trappole antiche." },
  { key: "cripta", name: "La Cripta degli Echi", icon: "💀", desc: "Catacombe di ossa e pietra nera, percorse da sussurri. Scheletri, spettri e il Cantore Sepolto.", tiles: { colors: "bone white, black stone, ghostly green", wall: "black stone burial niches filled with bones and skulls", floor: "cracked funeral slabs and scattered bones", ceil: "low vaulted crypt ceiling with carved skulls" } },
  { key: "forgia", name: "La Forgia della Tempesta", icon: "⚡", desc: "Una fucina di rame e ferro carica di fulmini. Costrutti, fabbri runici e il Colosso della Tempesta.", tiles: { colors: "dark iron, copper, electric blue", wall: "riveted dark iron panels with copper conduits and blue electrical coils", floor: "iron grates and copper runic circuits", ceil: "heavy iron beams and insulated copper cables" } },
  { key: "abisso", name: "L'Abisso Sommerso", icon: "🌊", desc: "Un santuario sprofondato nel mare, fra coralli e riflessi turchesi. Predatori abissali e la Regina delle Maree.", tiles: { colors: "deep navy, turquoise, sea green", wall: "flooded temple stone covered in barnacles and dark coral", floor: "wet mosaic slabs with seaweed and shallow water", ceil: "dark stone arches under shimmering blue water" } },
];

/* DIFFICOLTÀ (2026-11-06): il capo del gruppo sceglie Facile (il gioco di sempre), Medio o
   Leggenda. Per Medio e Leggenda OGNI eroe del gruppo deve avere almeno `minLevel` (il Master
   è esente). Mostri: PF ×hp, danni ×dmg, +plus a colpire/CD/CA/TS, élite più frequenti (tarato con le
   simulazioni del 2026-11-06: al livello minimo Medio ~20 punti di vittorie in meno, Leggenda ~25).
   Premi: monete ×coins, PE ×xp, probabilità di un oggetto ×item, rarità alte
   ×boost, forziere del Master ×chest; gli oggetti con `minDiff` escono solo da lì in su. */
export const DIFFICULTIES = [
  { key: "facile", name: "Facile", icon: "🟢", rank: 0, minLevel: 1, hp: 1, dmg: 1, plus: 0, elite: 0.4, coins: 1, xp: 1, item: 1, chest: 1, boost: {}, desc: "Il dungeon di sempre: per tutti i livelli." },
  { key: "medio", name: "Medio", icon: "🟡", rank: 1, minLevel: 8, hp: 1.12, dmg: 1.08, plus: 0, elite: 0.5, coins: 1.5, xp: 1.3, item: 1.5, chest: 1.25, boost: { rare: 1.5, veryRare: 1.5 }, desc: "Mostri più duri e più élite. Più monete, PE e oggetti rari." },
  { key: "leggenda", name: "Leggenda", icon: "🔴", rank: 2, minLevel: 12, hp: 1.2, dmg: 1.12, plus: 1, elite: 0.55, coins: 2, xp: 1.6, item: 2, chest: 1.5, boost: { rare: 2, veryRare: 3 }, desc: "Solo per veterani: i mostri picchiano forte. Bottino doppio e oggetti che non escono altrove." },
];
export const diffOf = (key) => DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[0];

/* MOSTRI DI BASE (2026-11-06): stanno nel codice come i dungeon di base e si uniscono al
   bestiario (dungeon_monsters). Il Master li modifica dall'admin: il salvataggio crea un doc
   con lo STESSO id che li sovrascrive; eliminarli = doc con hidden: true. */
const BA = (name, diceNum, diceType, bonus, extra = {}) => ({ type: "attack", name, diceNum, diceType, bonus, hitMode: "hit", aoeShape: "single", dmgType: "", ...extra });
export const MIMIC_MONSTER = {
  id: "mimic", name: "Mimic", icon: "👹", role: "elite", size: "medium", level: 1,
  hp: 40, ac: 13, init: 0, save: 0, dungeons: [],
  desc: "Uno scrigno vivente con denti e lingua: appare solo nel tesoro finale (10%).",
  look: "A living wooden treasure chest mimic with iron bands, lid open as a huge mouth lined with sharp ivory teeth, a long purple tongue and sticky acidic pseudopods. Recognizable treasure chest silhouette, sinister dungeon monster, no humanoid body.",
  frontImageUrl: "",
  resistances: [], vulnerabilities: [], immunities: [],
  actions: [BA("Morso", 2, "d6", 5), BA("Pseudopode acido", 2, "d6", 5, { dmgType: "acido" })],
};
export const BASE_MONSTERS = [
  MIMIC_MONSTER,
  { id: "base-lupo-invernale", name: "Lupo Invernale", icon: "🐺", role: "minion", size: "medium", level: 2, hp: 15, ac: 13, init: 2, save: 1, dungeons: ["ghiaccio"],
    desc: "Lupo dal pelo bianco come la neve, caccia in branco e morde alle gambe.", resistances: ["cold"], vulnerabilities: ["fire"], immunities: [],
    actions: [BA("Morso Gelido", 1, "d8", 4, { dmgType: "ghiaccio" }), { type: "buff_adv", name: "Ululato del Branco", durationTurns: 2 }] },
  { id: "base-mefite-brina", name: "Mefite di Brina", icon: "❄", role: "minion", size: "small", level: 2, hp: 12, ac: 12, init: 2, save: 1, dungeons: ["ghiaccio"],
    desc: "Piccolo spirito dispettoso di ghiaccio, sputa schegge e soffia nevischio.", resistances: [], vulnerabilities: ["fire", "bludgeoning"], immunities: ["cold", "poison"],
    actions: [BA("Artiglio di Ghiaccio", 1, "d6", 3, { dmgType: "ghiaccio" }), BA("Soffio di Nevischio", 2, "d4", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "dex", saveDC: 11, halfOnSave: true })] },
  { id: "base-annegato", name: "Annegato", icon: "🧟", role: "minion", size: "medium", level: 1, hp: 16, ac: 10, init: 0, save: 0, dungeons: ["palude", "tempio"],
    desc: "Cadavere gonfio d'acqua che esce dal fango e trascina giù chi afferra.", resistances: [], vulnerabilities: ["radiant"], immunities: ["poison"],
    actions: [BA("Pugno Fradicio", 1, "d6", 3, { dmgType: "fisico" }), BA("Morsa del Fango", 1, "d8", 3, { dmgType: "oscurità", inflict: { key: "slow", chance: 35, save: "str" } })] },
  { id: "base-basilisco", name: "Basilisco del Tempio", icon: "🦎", role: "elite", size: "large", level: 4, hp: 40, ac: 15, init: 0, save: 2, dungeons: ["tempio"],
    desc: "Lucertolone a otto zampe che dorme fra le statue del tempio. Le statue, in effetti, sono i visitatori di prima.", resistances: [], vulnerabilities: [], immunities: ["poison"],
    actions: [BA("Morso Velenoso", 2, "d6", 4, { dmgType: "veleno" }), BA("Sguardo Pietrificante", 1, "d6", 0, { dmgType: "arcano", hitMode: "save", aoeShape: "single", saveAbility: "con", saveDC: 12, halfOnSave: true, inflict: { key: "petrified", chance: 40 } })] },
  { id: "base-troll-ghiacci", name: "Troll dei Ghiacci", icon: "🧌", role: "elite", size: "large", level: 4, hp: 45, ac: 14, init: 1, save: 2, dungeons: ["ghiaccio", "palude"],
    desc: "Troll enorme con la pelle coperta di brina: le ferite si richiudono, se non le bruci.", resistances: ["cold"], vulnerabilities: ["fire", "acid"], immunities: [],
    actions: [BA("Artigli", 2, "d6", 5), BA("Clava di Ghiaccio", 1, "d12", 5, { dmgType: "ghiaccio" }), { type: "heal", name: "Rigenerazione", diceNum: 2, diceType: "d6", bonus: 2 }] },
  { id: "base-regina-brina", name: "Vyrskaal, Regina di Brina", icon: "🐉", role: "boss", size: "huge", level: 6, hp: 90, ac: 16, init: 1, save: 4, dungeons: ["ghiaccio"],
    desc: "Giovane drago bianco che regna sul ghiacciaio: tutto quello che tocca diventa statua di ghiaccio.", resistances: [], vulnerabilities: ["fire"], immunities: ["cold"],
    actions: [BA("Morso", 2, "d10", 6), BA("Artigli di Brina", 2, "d6", 6, { dmgType: "ghiaccio" }),
      BA("Soffio Gelido", 6, "d8", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "con", saveDC: 15, halfOnSave: true }),
      { type: "buff_ca", name: "Corazza di Ghiaccio", acBonus: 2, durationTurns: 2 }, { type: "debuff_dis", name: "Tormenta Accecante", durationTurns: 2 }] },
  { id: "base-custode-ossa", creature: "non morto", name: "Custode d'Ossa", icon: "💀", role: "minion", level: 2, hp: 16, ac: 13, init: 1, save: 1, dungeons: ["cripta"], desc: "Scheletro in armatura spezzata armato di una lancia d'osso.", resistances: [], vulnerabilities: ["bludgeoning", "radiant"], immunities: ["poison"], actions: [BA("Lancia d'Osso", 1, "d8", 4)] },
  { id: "base-spettro-eco", creature: "non morto", name: "Spettro degli Echi", icon: "👻", role: "elite", level: 4, hp: 38, ac: 14, init: 3, save: 3, dungeons: ["cripta"], desc: "Spirito incatenato che assorbe la luce delle torce.", resistances: ["necrotic", "cold"], vulnerabilities: ["radiant"], immunities: ["poison"], actions: [BA("Tocco Sepolcrale", 2, "d6", 5, { dmgType: "oscurità" }), { type: "debuff_dis", name: "Sussurri dei Morti", durationTurns: 2 }] },
  { id: "base-cantore-sepolto", creature: "non morto", name: "Il Cantore Sepolto", icon: "👑", role: "boss", size: "large", level: 6, hp: 95, ac: 16, init: 2, save: 4, dungeons: ["cripta"], desc: "Re scheletrico con una corona d'ossa e una campana funebre al posto dello scettro.", resistances: ["necrotic"], vulnerabilities: ["radiant"], immunities: ["poison"], actions: [BA("Scettro d'Ossa", 2, "d8", 6), BA("Rintocco Funebre", 4, "d8", 0, { dmgType: "oscurità", hitMode: "save", aoeShape: "sphere", saveAbility: "wis", saveDC: 14, halfOnSave: true }), { type: "buff_ca", name: "Corteo delle Ossa", acBonus: 2, durationTurns: 2 }] },
  { id: "base-sentinella-rame", name: "Sentinella di Rame", icon: "🤖", role: "minion", level: 2, hp: 18, ac: 14, init: 0, save: 1, dungeons: ["forgia"], desc: "Automa di rame con una piccola bobina elettrica sul dorso.", resistances: ["lightning"], vulnerabilities: ["acid"], immunities: ["poison"], actions: [BA("Pugno di Rame", 1, "d8", 4), BA("Scintilla", 1, "d6", 4, { dmgType: "fulmine" })] },
  { id: "base-fabbro-runico", name: "Fabbro Runico", icon: "🔨", role: "elite", level: 4, hp: 44, ac: 15, init: 0, save: 3, dungeons: ["forgia"], desc: "Gigante corazzato con un martello attraversato da scariche blu.", resistances: ["fire"], vulnerabilities: ["cold"], immunities: [], actions: [BA("Martello della Forgia", 2, "d8", 5, { dmgType: "fulmine" }), { type: "buff_ca", name: "Piastre Runiche", acBonus: 2, durationTurns: 2 }] },
  { id: "base-colosso-tempesta", name: "Colosso della Tempesta", icon: "⚡", role: "boss", size: "huge", level: 6, hp: 100, ac: 16, init: 1, save: 4, dungeons: ["forgia"], desc: "Colosso di ferro e rame con un nucleo di fulmini imprigionati nel petto.", resistances: ["lightning", "fire"], vulnerabilities: ["acid"], immunities: ["poison"], actions: [BA("Maglio del Tuono", 2, "d10", 6), BA("Onda Elettrica", 4, "d8", 0, { dmgType: "fulmine", hitMode: "save", aoeShape: "sphere", saveAbility: "dex", saveDC: 14, halfOnSave: true }), { type: "buff_adv", name: "Sovraccarico", durationTurns: 2 }] },
  { id: "base-predatore-abissale", name: "Predatore Abissale", icon: "🐟", role: "minion", level: 2, hp: 16, ac: 12, init: 3, save: 1, dungeons: ["abisso"], desc: "Pesce anfibio dai denti trasparenti che striscia fra i coralli.", resistances: ["cold"], vulnerabilities: ["lightning"], immunities: [], actions: [BA("Morso Abissale", 1, "d8", 4)] },
  { id: "base-guardiano-corallo", name: "Guardiano di Corallo", icon: "🦀", role: "elite", level: 4, hp: 46, ac: 16, init: -1, save: 2, dungeons: ["abisso"], desc: "Granchio gigante ricoperto di coralli affilati e conchiglie antiche.", resistances: ["cold", "slashing"], vulnerabilities: ["lightning", "bludgeoning"], immunities: [], actions: [BA("Chela di Corallo", 2, "d8", 5), BA("Getto di Salamoia", 2, "d6", 4, { dmgType: "veleno" })] },
  { id: "base-regina-maree", name: "Regina delle Maree", icon: "🐙", role: "boss", size: "huge", level: 6, hp: 96, ac: 15, init: 2, save: 4, dungeons: ["abisso"], desc: "Antica creatura tentacolare con una corona di coralli e occhi turchesi luminosi.", resistances: ["cold"], vulnerabilities: ["lightning"], immunities: ["poison"], actions: [BA("Tentacolo Abissale", 2, "d10", 6), BA("Onda delle Profondità", 4, "d8", 0, { dmgType: "ghiaccio", hitMode: "save", aoeShape: "cone", saveAbility: "str", saveDC: 14, halfOnSave: true }), { type: "debuff_dis", name: "Nube d'Inchiostro", durationTurns: 2 }] },
];
/* bestiario completo: mostri di base (non sovrascritti) + documenti del Master, senza i nascosti */
export function mergeMonsters(docs = []) {
  const ids = new Set(docs.map((d) => d.id));
  return BASE_MONSTERS.filter((m) => !ids.has(m.id)).map((m) => ({ ...m, base: true }))
    .concat(docs.map((d) => (BASE_MONSTERS.some((m) => m.id === d.id) ? { ...BASE_MONSTERS.find((m) => m.id === d.id), ...d, base: true } : d)))
    .filter((m) => !m.hidden);
}


export const STORY_CLASSES = ARENA_CLASSES.map(({ key, it, icon }) => ({ key, it, icon }));
export const classInfo = (key) => STORY_CLASSES.find((c) => c.key === key) || null;
// colore di ogni classe nella lobby delle Segrete (carte, slot del gruppo, scheda dell'eroe)
export const CLASS_COLORS = {
  fighter: "#b9c6d8", barbarian: "#e2553f", paladin: "#f2c94c", ranger: "#3fae76",
  monk: "#45b8c4", rogue: "#9a9cb3", wizard: "#4f86ea", sorcerer: "#ff8a34",
  warlock: "#a95ee0", druid: "#a8c83c", cleric: "#f3ead0", bard: "#ea62ad",
};
export const classColor = (key) => CLASS_COLORS[key] || "#e0a85a";
export const clsStyle = (key) => ({ "--cls": classColor(key) });

// Eroe di classe (permanente, 2026-11-04): characters.storyChars[cls] = {stats, asi, picks, xp}.
export const heroOf = (charData, classKey) => charData?.storyChars?.[classKey] || null;
export function storyLevelOf(charData, classKey) {
  const h = heroOf(charData, classKey);
  return h ? heroLevel(h) : 1;
}

// Dungeon disponibili: quelli base, sovrascritti/integrati da dungeon_types del Master
// (un tipo con hidden: true sparisce dalla scelta).
export function mergeDungeons(custom = []) {
  const map = new Map(DEFAULT_DUNGEONS.map((d) => [d.key, d]));
  custom.forEach((d) => { if (d?.key) map.set(d.key, { ...(map.get(d.key) || {}), ...d }); });
  return [...map.values()].filter((d) => d.key === "torre_vethrik" || (!d.hidden && d.active !== false));
}

export const roomMember = (room, uid) => (room?.members || []).find((m) => m.uid === uid) || null;
export const roomFull = (room) => (room?.members || []).length >= MAX_PARTY;
export const allReady = (room) => (room?.members || []).length > 0 && room.members.every((m) => m.ready);

/* ── Bestiario e tipi di dungeon del Master (fase 2) ──────────────
   dungeon_types/{key}: { name, icon, desc, floors, hidden }
     floors = incontri prima del boss (il boss è l'ultima sala).
   dungeon_monsters/{id}: { name, desc, role, level, hp, ac, init, save,
     dungeons: [key], frontImageUrl, actions: [azione World
     Boss], resistances, vulnerabilities, immunities, source }
     role: minion (gruppi), elite (da solo o con 1-2 minion), boss (ultima sala). */
export const DEFAULT_FLOORS = 3;
// Taglia dei mostri (2026-11-05): scelta nell'admin, in lotta ingrandisce lo sprite.
// Senza taglia: boss Grande, gli altri Media.
export const MONSTER_SIZES = [
  { key: "tiny", label: "Minuscola", scale: 0.7 },
  { key: "small", label: "Piccola", scale: 0.85 },
  { key: "medium", label: "Media", scale: 1 },
  { key: "large", label: "Grande", scale: 1.3 },
  { key: "huge", label: "Enorme", scale: 1.6 },
  { key: "gargantuan", label: "Mastodontica", scale: 1.9 },
];
export const defaultSize = (role) => (role === "boss" ? "large" : "medium");
export const sizeOf = (m) => (MONSTER_SIZES.some((z) => z.key === m?.size) ? m.size : defaultSize(m?.role));
export const sizeScale = (m) => MONSTER_SIZES.find((z) => z.key === sizeOf(m))?.scale || 1;
export const MONSTER_ROLES = [
  { key: "minion", label: "Gregario", icon: "🐀", hint: "Escono in gruppo nelle sale normali." },
  { key: "elite", label: "Élite", icon: "💀", hint: "Più forte: da solo o con qualche gregario." },
  { key: "boss", label: "Boss", icon: "👑", hint: "L'ultima sala del dungeon." },
];
export const roleInfo = (k) => MONSTER_ROLES.find((r) => r.key === k) || MONSTER_ROLES[0];
export const dungeonSlug = (name) => String(name || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/* ── LIMITI (2026-11-04, rifatti): PER CLASSE, 1 dungeon al giorno (giorno di Roma)
   e 3 a settimana (settimana dell'Arena). Chi ha fatto il Mago oggi può giocare col
   Guerriero. Un dungeon CONTA solo dopo almeno RUN_COUNTS_AFTER sale ripulite (o la
   vittoria): chi cade prima può riprovare. Lo conta il SERVER (segreteDo), il
   Master principale è esente.
   characters.storyClassRuns[cls] = { weekKey, count, day, dayCount }
   (il vecchio characters.storyRuns, per giocatore, non si usa più). */
/* 2026-11-06: 3 dungeon COMPLETI al giorno per classe e basta: niente più limite settimanale
   né tetto per giocatore, e la domenica non si azzera niente. */
export const DAILY_RUNS = 3;
/* TETTO PER GIOCATORE (2026-11-04 sera): oltre a 1 per classe, al massimo DAILY_TOTAL
   dungeon FINITI al giorno in tutto (vinti o persi dopo la 2ª sala), contati alla fine
   della partita in characters.storyDaily = { day, count }. */
export const DAILY_TOTAL = Infinity; // tolto il 2026-11-06
export const dailyTotalOf = (charData, day = romeDayKey()) => (charData?.storyDaily?.day === day ? Number(charData.storyDaily.count) || 0 : 0);
export const nextDailyPatch = (charData, day = romeDayKey()) => ({ day, count: dailyTotalOf(charData, day) + 1 });
export const WEEKLY_RUNS = Infinity; // tolto il 2026-11-06
export const RUN_COUNTS_AFTER = 2;
export const romeDayKey = (now = Date.now()) => new Date(now).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
export function runsOf(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const r = charData?.storyClassRuns?.[cls];
  const weekCount = r && r.weekKey === week ? Number(r.count) || 0 : 0;
  const dayCount = r && r.day === day ? Number(r.dayCount) || 0 : 0;
  const total = dailyTotalOf(charData, day);
  const totalFull = total >= DAILY_TOTAL;
  return { weekCount, dayCount, total, totalFull, left: Math.max(0, DAILY_RUNS - dayCount), canRun: !totalFull && weekCount < WEEKLY_RUNS && dayCount < DAILY_RUNS };
}
export function nextRunsPatch(charData, cls, week = currentWeekKey(), day = romeDayKey()) {
  const { weekCount, dayCount } = runsOf(charData, cls, week, day);
  return { weekKey: week, count: weekCount + 1, day, dayCount: dayCount + 1 };
}

/* ── LA TORRE DI VETHRIK (100 piani procedurali, reset Domenica ore 23:00) ──
   - 3 Sigilli settimanali gratuiti per giocatore + Sigilli extra dallo zaino (`sigillo_vethrik`).
   - Solo il Capo del gruppo spende 1 Sigillo per aprire il portale a tutto il party (1–4 giocatori).
   - Se un giocatore rientra nella Torre, la nuova scalata SOSTITUISCE il suo piano settimanale precedente (effetto rischio). */
export const TOWER_KEY = "torre_vethrik";
export const TOWER_MAX_FLOORS = 100;
export const TOWER_WEEKLY_FREE = 3;
export const TOWER_BOSS_EVERY = 5;
export const isTowerDungeon = (key) => key === TOWER_KEY;

export function towerStatusOf(charData, week = currentWeekKey()) {
  const t = charData?.storyTower || {};
  const sameWeek = t.weekKey === week;
  const floor = sameWeek ? Math.max(0, Number(t.floor) || 0) : 0;
  const bestWeekFloor = sameWeek ? Math.max(floor, Number(t.bestWeekFloor) || 0) : 0;
  const allTimeBest = Math.max(bestWeekFloor, Number(t.allTimeBest) || 0);
  const usedFree = sameWeek ? Math.max(0, Number(t.usedFree) || 0) : 0;
  const freeLeft = Math.max(0, TOWER_WEEKLY_FREE - usedFree);
  const bagSeals = Math.max(0, Number(charData?.storyBag?.sigillo_vethrik) || 0);
  const totalSeals = freeLeft + bagSeals;
  return {
    weekKey: week,
    floor,
    bestWeekFloor,
    allTimeBest,
    usedFree,
    freeLeft,
    bagSeals,
    bagKeys: bagSeals,
    totalSeals,
    canOpen: totalSeals > 0,
    lastCls: sameWeek ? t.cls || "" : "",
    lastResult: t.lastReward || null,
    lastReward: t.lastReward || null,
  };
}
