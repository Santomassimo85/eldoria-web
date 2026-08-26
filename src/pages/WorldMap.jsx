import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./WorldMap.css";
import "../styles/cinematic.css";
import TimerDisplay from "../components/TimerDisplay";
import { useAuth } from "../AuthContext";
import { CITIES_HUB } from "../data/citiesHub";
import { loreSlug } from "../utils/loreLinks";

/* ── LA MAPPA DI EXANTHIA — edizione "Il Nesso"
   Motore Leaflet (CRS.Simple + immagine): pinch/inerzia/doppio-tap nativi,
   `flyTo` animato, marker HTML. Su telefono la vista iniziale COPRE l'altezza
   (si scorre di lato), niente rotazione forzata. Si naviga per NOME con le
   pillole "Vola a…" + ricerca; ogni pin apre un FOGLIO in basso (città → NPC
   e "Apri nell'Atlante"; boss → scheda di caccia; NPC libero → scheda).
   Coordinate: i pin restano in % (CITIES_HUB / mapX,mapY) → unità immagine. */

const MAP_URL = "/assets/Exanthia.webp";
const MAP_W = 2048;
const MAP_H = 1536;
const MASTER_EMAIL = "santomassimo85@gmail.com";

const toLatLng = (xPct, yPct) => [MAP_H - (Number(yPct) / 100) * MAP_H, (Number(xPct) / 100) * MAP_W];
const isMobileViewport = () => window.matchMedia("(max-width: 900px)").matches;

export default function WorldMap() {
  const [activeBosses, setActiveBosses] = useState([]);
  const [npcs, setNpcs]                 = useState([]);
  const [selectedNpc, setSelectedNpc]   = useState(null);
  const [sheet, setSheet]               = useState(null);   // { kind: "city"|"boss"|"npc", ... }
  const [query, setQuery]               = useState("");
  const [ready, setReady]               = useState(false);

  const stageRef   = useRef(null);
  const mapRef     = useRef(null);
  const layerRef   = useRef(null);
  const sheetRef   = useRef(null);
  sheetRef.current = setSheet;

  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  // ── Firebase (invariato) ──
  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) =>
      setActiveBosses(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.isActive && b.hp > 0))
    );
    const unsubNpc = onSnapshot(collection(db, "npcs"), (snap) =>
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubBoss(); unsubNpc(); };
  }, []);

  // ── Motore: Leaflet su immagine (CRS.Simple) ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el || mapRef.current) return;
    const bounds = L.latLngBounds([[0, 0], [MAP_H, MAP_W]]);
    const map = L.map(el, {
      crs: L.CRS.Simple,
      attributionControl: false,
      zoomControl: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      maxBounds: bounds.pad(0.02),
      maxBoundsViscosity: 1,
      inertia: true,
      tap: true,
    });
    L.imageOverlay(MAP_URL, bounds, { className: "map-image" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);

    // vista iniziale: su telefono COPRE l'altezza (si scorre di lato),
    // su desktop entra tutta; non si può zoomare oltre l'inquadratura minima
    const inquadra = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      const fitW = Math.log2(w / MAP_W);
      const fitH = Math.log2(h / MAP_H);
      const minZ = isMobileViewport() ? Math.max(fitW, fitH) : Math.min(fitW, fitH);
      map.setMinZoom(minZ);
      map.setMaxZoom(minZ + 3.5);
      map.setView([MAP_H / 2, MAP_W / 2], minZ, { animate: false });
    };
    inquadra();
    map.whenReady(() => setReady(true));
    const onResize = () => { map.invalidateSize(); inquadra(); };
    window.addEventListener("resize", onResize);
    mapRef.current = map;
    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // ── Pin: città (hub NPC), boss, NPC liberi ──
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pin = (latlng, html, cls, onClick) => {
      const m = L.marker(latlng, {
        icon: L.divIcon({ className: `map-pin ${cls}`, html, iconSize: null }),
        keyboard: false, riseOnHover: true,
      });
      m.on("click", (e) => { L.DomEvent.stopPropagation(e); onClick(); });
      m.addTo(layer);
    };

    CITIES_HUB.forEach((city) => {
      const local = npcs.filter(n => n.linkedCity === city.name);
      const n = local.length;
      pin(
        toLatLng(city.x, city.y),
        `<span class="pin-ring"></span><span class="pin-dot">${n || "⌖"}</span><span class="pin-label">${city.name}</span>`,
        `map-pin--city${n ? "" : " map-pin--muta"}`,
        () => { voloA(city); sheetRef.current({ kind: "city", city, npcs: local }); }
      );
    });

    activeBosses.forEach((boss) => {
      if (!Number.isFinite(Number(boss.mapX)) || !Number.isFinite(Number(boss.mapY))) return;
      pin(
        toLatLng(boss.mapX, boss.mapY),
        `<span class="pin-ring"></span><span class="pin-dot">👹</span><span class="pin-label">${boss.name || "Boss"}</span>`,
        "map-pin--boss",
        () => { mapRef.current?.flyTo(toLatLng(boss.mapX, boss.mapY), zoomObiettivo(), { duration: .8 }); sheetRef.current({ kind: "boss", boss }); }
      );
    });

    npcs.filter(n => {
      const cityKnown = n.linkedCity && CITIES_HUB.some(c => c.name === n.linkedCity);
      return !cityKnown && Number.isFinite(n.mapX) && Number.isFinite(n.mapY);
    }).forEach((npc) => {
      pin(
        toLatLng(npc.mapX, npc.mapY),
        `<span class="pin-ring"></span><span class="pin-dot">☖</span><span class="pin-label">${npc.name || ""}</span>`,
        "map-pin--npc",
        () => { mapRef.current?.flyTo(toLatLng(npc.mapX, npc.mapY), zoomObiettivo(), { duration: .8 }); sheetRef.current({ kind: "npc", npc }); }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcs, activeBosses, ready]);

  // ── Vola a… ──
  const zoomObiettivo = () => {
    const map = mapRef.current;
    if (!map) return 0;
    return Math.max(map.getZoom(), map.getMinZoom() + 1.5);
  };
  const voloA = useCallback((city) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(toLatLng(city.x, city.y), zoomObiettivo(), { duration: .9, easeLinearity: .25 });
  }, []);
  const zoomIn  = () => mapRef.current?.zoomIn(0.75);
  const zoomOut = () => mapRef.current?.zoomOut(0.75);
  const reset   = () => { const m = mapRef.current; if (m) m.flyTo([MAP_H / 2, MAP_W / 2], m.getMinZoom(), { duration: .7 }); setSheet(null); };

  // chiusura foglio: tap sulla mappa / Esc
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const chiudi = () => setSheet(null);
    map.on("click", chiudi);
    return () => map.off("click", chiudi);
  }, [ready]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (selectedNpc) setSelectedNpc(null); else setSheet(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNpc]);

  // pillole "Vola a…": tutte le città, filtrate dalla ricerca
  const cities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...CITIES_HUB]
      .sort((a, b) => a.name.localeCompare(b.name, "it"))
      .filter(c => !q || c.name.toLowerCase().includes(q));
  }, [query]);
  const countOf = (name) => npcs.filter(n => n.linkedCity === name).length;

  return (
    <div className="cine-page map-page" style={{ "--cine-accent": "#22d3ee", "--cine-accent-2": "#8b5cf6" }}>
      <header className="map-testata">
        <span className="nx-kicker">Archivio Cartografico</span>
        <h1 className="nx-titolo map-titolo">Mappa di Exanthia</h1>
      </header>

      {/* ── IL PALCO: la mappa (Leaflet) + comandi sovrapposti ── */}
      <div className={`map-palco${sheet ? " has-sheet" : ""}`}>
        <div ref={stageRef} className="map-stage" aria-label="Mappa interattiva di Exanthia" />

        {/* zoom */}
        <div className="map-zoomctl" role="group" aria-label="Zoom">
          <button type="button" onClick={zoomIn} aria-label="Ingrandisci">＋</button>
          <button type="button" onClick={zoomOut} aria-label="Riduci">－</button>
          <button type="button" onClick={reset} aria-label="Vista iniziale" title="Vista iniziale">⌂</button>
        </div>

        {/* Vola a… : ricerca + pillole scorrevoli */}
        <div className="map-vola" role="navigation" aria-label="Vola a">
          <label className="map-cerca">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              placeholder="Cerca un luogo…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="map-pillole">
            {cities.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`nx-pillola map-pillola${sheet?.kind === "city" && sheet.city.name === c.name ? " on" : ""}`}
                onClick={() => { voloA(c); setSheet({ kind: "city", city: c, npcs: npcs.filter(n => n.linkedCity === c.name) }); }}
              >
                ⌖ {c.name}{countOf(c.name) > 0 && <span className="map-pill-n">{countOf(c.name)}</span>}
              </button>
            ))}
            {cities.length === 0 && <span className="map-pillole-vuoto">Nessun luogo trovato</span>}
          </div>
        </div>

        {/* FOGLIO in basso: dettaglio del pin ── */}
        {sheet && (
          <aside className={`map-sheet map-sheet--${sheet.kind}`} role="dialog" aria-label={
            sheet.kind === "city" ? sheet.city.name : sheet.kind === "boss" ? sheet.boss.name : sheet.npc.name
          }>
            <button type="button" className="map-sheet-close" onClick={() => setSheet(null)} aria-label="Chiudi">✕</button>

            {sheet.kind === "city" && (
              <>
                <span className="nx-kicker">⌖ Città · {sheet.npcs.length} {sheet.npcs.length === 1 ? "volto" : "volti"}</span>
                <h3 className="map-sheet-nome">{sheet.city.name}</h3>
                {sheet.npcs.length > 0 ? (
                  <div className="map-sheet-lista">
                    {sheet.npcs.map((npc) => (
                      <button key={npc.id} type="button" className="map-npc" onClick={() => setSelectedNpc(npc)}>
                        <span className="nx-anello nx-anello--sm"><img src={npc.image || "/assets/player/default.png"} alt="" /></span>
                        <span className="map-npc-info"><strong>{npc.name}</strong><span>{npc.faction || npc.location || ""}</span></span>
                        <span className="map-npc-cue" aria-hidden="true">›</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="nx-nota">Nessun volto archiviato qui, per ora.</p>
                )}
                <button type="button" className="gl-cta map-sheet-cta" onClick={() => navigate(`/Geo?focus=${loreSlug(sheet.city.name)}`)}>
                  Apri nell'Atlante →
                </button>
              </>
            )}

            {sheet.kind === "boss" && (
              <>
                <span className="nx-kicker map-kicker--boss">👹 World Boss · GS {sheet.boss.gradoSfida || "??"}</span>
                <h3 className="map-sheet-nome">{sheet.boss.name}</h3>
                <div className="map-boss">
                  {sheet.boss.imageUrl && <img className="map-boss-img" src={sheet.boss.imageUrl} alt="" />}
                  <div className="map-boss-info">
                    {sheet.boss.rewards && <p className="map-boss-reward">🎁 {sheet.boss.rewards}</p>}
                    <p className="map-boss-timer">⏳ <TimerDisplay expiryDate={sheet.boss.expiryDate} /></p>
                    <div className="map-hp"><i style={{ width: `${Math.max(0, (sheet.boss.hp / sheet.boss.maxHp) * 100)}%` }} /></div>
                    <p className="nx-nota">{isMaster ? `❤️ ${sheet.boss.hp}/${sheet.boss.maxHp}` : "❤️ Stato di salute"}</p>
                  </div>
                </div>
                <button type="button" className="gl-cta gl-cta--crit map-sheet-cta" onClick={() => navigate("/world-boss-fight")}>⚔ Combatti</button>
              </>
            )}

            {sheet.kind === "npc" && (
              <>
                <span className="nx-kicker">☖ Personaggio non giocante</span>
                <h3 className="map-sheet-nome">{sheet.npc.name}</h3>
                <button type="button" className="map-npc" onClick={() => setSelectedNpc(sheet.npc)}>
                  <span className="nx-anello nx-anello--sm"><img src={sheet.npc.image || "/assets/player/default.png"} alt="" /></span>
                  <span className="map-npc-info"><strong>{sheet.npc.faction || "—"}</strong><span>{sheet.npc.location ? `📍 ${sheet.npc.location}` : ""}</span></span>
                  <span className="map-npc-cue" aria-hidden="true">›</span>
                </button>
              </>
            )}
          </aside>
        )}
      </div>

      <p className="map-hint nx-nota">Pizzica o scorri per zoomare · trascina per spostarti · tocca un luogo o scegli una pillola per volarci.</p>

      {/* MODALE-VARCO: dettaglio NPC (logica invariata) */}
      {selectedNpc && (
        <div className="nx-modale-overlay" onClick={() => setSelectedNpc(null)} role="dialog" aria-modal="true" aria-label={selectedNpc.name}>
          <div className="nx-modale map-npc-modale" onClick={e => e.stopPropagation()}>
            <button type="button" className="nx-modale-close" onClick={() => setSelectedNpc(null)} aria-label="Chiudi">✕</button>
            <img className="nx-modale-img" src={selectedNpc.image || "/assets/player/default.png"} alt={selectedNpc.name} />
            <span className="nx-kicker">☖ Personaggio non giocante</span>
            <h3 className="nx-titolo">{selectedNpc.name}</h3>
            <div className="nx-meta-box">
              {selectedNpc.faction    && <p><strong>Fazione</strong> {selectedNpc.faction}</p>}
              {selectedNpc.location   && <p><strong>Luogo</strong> {selectedNpc.location}</p>}
              {selectedNpc.linkedCity && <p><strong>Città</strong> {selectedNpc.linkedCity}</p>}
            </div>
            {selectedNpc.description && <p className="nx-prosa">{selectedNpc.description}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
