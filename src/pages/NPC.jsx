import React, { useState, useEffect } from 'react';
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
const DIVIDER_IMAGES = [
  "/assets/PhotoStory/GruppoMEAA/oldman.png",
  "/assets/PhotoStory/GruppoENOX/meetDuke.png",
  "/assets/PhotoStory/GruppoENOX/tarbunusMeet.png",
  "/assets/PhotoStory/GruppoLEAF/meetTaaras.png",
  "/assets/PhotoStory/GruppoMEAA/silaen.png",
  "/assets/PhotoStory/GruppoMEAA/getha_nephew.png",
  "/assets/PhotoStory/GruppoMEAA/jade.png",
  "/assets/PhotoStory/GruppoMEAA/caius.png",
];
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function NPC() {
  const [npcs, setNpcs] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCity, setActiveCity] = useState(null);
  const { currentUser } = useAuth();
  useParallaxScroll();

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

      {/* ── HERO ── */}
      <section id="npc-top" className="cine-hero" aria-label="Gli abitanti del mondo">
        <div className="cine-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-hero-vignette" />
          <div className="cine-hero-gradient" />
          <div className="cine-hero-pattern" />
        </div>
        <div className="cine-hero-content">
          <span className="cine-eyebrow">Archivio dei Volti</span>
          <h1 className="cine-hero-title">Gli Abitanti del Mondo</h1>
          <p className="cine-hero-tagline">
            Mercanti, nobili, erranti e creature: ogni volto che gli eroi
            hanno incrociato lungo le strade di Exanthia.
          </p>
          <div className="cine-hero-meta">
            <span className="cine-pill">👤 {npcs.length} personaggi</span>
            {cityKeys.length > 0 && (
              <span className="cine-pill cine-pill--accent">🏙 {cityKeys.length} {cityKeys.length === 1 ? "luogo" : "luoghi"}</span>
            )}
          </div>
        </div>
        <div className="cine-hero-scroll-hint" aria-hidden="true">
          <span>Scorri</span>
          <span className="cine-hero-arrow">↓</span>
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
          <div key={city} className="npc-city" data-accent={idx % 5}>
            <section id={`npc-${slugify(city)}`} className="cine-scrolly cine-scrolly--short" aria-label={city}>
              <div className="cine-scrolly-media" aria-hidden="true">
                <img src={DIVIDER_IMAGES[idx % DIVIDER_IMAGES.length]} alt=""
                     onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="cine-scrolly-bottom-fade" aria-hidden="true" />
              </div>
              <div className="cine-scrolly-content">
                <div className="cine-scrolly-frame">
                  <span className="cine-scrolly-eyebrow">{city === "Erranti" ? "Senza dimora" : "Luogo"}</span>
                  <h2 className="cine-scrolly-title">{city}</h2>
                  <p className="cine-scrolly-text">
                    {list.length}{isFiltering && list.length !== grouped[city].length ? ` di ${grouped[city].length}` : ""} {list.length === 1 ? "abitante" : "abitanti"}
                  </p>
                </div>
              </div>
            </section>

            <div className="cine-wrap cine-wrap--wide">
              <div className="npc-grid">
                {list.map((npc) => (
                  <div key={npc.id} className="npc-card">
                    <img
                      src={npc.image || "/assets/player/default.png"}
                      alt={npc.name}
                      className="npc-card-image"
                    />
                    <div className="npc-card-body">
                      <h3 className="npc-card-name">{npc.name}</h3>
                      {(npc.faction || npc.location) && (
                        <p className="npc-card-meta">
                          {[npc.faction, npc.location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {npc.description && (
                        <p className="npc-card-desc">{npc.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}

    </section>
  );
}
