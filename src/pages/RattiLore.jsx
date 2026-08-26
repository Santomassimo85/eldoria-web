import React from "react";
import GlacierHero from "../components/glacier/GlacierHero";
import "../styles/cinematic.css";
import "./RattiLore.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/drider.png";

const RATTO_LEVELS = [
  { lv: 0, min: 0, name: "Estraneo", bonus: "Nessun privilegio. Sei solo un altro volto nella massa." },
  { lv: 1, min: 5, name: "Simpatizzante", bonus: "Sconto di 15 Corone sul prossimo acquisto + un regalo (tira 1d100)." },
  { lv: 2, min: 15, name: "Informatore", bonus: "Accesso a slot mercato segreti (oggetti visibili solo a Lv. 2+)." },
  { lv: 3, min: 30, name: "Ricettatore", bonus: "Acquisto di un 'Boon' (Bonus temporaneo) per una sessione + un regalo (tira 1d100)." },
  { lv: 4, min: 50, name: "Veterano", bonus: "Sblocco di un secondo slot mercato extra per oggetti leggendari." },
  { lv: 5, min: 80, name: "Ombra di Obia", bonus: "+100 Corone, +1 Carisma permanente e l'Occhio dell'Arcano." },
  { lv: 6, min: 110, name: "Ratto", bonus: "Coming Soon..." }
];

export default function RattiLore() {
  useParallaxScroll();

  return (
    <section className="cine-page ratti-page" style={{ "--cine-accent": "#6e7a2a", "--cine-accent-2": "#9aab3a" }}>

      {/* ── HERO = FINESTRA ARTICA (mockup B): il drider nell'arco di
            ghiaccio, titolo inciso sulla lastra, CTA a cristallo sotto ── */}
      <GlacierHero
        id="ratti-top"
        ariaLabel="La Gilda dei Ratti"
        image={HERO_IMAGE}
        eyebrow="Il Sottosuolo di Exanthia"
        title={<>La Gilda<br />dei Ratti</>}
        seal={`🐀 ${RATTO_LEVELS.length} gradi di reputazione`}
        tagline="Tra le macerie e l'ombra, la reputazione è la moneta più preziosa del Mercato Nero."
        actions={<a href="#ratti-gradi" className="gl-cta" aria-label="Scorri ai gradi">❆ Scala i gradi</a>}
      />

      {/* ── LORE a manoscritto (marginalia + capolettera) ── */}
      <section className="ratti-lore">
        <aside className="ratti-lore-aside">
          <span className="ratti-lore-orn" aria-hidden="true">🐀</span>
          <span className="ratti-lore-chapter">Cronache</span>
          <span className="ratti-lore-note">di Obia</span>
          <span className="ratti-lore-age">1852 anni dopo</span>
        </aside>
        <div className="ratti-lore-main">
          <p className="ratti-lore-text">
            <span className="ratti-lore-drop">N</span>elle cronache di <strong>Obia</strong>, tra le macerie della prima grande guerra, si parla di uno squadrone
            eterogeneo conosciuto come i <strong>"Ratti"</strong>. Mentre gli eserciti cadevano, questo gruppo
            formato da rinnegati di ogni razza combatteva nell'ombra, riuscendo da solo a ricacciare nell'abisso oltre la
            metà delle legioni demoniache e abbattendo due generali infernali.
          </p>

          <blockquote className="ratti-quote">
            <i>"Non cercavano la gloria dei serafini, ma la sopravvivenza del fango."</i>
          </blockquote>

          <p className="ratti-lore-text">
            Oggi, 1852 anni dopo la <em><b>Caduta delle Stelle</b></em>, la reputazione tra i Ratti non è solo un titolo,
            ma la chiave per accedere alle risorse più rare di Exanthia. Interagire con il Mercato Nero significa dimostrare
            la propria astuzia: ogni offerta piazzata e ogni affare concluso aumenta la tua influenza nel sottosuolo.
          </p>

          <h3 className="ratti-subtitle">🐀 Come funziona la reputazione?</h3>
          <p className="ratti-lore-text">
            Ogni acquisto effettuato nel Mercato Nero ti fa guadagnare Punti Ratto (PR). Più alto è il tuo livello di Ratto,
            più vantaggi sblocchi, come sconti esclusivi, accesso a oggetti nascosti e persino poteri temporanei.
            Ma attenzione: i Ratti sono sempre alla ricerca di nuovi membri, e la tua reputazione è la tua moneta più preziosa.
            Riuscirai a scalare le gerarchie del sottosuolo e diventare una leggenda tra i Ratti?
          </p>
          <p className="ratti-lore-text">
            Ovviamente i criminali più pericolosi di Exanthia sono continuamente alla ricerca di tesori… e questo fa di voi delle possibili prede.
          </p>
        </div>
      </section>

      {/* ── ETICHETTA DI SEZIONE: Gradi (id-ancora invariato) ── */}
      <div id="ratti-gradi" className="gl-sezlabel">Gerarchie · Gradi di Reputazione</div>
      <p className="gl-vetrata-sub ratti-gradi-sub">Scala le gerarchie del sottosuolo, un affare alla volta.</p>

      {/* ── SCALA GERARCHICA (ladder) ── */}
      <div className="ratti-ladder">
        {RATTO_LEVELS.map((l) => (
          <div key={l.lv} className="ratti-rung">
            <div className="ratti-rung-seal">
              <span className="ratti-rung-lv">Lv.{l.lv}</span>
            </div>
            <div className="ratti-rung-body">
              <div className="ratti-rung-head">
                <h3 className="ratti-rung-name">{l.name}</h3>
                <span className="ratti-rung-pr">{l.min} PR</span>
              </div>
              <p className="ratti-rung-bonus">{l.bonus}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
