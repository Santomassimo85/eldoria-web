import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
      { name: "Kael & Mora",                 race: "Hexblood",                class: "??", image: "/assets/player/.png" }, 
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

/* ── Eroe = pannello del Nesso con anello-ritratto (tap → scheda) ── */
function RosterEntry({ hero, tag, onOpen }) {
  return (
    <button type="button" className="nx-pannello nx-pannello--tap eroe-card" onClick={onOpen}>
      <span className="nx-tag">{tag}</span>
      <span className="nx-anello">
        <img
          src={hero.image}
          alt={hero.name}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
      </span>
      <span className="nx-nome">{hero.name}</span>
      <span className="nx-meta">{hero.race} · {hero.class}</span>
      <span className="eroe-cue" aria-hidden="true">Scheda ›</span>
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
          <span className="nx-pillola on eroe-livello">Livello {level}</span>
        )}

        <div className="nx-meta-box">
          <p><strong>Razza</strong> {race || "—"}</p>
          <p><strong>Classe</strong> {klass || "—"}</p>
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
                  <span key={key} className="nx-pillola eroe-ability">
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
        tagline="Quattro compagnie. Sedici anime. Una sola leggenda che si scrive, notte dopo notte, sulle pietre di Exanthia."
        actions={<a href="#party-index" className="gl-cta">✦ Sfoglia il registro</a>}
      />

      {/* ── INDICE DELLE CASATE: pillole-satellite (filtro) ── */}
      <div id="party-index" className="party-index">
        <div className="nx-pillole" role="tablist">
          <button
            type="button"
            className={`nx-pillola ${activeParty === "all" ? "on" : ""}`}
            onClick={() => setActiveParty("all")}
          >
            ✦ Tutte
          </button>
          {PARTIES.map((p) => (
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
