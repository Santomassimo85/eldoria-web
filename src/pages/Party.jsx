import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { classColor } from "../utils/classColor";
import "./Party.css";
import "../styles/cinematic.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import GlacierHero from "../components/glacier/GlacierHero";
import { isHiddenName, isHiddenChar } from "../data/hiddenPlayers";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/La_cessione_dell_anello.png";
/* numeri in lettere per la tagline del varco (1–20). */
const NUM_IT = ["Zero", "Una", "Due", "Tre", "Quattro", "Cinque", "Sei", "Sette", "Otto", "Nove", "Dieci", "Undici", "Dodici", "Tredici", "Quattordici", "Quindici", "Sedici", "Diciassette", "Diciotto", "Diciannove", "Venti"];

/* ── Party data — kept in one structure so we can render statistics ── */
const PARTIES = [
  {
    id: "AMEA",
    name: "Compagnia di Amea",
    code: "A",
    color: "#c0392b",
    divider: "/assets/PhotoStory/GruppoMEAA/SylvaBerserk.png",
    motto: "Il fuoco non chiede permesso",
    members: [
      { name: "Caius",   race: "Elfo",       class: "Mago",      image: "/assets/player/caius2.jpeg" },
      { name: "Garroth", race: "Mezz'Elfo",  class: "Ranger",    image: "/assets/player/garroth2.png" },
      { name: "Tanagar", race: "Mezz'Orco",  class: "Guerriero", image: "/assets/player/Tanagar2.png" },
    ],
  },
  {
    id: "LAC",
    name: "Compagnia di Lac",
    code: "L",
    color: "#2980b9",
    divider: "/assets/PhotoStory/GruppoMEAA/Krag-Dor.jpg",
    motto: "Le acque profonde non temono il vento",
    members: [
      { name: "Horn",    race: "Umano",    class: "Ranger", image: "/assets/player/Horn.jpg" },
      { name: "Thoki",   race: "Gnomo",    class: "Mago",   image: "/assets/player/Thoki.jpg" },
      { name: "Cleofe",  race: "Halfling", class: "Ladro",  image: "/assets/player/Cleofe.jpg" },
    ],
  },
  {
    id: "ENOX",
    name: "Compagnia di Enox",
    code: "E",
    color: "#8e44ad",
    divider: "/assets/PhotoStory/GruppoMEAA/cultista.png",
    motto: "Nel buio si forgiano i nomi più luminosi",
    members: [
      // ex-membri usciti: Dante, Timoty Bevibotte, Daga, Alaric · storici nascosti: Roynot, Vyger
      { name: "Makenna",                race: "Changeling",            class: "Ladro",    image: "/assets/player/Makenna.jpeg" },
      { name: "Temistocle Sottocolle",  race: "Halfling piede lesto",  class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
      { name: "Lael",                   race: "Alto Elfo",             class: "Mago",     image: "/assets/player/lael.jpg" },
      { name: "Palar",                  race: "Dragonide (Ametista)",  class: "Paladino", image: "/assets/player/palar.webp" },
      { name: "Kael & Mora",            race: "Hexblood",              class: "??",       image: "/assets/player/.png" },
      { name: "Zareth",                 race: "Umano",                 class: "Guerriero", image: "" },
    ],
  },
  {
    id: "LEAF",
    name: "Compagnia di Leaf",
    code: "F",
    color: "#27ae60",
    divider: "/assets/PhotoStory/GruppoLEAF/soranSong.png",
    motto: "Dove cade la foglia, nasce la rotta",
    members: [
      // { name: "Taaras Stormrage", race: "Mezz'Elfo",  class: "Chierico", image: "/assets/player/TaarasStormrage.png" },
      { name: "Soran",            race: "Umano",      class: "Bardo",    image: "/assets/player/Soran.png" },
      { name: "Zethir",           race: "Shadar-Kai", class: "Paladino", image: "/assets/player/Zethir.jpeg?v=2" },
      { name: "Aksel",            race: "Umano",      class: "Arcane Sniper", image: "/assets/player/Aksel.png" },
      { name: "Dago",             race: "Umano",      class: "Ladro",    image: "/assets/player/dago.jpeg" },
      { name: "Karlberht",        race: "Umano",      class: "Guerriero", image: "/assets/player/Karlberht.jpg" },
    ],
  },
];

/* ── Biografie degli eroi ──────────────────────────────────────────
   Riempile a piacere: la chiave è il `name` del membro in PARTIES.
   Una stringa vuota = nessuna biografia mostrata. Accetta più paragrafi
   separati da una riga vuota (\n\n). */
const HERO_BIOS = {
  // Compagnia di Amea
  "Caius": "",
  "Garroth": "",
  "Tanagar": "",
  // Compagnia di Lac
  "Thoki": "",
  "Cleofe": "",
  // Compagnia di Enox
  "Makenna": "",
  "Temistocle Sottocolle": "",
  "Alaric Voltasorte": "",
  "Lael": "",
  "Palar": "",
  "Zareth": "Il Nero\n\nNella città di Plia, tra i vicoli stretti e le taverne fumose, il sangue e l'oro decidevano il destino degli uomini. Darian aveva dieci anni quando la sua vita cambiò per sempre.\n\nEra una sera tranquilla. Seduto a tavola con suo padre, sua madre e sua sorella, stava cenando mentre fuori il vento soffiava tra le case. Le risate riempivano la stanza e per un momento tutto sembrava perfetto. Poi la porta venne sfondata. Tre uomini armati fecero irruzione nella casa. Non dissero una parola. Non fecero richieste. Vennero soltanto per uccidere.\n\nIl padre di Darian tentò di opporsi, ma fu abbattuto in pochi istanti. Sua madre cercò di proteggere i figli, ma venne colpita senza pietà. Sua sorella provò a fuggire, ma uno degli aggressori la raggiunse prima che potesse mettersi in salvo. Nascosto sotto il tavolo, Darian osservò impotente la strage della sua famiglia. Il terrore lo immobilizzava mentre il sangue si allargava sul pavimento di legno.\n\nQuando i tre assassini si avvicinarono per uccidere anche lui, la porta esplose nuovamente. A entrare fu Morigue. Nelle sue mani brillavano due scimitarre ricurve. Lo zio si lanciò contro gli aggressori con una furia terrificante. Le sue lame danzavano nell'aria come serpenti d'acciaio, fendendo il vuoto con rapidità letale. I tre uomini capirono subito che non avrebbero avuto vita facile e, approfittando della confusione, si ritirarono fuggendo nella notte.\n\nQuando il silenzio tornò nella casa, tutto ciò che rimaneva della famiglia di Darian erano i corpi senza vita sul pavimento. Morigue era il fratello del padre del ragazzo e uno dei capi banda dei bassifondi di Plia. Negli anni aveva accumulato numerosi nemici nel tentativo di espandere il proprio potere. Secondo lui quel massacro non era stato casuale. Non volevano soltanto fare del male a una famiglia innocente. Volevano colpire lui.\n\nDa quel giorno Morigue prese Darian sotto la sua protezione. Il ragazzo crebbe tra ladri, contrabbandieri e assassini. All'inizio il suo compito era semplice: osservare e ascoltare. Passava le giornate nelle piazze, nei mercati e nelle taverne di Plia, raccogliendo voci e segreti. Nessuno prestava attenzione a un ragazzino che vagava senza meta per la città, ed era proprio questa la sua forza.\n\nPassarono gli anni. Un giorno, mentre attraversava il quartiere del porto, Darian vide un volto che non aveva mai dimenticato. Uno degli uomini che aveva assassinato la sua famiglia. La cicatrice sul viso era inconfondibile. Senza farsi notare iniziò a seguirlo attraverso vicoli e strade sempre più isolate fino a raggiungere un vecchio magazzino abbandonato. Attraverso una finestra sporca vide l'interno dell'edificio e il suo cuore accelerò. Gli altri due assassini erano lì.\n\nPer anni aveva sognato quel momento. Attese fino al calare della notte. Quando il magazzino piombò nel silenzio, si arrampicò attraverso una finestra ed entrò senza fare rumore. Uno degli uomini dormiva con un pugnale infilato alla cintura. Darian lo estrasse lentamente e gli tagliò la gola prima che potesse svegliarsi. Poi raggiunse il secondo, che morì nello stesso silenzio. Il terzo aprì gli occhi appena in tempo per vedere una figura emergere dall'oscurità. Fu l'ultima cosa che vide.\n\nQuando il sole sorse, i tre uomini che avevano sterminato la sua famiglia erano morti.\n\nDarian tornò da Morigue e gli raccontò tutto. Lo zio rimase in silenzio a lungo. Non era impressionato dal fatto che il ragazzo si fosse vendicato. Era impressionato dal modo in cui l'aveva fatto: freddamente, silenziosamente e senza la minima esitazione.\n\nDa quel giorno decise di farne qualcosa di più di un semplice informatore. Fece addestrare Darian dai migliori combattenti che riuscì a trovare e gli insegnò personalmente l'arte delle due scimitarre. Erano le stesse lame che aveva brandito la notte in cui gli aveva salvato la vita. All'inizio Darian cadeva, sbagliava e si feriva continuamente, ma con il passare degli anni le armi divennero un'estensione naturale del suo corpo. I suoi movimenti erano rapidi, eleganti e mortali.\n\nMorigue gli insegnò anche un'altra abilità: il liuto. Un musicista poteva entrare quasi ovunque senza destare sospetti. Palazzi nobiliari, locande, case mercantili e sale da gioco aprivano le porte a chi sapeva intrattenere gli ospiti. Così, mentre gli altri ascoltavano la musica, Darian ascoltava conversazioni. Memorizzava segreti, scopriva tradimenti e individuava obiettivi.\n\nNegli anni successivi divenne l'arma più preziosa di Morigue. Rubava documenti, recuperava informazioni, eliminava rivali e si infiltrava nelle organizzazioni nemiche. Ogni successo aumentava il potere della banda. Ogni missione accresceva la sua fama.\n\nLe persone iniziarono a raccontare storie su una figura vestita di nero che compariva dal nulla e spariva come un fantasma. Si diceva che nessuna serratura potesse fermarlo, che nessuna guardia riuscisse a vederlo arrivare e che le sue due scimitarre apparissero nell'oscurità un istante prima della morte.\n\nBen presto il suo vero nome venne dimenticato da molti. Nei vicoli di Plia, nelle taverne malfamate e nei covi della criminalità tutti lo chiamavano nello stesso modo.\n\nIl Nero.\n\nOltre Plia\n\nQuindici anni erano trascorsi dalla notte in cui la famiglia di Darian era stata sterminata.\n\nIn quel tempo molte cose erano cambiate.\n\nLa banda di Morigue, un tempo poco più di un gruppo di criminali dei bassifondi, era cresciuta fino a diventare una delle organizzazioni più influenti di tutta Plia. I mercanti pagavano per la sua protezione, le guardie cittadine chiudevano spesso un occhio davanti ai suoi affari e persino alcune famiglie nobili preferivano trattare con lui piuttosto che averlo come nemico.\n\nMorigue era riuscito dove molti avevano fallito.\n\nAveva costruito un impero.\n\nE gran parte di quel successo era dovuto a Darian.\n\nOvunque si sussurrava il nome del Nero. Le storie sul suo conto erano diventate leggenda. Alcuni sostenevano che fosse in grado di attraversare una fortezza senza essere visto. Altri giuravano che potesse comparire alle spalle di un uomo senza produrre alcun rumore. La verità era più semplice: Darian era diventato talmente bravo nel suo lavoro da sembrare qualcosa di sovrannaturale.\n\nEppure, nonostante il potere, la ricchezza e il rispetto che si era conquistato, qualcosa continuava a tormentarlo.\n\nPlia.\n\nOgni strada della città gli ricordava il passato.\n\nOgni vicolo custodiva un ricordo.\n\nOgni quartiere gli riportava alla mente la notte in cui aveva perso tutto.\n\nA volte si ritrovava davanti alla vecchia casa della sua famiglia senza nemmeno rendersene conto. Rimaneva là in silenzio, osservando l'edificio ormai abbandonato mentre i fantasmi della sua infanzia tornavano a tormentarlo.\n\nLa vendetta aveva placato la sua rabbia.\n\nMa non aveva guarito le sue ferite.\n\nUna sera, mentre il sole tramontava dietro le mura della città, Darian raggiunse la dimora di Morigue.\n\nLo trovò nel suo studio.\n\nLo zio era seduto dietro una pesante scrivania di legno scuro. Le due scimitarre che lo avevano reso famoso erano appese alla parete alle sue spalle.\n\nMorigue sollevò lo sguardo.\n\nHai quell'espressione da diversi mesi.\n\nDarian rimase in piedi davanti a lui.\n\nQuale espressione?\n\nQuella di un uomo che non riesce più a respirare dove si trova.\n\nPer qualche istante nessuno parlò.\n\nAlla fine Darian sospirò. Voglio andarmene per un po'.\n\nMorigue non sembrò sorpreso.\n\nDa Plia?\n\nDa tutto questo.\n\nLo zio intrecciò le dita e lo osservò attentamente.\n\nSei stanco?\n\nNo.\n\nSei deluso?\n\nNo.\n\nAllora cos'è?\n\nDarian si avvicinò alla finestra.\n\nFuori, la città brillava sotto le luci delle torce.\n\nHo passato la mia vita a percorrere queste strade. Conosco ogni vicolo, ogni tetto e ogni segreto di questa città. Ma ogni volta che guardo Plia vedo ancora quella casa. Vedo ancora mia madre, mio padre e mia sorella.\n\nMorigue abbassò lo sguardo.\n\nEra raro sentir parlare Darian della sua famiglia.\n\nLa città è diventata una prigione continuò il giovane. Non fatta di mura. Di ricordi.\n\nIl vecchio capo banda rimase in silenzio per alcuni istanti.\n\nPoi annuì.\n\nAllora parti.\n\nDarian si voltò sorpreso.\n\nCosì facilmente?\n\nMorigue lasciò sfuggire una breve risata.\n\nTi avrei fermato anni fa. Ma ormai non sei più un ragazzo che ha bisogno di essere protetto.\n\nLo zio si alzò e si avvicinò a lui.\n\nHai servito la nostra organizzazione fedelmente. Hai contribuito a costruire tutto ciò che possediamo. Se credi che questo viaggio sia quello di cui hai bisogno, hai il mio permesso.\n\nLa mattina seguente Darian lasciò Plia.\n\nMentre le mura di Plia sparivano lentamente all'orizzonte, Darian si concesse un ultimo sguardo alla città.\n\nEra il luogo che gli aveva dato tutto.\n\nEd era anche il luogo che gli aveva portato via tutto.\n\nPoi voltò le spalle al passato e proseguì verso terre sconosciute.",
  // Compagnia di Leaf
  "Soran": "",
  "Zethir": "",
  "Aksel": "",
  "Dago": "",
  "Karlberht": "",
};

/* Compagnie con almeno un eroe ATTIVO: quelle svuotate (es. Lac) spariscono
   dal registro senza cancellare i dati — basta riattivare un membro. */
const ACTIVE_PARTIES = PARTIES.filter((p) => p.members.some((m) => !m.hidden && !isHiddenName(m.name)));

/* normalizza un nome per il confronto (minuscolo, apostrofi, spazi). */
const normName = (s) =>
  String(s ?? "").toLowerCase().replace(/[´`’‘ʼ]/g, "'").replace(/\s+/g, " ").trim();
/* prima "parola" del nome — per agganciare l'eroe al suo personaggio Firestore. */
const firstTok = (s) => normName(s).split(/[\s'"\-]+/)[0];

/* abilità mostrate nella scheda (chiave Firestore → etichetta). */
const ABILITY_LABELS = [
  ["str", "FOR"], ["dex", "DES"], ["con", "COS"],
  ["int", "INT"], ["wis", "SAG"], ["cha", "CAR"],
];

/* helper: filtra i membri visibili di una compagnia secondo la query */
function membersFor(party, query) {
  const q = query.trim().toLowerCase();
  return party.members
    .filter((m) => !m.hidden && !isHiddenName(m.name))
    .filter((m) => !q || [m.name, m.race, m.class, party.id, party.name]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
}

/* ── Eroe = pannello del Nesso con anello-ritratto (tap → scheda).
   `hero.locked` = personaggio non ancora sbloccato: nessun ritratto
   (placeholder dell'anello) e scheda non apribile. ── */
function RosterEntry({ hero, tag, onOpen }) {
  const locked = !!hero.locked;
  return (
    <button
      type="button"
      className={`nx-pannello eroe-card ${locked ? "eroe-card--locked" : "nx-pannello--tap"}`}
      style={{ "--cls": classColor(hero.class) }}
      onClick={locked ? undefined : onOpen}
      aria-disabled={locked || undefined}
      title={locked ? "Personaggio non ancora sbloccato" : undefined}
    >
      <span className="nx-tag">{locked ? "🔒" : tag}</span>
      <span className="nx-anello">
        {locked ? (
          <span className="nx-anello-ph" aria-hidden="true">?</span>
        ) : (
          <img
            src={hero.image}
            alt={hero.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
          />
        )}
      </span>
      <span className="nx-nome">{hero.name}</span>
      <span className="nx-meta">{hero.race}</span>
      <span className="eroe-classe">{hero.class}</span>
      <span className="eroe-cue" aria-hidden="true">{locked ? "Non sbloccato" : "Scheda ›"}</span>
    </button>
  );
}

/* ── Scheda eroe = modale-varco del Nesso ── */
function HeroModal({ hero, party, char, onClose }) {
  const bio = (HERO_BIOS[hero.name] || "").trim();
  const bioParas = bio ? bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];

  // Dati "ricchi" presi dal foglio personaggio (se agganciato).
  const race = char?.race || hero.race;
  const klass = char?.class || hero.class;
  const subclass = char?.subclass;
  const background = char?.background;
  const level = char?.level;
  const st = char?.stats || null;

  return (
    <div className="nx-modale-overlay" onClick={onClose}>
      <div
        className="nx-modale eroe-modale"
        style={{ "--cls": classColor(klass) }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="nx-modale-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <img
          className="nx-modale-img"
          src={hero.image}
          alt={hero.name}
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
        <span className="nx-kicker">{party.code} · {party.name}</span>
        <h3 className="nx-titolo">{hero.name}</h3>
        {Number.isFinite(level) && (
          <span className="nx-tag nx-tag--inline eroe-livello">Livello {level}</span>
        )}

        <div className="nx-meta-box">
          <p><strong>Razza</strong> {race || "—"}</p>
          <p><strong>Classe</strong> <span className="eroe-classe eroe-classe--inline">{klass || "—"}</span></p>
          {subclass && <p><strong>Sottoclasse</strong> {subclass}</p>}
          {background && <p><strong>Origine</strong> {background}</p>}
        </div>

        {/* Statistiche dal foglio personaggio */}
        {st && (
          <div className="eroe-sheet">
            <div className="eroe-vitals">
              {Number.isFinite(st.hp ?? st.maxHp) && (
                <span className="eroe-vital"><b>{st.hp ?? st.maxHp}</b><i>PF</i></span>
              )}
              {Number.isFinite(st.ac) && (
                <span className="eroe-vital"><b>{st.ac}</b><i>CA</i></span>
              )}
              {Number.isFinite(st.speed) && (
                <span className="eroe-vital"><b>{st.speed}</b><i>Vel.</i></span>
              )}
            </div>
            <div className="nx-pillole eroe-abilities">
              {ABILITY_LABELS.map(([key, label]) => {
                const a = st[key];
                if (!a || !Number.isFinite(a.score)) return null;
                const mod = Number.isFinite(a.mod) ? a.mod : Math.floor((a.score - 10) / 2);
                return (
                  <span key={key} className="eroe-ability" title={`${label} ${a.score} (${mod >= 0 ? "+" : ""}${mod})`}>
                    <i>{label}</i>
                    <span className="eroe-d20" aria-hidden="true">
                      <svg viewBox="0 0 100 100"><path d="M50 4 92 28v44L50 96 8 72V28z" /><path className="eroe-d20-facce" d="M50 4v18M50 22 92 28M50 22 8 28M50 22 78 66M50 22 22 66M22 66h56M22 66 8 72M78 66l14 6M22 66 50 96M78 66 50 96" /></svg>
                      <b>{a.score}</b>
                    </span>
                    <em>{mod >= 0 ? `+${mod}` : mod}</em>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Biografia (riempibile in HERO_BIOS) */}
        {bioParas.length > 0 && (
          <div className="nx-prosa eroe-bio">
            <span className="nx-kicker">Biografia</span>
            {bioParas.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}

        <p className="nx-citazione">«{party.motto}»</p>
      </div>
    </div>
  );
}

/* ── Casata = etichetta di sezione + griglia di pannelli ── */
function HouseSection({ party, query, charByName, focusHero, onFocusConsumed }) {
  const [openIdx, setOpenIdx] = useState(null);
  const visibleMembers = membersFor(party, query);

  // Apertura automatica della scheda quando si arriva da un link (?hero=…)
  useEffect(() => {
    if (!focusHero) return;
    const idx = visibleMembers.findIndex((m) => !m.locked && firstTok(m.name) === firstTok(focusHero));
    if (idx >= 0) {
      setOpenIdx(idx);
      onFocusConsumed?.();
      const el = document.getElementById(`party-${party.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHero]);

  if (visibleMembers.length === 0) return null;
  const open = openIdx != null ? visibleMembers[openIdx] : null;

  return (
    <section id={`party-${party.id}`} className="casata" data-id={party.id}>
      <div className="gl-sezlabel">{party.code} · {party.name}</div>
      <p className="nx-nota casata-motto">«{party.motto}» · {visibleMembers.length} {visibleMembers.length === 1 ? "eroe" : "eroi"}</p>

      <div className="nx-griglia casata-griglia">
        {visibleMembers.map((m, i) => (
          <RosterEntry key={m.name} hero={m} tag={party.id} onOpen={() => setOpenIdx(i)} />
        ))}
      </div>

      {open && (
        <HeroModal
          hero={open}
          party={party}
          char={charByName?.get(firstTok(open.name)) || null}
          onClose={() => setOpenIdx(null)}
        />
      )}
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function Party() {
  const [activeParty, setActiveParty] = useState("all");
  const [query, setQuery] = useState("");
  const [chars, setChars] = useState([]);
  const [searchParams] = useSearchParams();
  const [focusHero, setFocusHero] = useState(() => searchParams.get("hero") || null);
  useParallaxScroll();

  // Foglio personaggi (lettura pubblica) → dati ricchi nella scheda eroe.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "characters"), (snap) => {
      setChars(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !isHiddenChar(c)));
    }, () => {});
    return () => unsub();
  }, []);

  // Lookup: prima parola del nome → personaggio Firestore.
  const charByName = useMemo(() => {
    const m = new Map();
    for (const c of chars) {
      if (!c.name) continue;
      const key = firstTok(c.name);
      if (key && !m.has(key)) m.set(key, c);
    }
    return m;
  }, [chars]);

  const allMembers = useMemo(
    () => ACTIVE_PARTIES.flatMap((p) => p.members.filter((m) => !m.hidden && !isHiddenName(m.name)).map((m) => ({ ...m, party: p.id }))),
    []
  );

  const stats = useMemo(() => ({
    parties: ACTIVE_PARTIES.length,
    heroes:  allMembers.length,
    races:   new Set(allMembers.map((m) => m.race)).size,
    classes: new Set(allMembers.map((m) => m.class)).size,
  }), [allMembers]);

  const visibleParties = useMemo(
    () => activeParty === "all" ? ACTIVE_PARTIES : ACTIVE_PARTIES.filter((p) => p.id === activeParty),
    [activeParty]
  );

  const matchCount = useMemo(
    () => visibleParties.reduce((n, p) => n + membersFor(p, query).length, 0),
    [visibleParties, query]
  );

  return (
    <section className="cine-page party-page cine-compact" style={{ "--cine-accent": "#a83232", "--cine-accent-2": "#c0392b" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO = VARCO esagonale (nesso.css) ── */}
      <GlacierHero
        id="party-top"
        ariaLabel="Le Compagnie di Exanthia"
        image={HERO_IMAGE}
        imgPos="center 28%"
        eyebrow="Registro Araldico"
        title={<>Le Compagnie<br />di Exanthia</>}
        seal={`${stats.heroes} eroi attivi · ${stats.parties} compagnie`}
        tagline={`${NUM_IT[stats.parties] || stats.parties} compagnie. ${NUM_IT[stats.heroes] || stats.heroes} anime. Una sola leggenda che si scrive, notte dopo notte, sulle pietre di Exanthia.`}
        actions={<a href="#party-index" className="gl-cta">✦ Sfoglia il registro</a>}
      />

      {/* ── INDICE DELLE CASATE: pillole-satellite (filtro) ── */}
      <div id="party-index" className="party-index">
        {/* legenda dei colori di classe */}
        <div className="eroe-legenda" aria-label="Colori delle classi">
          {[...new Set(allMembers.map((m) => m.class).filter((c) => c && c !== "??"))].sort().map((c) => (
            <span key={c} className="eroe-classe" style={{ "--cls": classColor(c) }}>{c}</span>
          ))}
        </div>
        <div className="nx-pillole" role="tablist">
          <button
            type="button"
            className={`nx-pillola ${activeParty === "all" ? "on" : ""}`}
            onClick={() => setActiveParty("all")}
          >
            ✦ Tutte
          </button>
          {ACTIVE_PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`nx-pillola ${activeParty === p.id ? "on" : ""}`}
              onClick={() => setActiveParty(p.id)}
            >
              <b className="party-pill-code">{p.code}</b> {p.id}
            </button>
          ))}
        </div>
      </div>

      {/* ── RICERCA ── */}
      <CineToolbar
        query={query}
        onQuery={setQuery}
        placeholder="Cerca per nome, razza o classe…"
        count={matchCount}
        countNoun={matchCount === 1 ? "eroe" : "eroi"}
      />

      {/* ── CASATE ── */}
      <div className="casate">
        {matchCount === 0 ? (
          <p className="cine-empty">Nessun eroe corrisponde alla ricerca.</p>
        ) : (
          visibleParties.map((p) => (
            <HouseSection
              key={p.id}
              party={p}
              query={query}
              charByName={charByName}
              focusHero={focusHero}
              onFocusConsumed={() => setFocusHero(null)}
            />
          ))
        )}
      </div>
    </section>
  );
}
