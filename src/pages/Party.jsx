import React, { useMemo, useState } from "react";
import "./Party.css";
import "../styles/cinematic.css";
import useParallaxScroll from "../hooks/useParallaxScroll";
import AmbientFX from "../components/AmbientFX";
import CineToolbar from "../components/CineToolbar";

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
      { name: "Caius",   race: "Elfo",       class: "Mago",      image: "/assets/player/Caius.jpg" },
      { name: "Garroth", race: "Mezz'Elfo",  class: "Ranger",    image: "/assets/player/Garroth.jpg" },
      { name: "Tanagar", race: "Mezz'Orco",  class: "Guerriero", image: "/assets/player/Tanagar.jpg" },
      { name: "Sylva",   race: "Umana",      class: "Barbaro",   image: "/assets/player/Sylva.png" },
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
      // { name: "Roynot",                 race: "Umano",                 class: "Druido",   image: "/assets/player/Roynot.jpg",          hidden: true },
      { name: "Dante",                  race: "Umano V.",              class: "Ladro",    image: "/assets/player/Dante.png" },
      // { name: "Vyger",                  race: "Umano",                 class: "Mago",     image: "/assets/player/Vyger.png",           hidden: true },
      { name: "Temistocle Sottocolle",  race: "Halfling piede lesto",  class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
      { name: "Timoty Bevibotte",       race: "Lightfoot Halfling",    class: "Ladro",    image: "/assets/player/timotyBevibotte.jpeg" },
      { name: "Alaric Voltasorte",      race: "Halfling",                   class: "Warlock",      image: "/assets/player/alaric.png" },
      { name: "Daga",                   race: "Satiro",                class: "???",      image: "/assets/player/daga.jpeg" },
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

/* ── Hero card ─────────────────────────────────────────────── */
function HeroCard({ hero, accent }) {
  return (
    <div
      className="hero-card"
      style={{ "--accent": accent }}
    >
      <div className="hero-card-photo">
        <img
          src={hero.image}
          alt={hero.name}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = "/assets/placeholder.jpg"; }}
        />
        <span className="hero-card-shade" aria-hidden="true" />
      </div>

      <div className="hero-card-plate">
        <h3 className="hero-card-name">{hero.name}</h3>
        <p className="hero-card-meta">
          <span>{hero.race}</span>
          <span className="dot">·</span>
          <span>{hero.class}</span>
        </p>
      </div>
    </div>
  );
}

/* ── Party divider (scrollytell) + grid ────────────────────── */
function PartySection({ party, query = "" }) {
  const q = query.trim().toLowerCase();
  const visibleMembers = party.members
    .filter((m) => !m.hidden)
    .filter((m) => !q || [m.name, m.race, m.class, party.id, party.name]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
  if (visibleMembers.length === 0) return null;
  return (
    <div className="party-faction" style={{ "--party-color": party.color }} data-id={party.id}>
      <section id={`party-${party.id}`} className="cine-scrolly cine-scrolly--short" aria-label={party.name}>
        <div className="cine-scrolly-media" aria-hidden="true">
          <img src={party.divider} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-scrolly-bottom-fade" aria-hidden="true" />
        </div>
        <div className="cine-scrolly-content">
          <div className="cine-scrolly-frame party-frame">
            <span className="party-crest" style={{ "--accent": party.color }}>
              <span className="party-crest-letter">{party.code}</span>
            </span>
            <span className="cine-scrolly-eyebrow">Casata di Exanthia · {party.id}</span>
            <h2 className="cine-scrolly-title">{party.name}</h2>
            <p className="cine-scrolly-text">«{party.motto}»</p>
            <p className="party-count-chip">{visibleMembers.length} {visibleMembers.length === 1 ? "Eroe" : "Eroi"}</p>
          </div>
        </div>
      </section>

      <div className="cine-wrap cine-wrap--wide">
        <div className="hero-grid">
          {visibleMembers.map((m) => (
            <HeroCard key={m.name} hero={m} accent={party.color} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function Party() {
  const [activeParty, setActiveParty] = useState("all");
  const [query, setQuery] = useState("");
  useParallaxScroll();

  const allMembers = useMemo(
    () => PARTIES.flatMap((p) => p.members.filter((m) => !m.hidden).map((m) => ({ ...m, party: p.id }))),
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

  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleParties.reduce((n, p) => n + p.members
      .filter((m) => !m.hidden)
      .filter((m) => !q || [m.name, m.race, m.class, p.id, p.name].filter(Boolean).join(" ").toLowerCase().includes(q))
      .length, 0);
  }, [visibleParties, query]);

  return (
    <section className="cine-page party-page cine-compact" style={{ "--cine-accent": "#a83232", "--cine-accent-2": "#c0392b" }}>
      <AmbientFX variant="leaves" />

      {/* ── HERO ── */}
      <section id="party-top" className="cine-hero" aria-label="Le Compagnie di Exanthia">
        <div className="cine-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-hero-vignette" />
          <div className="cine-hero-gradient" />
          <div className="cine-hero-pattern" />
        </div>
        <div className="cine-hero-content">
          <span className="cine-eyebrow">Sangue · Inchiostro · Avventura</span>
          <h1 className="cine-hero-title">Le Compagnie di Exanthia</h1>
          <p className="cine-hero-tagline">
            Quattro compagnie. Sedici anime. Una sola leggenda che si scrive,
            notte dopo notte, sulle pietre di Exanthia.
          </p>
          <div className="cine-hero-meta">
            <span className="cine-pill">⚔ {stats.parties} compagnie</span>
            <span className="cine-pill">🛡 {stats.heroes} eroi</span>
            <span className="cine-pill cine-pill--accent">✦ {stats.classes} classi</span>
          </div>
        </div>
        <div className="cine-hero-scroll-hint" aria-hidden="true">
          <span>Scorri</span>
          <span className="cine-hero-arrow">↓</span>
        </div>
      </section>

      {/* ── FACTION TABS ── */}
      <div className="cine-wrap">
        <div className="party-tabs" role="tablist">
          <button
            type="button"
            className={`party-tab ${activeParty === "all" ? "on" : ""}`}
            onClick={() => setActiveParty("all")}
          >
            ✦ Tutte le Compagnie
          </button>
          {PARTIES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`party-tab ${activeParty === p.id ? "on" : ""}`}
              onClick={() => setActiveParty(p.id)}
              style={{ "--tab-color": p.color }}
            >
              <span className="party-tab-dot" />
              {p.id}
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

      {/* ── PARTY SECTIONS ── */}
      <div className="party-list">
        {matchCount === 0 ? (
          <p className="cine-empty">Nessun eroe corrisponde alla ricerca.</p>
        ) : (
          visibleParties.map((p) => (
            <PartySection key={p.id} party={p} query={query} />
          ))
        )}
      </div>
    </section>
  );
}
