import React from "react";
import "../styles/cinematic.css";
import "./RattiLore.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/drider.png";
const DIVIDER_IMAGE = "/assets/PhotoStory/GruppoLAC/mago_fungo.png";

const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo", bonus: "Nessun privilegio. Sei solo un altro volto nella massa." },
  { lv: 1, min: 5, name: "Simpatizzante", bonus: "Sconto di 15 MP sul prossimo acquisto + un regalo (tira 1d100)." },
  { lv: 2, min: 15, name: "Informatore", bonus: "Accesso a slot mercato segreti (oggetti visibili solo a Lv. 2+)." },
  { lv: 3, min: 30, name: "Ricettatore", bonus: "Acquisto di un 'Boon' (Bonus temporaneo) per una sessione + un regalo (tira 1d100)." },
  { lv: 4, min: 50, name: "Veterano", bonus: "Sblocco di un secondo slot mercato extra per oggetti leggendari." },
  { lv: 5, min: 80, name: "Ombra di Obia", bonus: "+100 MP, +1 Carisma permanente e l'Occhio dell'Arcano." },
  { lv: 6, min: 110, name: "Ratto", bonus: "Coming Soon..." }
];

export default function RattiLore() {
  useParallaxScroll();

  return (
    <section className="cine-page ratti-page" style={{ "--cine-accent": "#6e7a2a", "--cine-accent-2": "#9aab3a" }}>

      {/* ── HERO ── */}
      <section className="cine-hero cine-hero--short" aria-label="La Gilda dei Ratti">
        <div className="cine-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-hero-vignette" />
          <div className="cine-hero-gradient" />
          <div className="cine-hero-pattern" />
        </div>
        <div className="cine-hero-content">
          <span className="cine-eyebrow">Il Sottosuolo di Exanthia</span>
          <h1 className="cine-hero-title">La Gilda dei Ratti</h1>
          <p className="cine-hero-tagline">
            Tra le macerie e l'ombra, la reputazione è la moneta più preziosa del Mercato Nero.
          </p>
        </div>
        <div className="cine-hero-scroll-hint" aria-hidden="true">
          <span>Scorri</span>
          <span className="cine-hero-arrow">↓</span>
        </div>
      </section>

      {/* ── LORE ── */}
      <div className="cine-wrap cine-wrap--narrow">
        <article className="cine-panel ratti-lore">
          <p>
            Nelle cronache di <strong>Obia</strong>, tra le macerie della prima grande guerra, si parla di uno squadrone
            eterogeneo conosciuto come i <strong>"Ratti"</strong>. Mentre gli eserciti cadevano, questo gruppo
            formato da rinnegati di ogni razza combatteva nell'ombra, riuscendo da solo a ricacciare nell'abisso oltre la
            metà delle legioni demoniache e abbattendo due generali infernali.
          </p>

          <blockquote className="ratti-quote">
            <i>"Non cercavano la gloria dei serafini, ma la sopravvivenza del fango."</i>
          </blockquote>

          <p>
            Oggi, 1852 anni dopo la <em><b>Caduta delle Stelle</b></em>, la reputazione tra i Ratti non è solo un titolo,
            ma la chiave per accedere alle risorse più rare di Exanthia. Interagire con il Mercato Nero significa dimostrare
            la propria astuzia: ogni offerta piazzata e ogni affare concluso aumenta la tua influenza nel sottosuolo.
          </p>

          <h3 className="ratti-subtitle">🐀 Come funziona la reputazione?</h3>
          <p>
            Ogni acquisto effettuato nel Mercato Nero ti fa guadagnare Punti Ratto (PR). Più alto è il tuo livello di Ratto,
            più vantaggi sblocchi, come sconti esclusivi, accesso a oggetti nascosti e persino poteri temporanei.
            Ma attenzione: i Ratti sono sempre alla ricerca di nuovi membri, e la tua reputazione è la tua moneta più preziosa.
            Riuscirai a scalare le gerarchie del sottosuolo e diventare una leggenda tra i Ratti?
          </p>
          <p>
            Ovviamente i criminali più pericolosi di Exanthia sono continuamente alla ricerca di tesori… e questo fa di voi delle possibili prede.
          </p>
        </article>
      </div>

      {/* ── DIVISORE: Gradi ── */}
      <section className="cine-scrolly cine-scrolly--short" aria-label="Gradi di Reputazione">
        <div className="cine-scrolly-media" aria-hidden="true">
          <img src={DIVIDER_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-scrolly-bottom-fade" aria-hidden="true" />
        </div>
        <div className="cine-scrolly-content">
          <div className="cine-scrolly-frame">
            <span className="cine-scrolly-eyebrow">Gerarchie</span>
            <h2 className="cine-scrolly-title">Gradi di Reputazione</h2>
            <p className="cine-scrolly-text">Scala le gerarchie del sottosuolo, un affare alla volta.</p>
          </div>
        </div>
      </section>

      {/* ── TABELLA ── */}
      <div className="cine-wrap cine-wrap--narrow">
        <div className="ratti-table-wrap">
          <table className="ratti-table">
            <thead>
              <tr>
                <th>Grado</th>
                <th>Punti</th>
                <th>Privilegi del Sottosuolo</th>
              </tr>
            </thead>
            <tbody>
              {RATTO_LEVELS.map((l) => (
                <tr key={l.lv}>
                  <td><strong>Lv.{l.lv} — {l.name}</strong></td>
                  <td className="ratti-pr">{l.min} PR</td>
                  <td className="ratti-bonus">{l.bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
