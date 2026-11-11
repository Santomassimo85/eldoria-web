// Identità del dungeon, indipendente da Facile/Medio/Leggenda.
export const NEUTRAL_DUNGEON = {
  key: "neutro", name: "Classico", desc: "Incontri e premi standard.",
  hp: 1, dmg: 1, eliteBonus: 0, crowdChance: 0.42, extraMinions: 0,
  xp: 1, coins: 1, item: 1, chest: 1, rareBoost: 1,
  res: [], vul: [], metal: false, treasure: [],
};
export const DUNGEON_PROFILES = [
  { key: "segrete", name: "Prigione", desc: "Il percorso introduttivo: scontri equilibrati e rifornimenti di cura.", treasure: ["pozione", "acqua_santa"] },
  { key: "caverna", name: "Branco", desc: "Più incontri affollati e un budget di PF maggiore. Preferite attacchi ad area.", crowdChance: 0.8, hp: 1.04, xp: 1.03, coins: 1.03, treasure: ["tonico", "acido"] },
  { key: "palude", name: "Logoramento", desc: "Nemici più tenaci e resistenti al veleno. Fuoco e cure aiutano a reggere il viaggio.", hp: 1.08, dmg: 1.02, res: ["poison"], xp: 1.06, coins: 1.05, item: 1.04, treasure: ["tonico", "bomba_acqua"] },
  { key: "ghiaccio", name: "Brina", desc: "Resistenza al freddo, debolezza al fuoco e più élite. Portate una fonte di calore.", hp: 1.06, eliteBonus: 0.06, res: ["cold"], vul: ["fire"], xp: 1.08, coins: 1.08, item: 1.06, chest: 1.05, treasure: ["fuoco_alch", "tonico"] },
  { key: "magma", name: "Incandescente", desc: "Resistenza al fuoco, debolezza al freddo e colpi più pesanti. Evitate le sole magie di fuoco.", hp: 1.08, dmg: 1.04, res: ["fire"], vul: ["cold"], xp: 1.1, coins: 1.1, item: 1.075, chest: 1.075, treasure: ["fuoco_alch", "bomba_acqua"] },
  { key: "tempio", name: "Custodi", desc: "Guardiani con più PF e più élite. Il tesoro favorisce protezione e acqua santa.", hp: 1.14, eliteBonus: 0.1, xp: 1.12, coins: 1.12, item: 1.09, chest: 1.1, rareBoost: 1.075, treasure: ["pelle_pietra", "acqua_santa"] },
  { key: "cripta", name: "Echi funebri", desc: "Resistenza necrotica, debolezza radiosa e scorte più numerose. Una compagnia ben preparata viene premiata.", hp: 1.12, dmg: 1.03, extraMinions: 1, eliteBonus: 0.07, res: ["necrotic"], vul: ["radiant"], xp: 1.16, coins: 1.15, item: 1.1, chest: 1.125, rareBoost: 1.1, treasure: ["acqua_santa", "pozione_magg"] },
  { key: "forgia", name: "Baluardo di ferro", desc: "Corpi o armature metallici, resistenza ai fulmini e molte élite. L'acido corrode le loro difese.", hp: 1.18, dmg: 1.05, eliteBonus: 0.16, res: ["lightning"], metal: true, xp: 1.2, coins: 1.2, item: 1.125, chest: 1.15, rareBoost: 1.175, treasure: ["acido", "pelle_pietra"] },
  { key: "abisso", name: "Profondità ostile", desc: "Più nemici, più élite e il budget più alto. Resistono al freddo ma temono i fulmini: i premi migliori richiedono una squadra attrezzata.", hp: 1.22, dmg: 1.07, extraMinions: 1, crowdChance: 0.7, eliteBonus: 0.12, res: ["cold"], vul: ["lightning"], xp: 1.25, coins: 1.25, item: 1.15, chest: 1.2, rareBoost: 1.25, treasure: ["bomba_acqua", "pozione_magg"] },
].map((p) => ({ ...NEUTRAL_DUNGEON, ...p }));

export const dungeonProfile = (dungeon) => DUNGEON_PROFILES.find((p) => p.key === (dungeon?.challengeProfile || dungeon?.key)) || NEUTRAL_DUNGEON;
// Le partite già iniziate mantengono le regole e i premi precedenti.
export const MAX_DUNGEON_REWARD = 1.25;
export const runProfile = (run) => {
  if (!run?.dungeonRules) return NEUTRAL_DUNGEON;
  const p = { ...NEUTRAL_DUNGEON, ...run?.dungeonRules };
  for (const k of ['xp', 'coins', 'item', 'chest', 'rareBoost']) p[k] = Math.max(1, Math.min(MAX_DUNGEON_REWARD, Number(p[k]) || 1));
  return p;
};
export const dungeonDropContext = (profile, boost = {}) => ({
  boost: { ...boost, rare: (boost.rare || 1) * profile.rareBoost, veryRare: (boost.veryRare || 1) * profile.rareBoost },
  favored: profile.treasure,
});

export function applyDungeonDefenses(foe, profile) {
  foe.res = [...new Set([...(foe.res || []), ...profile.res.filter((t) => !(foe.imm || []).includes(t) && !(foe.vul || []).includes(t))])];
  foe.vul = [...new Set([...(foe.vul || []), ...profile.vul.filter((t) => !(foe.imm || []).includes(t) && !foe.res.includes(t))])];
  if (profile.metal) foe.metalProtection = true;
  return foe;
}
