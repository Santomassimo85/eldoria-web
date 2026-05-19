import React, { useMemo, useState } from "react";
import "./Party.css";

/* ── Party data — kept in one structure so we can render statistics ── */
const PARTIES = [
  {
    id: "AMEA",
    name: "Compagnia di Amea",
    code: "A",
    color: "#c0392b",
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
    motto: "Nel buio si forgiano i nomi più luminosi",
    members: [
      // { name: "Roynot",                 race: "Umano",                 class: "Druido",   image: "/assets/player/Roynot.jpg",          hidden: true },
      { name: "Dante",                  race: "Umano V.",              class: "Ladro",    image: "/assets/player/Dante.png" },
      // { name: "Vyger",                  race: "Umano",                 class: "Mago",     image: "/assets/player/Vyger.png",           hidden: true },
      { name: "Temistocle Sottocolle",  race: "Halfling piede lesto",  class: "Stregone", image: "/assets/player/Temistocle.jpeg" },
      { name: "Timoty Bevibotte",       race: "Lightfoot Halfling",    class: "Ladro",    image: "/assets/player/timotyBevibotte.jpeg" },
      { name: "Alaric Voltasorte",      race: "Halfling",                   class: "Warlock",      image: "/assets/player/alaric.png" },
    ],
  },
  {
    id: "LEAF",
    name: "Compagnia di Leaf",
    code: "F",
    color: "#27ae60",
    motto: "Dove cade la foglia, nasce la rotta",
    members: [
      { name: "Makenna",          race: "Changeling", class: "Ladro",    image: "/assets/player/Makenna.jpeg" },
      // { name: "Taaras Stormrage", race: "Mezz'Elfo",  class: "Chierico", image: "/assets/player/TaarasStormrage.png" },
      { name: "Soran",            race: "Umano",      class: "Bardo",    image: "/assets/player/Soran.png" },
      { name: "Zethir",           race: "Shadar-Kai", class: "Paladino", image: "/assets/player/Zethir.jpeg" },
    ],
  },
  {
    id: "ECO",
    name: "Compagnia di Eco",
    code: "C",
    color: "#0f766e",
    motto: "Ogni colpo riecheggia nella storia",
    members: [
      { name: "Aksel",            race: "Umano", class: "Arcane Sniper", image: "/assets/player/Aksel.png" },
      { name: "Dago",             race: "Umano", class: "Ladro",      image: "/assets/player/dago.jpeg" },
      { name: "Ismael Van Dyke",  race: "Umano", class: "Artefic",      image: "/assets/player/ismael.jpeg" },
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

/* ── Party banner + grid ───────────────────────────────────── */
function PartySection({ party }) {
  const visibleMembers = party.members.filter((m) => !m.hidden);
  return (
    <section
      className="party-faction"
      style={{ "--party-color": party.color }}
      data-id={party.id}
    >
      <header className="party-banner">
        <div className="party-banner-edge" aria-hidden="true" />

        <div className="party-crest">
          <span className="party-crest-letter">{party.code}</span>
          <span className="party-crest-ring" />
        </div>

        <div className="party-banner-text">
          <p className="party-banner-tag">Casata di Exanthia · {party.id}</p>
          <h2 className="party-banner-name">{party.name}</h2>
          <p className="party-banner-motto">«{party.motto}»</p>
        </div>

        <div className="party-banner-count" title={`${visibleMembers.length} eroi`}>
          <strong>{visibleMembers.length}</strong>
          <span>Eroi</span>
        </div>
      </header>

      <div className="hero-grid">
        {visibleMembers.map((m) => (
          <HeroCard key={m.name} hero={m} accent={party.color} />
        ))}
      </div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function Party() {
  const [activeParty, setActiveParty] = useState("all");

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

  return (
    <section className="party-page">
      {/* ── HERO HEADER ── */}
      <div className="party-header">
        <p className="party-eyebrow">Sangue · Inchiostro · Avventura</p>
        <h1 className="party-title">Le Compagnie di Exanthia</h1>
        <div className="party-divider">
          <span className="party-divider-icon">✦</span>
        </div>
        <p className="party-lore">
          Quattro compagnie. Sedici anime. Una sola leggenda che si scrive,
          notte dopo notte, sulle pietre di Exanthia.
        </p>
      </div>

      {/* ── STATS RIBBON ── */}
      <div className="party-stats">
        <div className="party-stat"><strong>{stats.parties}</strong><span>Compagnie</span></div>
        <div className="party-stat"><strong>{stats.heroes}</strong><span>Eroi</span></div>
        <div className="party-stat"><strong>{stats.races}</strong><span>Razze</span></div>
        <div className="party-stat"><strong>{stats.classes}</strong><span>Classi</span></div>
      </div>

      {/* ── FACTION TABS ── */}
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

      {/* ── PARTY SECTIONS ── */}
      <div className="party-list">
        {visibleParties.map((p) => (
          <PartySection key={p.id} party={p} />
        ))}
      </div>
    </section>
  );
}
