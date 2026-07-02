// ── SOTTOCLASSI / ARCHETIPI D'ARENA ──────────────────────────────────────────
// Sorgente UNICA condivisa tra Arena.jsx (effetti in combattimento) e
// ArenaMarket.jsx (scelta retroattiva). Vedi Arena_class_progress.txt (Lv2-3) e
// Arena_subclasses_bible.txt (feature D&D di riferimento).
//
// Ogni classe ha: { reqLevel, title, options: [{ key, label, desc, effect }] }.
// La scelta è PERMANENTE per classe (salvata su `arenaSubclass[classKey]` del
// personaggio) e RETROATTIVA: chi ha già superato reqLevel la compie alla
// prossima apertura della Bottega dell'Arena.
//
// EFFETTI supportati (letti da getSubclassEffect e helper in Arena.jsx):
//   ca:            +N alla Classe Armatura (applicato alla creazione del PG)
//   weaponDmg:     +N al danno degli attacchi con arma/skill (non incantesimi)
//   spellDmg:      +N al danno degli incantesimi
//   rangedHit:     +N ai tiri per COLPIRE con armi a distanza (non danno)
//   twoHandReroll: reroll dei risultati 1-2 sui dadi di danno di un'arma a due mani da mischia
//   spellResist:   frazione (0.25 = −25%) ai danni da incantesimo SUBITI (difensiva)
//   rageAllResist: mentre sei in Furia, dimezzi ANCHE i danni da incantesimo (oltre ai fisici)
//   rageExtraAttack: mentre sei in Furia, +1 azione d'attacco per turno (Frenesia)
//   bardExtraAttack: Attacco Extra (2 azioni/turno) dal Lv6 (Bardo marziale)
//   firstStrikeAdv: VANTAGGIO al colpo contro un bersaglio a PF pieni (apertura del duello)
//   assassinate:   se firstStrikeAdv è attivo e il colpo va a segno, è un CRITICO
//   ── Fase 2 (effetti a reazione / condizionali, tutti automatici) ──
//   retaliate:     "XdY" — chi ti colpisce in MISCHIA subisce questo danno (Ira della
//                  Tempesta, Difensore d'Acciaio). Scatta solo se sopravvivi al colpo.
//   retaliateLabel: etichetta mostrata nel log della ritorsione.
//   foresight:     il primo attacco nemico contro di te (mentre sei a PF pieni) è a SVANTAGGIO (Presagio)
//   wildSurge:     ogni incantesimo a segno ha una chance di infliggere danni extra (Ondata Selvaggia)
//   weaponBonusDie: "XdY" — dado extra ai danni con arma (Arma da Fuoco Arcana)
//   spellBonusDie:  "XdY" — dado extra ai danni degli incantesimi (Sapiente Alchemico)
//   staggerOnHit:  colpendo in mischia, il prossimo attacco del nemico è a SVANTAGGIO (Mano Aperta)
// NB (bilanciamento): la ritorsione (retaliate) scatta al massimo UNA volta per turno
//   dell'attaccante (solo sul suo primo attacco), per non punire troppo il multi-attacco.

export const ARENA_SUBCLASSES = {
  fighter: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "difesa",    label: "🛡 Difesa",    desc: "+1 CA permanente mentre indossi un'armatura.", effect: { ca: 1 } },
      { key: "duellante", label: "⚔ Duellante",  desc: "+2 al danno quando combatti con una sola arma in mischia.", effect: { weaponDmg: 2 } },
      { key: "tiratore",  label: "🏹 Tiratore",  desc: "+2 ai tiri per colpire con le armi a distanza.", effect: { rangedHit: 2 } },
    ],
  },
  paladin: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "difesa",     label: "🛡 Difesa",       desc: "+1 CA permanente.", effect: { ca: 1 } },
      { key: "duellante",  label: "⚔ Duellante",     desc: "+2 al danno con una sola arma.", effect: { weaponDmg: 2 } },
      { key: "grandearma", label: "🗡 Arma Grande",   desc: "Con un'arma a due mani ritiri i risultati 1-2 sui dadi di danno.", effect: { twoHandReroll: true } },
    ],
  },
  ranger: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "arco",     label: "🏹 Tiro con l'Arco", desc: "+2 ai tiri per colpire con le armi a distanza.", effect: { rangedHit: 2 } },
      { key: "duearmi",  label: "🗡 Due Armi",         desc: "+2 al danno combattendo con due armi.", effect: { weaponDmg: 2 } },
      { key: "difesa",   label: "🛡 Difesa",           desc: "+1 CA permanente.", effect: { ca: 1 } },
    ],
  },
  barbarian: {
    reqLevel: 3, title: "Sentiero Primordiale",
    options: [
      { key: "berserker", label: "💢 Berserker",   desc: "+2 al danno con le armi e, in Furia, un attacco extra ogni turno (Frenesia).", effect: { weaponDmg: 2, rageExtraAttack: true } },
      { key: "totem",     label: "🐻 Totem (Orso)", desc: "+1 CA e, in Furia, dimezzi TUTTI i danni subiti (anche gli incantesimi).", effect: { ca: 1, rageAllResist: true } },
    ],
  },
  monk: {
    reqLevel: 3, title: "Tradizione Monastica",
    options: [
      { key: "manoaperta", label: "✊ Mano Aperta", desc: "+2 al danno; quando colpisci in mischia sbilanci il nemico: il suo prossimo attacco è a svantaggio (Tecnica della Mano Aperta).", effect: { weaponDmg: 2, staggerOnHit: true } },
      { key: "ombra",      label: "🌑 Ombra",       desc: "+1 CA e vantaggio al primo colpo contro un nemico a PF pieni (Passo d'Ombra).", effect: { ca: 1, firstStrikeAdv: true } },
    ],
  },
  rogue: {
    reqLevel: 3, title: "Archetipo Furtivo",
    options: [
      { key: "assassino", label: "🗡 Assassino", desc: "+2 al danno; il primo colpo contro un nemico a PF pieni è a vantaggio e, se va a segno, è un critico (Assassinare).", effect: { weaponDmg: 2, firstStrikeAdv: true, assassinate: true } },
      { key: "arguzia",   label: "🎩 Arguzia",   desc: "+1 CA: schivi con eleganza.", effect: { ca: 1 } },
    ],
  },
  wizard: {
    reqLevel: 3, title: "Tradizione Arcana",
    options: [
      { key: "evocazione",  label: "🔥 Evocazione",  desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "abiurazione", label: "🛡 Abiurazione", desc: "+2 CA e −25% ai danni da incantesimo subiti (scudo arcano).", effect: { ca: 2, spellResist: 0.25 } },
      { key: "divinazione", label: "🔮 Divinazione", desc: "+1 al danno degli incantesimi; prevedi le mosse: il primo attacco nemico contro di te (a PF pieni) è a svantaggio (Presagio).", effect: { spellDmg: 1, foresight: true } },
    ],
  },
  sorcerer: {
    reqLevel: 3, title: "Origine Stregonesca",
    options: [
      { key: "draconica", label: "🐲 Draconica",     desc: "+2 al danno degli incantesimi elementali e −25% ai danni da incantesimo subiti (Resilienza Draconica).", effect: { spellDmg: 2, spellResist: 0.25 } },
      { key: "selvaggia", label: "🎲 Magia Selvaggia", desc: "+1 al danno degli incantesimi; magia imprevedibile: a volte l'incantesimo scatena un'ondata che infligge danni extra (Ondata Selvaggia).", effect: { spellDmg: 1, wildSurge: true } },
    ],
  },
  warlock: {
    reqLevel: 3, title: "Patrono Ultraterreno",
    options: [
      { key: "infernale", label: "🔥 Infernale", desc: "+2 al danno degli incantesimi e −25% ai danni da incantesimo subiti (Resilienza Immonda).", effect: { spellDmg: 2, spellResist: 0.25 } },
      { key: "fatato",    label: "🧚 Arcifatato", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "abissale",  label: "🕳 Abissale",   desc: "+1 CA e −25% ai danni da incantesimo subiti (Scudo del Pensiero).", effect: { ca: 1, spellResist: 0.25 } },
    ],
  },
  cleric: {
    reqLevel: 3, title: "Dominio Divino",
    options: [
      { key: "vita",     label: "💚 Vita",     desc: "+1 CA: la benedizione ti scherma.", effect: { ca: 1 } },
      { key: "guerra",   label: "⚔ Guerra",    desc: "+2 al danno con le armi.", effect: { weaponDmg: 2 } },
      { key: "tempesta", label: "⚡ Tempesta",  desc: "+2 al danno degli incantesimi; chi ti colpisce in mischia subisce 2d8 danni da fulmine (Ira della Tempesta).", effect: { spellDmg: 2, retaliate: "2d8", retaliateLabel: "⚡ Ira della Tempesta" } },
    ],
  },
  druid: {
    reqLevel: 3, title: "Circolo Druidico",
    options: [
      { key: "terra", label: "🌿 Terra", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "luna",  label: "🌙 Luna",  desc: "+2 al danno delle forme selvatiche e delle armi.", effect: { weaponDmg: 2 } },
    ],
  },
  bard: {
    reqLevel: 3, title: "Collegio Bardico",
    options: [
      { key: "sapienza", label: "📖 Sapienza", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "valore",   label: "⚔ Valore",   desc: "+2 al danno con le armi e Attacco Extra (2 attacchi/turno) dal Lv6.", effect: { weaponDmg: 2, bardExtraAttack: true } },
      { key: "spada",    label: "🗡 Spada",    desc: "+2 al danno in mischia e Attacco Extra (2 attacchi/turno) dal Lv6.", effect: { weaponDmg: 2, bardExtraAttack: true } },
    ],
  },
  artificer: {
    reqLevel: 3, title: "Specializzazione",
    options: [
      { key: "alchimista", label: "🧪 Alchimista", desc: "+1d6 al danno degli incantesimi (Sapiente Alchemico).", effect: { spellBonusDie: "1d6" } },
      { key: "artigliere", label: "🔫 Artigliere", desc: "+1d8 al danno con le armi (Arma da Fuoco Arcana).", effect: { weaponBonusDie: "1d8" } },
      { key: "battaglia",  label: "🤖 Battaglia",  desc: "+1 CA e chi ti colpisce in mischia subisce 1d4 danni (Difensore d'Acciaio).", effect: { ca: 1, retaliate: "1d4", retaliateLabel: "🤖 Difensore d'Acciaio" } },
    ],
  },
};

// Effetto scelto per una classe (o {} se nessuna scelta).
export function getSubclassEffectFor(classKey, subclassKey) {
  const def = ARENA_SUBCLASSES[classKey];
  if (!def || !subclassKey) return {};
  const opt = def.options.find(o => o.key === subclassKey);
  return opt?.effect || {};
}
