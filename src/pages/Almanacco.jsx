// src/pages/Almanacco.jsx
//
// "Almanacco del Mondo" — pagina di consultazione (sezione Mondo).
//   1) Calendario di Exanthia (mesi colorati per stagione + i 5 giorni con pronuncia)
//   2) Le Vie del Mondo — il sistema di viaggio, spiegato passo per passo
//
// La sotto-sezione "Gli Eventi" è riservata ai Master (DM screen).

import { useState } from "react";
import { MESI_EXANTHIA, GIORNI_SETTIMANA, SOTTOTITOLO_TESTATA } from "../data/exanthiaCalendar";
import "./Almanacco.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/aenlor.png";

// Pronunce dei giorni della settimana (accento tonico in MAIUSCOLO).
const GIORNI_PRONUNCIA = {
  Aelen: "a-É-len",
  Voren: "VÓ-ren",
  Tarsen: "TÁR-sen",
  Doren: "DÓ-ren",
  Muren: "MÚ-ren",
};

// ── Stagioni: colore + icona ──────────────────────────────────────────────
const STAGIONI = {
  primavera: { nome: "Primavera", ic: "🌱", color: "#5a9a3f" },
  estate:    { nome: "Estate",    ic: "☀️", color: "#d8a93a" },
  autunno:   { nome: "Autunno",   ic: "🍂", color: "#b5702a" },
  inverno:   { nome: "Inverno",   ic: "❄️", color: "#5a8aa8" },
};

// Mese → { stagione, icona propria }. L'ordine segue MESI_EXANTHIA (1→12).
const MESI_INFO = {
  Gelalba:    { st: "inverno",   ic: "🌅" },
  Lungombra:  { st: "inverno",   ic: "🌑" },
  Disgelo:    { st: "primavera", ic: "💧" },
  Piovano:    { st: "primavera", ic: "🌧️" },
  Germoglino: { st: "primavera", ic: "🌱" },
  Solchiaro:  { st: "estate",    ic: "🌤️" },
  Solleone:   { st: "estate",    ic: "☀️" },
  Mascherata: { st: "estate",    ic: "🎭" },
  Brumaria:   { st: "autunno",   ic: "🌫️" },
  Granaio:    { st: "autunno",   ic: "🌾" },
  Fogliabruna:{ st: "autunno",   ic: "🍂" },
  Lamafredda: { st: "inverno",   ic: "🌬️" },
};

// ── Le Vie del Mondo: dati ─────────────────────────────────────────────────
const VEGLIE = [
  { ic: "🌅", nome: "Alba", ore: "06–12", chi: "Si parte: il gruppo leva il campo e si mette in marcia." },
  { ic: "☀️", nome: "Giorno", ore: "12–18", chi: "Si cammina: è qui che di norma si tira l'evento della giornata." },
  { ic: "🌆", nome: "Tramonto", ore: "18–24", chi: "Ci si accampa: cena, riposo, scene tra compagni." },
  { ic: "🌙", nome: "Notte", ore: "24–06", chi: "Si dorme a turni: entra in gioco la guardia (la Sentinella)." },
];

const ROTTE = [
  { nome: "La via maestra", pro: "Strade battute, locande dove dormire e contatti da incontrare.", contro: "È la più lenta ed è sorvegliata: chi vi cerca sa dove guardare." },
  { nome: "La scorciatoia", pro: "Taglia un giorno di cammino (−1 giorno).", contro: "Terreno infido o instabile: più alta la probabilità di guai." },
  { nome: "La via nascosta", pro: "Aggira i nemici noti e i posti di blocco.", contro: "Niente villaggi né rifornimenti: le provviste calano più in fretta." },
];

const PASSI = [
  { nome: "Lento", effetto: "Si va piano e attenti: vantaggio a Percezione e Furtività, ma il viaggio dura +50%." },
  { nome: "Normale", effetto: "Andatura standard, nessun bonus né malus." },
  { nome: "Forzato", effetto: "Si stringono i tempi (meno giorni), ma a fine giornata ognuno fa un TS Costituzione o prende 1 livello di Sfinimento." },
];

const RUOLI = [
  {
    nome: "Guida", ic: "🧭", color: "#3f7fb5", ab: "Sopravvivenza (Saggezza)",
    cosa: "Tiene la rotta e legge il territorio. Una volta al giorno tira per scegliere la strada giusta.",
    ok: "Trova la via più rapida: il gruppo guadagna tempo (−1 Veglia) o evita del tutto l'evento del giorno.",
    ko: "Vi perdete: si spreca tempo (+1 Veglia) o salta fuori un evento in più.",
  },
  {
    nome: "Esploratore", ic: "🔭", color: "#4f9a4f", ab: "Percezione / Furtività",
    cosa: "Va in avanscoperta davanti al gruppo per fiutare agguati, trappole e nemici prima che colpiscano.",
    ok: "Vede il pericolo per tempo: niente sorprese per il gruppo (anzi, è lui a sorprendere).",
    ko: "Cade nell'imboscata: i nemici attaccano per primi e con vantaggio.",
  },
  {
    nome: "Cacciatore", ic: "🏹", color: "#b5702a", ab: "Natura",
    cosa: "Procura cibo e acqua lungo il cammino: caccia, raccoglie, riempie le borracce.",
    ok: "Buona caccia: +2 tacche di provviste (la fame si allontana).",
    ko: "Niente da mangiare o cibo avariato: nessun rifornimento quel giorno.",
  },
  {
    nome: "Sentinella", ic: "🛡️", color: "#7a5aa8", ab: "Percezione passiva + 1d20 (stanchezza)",
    cosa: "Monta la guardia di notte. La Percezione passiva fa da baseline, ma ogni notte tira anche 1d20 di stanchezza: se esce basso, il sonno ha la meglio anche su una guardia attenta.",
    ok: "Resta vigile (d20 alto) e la sua passiva basta: sente arrivare il pericolo, il gruppo non viene colto di sorpresa.",
    ko: "Colpo di sonno (1–5 al d20) o pericolo più furtivo della sua passiva: l'attacco arriva nel sonno, il gruppo parte svantaggiato.",
  },
  {
    nome: "Cronista / Morale", ic: "🎺", color: "#b5453a", ab: "Intrattenere / Persuasione",
    cosa: "Tiene su l'umore con storie, canti e parole giuste, e annota le gesta del viaggio.",
    ok: "+1 morale: il gruppo ha vantaggio al prossimo tiro salvezza di squadra.",
    ko: "Nasce un battibecco tra compagni da appianare.",
  },
];

const EVENTI = [
  {
    n: 1, ic: "⚔️", tipo: "Combattimento", color: "#b5453a", voci: [
      "Predoni che bloccano la strada",
      "Bestia territoriale ferita",
      "Resti di una carovana + i mostri che l'hanno distrutta",
      "Pattuglia ostile",
      "Imboscata dall'alto",
      "Qualcosa che li seguiva si fa avanti",
    ],
  },
  {
    n: 2, ic: "🔍", tipo: "Scoperta", color: "#3f7fb5", voci: [
      "Rovina / altare con un'iscrizione",
      "Carovana abbandonata (loot + mistero)",
      "Cadavere con una mappa / lettera",
      "Confine naturale spettacolare",
      "Tracce di un mostro più grande",
      "Un seme di trama futura",
    ],
  },
  {
    n: 3, ic: "💬", tipo: "Incontro sociale", color: "#4f9a4f", voci: [
      "Viandante che chiede un passaggio",
      "Pellegrino con voci e notizie",
      "Truffatore / mercante troppo gentile",
      "Rifugiati in fuga da qualcosa",
      "Esattore / guardia che vuole un pedaggio",
      "Un volto noto fuori posto (gancio personale)",
    ],
  },
  {
    n: 4, ic: "🌊", tipo: "Sfida d'ambiente", color: "#2f9a9a", voci: [
      "Guado in piena",
      "Frana / passo chiuso",
      "Tempesta",
      "Palude / terreno infido",
      "Nebbia che disorienta",
      "Notte gelida senza riparo",
    ],
  },
  {
    n: 5, ic: "🎭", tipo: "Momento di personaggio", color: "#7a5aa8", voci: [
      "Sogno premonitore",
      "Un oggetto reagisce",
      "Un ricordo riaffiora",
      "Una piccola scelta morale",
      "Tensione tra due PG da sciogliere",
      "Un PG riceve un «sussurro» segreto",
    ],
  },
  {
    n: 6, ic: "😄", tipo: "Simpatico", color: "#d8a93a", voci: [
      "Mercante che giura che i suoi formaggi sono magici",
      "Un animale del party ruba qualcosa a un PG",
      "Menestrello che canta malissimo le gesta del gruppo",
      "Due contadini litigano per una capra e chiedono un arbitrato",
      "Un bambino scambia un PG per un eroe famoso",
      "Il burlone del tavolo insiste per fermarsi a far festa",
    ],
  },
];

// ── Lo specchietto dei tiri: chi tira, quando, cosa, a cosa serve ──────────
// È la risposta rapida alla domanda «che tiri vanno fatti e chi li fa».
const TIRI = [
  {
    ic: "🎲", chi: "Ogni giocatore", chiTag: "giocatori",
    quando: "1 volta al giorno, nel proprio Ruolo",
    tiro: "Abilità del suo Ruolo",
    scopo: "Costruisce la scena del giorno: chi guida, chi esplora, chi caccia, chi tiene il morale. Vedi la tabella dei Ruoli.",
  },
  {
    ic: "🎯", chi: "Il Master", chiTag: "master",
    quando: "1 volta al giorno",
    tiro: "1d6 + 1d6",
    scopo: "Il 1º d6 sceglie il tipo di evento, il 2º d6 pesca lo spunto preciso. Vedi la tabella degli Eventi.",
  },
  {
    ic: "🌊", chi: "Tutto il gruppo", chiTag: "gruppo",
    quando: "Solo se l'evento del giorno è una Sfida d'Ambiente",
    tiro: "Un'abilità diversa a testa · CD 12–15",
    scopo: "3 successi = superata; 3 fallimenti prima = passate comunque, ma pagando un prezzo.",
  },
  {
    ic: "⏱️", chi: "Tutto il gruppo", chiTag: "gruppo",
    quando: "Solo con Passo Forzato, a fine giornata",
    tiro: "Tiro Salvezza su Costituzione",
    scopo: "Chi fallisce prende 1 livello di Sfinimento (il prezzo per correre).",
  },
  {
    ic: "🛡️", chi: "La Sentinella", chiTag: "giocatori",
    quando: "Di notte",
    tiro: "1d20 stanchezza + Percezione passiva",
    scopo: "Con 1–5 al d20 si assopisce e il gruppo è colto di sorpresa; altrimenti la sua passiva si confronta col pericolo notturno.",
  },
];

// Etichetta colorata per «chi» tira.
const TIRO_TAG = {
  giocatori: { label: "Giocatore", color: "#3f7fb5" },
  master:    { label: "Master",    color: "#a8443a" },
  gruppo:    { label: "Gruppo",    color: "#4f9a4f" },
};

// ── La Scala dello Sfinimento: effetti cumulativi per livello ──────────────
const SFINIMENTO = [
  { lv: 1, col: "#d8a93a", eff: "Svantaggio alle prove di caratteristica" },
  { lv: 2, col: "#cf8f2f", eff: "Velocità dimezzata" },
  { lv: 3, col: "#c47328", eff: "Svantaggio ai tiri per colpire e ai tiri salvezza" },
  { lv: 4, col: "#b85528", eff: "Massimo dei punti ferita dimezzato" },
  { lv: 5, col: "#a83a28", eff: "Velocità ridotta a 0" },
  { lv: 6, col: "#7a231c", eff: "Morte" },
];

export default function Almanacco() {
  useParallaxScroll();
  const [openEvento, setOpenEvento] = useState(null);

  return (
    <section className="cine-page alm-page cine-compact" style={{ "--cine-accent": "#8a5a1f", "--cine-accent-2": "#b0832f" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO ── */}
      <section id="alm-top" className="alm-hero" aria-label="Almanacco del Mondo">
        <div className="alm-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="alm-hero-wash" aria-hidden="true" />
        <div className="alm-hero-plate">
          <span className="alm-hero-seal">✦ Informazioni del Mondo</span>
          <h1 className="alm-hero-title">Almanacco<br />di Exanthia</h1>
          <p className="alm-hero-tagline">
            Il computo dei giorni e le vie del mondo: ciò che ogni viandante dovrebbe sapere
            prima di mettersi in cammino.
          </p>
          <nav className="alm-hero-jump" aria-label="Indice">
            <a href="#alm-calendario">Calendario</a>
            <a href="#alm-viaggio">Le Vie del Mondo</a>
          </nav>
        </div>
      </section>

      {/* ════════ SEZIONE 1 — CALENDARIO ════════ */}
      <section id="alm-calendario" className="alm-section alm-band alm-band--cal" aria-label="Calendario di Exanthia">
        <div className="alm-band-inner">
        <header className="alm-sec-head">
          <span className="alm-sec-eyebrow">Sezione I · Il Computo del Tempo</span>
          <h2 className="alm-sec-title">Il Calendario di Exanthia</h2>
          <p className="alm-sec-lead">
            L'anno si divide in <strong>12 mesi da 20 giorni</strong>. La settimana conta
            <strong> 5 giorni</strong>, quindi ogni mese è fatto di <strong>4 settimane esatte</strong>:
            in tutto <strong>240 giorni</strong> l'anno. L'insegna fissa della gazzetta è
            «{SOTTOTITOLO_TESTATA}».
          </p>
        </header>

        {/* Giorni della settimana */}
        <article className="alm-card alm-card--days">
          <h3 className="alm-card-title">I Cinque Giorni della Settimana</h3>
          <ol className="alm-days">
            {GIORNI_SETTIMANA.map((g, i) => (
              <li key={g} className="alm-day">
                <span className="alm-day-num" aria-hidden="true">{i + 1}</span>
                <span className="alm-day-name">{g}</span>
                <span className="alm-day-pron">{GIORNI_PRONUNCIA[g]}</span>
              </li>
            ))}
          </ol>
        </article>

        {/* Mesi dell'anno, colorati per stagione */}
        <article className="alm-card alm-card--months">
          <h3 className="alm-card-title">I Dodici Mesi dell'Anno</h3>

          {/* Legenda stagioni */}
          <div className="alm-seasons-legend">
            {Object.values(STAGIONI).map((s) => (
              <span key={s.nome} className="alm-season-chip" style={{ "--s-color": s.color }}>
                <span aria-hidden="true">{s.ic}</span> {s.nome}
              </span>
            ))}
          </div>

          <ol className="alm-months">
            {MESI_EXANTHIA.map((m, i) => {
              const info = MESI_INFO[m] || { st: "inverno", ic: "•" };
              const st = STAGIONI[info.st];
              return (
                <li key={m} className="alm-month" style={{ "--s-color": st.color }}>
                  <span className="alm-month-num" aria-hidden="true">{i + 1}</span>
                  <span className="alm-month-ic" aria-hidden="true">{info.ic}</span>
                  <span className="alm-month-body">
                    <span className="alm-month-name">{m}</span>
                    <span className="alm-month-season">{st.ic} {st.nome}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </article>
        </div>
      </section>

      {/* ════════ SEZIONE 2 — LE VIE DEL MONDO ════════ */}
      <section id="alm-viaggio" className="alm-section alm-band alm-band--travel" aria-label="Le Vie del Mondo">
        <div className="alm-band-inner">
        <header className="alm-sec-head">
          <span className="alm-sec-eyebrow">Sezione II · Sistema di Viaggio</span>
          <h2 className="alm-sec-title">🜂 Le Vie del Mondo</h2>
          <p className="alm-sec-lead">
            Il modo in cui giochiamo gli spostamenti tra una meta e l'altra, senza ridurli a un
            «arrivate dopo tre giorni». La regola d'oro: <strong>ogni giornata di viaggio contiene
            una decisione e una scoperta</strong>. Sotto trovi prima <strong>chi tira e cosa</strong>,
            poi il dettaglio di ogni pezzo.
          </p>
        </header>

        {/* ── LO SPECCHIETTO DEI TIRI — chi tira, quando, cosa, perché ── */}
        <div className="alm-tiri" aria-label="Chi tira e cosa">
          <h3 className="alm-tiri-title">📋 Lo specchietto dei tiri</h3>
          <p className="alm-tiri-sub">
            Tutto il viaggio si regge su pochissimi tiri. Ecco chi li fa e quando — il resto della
            pagina serve solo ad approfondirli.
          </p>
          <div className="alm-tiri-table">
            <div className="alm-tiri-head" aria-hidden="true">
              <span>Chi</span><span>Quando</span><span>Cosa tira</span><span>A cosa serve</span>
            </div>
            {TIRI.map((t, i) => {
              const tag = TIRO_TAG[t.chiTag];
              return (
                <div key={i} className="alm-tiri-row" style={{ "--t-color": tag.color }}>
                  <span className="alm-tiri-chi">
                    <span className="alm-tiri-ic" aria-hidden="true">{t.ic}</span>
                    <span className="alm-tiri-name">{t.chi}</span>
                    <span className="alm-tiri-badge">{tag.label}</span>
                  </span>
                  <span className="alm-tiri-cell" data-label="Quando">{t.quando}</span>
                  <span className="alm-tiri-cell alm-tiri-dado" data-label="Cosa tira">{t.tiro}</span>
                  <span className="alm-tiri-cell" data-label="A cosa serve">{t.scopo}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Le Quattro Veglie */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">1</span> Come è fatta una giornata: le Quattro Veglie</h3>
          <p className="alm-block-note">
            Ogni giornata di cammino si spezza in 4 «Veglie» da 6 ore l'una: servono a dare ritmo e
            a sapere quando può succedere qualcosa. Di norma capita <strong>un evento al giorno</strong>,
            di solito durante la Veglia del Giorno. Se vuoi un viaggio teso ne tiri fino a 2; se vuoi
            correre, nessun evento e salti avanti con un «montaggio» (vedi punto 6).
          </p>
          <div className="alm-veglie">
            {VEGLIE.map((v) => (
              <div key={v.nome} className="alm-veglia">
                <span className="alm-veglia-ic" aria-hidden="true">{v.ic}</span>
                <span className="alm-veglia-nome">{v.nome}</span>
                <span className="alm-veglia-ore">{v.ore}</span>
                <span className="alm-veglia-chi">{v.chi}</span>
              </div>
            ))}
          </div>
        </div>

        {/* La partenza */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">2</span> Prima di partire: tre scelte rapide</h3>
          <p className="alm-block-note">
            All'inizio del viaggio il gruppo decide tre cose. Sono scelte con conseguenze meccaniche
            chiare: ognuna ha un vantaggio e un prezzo.
          </p>
          <div className="alm-trio">
            <div className="alm-mini">
              <h4>A · La Rotta — che strada prendete?</h4>
              <ul className="alm-defs">
                {ROTTE.map((r) => (
                  <li key={r.nome}><strong>{r.nome}.</strong> {r.pro} <em>Lo scotto:</em> {r.contro}</li>
                ))}
              </ul>
            </div>
            <div className="alm-mini">
              <h4>B · Il Passo — a che andatura?</h4>
              <ul className="alm-defs">
                {PASSI.map((p) => (
                  <li key={p.nome}><strong>{p.nome}.</strong> {p.effetto}</li>
                ))}
              </ul>
            </div>
            <div className="alm-mini">
              <h4>C · Le Provviste — quanto resistete?</h4>
              <p>
                Si segna una barra di <strong>6 tacche</strong> che rappresenta cibo, acqua e luce
                (torce, olio). Ogni giorno di viaggio cala di <strong>1 tacca</strong>; il Cacciatore
                può ricaricarla. Se arriva a <strong>0</strong>, il gruppo soffre la fame e ognuno
                rischia un livello di <strong>Sfinimento</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* I ruoli di viaggio */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">3</span> I Ruoli di Viaggio — il compito di ciascuno</h3>
          <p className="alm-block-note">
            Questo è il cuore «giocabile»: all'inizio del viaggio <strong>ogni giocatore sceglie un
            ruolo</strong> (uno a testa). Poi, <strong>ogni giornata di cammino, tira una volta col
            proprio ruolo</strong>. Che riesca o fallisca, quel risultato diventa un pezzo della scena
            di quel giorno — così nessuno resta a guardare, anche fuori dal combattimento.
          </p>
          <div className="alm-roles">
            {RUOLI.map((r) => (
              <div key={r.nome} className="alm-role" style={{ "--r-color": r.color }}>
                <div className="alm-role-head">
                  <span className="alm-role-ic" aria-hidden="true">{r.ic}</span>
                  <span className="alm-role-name">{r.nome}</span>
                  <span className="alm-role-skill">{r.passivo ? `non tira — ${r.ab}` : `tira: ${r.ab}`}</span>
                </div>
                <p className="alm-role-cosa">{r.cosa}</p>
                <p className="alm-role-ok"><span aria-hidden="true">✓ Riesce</span> — {r.ok}</p>
                <p className="alm-role-ko"><span aria-hidden="true">✗ Fallisce</span> — {r.ko}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Gli eventi — visibili a tutti */}
        <div className="alm-block">
            <h3 className="alm-block-title">
              <span className="alm-block-num">4</span> Gli Eventi
            </h3>
            <p className="alm-block-note">
              Per scegliere cosa succede in una giornata il Master tira
              <strong> 1d6 per il tipo di evento</strong> (le sei categorie qui sotto), poi
              <strong> un altro 1d6</strong> per pescare lo spunto preciso nella sotto-tabella.
              Tocca una categoria per aprirla.
            </p>
            <div className="alm-eventi">
              {EVENTI.map((e) => {
                const isOpen = openEvento === e.n;
                return (
                  <div key={e.n} className={`alm-evento${isOpen ? " is-open" : ""}`} style={{ "--e-color": e.color }}>
                    <button
                      type="button"
                      className="alm-evento-head"
                      aria-expanded={isOpen}
                      onClick={() => setOpenEvento(isOpen ? null : e.n)}
                    >
                      <span className="alm-evento-die" aria-hidden="true">{e.n}</span>
                      <span className="alm-evento-ic" aria-hidden="true">{e.ic}</span>
                      <span className="alm-evento-tipo">{e.tipo}</span>
                      <span className="alm-evento-caret" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <ol className="alm-evento-list">
                        {e.voci.map((v, i) => (
                          <li key={i}><span className="alm-evento-subdie" aria-hidden="true">{i + 1}</span>{v}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        {/* Sfide d'ambiente */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">5</span> Le Sfide d'Ambiente — superare un ostacolo insieme</h3>
          <p className="alm-block-note">
            Quando l'evento del giorno è di tipo ambientale (un fiume in piena, una frana, una
            tempesta) non si combatte: si supera l'ostacolo con un piccolo gioco di squadra. A turno
            ogni PG <strong>racconta come prova a superarlo e tira un'abilità diversa</strong>
            {" "}(difficoltà di solito 12–15). Bastano <strong>3 successi</strong> per farcela; ma se
            arrivano <strong>3 fallimenti</strong> prima, passate comunque, pagando però un prezzo.
          </p>
          <div className="alm-duo">
            <p className="alm-callout alm-callout--ok">
              <strong>3 successi</strong> → passate, magari con un piccolo premio.
            </p>
            <p className="alm-callout alm-callout--ko">
              <strong>3 fallimenti</strong> → passate lo stesso, ma con un costo: −tacche di provviste,
              danni, Sfinimento o un evento extra.
            </p>
          </div>
          <p className="alm-block-note alm-example">
            <strong>Esempio — guado in piena:</strong> uno nuota per primo (Atletica), uno cerca il
            punto meno profondo (Sopravvivenza), uno calma i cavalli (Addestrare Animali), uno tiene
            le scorte all'asciutto (Arcano). Tutti partecipano, in pochi minuti reali.
          </p>
        </div>

        {/* Ritmo */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">6</span> Il Ritmo — quando giocare e quando saltare</h3>
          <p className="alm-block-note">
            Non tutto il viaggio va giocato minuto per minuto: alterna due velocità a seconda di
            quanto è interessante il momento.
          </p>
          <div className="alm-duo">
            <p className="alm-callout">
              <strong>Montaggio</strong> — i tratti vuoti. Una frase a giocatore («Raccontami
              un'immagine del vostro viaggio in questi giorni») e si salta avanti.
            </p>
            <p className="alm-callout">
              <strong>Zoom</strong> — i momenti caldi. La scena si gioca battuta per battuta, come in
              un normale incontro.
            </p>
          </div>
          <p className="alm-block-note">Regola pratica: <strong>fai lo zoom solo dove c'è una scelta o una tensione</strong>. Tutto il resto è montaggio.</p>
        </div>

        {/* Ricompense */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num">7</span> Cosa Lascia il Viaggio</h3>
          <p className="alm-block-note">Un viaggio deve dare qualcosa, altrimenti resta tempo perso. Di solito porta:</p>
          <ul className="alm-rewards">
            <li>Un <strong>gancio di trama</strong> (di norma nasce da una Scoperta).</li>
            <li>Una <strong>scorciatoia</strong> o un <strong>contatto</strong> da usare la volta dopo.</li>
            <li>Piccolo <strong>loot</strong> o <strong>materiali da crafting</strong>.</li>
            <li><strong>Lore a rate</strong>, sbloccata man mano col livello.</li>
          </ul>
        </div>

        {/* La Scala dello Sfinimento */}
        <div className="alm-block">
          <h3 className="alm-block-title"><span className="alm-block-num alm-block-num--warn">⚠</span> La Scala dello Sfinimento</h3>
          <p className="alm-block-note">
            Correre col <strong>Passo Forzato</strong> o restare a <strong>provviste 0</strong> fa
            accumulare livelli di <strong>Sfinimento</strong>. Gli effetti sono <strong>cumulativi</strong>:
            chi è al livello 3 subisce anche quelli dell'1 e del 2. Un <strong>riposo lungo</strong> con
            cibo e acqua a sufficienza toglie <strong>1 livello</strong>.
          </p>
          <ol className="alm-sfin">
            {SFINIMENTO.map((s) => (
              <li key={s.lv} className={`alm-sfin-row${s.lv === 6 ? " is-death" : ""}`} style={{ "--sf": s.col }}>
                <span className="alm-sfin-lv">{s.lv}</span>
                <span className="alm-sfin-eff">{s.eff}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Quick reference */}
        <div className="alm-block alm-quick">
          <h3 className="alm-block-title"><span className="alm-block-num">★</span> In breve: la sequenza di una giornata</h3>
          <ol className="alm-quick-steps">
            <li>Scegliete la Rotta (2 strade con un «ma»)</li>
            <li>Scegliete il Passo (lento / normale / forzato)</li>
            <li>Ogni giocatore tira il proprio Ruolo</li>
            <li>Il Master tira 1d6 + 1d6 per l'evento</li>
            <li>Giocate la scena (zoom) o saltate (montaggio)</li>
            <li>Aggiornate progresso e provviste</li>
          </ol>
        </div>
        </div>
      </section>
    </section>
  );
}
