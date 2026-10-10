// ── SOTTOCLASSI D'ARENA (2026-10-10) ─────────────────────────────────────────
// Sorgente UNICA condivisa tra Arena.jsx (loadout + effetti in combattimento) e
// ArenaMarket.jsx (acquisto in Bottega).
//
// Ogni classe ha DUE sottoclassi (archetipi di D&D 5e). Si comprano in Bottega
// con le Monete Arena (SUBCLASS_PRICE), UNA per classe a settimana, e solo dopo
// aver CONCLUSO almeno un fight di torneo nella settimana. Restano valide fino
// alla chiusura della settimana (domenica 23:00): vivono in
// `characters.arenaWeekly.subclasses = { [classKey]: subclassKey }`, che il
// reset settimanale cancella insieme agli altri acquisti. Come tutta la Bottega
// valgono SOLO nei tornei: al loadout del torneo (anche al ri-equipaggiamento tra
// i round) chi la possiede sceglie fra classe base e sottoclasse.
//
// Una sottoclasse NON cambia la classe del motore (lo snapshot resta "Rogue",
// "Wizard"…): aggiunge sopra il kit base
//   • `effect`  → passivi letti da getSubclassEffect in Arena.jsx (snap.subclass)
//   • `actions` → abilità/incantesimi in più, nello stesso formato delle azioni
//                 di classe (solo meccaniche già gestite dal motore).
//
// EFFETTI supportati:
//   ca:            +N alla Classe Armatura (applicato alla creazione del PG)
//   weaponDmg:     +N al danno degli attacchi con arma/skill (non incantesimi)
//   spellDmg:      +N al danno degli incantesimi
//   rangedHit:     +N ai tiri per COLPIRE con armi a distanza
//   critRange:     critico già da questo risultato del d20 (es. 18 = 18-20)
//   twoHandReroll: ritira gli 1-2 sui dadi di danno di un'arma a due mani da mischia
//   spellResist:   frazione (0.25 = −25%) ai danni da incantesimo SUBITI
//   rageAllResist: in Furia dimezzi ANCHE i danni da incantesimo
//   rageExtraAttack: in Furia +1 attacco per turno (Frenesia)
//   firstStrikeAdv: VANTAGGIO al colpo contro un bersaglio a PF pieni
//   assassinate:   con firstStrikeAdv, il colpo a segno è un CRITICO
//   retaliate:     "XdY" — chi ti colpisce in MISCHIA subisce questo danno
//                  (max una volta per turno dell'attaccante); retaliateLabel = etichetta
//   foresight:     il primo attacco nemico contro di te (a PF pieni) è a SVANTAGGIO
//   wildSurge:     ogni incantesimo a segno ha 1 su 4 di fare +2d6
//   weaponBonusDie / spellBonusDie: "XdY" extra ai danni con arma / incantesimo
//   staggerOnHit:  colpendo in mischia, il prossimo attacco del nemico è a SVANTAGGIO

export const SUBCLASS_PRICE = 50;

// Passiva solo descrittiva nel pannello azioni (l'effetto vero è in `effect`).
const passive = (name, icon, info) => ({
  name, hitBonus: 0, damage: "—", statKey: null, type: "passive", icon, info: `Passiva · ${info}`,
});

export const ARENA_SUBCLASSES = {
  fighter: {
    title: "Archetipo Marziale",
    options: [
      {
        key: "campione", name: "Campione", icon: "🏆", dnd: "Champion",
        desc: "La perfezione fisica: critici dal 18 e colpi che spezzano la guardia.",
        effect: { critRange: 18, weaponDmg: 1 },
        actions: [
          passive("Critico Superiore", "💥", "critico con 18, 19 e 20 · +1 al danno con le armi"),
          { name: "Colpo Devastante", hitBonus: 3, damage: "2d10", statKey: "str", type: "skill", icon: "🔨", info: "2d10+FOR · 2 cariche", maxUses: 2 },
          { name: "Sopravvissuto", hitBonus: 0, damage: "2d8", statKey: null, type: "skill", icon: "❤️‍🩹", info: "Cura 2d8+COS · 1 carica", special: "heal", healModStat: "con", maxUses: 1 },
        ],
      },
      {
        key: "cavaliere_mistico", name: "Cavaliere Mistico", icon: "🔮", dnd: "Eldritch Knight",
        desc: "Spada e grimorio: incantesimi d'Intelligenza al servizio della lama.",
        effect: { ca: 1 },
        actions: [
          passive("Legame con l'Arma", "🔗", "+1 CA: l'arma vincolata non ti lascia mai scoperto"),
          { name: "Lama Arcana", level: 1, hitBonus: 3, damage: "2d8", statKey: "int", type: "spell", icon: "🗡", info: "Lv1 · Forza · tiro per colpire · 3 usi", maxUses: 3 },
          { name: "Scudo Mistico", level: 1, hitBonus: 0, damage: "—", statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA per 2 turni · 2 usi", special: "shield_buff", shieldBuffBonus: 3, shieldBuffTurns: 2, maxUses: 2 },
        ],
      },
    ],
  },
  barbarian: {
    title: "Cammino Primordiale",
    options: [
      {
        key: "berserker", name: "Berserker", icon: "💢", dnd: "Path of the Berserker",
        desc: "La furia senza freni: in Furia attacchi una volta in più ogni turno.",
        effect: { rageExtraAttack: true, weaponDmg: 1 },
        actions: [
          passive("Frenesia", "🩸", "in Furia +1 attacco per turno · +1 al danno con le armi"),
          { name: "Presenza Intimidatoria", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "😡", info: "Il nemico attacca a svantaggio per 2 turni · 1 carica", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 1 },
        ],
      },
      {
        key: "totem_orso", name: "Guerriero Totemico (Orso)", icon: "🐻", dnd: "Path of the Totem Warrior",
        desc: "Lo spirito dell'orso: in Furia dimezzi tutti i danni, anche la magia.",
        effect: { rageAllResist: true, ca: 1 },
        actions: [
          passive("Spirito dell'Orso", "🐻", "in Furia dimezzi TUTTI i danni subiti (anche incantesimi) · +1 CA"),
          { name: "Ruggito dell'Orso", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🛡", info: "+2 CA per 3 turni · 1 carica", special: "shield_buff", shieldBuffBonus: 2, shieldBuffTurns: 3, maxUses: 1 },
        ],
      },
    ],
  },
  paladin: {
    title: "Giuramento Sacro",
    options: [
      {
        key: "devozione", name: "Giuramento di Devozione", icon: "🕊", dnd: "Oath of Devotion",
        desc: "Il cavaliere luminoso: arma consacrata e difesa incrollabile.",
        effect: { ca: 1 },
        actions: [
          passive("Aura di Devozione", "✨", "+1 CA"),
          { name: "Arma Consacrata", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "⚔", info: "Vantaggio ai tuoi attacchi per 3 turni · 1 carica", special: "self_advantage", advantageTurns: 3, maxUses: 1 },
          { name: "Luce Purificatrice", hitBonus: 0, damage: "2d6", statKey: null, type: "skill", icon: "☀", info: "Cura 2d6+CAR e rimuove le condizioni negative · 1 carica", special: "heal", healModStat: "cha", cleansesStatuses: true, maxUses: 1 },
        ],
      },
      {
        key: "vendetta", name: "Giuramento di Vendetta", icon: "⚖", dnd: "Oath of Vengeance",
        desc: "Il cacciatore implacabile: un voto d'inimicizia e colpi che non perdonano.",
        effect: { weaponDmg: 2 },
        actions: [
          passive("Vendicatore Implacabile", "🗡", "+2 al danno con le armi"),
          { name: "Voto d'Inimicizia", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🎯", info: "Bonus Action · +3 ai tiri per colpire per 3 turni · 1 carica", special: "hunter_mark", bonusAction: true, maxUses: 1 },
          { name: "Abiura del Nemico", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🌫", info: "Il nemico attacca a svantaggio per 2 turni · 1 carica", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 1 },
        ],
      },
    ],
  },
  ranger: {
    title: "Archetipo del Ranger",
    options: [
      {
        key: "cacciatore", name: "Cacciatore", icon: "🦌", dnd: "Hunter",
        desc: "Specialista della preda grossa: ogni colpo d'arma morde un dado in più.",
        effect: { weaponBonusDie: "1d6" },
        actions: [
          passive("Uccisore di Colossi", "🗡", "+1d6 ai danni dei tuoi colpi con arma"),
          { name: "Attacco Turbinante", hitBonus: 3, damage: "2d8", statKey: "dex", type: "skill", icon: "🌪", info: "2d8+DES · 2 cariche", maxUses: 2 },
          { name: "Difesa Multiattacco", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🛡", info: "+2 CA per 3 turni · 1 carica", special: "shield_buff", shieldBuffBonus: 2, shieldBuffTurns: 3, maxUses: 1 },
        ],
      },
      {
        key: "predatore_tenebre", name: "Predatore delle Tenebre", icon: "🌘", dnd: "Gloom Stalker",
        desc: "Colpisce dal buio: vantaggio sul primo colpo e un'imboscata che ti lascia invisibile.",
        effect: { firstStrikeAdv: true, rangedHit: 1 },
        actions: [
          passive("Imboscata Temibile", "🌑", "vantaggio contro un nemico a PF pieni · +1 a colpire a distanza"),
          { name: "Colpo dall'Ombra", hitBonus: 3, damage: "2d8", statKey: "dex", type: "skill", icon: "🏹", info: "2d8+DES · vantaggio per 2 turni · 2 cariche", grantsAdvTurns: 2, maxUses: 2 },
          { name: "Velo d'Ombra", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "👻", info: "Il nemico non può attaccarti il prossimo turno · 1 carica", special: "invisibility", invisibilityDuration: 1, maxUses: 1 },
        ],
      },
    ],
  },
  monk: {
    title: "Tradizione Monastica",
    options: [
      {
        key: "mano_aperta", name: "Via della Mano Aperta", icon: "✋", dnd: "Way of the Open Hand",
        desc: "Ogni colpo sbilancia: il nemico risponde a svantaggio.",
        effect: { staggerOnHit: true, weaponDmg: 1 },
        actions: [
          passive("Tecnica della Mano Aperta", "🌀", "colpendo in mischia il prossimo attacco del nemico è a svantaggio · +1 al danno"),
          { name: "Palmo Vibrante", hitBonus: 3, damage: "4d8", statKey: "dex", type: "skill", icon: "🫳", info: "4d8+DES necrotico · 1 carica", damageType: "necrotico", maxUses: 1 },
        ],
      },
      {
        key: "ombra", name: "Via dell'Ombra", icon: "🌑", dnd: "Way of Shadow",
        desc: "Il monaco che sparisce: oscurità, passi d'ombra e il primo colpo a vantaggio.",
        effect: { ca: 1, firstStrikeAdv: true },
        actions: [
          passive("Arti dell'Ombra", "🌑", "+1 CA · vantaggio contro un nemico a PF pieni"),
          { name: "Oscurità", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🌫", info: "Il nemico attacca a svantaggio per 2 turni · 2 cariche", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
          { name: "Passo dell'Ombra", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "👣", info: "Il nemico non può attaccarti il prossimo turno · 1 carica", special: "invisibility", invisibilityDuration: 1, maxUses: 1 },
        ],
      },
    ],
  },
  rogue: {
    title: "Archetipo Furtivo",
    options: [
      {
        key: "assassino", name: "Assassino", icon: "🗡", dnd: "Assassin",
        desc: "Il primo colpo contro un nemico intatto è a vantaggio e, se va a segno, è critico.",
        effect: { firstStrikeAdv: true, assassinate: true },
        actions: [
          passive("Assassinare", "💀", "vantaggio contro un nemico a PF pieni: se colpisci è un critico"),
          { name: "Lama Avvelenata", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🧪", info: "TS COS · 2d6 veleno a inizio turno per 2 turni · 2 cariche", special: "save_dot", saveDotAbility: "con", saveDotStat: "dex", saveDotDamage: "2d6", saveDotTurns: 2, maxUses: 2 },
        ],
      },
      {
        key: "mistificatore", name: "Mistificatore Arcano", icon: "🎩", dnd: "Arcane Trickster",
        desc: "Il ladro che ha rubato un grimorio: incantesimi d'Intelligenza e trucchi da prestigiatore.",
        effect: { spellDmg: 1 },
        actions: [
          passive("Imboscata Magica", "✨", "+1 al danno dei tuoi incantesimi"),
          { name: "Scossa Folgorante", level: 1, hitBonus: 3, damage: "2d8", statKey: "int", type: "spell", icon: "⚡", info: "Lv1 · Fulmine · tiro per colpire · 3 usi", maxUses: 3 },
          { name: "Mano Magica Ingannatrice", level: 1, hitBonus: 0, damage: "—", statKey: null, type: "spell", icon: "🖐", info: "Lv1 · Distrai il nemico: attacca a svantaggio per 2 turni · 2 usi", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
          { name: "Sonno", level: 1, hitBonus: 0, damage: "—", statKey: null, type: "spell", icon: "😴", info: "Lv1 · Controllo · TS SAG o perdi 2 turni · 1 uso", special: "control", maxUses: 1 },
        ],
      },
    ],
  },
  wizard: {
    title: "Tradizione Arcana",
    options: [
      {
        key: "evocazione", name: "Scuola di Invocazione", icon: "🔥", dnd: "School of Evocation",
        desc: "Il distruttore: incantesimi più forti e un dardo scolpito che non perdona.",
        effect: { spellDmg: 2 },
        actions: [
          passive("Invocazione Potenziata", "🔥", "+2 al danno dei tuoi incantesimi"),
          { name: "Dardo Scolpito", level: 1, hitBonus: 3, damage: "3d8", statKey: null, type: "spell", icon: "☄", info: "Lv1 · Fuoco · TS DES (superato = metà danni) · 2 usi", maxUses: 2 },
        ],
      },
      {
        key: "abiurazione", name: "Scuola di Abiurazione", icon: "🔰", dnd: "School of Abjuration",
        desc: "Il protettore: la magia nemica ti scivola addosso e una barriera ti copre.",
        effect: { spellResist: 0.25, ca: 1 },
        actions: [
          passive("Interdizione Arcana", "🔰", "−25% ai danni da incantesimo subiti · +1 CA"),
          { name: "Barriera Arcana", level: 1, hitBonus: 0, damage: "—", statKey: null, type: "spell", icon: "🛡", info: "Lv1 · +3 CA per 3 turni · 2 usi", special: "shield_buff", shieldBuffBonus: 3, shieldBuffTurns: 3, maxUses: 2 },
        ],
      },
    ],
  },
  sorcerer: {
    title: "Origine Stregonesca",
    options: [
      {
        key: "draconica", name: "Stirpe Draconica", icon: "🐲", dnd: "Draconic Bloodline",
        desc: "Sangue di drago: scaglie sotto la pelle e un soffio di fuoco.",
        effect: { ca: 1, spellDmg: 1 },
        actions: [
          passive("Resilienza Draconica", "🐉", "+1 CA · +1 al danno dei tuoi incantesimi"),
          { name: "Soffio del Drago", hitBonus: 3, damage: "3d8", statKey: "cha", type: "skill", icon: "🔥", info: "3d8+CAR fuoco · 2 cariche", damageType: "fuoco", maxUses: 2 },
        ],
      },
      {
        key: "selvaggia", name: "Magia Selvaggia", icon: "🎲", dnd: "Wild Magic",
        desc: "Magia imprevedibile: ondate di caos e la fortuna dalla tua parte.",
        effect: { wildSurge: true, spellDmg: 1 },
        actions: [
          passive("Ondata di Magia Selvaggia", "🌀", "1 su 4 i tuoi incantesimi a segno fanno +2d6 · +1 al danno"),
          { name: "Maree del Caos", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🌊", info: "Vantaggio ai tuoi attacchi per 3 turni · 1 carica", special: "self_advantage", advantageTurns: 3, maxUses: 1 },
        ],
      },
    ],
  },
  warlock: {
    title: "Patrono Ultraterreno",
    options: [
      {
        key: "immondo", name: "Il Signore Immondo", icon: "😈", dnd: "The Fiend",
        desc: "Il patto infernale: fiamme dell'inferno e la benedizione dell'oscuro.",
        effect: { spellDmg: 1, spellResist: 0.25 },
        actions: [
          passive("Resilienza Immonda", "🔥", "−25% ai danni da incantesimo subiti · +1 al danno degli incantesimi"),
          { name: "Fiamme Infernali", hitBonus: 3, damage: "3d10", statKey: "cha", type: "skill", icon: "🔥", info: "3d10+CAR fuoco · 1 carica", damageType: "fuoco", maxUses: 1 },
          { name: "Benedizione dell'Oscuro", hitBonus: 0, damage: "2d8", statKey: null, type: "skill", icon: "🖤", info: "Cura 2d8+CAR · 1 carica", special: "heal", healModStat: "cha", maxUses: 1 },
        ],
      },
      {
        key: "arcifatato", name: "L'Arcifatato", icon: "🧚", dnd: "The Archfey",
        desc: "Il patto delle fate: incanti che confondono e una fuga nella nebbia.",
        effect: { ca: 1, foresight: true },
        actions: [
          passive("Presenza Fatata", "🧚", "+1 CA · il primo attacco contro di te a PF pieni è a svantaggio"),
          { name: "Incanto Fatato", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "✨", info: "Il nemico attacca a svantaggio per 2 turni · 2 cariche", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
          { name: "Fuga Nebbiosa", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🌫", info: "Il nemico non può attaccarti il prossimo turno · 1 carica", special: "invisibility", invisibilityDuration: 1, maxUses: 1 },
        ],
      },
    ],
  },
  cleric: {
    title: "Dominio Divino",
    options: [
      {
        key: "vita", name: "Dominio della Vita", icon: "💚", dnd: "Life Domain",
        desc: "Il guaritore corazzato: preserva la vita, la tua prima di tutte.",
        effect: { ca: 1 },
        actions: [
          passive("Discepolo della Vita", "💚", "+1 CA (armatura pesante benedetta)"),
          { name: "Preservare la Vita", hitBonus: 0, damage: "3d8", statKey: null, type: "skill", icon: "🙏", info: "Cura 3d8+SAG · 1 carica", special: "heal", healModStat: "wis", maxUses: 1 },
          { name: "Benedizione Protettiva", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "✨", info: "+2 CA per 3 turni · 1 carica", special: "shield_buff", shieldBuffBonus: 2, shieldBuffTurns: 3, maxUses: 1 },
        ],
      },
      {
        key: "tempesta", name: "Dominio della Tempesta", icon: "⚡", dnd: "Tempest Domain",
        desc: "Il sacerdote del tuono: chi ti colpisce in mischia viene folgorato.",
        effect: { retaliate: "2d6", retaliateLabel: "⚡ Ira della Tempesta" },
        actions: [
          passive("Ira della Tempesta", "⚡", "chi ti colpisce in mischia subisce 2d6 danni da fulmine"),
          { name: "Fulmine Divino", hitBonus: 3, damage: "3d8", statKey: "wis", type: "skill", icon: "🌩", info: "3d8+SAG fulmine · 2 cariche", damageType: "fulmine", maxUses: 2 },
        ],
      },
    ],
  },
  druid: {
    title: "Circolo Druidico",
    options: [
      {
        key: "luna", name: "Circolo della Luna", icon: "🌙", dnd: "Circle of the Moon",
        desc: "Il mutaforma: forme selvatiche più feroci e una cura sotto la luna.",
        effect: { weaponDmg: 2 },
        actions: [
          passive("Forma da Combattimento", "🐺", "+2 al danno delle forme selvatiche e delle armi"),
          { name: "Rigenerazione Lunare", hitBonus: 0, damage: "2d8", statKey: null, type: "skill", icon: "🌙", info: "Cura 2d8+SAG · 2 cariche", special: "heal", healModStat: "wis", maxUses: 2 },
        ],
      },
      {
        key: "terra", name: "Circolo della Terra", icon: "🌿", dnd: "Circle of the Land",
        desc: "Il custode della terra: incantesimi più forti, spine e corteccia.",
        effect: { spellDmg: 2 },
        actions: [
          passive("Magia della Terra", "🌿", "+2 al danno dei tuoi incantesimi"),
          { name: "Crescita Spinosa", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🌵", info: "TS COS · 2d6 perforante a inizio turno per 3 turni · 1 carica", special: "save_dot", saveDotAbility: "con", saveDotDamage: "2d6", saveDotTurns: 3, maxUses: 1 },
          { name: "Pelle di Corteccia", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🪵", info: "+3 CA per 3 turni · 1 carica", special: "shield_buff", shieldBuffBonus: 3, shieldBuffTurns: 3, maxUses: 1 },
        ],
      },
    ],
  },
  bard: {
    title: "Collegio Bardico",
    options: [
      {
        key: "sapienza", name: "Collegio della Sapienza", icon: "📖", dnd: "College of Lore",
        desc: "Parole taglienti che fanno sbagliare il nemico, segreti che fanno più male.",
        effect: { spellDmg: 2 },
        actions: [
          passive("Segreti Magici", "📖", "+2 al danno dei tuoi incantesimi"),
          { name: "Parole Taglienti", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🗯", info: "Il nemico attacca a svantaggio per 2 turni · 2 cariche", special: "disadvantage_enemy", disadvantageTurns: 2, maxUses: 2 },
        ],
      },
      {
        key: "valore", name: "Collegio del Valore", icon: "⚔", dnd: "College of Valor",
        desc: "Lo scaldo guerriero: armatura più pesante, colpi più duri e un canto di battaglia.",
        effect: { ca: 1, weaponDmg: 2 },
        actions: [
          passive("Addestramento al Combattimento", "🛡", "+1 CA · +2 al danno con le armi"),
          { name: "Ispirazione in Combattimento", hitBonus: 0, damage: "—", statKey: null, type: "skill", icon: "🎺", info: "+2 al danno per 3 turni · 2 cariche", special: "dmg_buff", aidDmgBonus: 2, aidDmgTurns: 3, maxUses: 2 },
        ],
      },
    ],
  },
  artificer: {
    title: "Specializzazione",
    options: [
      {
        key: "artigliere", name: "Artigliere", icon: "💣", dnd: "Artillerist",
        desc: "Il cannone arcano: un lanciafiamme da campo e incantesimi che esplodono.",
        effect: { spellBonusDie: "1d6" },
        actions: [
          passive("Arma da Fuoco Arcana", "🔫", "+1d6 ai danni dei tuoi incantesimi"),
          { name: "Cannone Lanciafiamme", hitBonus: 3, damage: "2d8", statKey: "int", type: "skill", icon: "🔥", info: "2d8+INT fuoco · 2 cariche", damageType: "fuoco", maxUses: 2 },
        ],
      },
      {
        key: "fabbro_battaglia", name: "Fabbro da Battaglia", icon: "🔧", dnd: "Battle Smith",
        desc: "L'armaiolo combattente: chi ti colpisce paga il prezzo, e i tuoi colpi sono arcani.",
        effect: { ca: 1, retaliate: "1d6", retaliateLabel: "🤖 Difensore d'Acciaio" },
        actions: [
          passive("Difensore d'Acciaio", "🤖", "+1 CA · chi ti colpisce in mischia subisce 1d6 danni"),
          { name: "Colpo Arcano", hitBonus: 3, damage: "2d6", statKey: "int", type: "skill", icon: "⚙", info: "2d6+INT forza · 2 cariche", damageType: "forza", maxUses: 2 },
        ],
      },
    ],
  },
};

// Definizione di una sottoclasse (o null).
export function getSubclassDef(classKey, subclassKey) {
  if (!subclassKey) return null;
  return ARENA_SUBCLASSES[classKey]?.options.find(o => o.key === subclassKey) || null;
}

// Effetto scelto per una classe (o {} se nessuna scelta).
export function getSubclassEffectFor(classKey, subclassKey) {
  return getSubclassDef(classKey, subclassKey)?.effect || {};
}
