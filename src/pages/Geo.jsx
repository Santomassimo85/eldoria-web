import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ToggleSection from "./ToggleSection";
import { useAuth } from "../AuthContext";
import GeoAdmin from "./GeoAdmin";
import { awardPetPoints } from "../utils/pet";
import './Geo.css';
import '../styles/cinematic.css';
import useParallaxScroll from '../hooks/useParallaxScroll';
import AmbientFX from '../components/AmbientFX';
import CineToolbar from '../components/CineToolbar';

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/aenlor.png";
const CONTINENT_IMAGES = {
  Vathriddon: "/assets/PhotoStory/GruppoMEAA/bear.png",
  Ehkia: "/assets/PhotoStory/GruppoMEAA/hellhound.png",
  Ohzkie: "/assets/PhotoStory/GruppoLAC/zombie_fungo.png",
};
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function Geo() {
  useParallaxScroll();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLoc, setEditingLoc] = useState(null);
  const [query, setQuery] = useState("");
  const [activeContinent, setActiveContinent] = useState(null);
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === "santomassimo85@gmail.com";

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "geo_archive"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🐣 pet system: +1 point per day for opening the Geo archive
  useEffect(() => {
    if (currentUser?.uid) awardPetPoints(currentUser.uid, "geo_visit");
  }, [currentUser]);

  if (loading) {
    return (
      <section className="cine-page geo-page" style={{ "--cine-accent": "#1f8a6a", "--cine-accent-2": "#2fb088" }}>
        <div className="geo-loading">
          <span className="geo-loading-icon">🗺️</span>
          Consultando le mappe antiche…
        </div>
      </section>
    );
  }

  const continents = ["Vathriddon", "Ehkia", "Ohzkie"];
  const locsOf = (c) => locations.filter(
    l => l.continent === c || (c === "Vathriddon" && !l.continent)
  );
  const activeContinents = continents.filter(c => locsOf(c).length > 0);

  // ── Ricerca: nome luogo / continente / descrizione + filtro continente ──
  const q = query.trim().toLowerCase();
  const matchesLoc = (loc, cont) => {
    if (!q) return true;
    const hay = [loc.name, loc.continent || cont, loc.description]
      .filter(Boolean).join(" ").toLowerCase().replace(/<[^>]*>/g, " ");
    return hay.includes(q);
  };
  const visibleContinents = activeContinents
    .map(cont => ({ cont, list: locsOf(cont).filter(l => matchesLoc(l, cont)) }))
    .filter(({ cont, list }) => (activeContinent == null || activeContinent === cont) && list.length > 0);
  const visibleCount = visibleContinents.reduce((n, c) => n + c.list.length, 0);

  return (
    <section className="cine-page geo-page cine-compact" style={{ "--cine-accent": "#1f8a6a", "--cine-accent-2": "#2fb088" }}>
      <AmbientFX variant="cosmos" />

      {/* ── HERO ── */}
      <section id="geo-top" className="cine-hero" aria-label="Archivio Geomantico">
        <div className="cine-hero-media" aria-hidden="true">
          <img src={HERO_IMAGE} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="cine-hero-vignette" />
          <div className="cine-hero-gradient" />
          <div className="cine-hero-pattern" />
        </div>
        <div className="cine-hero-content">
          <span className="cine-eyebrow">Le Terre di Exanthia</span>
          <h1 className="cine-hero-title">Archivio Geomantico</h1>
          <p className="cine-hero-tagline">
            Continenti, regni e rovine: ogni luogo che le cronache hanno cartografato.
          </p>
          <div className="cine-hero-meta">
            <span className="cine-pill">🗺 {locations.length} luoghi</span>
            <span className="cine-pill cine-pill--accent">🌍 {activeContinents.length} continenti</span>
          </div>
        </div>
        <div className="cine-hero-scroll-hint" aria-hidden="true">
          <span>Scorri</span>
          <span className="cine-hero-arrow">↓</span>
        </div>
      </section>

      {/* ── SIDE NAV ── */}
      {activeContinents.length > 0 && (
        <nav className="cine-side-nav" aria-label="Navigazione continenti">
          <a href="#geo-top" className="cine-side-nav-btn" title="Inizio"><span aria-hidden="true">🗺</span></a>
          {activeContinents.map(c => (
            <a key={c} href={`#geo-${slugify(c)}`} className="cine-side-nav-btn" title={c}><span aria-hidden="true">🌍</span></a>
          ))}
        </nav>
      )}

      {/* ── RICERCA ── */}
      {locations.length > 0 && (
        <CineToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Cerca per luogo, continente o parola…"
          chips={activeContinents.map((c) => ({ key: c, label: c }))}
          activeChip={activeContinent}
          onChip={setActiveContinent}
          allLabel="Tutti i continenti"
          count={visibleCount}
          countNoun={visibleCount === 1 ? "luogo" : "luoghi"}
        />
      )}

      {/* ---- MODAL MODIFICA RAPIDA ---- */}
      {editingLoc && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(255,255,255,0.85)", zIndex: 9999,
          overflowY: "auto", padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#ffffffee", padding: "24px", borderRadius: "12px",
            maxWidth: "800px", margin: "0 auto",
            border: "1.5px solid rgba(212,175,55,0.3)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)"
          }}>
            <button
              onClick={() => setEditingLoc(null)}
              style={{
                float: "right", background: "var(--red)", color: "white",
                border: "none", padding: "6px 14px", cursor: "pointer",
                borderRadius: "6px", fontWeight: "bold"
              }}
            >
              ✕ Chiudi
            </button>
            <h2 style={{ color: "var(--red)", fontFamily: "var(--font-title)", marginBottom: "16px" }}>
              Modifica — {editingLoc.name}
            </h2>
            <GeoAdmin editTarget={editingLoc} onComplete={() => setEditingLoc(null)} />
          </div>
        </div>
      )}

      {/* ---- NESSUN RISULTATO ---- */}
      {locations.length > 0 && visibleContinents.length === 0 && (
        <p className="cine-empty">Nessun luogo corrisponde alla ricerca.</p>
      )}

      {/* ---- CONTINENTI ---- */}
      {visibleContinents.map(({ cont: contName, list: locationsInContinent }) => {
        return (
          <div key={contName} className="continent-wrapper">
            <section id={`geo-${slugify(contName)}`} className="cine-scrolly cine-scrolly--short" aria-label={contName}>
              <div className="cine-scrolly-media" aria-hidden="true">
                <img src={CONTINENT_IMAGES[contName] || HERO_IMAGE} alt=""
                     onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="cine-scrolly-bottom-fade" aria-hidden="true" />
              </div>
              <div className="cine-scrolly-content">
                <div className="cine-scrolly-frame">
                  <span className="cine-scrolly-eyebrow">Continente</span>
                  <h2 className="cine-scrolly-title">{contName}</h2>
                  <p className="cine-scrolly-text">
                    {locationsInContinent.length} {locationsInContinent.length === 1 ? "luogo cartografato" : "luoghi cartografati"}
                  </p>
                </div>
              </div>
            </section>

            <div className="cine-wrap cine-wrap--wide">
              <div className="geo-grid">
                {locationsInContinent.map((loc) => (
                  <div key={loc.id} className="geo-card-wrapper">
                    <ToggleSection
                      title={loc.name}
                      defaultOpen={false}
                      staticContent={loc.image && (
                        <img src={loc.image} alt={loc.name} className="geo-card-preview" />
                      )}
                    >
                      {isMaster && (
                        <button
                          className="geo-edit-btn"
                          onClick={() => setEditingLoc(loc)}
                        >
                          ⚙️ Modifica Luogo
                        </button>
                      )}
                      <div
                        className="geo-description"
                        dangerouslySetInnerHTML={{ __html: loc.description }}
                      />
                    </ToggleSection>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
