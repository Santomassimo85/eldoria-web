// src/pages/Almanacco.jsx
//
// "Almanacco del Mondo" — pagina di consultazione (sezione Mondo).
//   1) Calendario di Exanthia (mesi colorati per stagione + i 5 giorni con pronuncia)
//   2) Le Vie del Mondo — il sistema di viaggio SEMPLIFICATO (2026-09-08):
//        a) ogni giocatore sceglie una CLASSE DI VIAGGIO
//        b) fa UN SOLO TIRO con l'abilità della classe (CD 12)
//        c) si contano successi e fallimenti → l'ESITO DEL GRUPPO (da Disastro a Benedetto)
//        d) il Master tira 1d100 (+/− l'esito) sulla TAVOLA DEL DESTINO
//   La Tavola del Destino (100 voci: nemici, ambiente, incontri, scoperte, fortune,
//   sventure…) è visibile SOLO al Master (DM screen), con tasto per tirare.

import { useMemo, useRef, useState } from "react";
import { MESI_EXANTHIA, GIORNI_SETTIMANA, SOTTOTITOLO_TESTATA } from "../data/exanthiaCalendar";
import GlacierHero from "../components/glacier/GlacierHero";
import { useAuth } from "../AuthContext";
import "./Almanacco.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/aenlor.png";
// I due Master del tavolo: la Tavola del Destino la vedono entrambi.
const MASTER_EMAILS = ["santomassimo85@gmail.com", "ripperti96@gmail.com"];

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
  primavera: { nome: "Primavera", ic: "🌱", color: "#4ade80" },
  estate:    { nome: "Estate",    ic: "☀️", color: "#fbbf24" },
  autunno:   { nome: "Autunno",   ic: "🍂", color: "#fb923c" },
  inverno:   { nome: "Inverno",   ic: "❄️", color: "#60a5fa" },
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

// ── Le Vie del Mondo: le CLASSI di viaggio (una a testa, un solo tiro) ─────
const CD_VIAGGIO = 12;
const CLASSI = [
  {
    nome: "Guida", ic: "🧭", color: "#60a5fa", ab: "Sopravvivenza (Saggezza)",
    cosa: "Tiene la rotta e legge il territorio: sceglie la strada giusta.",
    ok: "Trova la via più rapida: si guadagna tempo.",
    ko: "Vi perdete: si spreca tempo e il Master può aggiungere un guaio.",
  },
  {
    nome: "Esploratore", ic: "🔭", color: "#4ade80", ab: "Percezione / Furtività",
    cosa: "Va in avanscoperta per fiutare agguati, trappole e nemici prima che colpiscano.",
    ok: "Vede il pericolo per tempo: niente sorprese per il gruppo.",
    ko: "Cade nell'imboscata: i nemici attaccano per primi e con vantaggio.",
  },
  {
    nome: "Cacciatore", ic: "🏹", color: "#fb923c", ab: "Natura",
    cosa: "Procura cibo e acqua lungo il cammino: caccia, raccoglie, riempie le borracce.",
    ok: "Buona caccia: provviste piene, la fame si allontana.",
    ko: "Niente da mangiare o cibo avariato: nessun rifornimento.",
  },
  {
    nome: "Sentinella", ic: "🛡️", color: "var(--el-soft)", ab: "Percezione",
    cosa: "Monta la guardia di notte e tiene gli occhi aperti quando gli altri dormono.",
    ok: "Resta vigile: il gruppo non viene colto di sorpresa nel sonno.",
    ko: "Colpo di sonno: se arriva qualcosa di notte, arriva nel sonno.",
  },
  {
    nome: "Cronista", ic: "🎺", color: "#f87171", ab: "Intrattenere / Persuasione",
    cosa: "Tiene su l'umore con storie, canti e parole giuste, e tratta con chi si incontra.",
    ok: "Morale alto: vantaggio al prossimo tiro salvezza di squadra.",
    ko: "Nasce un battibecco tra compagni da appianare.",
  },
];

// ── L'esito del gruppo: quanti successi → il modificatore al d100 del Master ─
const ESITI = [
  { key: "disastro",  label: "Disastro",   mod: -20, ic: "☠️", col: "#ff8a7e", quando: "Tutti falliscono" },
  { key: "male",      label: "Male",       mod: -10, ic: "🌑", col: "#fb923c", quando: "Più fallimenti che successi" },
  { key: "pari",      label: "Così così",  mod: 0,   ic: "⚖️", col: "#b9af9d", quando: "Successi e fallimenti alla pari" },
  { key: "bene",      label: "Bene",       mod: 10,  ic: "🌤️", col: "#4ade80", quando: "Più successi che fallimenti" },
  { key: "benedetto", label: "Benedetto",  mod: 20,  ic: "✨", col: "var(--oro)", quando: "Tutti riescono" },
];

// ── Lo specchietto dei tiri (due righe: i giocatori, il Master) ────────────
const TIRI = [
  {
    ic: "🎲", chi: "Ogni giocatore", chiTag: "giocatori",
    quando: "1 volta per viaggio, nella propria classe",
    tiro: `Abilità della classe · CD ${CD_VIAGGIO}`,
    scopo: "Riesce = +1 successo per il gruppo; fallisce = +1 fallimento. Il risultato colora la scena.",
  },
  {
    ic: "🎯", chi: "Il Master", chiTag: "master",
    quando: "Dopo i tiri dei giocatori",
    tiro: "1d100 + esito del gruppo",
    scopo: "Pesca sulla Tavola del Destino: nemici, ambiente, incontri, scoperte, fortune e sventure. Più è alto, meglio va.",
  },
];
const TIRO_TAG = {
  giocatori: { label: "Giocatore", color: "#60a5fa" },
  master:    { label: "Master",    color: "var(--oro)" },
};

// ── Recap lampo: tre passi ─────────────────────────────────────────────────
const RECAP = [
  { ic: "🧭", k: "Scegliete",  t: "una classe di viaggio a testa" },
  { ic: "🎲", k: "Un tiro",    t: "a testa, CD 12: si contano i successi" },
  { ic: "🎯", k: "Il Master",  t: "tira il d100 sulla Tavola del Destino" },
];

// ── La Scala dello Sfinimento (richiamata da alcune voci della Tavola) ─────
const SFINIMENTO = [
  { lv: 1, col: "#fbbf24", eff: "Svantaggio alle prove di caratteristica" },
  { lv: 2, col: "#fbbf24", eff: "Velocità dimezzata" },
  { lv: 3, col: "#fb923c", eff: "Svantaggio ai tiri per colpire e ai tiri salvezza" },
  { lv: 4, col: "#f87171", eff: "Massimo dei punti ferita dimezzato" },
  { lv: 5, col: "var(--oro)", eff: "Velocità ridotta a 0" },
  { lv: 6, col: "var(--sangue)", eff: "Morte" },
];

// ── LA TAVOLA DEL DESTINO (d100, solo Master): dal peggio (1) al meglio (100) ─
const CAT = {
  sventura:    { ic: "☠️", nome: "Sventura",      col: "#ff8a7e" },
  nemici:      { ic: "⚔️", nome: "Nemici",        col: "#f87171" },
  ambiente:    { ic: "🌊", nome: "Ambiente",      col: "var(--el-2)" },
  incontri:    { ic: "💬", nome: "Incontro",      col: "#4ade80" },
  personaggio: { ic: "🎭", nome: "Personaggio",   col: "var(--el-soft)" },
  scoperte:    { ic: "🔍", nome: "Scoperta",      col: "#60a5fa" },
  curiosi:     { ic: "😄", nome: "Curioso",       col: "#fbbf24" },
  fortuna:     { ic: "✨", nome: "Fortuna",       col: "var(--oro)" },
};
const T = (cat, testo) => ({ cat, testo });
const TAVOLA = [
  T("sventura", "Imboscata notturna: predoni colpiscono nel sonno, il gruppo è sorpreso e senza armatura."),
  T("sventura", "Frana sul sentiero: TS Destrezza CD 13 o 2d6 danni contundenti; la via è chiusa (+1 giorno)."),
  T("sventura", "Acqua avvelenata: chi ha bevuto fa TS Costituzione CD 13 o è avvelenato per 24 ore."),
  T("sventura", "Branco di lupi affamati (1 per PG): attaccano prima i cavalli."),
  T("sventura", "Tempesta di fulmini in campo aperto: chi non trova riparo prende 1 livello di Sfinimento."),
  T("sventura", "Ladri nella notte: sparisce l'oggetto più prezioso non indossato (si può inseguire la pista)."),
  T("sventura", "Ponte marcio: crolla mentre lo attraversate (TS Destrezza CD 12 o caduta, 2d6 danni)."),
  T("sventura", "Un mostro grande (troll, orso-gufo) ha fatto la tana proprio sulla via."),
  T("sventura", "Febbre di palude: 1d4 PG a caso fanno TS Costituzione CD 12 o 1 livello di Sfinimento."),
  T("sventura", "Il sentiero sparisce: siete persi, +1 giorno e provviste dimezzate."),
  T("nemici", "Pattuglia ostile (guardie corrotte o soldati nemici) chiede il pedaggio con la spada."),
  T("nemici", "Banditi con un arciere sull'altura: «la borsa o la vita»."),
  T("nemici", "Sciame di insetti giganti sbuca da un tronco cavo."),
  T("nemici", "Goblin tendono una trappola con corde e pietre."),
  T("nemici", "Bestia territoriale ferita (cinghiale gigante, orso): carica a vista."),
  T("nemici", "Ragni giganti tra gli alberi: ragnatele sul sentiero."),
  T("nemici", "Un cavaliere errante folle sfida a duello il PG più corazzato."),
  T("nemici", "Non-morti risvegliati da un cimitero dimenticato lungo la via."),
  T("nemici", "Mercenari assoldati da un vecchio nemico del gruppo."),
  T("nemici", "Cultisti in rito attorno a un fuoco: non gradiscono spettatori."),
  T("nemici", "Un drago giovane sorvola la zona in cerca di preda (si evita solo nascondendosi)."),
  T("nemici", "Resti di una carovana distrutta: le creature che l'hanno assalita sono ancora lì."),
  T("nemici", "Qualcosa che vi seguiva da giorni decide di farsi avanti."),
  T("nemici", "Elementale di terra disturbato dal vostro passaggio."),
  T("nemici", "Coccatrice nel sottobosco: pericolo a sorpresa."),
  T("ambiente", "Nebbia fitta: Percezione dimezzata per la giornata, facile perdersi."),
  T("ambiente", "Pioggia battente: strade fangose, mezza giornata di marcia in più."),
  T("ambiente", "Guado in piena: prova di gruppo (Atletica o Sopravvivenza CD 13, servono 3 successi)."),
  T("ambiente", "Notte gelida senza riparo: TS Costituzione CD 12 o 1 livello di Sfinimento."),
  T("ambiente", "Caldo torrido: consumo d'acqua doppio."),
  T("ambiente", "Terremoto leggero: crepe sul terreno, cavalli spaventati."),
  T("ambiente", "Sentiero cancellato da una frana: deviazione di mezza giornata."),
  T("ambiente", "Bufera di sabbia o neve: visibilità zero, si marcia legati."),
  T("ambiente", "Palude infida: chi fallisce Sopravvivenza CD 12 perde uno stivale… e 1d4 PF."),
  T("ambiente", "Grandine improvvisa: 1d4 danni a chi è senza elmo, i cavalli fuggono."),
  T("ambiente", "Bosco «che si muove»: gli alberi cambiano posto, la Guida ritira."),
  T("ambiente", "Ponte di corda che dondola sul burrone: Acrobazia CD 12 a testa."),
  T("ambiente", "Un fiume da attraversare in barca: il traghettatore vuole 5 mo a testa."),
  T("ambiente", "Eclissi inattesa: buio per un'ora, gli animali impazziscono."),
  T("ambiente", "Miraggio: il gruppo cammina in tondo e perde mezza giornata."),
  T("incontri", "Esattore che pretende un pedaggio «legale» di 10 mo a testa."),
  T("incontri", "Mercante troppo gentile: vende merce truccata (Intuizione CD 13 per accorgersene)."),
  T("incontri", "Rifugiati in fuga da qualcosa: chiedono cibo e portano notizie."),
  T("incontri", "Un pellegrino cieco che «sa» il nome di un PG."),
  T("incontri", "Contadini che litigano per una capra e chiedono un arbitrato."),
  T("incontri", "Cacciatore di taglie con un manifesto: assomiglia a un PG."),
  T("incontri", "Carovana di nani disposti a scortarvi… a un prezzo."),
  T("incontri", "Bardo vagabondo che canta (malissimo) le gesta del gruppo."),
  T("incontri", "Un bambino scambia un PG per un eroe famoso e vuole seguirlo."),
  T("incontri", "Viandante che chiede un passaggio: è più di quel che sembra."),
  T("incontri", "Guardie di confine: controllo documenti, un PG non è «in regola»."),
  T("incontri", "Eremita che offre riparo in cambio di una storia vera."),
  T("incontri", "Un volto noto del passato di un PG, fuori posto."),
  T("incontri", "Circo itinerante: distrazioni, giochi e un borseggiatore."),
  T("incontri", "Messaggero a cavallo con una lettera… per la persona sbagliata."),
  T("personaggio", "Sogno premonitore per un PG: un'immagine della prossima sessione."),
  T("personaggio", "Un oggetto del gruppo reagisce: si scalda, brilla, sussurra."),
  T("personaggio", "Un ricordo riaffiora: flashback di due minuti, giocato."),
  T("personaggio", "Tensione tra due PG: una scena da sciogliere prima di dormire."),
  T("personaggio", "Un PG riceve un «sussurro» segreto dal Master (biglietto)."),
  T("personaggio", "Una piccola scelta morale: un ladro ferito chiede aiuto."),
  T("personaggio", "Un animale selvatico si affeziona a un PG (possibile compagno)."),
  T("personaggio", "Il Cronista trova le parole giuste: vantaggio al prossimo TS di squadra."),
  T("personaggio", "Un vecchio compagno appare in sogno con un avvertimento."),
  T("personaggio", "Un PG scopre un talento nascosto: oggi un tiro con vantaggio a scelta."),
  T("scoperte", "Rovina con un'iscrizione in una lingua antica."),
  T("scoperte", "Carovana abbandonata: 1d6×10 mo di bottino e un mistero."),
  T("scoperte", "Cadavere con una mappa o una lettera che porta da qualche parte."),
  T("scoperte", "Altare dimenticato: chi offre qualcosa riceve una benedizione (o no)."),
  T("scoperte", "Tracce di un mostro più grande di qualunque cosa vista finora."),
  T("scoperte", "Grotta con cristalli di Arcanite grezza (materiale da crafting)."),
  T("scoperte", "Vista mozzafiato da un confine naturale: ispirazione a tutti."),
  T("scoperte", "Statua che indica una direzione diversa ogni alba."),
  T("scoperte", "Nascondiglio di contrabbandieri: rifornimenti… e problemi futuri."),
  T("scoperte", "Un seme di trama: un simbolo già visto, inciso su un albero."),
  T("scoperte", "Fonte d'acqua pura: cura 1d8 PF e toglie 1 livello di Sfinimento."),
  T("scoperte", "Vecchio campo abbandonato con tende ancora buone."),
  T("scoperte", "Erbe rare: il Cacciatore trova ingredienti per 2 pozioni."),
  T("scoperte", "Torre di guardia in rovina: rifugio sicuro per la notte."),
  T("scoperte", "Un carro con una piccola biblioteca dimenticata: un tomo di conoscenza."),
  T("curiosi", "Un mercante giura che i suoi formaggi sono magici (uno lo è davvero)."),
  T("curiosi", "Un animale del party ruba qualcosa a un PG e scappa."),
  T("curiosi", "Il burlone del tavolo insiste per fermarsi a far festa in un villaggio."),
  T("curiosi", "Gara di bevute in una locanda di strada: chi vince ha un favore."),
  T("curiosi", "Un gatto nero segue il gruppo per un giorno intero."),
  T("curiosi", "Una pioggia di rane. Davvero."),
  T("curiosi", "Un cartello con le indicazioni sbagliate, opera di un burlone."),
  T("curiosi", "Un nano ubriaco dice di essere il re di un regno che nessuno conosce."),
  T("curiosi", "Concorso di poesia in una fattoria: in premio, una torta magica."),
  T("curiosi", "Un draghetto di trenta centimetri chiede di essere adottato."),
  T("fortuna", "Riposo perfetto: tutti recuperano PF e 1 livello di Sfinimento."),
  T("fortuna", "Locanda accogliente e gratuita: l'oste deve un favore a un PG."),
  T("fortuna", "Un viandante regala una mappa: −1 giorno di viaggio."),
  T("fortuna", "Buona caccia: provviste al massimo."),
  T("fortuna", "Un mercante onesto: sconto vero (−20%) sul prossimo acquisto."),
  T("fortuna", "Cielo limpido e buoni venti: il viaggio scorre senza intoppi, mezza giornata guadagnata."),
  T("fortuna", "Un alleato inatteso si unisce fino alla prossima città."),
  T("fortuna", "Trovate un oggetto magico minore abbandonato."),
  T("fortuna", "Benedizione di un santuario: vantaggio al primo tiro della prossima sessione."),
  T("fortuna", "Presagio degli dèi: una visione chiara della meta, ispirazione a tutti."),
].map((v, i) => ({ ...v, n: i + 1 }));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function Almanacco() {
  useParallaxScroll();
  const { currentUser } = useAuth();
  const isMaster = MASTER_EMAILS.includes(currentUser?.email);

  // ── il tiro del Master sulla Tavola ──
  const [esito, setEsito] = useState("pari");
  const [tiro, setTiro] = useState(null);       // { nat, tot }
  const [rotola, setRotola] = useState(false);
  const [mostra, setMostra] = useState(null);   // filtro categoria
  const righeRef = useRef({});
  const mod = ESITI.find((e) => e.key === esito)?.mod ?? 0;

  const tiraD100 = () => {
    if (rotola) return;
    setRotola(true);
    let t = 0;
    const iv = setInterval(() => {
      const nat = 1 + Math.floor(Math.random() * 100);
      setTiro({ nat, tot: clamp(nat + mod, 1, 100), finto: true });
      if (++t > 12) {
        clearInterval(iv);
        const n = 1 + Math.floor(Math.random() * 100);
        const tot = clamp(n + mod, 1, 100);
        setTiro({ nat: n, tot });
        setRotola(false);
        setMostra(null);
        setTimeout(() => righeRef.current[tot]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
      }
    }, 60);
  };

  const righe = useMemo(() => (mostra ? TAVOLA.filter((r) => r.cat === mostra) : TAVOLA), [mostra]);
  const conteggi = useMemo(() => TAVOLA.reduce((a, r) => ((a[r.cat] = (a[r.cat] || 0) + 1), a), {}), []);

  return (
    <section className="cine-page alm-page cine-compact" style={{ "--cine-accent": "var(--el)", "--cine-accent-2": "var(--el-soft)" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO: l'occhio del drago con Aen-Lor ── */}
      <GlacierHero
        id="alm-top"
        ariaLabel="Almanacco del Mondo"
        image={HERO_IMAGE}
        eyebrow="Informazioni del Mondo"
        title={<>Almanacco<br />di Exanthia</>}
        seal="✦ 12 mesi · 5 giorni · 240 giorni l'anno"
        tagline="Il computo dei giorni e le vie del mondo: ciò che ogni viandante dovrebbe sapere prima di mettersi in cammino."
      />

      {/* ── INDICE A PILLOLE ── */}
      <nav className="nx-pillole alm-indice" aria-label="Indice">
        <a href="#alm-calendario" className="nx-pillola">📅 Calendario</a>
        <a href="#alm-mesi" className="nx-pillola">🌙 I Mesi</a>
        <a href="#alm-viaggio" className="nx-pillola">🜂 Le Vie del Mondo</a>
        <a href="#alm-classi" className="nx-pillola">🧭 Le Classi</a>
        {isMaster && <a href="#alm-tavola" className="nx-pillola">🎯 La Tavola</a>}
      </nav>

      {/* ════════ SEZIONE 1 — CALENDARIO ════════ */}
      <section id="alm-calendario" className="alm-section" aria-label="Calendario di Exanthia">
        <div className="gl-sezlabel">Sezione I · Il Computo del Tempo</div>
        <header className="nx-testata alm-testata">
          <h2 className="nx-titolo">Il Calendario di Exanthia</h2>
          <p className="nx-sotto alm-lead">
            L'anno si divide in <strong>12 mesi da 20 giorni</strong>. La settimana conta
            <strong> 5 giorni</strong>, quindi ogni mese è fatto di <strong>4 settimane esatte</strong>:
            in tutto <strong>240 giorni</strong> l'anno. L'insegna fissa della gazzetta è
            «{SOTTOTITOLO_TESTATA}».
          </p>
        </header>

        <h3 className="alm-h3">I Cinque Giorni della Settimana</h3>
        <ol className="nx-griglia alm-giorni">
          {GIORNI_SETTIMANA.map((g, i) => (
            <li key={g} className="nx-pannello alm-giorno">
              <span className="orb" aria-hidden="true">{i + 1}</span>
              <span className="nx-nome">{g}</span>
              <span className="nx-nota alm-pron">{GIORNI_PRONUNCIA[g]}</span>
            </li>
          ))}
        </ol>

        <h3 id="alm-mesi" className="alm-h3">I Dodici Mesi dell'Anno</h3>
        <div className="nx-pillole alm-stagioni" aria-label="Stagioni">
          {Object.values(STAGIONI).map((s) => (
            <span key={s.nome} className="nx-pillola alm-stagione" style={{ "--s-color": s.color }}>
              <span aria-hidden="true">{s.ic}</span> {s.nome}
            </span>
          ))}
        </div>
        <ol className="nx-griglia alm-mesi">
          {MESI_EXANTHIA.map((m, i) => {
            const info = MESI_INFO[m] || { st: "inverno", ic: "•" };
            const st = STAGIONI[info.st];
            return (
              <li key={m} className="nx-pannello nx-pannello--tap alm-mese" style={{ "--s-color": st.color }}>
                <span className="nx-tag alm-mese-tag">{st.ic} {st.nome}</span>
                <span className="nx-titolo alm-mese-num" aria-hidden="true">{i + 1}</span>
                <span className="alm-mese-ic" aria-hidden="true">{info.ic}</span>
                <span className="nx-nome">{m}</span>
                <span className="nx-meta">{i + 1}º mese · 20 giorni</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ════════ SEZIONE 2 — LE VIE DEL MONDO (semplificato) ════════ */}
      <section id="alm-viaggio" className="alm-section" aria-label="Le Vie del Mondo">
        <div className="gl-sezlabel">Sezione II · Sistema di Viaggio</div>
        <header className="nx-testata alm-testata">
          <h2 className="nx-titolo">🜂 Le Vie del Mondo</h2>
          <p className="nx-sotto alm-lead">
            Tre passi e via. <strong>Ogni giocatore sceglie una classe di viaggio</strong> e fa
            <strong> un solo tiro</strong>; si contano i successi per capire com'è andata; poi
            <strong> il Master tira un d100</strong> e il destino decide cosa capita sulla strada.
          </p>
        </header>

        {/* ── RECAP LAMPO — tre passi ── */}
        <div className="nx-pannello alm-recap">
          <span className="nx-tag">⚡ In due parole</span>
          <ol className="alm-recap-steps">
            {RECAP.map((r, i) => (
              <li key={i}>
                <span className="orb" aria-hidden="true">{i + 1}</span>
                <span className="alm-recap-ic" aria-hidden="true">{r.ic}</span>
                <span className="alm-recap-txt"><b>{r.k}</b> {r.t}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── LO SPECCHIETTO DEI TIRI ── */}
        <div id="alm-tiri" className="nx-pannello alm-tiri" aria-label="Chi tira e cosa">
          <h3 className="alm-block-title"><span className="orb" aria-hidden="true">🎲</span> Chi tira e cosa</h3>
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
                    <span className="nx-pillola alm-tiri-badge">{tag.label}</span>
                  </span>
                  <span className="alm-tiri-cell" data-label="Quando">{t.quando}</span>
                  <span className="alm-tiri-cell alm-tiri-dado" data-label="Cosa tira">{t.tiro}</span>
                  <span className="alm-tiri-cell" data-label="A cosa serve">{t.scopo}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 1 · LE CLASSI DI VIAGGIO ── */}
        <div id="alm-classi" className="alm-block alm-block--nudo">
          <h3 className="alm-block-title"><span className="orb">1</span> Le Classi di Viaggio — una a testa</h3>
          <p className="nx-prosa alm-block-note">
            All'inizio del viaggio <strong>ogni giocatore sceglie una classe</strong> (una per persona,
            si può cambiare al viaggio successivo). Poi fa <strong>un solo tiro</strong> con l'abilità
            della classe, <strong>CD {CD_VIAGGIO}</strong>. Che riesca o fallisca, quel risultato diventa
            un pezzo della scena: così nessuno resta a guardare.
          </p>
          <div className="nx-griglia nx-griglia--larga alm-roles">
            {CLASSI.map((r) => (
              <div key={r.nome} className="nx-pannello alm-role" style={{ "--r-color": r.color }}>
                <div className="alm-role-head">
                  <span className="alm-role-ic" aria-hidden="true">{r.ic}</span>
                  <span className="nx-nome alm-role-name">{r.nome}</span>
                </div>
                <span className="nx-pillola alm-role-skill">tira: {r.ab} · CD {CD_VIAGGIO}</span>
                <p className="nx-nota alm-role-cosa">{r.cosa}</p>
                <p className="alm-role-ok"><span aria-hidden="true">✓ Riesce</span> — {r.ok}</p>
                <p className="alm-role-ko"><span aria-hidden="true">✗ Fallisce</span> — {r.ko}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2 · L'ESITO DEL GRUPPO ── */}
        <div className="nx-pannello alm-block">
          <h3 className="alm-block-title"><span className="orb">2</span> L'esito del gruppo — com'è andata?</h3>
          <p className="nx-prosa alm-block-note">
            Si contano i <strong>successi</strong> e i <strong>fallimenti</strong> di tutti. L'esito
            sposta il d100 del Master: <strong>più è alto, meglio va</strong>. Un viaggio benedetto
            allontana i guai; un disastro li chiama.
          </p>
          <ol className="alm-esiti">
            {ESITI.map((e) => (
              <li key={e.key} className="alm-esito" style={{ "--e-col": e.col }}>
                <span className="alm-esito-ic" aria-hidden="true">{e.ic}</span>
                <span className="alm-esito-nome">{e.label}</span>
                <span className="alm-esito-quando">{e.quando}</span>
                <span className="alm-esito-mod">{e.mod > 0 ? `+${e.mod}` : e.mod === 0 ? "±0" : e.mod} al d100</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 3 · IL D100 DEL MASTER ── */}
        <div className="nx-pannello alm-block">
          <h3 className="alm-block-title"><span className="orb">3</span> Il d100 del Master — la Tavola del Destino</h3>
          <p className="nx-prosa alm-block-note">
            Il Master tira <strong>1d100</strong>, somma l'esito del gruppo e legge la voce sulla sua
            Tavola: <strong>cento cose diverse</strong> che possono capitare, mescolate — nemici,
            effetti dell'ambiente, incontri, scoperte, momenti di personaggio, sventure e fortune.
            Dall'1 (il peggio) al 100 (il meglio). {isMaster ? "La Tavola è qui sotto, solo per te." : "La Tavola la conosce solo il Master: voi scoprite cosa esce."}
          </p>
          {!isMaster && (
            <p className="alm-callout alm-callout--lock">
              <strong>🔒 Riservato al Master.</strong> La Tavola del Destino non si sbircia: tirate bene,
              e il destino sarà gentile.
            </p>
          )}
        </div>

        {/* ── LA TAVOLA DEL DESTINO — SOLO MASTER ── */}
        {isMaster && (
          <div id="alm-tavola" className="nx-pannello alm-block alm-tavola" aria-label="La Tavola del Destino (solo Master)">
            <span className="nx-tag">🎯 Solo Master</span>
            <h3 className="alm-block-title"><span className="orb orb--warn">d100</span> La Tavola del Destino</h3>

            {/* il banco del tiro */}
            <div className="alm-banco">
              <div className="alm-banco-esiti" role="group" aria-label="Esito del gruppo">
                {ESITI.map((e) => (
                  <button key={e.key} type="button" className={`alm-banco-esito${esito === e.key ? " on" : ""}`} style={{ "--e-col": e.col }} onClick={() => setEsito(e.key)}>
                    <span aria-hidden="true">{e.ic}</span> {e.label} <small>{e.mod > 0 ? `+${e.mod}` : e.mod === 0 ? "±0" : e.mod}</small>
                  </button>
                ))}
              </div>
              <div className="alm-banco-tiro">
                <button type="button" className="cta alm-banco-btn" onClick={tiraD100} disabled={rotola}>
                  {rotola ? "…rotola" : "Tira il d100"}
                </button>
                <div className={`alm-banco-ris${rotola ? " rotola" : ""}`} aria-live="polite">
                  {tiro ? (
                    <>
                      <b>{tiro.tot}</b>
                      <small>d100 {tiro.nat}{mod ? ` ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}` : ""}</small>
                    </>
                  ) : (
                    <small>tira e leggi la voce</small>
                  )}
                </div>
              </div>
              {tiro && !tiro.finto && (
                <p className="alm-banco-esito-txt" style={{ "--e-col": CAT[TAVOLA[tiro.tot - 1].cat].col }}>
                  <span aria-hidden="true">{CAT[TAVOLA[tiro.tot - 1].cat].ic}</span>
                  <b>{tiro.tot} · {CAT[TAVOLA[tiro.tot - 1].cat].nome}.</b> {TAVOLA[tiro.tot - 1].testo}
                </p>
              )}
            </div>

            {/* filtro per categoria */}
            <div className="nx-pillole alm-tavola-filtri" aria-label="Filtra per tipo">
              <button type="button" className={`nx-pillola${!mostra ? " on" : ""}`} onClick={() => setMostra(null)}>Tutte · 100</button>
              {Object.entries(CAT).map(([k, c]) => (
                <button key={k} type="button" className={`nx-pillola${mostra === k ? " on" : ""}`} style={{ "--e-col": c.col }} onClick={() => setMostra(mostra === k ? null : k)}>
                  <span aria-hidden="true">{c.ic}</span> {c.nome} · {conteggi[k]}
                </button>
              ))}
            </div>

            {/* le cento voci */}
            <ol className="alm-tavola-righe">
              {righe.map((r) => {
                const c = CAT[r.cat];
                const hit = tiro && !tiro.finto && tiro.tot === r.n;
                return (
                  <li
                    key={r.n}
                    ref={(el) => { righeRef.current[r.n] = el; }}
                    className={`alm-riga${hit ? " is-hit" : ""}`}
                    style={{ "--e-col": c.col }}
                  >
                    <span className="alm-riga-n">{String(r.n).padStart(2, "0")}</span>
                    <span className="alm-riga-cat" title={c.nome} aria-label={c.nome}>{c.ic}</span>
                    <span className="alm-riga-txt">{r.testo}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* La Scala dello Sfinimento (richiamata da alcune voci) */}
        <div className="nx-pannello alm-block">
          <h3 className="alm-block-title"><span className="orb orb--warn">⚠</span> La Scala dello Sfinimento</h3>
          <p className="nx-prosa alm-block-note">
            Alcune sventure della strada danno livelli di <strong>Sfinimento</strong>. Gli effetti sono
            <strong> cumulativi</strong>: chi è al livello 3 subisce anche quelli dell'1 e del 2. Un
            <strong> riposo lungo</strong> con cibo e acqua a sufficienza toglie <strong>1 livello</strong>.
          </p>
          <ol className="alm-sfin">
            {SFINIMENTO.map((s) => (
              <li key={s.lv} className={`alm-sfin-row${s.lv === 6 ? " is-death" : ""}`} style={{ "--sf": s.col }}>
                <span className="orb alm-sfin-lv">{s.lv}</span>
                <span className="alm-sfin-eff">{s.eff}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* In breve */}
        <div className="nx-pannello alm-block alm-quick">
          <h3 className="alm-block-title"><span className="orb">★</span> In breve: un viaggio</h3>
          <ol className="alm-quick-steps">
            <li>Ognuno sceglie la sua classe di viaggio</li>
            <li>Un solo tiro a testa con l'abilità della classe (CD {CD_VIAGGIO})</li>
            <li>Si contano successi e fallimenti → esito del gruppo</li>
            <li>Il Master tira 1d100 + esito sulla Tavola del Destino</li>
            <li>Si gioca la scena, poi si arriva</li>
          </ol>
        </div>
      </section>
    </section>
  );
}
