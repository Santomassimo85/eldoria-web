/* Sala della Gloria (2026-11-04) = la porta della Battaglia: due ingressi,
   l'Arena (PvP, /arena, invariata) e Le Segrete (story mode a dungeon, /segrete). */
import { Link } from "react-router-dom";
import "./SalaGloria.css";

const DOORS = [
  {
    to: "/arena", rune: "⚔", kicker: "PvP", title: "L'Arena dei Campioni",
    text: "Tornei della settimana, sfide libere fra eroi e contro l'IA, la Bottega e le scommesse. Uno contro uno, il pubblico che urla.",
    cta: "Entra nell'Arena",
  },
  {
    to: "/segrete", rune: "🗝", kicker: "Storia · da 1 a 4", title: "Le Segrete",
    text: "Forma un gruppo fino a quattro eroi e scendi nei dungeon: caverne, segrete, fiumi di magma. Mostri sempre diversi, si cresce di livello fino a domenica sera.",
    cta: "Scendi nelle Segrete",
  },
];

export default function SalaGloria() {
  return (
    <section className="sg-page">
      <header className="sg-head">
        <p className="sg-kicker">Battaglia</p>
        <h1 className="sg-title">Sala della Gloria</h1>
        <p className="sg-lead">Due porte, una sola regola: chi esce vivo racconta. Scegli dove combattere.</p>
      </header>
      <div className="sg-doors">
        {DOORS.map((d) => (
          <Link key={d.to} to={d.to} className="sg-door">
            <span className="sg-door-rune" aria-hidden="true">{d.rune}</span>
            <span className="sg-door-kicker">{d.kicker}</span>
            <span className="sg-door-title">{d.title}</span>
            <span className="sg-door-text">{d.text}</span>
            <span className="sg-door-cta">{d.cta} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
