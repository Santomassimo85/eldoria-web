import { classInfo } from "../data/segrete";
import { heroSubclass, subclassOf } from "../data/segreteKits";

// Persistent heroes validate ownership; room/run snapshots already carry the active key.
export function subclassName(cls, hero) {
  if (!hero) return "";
  if (Array.isArray(hero.subclasses)) return heroSubclass(cls, hero)?.name || "";
  return hero.subName || subclassOf(cls, hero.subclass)?.name || "";
}

export function heroIdentity(cls, hero) {
  return [classInfo(cls)?.it || cls, subclassName(cls, hero)].filter(Boolean).join(" · ");
}
