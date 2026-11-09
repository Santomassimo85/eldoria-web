/* ICONE DELLE SEGRETE (2026-11-06) = nomi di game-icons.net (CC BY 3.0, autori in
   src/assets/gameIcons.js). Ogni voce: id del dato → nome dell'icona. I disegni stanno in
   src/assets/gameIcons.js, generato da `node tools/build-game-icons.mjs` con SOLO le icone
   usate qui: dopo aver cambiato o aggiunto un nome, rilanciarlo.
   Il campo `icon` (emoji) dei dati resta: lo usano i testi della cronaca e fa da riserva. */

export const SG_ICONS = {
  cls: {
    fighter: "crossed-swords", barbarian: "barbarian", paladin: "templar-shield", ranger: "bowman",
    monk: "meditation", rogue: "hooded-assassin", wizard: "wizard-staff", sorcerer: "magic-swirl",
    warlock: "warlock-eye", druid: "oak-leaf", cleric: "holy-symbol", bard: "lyre",
  },
  weapon: {
    spada_lunga: "broadsword", martello: "warhammer", ascia_bip: "battle-axe", maglio: "hammer-drop",
    mazzafrusto: "flail", arco_lungo: "bow-arrow", scimitarra: "saber-slash", stocco: "fencer", pugnali: "crossed-swords",
    bastone: "bo", lancia: "spear-hook", balestra_l: "crossbow", mazza: "flanged-mace", pugni: "fist",
  },
  armor: {
    abiti: "shirt", magica: "magic-shield", senza: "biceps", cuoio: "leather-armor", borchiato: "leather-vest",
    pelle: "animal-hide", giaco: "chain-mail", scaglie: "scale-mail", mezza: "breastplate",
    anelli: "layered-armor", maglia: "chain-mail", stecche: "chest-armor", piastre: "black-knight-helm",
    scudo: "checked-shield",
  },
  item: {
    pozione: "health-potion", pozione_magg: "standing-potion", pozione_sup: "round-potion",
    tonico: "herbs-bundle", bomba_acqua: "water-splash", panacea: "magic-potion",
    pelle_pietra: "stone-block", eroismo: "muscle-up", fuoco_alch: "fire-bomb", acido: "bubbling-flask",
    acqua_santa: "holy-water", pietra_tuono: "sparky-bomb", piuma_fenice: "feathered-wing",
    lingua_salamandra: "flame-claws", maglio_fabbro: "anvil-impact", zanna_vyrskaal: "ice-spear",
    lancia_pescatore: "harpoon-trident", spina_palude: "thorny-vine", falce_ragno: "spider-alt",
    arco_ratto: "pocket-bow", stiletto_rimorso: "stiletto", catene_mazzafrusto: "crossed-chains",
    mazza_penitenza: "spiked-mace", balestra_tobia: "crossbow", martello_brontola: "thor-hammer",
    mestolo_nonna: "ladle",
    arm_mezza: "breastplate", arm_stecche: "chest-armor", arm_piastre: "black-knight-helm",
    arm_cuoio_1: "leather-armor", arm_borchiato_1: "leather-vest", arm_scaglie_1: "scale-mail",
    arm_mezza_1: "breastplate", arm_maglia_1: "chain-mail", arm_piastre_1: "black-knight-helm",
    scaglie_salamandra: "lizardman", pelliccia_lupo: "wolf-head", mezza_ghiaccio: "frozen-body",
    giaco_muschio: "mushroom-gills", giubba_galline: "chicken", catene_carceriere: "manacles",
    piastre_guardiano: "spiked-armor",
    scudo_1: "checked-shield", scudo_padella: "saucepan", scudo_brina: "ice-shield", scudo_magma: "fire-shield",
  },
  action: {
    arma: "broadsword", difesa: "shield-reflect",
    respiro: "heart-plus", poderoso: "hammer-break", parata: "shield-bash", impeto: "sprint", stordire: "knockout",
    turbine: "spinning-sword", grido: "shouting", furia: "enrage", irruento: "angry-eyes", lancio: "thrown-spear",
    ruggito: "lion", brutale: "smash-arrows", inarrestabile: "heart-beats", terremoto: "earth-crack",
    mani: "healing", punizione: "winged-sword", benedizione: "angel-outfit", cura_p: "health-normal",
    aura: "aura", accecante: "sun", sacra: "sword-altar",
    marchio: "target-arrows", doppio: "double-shot", cura_r: "health-normal", pioggia: "arrow-cluster",
    mimetismo: "hood", trappola: "wolf-trap", fulminante: "lightning-bow",
    raffica: "punch-blast", schivata: "dodge", ki: "fist", vento: "wind-slap", stordente: "punch",
    integrita: "lotus", ondata: "wave-strike", palmo: "palm",
    furtivo: "backstab", nascondersi: "cloak-dagger", veleno_r: "dripping-knife", basso: "high-kick",
    prodigiosa: "acrobatic", fumogena: "smoke-bomb", assassinare: "decapitation",
    dardo_fuoco: "fire-ray", dardo_inc: "magic-palm", raggio_gelo: "ice-bolt", scudo: "magic-shield",
    mani_w: "flame-spin", acida: "acid-blob", palla_fuoco: "fireball", ipnosi: "spiral-bloom", cono_freddo: "frozen-orb",
    fiotto: "fire-breath", mani_br: "flame-spin", veleno: "poison-cloud", scudo_s: "magic-shield",
    gemello: "lightning-trio", fulmine: "lightning-tree", catena: "chain-lightning",
    deflagrazione: "warlock-eye", maleficio: "cursed-star", agathys: "ice-shield", hadar: "tentacles-skull",
    vampiro: "vampire-dracula", paura: "screaming", fame: "black-hole-bolas", dito: "death-skull",
    rovi: "thorn-helix", cura_d: "health-normal", onda: "sonic-boom", pelle: "tree-branch",
    lama_fiamma: "fire-dash", luna: "moon", richiamo: "lightning-storm", tempesta: "snowflake-2",
    cura_c: "health-normal", fiamma: "candle-flame", benedire_c: "angel-outfit", arma_spir: "spectre",
    parola: "prayer", guardiani: "angel-wings", guarigione: "heart-wings",
    beffa: "drama-masks", parola_b: "musical-notes", ispirazione: "music-spell", onda_b: "sonic-boom",
    sussurri: "screaming", riposo: "harp", risata: "imp-laugh",
  },
  status: {
    burn: "flame", poison: "poison-bottle", frozen: "frozen-block", paralyzed: "electric", petrified: "stone-bust",
    frightened: "terror", blinded: "blindfold", slow: "snail", confused: "spiral-bloom",
    ac: "shield", adv: "on-target", dis: "dice-fire", dmg: "sword-wound", rage: "enrage", stun: "knockout",
    dodge: "dodge", reckless: "angry-eyes",
  },
  dungeon: {
    segrete: "dungeon-gate", caverna: "cave-entrance", magma: "volcano", ghiaccio: "ice-iris",
    palude: "swamp", tempio: "greek-temple",
  },
  diff: { facile: "broken-skull", medio: "death-skull", leggenda: "crowned-skull" },
  monster: {
    "base-lupo-invernale": "direwolf", "base-mefite-brina": "ice-golem", "base-annegato": "shambling-zombie",
    "base-basilisco": "lizard-tongue", "base-troll-ghiacci": "troll", "base-regina-brina": "spiked-dragon-head",
  },
  ui: {
    coin: "two-coins", bag: "knapsack", shop: "shop", manual: "spell-book", key: "key",
    boss: "crowned-skull", gift: "present",
    gruppi: "crossed-swords", eroi: "cowled", bottega: "shop", zaino: "knapsack", storico: "scroll-unfurled", manuale: "spell-book",
  },
};

// elenco di tutti i nomi usati (per il generatore)
export const ALL_SG_ICON_NAMES = [...new Set(Object.values(SG_ICONS).flatMap((m) => Object.values(m)))];

// icona di un oggetto delle armi magiche generiche (spada_lunga_1 → spada_lunga)
const baseWeaponOf = (id) => String(id || "").replace(/_\d+$/, "");

/** nome dell'icona per un dato delle Segrete. kind = cls|weapon|armor|item|action|status|dungeon|diff|monster|ui */
export function sgIconName(kind, x) {
  if (!x && x !== 0) return null;
  if (typeof x === "object") {
    if (x.gi) return x.gi;
    if (kind === "action" && x.id === "arma" && x.weaponKey) return SG_ICONS.weapon[x.weaponKey] || SG_ICONS.action.arma;
    const id = x.id ?? x.key;
    return sgIconName(kind, id);
  }
  const m = SG_ICONS[kind] || {};
  if (m[x]) return m[x];
  if (kind === "item") {
    const base = baseWeaponOf(x);
    if (SG_ICONS.weapon[base]) return SG_ICONS.weapon[base];
  }
  return null;
}

/* colore dell'icona di un'azione: per tipo di danno, altrimenti per tipo d'azione */
export const DIFF_TONE = { facile: "#7fe39a", medio: "#ffd75a", leggenda: "#ff6b5a" };

export const DMG_TONE = {
  fire: "#ff8a3d", cold: "#7fd6ff", lightning: "#ffe14d", thunder: "#c9b6ff", acid: "#b6f35a", poison: "#7be05a",
  necrotic: "#b48cff", radiant: "#fff1a8", force: "#ff7ad9", psychic: "#ff9fe0",
  slashing: "#e8dcc4", piercing: "#e8dcc4", bludgeoning: "#e8dcc4",
};
const KIND_TONE = { heal: "#6fe39a", heal_all: "#6fe39a", buff: "#ffcf5a", defend: "#b9c7d6", debuff: "#c58bff" };
export function sgTone(a) {
  if (!a) return undefined;
  return DMG_TONE[a.dmg] || KIND_TONE[a.kind] || undefined;
}
