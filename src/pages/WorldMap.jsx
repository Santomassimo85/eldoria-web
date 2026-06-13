import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./WorldMap.css";
import "../styles/cinematic.css";
import TimerDisplay from "../components/TimerDisplay";
import { useAuth } from "../AuthContext";
import { CITIES_HUB } from "../data/citiesHub";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const MASTER_EMAIL = "santomassimo85@gmail.com";

const TAP_THRESHOLD = 8; // px: movimenti < 8px restano "tap" e non panning

// Placement universale del tooltip: in base alla posizione dell'ancora sulla
// mappa (in %) decidiamo da quale lato deve aprirsi così non finisce mai
// fuori dal viewport. Si combina con le classi CSS .tip-y-down/.tip-x-left/right.
function tooltipPlacementClasses(xPct, yPct) {
  const cls = [];
  // Soglie tarate per tooltip ~200px su map ~360px (mobile, caso peggiore):
  // metà tooltip ≈ 25% della larghezza mappa, da qui il 25% sui lati.
  // Top: tooltip include immagine 90px + body, ~150px → 30% della mappa più
  // corta è una soglia conservativa che evita il clipping anche a viewport piccoli.
  if (yPct < 30) cls.push("tip-y-down");
  if (xPct < 25) cls.push("tip-x-left");
  else if (xPct > 75) cls.push("tip-x-right");
  return cls.join(" ");
}

export default function WorldMap() {
  const [activeBosses, setActiveBosses] = useState([]);
  const [npcs, setNpcs]                 = useState([]);
  const [selectedNpc, setSelectedNpc]   = useState(null);
  const [activeAnchorId, setActiveAnchorId] = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [pan, setPan]                   = useState({ x: 0, y: 0 });

  const viewportRef   = useRef(null);
  const innerRef      = useRef(null);
  const isDragging    = useRef(false);
  const didDrag       = useRef(false);
  const dragStartPos  = useRef(null);
  const lastPointer   = useRef({ x: 0, y: 0 });
  const lastTouchDist = useRef(null);
  const zoomRef       = useRef(1);

  const navigate    = useNavigate();
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Orientamento: SOLO in questa pagina forziamo il landscape (la mappa è
  // larga e in portrait si vede male). All'uscita ripristiniamo il portrait
  // (il default dell'app, vedi manifest). Funziona quando la pagina può
  // bloccare l'orientamento (PWA installata o fullscreen); altrove fallisce
  // in silenzio. iOS Safari non supporta il lock via web. ──
  useEffect(() => {
    const orient = (typeof window !== "undefined" && window.screen && window.screen.orientation) || null;
    if (!orient || typeof orient.lock !== "function") return;
    // Solo su mobile/touch: niente fullscreen forzato su desktop.
    const isMobile = window.matchMedia("(max-width: 900px)").matches || window.matchMedia("(pointer: coarse)").matches;
    if (!isMobile) return;

    // Se non siamo già fullscreen, prova a entrarci sull'elemento radice:
    // su Chrome Android il lock dell'orientamento richiede il fullscreen.
    const root = document.documentElement;
    const wasFullscreen = !!document.fullscreenElement;
    const tryLock = async () => {
      try {
        if (!document.fullscreenElement && root.requestFullscreen) {
          await root.requestFullscreen().catch(() => {});
        }
        await orient.lock("landscape");
      } catch { /* in tab senza gesture/fullscreen fallisce: nessun problema */ }
    };
    tryLock();

    return () => {
      try { orient.unlock && orient.unlock(); } catch { /* noop */ }
      if (!wasFullscreen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Firebase
  useEffect(() => {
    const unsubBoss = onSnapshot(collection(db, "bosses"), (snap) =>
      setActiveBosses(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.isActive && b.hp > 0))
    );
    const unsubNpc = onSnapshot(collection(db, "npcs"), (snap) =>
      setNpcs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubBoss(); unsubNpc(); };
  }, []);

  // Wheel zoom (passive: false required)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      setZoom(prev => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
        if (next <= MIN_ZOOM + 0.01) { setPan({ x: 0, y: 0 }); return MIN_ZOOM; }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Touch — prevent page scroll while interacting with map
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const prevent = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  const clampPan = useCallback((x, y) => {
    const el = viewportRef.current;
    const inner = innerRef.current;
    if (!el) return { x, y };
    const z = zoomRef.current;
    const innerW = inner?.offsetWidth  ?? el.offsetWidth;
    const innerH = inner?.offsetHeight ?? el.offsetHeight;
    const maxX = Math.max(0, (innerW * z - el.offsetWidth)  / 2);
    const maxY = Math.max(0, (innerH * z - el.offsetHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  // Mouse events
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    didDrag.current = false;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    if (!didDrag.current && dragStartPos.current) {
      const dxs = e.clientX - dragStartPos.current.x;
      const dys = e.clientY - dragStartPos.current.y;
      if (Math.hypot(dxs, dys) < TAP_THRESHOLD) return; // soglia tap
      didDrag.current = true;
    }
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPan(prev => clampPan(prev.x + dx, prev.y + dy));
  }, [clampPan]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Touch events
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      lastTouchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      didDrag.current = true; // pinch-zoom non è un tap
    } else {
      isDragging.current = true;
      didDrag.current = false;
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist.current) {
        const factor = dist / lastTouchDist.current;
        setZoom(prev => {
          const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
          if (next <= MIN_ZOOM + 0.01) { setPan({ x: 0, y: 0 }); return MIN_ZOOM; }
          return next;
        });
      }
      lastTouchDist.current = dist;
    } else if (isDragging.current && e.touches.length === 1) {
      const cx = e.touches[0].clientX;
      const cy = e.touches[0].clientY;
      if (!didDrag.current && dragStartPos.current) {
        const dxs = cx - dragStartPos.current.x;
        const dys = cy - dragStartPos.current.y;
        if (Math.hypot(dxs, dys) < TAP_THRESHOLD) return; // entro la soglia: ancora un tap, non panning
        didDrag.current = true;
      }
      const dx = cx - lastPointer.current.x;
      const dy = cy - lastPointer.current.y;
      lastPointer.current = { x: cx, y: cy };
      setPan(prev => clampPan(prev.x + dx, prev.y + dy));
    }
  }, [clampPan]);

  const onTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchDist.current = null;
  }, []);

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Tap su un'ancora: se il movimento era < soglia (didDrag=false) considero il gesto un click utile.
  const handleNpcClick = (e, npc) => {
    e.stopPropagation();
    if (didDrag.current) return;
    setSelectedNpc(npc);
  };

  const handleAnchorTap = (e, anchorId) => {
    e.stopPropagation();
    if (didDrag.current) return;
    setActiveAnchorId(prev => (prev === anchorId ? null : anchorId));
  };

  // Tap su sfondo mappa (non su ancora) chiude il tooltip aperto.
  const handleViewportTap = () => {
    if (didDrag.current) return;
    if (activeAnchorId) setActiveAnchorId(null);
  };

  const innerStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "center center",
    transition: isDragging.current ? "none" : "transform 0.08s ease-out",
    // Esposto via CSS var: le ancore (ping + tooltip) si controscalano con
    // calc(1 / var(--map-zoom)) per restare a dimensione visiva costante.
    "--map-zoom": zoom,
  };

  return (
    <div className="cine-page map-page" style={{ "--cine-accent": "#2f6e8a", "--cine-accent-2": "#4a9ac0" }}>
      <h1 className="map-page-title">Mappa di Exanthia</h1>

      <div
        ref={viewportRef}
        className={`map-viewport${zoom > 1 ? " is-zoomed" : ""}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleViewportTap}
      >
        <div ref={innerRef} className="map-inner" style={innerStyle}>
          <img src="/assets/Exanthia.jpg" className="world-map-img" alt="Mappa Mondo" draggable={false} />

          {/* BOSS (Ping Rossi) */}
          {activeBosses.map((boss) => (
            <div key={boss.id}
              className={`map-anchor boss-anchor ${tooltipPlacementClasses(boss.mapX, boss.mapY)}${activeAnchorId === `boss-${boss.id}` ? " is-active" : ""}`}
              style={{ left: `${boss.mapX}%`, top: `${boss.mapY}%` }}
              onClick={(e) => handleAnchorTap(e, `boss-${boss.id}`)}>
              <div className="ping boss-ping">
                <div className="ping-ring boss-ring" />
              </div>
              <div className="map-tooltip boss-tooltip">
                <div className="tooltip-img-wrap">
                  <img src={boss.imageUrl} alt={boss.name} />
                  <div className="tooltip-img-fade" />
                </div>
                <div className="tooltip-body">
                  <h3 className="tooltip-name">{boss.name}</h3>
                  <span className="gs-badge">GS {boss.gradoSfida || "??"}</span>
                  {boss.rewards && (
                    <div className="reward-box">
                      <span className="reward-label">🎁 Ricompensa</span>
                      <p className="reward-text">{boss.rewards}</p>
                    </div>
                  )}
                  <div className="mini-timer">⏳ <TimerDisplay expiryDate={boss.expiryDate} /></div>
                  <div className="hp-bar-wrap">
                    <div className="hp-bar-fill" style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }} />
                  </div>
                  <div className="hp-label">{isMaster ? `❤️ ${boss.hp}/${boss.maxHp}` : "❤️ Stato Salute"}</div>
                  <button className="btn-fight" onClick={() => navigate("/world-boss-fight")}>⚔️ COMBATTI</button>
                </div>
              </div>
            </div>
          ))}

          {/* CITTÀ HUB (Ping raggruppati) */}
          {CITIES_HUB.map((city) => {
            const localNpcs = npcs.filter(n => n.linkedCity === city.name);
            if (localNpcs.length === 0) return null;
            return (
              <div key={city.name}
                className={`map-anchor city-anchor ${tooltipPlacementClasses(city.x, city.y)}${activeAnchorId === `city-${city.name}` ? " is-active" : ""}`}
                style={{ left: `${city.x}%`, top: `${city.y}%` }}
                onClick={(e) => handleAnchorTap(e, `city-${city.name}`)}>
                <div className="ping city-ping">
                  <div className="ping-ring city-ring" />
                  <span className="city-count">{localNpcs.length}</span>
                </div>
                <div className="map-tooltip city-tooltip">
                  <h4 className="city-tooltip-title">{city.name}</h4>
                  <div className="npc-scroll-list">
                    {localNpcs.map(npc => (
                      <div key={npc.id} className="npc-mini-card" onClick={(e) => handleNpcClick(e, npc)}>
                        <img src={npc.image || "/assets/player/default.png"} alt={npc.name} />
                        <div className="npc-mini-info">
                          <strong>{npc.name}</strong>
                          <span>{npc.faction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* NPC LIBERI — anche quelli con linkedCity orfana (città non più presente in CITIES_HUB) */}
          {npcs.filter(n => {
            const cityKnown = n.linkedCity && CITIES_HUB.some(c => c.name === n.linkedCity);
            const hasCoords = Number.isFinite(n.mapX) && Number.isFinite(n.mapY);
            return !cityKnown && hasCoords;
          }).map(npc => (
            <div key={npc.id}
              className={`map-anchor npc-anchor ${tooltipPlacementClasses(npc.mapX, npc.mapY)}`}
              style={{ left: `${npc.mapX}%`, top: `${npc.mapY}%` }}
              onClick={(e) => handleNpcClick(e, npc)}>
              <div className="ping npc-ping">
                <div className="ping-ring npc-ring" />
              </div>
              <div className="map-tooltip npc-tooltip">
                <div className="tooltip-img-wrap">
                  <img src={npc.image || "/assets/player/default.png"} alt={npc.name} />
                  <div className="tooltip-img-fade" />
                </div>
                <div className="tooltip-body">
                  <h3 className="tooltip-name">{npc.name}</h3>
                  {npc.faction && <span className="faction-badge">{npc.faction}</span>}
                  {npc.location && <p className="loc-text">📍 {npc.location}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reset zoom button */}
      {zoom > 1 && (
        <button className="btn-reset-zoom" onClick={resetZoom} title="Reimposta zoom">
          ✕ Reset zoom
        </button>
      )}

      {/* Hint zoom */}
      <p className="map-zoom-hint">
        🖱 Scorri per zoomare · Trascina per spostarti · 📱 Pizzica per zoomare
      </p>

      {/* MODAL DETTAGLIO NPC */}
      {selectedNpc && (
        <div className="npc-overlay" onClick={() => setSelectedNpc(null)}>
          <div className="npc-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedNpc(null)}>✕</button>
            <div className="modal-head">
              <img src={selectedNpc.image || "/assets/player/default.png"} alt={selectedNpc.name} />
              <div>
                <h2>{selectedNpc.name}</h2>
                {selectedNpc.faction  && <span className="faction-tag">{selectedNpc.faction}</span>}
                {selectedNpc.location && <p className="loc-tag">📍 {selectedNpc.location}</p>}
                {selectedNpc.linkedCity && <p className="loc-tag">🏰 {selectedNpc.linkedCity}</p>}
              </div>
            </div>
            {selectedNpc.description && (
              <div className="modal-body">
                <h4>Note</h4>
                <p>{selectedNpc.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
