import { GAME_ICONS } from "../assets/gameIcons";
import { sgIconName } from "../data/segreteIcons";
import "./GameIcon.css";

/* Icona di game-icons.net (vedi src/assets/gameIcons.js).
   name   = nome dell'icona; se manca nel set si mostra `fallback` (di solito l'emoji di prima)
   frame  = dentro la cornice a gradini (per carte, slot, tasti); senza = solo il disegno, in riga col testo
   size   = xs · sm · md · lg · xl
   color  = colore del disegno (default: il colore del contesto, `--gi-c` o l'accento del tema)
   title  = suggerimento al passaggio del mouse */
export default function GameIcon({ name, fallback = null, frame = false, size = "sm", color, title, className = "" }) {
  const body = name && GAME_ICONS[name];
  if (!body) return fallback ? <span className={`gi-emoji gi--${size} ${className}`} aria-hidden={title ? undefined : "true"} title={title}>{fallback}</span> : null;
  const style = color ? { "--gi-c": color } : undefined;
  return (
    <span className={`gi gi--${size}${frame ? " gi--frame" : ""} ${className}`} style={style} title={title} aria-hidden={title ? undefined : "true"}>
      <svg viewBox="0 0 512 512" focusable="false" dangerouslySetInnerHTML={{ __html: body }} />
    </span>
  );
}

/* Icona di un dato delle Segrete: kind = cls · weapon · armor · item · action · status · dungeon · diff · monster · ui.
   `of` = l'oggetto (classe, arma, azione…) o direttamente il suo id. Senza icona nella mappa → la sua emoji. */
export function SgIcon({ kind, of, ...rest }) {
  const name = sgIconName(kind, of);
  const fallback = rest.fallback ?? (of && typeof of === "object" ? of.icon : null);
  return <GameIcon name={name} {...rest} fallback={fallback} />;
}
