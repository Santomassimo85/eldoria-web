import { useEffect, useRef } from "react";
import SegretePartySprite from "./SegretePartySprite";
import SegreteIdentity from "./SegreteIdentity";
import { RACES } from "../data/segreteRaces";
import { clsStyle } from "../data/segrete";
import { statusIcons } from "../utils/segreteCombat";

export default function SegreteCompanionCard({ hero, round, acted, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  const states = statusIcons(hero, round);
  return <dialog ref={ref} className="cw-companion-dialog" style={clsStyle(hero.cls)} aria-label={`Scheda di ${hero.name}`} onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
    <button type="button" className="cw-companion-close" onClick={onClose} autoFocus>Chiudi</button>
    <div className="cw-companion-heading">
      <SegretePartySprite hero={hero} large />
      <div><h2>{hero.name}</h2><p><SegreteIdentity cls={hero.cls} hero={hero} /></p><p>{RACES[hero.race]?.name || "Umano"} · Lv {hero.level}{hero.size === "small" ? " · taglia piccola" : ""}</p></div>
    </div>
    <p className="cw-companion-vitals"><b>{hero.hp}/{hero.maxHp} PF</b><span>CA {hero.ac}</span></p>
    <p>{hero.fled ? "Fuggito" : hero.hp <= 0 ? "A terra" : acted ? "Ha agito in questo round" : "Deve ancora agire"}</p>
    {!!states.length && <ul>{states.map((state) => <li key={state.k}>{state.ico} {state.t}{state.n ? ` · ${state.n} turni` : ""}</li>)}</ul>}
  </dialog>;
}
