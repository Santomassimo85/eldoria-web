// Sprite di CLASSE per l'Arena (2026-11-02): i PG del Master e i bot dell'IA non
// hanno uno sprite loro, quindi nella Vista Palco usano quello della loro classe.
// Un doc per classe: arena_meta/sprite_<chiave> = { image (png trasparente, rivolto
// a SINISTRA come gli sprite degli eroi), updatedAt }. Si generano da
// DM Admin → Sprite Personaggi.
export const ARENA_CLASSES = [
  { key: "fighter", it: "Guerriero", icon: "⚔", look: "a battle-hardened human fighter in plate armour with a longsword and a heater shield" },
  { key: "barbarian", it: "Barbaro", icon: "🪓", look: "a fierce barbarian in furs and leather straps, tribal tattoos, wielding a huge greataxe with both hands" },
  { key: "paladin", it: "Paladino", icon: "🛡", look: "a holy paladin in shining plate armour with a tabard bearing a sun emblem, a longsword raised and a shield" },
  { key: "ranger", it: "Ranger", icon: "🏹", look: "a hooded ranger in a green cloak and leather armour, drawing a longbow aimed toward the LEFT" },
  { key: "monk", it: "Monaco", icon: "👊", look: "a disciplined monk in simple wrapped robes, barefoot, in a martial arts fighting stance with fists raised" },
  { key: "rogue", it: "Ladro", icon: "🗡", look: "a stealthy rogue in a dark hooded leather outfit with a half mask, two daggers drawn" },
  { key: "wizard", it: "Mago", icon: "🧙", look: "a wizard in long blue robes with a pointed hat and a gnarled wooden staff, a spellbook at the belt, casting a spell" },
  { key: "sorcerer", it: "Stregone", icon: "🔥", look: "a sorcerer in elegant crimson robes with draconic markings on the skin, flames swirling around one hand" },
  { key: "warlock", it: "Warlock", icon: "👁", look: "a warlock in a dark tattered coat with eldritch purple glyphs, holding a pact tome, purple eldritch energy in the other hand" },
  { key: "druid", it: "Druido", icon: "🌿", look: "a druid in leaf and bark garments with antlers on the hood, holding a wooden staff entwined with vines" },
  { key: "cleric", it: "Chierico", icon: "✨", look: "a cleric in chain mail and white vestments with a holy symbol, a mace raised and a glowing hand" },
  { key: "bard", it: "Bardo", icon: "🎵", look: "a dashing bard in a feathered hat and a colourful doublet, holding a rapier and a lute on the back" },
];

const IT_TO_KEY = {
  guerriero: "fighter", barbaro: "barbarian", paladino: "paladin", pattugliatore: "ranger", ranger: "ranger",
  monaco: "monk", ladro: "rogue", mago: "wizard", stregone: "sorcerer", warlock: "warlock", druido: "druid",
  chierico: "cleric", bardo: "bard",
};
/** "Wizard", "mago", "Guerriero" → chiave inglese della classe (o null). */
export function arenaClassKey(cls) {
  const k = String(cls || "").trim().toLowerCase();
  if (!k) return null;
  if (ARENA_CLASSES.some((c) => c.key === k)) return k;
  return IT_TO_KEY[k] || null;
}
export const classSpriteDocId = (key) => `sprite_${key}`;

/** Prompt dello sprite di classe: stesso stile degli sprite degli eroi, ma senza avatar. */
export function classSpritePrompt(c) {
  return `Pixel art sprite of a single fantasy RPG hero for a turn-based RPG battle screen.
Subject: ${c.look}. Archetypal ${c.it} (${c.key}) of a Dungeons & Dragons world, instantly recognisable as that class.
Pose: dynamic BATTLE STANCE, full body from head to feet, side / three-quarter view with body, face and gaze turned toward the LEFT edge of the image (the enemy is on the left). Knees bent, weight forward, ready to fight — NOT standing idle, NOT facing the viewer.
Style: high-quality SERIOUS dark-fantasy pixel art, like the hero sprites of a polished modern 2D RPG: detailed 32-bit-era pixel shading on armour, cloth and leather, limited but rich palette, crisp pixels, clean outlines, NO anti-aliasing, NO blur.
Proportions: REALISTIC adult anatomy, about 7 heads tall, normal-sized head and small eyes. NOT chibi, NOT super-deformed, NOT big-headed, NOT cute, NOT cartoon, NOT anime.
Mood: grim, determined and focused expression. NO comic or exaggerated expressions, NO motion lines, NO cartoon effects or emoji-like symbols.
CRITICAL: render the subject ALONE and centered on a SOLID UNIFORM background of pure magenta (#FF00FF, RGB 255,0,255). The background MUST be one flat magenta color — no gradient, no ground shadow, no scenery, no props. No text, no frame, no border. Only the subject on flat magenta. Do not use magenta or hot pink on the character itself.`;
}
