import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Party.css";
import "../styles/cinematic.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";
import { isHiddenName, isHiddenChar } from "../data/hiddenPlayers";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/La_cessione_dell_anello.png";

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
      // ex-membri usciti: Dante, Timoty Bevibotte, Daga · storici nascosti: Roynot, Vyger
      { name: "Makenna",                race: "Changeling",            class: "Ladro",    image: "/assets/player/Makenna.jpeg" },
      { name: "Temistocle Sottocolle",  race: "Halfling piede lesto",  class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
      { name: "Alaric Voltasorte",      race: "Halfling",              class: "Warlock", image: "/assets/player/alaric.png" },
      { name: "Lael",                   race: "Alto Elfo",             class: "Mago",     image: "/assets/player/lael.jpg" },
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
      { name: "Zethir",           race: "Shadar-Kai", class: "Paladino", image: "/assets/player/Zethir.jpeg" },
      { name: "Aksel",            race: "Umano",      class: "Arcane Sniper", image: "/assets/player/Aksel.png" },
      { name: "Dago",             race: "Umano",      class: "Ladro",    image: "/assets/player/dago.jpeg" },
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
  // Compagnia di Leaf
  "Soran": "",
  "Zethir": "",
  "Aksel": "",
  "Dago": "",
};

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

/* ── Voce di registro: medaglione + nome + razza·classe (tap → scheda) ── */
function RosterEntry({ hero, accent, onOpen }) {
  return (
    <button type="button" className="roster-entry" style={{ "--accent": accent }} onClick={onOpen}>
      <span className="roster-medallion">
        <img
          src={hero.image}
          alt={hero.name}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
      </span>
      <span className="roster-entry-body">
        <span className="roster-entry-name">{hero.name}</span>
        <span className="roster-entry-meta">
          <span>{hero.race}</span>
          <span className="dot">·</span>
          <span>{hero.class}</span>
        </span>
      </span>
      <span className="roster-entry-cue" aria-hidden="true">Scheda ›</span>
    </button>
  );
}

/* ── Scheda-pergamena del singolo eroe (modale) ── */
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
    <div className="hero-modal-overlay" onClick={onClose}>
      <div
        className="hero-modal"
        role="dialog"
        aria-modal="true"
        style={{ "--accent": party.color }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="hero-modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        <img
          className="hero-modal-img"
          src={hero.image}
          alt={hero.name}
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
        <span className="hero-modal-house">
          <span className="hero-modal-house-crest">{party.code}</span>
          {party.name}
        </span>
        <h3 className="hero-modal-name">{hero.name}</h3>
        {Number.isFinite(level) && (
          <span className="hero-modal-level">Livello {level}</span>
        )}

        <div className="hero-modal-meta">
          <p><strong>Razza</strong> {race || "—"}</p>
          <p><strong>Classe</strong> {klass || "—"}</p>
          {subclass && <p><strong>Sottoclasse</strong> {subclass}</p>}
          {background && <p><strong>Origine</strong> {background}</p>}
        </div>

        {/* Statistiche dal foglio personaggio */}
        {st && (
          <div className="hero-modal-sheet">
            <div className="hero-modal-vitals">
              {Number.isFinite(st.hp ?? st.maxHp) && (
                <span className="hero-vital"><b>{st.hp ?? st.maxHp}</b><i>PF</i></span>
              )}
              {Number.isFinite(st.ac) && (
                <span className="hero-vital"><b>{st.ac}</b><i>CA</i></span>
              )}
              {Number.isFinite(st.speed) && (
                <span className="hero-vital"><b>{st.speed}</b><i>Vel.</i></span>
              )}
            </div>
            <div className="hero-modal-abilities">
              {ABILITY_LABELS.map(([key, label]) => {
                const a = st[key];
                if (!a || !Number.isFinite(a.score)) return null;
                const mod = Number.isFinite(a.mod) ? a.mod : Math.floor((a.score - 10) / 2);
                return (
                  <span key={key} className="hero-ability">
                    <i>{label}</i>
                    <b>{a.score}</b>
                    <em>{mod >= 0 ? `+${mod}` : mod}</em>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Biografia (riempibile in HERO_BIOS) */}
        {bioParas.length > 0 && (
          <div className="hero-modal-bio">
            <span className="hero-modal-bio-label">Biografia</span>
            {bioParas.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}

        <p className="hero-modal-motto"><em>«{party.motto}»</em></p>
      </div>
    </div>
  );
}

/* ── Casata = doppia pagina di manoscritto: marginalia + registro ── */
function HouseSection({ party, query, charByName, focusHero, onFocusConsumed }) {
  const [openIdx, setOpenIdx] = useState(null);
  const visibleMembers = membersFor(party, query);

  // Apertura automatica della scheda quando si arriva da un link (?hero=…)
  useEffect(() => {
    if (!focusHero) return;
    const idx = visibleMembers.findIndex((m) => firstTok(m.name) === firstTok(focusHero));
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
    <section id={`party-${party.id}`} className="party-house" style={{ "--party-color": party.color }} data-id={party.id}>
      {/* marginalia sticky */}
      <aside className="party-house-aside">
        <span className="party-crest" style={{ "--accent": party.color }}>
          <span className="party-crest-letter">{party.code}</span>
        </span>
        <span className="party-house-code">Casata · {party.id}</span>
        <p className="party-house-motto">«{party.motto}»</p>
        <span className="party-count-chip">
          {visibleMembers.length} {visibleMembers.length === 1 ? "Eroe" : "Eroi"}
        </span>
      </aside>

      {/* registro degli eroi */}
      <div className="party-roster">
        <div className="party-roster-rubric">
          <h2 className="party-roster-title">{party.name}</h2>
        </div>
        <div className="roster-list">
          {visibleMembers.map((m, i) => (
            <RosterEntry key={m.name} hero={m} accent={party.color} onOpen={() => setOpenIdx(i)} />
          ))}
        </div>
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
    () => PARTIES.flatMap((p) => p.members.filter((m) => !m.hidden && !isHiddenName(m.name)).map((m) => ({ ...m, party: p.id }))),
    []
  );

  const stats = useMemo(() => ({
    parties: PARTIES.length,
    heroes:  allMembers.length,
    races:   new Set(allMembers.map((m) => m.race)).size,
    classes: new Set(allMembers.map((m) => m.class)).size,
  }), [allMembers]);

  const visibleParties = useMemo(
    () => activeParty === "all" ? PARTIES : PARTIES.filter((p) => p.id === activeParty),
    [activeParty]
  );

  const matchCount = useMemo(
    () => visibleParties.reduce((n, p) => n + membersFor(p, query).length, 0),
    [visibleParties, query]
  );

  return (
    <section className="cine-page party-page cine-compact" style={{ "--cine-accent": "#a83232", "--cine-accent-2": "#c0392b" }}>
      <AmbientFX variant="leaves" />

      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-registro a sinistra ── */}
      <section id="party-top" className="party-hero" aria-label="Le Compagnie di Exanthia">
        <div className="party-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="party-hero-wash" aria-hidden="true" />
        <div className="party-hero-plate">
          <span className="party-hero-seal">✦ Registro delle Compagnie</span>
          <h1 className="party-hero-title">Le Compagnie<br />di Exanthia</h1>
          <p className="party-hero-tagline">
            Quattro compagnie. Sedici anime. Una sola leggenda che si scrive,
            notte dopo notte, sulle pietre di Exanthia.
          </p>
          <dl className="party-hero-stats">
            <div><dt>Compagnie</dt><dd>{stats.parties}</dd></div>
            <div><dt>Eroi</dt><dd>{stats.heroes}</dd></div>
            <div><dt>Classi</dt><dd>{stats.classes}</dd></div>
            <div><dt>Razze</dt><dd>{stats.races}</dd></div>
          </dl>
        </div>
        <a href="#party-index" className="party-hero-scroll" aria-label="Scorri al registro">
          <span className="party-hero-scroll-tx">Scorri</span>
          <span className="party-hero-scroll-ic" aria-hidden="true">↓</span>
        </a>
      </section>

      {/* ── INDICE DELLE CASATE: sigilli araldici (filtro) ── */}
      <div id="party-index" className="party-index">
        <span className="party-index-eyebrow">Indice · Le Casate di Exanthia</span>
        <div className="party-index-sigils" role="tablist">
          <button
            type="button"
            className={`party-sigil party-sigil--all ${activeParty === "all" ? "on" : ""}`}
            onClick={() => setActiveParty("all")}
          >
            <span className="party-sigil-crest">✦</span>
            <span className="party-sigil-label">Tutte</span>
          </button>
          {PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`party-sigil ${activeParty === p.id ? "on" : ""}`}
              onClick={() => setActiveParty(p.id)}
              style={{ "--accent": p.color }}
            >
              <span className="party-sigil-crest">{p.code}</span>
              <span className="party-sigil-label">{p.id}</span>
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
      <div className="party-list">
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
