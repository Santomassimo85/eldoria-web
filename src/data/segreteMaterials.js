// Solo protezioni e corpi metallici: le armi impugnate non contano.
export const ACID_METAL_MULT = 1.5;
const METAL_ARMORS = new Set(["giaco", "scaglie", "mezza", "anelli", "maglia", "stecche", "piastre"]);
export const metalArmor = (key) => METAL_ARMORS.has(key);
export function hasMetalProtection(target) {
  if (typeof target.metalProtection === "boolean") return target.metalProtection;
  if (metalArmor(target.armorKey)) return true;
  const text = [target.name, target.desc, target.look, target.gear?.armor].filter(Boolean).join(". ").toLowerCase();
  const metal = "(?:ferro|acciaio|rame|bronzo|ottone|argento|oro|metallo|adamantio|mithril|iron|steel|copper|bronze|brass|silver|gold|metal|adamantine)";
  const body = "(?:golem|automa|automaton|costrutto|construct|colosso|colossus|sentinella|sentinel|corpo|body|pelle|skin)";
  const armor = "(?:armatura|corazza|carapace|armor|armour|plating)";
  const join = "(?:\\s+(?:di|del|dello|in|of|made|from|pure|solid|living|puro|massiccio))*\\s+";
  return /\b(?:chainmail|chain mail|ring mail|plate armor|plate armour|half plate|splint armor|splint armour|giaco di maglia|cotta (?:di maglia|ad anelli)|armatura (?:completa |a )?(?:di )?(?:piastre|stecche)|mezza armatura|corazza di scaglie)\b/.test(text)
    || new RegExp(`\\b(?:${body}|${armor})${join}${metal}\\b`).test(text)
    || new RegExp(`\\b${metal}[- ](?:${body}|${armor}|plated|armored|armoured)\\b`).test(text)
    || /\b(?:corpo|armatura|corazza|carapace) metallic[oa]\b/.test(text);
}
