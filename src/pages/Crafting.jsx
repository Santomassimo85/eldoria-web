import React, { useEffect, useMemo, useState } from "react";
import {
  HERO_QUOTE,
  PREGIATURE,
  SENTIERO_MAESTRO,
  PREGIATURA_COSTS,
  VANTAGGIO_SVANTAGGIO,
  PROFESSIONI,
} from "../data/crafting";
import { GRADE_BONUS, XP_LEVELS, XP_PER_TIER } from "../data/craftingProgress";
import { CRAFT_MAX_PER_DAY, CRAFT_MAX_PER_WEEK } from "../data/craftingWeek";
import { COMPONENTS, COMPONENT_ROLL_DIE, CRAFT_BASE_MINUTES, CRAFT_MIN_MINUTES, HELP_OPTIONS, MAX_COMPONENTS, PACE_OPTIONS, TOOLS_MINUTES, componentEffectLabel, craftMinutes, fmtMinutes } from "../data/craftingTime";
import GlacierHero from "../components/glacier/GlacierHero";
import CraftingOfficina from "./CraftingOfficina";
import "./Crafting.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/helmvil_nani.png";

const CARATTERISTICHE = ["all", "FOR", "DES", "INT", "SAG", "MAG"];
const CARATTERISTICA_LABEL = { all: "Tutte", FOR: "Forza", DES: "Destrezza", INT: "Intelligenza", SAG: "Saggezza", MAG: "Magica" };

// ── Come funziona: quattro mosse, in ordine ─────────────────────────────────
const PASSI = [
  { ic: "🧑‍🏭", k: "Scegli la professione", t: "Una sola per personaggio, per sempre. Decide con quale caratteristica tiri e cosa puoi creare." },
  { ic: "🎯", k: "Punta a una pregiatura", t: "Comune, Raro, Magico o Perfetto. Fissa il tempo di lavoro e i materiali da pagare in gioco." },
  { ic: "🧰", k: "Prepara il banco", t: "Strumenti, componenti trovati in sessione, un aiutante, i materiali e il ritmo: ognuno accorcia il lavoro o cambia il tiro." },
  { ic: "🎲", k: "Tira e aspetta", t: "d20 + bonus decide la qualità (mai sopra la mirata), d12 l'oggetto. Poi parte il tempo: finito, ritiri l'oggetto e va su Foundry." },
];

// ── Sommario ────────────────────────────────────────────────────────────────
const SOMMARIO = [
  { href: "#cr-officina",    num: "⚒", t: "L'Officina" },
  { href: "#cr-come",        num: "1", t: "Come funziona" },
  { href: "#cr-pregiature",  num: "2", t: "Le Pregiature" },
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

  // Arrivo con un'ancora (es. dall'Almanacco): apro la piega giusta.
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
        ariaLabel="Crafting di Exanthia"
        image={HERO_IMAGE}
        eyebrow="Manuale dell'Artigiano"
        title={<>Crafting<br />di Exanthia</>}
        seal={`⚒ Officina aperta · ${CRAFT_MAX_PER_DAY} prova al giorno · ${CRAFT_MAX_PER_WEEK} a settimana`}
        tagline={HERO_QUOTE}
        actions={<><a href="#cr-officina" className="gl-cta" aria-label="Vai all'Officina">⚒ Crea un oggetto</a><a href="#cr-index" className="gl-cta gl-cta--ghost" aria-label="Scorri al manuale">✦ Il manuale</a></>}
      />

      {/* ── SOMMARIO a pillole ── */}
      <nav id="cr-index" className="nx-pillole cr-sommario" aria-label="Sommario del manuale">
        {SOMMARIO.map(s => (
          <a key={s.href} href={s.href} className="nx-pillola" onClick={() => openFold(s.href)}>
            <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
          </a>
        ))}
      </nav>

      <div className="nx-due cr-corpo">
        {/* ── RUBRICA fissa ── */}
        <aside className="nx-pannello nx-pannello--sticky cr-rubrica" aria-label="Indice del manuale">
          <span className="nx-kicker">Tomo dell'Artigiano</span>
          <h2 className="nx-titolo cr-rubrica-titolo">Sommario</h2>
          <div className="cr-rubrica-lista">
            {SOMMARIO.map(s => (
              <a key={s.href} href={s.href} className="nx-pillola cr-rubrica-voce" onClick={() => openFold(s.href)}>
                <span className="cr-pill-num" aria-hidden="true">{s.num}</span>{s.t}
              </a>
            ))}
          </div>
          <p className="nx-nota">Un tiro, un tempo di lavoro, un oggetto. Il resto sono dettagli: i capitoli si aprono al tocco.</p>
        </aside>

        {/* ── FLUSSO dei capitoli ── */}
        <div className="cr-flusso">

          {/* ── ⚒ L'OFFICINA ── */}
          <section id="cr-officina" className="cr-section cr-officina-sec" data-chapter="⚒">
            <div className="gl-sezlabel">L'Officina · crea i tuoi oggetti</div>
            <p className="nx-nota cr-section-sub">
              Scegli a cosa punti, prepara il banco, tira. Il lavoro dura un tempo fisso, poi ritiri l'oggetto
              e il Master lo importa nel tuo inventario su Foundry. {CRAFT_MAX_PER_DAY} prova al giorno, {CRAFT_MAX_PER_WEEK} a settimana (si azzerano la domenica alle 22).
            </p>
            <CraftingOfficina />
          </section>

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
              Chi tira è il giocatore con la professione. In sessione o fuori, sempre dalla stessa pagina: l'uso si consuma al tiro,
              quindi ricaricare o rifare il login non lo restituisce. Il tempo va con l'ora del server, non con quella del telefono.
            </p>
          </details>

          {/* ── 2 · LE PREGIATURE ── */}
          <details id="cr-pregiature" className="cr-section cr-fold" data-chapter="2">
            <summary className="gl-sezlabel">2 · Le Pregiature</summary>
            <p className="nx-nota cr-section-sub">Il totale del d20 dice quanto è pregiato ciò che esce. Non si supera mai la pregiatura a cui hai puntato: un tiro alto la conferma, uno basso dà un oggetto inferiore. I materiali hanno un prezzo fisso, si pagano in gioco prima di iniziare.</p>
            <div className="cr-tier-table">
              <div className="cr-tier-head"><span>Pregiatura</span><span>Tiro</span><span>Tempo</span><span>PE</span><span>Costo materiali</span></div>
              {PREGIATURE.map(p => {
                const c = PREGIATURA_COSTS.find(x => x.tier === p.key) || {};
                return (
                  <div key={p.key} className="nx-pannello cr-tier-row" style={{ "--q": p.color }}>
                    <span className="cr-tier-name"><i aria-hidden="true">{p.icon}</i> {p.label}<small>{p.desc}</small></span>
                    <span className="cr-tier-cell" data-label="Tiro">{p.range}</span>
                    <span className="cr-tier-cell" data-label="Tempo">{CRAFT_BASE_MINUTES[p.key] ? fmtMinutes(CRAFT_BASE_MINUTES[p.key]) : "—"}</span>
                    <span className="cr-tier-cell" data-label="PE">+{XP_PER_TIER[p.key]}</span>
                    <span className="cr-tier-cell cr-tier-cost" data-label="Materiali">{c.costo}<small>{c.note}</small></span>
                  </div>
                );
              })}
            </div>
            <p className="nx-nota cr-section-sub cr-come-nota">Perfetto si può puntare solo dal grado <strong>Maestro</strong> (livello 7). Dal grado <strong>Artigiano</strong> (livello 5) gli Scarsi contano come Comuni. Un 20 naturale raddoppia i PE.</p>
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
              <ul className="cr-formula-list">
                <li><strong>Caratteristica</strong>: quella della professione (Fabbro = Forza, Alchimista = Intelligenza…; le professioni magiche usano la migliore fra Int, Sag e Car).</li>
                <li><strong>Strumenti</strong>: il bonus di competenza, solo se hai con te gli strumenti della professione. Senza, tiri con svantaggio.</li>
                <li><strong>Grado</strong>: Discepolo +1 · Artigiano +1 · Maestro +2 · Leggenda +3 (vedi Livelli e gradi).</li>
                <li><strong>Condizioni</strong>: aiuto (+1), componenti (+1d{COMPONENT_ROLL_DIE} ciascuno), materiali e ritmo scelti sul banco. L'Officina le scrive nella coda del Master.</li>
                <li><strong>Di fretta</strong>: metà tempo ma −3 al tiro e 5% di fallimento critico: la prova è consumata, i materiali sono persi e non esce nulla.</li>
              </ul>
            </div>

            <h3 className="cr-subtitle">Caratteristica per professione</h3>
            <div className="nx-pillole cr-prof-chips">
              {PROFESSIONI.map(p => (
                <span key={p.key} className="nx-pillola cr-prof-chip" style={{ "--c": p.carColor }}>
                  <span className="cr-prof-chip-icon" aria-hidden="true">{p.icon}</span>
                  <span className="cr-prof-chip-name">{p.name}</span>
                  <span className="cr-prof-chip-stat">{p.carShort}</span>
                </span>
              ))}
            </div>

            <h3 className="cr-subtitle">Condizioni: vantaggio e svantaggio</h3>
            <div className="nx-griglia nx-griglia--larga cr-modifiers-grid">
              {VANTAGGIO_SVANTAGGIO.map((m, i) => (
                <div key={i} className={`nx-pannello cr-modifier ${m.positive ? "cr-modifier--good" : "cr-modifier--bad"}`}>
                  <span className="cr-modifier-sign" aria-hidden="true">{m.positive ? "▲" : "▼"}</span>
                  <span className="nx-nome cr-modifier-cond">{m.condizione}</span>
                  <span className="nx-nota cr-modifier-eff">{m.effetto}</span>
                </div>
              ))}
            </div>
          </details>

          {/* ── 4 · IL TEMPO DI LAVORO ── */}
          <details id="cr-tempo" className="cr-section cr-fold" data-chapter="4">
            <summary className="gl-sezlabel">4 · Il tempo di lavoro</summary>
            <p className="nx-nota cr-section-sub">
              Ogni lavoro ha un tempo <strong>fisso, in tempo reale</strong>, che vedi prima di tirare: il risultato del dado non lo cambia.
              Parte dalla pregiatura a cui punti e si accorcia con quello che porti al banco. Finché non è passato, l'oggetto resta
              sul banco e vedi solo la barra; poi lo ritiri. Minimo {fmtMinutes(CRAFT_MIN_MINUTES)}.
            </p>
            <div className="cr-time-base">
              {PREGIATURE.filter(p => CRAFT_BASE_MINUTES[p.key]).map(p => (
                <span key={p.key} className="cr-time-chip" style={{ "--q": p.color }}><i aria-hidden="true">{p.icon}</i> {p.label} <b>{fmtMinutes(CRAFT_BASE_MINUTES[p.key])}</b></span>
              ))}
            </div>

            <h3 className="cr-subtitle">Cosa accorcia il lavoro</h3>
            <div className="nx-griglia cr-time-grid">
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">🧰</span>
                <span className="nx-nome">Strumenti della professione</span>
                <b className="cr-time-fx">−{fmtMinutes(TOOLS_MINUTES)}</b>
                <span className="nx-nota">Con gli strumenti hai anche il bonus di competenza; senza, tempo pieno e svantaggio.</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">🧪</span>
                <span className="nx-nome">Componenti trovati in sessione</span>
                <b className="cr-time-fx">−30 / −45 / −60 min · +1–{COMPONENT_ROLL_DIE} al tiro</b>
                <span className="nx-nota">Fino a {MAX_COMPONENTS} per lavoro, si consumano; ognuno dà anche +1d{COMPONENT_ROLL_DIE} al tiro. Alcuni lasciano un effetto sull'oggetto. La lista è qui sotto.</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">🤝</span>
                <span className="nx-nome">Un aiutante al banco</span>
                <b className="cr-time-fx">{HELP_OPTIONS.filter(h => h.key).map(h => `−${h.pct}%`).join(" / ")}</b>
                <span className="nx-nota">{HELP_OPTIONS.filter(h => h.key).map(h => `${h.label}: −${h.pct}% del tempo`).join(" · ")}. In più +1 al tiro. Da concordare col Master.</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">⏳</span>
                <span className="nx-nome">Il ritmo</span>
                <b className="cr-time-fx">×2 · ×1 · ×½</b>
                <span className="nx-nota">{PACE_OPTIONS.map(p => `${p.label}: ${p.desc.toLowerCase()}`).join(" · ")}</span>
              </div>
              <div className="nx-pannello cr-time-card">
                <span className="cr-passo-ic" aria-hidden="true">📈</span>
                <span className="nx-nome">Ritmo di bottega</span>
                <b className="cr-time-fx">−¼</b>
                <span className="nx-nota">Dal livello 6 di professione ogni lavoro dura un quarto in meno, sempre.</span>
              </div>
            </div>

            <h3 className="cr-subtitle">I 10 componenti</h3>
            <p className="nx-nota cr-section-sub">Oggetti da trovare in sessione: accorciano il lavoro e danno +1d{COMPONENT_ROLL_DIE} al tiro ciascuno; quattro lasciano anche un effetto sull'oggetto, che decide il DM. Il Master li assegna dal suo pannello nell'Officina.</p>
            <div className="cr-comp-grid">
              {COMPONENTS.map(c => (
                <div key={c.key} className="nx-pannello cr-comp-card">
                  <span className="cr-comp-ic" aria-hidden="true">{c.icon}</span>
                  <span className="cr-comp-body">
                    <span className="nx-nome cr-comp-name">{c.name} <b>−{c.minutes} min · +1d{COMPONENT_ROLL_DIE}</b></span>
                    <span className="nx-nota">{c.desc}{c.effect ? <> <strong>{componentEffectLabel(c)}.</strong></> : null}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="nx-nota cr-section-sub cr-come-nota">
              Esempio: Comune parte da {fmtMinutes(CRAFT_BASE_MINUTES.comune)}; con gli strumenti {fmtMinutes(craftMinutes({ tier: "comune" }).minutes)}; con un Carbone Runico e un mastro
              competente {fmtMinutes(craftMinutes({ tier: "comune", components: ["carbone"], help: "mastro" }).minutes)}; di fretta {fmtMinutes(craftMinutes({ tier: "comune", components: ["carbone"], help: "mastro", pace: "fretta" }).minutes)}, ma con −3 al tiro e il rischio del fallimento critico.
            </p>
          </details>

          {/* ── 5 · LIVELLI E GRADI ── */}
          <details id="cr-sentiero" className="cr-section cr-fold" data-chapter="5">
            <summary className="gl-sezlabel">5 · Livelli e gradi</summary>
            <p className="nx-nota cr-section-sub">
              Ogni lavoro dà punti esperienza (PE) alla professione, in base alla pregiatura ottenuta:
              {" "}{PREGIATURE.map(p => `${p.label} ${XP_PER_TIER[p.key]}`).join(" · ")}. Con un 20 naturale raddoppiano.
              I PE fanno salire di livello; ogni due livelli si sale di grado, e il grado dà il bonus al tiro.
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
              Una sola per personaggio. Ogni scheda ha il bonus iniziale (livello 1 del PG), il potenziamento (livello 5),
              le specializzazioni (livello 10, una a scelta) e la tabella d12 di ogni pregiatura: è da lì che esce l'oggetto.
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
              <h2 className="nx-titolo cr-libero-title">Vuoi qualcosa che non è in tabella?</h2>
              <p className="nx-prosa cr-libero-lead">
                Le tabelle sono esempi. Inventare un oggetto nuovo, riparare o migliorare la tua roba, fare qualsiasi cosa sensata
                per la tua arte: <strong>si può</strong>. Lo dici al Master, lui fissa pregiatura, materiali e tempo, e tiri come sempre.
                La qualità la decidono i dadi, non l'elenco.
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
   ProfessionCard — pannello espandibile con le tabelle d12
   ============================================================ */
function ProfessionCard({ prof, isOpen, onToggle }) {
  const [tier, setTier] = useState("comune");
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

          <h4 className="cr-subtitle cr-creazioni-title">🎲 Tabella d12 — Creazioni del {prof.name}</h4>
          <div className="nx-pillole cr-tier-tabs">
            {PREGIATURE.map(p => (
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
