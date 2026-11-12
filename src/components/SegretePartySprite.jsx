import { ARENA_CLASSES } from "../data/arenaClassSprites";
import { RACES } from "../data/segreteRaces";

export function partySpriteOf(hero) {
  const index = Math.max(0, ARENA_CLASSES.findIndex((c) => c.key === hero?.cls));
  const race = Object.hasOwn(RACES, hero?.race) ? hero.race : "human";
  return { src: `/assets/segrete/party/${race}.webp`, column: index % 6, row: Math.floor(index / 6) };
}

export default function SegretePartySprite({ hero, large = false }) {
  const sprite = partySpriteOf(hero);
  return <span className={`cw-party-sprite${large ? " is-large" : ""}`} aria-hidden="true">
    <img src={sprite.src} alt="" draggable="false" decoding="async" style={{ left: `${-sprite.column * 100}%`, top: `${-sprite.row * 100}%` }} />
  </span>;
}
