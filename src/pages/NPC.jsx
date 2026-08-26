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
import GlacierHero from "../components/glacier/GlacierHero";

const HERO_IMAGE = "/assets/PhotoStory/GruppoMEAA/tavern.png";
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function NPC() {
  const [npcs, setNpcs] = useState([]);
  const [query, setQuery] = useState("");
  const [activeCity, setActiveCity] = useState(null);
  const [openNpc, setOpenNpc] = useState(null); // scheda-varco aperta (solo presentazione)
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
    <section className="cine-page npc-page cine-compact" style={{ "--cine-accent": "#8b5cf6", "--cine-accent-2": "#c4b5fd" }}>
      <AmbientFX variant="cosmos" />

      {/* ── VARCO: il portale esagonale della taverna + testata ── */}
      <GlacierHero
        id="npc-top"
        ariaLabel="Gli abitanti del mondo"
        image={HERO_IMAGE}
        imgPos="center 34%"
        eyebrow="Schedario dei Volti"
        title={<>Gli Abitanti<br />del Mondo</>}
        seal={`${npcs.length} volti · ${cityKeys.length} ${cityKeys.length === 1 ? "luogo" : "luoghi"}`}
        tagline="Mercanti, nobili, erranti e creature: ogni volto che gli eroi hanno incrociato lungo le strade di Exanthia."
      />

      {/* ── I SATELLITI: indice a pillole dei luoghi (stesso filtro di prima) ── */}
      {npcs.length > 0 && (
        <div className="nx-pillole npc-pillole" role="group" aria-label="Filtra per luogo">
          <button
            type="button"
            className={`nx-pillola${activeCity == null ? " on" : ""}`}
            onClick={() => setActiveCity(null)}
          >
            ✦ Tutti i luoghi
          </button>
          {cityKeys.map((c) => (
            <button
              key={c}
              type="button"
              className={`nx-pillola${activeCity === c ? " on" : ""}`}
              onClick={() => setActiveCity(activeCity === c ? null : c)}
            >
              <span aria-hidden="true">{c === "Erranti" ? "✸" : "⌖"}</span> {c}
              <small className="npc-pillola-n">{grouped[c].length}</small>
            </button>
          ))}
        </div>
      )}

      {/* ricerca (le chip dei luoghi vivono nelle pillole qui sopra) */}
      {npcs.length > 0 && (
        <CineToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Cerca per nome, fazione, luogo o parola…"
          chips={[]}
          count={visibleCount}
          countNoun={visibleCount === 1 ? "abitante" : "abitanti"}
        />
      )}

      {npcs.length === 0 ? (
        <p className="cine-empty">Nessun personaggio censito.</p>
      ) : visibleCities.length === 0 ? (
        <p className="cine-empty">Nessun personaggio corrisponde alla ricerca.</p>
      ) : (
        visibleCities.map(({ city, list }) => (
          <section
            key={city}
            id={`npc-${slugify(city)}`}
            className="npc-city"
            aria-label={city}
          >
            <div className="gl-sezlabel">
              <span aria-hidden="true">{city === "Erranti" ? "✸" : "⌖"}</span>&nbsp;{city}
              <span className="npc-city-n">
                {list.length}{isFiltering && list.length !== grouped[city].length ? ` di ${grouped[city].length}` : ""} {list.length === 1 ? "abitante" : "abitanti"}
              </span>
            </div>

            {/* i volti: griglia di pannelli con anello-ritratto, tap → scheda-varco */}
            <div className="nx-griglia npc-volti">
              {list.map((npc) => (
                <button
                  key={npc.id}
                  type="button"
                  id={`npc-card-${slugify(npc.name)}`}
                  className="nx-pannello nx-pannello--tap npc-volto"
                  onClick={() => setOpenNpc(npc)}
                >
                  {(npc.faction || city !== "Erranti") && (
                    <span className="nx-tag">{npc.faction || city}</span>
                  )}
                  <span className="nx-anello">
                    {npc.image
                      ? <img src={npc.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                      : <span className="nx-anello-ph" aria-hidden="true">{String(npc.name || "?").charAt(0)}</span>}
                  </span>
                  <span className="nx-nome">{npc.name}</span>
                  {(npc.faction || npc.location) && (
                    <span className="nx-meta">{[npc.faction, npc.location].filter(Boolean).join(' · ')}</span>
                  )}
                  {npc.description && <span className="nx-nota npc-volto-desc">{npc.description}</span>}
                  <span className="npc-volto-cue" aria-hidden="true">Apri scheda ›</span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {/* ── SCHEDA-VARCO: dettaglio del volto ── */}
      {openNpc && (
        <div className="nx-modale-overlay" onClick={() => setOpenNpc(null)}>
          <div className="nx-modale npc-scheda" role="dialog" aria-modal="true" aria-label={openNpc.name} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="nx-modale-close" onClick={() => setOpenNpc(null)} aria-label="Chiudi">✕</button>
            {openNpc.image && (
              <img className="nx-modale-img" src={openNpc.image} alt={openNpc.name}
                   onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <span className="nx-kicker">{openNpc.linkedCity?.trim() || "Errante"}</span>
            <h3 className="nx-titolo">{openNpc.name}</h3>
            {(openNpc.faction || openNpc.location) && (
              <div className="nx-meta-box">
                {openNpc.faction && <p><strong>Fazione:</strong> {openNpc.faction}</p>}
                {openNpc.location && <p><strong>Luogo:</strong> {openNpc.location}</p>}
              </div>
            )}
            {openNpc.description && <p className="nx-prosa">{openNpc.description}</p>}
          </div>
        </div>
      )}

    </section>
  );
}
