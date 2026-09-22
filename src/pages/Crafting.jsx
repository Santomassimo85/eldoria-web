// ── /crafting: il MANUALE del crafting (corto). Si crea in /officina (Gilda). ──
// I numeri vengono dalle costanti (crafting.js, craftingTime.js, craftingProgress.js,
// craftingWeek.js): non scriverli a mano.
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HERO_QUOTE,
  PREGIATURE,
  SENTIERO_MAESTRO,
  PREGIATURA_COSTS,
  PROFESSIONI,
  POSTAZIONI,
} from "../data/crafting";
import { GRADE_BONUS, XP_LEVELS, XP_PER_TIER } from "../data/craftingProgress";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK } from "../data/craftingWeek";
import { COMPONENTS, COMPONENT_ROLL_DIE, CRAFT_BASE_MINUTES, INVESTMENTS, MAX_COMPONENTS, OUTCOME_TIME, PACE_OPTIONS, TOOLS_MINUTES, componentEffectLabel, fmtMinutes } from "../data/craftingTime";
import GlacierHero from "../components/glacier/GlacierHero";
import "./Crafting.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/helmvil_nani.png";

const CARATTERISTICHE = ["all", "FOR", "DES", "INT", "SAG", "MAG"];
const CARATTERISTICA_LABEL = { all: "Tutte", FOR: "Forza", DES: "Destrezza", INT: "Intelligenza", SAG: "Saggezza", MAG: "Magica" };
const PICK_TIERS = PREGIATURE.filter((p) => p.pick);
const RANDOM_TIERS = PREGIATURE.filter((p) => !p.pick && p.key !== "scarso");

// ── Come funziona: quattro mosse, in ordine ─────────────────────────────────
const PASSI = [
  { ic: "🧑‍🏭", k: "Scegli la professione", t: "Una sola per personaggio, per sempre. Decide con quale caratteristica tiri e cosa sai fare." },
  { ic: "🎯", k: "Scegli rarità e oggetto", t: `${PICK_TIERS.map((p) => p.label).join(", ")}: scegli tu uno dei 6 oggetti della tua professione. ${RANDOM_TIERS.map((p) => p.label).join(" e ")}: l'oggetto lo decide il d12.` },
  { ic: "🧰", k: "Prepara il banco", t: "Strumenti, componenti trovati in sessione, quanto spendi nei materiali e il ritmo: accorciano il lavoro, alzano il tiro o migliorano l'oggetto." },
  { ic: "🎲", k: "Tira e aspetta", t: "d20 + bonus decide la rarità (mai sopra quella scelta); un 1 naturale rovina tutto. Poi parte il tempo di lavoro: finito, ritiri l'oggetto e va su Foundry." },
];

// ── Sommario ────────────────────────────────────────────────────────────────
const SOMMARIO = [
  { href: "#cr-come",        num: "1", t: "Come funziona" },
  { href: "#cr-rarita",      num: "2", t: "Le rarità" },
  { href: "#cr-tiro",        num: "3", t: "Il tiro" },
  { href: "#cr-tempo",       num: "4", t: "Il tempo di lavoro" },
  { href: "#cr-sentiero",    num: "5", t: "Livelli e gradi" },
  { href: "#cr-professioni", num: "6", t: "Le 10 Professioni" },
  { href: "#cr-libero",      num: "★", t: "Crafting libero" },
];

// Apre la piega del manuale a cui punta un link (#cr-…) prima che il browser scorra.
function openFold(href) {
  const el = document.querySelector(href);
  if (el && el.tagName === "DETAILS") el.open = true;
}

export default function Crafting() {
  useParallaxScroll();
  const [filter, setFilter] = useState("all");
  const [openProf, setOpenProf] = useState(null);

  // Arrivo con un'ancora (es. dall'Officina): apro la piega giusta.
  useEffect(() => {
    if (window.location.hash && window.location.hash !== "#cr-index") {
      openFold(window.location.hash);
      setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" }), 80);
    }
  }, []);

  const visibleProfessioni = useMemo(
    () => filter === "all" ? PROFESSIONI : PROFESSIONI.filter(p => p.carShort === filter),
    [filter]
  );

  return (
    <section className="cine-page cr-page" style={{ "--cine-accent": "var(--el)", "--cine-accent-2": "var(--el-soft)" }}>
      <GlacierHero
        id="cr-top"
        ariaLabel="Manuale del Crafting di Exanthia"
        image={HERO_IMAGE}
        eyebrow="Manuale dell'Artigiano"
        title={<>Crafting<br />di Exanthia</>}
        seal={`📖 Le regole · si crea nell'Officina della Gilda`}
        tagline={HERO_QUOTE}
        actions={<><Link to="/officina" className="gl-cta" aria-label="Vai all'Officina">⚒ Vai all'Officina</Link><a href="#cr-index" className="gl-cta gl-cta--ghost" aria-label="Scorri al manuale">✦ Leggi le regole</a></>}
      />

      {/* ── SOMMARIO a pillole ── */}
      <nav id="cr-index" className="nx-pillole cr-sommario" aria-label="Sommario del manuale">
        {SOMMARIO.map(s => (
          <a key={s.href} href={s.href} className="nx-pillola" onClick={() => openFold(s.href)}>
            <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
          </a>
        ))}
        <Link to="/officina" className="nx-pillola on"><span className="cr-pill-num" aria-hidden="true">⚒</span>L'Officina</Link>
      </nav>

      <div className="nx-due cr-corpo">
        {/* ── RUBRICA fissa ── */}
        <aside className="nx-pannello nx-pannello--sticky cr-rubrica" aria-label="Indice del manuale">
          <span className="nx-kicker">Manuale dell'Artigiano</span>
          <h2 className="nx-titolo cr-rubrica-titolo">Sommario</h2>
          <div className="cr-rubrica-lista">
            {SOMMARIO.map(s => (
              <a key={s.href} href={s.href} className="nx-pillola cr-rubrica-voce" onClick={() => openFold(s.href)}>
                <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
              </a>
            ))}
            <Link to="/officina" className="nx-pillola on cr-rubrica-voce"><span className="cr-pill-num" aria-hidden="true">⚒</span>Vai all'Officina</Link>
          </div>
          <p className="nx-nota">Un tiro, un tempo di lavoro, un oggetto. Qui le regole; si crea nell'Officina della Gilda.</p>
        </aside>

        {/* ── FLUSSO dei capitoli ── */}
        <div className="cr-flusso">

          {/* ── 1 · COME FUNZIONA (aperto) ── */}
          <details id="cr-come" className="cr-section cr-fold" data-chapter="1" open>
            <summary className="gl-sezlabel">1 · Come funziona</summary>
            <ol className="nx-griglia cr-steps">
              {PASSI.map((r, i) => (
                <li key={i} className="nx-pannello cr-passo cr-step">
                  <span className="orb cr-step-n" aria-hidden="true">{i + 1}</span>
                  <span className="cr-passo-ic" aria-hidden="true">{r.ic}</span>
                  <span className="nx-nome">{r.k}</span>
                  <span className="nx-nota">{r.t}</span>
                </li>
              ))}
            </ol>
            <div className="cr-limiti">
              <span className="cr-limite"><b>{CRAFT_MAX_PER_DAY}</b> prova al giorno</span>
              <span className="cr-limite"><b>{CRAFT_MAX_PER_WEEK}</b> a settimana</span>
              <span className="cr-limite"><b>dom 22:00</b> si azzerano</span>
              <span className="cr-limite"><b>1</b> lavoro alla volta sul banco</span>
            </div>
            <p className="nx-nota cr-section-sub cr-come-nota">
              Si crea dall'<Link to="/officina">Officina</Link>, in sessione o fuori. L'uso si consuma al tiro e il tempo va con l'ora del server.
            </p>
            <p className="nx-nota cr-section-sub cr-come-nota">
              🏠 <strong>Al tavolo le regole sono le stesse</strong>, ma serve la <strong>postazione</strong> della tua arte: una fucina, un alambicco, un telaio, un banco da orafo. Si trovano nel mondo — città, avamposti, botteghe amiche, qualche rovina — e il Master ti dice quando ne hai una a portata. Dall'app, invece, lavori sempre.
            </p>
          </details>

          {/* ── 2 · LE RARITÀ ── */}
          <details id="cr-rarita" className="cr-section cr-fold" data-chapter="2">
            <summary className="gl-sezlabel">2 · Le rarità</summary>
            <p className="nx-nota cr-section-sub">
              Sono quelle di D&D. Scegli a quale punti: i materiali hanno un prezzo fisso e si pagano in gioco. Il totale del d20 dice cosa esce, <strong>mai sopra la rarità scelta</strong>.
              Per {PICK_TIERS.map((p) => p.label).join(", ")} scegli tu l'oggetto fra i 6 della professione: con un tiro più basso esce <strong>lo stesso oggetto della rarità sotto</strong> (sotto 6 uno Scarso a caso).
              {" "}{RANDOM_TIERS.map((p) => p.label).join(" e ")} escono a caso col d12.
            </p>
            <div className="cr-tier-table">
              <div className="cr-tier-head"><span>Rarità</span><span>Tiro</span><span>Oggetto</span><span>Tempo</span><span>Materiali · PE</span></div>
              {PREGIATURE.map(p => {
                const c = PREGIATURA_COSTS.find(x => x.tier === p.key) || {};
                return (
                  <div key={p.key} className="nx-pannello cr-tier-row" style={{ "--q": p.color }}>
                    <span className="cr-tier-name"><i aria-hidden="true">{p.icon}</i> {p.label}<small>{p.desc}</small></span>
                    <span className="cr-tier-cell" data-label="Tiro">{p.range}</span>
                    <span className="cr-tier-cell" data-label="Oggetto">{p.key === "scarso" ? "d12 (solo esito)" : p.pick ? "lo scegli tu" : "d12"}</span>
                    <span className="cr-tier-cell" data-label="Tempo">{CRAFT_BASE_MINUTES[p.key] ? fmtMinutes(CRAFT_BASE_MINUTES[p.key]) : "—"}</span>
                    <span className="cr-tier-cell cr-tier-cost" data-label="Materiali · PE">{c.costo} · +{XP_PER_TIER[p.key]} PE<small>{c.note}</small></span>
                  </div>
                );
              })}
            </div>
            <h4 className="cr-subtitle">💰 Spendere di più nei materiali</h4>
            <p className="nx-nota cr-section-sub">Prima di tirare decidi quanto investi sopra il costo della rarità. Non cambia il tempo di lavoro: cambia il tiro, l'oggetto e i PE.</p>
            <div className="nx-griglia cr-time-grid">
              {INVESTMENTS.map(iv => (
                <div key={iv.key || "base"} className="nx-pannello cr-time-card">
                  <span className="cr-passo-ic" aria-hidden="true">{iv.icon}</span>
                  <span className="nx-nome">{iv.label}</span>
                  <b className="cr-time-fx">{iv.costPct ? `+${iv.costPct}% di spesa` : "costo pieno"}</b>
                  <span className="nx-nota">{iv.desc}</span>
                </div>
              ))}
            </div>
            <p className="nx-nota cr-section-sub cr-come-nota">Molto raro solo dal grado <strong>Maestro</strong>, Leggendario solo da <strong>Leggenda</strong>. Dal grado Artigiano gli Scarsi contano come Comuni. Un 20 naturale raddoppia i PE.</p>
          </details>

          {/* ── 3 · IL TIRO ── */}
          <details id="cr-tiro" className="cr-section cr-fold" data-chapter="3">
            <summary className="gl-sezlabel">3 · Il tiro</summary>
            <div className="nx-pannello cr-formula-box">
              <span className="nx-kicker">Formula</span>
              <div className="cr-formula">
                <span className="cr-die">d20</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Caratteristica</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Strumenti</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Grado</span>
                <span className="cr-plus">+</span>
                <span className="cr-formula-piece">Condizioni</span>
              </div>
              <p className="nx-nota cr-fumble">💥 <strong>1 naturale = fallimento critico.</strong> Non conta nessun bonus: il pezzo si rovina sul banco, dopo <strong>2 minuti</strong> scopri il disastro, i materiali e le monete spese sono persi, non esce nulla e prendi 0 PE. La prova del giorno è comunque consumata.</p>
              <ul className="cr-formula-list">
                <li><strong>Caratteristica</strong>: quella della professione (le professioni magiche usano la migliore fra Int, Sag e Car).</li>
                <li><strong>Strumenti</strong>: il bonus di competenza, solo se gli strumenti della professione risultano sulla tua scheda. Senza, svantaggio.</li>
                <li><strong>Grado</strong>: {SENTIERO_MAESTRO.filter((g) => GRADE_BONUS[g.grado]).map((g) => `${g.name} +${GRADE_BONUS[g.grado]}`).join(" · ")}.</li>
                <li><strong>Condizioni</strong>: materiali scelti (+{INVESTMENTS[1].costPct}% di spesa) +{INVESTMENTS[1].roll} · con calma +{PACE_OPTIONS[0].roll} · di fretta {PACE_OPTIONS[2].roll} e {PACE_OPTIONS[2].critFail}% di fallimento critico (materiali persi) · ogni componente +1d{COMPONENT_ROLL_DIE}.</li>
              </ul>
            </div>
            <div className="nx-pillole cr-prof-chips">
              {PROFESSIONI.map(p => (
                <span key={p.key} className="nx-pillola cr-prof-chip" style={{ "--c": p.carColor }}>
                  <span className="cr-prof-chip-icon" aria-hidden="true">{p.icon}</span>
                  <span className="cr-prof-chip-name">{p.name}</span>
                  <span className="cr-prof-chip-stat">{p.carShort}</span>
                </span>
              ))}
            </div>
          </details>

          {/* ── 4 · IL TEMPO DI LAVORO ── */}
          <details id="cr-tempo" className="cr-section cr-fold" data-chapter="4">
            <summary className="gl-sezlabel">4 · Il tempo di lavoro</summary>
            <p className="nx-nota cr-section-sub">
              Ogni lavoro ha un tempo <strong>in tempo reale</strong>. Al banco prepari il tempo di un lavoro <strong>centrato</strong>: quello è il numero che vedi prima di tirare. Poi è l'<strong>esito del dado</strong> a dire quanto dura davvero. Finché non è passato vedi solo la barra; poi ritiri l'oggetto.
            </p>
            <h4 className="cr-subtitle">Il tempo base della rarità</h4>
            <div className="cr-time-base">
              {PREGIATURE.filter(p => CRAFT_BASE_MINUTES[p.key]).map(p => (
                <span key={p.key} className="cr-time-chip" style={{ "--q": p.color }}><i aria-hidden="true">{p.icon}</i> {p.label} <b>{fmtMinutes(CRAFT_BASE_MINUTES[p.key])}</b></span>
              ))}
            </div>
            <h4 className="cr-subtitle">Quanto lo sposta l'esito del tiro</h4>
            <div className="cr-time-base">
              {OUTCOME_TIME.map(o => (
                <span key={o.key} className="cr-time-chip" style={{ "--q": o.mult < 1 ? "#4ade80" : o.mult > 1.3 ? "#f87171" : o.mult > 1 ? "#fbbf24" : "#8a7a4a" }}>
                  <i aria-hidden="true">{o.mult < 1 ? "⚡" : o.mult > 1 ? "🔁" : "⚒"}</i> {o.label} <b>×{String(o.mult).replace(".", ",")}</b>
                </span>
              ))}
              <span className="cr-time-chip" style={{ "--q": "#b91c1c" }}><i aria-hidden="true">💥</i> 1 naturale <b>2 min</b></span>
            </div>
            <p className="nx-nota cr-section-sub">
              Nell'Officina la tabella <strong>"Cosa può uscire"</strong> ti mostra, prima di tirare, ogni fascia del d20 con l'oggetto che ne esce, il tempo di quella fascia e i PE.
            </p>
            <h4 className="cr-subtitle">Quanto lo accorcia il banco</h4>
            <div className="nx-griglia cr-time-grid">
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">🧰</span>
                <span className="nx-nome">Strumenti</span>
                <b className="cr-time-fx">−{fmtMinutes(TOOLS_MINUTES)}</b>
                <span className="nx-nota">Si accendono da soli se risultano sulla scheda Foundry (sincronizzata) o comprati al Mercato.</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">🧪</span>
                <span className="nx-nome">Componenti (max {MAX_COMPONENTS})</span>
                <b className="cr-time-fx">−30 / −45 / −60 min</b>
                <span className="nx-nota">Si trovano in sessione e si consumano. Ognuno dà anche +1d{COMPONENT_ROLL_DIE} al tiro; alcuni lasciano un effetto sull'oggetto.</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">⏳</span>
                <span className="nx-nome">Ritmo</span>
                <b className="cr-time-fx">×2 · ×1 · ×½</b>
                <span className="nx-nota">{PACE_OPTIONS.map(p => `${p.label}: ${p.desc.toLowerCase()}`).join(" · ")}</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">📈</span>
                <span className="nx-nome">Ritmo di bottega</span>
                <b className="cr-time-fx">−¼</b>
                <span className="nx-nota">Dal livello 6 di professione, sempre.</span>
              </div>
            </div>
            <details className="cr-subfold">
              <summary className="cr-subtitle">I {COMPONENTS.length} componenti</summary>
              <div className="cr-comp-grid">
                {COMPONENTS.map(c => (
                  <div key={c.key} className="nx-pannello cr-comp-card">
                    <span className="cr-comp-ic" aria-hidden="true">{c.icon}</span>
                    <span className="cr-comp-body">
                      <span className="nx-nome cr-comp-name">{c.name} <b>−{c.minutes} min</b></span>
                      <span className="nx-nota">{c.desc}{c.effect ? <> <strong>{componentEffectLabel(c)}.</strong></> : null}</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </details>

          {/* ── 5 · LIVELLI E GRADI ── */}
          <details id="cr-sentiero" className="cr-section cr-fold" data-chapter="5">
            <summary className="gl-sezlabel">5 · Livelli e gradi</summary>
            <p className="nx-nota cr-section-sub">
              Ogni lavoro dà PE alla professione ({PREGIATURE.map(p => `${p.label} ${XP_PER_TIER[p.key]}`).join(" · ")}; 20 naturale = doppi).
              Ogni due livelli si sale di grado, e il grado dà il bonus al tiro.
            </p>
            <div className="cr-gradi">
              {SENTIERO_MAESTRO.map(g => (
                <div key={g.grado} className="nx-pannello cr-grado">
                  <span className="cr-grado-ic" aria-hidden="true">{g.icon}</span>
                  <span className="nx-nome">{g.name}</span>
                  <span className="cr-grado-b">{GRADE_BONUS[g.grado] ? `+${GRADE_BONUS[g.grado]} al tiro` : "nessun bonus"}</span>
                  <span className="nx-nota">dal livello {XP_LEVELS.find(l => l.grado === g.grado)?.lv}</span>
                </div>
              ))}
            </div>
            <ol className="cr-levels">
              {XP_LEVELS.map(l => {
                const g = SENTIERO_MAESTRO.find(x => x.grado === l.grado);
                return (
                  <li key={l.lv} className="cr-level">
                    <span className="orb" aria-hidden="true">{l.lv}</span>
                    <span className="cr-level-body">
                      <span className="cr-level-head"><b>{l.xp} PE</b> · {g?.icon} {g?.name}</span>
                      <span className="nx-nota">{l.sblocca}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </details>

          {/* ── 6 · PROFESSIONI ── */}
          <details id="cr-professioni" className="cr-section cr-fold" data-chapter="6">
            <summary className="gl-sezlabel">6 · Le 10 Professioni</summary>
            <p className="nx-nota cr-section-sub">
              Una sola per personaggio. Ogni scheda ha il <strong>catalogo</strong> dei 6 oggetti a scelta (nelle tre rarità) e le tabelle d12 di ciò che esce a caso.
            </p>
            <div className="nx-pillole cr-filter-row">
              {CARATTERISTICHE.map(k => (
                <button key={k} type="button" className={`nx-pillola cr-filter-btn ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
                  {CARATTERISTICA_LABEL[k]}
                </button>
              ))}
            </div>
            <div className="cr-prof-grid">
              {visibleProfessioni.map(p => (
                <ProfessionCard key={p.key} prof={p} isOpen={openProf === p.key} onToggle={() => setOpenProf(openProf === p.key ? null : p.key)} />
              ))}
            </div>
          </details>

          {/* ── ★ · CRAFTING LIBERO ── */}
          <details id="cr-libero" className="cr-section cr-fold">
            <summary className="gl-sezlabel">★ · Crafting libero</summary>
            <div className="nx-pannello cr-libero">
              <span className="nx-pillola on cr-libero-badge">✨ Regola d'oro</span>
              <h2 className="nx-titolo cr-libero-title">Vuoi qualcosa che non è in catalogo?</h2>
              <p className="nx-prosa cr-libero-lead">
                Inventare un oggetto nuovo, riparare o migliorare la tua roba, fare qualsiasi cosa sensata per la tua arte: <strong>si può</strong>.
                Lo dici al Master, lui fissa rarità, materiali e tempo, e tiri come sempre.
              </p>
            </div>
          </details>

          <footer className="cr-footer">
            <em>Buon crafting, artigiani di Exanthia.</em>
          </footer>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   ProfessionCard — scheda + catalogo dei 6 + tabelle d12
   ============================================================ */
function ProfessionCard({ prof, isOpen, onToggle }) {
  const [tier, setTier] = useState("veryRare");
  const items = prof.creazioni[tier] || [];
  const tierMeta = PREGIATURE.find(p => p.key === tier);

  return (
    <div className={`nx-pannello cr-prof-card ${isOpen ? "cr-prof-card--open" : ""}`} style={{ "--c": prof.carColor }}>
      <button type="button" className="cr-prof-head" onClick={onToggle} aria-expanded={isOpen}>
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
            <p><strong>Postazione in gioco:</strong> {POSTAZIONI[prof.key] || "la postazione della tua arte"}</p>
            <p><strong>Bonus iniziale (Lv.1):</strong> {prof.bonusIniziale}</p>
            <p><strong>Potenziamento (Lv.5):</strong> {prof.potenziamento}</p>
            <div className="cr-scheda-spec">
              <p><strong>Specializzazioni (Lv.10, una a scelta)</strong></p>
              <ul className="cr-scheda-spec-list">
                {prof.specializzazioni.map(s => (
                  <li key={s.name}><strong>{s.name}:</strong> {s.desc}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* catalogo: 6 linee × 3 rarità */}
          <h4 className="cr-subtitle cr-creazioni-title">⚒ Catalogo — i 6 oggetti a scelta</h4>
          <div className="cr-cat">
            <div className="cr-cat-head"><span /> {PICK_TIERS.map(t => <span key={t.key} style={{ "--q": t.color }}>{t.icon} {t.label}</span>)}</div>
            {(prof.catalogo || []).map(line => (
              <div key={line.key} className="cr-cat-row">
                <span className="cr-cat-ic" aria-hidden="true">{line.icon}</span>
                {PICK_TIERS.map(t => {
                  const [nm, ds] = line[t.key] || ["—", ""];
                  return <span key={t.key} className="cr-cat-cell" style={{ "--q": t.color }} data-label={t.label}><b>{nm}</b><small>{ds}</small></span>;
                })}
              </div>
            ))}
          </div>

          {/* tabelle d12 */}
          <h4 className="cr-subtitle cr-creazioni-title">🎲 Tabelle d12 — ciò che esce a caso</h4>
          <p className="nx-nota cr-section-sub">Molto raro e Leggendario escono sempre da qui; le altre tabelle valgono per gli Scarsi e per chi punta in alto e tira basso.</p>
          <div className="nx-pillole cr-tier-tabs">
            {[...RANDOM_TIERS, ...PREGIATURE.filter(p => p.key === "scarso" || p.pick)].map(p => (
              <button key={p.key} type="button" className={`nx-pillola cr-tier-tab ${tier === p.key ? "on" : ""}`} onClick={() => setTier(p.key)} style={{ "--q": p.color }}>
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
