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
    <section className="cine-page cr-page" style={{ "--cine-accent": "#b07a1f", "--cine-accent-2": "#d4922a" }}>
      {/* ── HERO = FINESTRA ARTICA (mockup B): la forgia dei nani nell'arco
            di ghiaccio, titolo inciso sulla lastra, CTA a cristallo sotto ── */}
      <GlacierHero
        id="cr-top"
        ariaLabel="Crafting di Exanthia"
        image={HERO_IMAGE}
        eyebrow="Manuale dell'Artigiano"
        title={<>Crafting<br />di Exanthia</>}
        seal="⚒ Sistema 5e · 10 professioni · 5 pregiature"
        tagline={HERO_QUOTE}
        actions={<a href="#cr-index" className="gl-cta" aria-label="Scorri al sommario">❆ Sfoglia il sommario</a>}
      />

      {/* ── SOMMARIO DEL MANUALE ── */}
      <nav id="cr-index" className="cr-index" aria-label="Sommario del manuale">
        <span className="cr-index-eyebrow">Sommario</span>
        <ol className="cr-index-list">
          <li><a href="#cr-pregiature"><span className="cr-index-num">I</span> Le Cinque Pregiature</a></li>
          <li><a href="#cr-tiro"><span className="cr-index-num">II</span> Il Tiro di Pregiatura</a></li>
          <li><a href="#cr-libero"><span className="cr-index-num cr-index-num--star">★</span> Crafting Libero</a></li>
          <li><a href="#cr-materiali"><span className="cr-index-num">III</span> Materiali, Tempo, Costi</a></li>
          <li><a href="#cr-sentiero"><span className="cr-index-num">IV</span> Il Sentiero del Maestro</a></li>
          <li><a href="#cr-professioni"><span className="cr-index-num">V</span> Le 10 Professioni</a></li>
          <li><a href="#cr-esempi"><span className="cr-index-num">VI</span> Esempi di Gioco</a></li>
        </ol>
      </nav>

      {/* ── RECAP LAMPO — il crafting in 3 mosse ── */}
      <section className="cr-section cr-recap-sec">
        <div className="cr-recap">
          <span className="cr-recap-badge">⚡ In due parole</span>
          <p className="cr-recap-lead">
            Creare un oggetto è <strong>un tiro solo</strong>: scegli cosa fare, tiri <strong>1d20</strong> e
            sommi i tuoi bonus. Più alto è il totale, più l'oggetto è pregiato — da <strong>Scarso</strong> a
            <strong> Perfetto</strong>. Tira il giocatore; il DM dà il via e decide i dettagli.
          </p>
          <ol className="cr-recap-steps">
            {RECAP_STEPS.map((r, i) => (
              <li key={i}>
                <span className="cr-recap-ic" aria-hidden="true">{r.ic}</span>
                <span className="cr-recap-txt"><b>{r.k}</b> {r.t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── PREGIATURE LADDER ───────────────────────────── */}
      <section id="cr-pregiature" className="cr-section" data-chapter="I">
        <h2 className="cr-section-title">⚖ Le Cinque Pregiature</h2>
        <p className="cr-section-sub">Ogni oggetto creato ottiene una qualità basata sul tiro di Pregiatura.</p>
        <div className="cr-pregiature-row">
          {PREGIATURE.map(p => (
            <div
              key={p.key}
              className="cr-preg-card"
              style={{ borderColor: p.color, background: p.bg }}
            >
              <div className="cr-preg-icon" style={{ color: p.color }}>{p.icon}</div>
              <div className="cr-preg-label" style={{ color: p.color }}>{p.label}</div>
              <div className="cr-preg-range">{p.range}</div>
              <div className="cr-preg-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FORMULA + CARATTERISTICHE ───────────────────── */}
      <section id="cr-tiro" className="cr-section" data-chapter="II">
        <h2 className="cr-section-title">🎲 Il Tiro di Pregiatura</h2>
        <p className="cr-section-sub">Un unico tiro decide la qualità di ciò che crei. Ecco chi lo fa e perché.</p>

        <div className="cr-whoroll">
          {CHI_TIRA.map((c, i) => (
            <div key={i} className="cr-whoroll-cell">
              <span className="cr-whoroll-ic" aria-hidden="true">{c.ic}</span>
              <span className="cr-whoroll-k">{c.k}</span>
              <span className="cr-whoroll-t">{c.t}</span>
            </div>
          ))}
        </div>

        <div className="cr-formula-box">
          <div className="cr-formula-eyebrow">FORMULA</div>
          <div className="cr-formula">
            <span className="cr-die">d20</span>
            <span className="cr-plus">+</span>
            <span className="cr-formula-piece">Mod Caratteristica</span>
            <span className="cr-plus">+</span>
            <span className="cr-formula-piece">Bonus Strumenti</span>
          </div>
          <p className="cr-formula-note">
            La <strong>Caratteristica</strong> cambia con la professione (es. Fabbro = Forza, Alchimista =
            Intelligenza). Il <strong>Bonus Strumenti</strong> (competenza) si aggiunge solo se il PG è
            competente negli strumenti di quella professione.
          </p>
        </div>

        <h3 className="cr-subtitle">Caratteristica per Professione</h3>
        <div className="cr-prof-chips">
          {PROFESSIONI.map(p => (
            <span key={p.key} className="cr-prof-chip" style={{ borderColor: p.carColor }}>
              <span className="cr-prof-chip-icon">{p.icon}</span>
              <span className="cr-prof-chip-name">{p.name}</span>
              <span className="cr-prof-chip-stat" style={{ background: p.carColor }}>{p.carShort}</span>
            </span>
          ))}
        </div>

        <h3 className="cr-subtitle">Vantaggio e Svantaggio</h3>
        <div className="cr-modifiers-grid">
          {VANTAGGIO_SVANTAGGIO.map((m, i) => (
            <div key={i} className={`cr-modifier ${m.positive ? "cr-modifier--good" : "cr-modifier--bad"}`}>
              <span className="cr-modifier-sign">{m.positive ? "▲" : "▼"}</span>
              <span className="cr-modifier-cond">{m.condizione}</span>
              <span className="cr-modifier-eff">{m.effetto}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── SPECCHIETTO: CRAFTING LIBERO (oggetti fuori tabella) ── */}
      <section id="cr-libero" className="cr-section">
        <div className="cr-libero">
          <span className="cr-libero-badge">✨ Regola d'oro</span>
          <h2 className="cr-libero-title">Vuoi creare qualcosa che non è in tabella?</h2>
          <p className="cr-libero-lead">
            Le tabelle sono solo <strong>esempi</strong>. Se vuoi inventare un oggetto nuovo, riparare o
            potenziare la tua roba, o fare qualsiasi cosa sensata per la tua professione,
            <strong> puoi farlo</strong>. Non serve che sia scritto da qualche parte.
          </p>

          <div className="cr-libero-usi">
            {LIBERO_USI.map((u, i) => (
              <div key={i} className="cr-libero-uso">
                <span aria-hidden="true">{u.ic}</span>
                <p>{u.t}</p>
              </div>
            ))}
          </div>

          <ol className="cr-libero-steps">
            {LIBERO_STEPS.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>

          <p className="cr-libero-foot">
            Regola d'oro: se è coerente con la tua arte, il DM può sempre dire «sì, tira». La qualità la
            decidono i dadi, non l'elenco.
          </p>
        </div>
      </section>

      {/* ── COSTI + INGREDIENTI ─────────────────────────── */}
      <section id="cr-materiali" className="cr-section" data-chapter="III">
        <h2 className="cr-section-title">⏳ Materiali, Tempo, Costi</h2>
        <p className="cr-section-sub">La pregiatura mirata determina costo e tempo. Tirare al di sotto significa ottenere comunque un oggetto inferiore.</p>
        <div className="cr-cost-table">
          {PREGIATURA_COSTS.map(c => {
            const meta = PREGIATURE.find(p => p.key === c.tier);
            return (
              <div key={c.tier} className="cr-cost-row" style={{ borderLeftColor: meta.color }}>
                <div className="cr-cost-tier" style={{ color: meta.color }}>
                  {meta.icon} {meta.label}
                </div>
                <div className="cr-cost-cell"><span className="cr-cost-label">Costo</span> {c.costo}</div>
                <div className="cr-cost-cell"><span className="cr-cost-label">Tempo</span> {c.tempo}</div>
                <div className="cr-cost-note">{c.note}</div>
              </div>
            );
          })}
        </div>

        <h3 className="cr-subtitle">Esempi di Ingredienti</h3>
        <div className="cr-ingredients-table">
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

      {/* ── SENTIERO DEL MAESTRO ───────────────────────── */}
      <section id="cr-sentiero" className="cr-section" data-chapter="IV">
        <h2 className="cr-section-title">🏆 Il Sentiero del Maestro</h2>
        <p className="cr-section-sub">
          L'artigiano cresce creando opere notevoli, non semplicemente accumulando esperienza.
          Ogni oggetto Raro o superiore è un punto sulla scheda.
        </p>
        <div className="cr-sentiero">
          {SENTIERO_MAESTRO.map((s, i) => (
            <div key={s.grado} className="cr-sentiero-step">
              <div className="cr-sentiero-num">
                <span className="cr-sentiero-icon">{s.icon}</span>
                <span className="cr-sentiero-rank">{s.grado}</span>
              </div>
              <div className="cr-sentiero-body">
                <div className="cr-sentiero-name">{s.name}</div>
                <div className="cr-sentiero-soglia">{s.soglia}</div>
                <div className="cr-sentiero-bonus"><strong>Bonus:</strong> {s.bonus}</div>
                <div className="cr-sentiero-cap"><strong>Capacità:</strong> {s.capacita}</div>
              </div>
              {i < SENTIERO_MAESTRO.length - 1 && <div className="cr-sentiero-arrow">▶</div>}
            </div>
          ))}
        </div>

        <h3 className="cr-subtitle">Bonus per Livello del Personaggio</h3>
        <div className="cr-lv-grid">
          {BONUS_LIVELLO_PG.map(b => (
            <div key={b.lv} className="cr-lv-card">
              <div className="cr-lv-badge">Liv. {b.lv}</div>
              <div className="cr-lv-text">{b.bonus}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ETICHETTA DI SEZIONE: Professioni ── */}
      <div className="gl-sezlabel">Vie verso la Maestria · Le 10 Professioni</div>

      {/* ── 10 PROFESSIONI ──────────────────────────────── */}
      <section id="cr-professioni" className="cr-section" data-chapter="V">
        <h2 className="cr-section-title">📚 Le 10 Professioni</h2>
        <p className="cr-section-sub">
          Dieci vie verso la maestria. Una sola scegli alla creazione del personaggio.
        </p>

        <div className="cr-filter-row">
          {CARATTERISTICHE.map(k => (
            <button
              key={k}
              type="button"
              className={`cr-filter-btn ${filter === k ? "cr-filter-btn--active" : ""}`}
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

      {/* ── ETICHETTA DI SEZIONE: Esempi ── */}
      <div className="gl-sezlabel">Dal Tavolo · Esempi di Gioco</div>

      {/* ── ESEMPI DI GIOCO ─────────────────────────────── */}
      <section id="cr-esempi" className="cr-section" data-chapter="VI">
        <h2 className="cr-section-title">🎭 Esempi di Gioco</h2>
        <p className="cr-section-sub">Tre scene dal tavolo per chiarire come tutto si combina.</p>
        <div className="cr-examples">
          {ESEMPI_GIOCO.map((e, i) => (
            <div key={i} className="cr-example">
              <h4 className="cr-example-title">{e.title}</h4>
              <div className="cr-example-char">{e.character}</div>
              <div className="cr-example-row"><strong>Obiettivo:</strong> {e.obiettivo}</div>
              <div className="cr-example-row"><strong>Materiali:</strong> {e.materiali}</div>
              <div className="cr-example-row"><strong>Tempo:</strong> {e.tempo}</div>
              <div className="cr-example-tiro"><strong>Tiro:</strong> {e.tiro}</div>
              <div className="cr-example-result">{e.risultato}</div>
              <div className="cr-example-esito">{e.esito}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="cr-footer">
        <em>Buon crafting, artigiani di Exanthia.</em>
      </footer>
    </section>
  );
}

/* ============================================================
   ProfessionCard — collapsible card with full d12 tables
   ============================================================ */
function ProfessionCard({ prof, isOpen, onToggle }) {
  const [tier, setTier] = useState("comune");
  const items = prof.creazioni[tier] || [];
  const tierMeta = PREGIATURE.find(p => p.key === tier);

  return (
    <div className={`cr-prof-card ${isOpen ? "cr-prof-card--open" : ""}`}>
      <button
        type="button"
        className="cr-prof-head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="cr-prof-num">{String(prof.index).padStart(2, "0")}</div>
        <div className="cr-prof-icon">{prof.icon}</div>
        <div className="cr-prof-info">
          <div className="cr-prof-name">{prof.name}</div>
          <div className="cr-prof-meta">
            <span className="cr-prof-pill" style={{ background: prof.carColor }}>{prof.carShort}</span>
            <span className="cr-prof-car">{prof.caratteristica}</span>
          </div>
        </div>
        <div className="cr-prof-toggle">{isOpen ? "−" : "+"}</div>
      </button>

      {isOpen && (
        <div className="cr-prof-body">
          <blockquote className="cr-prof-quote">{prof.quote}</blockquote>

          <div className="cr-scheda">
            <div className="cr-scheda-eyebrow">SCHEDA DELLA PROFESSIONE</div>
            <div className="cr-scheda-row">
              <span className="cr-scheda-label">Caratteristica</span>
              <span className="cr-scheda-val">{prof.caratteristica}</span>
            </div>
            <div className="cr-scheda-row">
              <span className="cr-scheda-label">Bonus Iniziale (Lv.1)</span>
              <span className="cr-scheda-val">{prof.bonusIniziale}</span>
            </div>
            <div className="cr-scheda-row">
              <span className="cr-scheda-label">Potenziamento (Lv.5)</span>
              <span className="cr-scheda-val">{prof.potenziamento}</span>
            </div>
            <div className="cr-scheda-spec">
              <div className="cr-scheda-label">Specializzazioni (Lv.10 — sceglierne una)</div>
              <ul className="cr-scheda-spec-list">
                {prof.specializzazioni.map(s => (
                  <li key={s.name}>
                    <strong>{s.name}:</strong> {s.desc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h4 className="cr-creazioni-title">🎲 Tabella d12 — Creazioni del {prof.name}</h4>
          <div className="cr-tier-tabs">
            {PREGIATURE.map(p => (
              <button
                key={p.key}
                type="button"
                className={`cr-tier-tab ${tier === p.key ? "cr-tier-tab--active" : ""}`}
                onClick={() => setTier(p.key)}
                style={tier === p.key ? { borderColor: p.color, color: p.color } : null}
              >
                {p.icon} {p.label}
                <span className="cr-tier-range">{p.range}</span>
              </button>
            ))}
          </div>

          <div className="cr-d12-table">
            {items.map(([name, desc], i) => (
              <div
                key={i}
                className="cr-d12-row"
                style={{ borderLeftColor: tierMeta.color }}
              >
                <div className="cr-d12-num">{i + 1}</div>
                <div className="cr-d12-content">
                  <div className="cr-d12-name">{name}</div>
                  <div className="cr-d12-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
