// ── SOTTOCLASSI / ARCHETIPI D'ARENA ──────────────────────────────────────────
// Sorgente UNICA condivisa tra Arena.jsx (effetti in combattimento) e
// ArenaMarket.jsx (scelta retroattiva). Vedi Arena_class_progress.txt (Lv2-3).
//
// Ogni classe ha: { reqLevel, title, options: [{ key, label, desc, effect }] }.
// La scelta è PERMANENTE per classe (salvata su `arenaSubclass[classKey]` del
// personaggio) e RETROATTIVA: chi ha già superato reqLevel la compie alla
// prossima apertura della Bottega dell'Arena.
//
// EFFETTI supportati (letti da getSubclassEffect in Arena.jsx):
//   ca:        +N alla Classe Armatura (applicato alla creazione del PG)
//   weaponDmg: +N al danno degli attacchi con arma/skill (non incantesimi)
//   spellDmg:  +N al danno degli incantesimi
// (Gli effetti più complessi verranno ampliati; la scelta è comunque registrata.)

export const ARENA_SUBCLASSES = {
  fighter: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "difesa",    label: "🛡 Difesa",    desc: "+1 CA permanente mentre indossi un'armatura.", effect: { ca: 1 } },
      { key: "duellante", label: "⚔ Duellante",  desc: "+2 al danno quando combatti con una sola arma in mischia.", effect: { weaponDmg: 2 } },
      { key: "tiratore",  label: "🏹 Tiratore",  desc: "+2 al danno con le armi a distanza.", effect: { weaponDmg: 2 } },
    ],
  },
  paladin: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "difesa",     label: "🛡 Difesa",       desc: "+1 CA permanente.", effect: { ca: 1 } },
      { key: "duellante",  label: "⚔ Duellante",     desc: "+2 al danno con una sola arma.", effect: { weaponDmg: 2 } },
      { key: "grandearma", label: "🗡 Arma Grande",   desc: "+2 al danno con armi a due mani.", effect: { weaponDmg: 2 } },
    ],
  },
  ranger: {
    reqLevel: 3, title: "Stile di Combattimento",
    options: [
      { key: "arco",     label: "🏹 Tiro con l'Arco", desc: "+2 al danno con le armi a distanza.", effect: { weaponDmg: 2 } },
      { key: "duearmi",  label: "🗡 Due Armi",         desc: "+2 al danno combattendo con due armi.", effect: { weaponDmg: 2 } },
      { key: "difesa",   label: "🛡 Difesa",           desc: "+1 CA permanente.", effect: { ca: 1 } },
    ],
  },
  barbarian: {
    reqLevel: 3, title: "Sentiero Primordiale",
    options: [
      { key: "berserker", label: "💢 Berserker",   desc: "+2 al danno con le armi: pura ferocia.", effect: { weaponDmg: 2 } },
      { key: "totem",     label: "🐻 Totem",        desc: "+1 CA: la protezione degli spiriti guida.", effect: { ca: 1 } },
    ],
  },
  monk: {
    reqLevel: 3, title: "Tradizione Monastica",
    options: [
      { key: "manoaperta", label: "✊ Mano Aperta", desc: "+2 al danno dei colpi a mani nude e con arma.", effect: { weaponDmg: 2 } },
      { key: "ombra",      label: "🌑 Ombra",       desc: "+1 CA: ti muovi come un'ombra.", effect: { ca: 1 } },
    ],
  },
  rogue: {
    reqLevel: 3, title: "Archetipo Furtivo",
    options: [
      { key: "assassino", label: "🗡 Assassino", desc: "+2 al danno con le armi.", effect: { weaponDmg: 2 } },
      { key: "arguzia",   label: "🎩 Arguzia",   desc: "+1 CA: schivi con eleganza.", effect: { ca: 1 } },
    ],
  },
  wizard: {
    reqLevel: 3, title: "Tradizione Arcana",
    options: [
      { key: "evocazione",  label: "🔥 Evocazione",  desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "abiurazione", label: "🛡 Abiurazione", desc: "+2 CA: uno scudo arcano ti protegge.", effect: { ca: 2 } },
      { key: "divinazione", label: "🔮 Divinazione", desc: "+1 al danno degli incantesimi: prevedi le mosse.", effect: { spellDmg: 1 } },
    ],
  },
  sorcerer: {
    reqLevel: 3, title: "Origine Stregonesca",
    options: [
      { key: "draconica", label: "🐲 Draconica",     desc: "+2 al danno degli incantesimi elementali.", effect: { spellDmg: 2 } },
      { key: "selvaggia", label: "🎲 Magia Selvaggia", desc: "+1 al danno degli incantesimi: magia imprevedibile.", effect: { spellDmg: 1 } },
    ],
  },
  warlock: {
    reqLevel: 3, title: "Patrono Ultraterreno",
    options: [
      { key: "infernale", label: "🔥 Infernale", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "fatato",    label: "🧚 Arcifatato", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "abissale",  label: "🕳 Abissale",   desc: "+1 CA: la resistenza dell'abisso.", effect: { ca: 1 } },
    ],
  },
  cleric: {
    reqLevel: 3, title: "Dominio Divino",
    options: [
      { key: "vita",     label: "💚 Vita",     desc: "+1 CA: la benedizione ti scherma.", effect: { ca: 1 } },
      { key: "guerra",   label: "⚔ Guerra",    desc: "+2 al danno con le armi.", effect: { weaponDmg: 2 } },
      { key: "tempesta", label: "⚡ Tempesta",  desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
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
      { key: "valore",   label: "⚔ Valore",   desc: "+2 al danno con le armi.", effect: { weaponDmg: 2 } },
      { key: "spada",    label: "🗡 Spada",    desc: "+2 al danno in mischia.", effect: { weaponDmg: 2 } },
    ],
  },
  artificer: {
    reqLevel: 3, title: "Specializzazione",
    options: [
      { key: "alchimista", label: "🧪 Alchimista", desc: "+2 al danno degli incantesimi.", effect: { spellDmg: 2 } },
      { key: "artigliere", label: "🔫 Artigliere", desc: "+2 al danno con le armi da fuoco.", effect: { weaponDmg: 2 } },
      { key: "battaglia",  label: "🤖 Battaglia",  desc: "+1 CA: il costrutto ti difende.", effect: { ca: 1 } },
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
