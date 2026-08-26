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

// Sommario del codice (ancore invariate: #ratti-gradi resta)
const SOMMARIO = [
  { href: "#ratti-cronache", num: "I",  t: "Cronache di Obia" },
  { href: "#ratti-reputazione", num: "II", t: "La Reputazione" },
  { href: "#ratti-gradi", num: "III", t: "Gradi di Reputazione" },
];

export default function RattiLore() {
  useParallaxScroll();

  return (
    <section className="cine-page ratti-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>

      {/* ── VARCO (prototipo J): il drider nel portale esagonale ── */}
      <GlacierHero
        id="ratti-top"
        ariaLabel="La Gilda dei Ratti"
        image={HERO_IMAGE}
        eyebrow="Il Sottosuolo di Exanthia"
        title={<>La Gilda<br />dei Ratti</>}
        seal={`🐀 ${RATTO_LEVELS.length} gradi di reputazione`}
        tagline="Tra le macerie e l'ombra, la reputazione è la moneta più preziosa del Mercato Nero."
        actions={<a href="#ratti-gradi" className="gl-cta" aria-label="Scorri ai gradi">✦ Scala i gradi</a>}
      />

      {/* ── SOMMARIO a pillole ── */}
      <nav className="nx-pillole ratti-sommario" aria-label="Sommario del codice">
        {SOMMARIO.map(s => (
          <a key={s.href} href={s.href} className="nx-pillola">
            <span className="ratti-pill-num" aria-hidden="true">{s.num}</span>{s.t}
          </a>
        ))}
      </nav>

      <div className="nx-due ratti-corpo">
        {/* ── RUBRICA fissa ── */}
        <aside className="nx-pannello nx-pannello--sticky ratti-rubrica" aria-label="Indice del codice">
          <div className="nx-anello"><span className="nx-anello-ph" aria-hidden="true">🐀</span></div>
          <span className="nx-kicker">Codice del Sottosuolo</span>
          <h2 className="nx-titolo ratti-rubrica-titolo">Cronache di Obia</h2>
          <div className="ratti-rubrica-lista">
            {SOMMARIO.map(s => (
              <a key={s.href} href={s.href} className="nx-pillola ratti-rubrica-voce">
                <span className="ratti-pill-num" aria-hidden="true">{s.num}</span>{s.t}
              </a>
            ))}
          </div>
          <p className="nx-nota">1852 anni dopo la Caduta delle Stelle. Ogni affare al Mercato Nero è un gradino.</p>
        </aside>

        {/* ── FLUSSO ── */}
        <div className="ratti-flusso">

          {/* I · CRONACHE */}
          <section id="ratti-cronache" className="ratti-section">
            <div className="gl-sezlabel">Capitolo I · Cronache di Obia</div>
            <div className="nx-pannello ratti-lore">
              <p className="nx-prosa">
                Nelle cronache di <strong>Obia</strong>, tra le macerie della prima grande guerra, si parla di uno squadrone
                eterogeneo conosciuto come i <strong>"Ratti"</strong>. Mentre gli eserciti cadevano, questo gruppo
                formato da rinnegati di ogni razza combatteva nell'ombra, riuscendo da solo a ricacciare nell'abisso oltre la
                metà delle legioni demoniache e abbattendo due generali infernali.
              </p>

              <blockquote className="nx-citazione ratti-quote">
                <i>"Non cercavano la gloria dei serafini, ma la sopravvivenza del fango."</i>
              </blockquote>

              <p className="nx-prosa">
                Oggi, 1852 anni dopo la <em><b>Caduta delle Stelle</b></em>, la reputazione tra i Ratti non è solo un titolo,
                ma la chiave per accedere alle risorse più rare di Exanthia. Interagire con il Mercato Nero significa dimostrare
                la propria astuzia: ogni offerta piazzata e ogni affare concluso aumenta la tua influenza nel sottosuolo.
              </p>
            </div>
          </section>

          {/* II · REPUTAZIONE */}
          <section id="ratti-reputazione" className="ratti-section">
            <div className="gl-sezlabel">Capitolo II · Come funziona la reputazione</div>
            <div className="nx-pannello ratti-lore">
              <p className="nx-prosa">
                Ogni acquisto effettuato nel Mercato Nero ti fa guadagnare Punti Ratto (PR). Più alto è il tuo livello di Ratto,
                più vantaggi sblocchi, come sconti esclusivi, accesso a oggetti nascosti e persino poteri temporanei.
                Ma attenzione: i Ratti sono sempre alla ricerca di nuovi membri, e la tua reputazione è la tua moneta più preziosa.
                Riuscirai a scalare le gerarchie del sottosuolo e diventare una leggenda tra i Ratti?
              </p>
              <p className="nx-prosa">
                Ovviamente i criminali più pericolosi di Exanthia sono continuamente alla ricerca di tesori… e questo fa di voi delle possibili prede.
              </p>
              <div className="nx-griglia ratti-passi">
                <div className="nx-pannello ratti-passo"><span className="ratti-passo-ic" aria-hidden="true">🛒</span><span className="nx-nome">Compra</span><span className="nx-nota">Ogni acquisto al Mercato Nero vale Punti Ratto.</span></div>
                <div className="nx-pannello ratti-passo"><span className="ratti-passo-ic" aria-hidden="true">📈</span><span className="nx-nome">Sali</span><span className="nx-nota">Raggiunta la soglia, il grado cresce da solo.</span></div>
                <div className="nx-pannello ratti-passo"><span className="ratti-passo-ic" aria-hidden="true">🗝️</span><span className="nx-nome">Sblocca</span><span className="nx-nota">Sconti, slot segreti, boon e poteri.</span></div>
              </div>
            </div>
          </section>

          {/* III · GRADI (id-ancora invariato) */}
          <section id="ratti-gradi" className="ratti-section">
            <div className="gl-sezlabel">Capitolo III · Gradi di Reputazione</div>
            <p className="nx-nota ratti-gradi-sub">Scala le gerarchie del sottosuolo, un affare alla volta.</p>
            <div className="nx-griglia nx-griglia--larga ratti-scala">
              {RATTO_LEVELS.map((l) => (
                <div key={l.lv} className="nx-pannello nx-pannello--tap ratti-grado">
                  <span className="nx-tag">{l.min} PR</span>
                  <span className="orb" aria-hidden="true">{l.lv}</span>
                  <h3 className="nx-nome ratti-grado-nome">{l.name}</h3>
                  <span className="nx-meta">Livello {l.lv}</span>
                  <p className="nx-nota ratti-grado-bonus">{l.bonus}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
