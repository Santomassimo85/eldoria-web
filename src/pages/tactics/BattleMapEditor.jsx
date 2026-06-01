// ─────────────────────────────────────────────────────────────────────────
// BattleMapEditor — master tool to author tactical maps.
//
// Paint terrain by clicking tiles, raise/lower elevation, drop/erase props,
// resize the grid, then save. Maps are stored as docs in `battle_meta`
// (kind:"map") — open rules, no extra deploy. BossTactics lets the master pick
// a saved map when setting up a fight.
//
// Route: /dm-admin/battle-maps
// ─────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../AuthContext";
import IsoBoard from "./IsoBoard";
import {
  makeFlatMap, makeTile, computeBoardMetrics, rotateCoord,
  TERRAINS, TERRAIN_KEYS, PROPS, MAX_GRID, MAX_ELEV,
} from "./isoCore";
import "./BossTactics.css";
import "./BattleMapEditor.css";

const MASTER_EMAIL = "santomassimo85@gmail.com";

export default function BattleMapEditor() {
  const { currentUser } = useAuth();
  const isMaster = currentUser?.email === MASTER_EMAIL;

  const [map, setMap] = useState(() => makeFlatMap(12, 12, "grass"));
  const [tool, setTool] = useState({ type: "terrain", value: "grass" });
  const [savedMaps, setSavedMaps] = useState([]);
  const [mapName, setMapName] = useState("Nuova mappa");
  const [editingId, setEditingId] = useState(null);
  const [propSprites, setPropSprites] = useState({});
  const propFileRefs = useRef({});
  // selection mode: "single" paints one tile per click; "rect" picks a
  // rectangular area with two clicks and applies the active tool to all of it.
  const [selMode, setSelMode] = useState("single");
  const [rectStart, setRectStart] = useState(null); // {x,y} first corner (rect mode)
  const [hoverTile, setHoverTile] = useState(null);  // {x,y} hovered tile (rect preview)
  const [absElev, setAbsElev] = useState(2);         // target height for the plateau tool
  const [newW, setNewW] = useState(12);
  const [newH, setNewH] = useState(12);

  // camera
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(collection(db, "battle_meta"), (snap) =>
      setSavedMaps(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.kind === "map")));
  }, [isMaster]);

  useEffect(() => {
    if (!isMaster) return;
    return onSnapshot(doc(db, "battle_meta", "prop_sprites"), (snap) =>
      setPropSprites(snap.exists() ? snap.data() : {}));
  }, [isMaster]);

  // Compress an uploaded image and store it as the sprite for a prop type.
  const loadPropSprite = (file, key) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const MAX_PX = 256;
        const scale = img.width > MAX_PX ? MAX_PX / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        await setDoc(doc(db, "battle_meta", "prop_sprites"), { [key]: canvas.toDataURL("image/png") }, { merge: true });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };
  const removePropSprite = (key) => setDoc(doc(db, "battle_meta", "prop_sprites"), { [key]: "" }, { merge: true });

  const metrics = useMemo(() => computeBoardMetrics(map, rotation), [map, rotation]);
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const s = Math.min((vp.clientWidth - 24) / metrics.boardW, (vp.clientHeight - 24) / metrics.boardH);
    const c = Math.max(0.2, Math.min(2, s));
    setScale(c);
    setPan({ x: (vp.clientWidth - metrics.boardW * c) / 2, y: (vp.clientHeight - metrics.boardH * c) / 2 });
  }, [metrics]);
  useEffect(() => { fit(); }, [fit]);

  const onPointerDown = (e) => {
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false, captured: false, pointerId: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) { d.moved = true; try { e.currentTarget.setPointerCapture(d.pointerId); d.captured = true; } catch { /* */ } }
    if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy });
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    movedRef.current = d?.moved || false;
    if (d?.captured) { try { e.currentTarget.releasePointerCapture(d.pointerId); } catch { /* */ } }
    dragRef.current = null;
  };
  const zoom = (dir) => setScale((s) => Math.max(0.2, Math.min(2.5, s + dir * 0.15)));
  const rotate = () => setRotation((r) => (r + 1) % 4);

  // Return a new tile with the active tool applied (pure — no state writes).
  const tileWithTool = (t) => {
    let nt = { ...t };
    if (tool.type === "terrain") nt.terrain = tool.value;
    else if (tool.type === "elev") nt.elevation = Math.max(0, Math.min(MAX_ELEV, (t.elevation || 0) + tool.value));
    else if (tool.type === "elevset") nt.elevation = Math.max(0, Math.min(MAX_ELEV, tool.value));
    else if (tool.type === "prop") nt.prop = tool.value;
    else if (tool.type === "spawn") {
      // never store `undefined` (Firestore rejects it) — delete the key instead
      if (tool.value) nt.spawn = tool.value; else delete nt.spawn;
    }
    return nt;
  };

  // All grid coords inside the rectangle spanned by two corners (inclusive).
  const rectCoords = (a, b) => {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
    return out;
  };

  // Apply the active tool to every coord in the list (one batched state write).
  const applyToCoords = (coords) => {
    setMap((m) => {
      const tiles = m.tiles.slice();
      for (const { x, y } of coords) {
        const i = y * m.w + x;
        if (i < 0 || i >= tiles.length) continue;
        tiles[i] = tileWithTool(tiles[i]);
      }
      return { ...m, tiles };
    });
  };

  // ── Tile click: paint one tile (single) or anchor/close a rectangle (rect) ──
  const onTileClick = (x, y) => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (selMode === "single") { applyToCoords([{ x, y }]); return; }
    if (!rectStart) { setRectStart({ x, y }); return; }   // first corner
    applyToCoords(rectCoords(rectStart, { x, y }));        // second corner → fill
    setRectStart(null);
  };

  // Show spawn tiles as coloured markers (blue = hero, red = enemy), plus the
  // live rectangle preview while picking an area.
  const highlights = useMemo(() => {
    const hl = {};
    for (const t of map.tiles) if (t.spawn) hl[`${t.x},${t.y}`] = t.spawn === "hero" ? "move" : "target";
    if (selMode === "rect" && rectStart) {
      const end = hoverTile || rectStart;
      const x0 = Math.min(rectStart.x, end.x), x1 = Math.max(rectStart.x, end.x);
      const y0 = Math.min(rectStart.y, end.y), y1 = Math.max(rectStart.y, end.y);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) hl[`${x},${y}`] = "selected";
    }
    return hl;
  }, [map, selMode, rectStart, hoverTile]);

  // ── Map ops ──
  const newMap = () => {
    const w = Math.max(2, Math.min(MAX_GRID, parseInt(newW) || 12));
    const h = Math.max(2, Math.min(MAX_GRID, parseInt(newH) || 12));
    setMap(makeFlatMap(w, h, "grass"));
    setEditingId(null);
    setMapName("Nuova mappa");
  };
  const saveMap = async () => {
    const payload = { kind: "map", name: mapName || "Mappa", w: map.w, h: map.h, tiles: map.tiles, updatedAt: serverTimestamp() };
    if (editingId) await setDoc(doc(db, "battle_meta", editingId), payload, { merge: true });
    else {
      const ref = await addDoc(collection(db, "battle_meta"), payload);
      setEditingId(ref.id);
    }
  };
  const loadMap = (m) => {
    setMap({ w: m.w, h: m.h, tiles: m.tiles.map((t) => ({ ...t })) });
    setMapName(m.name || "Mappa");
    setEditingId(m.id);
  };
  const deleteMap = async (id) => {
    if (!window.confirm("Eliminare questa mappa?")) return;
    await deleteDoc(doc(db, "battle_meta", id));
    if (editingId === id) { setEditingId(null); }
  };

  if (!isMaster) return <div className="bt-msg">Solo il Master può creare mappe.</div>;

  const terrSwatch = (key) => {
    const t = TERRAINS[key];
    return (
      <button key={key}
        className={`bme-swatch ${tool.type === "terrain" && tool.value === key ? "on" : ""}`}
        title={t.label}
        style={{ background: t.color || "repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 50% / 10px 10px" }}
        onClick={() => setTool({ type: "terrain", value: key })}>
        <span>{t.label}</span>
      </button>
    );
  };

  return (
    <div className="tac-screen">
      <div className="tac-topbar">
        <Link to="/dm-admin" className="bme-back">← Admin</Link>
        <span className="tac-title">🗺 Editor Mappe Battaglia</span>
        <div className="tac-controls">
          <button onClick={() => zoom(+1)}>＋</button>
          <button onClick={() => zoom(-1)}>－</button>
          <button onClick={rotate} title="Ruota">⟳</button>
          <button onClick={fit}>Adatta</button>
        </div>
      </div>

      <div className="tac-viewport" ref={viewportRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <div className="tac-pan" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <IsoBoard map={map} units={[]} highlights={highlights} scale={scale} rotation={rotation}
            onTileClick={(x, y) => onTileClick(x, y)}
            onTileHover={(x, y) => { if (selMode === "rect" && rectStart) setHoverTile({ x, y }); }} />
        </div>
      </div>

      {/* ── Tool palette ── */}
      <div className="bme-palette">
        <div className="bme-group">
          <span className="bme-label">Modalità</span>
          <button className={`bme-tool ${selMode === "single" ? "on" : ""}`} onClick={() => { setSelMode("single"); setRectStart(null); }}>🖊 Singolo</button>
          <button className={`bme-tool ${selMode === "rect" ? "on" : ""}`} onClick={() => { setSelMode("rect"); setRectStart(null); }}>▭ Rettangolo</button>
          {selMode === "rect" && (
            <span className="bme-hint">
              {rectStart ? "Clicca il 2° angolo…" : "Clicca il 1° angolo…"}
              {rectStart && <button className="bme-tool" onClick={() => setRectStart(null)}>✖ Annulla</button>}
            </span>
          )}
        </div>
        <div className="bme-group">
          <span className="bme-label">Terreni</span>
          <div className="bme-swatches">{TERRAIN_KEYS.map(terrSwatch)}</div>
        </div>
        <div className="bme-group">
          <span className="bme-label">Quota</span>
          <button className={`bme-tool ${tool.type === "elev" && tool.value === 1 ? "on" : ""}`} onClick={() => setTool({ type: "elev", value: 1 })}>⬆ Alza</button>
          <button className={`bme-tool ${tool.type === "elev" && tool.value === -1 ? "on" : ""}`} onClick={() => setTool({ type: "elev", value: -1 })}>⬇ Abbassa</button>
          <span className="bme-sep">|</span>
          <button className={`bme-tool ${tool.type === "elevset" && tool.value === absElev ? "on" : ""}`} onClick={() => setTool({ type: "elevset", value: absElev })} title="Imposta la quota esatta (per plateau/rialzi piatti)">⬛ Imposta =</button>
          <input type="number" min={0} max={MAX_ELEV} value={absElev}
            onChange={(e) => { const v = Math.max(0, Math.min(MAX_ELEV, parseInt(e.target.value) || 0)); setAbsElev(v); if (tool.type === "elevset") setTool({ type: "elevset", value: v }); }}
            style={{ width: 44 }} />
        </div>
        <div className="bme-group">
          <span className="bme-label">Prop</span>
          {Object.values(PROPS).map((p) => (
            <button key={p.key} className={`bme-tool ${tool.type === "prop" && tool.value === p.key ? "on" : ""}`} onClick={() => setTool({ type: "prop", value: p.key })}>{p.emoji}</button>
          ))}
          <button className={`bme-tool ${tool.type === "prop" && tool.value === null ? "on" : ""}`} onClick={() => setTool({ type: "prop", value: null })}>🚫 Togli</button>
        </div>
        <div className="bme-group">
          <span className="bme-label">Sprite Prop</span>
          {Object.values(PROPS).map((p) => (
            <div key={p.key} className="bme-prop-sprite" title={p.label}>
              <div className="bme-prop-thumb">
                {propSprites[p.key]
                  ? <img src={propSprites[p.key]} alt={p.label} />
                  : <span>{p.emoji}</span>}
              </div>
              <input
                ref={(el) => { propFileRefs.current[p.key] = el; }}
                type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => loadPropSprite(e.target.files[0], p.key)} />
              <button className="bme-tool" onClick={() => propFileRefs.current[p.key]?.click()}>📁</button>
              {propSprites[p.key] && (
                <button className="bme-tool" onClick={() => removePropSprite(p.key)}>✖</button>
              )}
            </div>
          ))}
        </div>
        <div className="bme-group">
          <span className="bme-label">Spawn</span>
          <button className={`bme-tool ${tool.type === "spawn" && tool.value === "hero" ? "on" : ""}`} onClick={() => setTool({ type: "spawn", value: "hero" })}>🛡 Eroe</button>
          <button className={`bme-tool ${tool.type === "spawn" && tool.value === "enemy" ? "on" : ""}`} onClick={() => setTool({ type: "spawn", value: "enemy" })}>👹 Nemico</button>
          <button className={`bme-tool ${tool.type === "spawn" && tool.value === null ? "on" : ""}`} onClick={() => setTool({ type: "spawn", value: null })}>🚫 Togli</button>
        </div>
      </div>

      {/* ── Save / load tray ── */}
      <div className="bme-tray">
        <div className="bme-tray-row">
          <input value={mapName} onChange={(e) => setMapName(e.target.value)} placeholder="Nome mappa" className="bme-name" />
          <button className="bt-primary" onClick={saveMap}>{editingId ? "💾 Aggiorna" : "💾 Salva"}</button>
          <span className="bme-sep">|</span>
          Nuova:
          <input type="number" min={2} max={MAX_GRID} value={newW} onChange={(e) => setNewW(e.target.value)} style={{ width: 44 }} />×
          <input type="number" min={2} max={MAX_GRID} value={newH} onChange={(e) => setNewH(e.target.value)} style={{ width: 44 }} />
          <button onClick={newMap}>＋ Crea vuota</button>
        </div>
        <div className="bme-tray-row">
          <span className="bme-label">Mappe salvate:</span>
          {savedMaps.length === 0 && <span style={{ opacity: 0.6 }}>nessuna</span>}
          {savedMaps.map((m) => (
            <span key={m.id} className={`bme-mapchip ${editingId === m.id ? "on" : ""}`}>
              <button onClick={() => loadMap(m)}>{m.name} ({m.w}×{m.h})</button>
              <button className="bme-del" onClick={() => deleteMap(m.id)}>✕</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
