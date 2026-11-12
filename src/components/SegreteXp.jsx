import { heroXp, heroLevel, xpForLevel, MAX_STORY_LEVEL } from "../data/segreteKits";
import "./SegreteXp.css";

export default function SegreteXp({ hero, className = "" }) {
  const xp = heroXp(hero), lv = heroLevel(hero);
  const from = xpForLevel(lv), to = xpForLevel(lv + 1);
  const max = lv >= MAX_STORY_LEVEL;
  const pct = max ? 100 : Math.max(0, Math.min(100, 100 * (xp - from) / (to - from)));
  const text = max ? "PE · livello massimo" : `PE ${xp.toLocaleString("it-IT")} / ${to.toLocaleString("it-IT")} · Lv ${lv + 1}`;
  return <span className={`sg-xp ${className}`}>
    <span className="sg-xp-label">{text}</span>
    <span className="sg-xp-track" role="progressbar" aria-label="Esperienza della classe" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={text}><i style={{ width: `${pct}%` }} /></span>
  </span>;
}
