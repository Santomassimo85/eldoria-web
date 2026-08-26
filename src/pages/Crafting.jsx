import React, { useMemo, useState } from "react";
import {
  HERO_QUOTE,
  PREGIATURE,
  SENTIERO_MAESTRO,
  BONUS_LIVELLO_PG,
  PREGIATURA_COSTS,
  VANTAGGIO_SVANTAGGIO,
  ESEMPI_INGREDIENTI,
  PROFESSIONI,
  ESEMPI_GIOCO,
} from "../data/crafting";
import GlacierHero from "../components/glacier/GlacierHero";
import "./Crafting.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/helmvil_nani.png";

const CARATTERISTICHE = ["all", "FOR", "DES", "INT", "SAG", "MAG"];
const CARATTERISTICA_LABEL = {
  all: "Tutte",
  FOR: "Forza",
  DES: "Destrezza",
  INT: "Intelligenza",
  SAG: "Saggezza",
  MAG: "Magica",
};

// ── Recap lampo: il crafting in 3 mosse, linguaggio semplice ────────────────
const RECAP_STEPS = [
  { ic: "🛠️", k: "Scegli", t: "cosa vuoi creare" },
  { ic: "🎲", k: "Tira", t: "1d20 + i tuoi bonus" },
  { ic: "✨", k: "Il totale", t: "decide la qualità" },
];

// ── Chi tira e perché ───────────────────────────────────────────────────────
const CHI_TIRA = [
  { ic: "🙋", k: "Chi tira", t: "Il giocatore che ha la professione — l'artigiano. Il DM non tira: dà il via e decide i dettagli." },
  { ic: "⏰", k: "Quando", t: "Ogni volta che crea, ripara o migliora qualcosa. Un tiro per oggetto." },
  { ic: "🎯", k: "Perché", t: "Il risultato del d20 decide la qualità di ciò che esce, da Scarso a Perfetto." },
];

// ── Crafting Libero: usi tipici + procedura ─────────────────────────────────
const LIBERO_USI = [
  { ic: "🆕", t: "Inventare un oggetto che non è nelle tabelle" },
  { ic: "🔧", t: "Riparare un oggetto rotto (torna Comune/Raro)" },
  { ic: "⬆️", t: "Migliorare o incantare la tua roba (sali di un grado)" },
  { ic: "🎨", t: "Qualsiasi cosa sensata per la tua arte" },
];
const LIBERO_STEPS = [
  "Descrivi cosa vuoi ottenere e parlane col DM.",
  "Il DM fissa materiali, tempo e la qualità-obiettivo (il grado a cui punti).",
  "Tiri come sempre: 1d20 + Mod Caratteristica + Bonus Strumenti.",
  "Il risultato decide com'è venuto, da Scarso a Perfetto — come per gli oggetti in tabella.",
];

// ── Sommario del manuale (ancore invariate) ─────────────────────────────────
const SOMMARIO = [
  { href: "#cr-pregiature", num: "I",   t: "Le Cinque Pregiature" },
  { href: "#cr-tiro",       num: "II",  t: "Il Tiro di Pregiatura" },
  { href: "#cr-libero",     num: "★",   t: "Crafting Libero" },
  { href: "#cr-materiali",  num: "III", t: "Materiali, Tempo, Costi" },
  { href: "#cr-sentiero",   num: "IV",  t: "Il Sentiero del Maestro" },
  { href: "#cr-professioni", num: "V",  t: "Le 10 Professioni" },
  { href: "#cr-esempi",     num: "VI",  t: "Esempi di Gioco" },
];

export default function Crafting() {
  useParallaxScroll();
  const [filter, setFilter] = useState("all");
  const [openProf, setOpenProf] = useState(null);

  const visibleProfessioni = useMemo(
    () => filter === "all"
      ? PROFESSIONI
      : PROFESSIONI.filter(p => p.carShort === filter),
    [filter]
  );

  return (
    <section className="cine-page cr-page" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      {/* ── VARCO (prototipo J): la forgia dei nani nel portale esagonale ── */}
      <GlacierHero
        id="cr-top"
        ariaLabel="Crafting di Exanthia"
        image={HERO_IMAGE}
        eyebrow="Manuale dell'Artigiano"
        title={<>Crafting<br />di Exanthia</>}
        seal="⚒ Sistema 5e · 10 professioni · 5 pregiature"
        tagline={HERO_QUOTE}
        actions={<a href="#cr-index" className="gl-cta" aria-label="Scorri al sommario">✦ Sfoglia il sommario</a>}
      />

      {/* ── SOMMARIO a pillole (satelliti del manuale) ── */}
      <nav id="cr-index" className="nx-pillole cr-sommario" aria-label="Sommario del manuale">
        {SOMMARIO.map(s => (
          <a key={s.href} href={s.href} className="nx-pillola">
            <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
          </a>
        ))}
      </nav>

      <div className="nx-due cr-corpo">
        {/* ── RUBRICA fissa: indice compatto in colonna ── */}
        <aside className="nx-pannello nx-pannello--sticky cr-rubrica" aria-label="Indice del manuale">
          <span className="nx-kicker">Tomo dell'Artigiano</span>
          <h2 className="nx-titolo cr-rubrica-titolo">Sommario</h2>
          <div className="cr-rubrica-lista">
            {SOMMARIO.map(s => (
              <a key={s.href} href={s.href} className="nx-pillola cr-rubrica-voce">
                <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
              </a>
            ))}
          </div>
          <p className="nx-nota">Un tiro solo: d20 + caratteristica + strumenti. Il totale decide la qualità.</p>
        </aside>

        {/* ── FLUSSO dei capitoli ── */}
        <div className="cr-flusso">

          {/* ── RECAP LAMPO — il crafting in 3 mosse ── */}
          <section className="cr-section cr-recap-sec">
            <div className="nx-pannello cr-recap">
              <span className="nx-pillola on cr-recap-badge">⚡ In due parole</span>
              <p className="nx-prosa cr-recap-lead">
                Creare un oggetto è <strong>un tiro solo</strong>: scegli cosa fare, tiri <strong>1d20</strong> e
                sommi i tuoi bonus. Più alto è il totale, più l'oggetto è pregiato — da <strong>Scarso</strong> a
                <strong> Perfetto</strong>. Tira il giocatore; il DM dà il via e decide i dettagli.
              </p>
              <ol className="nx-griglia cr-recap-steps">
                {RECAP_STEPS.map((r, i) => (
                  <li key={i} className="nx-pannello cr-passo">
                    <span className="cr-passo-ic" aria-hidden="true">{r.ic}</span>
                    <span className="nx-nome">{r.k}</span>
                    <span className="nx-nota">{r.t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ── I · PREGIATURE ───────────────────────────── */}
          <section id="cr-pregiature" className="cr-section" data-chapter="I">
            <div className="gl-sezlabel">Capitolo I · Le Cinque Pregiature</div>
            <p className="nx-nota cr-section-sub">Ogni oggetto creato ottiene una qualità basata sul tiro di Pregiatura.</p>
            <div className="nx-griglia cr-pregiature-row">
              {PREGIATURE.map(p => (
                <div key={p.key} className="nx-pannello nx-pannello--tap cr-preg-card" style={{ "--q": p.color }}>
                  <span className="nx-tag">{p.range}</span>
                  <div className="cr-preg-icon" aria-hidden="true">{p.icon}</div>
                  <div className="nx-nome cr-preg-label">{p.label}</div>
                  <div className="nx-nota cr-preg-desc">{p.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── II · TIRO ────────────────────────────────── */}
          <section id="cr-tiro" className="cr-section" data-chapter="II">
            <div className="gl-sezlabel">Capitolo II · Il Tiro di Pregiatura</div>
            <p className="nx-nota cr-section-sub">Un unico tiro decide la qualità di ciò che crei. Ecco chi lo fa e perché.</p>

            <div className="nx-griglia cr-whoroll">
              {CHI_TIRA.map((c, i) => (
                <div key={i} className="nx-pannello cr-passo">
                  <span className="cr-passo-ic" aria-hidden="true">{c.ic}</span>
                  <span className="nx-nome">{c.k}</span>
                  <span className="nx-nota">{c.t}</span>
                </div>
              ))}
            </div>

            <div className="nx-pannello cr-formula-box">
              <span className="nx-kicker">Formula</span>
              <div className="cr-formula">
                <span className="cr-die">d20</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Mod Caratteristica</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Bonus Strumenti</span>
              </div>
              <p className="nx-prosa cr-formula-note">
                La <strong>Caratteristica</strong> cambia con la professione (es. Fabbro = Forza, Alchimista =
                Intelligenza). Il <strong>Bonus Strumenti</strong> (competenza) si aggiunge solo se il PG è
                competente negli strumenti di quella professione.
              </p>
            </div>

            <h3 className="cr-subtitle">Caratteristica per Professione</h3>
            <div className="nx-pillole cr-prof-chips">
              {PROFESSIONI.map(p => (
                <span key={p.key} className="nx-pillola cr-prof-chip" style={{ "--c": p.carColor }}>
                  <span className="cr-prof-chip-icon" aria-hidden="true">{p.icon}</span>
                  <span className="cr-prof-chip-name">{p.name}</span>
                  <span className="cr-prof-chip-stat">{p.carShort}</span>
                </span>
              ))}
            </div>

            <h3 className="cr-subtitle">Vantaggio e Svantaggio</h3>
            <div className="nx-griglia nx-griglia--larga cr-modifiers-grid">
              {VANTAGGIO_SVANTAGGIO.map((m, i) => (
                <div key={i} className={`nx-pannello cr-modifier ${m.positive ? "cr-modifier--good" : "cr-modifier--bad"}`}>
                  <span className="cr-modifier-sign" aria-hidden="true">{m.positive ? "▲" : "▼"}</span>
                  <span className="nx-nome cr-modifier-cond">{m.condizione}</span>
                  <span className="nx-nota cr-modifier-eff">{m.effetto}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── ★ · CRAFTING LIBERO ── */}
          <section id="cr-libero" className="cr-section">
            <div className="gl-sezlabel">★ · Crafting Libero</div>
            <div className="nx-pannello cr-libero">
              <span className="nx-pillola on cr-libero-badge">✨ Regola d'oro</span>
              <h2 className="nx-titolo cr-libero-title">Vuoi creare qualcosa che non è in tabella?</h2>
              <p className="nx-prosa cr-libero-lead">
                Le tabelle sono solo <strong>esempi</strong>. Se vuoi inventare un oggetto nuovo, riparare o
                potenziare la tua roba, o fare qualsiasi cosa sensata per la tua professione,
                <strong> puoi farlo</strong>. Non serve che sia scritto da qualche parte.
              </p>

              <div className="nx-griglia cr-libero-usi">
                {LIBERO_USI.map((u, i) => (
                  <div key={i} className="nx-pannello cr-libero-uso">
                    <span className="cr-passo-ic" aria-hidden="true">{u.ic}</span>
                    <p className="nx-nota">{u.t}</p>
                  </div>
                ))}
              </div>

              <ol className="cr-libero-steps">
                {LIBERO_STEPS.map((s, i) => (
                  <li key={i}><span className="orb" aria-hidden="true">{i + 1}</span><span className="nx-prosa">{s}</span></li>
                ))}
              </ol>

              <p className="nx-citazione cr-libero-foot">
                Regola d'oro: se è coerente con la tua arte, il DM può sempre dire «sì, tira». La qualità la
                decidono i dadi, non l'elenco.
              </p>
            </div>
          </section>

          {/* ── III · MATERIALI, TEMPO, COSTI ───────────── */}
          <section id="cr-materiali" className="cr-section" data-chapter="III">
            <div className="gl-sezlabel">Capitolo III · Materiali, Tempo, Costi</div>
            <p className="nx-nota cr-section-sub">La pregiatura mirata determina costo e tempo. Tirare al di sotto significa ottenere comunque un oggetto inferiore.</p>
            <div className="cr-cost-table">
              {PREGIATURA_COSTS.map(c => {
                const meta = PREGIATURE.find(p => p.key === c.tier);
                return (
                  <div key={c.tier} className="nx-pannello cr-cost-row" style={{ "--q": meta.color }}>
                    <div className="nx-nome cr-cost-tier">{meta.icon} {meta.label}</div>
                    <div className="cr-cost-cell"><span className="cr-cost-label">Costo</span> {c.costo}</div>
                    <div className="cr-cost-cell"><span className="cr-cost-label">Tempo</span> {c.tempo}</div>
                    <div className="nx-nota cr-cost-note">{c.note}</div>
                  </div>
                );
              })}
            </div>

            <h3 className="cr-subtitle">Esempi di Ingredienti</h3>
            <div className="nx-pannello cr-ingredients-table">
              <div className="cr-ing-head">
                <div>Professione</div>
                <div>Raro</div>
                <div>Magico</div>
                <div>Perfetto</div>
              </div>
              {ESEMPI_INGREDIENTI.map(row => (
                <div key={row.professione} className="cr-ing-row">
                  <div className="cr-ing-prof">{row.professione}</div>
                  <div>{row.raro}</div>
                  <div>{row.magico}</div>
                  <div>{row.perfetto}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── IV · SENTIERO DEL MAESTRO ───────────────── */}
          <section id="cr-sentiero" className="cr-section" data-chapter="IV">
            <div className="gl-sezlabel">Capitolo IV · Il Sentiero del Maestro</div>
            <p className="nx-nota cr-section-sub">
              L'artigiano cresce creando opere notevoli, non semplicemente accumulando esperienza.
              Ogni oggetto Raro o superiore è un punto sulla scheda.
            </p>
            <div className="nx-griglia nx-griglia--larga cr-sentiero">
              {SENTIERO_MAESTRO.map((s) => (
                <div key={s.grado} className="nx-pannello cr-sentiero-step">
                  <div className="cr-sentiero-num">
                    <span className="orb" aria-hidden="true">{s.grado}</span>
                    <span className="cr-sentiero-icon" aria-hidden="true">{s.icon}</span>
                  </div>
                  <div className="cr-sentiero-body">
                    <div className="nx-nome cr-sentiero-name">{s.name}</div>
                    <div className="nx-meta cr-sentiero-soglia">{s.soglia}</div>
                    <div className="nx-nota cr-sentiero-bonus"><strong>Bonus:</strong> {s.bonus}</div>
                    <div className="nx-nota cr-sentiero-cap"><strong>Capacità:</strong> {s.capacita}</div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="cr-subtitle">Bonus per Livello del Personaggio</h3>
            <div className="nx-griglia cr-lv-grid">
              {BONUS_LIVELLO_PG.map(b => (
                <div key={b.lv} className="nx-pannello cr-lv-card">
                  <span className="nx-pillola on cr-lv-badge">Liv. {b.lv}</span>
                  <div className="nx-nota cr-lv-text">{b.bonus}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── V · PROFESSIONI ─────────────────────────── */}
          <section id="cr-professioni" className="cr-section" data-chapter="V">
            <div className="gl-sezlabel">Capitolo V · Le 10 Professioni</div>
            <p className="nx-nota cr-section-sub">
              Dieci vie verso la maestria. Una sola scegli alla creazione del personaggio.
            </p>

            <div className="nx-pillole cr-filter-row">
              {CARATTERISTICHE.map(k => (
                <button
                  key={k}
                  type="button"
                  className={`nx-pillola cr-filter-btn ${filter === k ? "on" : ""}`}
                  onClick={() => setFilter(k)}
                >
                  {CARATTERISTICA_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="cr-prof-grid">
              {visibleProfessioni.map(p => (
                <ProfessionCard
                  key={p.key}
                  prof={p}
                  isOpen={openProf === p.key}
                  onToggle={() => setOpenProf(openProf === p.key ? null : p.key)}
                />
              ))}
            </div>
          </section>

          {/* ── VI · ESEMPI DI GIOCO ───────────────────── */}
          <section id="cr-esempi" className="cr-section" data-chapter="VI">
            <div className="gl-sezlabel">Capitolo VI · Esempi di Gioco</div>
            <p className="nx-nota cr-section-sub">Tre scene dal tavolo per chiarire come tutto si combina.</p>
            <div className="nx-griglia nx-griglia--larga cr-examples">
              {ESEMPI_GIOCO.map((e, i) => (
                <div key={i} className="nx-pannello cr-example">
                  <span className="nx-tag">Scena {i + 1}</span>
                  <h4 className="nx-nome cr-example-title">{e.title}</h4>
                  <div className="nx-meta cr-example-char">{e.character}</div>
                  <div className="nx-nota cr-example-row"><strong>Obiettivo:</strong> {e.obiettivo}</div>
                  <div className="nx-nota cr-example-row"><strong>Materiali:</strong> {e.materiali}</div>
                  <div className="nx-nota cr-example-row"><strong>Tempo:</strong> {e.tempo}</div>
                  <div className="cr-example-tiro"><strong>Tiro:</strong> {e.tiro}</div>
                  <div className="cr-example-result">{e.risultato}</div>
                  <div className="nx-citazione cr-example-esito">{e.esito}</div>
                </div>
              ))}
            </div>
          </section>

          <footer className="cr-footer">
            <em>Buon crafting, artigiani di Exanthia.</em>
          </footer>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ProfessionCard — pannello espandibile con le tabelle d12
   ============================================================ */
function ProfessionCard({ prof, isOpen, onToggle }) {
  const [tier, setTier] = useState("comune");
  const items = prof.creazioni[tier] || [];
  const tierMeta = PREGIATURE.find(p => p.key === tier);

  return (
    <div className={`nx-pannello cr-prof-card ${isOpen ? "cr-prof-card--open" : ""}`} style={{ "--c": prof.carColor }}>
      <button
        type="button"
        className="cr-prof-head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="orb cr-prof-num" aria-hidden="true">{String(prof.index).padStart(2, "0")}</span>
        <span className="cr-prof-icon" aria-hidden="true">{prof.icon}</span>
        <span className="cr-prof-info">
          <span className="nx-nome cr-prof-name">{prof.name}</span>
          <span className="cr-prof-meta">
            <span className="cr-prof-pill">{prof.carShort}</span>
            <span className="nx-meta cr-prof-car">{prof.caratteristica}</span>
          </span>
        </span>
        <span className="cr-prof-toggle" aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen && (
        <div className="cr-prof-body">
          <blockquote className="nx-citazione cr-prof-quote">{prof.quote}</blockquote>

          <div className="nx-meta-box cr-scheda">
            <span className="nx-kicker">Scheda della professione</span>
            <p><strong>Caratteristica:</strong> {prof.caratteristica}</p>
            <p><strong>Bonus Iniziale (Lv.1):</strong> {prof.bonusIniziale}</p>
            <p><strong>Potenziamento (Lv.5):</strong> {prof.potenziamento}</p>
            <div className="cr-scheda-spec">
              <p><strong>Specializzazioni (Lv.10 — sceglierne una)</strong></p>
              <ul className="cr-scheda-spec-list">
                {prof.specializzazioni.map(s => (
                  <li key={s.name}>
                    <strong>{s.name}:</strong> {s.desc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h4 className="cr-subtitle cr-creazioni-title">🎲 Tabella d12 — Creazioni del {prof.name}</h4>
          <div className="nx-pillole cr-tier-tabs">
            {PREGIATURE.map(p => (
              <button
                key={p.key}
                type="button"
                className={`nx-pillola cr-tier-tab ${tier === p.key ? "on" : ""}`}
                onClick={() => setTier(p.key)}
                style={{ "--q": p.color }}
              >
                {p.icon} {p.label}
                <span className="cr-tier-range">{p.range}</span>
              </button>
            ))}
          </div>

          <div className="cr-d12-table" style={{ "--q": tierMeta.color }}>
            {items.map(([name, desc], i) => (
              <div key={i} className="cr-d12-row">
                <span className="orb cr-d12-num" aria-hidden="true">{i + 1}</span>
                <div className="cr-d12-content">
                  <div className="nx-nome cr-d12-name">{name}</div>
                  <div className="nx-nota cr-d12-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
