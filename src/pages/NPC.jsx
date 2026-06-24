import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from '../AuthContext';
import { awardPetPoints } from '../utils/pet';
import './NPC.css';
import '../styles/cinematic.css';
import useParallaxScroll from '../hooks/useParallaxScroll';
import AmbientFX from '../components/AmbientFX';
import CineToolbar from '../components/CineToolbar';

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/tavern.png";
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function NPC() {
  const [npcs, setNpcs] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCity, setActiveCity] = useState(null);
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  useParallaxScroll();

  // Arrivo da un link interattivo (?focus=<slug>): scorri ed evidenzia la scheda
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || npcs.length === 0) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`npc-card-${focus}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("npc-dossier--focus");
      setTimeout(() => el.classList.remove("npc-dossier--focus"), 2800);
    }, 150);
    return () => clearTimeout(t);
  }, [searchParams, npcs]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "npcs"), (snap) => {
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 🐣 pet system: +1 point per day for visiting the NPC archive
  useEffect(() => {
    if (currentUser?.uid) awardPetPoints(currentUser.uid, "npc_visit");
  }, [currentUser]);

  // Raggruppa per linkedCity; senza città → sezione "Erranti"
  const grouped = npcs.reduce((acc, npc) => {
    const city = npc.linkedCity?.trim() || "Erranti";
    if (!acc[city]) acc[city] = [];
    acc[city].push(npc);
    return acc;
  }, {});

  // Ordina: città alfabetiche, "Erranti" sempre in fondo
  const cityKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Erranti") return 1;
    if (b === "Erranti") return -1;
    return a.localeCompare(b, "it");
  });

  // ── Ricerca: nome / fazione / luogo / descrizione + filtro città ──
  const q = query.trim().toLowerCase();
  const matchesNpc = (npc) => {
    if (!q) return true;
    const hay = [npc.name, npc.faction, npc.location, npc.description, npc.linkedCity]
      .filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const visibleCities = cityKeys
    .map((city, idx) => ({ city, idx, list: grouped[city].filter(matchesNpc) }))
    .filter(({ city, list }) => (activeCity == null || activeCity === city) && list.length > 0);
  const visibleCount = visibleCities.reduce((n, c) => n + c.list.length, 0);
  const isFiltering = q !== "" || activeCity != null;

  return (
    <section className="cine-page npc-page cine-compact" style={{ "--cine-accent": "#2c8a5a", "--cine-accent-2": "#3fae72" }}>
      <AmbientFX variant="water" />

      {/* ── HERO ASIMMETRICO: immagine full-bleed + placca-registro a sinistra ── */}
      <section id="npc-top" className="npc-hero" aria-label="Gli abitanti del mondo">
        <div className="npc-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="npc-hero-wash" aria-hidden="true" />
        <div className="npc-hero-plate">
          <span className="npc-hero-seal">✦ Schedario dei Volti</span>
          <h1 className="npc-hero-title">Gli Abitanti<br />del Mondo</h1>
          <p className="npc-hero-tagline">
            Mercanti, nobili, erranti e creature: ogni volto che gli eroi
            hanno incrociato lungo le strade di Exanthia.
          </p>
          <dl className="npc-hero-stats">
            <div><dt>Personaggi</dt><dd>{npcs.length}</dd></div>
            <div><dt>{cityKeys.length === 1 ? "Luogo" : "Luoghi"}</dt><dd>{cityKeys.length}</dd></div>
          </dl>
        </div>
        <div className="npc-hero-scroll" aria-hidden="true">
          <span className="npc-hero-scroll-tx">Scorri</span>
          <span className="npc-hero-scroll-ic">↓</span>
        </div>
      </section>

      {npcs.length > 0 && (
        <CineToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Cerca per nome, fazione, luogo o parola…"
          chips={cityKeys.map((c) => ({ key: c, label: c }))}
          activeChip={activeCity}
          onChip={setActiveCity}
          allLabel="Tutti i luoghi"
          count={visibleCount}
          countNoun={visibleCount === 1 ? "abitante" : "abitanti"}
        />
      )}

      {npcs.length === 0 ? (
        <p className="cine-empty">Nessun personaggio censito.</p>
      ) : visibleCities.length === 0 ? (
        <p className="cine-empty">Nessun personaggio corrisponde alla ricerca.</p>
      ) : (
        visibleCities.map(({ city, idx, list }) => (
          <section
            key={city}
            id={`npc-${slugify(city)}`}
            className="npc-city"
            data-accent={idx % 5}
            aria-label={city}
          >
            {/* marginalia sticky del luogo */}
            <aside className="npc-city-aside">
              <span className="npc-city-seal" aria-hidden="true">{city === "Erranti" ? "✸" : "⌖"}</span>
              <span className="npc-city-eyebrow">{city === "Erranti" ? "Senza dimora" : "Luogo"}</span>
              <h2 className="npc-city-name">{city}</h2>
              <span className="npc-city-chip">
                {list.length}{isFiltering && list.length !== grouped[city].length ? ` di ${grouped[city].length}` : ""} {list.length === 1 ? "abitante" : "abitanti"}
              </span>
            </aside>

            {/* registro delle schede-dossier */}
            <div className="npc-dossier-list">
              {list.map((npc) => (
                <article key={npc.id} id={`npc-card-${slugify(npc.name)}`} className="npc-dossier">
                  <div className="npc-dossier-portrait">
                    <img
                      src={npc.image || "/assets/player/default.png"}
                      alt={npc.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="npc-dossier-body">
                    <h3 className="npc-dossier-name">{npc.name}</h3>
                    {(npc.faction || npc.location) && (
                      <p className="npc-dossier-meta">
                        {[npc.faction, npc.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {npc.description && (
                      <p className="npc-dossier-desc">{npc.description}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

    </section>
  );
}
