// ─────────────────────────────────────────────────────────────────────────
// IsoBoard — presentational isometric renderer.
//
// Draws the whole logical board (tiles as procedurally-shaded CSS/SVG cubes +
// props + units) at its native pixel size, then a single transform: scale()
// on the outer scaler fits it to the viewport. Because everything below the
// scaler is in fixed logical px, the layout is pixel-identical on desktop and
// mobile — only the scale factor changes. No iso tileset art required.
//
// Props:
//   map           { w, h, tiles:[{x,y,terrain,elevation,prop}] }
//   units         [{ id, x, y, side, name, sprite, deadSprite, dead, hp, maxHp }]
//   highlights    { "x,y": "move"|"target"|"selected"|"path"|"heal"|"self"|"blast" }
//   pings         Set|array of unit ids that show a bouncing locator arrow
//   scale         number — viewport fit factor
//   onTileClick   (x, y, tile) => void
//   onUnitClick   (unit, ev) => void
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import {
  TILE_W, TILE_H, ELEV_STEP,
  TERRAINS, TERRAIN_KEYS, PROPS,
  tileTopCenter, tileStandPoint, tileDepth, rotateCoord,
  computeBoardMetrics, shade,
} from "./isoCore";
import "./IsoBoard.css";

// Probe /assets/tiles/<terrain>.png once; only terrains whose image actually
// loads get a texture (others fall back to the procedural coloured top).
function useTileTextures() {
  const [tex, setTex] = useState({});
  useEffect(() => {
    let alive = true;
    for (const k of TERRAIN_KEYS) {
      if (!TERRAINS[k].color) continue; // skip void
      const src = `/assets/tiles/${k}.png`;
      const img = new Image();
      img.onload = () => { if (alive) setTex((t) => (t[k] ? t : { ...t, [k]: src })); };
      img.src = src;
    }
    return () => { alive = false; };
  }, []);
  return tex;
}

// Master-uploaded sprites for props (tree/boulder/column), stored as dataURLs
// in battle_meta/prop_sprites. When a prop has no sprite we fall back to emoji.
function usePropSprites() {
  const [sprites, setSprites] = useState({});
  useEffect(() => {
    return onSnapshot(doc(db, "battle_meta", "prop_sprites"), (snap) =>
      setSprites(snap.exists() ? snap.data() : {}));
  }, []);
  return sprites;
}

// Build a rough pixel "dome" covering an AoE area. Returns the centroid screen
// point, dark floor diamonds (one per covered tile, pooled behind the units) and
// a cluster of pixel squares forming a translucent hemisphere over the centroid.
// All geometry is in logical board px (the outer scaler handles viewport fit).
function buildDome(cells, rotation, map, origin) {
  const pts = (cells || []).map((c) => {
    const [cdx, cdy] = rotateCoord(c.x, c.y, rotation, map.w, map.h);
    const tile = map.tiles[c.y * map.w + c.x];
    const elev = tile?.elevation ?? 0;
    return {
      stand: tileStandPoint(cdx, cdy, elev, origin),
      top: tileTopCenter(cdx, cdy, elev, origin),
      depth: tileDepth(cdx, cdy),
    };
  });
  if (!pts.length) return null;
  const cx = pts.reduce((s, o) => s + o.stand.x, 0) / pts.length;
  const cy = pts.reduce((s, o) => s + o.stand.y, 0) / pts.length;
  const spread = Math.max(0, ...pts.map((o) => Math.hypot(o.stand.x - cx, o.stand.y - cy)));
  const R = spread + TILE_W * 0.6;        // pad past the outermost tiles
  const depth = Math.max(...pts.map((o) => o.depth));
  // Pixel hemisphere: flat bottom on the ground line, rounded top. Chunky grid
  // so it reads as deliberately pixelated / grezzo rather than a smooth blob.
  const P = 9, RH = R, RV = R * 0.72, px = [];
  for (let gy = -RV; gy <= P / 2; gy += P)
    for (let gx = -RH; gx <= RH; gx += P) {
      const ex = gx / RH, ey = gy / RV, d = ex * ex + ey * ey;
      if (d <= 1) px.push({ x: Math.round(gx), y: Math.round(gy), edge: Math.sqrt(d) });
    }
  const floors = pts.map((o) => ({
    x: o.top.x, y: o.top.y, depth: o.depth,
    dist: spread > 0 ? Math.hypot(o.stand.x - cx, o.stand.y - cy) / spread : 0,
  }));
  return { cx, cy, depth, px, P, floors };
}

export default function IsoBoard({
  map,
  units = [],
  highlights = {},
  pings = null,
  vfx = [],
  scale = 1,
  rotation = 0,
  onTileClick,
  onTileHover,
  onTileDown,
  onUnitClick,
}) {
  // ids that should show a bouncing "ping" arrow (own hero / aimed targets)
  const pingSet = pings instanceof Set ? pings : new Set(pings || []);
  const { boardW, boardH, origin } = useMemo(
    () => computeBoardMetrics(map, rotation),
    [map, rotation]
  );
  const tex = useTileTextures();
  const propSprites = usePropSprites();

  // ── Sprite facing (one sprite, mirrored) ──────────────────────────────────
  // Sprites are flat billboards facing the camera (Octopath-style); to make a
  // unit "look" left/right we just mirror it horizontally — no extra art. Each
  // unit faces the AVERAGE screen-x of its living opponents: opponents to the
  // right → mirror to face right, else keep the default (art faces screen-left).
  // Computed in screen space so it stays correct through board rotation, and it
  // re-evaluates on movement (units = the animated displayUnits). face = ±1 fed
  // to the CSS var --face (woven into the breathe keyframes so it doesn't fight
  // the animation).
  const facingById = useMemo(() => {
    const sx = {};
    for (const u of units) {
      const [rx, ry] = rotateCoord(u.x, u.y, rotation, map.w, map.h);
      sx[u.id] = tileStandPoint(rx, ry, 0, origin).x;
    }
    const face = {};
    for (const u of units) {
      const opp = units.filter((o) => !o.dead && o.side !== u.side);
      if (!opp.length) { face[u.id] = 1; continue; }
      const avg = opp.reduce((s, o) => s + sx[o.id], 0) / opp.length;
      face[u.id] = avg > sx[u.id] ? -1 : 1;
    }
    return face;
  }, [units, rotation, map, origin]);

  return (
    <div
      className="iso-scaler"
      style={{
        width: boardW,
        height: boardH,
        transform: `scale(${scale})`,
      }}
    >
      <div className="iso-tiles-layer">
      {map.tiles.map((tile) => {
        const terr = TERRAINS[tile.terrain];
        // Holes / void: nothing to draw, nothing to stand on.
        if (!terr || terr.color == null) return null;

        const [dx, dy] = rotateCoord(tile.x, tile.y, rotation, map.w, map.h);
        const top = tileTopCenter(dx, dy, tile.elevation, origin);
        const EH = tile.elevation * ELEV_STEP;     // side-face height
        const depth = tileDepth(dx, dy);
        const hl = highlights[`${tile.x},${tile.y}`];
        const prop = tile.prop ? PROPS[tile.prop] : null;
        const texSrc = tex[tile.terrain];   // user-drawn top, if loaded

        // SVG canvas for the cube: width TILE_W, height TILE_H + EH.
        const svgH = TILE_H + EH;
        const topFace = `${TILE_W / 2},0 ${TILE_W},${TILE_H / 2} ${TILE_W / 2},${TILE_H} 0,${TILE_H / 2}`;
        const leftFace = `0,${TILE_H / 2} ${TILE_W / 2},${TILE_H} ${TILE_W / 2},${TILE_H + EH} 0,${TILE_H / 2 + EH}`;
        const rightFace = `${TILE_W / 2},${TILE_H} ${TILE_W},${TILE_H / 2} ${TILE_W},${TILE_H / 2 + EH} ${TILE_W / 2},${TILE_H + EH}`;

        return (
          <div
            key={`t-${tile.x}-${tile.y}`}
            className="iso-tile"
            style={{
              left: top.x - TILE_W / 2,
              top: top.y,
              width: TILE_W,
              height: svgH,
              zIndex: depth * 4,
            }}
          >
            {/* Base procedural cube — ALWAYS drawn (behind the texture). Its
                shaded side faces fill the FULL elevation height so raised tiles
                never show transparent gaps, and the top diamond fills behind the
                texture in case the art has any holes. */}
            <svg
              width={TILE_W}
              height={svgH}
              viewBox={`0 0 ${TILE_W} ${svgH}`}
              className="iso-cube"
            >
              {/* Each face is stroked with its OWN fill colour (not a lighter
                  edge) so the cube reads as one solid block — no visible grid —
                  and the ~0.8px wide stroke fattens the polygon just enough to
                  overlap its neighbours, closing the sub-pixel seams that the
                  fractional viewport scale would otherwise leave between tiles.
                  crispEdges keeps the pixel-art look sharp. */}
              {EH > 0 && (
                <>
                  <polygon className="iso-face" points={leftFace} fill={shade(terr.color, 0.62)}
                    stroke={shade(terr.color, 0.62)} strokeWidth="1.5" shapeRendering="crispEdges" />
                  <polygon className="iso-face" points={rightFace} fill={shade(terr.color, 0.46)}
                    stroke={shade(terr.color, 0.46)} strokeWidth="1.5" shapeRendering="crispEdges" />
                </>
              )}
              <polygon
                className="iso-face"
                points={topFace}
                fill={terr.color}
                stroke={terr.color}
                strokeWidth="1.5"
                shapeRendering="crispEdges"
              />
            </svg>
            {/* user-drawn iso cube tile (square PNG: diamond top + cube body).
                Lifted so the diamond-top vertex lands on the cell; the cube body
                hangs below. Overlays the procedural base. NON-interactive: the
                square's transparent corners overhang the diamond, and because a
                front tile sits at a higher z-index its texture square would cover
                the top surface of the tile behind it — stealing that tile's
                clicks (you'd have to click "higher up" to hit it). Clicks are
                handled solely by the exact .iso-hit polygons below. */}
            {texSrc && (
              <img
                className="iso-tile-tex"
                src={texSrc}
                alt=""
                draggable={false}
                /* inflated 1px on every side (and offset to stay centred) so
                   adjacent texture squares overlap by ~1px — this swallows the
                   thin transparent seams the fractional board scale leaves
                   between tiles. Front tiles (higher z-index) cover the overlap,
                   so the bleed is invisible. */
                style={{ left: -1, top: -TILE_W / 4 - 1, width: TILE_W + 2, height: TILE_W + 2 }}
              />
            )}
            {/* Overlay — highlight + click target must sit ABOVE the texture. */}
            <svg
              width={TILE_W}
              height={svgH}
              viewBox={`0 0 ${TILE_W} ${svgH}`}
              className="iso-cube iso-cube-overlay"
            >
              {/* highlight overlay (non-interactive) */}
              {hl && (
                <polygon
                  className={`iso-hl iso-hl-${hl}`}
                  points={topFace}
                />
              )}
              {/* transparent hit target — spans the WHOLE visible cube (top
                  diamond + side walls) so a click lands anywhere on the tile,
                  not only on the small top diamond. Front tiles sit at a higher
                  z-index, so they still win over the walls behind them. */}
              {/* onPointerDown does NOT stopPropagation: it lets the press bubble
                  to the viewport (which decides paint-drag vs pan) while telling
                  it WHICH tile was pressed via onTileDown. */}
              {EH > 0 && (
                <>
                  <polygon points={leftFace} fill="transparent" className="iso-hit"
                    onPointerDown={() => onTileDown?.(tile.x, tile.y, tile)}
                    onClick={(e) => { e.stopPropagation(); onTileClick?.(tile.x, tile.y, tile); }}
                    onMouseEnter={() => onTileHover?.(tile.x, tile.y, tile)} />
                  <polygon points={rightFace} fill="transparent" className="iso-hit"
                    onPointerDown={() => onTileDown?.(tile.x, tile.y, tile)}
                    onClick={(e) => { e.stopPropagation(); onTileClick?.(tile.x, tile.y, tile); }}
                    onMouseEnter={() => onTileHover?.(tile.x, tile.y, tile)} />
                </>
              )}
              <polygon
                points={topFace}
                fill="transparent"
                className="iso-hit"
                onPointerDown={() => onTileDown?.(tile.x, tile.y, tile)}
                onClick={(e) => {
                  e.stopPropagation();
                  onTileClick?.(tile.x, tile.y, tile);
                }}
                onMouseEnter={() => onTileHover?.(tile.x, tile.y, tile)}
              />
            </svg>

            {prop && (
              propSprites[tile.prop]
                ? <img className="iso-prop-img" src={propSprites[tile.prop]} alt={prop.label} draggable={false} />
                : <span className="iso-prop" style={{ top: -TILE_H * 0.55 }}>{prop.emoji}</span>
            )}
          </div>
        );
      })}
      </div>

      {/* Units layer — sits ABOVE the whole tile layer so unit clicks always
          win over front-tile hit polygons (depth-sorted among themselves). */}
      <div className="iso-units-layer">
      {units.map((u) => {
        const tile = map.tiles[u.y * map.w + u.x];
        const elev = tile?.elevation ?? 0;
        const [udx, udy] = rotateCoord(u.x, u.y, rotation, map.w, map.h);
        const stand = tileStandPoint(udx, udy, elev, origin);
        const depth = tileDepth(udx, udy);
        const sprite = u.dead ? u.deadSprite || u.sprite : u.sprite;
        const hpPct = u.maxHp ? Math.max(0, Math.min(100, (u.hp / u.maxHp) * 100)) : 100;

        return (
          <div
            key={`u-${u.id}`}
            className={`iso-unit ${u.dead ? "dead" : "alive"} side-${u.side}`}
            style={{
              left: stand.x,
              top: stand.y,
              zIndex: depth * 4 + 2,
            }}
          >
            {/* ground shadow anchors the sprite to the tile centre */}
            <div className="iso-unit-shadow" />
            {!u.dead && pingSet.has(u.id) && (
              <div className={`iso-unit-ping side-${u.side}`} aria-hidden="true">▼</div>
            )}
            {!u.dead && (u.cond === "advantage" || u.cond === "disadvantage") && (
              <div className={`iso-unit-cond ${u.cond}`} title={u.cond === "advantage" ? "Vantaggio al prossimo tiro" : "Svantaggio al prossimo tiro"}>
                {u.cond === "advantage" ? "⬆" : "⬇"}
              </div>
            )}
            {!u.dead && (
              <div className="iso-unit-bar">
                <div
                  className={`iso-unit-bar-fill ${u.side === "hero" ? "hero" : "enemy"}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            )}
            {sprite ? (
              <img
                className="iso-unit-sprite"
                src={sprite}
                alt={u.name}
                style={{ animationDelay: `${(u.x * 0.3 + u.y * 0.17).toFixed(2)}s`, "--face": facingById[u.id] ?? 1 }}
                draggable={false}
              />
            ) : (
              <div className="iso-unit-placeholder">
                {(u.name || "?")[0].toUpperCase()}
              </div>
            )}
            <span className="iso-unit-name">{(u.name || "").split(" ")[0]}</span>
            {/* only this small base at the feet is clickable — so the sprite's
                transparent bounding box no longer steals clicks from nearby tiles */}
            <div
              className="iso-unit-hit"
              onClick={(e) => { e.stopPropagation(); onUnitClick?.(u, e); }}
            />
          </div>
        );
      })}
      </div>

      {/* Transient pixel VFX layer (hit / heal / death bursts at a unit's tile).
          Each burst is a cluster of solid pixel squares animated via CSS. */}
      <div className="iso-vfx-layer">
      {vfx.map((e) => {
        // Area dome: dark floor pools (behind units) + a rough pixel hemisphere
        // (over them) that expands to swallow the whole blast.
        if (e.kind === "dome") {
          const dome = buildDome(e.cells, rotation, map, origin);
          if (!dome) return null;
          return (
            <React.Fragment key={`v-${e.id}`}>
              {dome.floors.map((f, i) => (
                <div
                  key={`f-${i}`}
                  className={`iso-vfx-floor dome-${e.domeKind}`}
                  style={{
                    left: f.x - TILE_W / 2, top: f.y, width: TILE_W, height: TILE_H,
                    zIndex: f.depth * 4 + 1,
                    animationDelay: `${(f.dist * 0.22).toFixed(2)}s`,
                  }}
                />
              ))}
              <div
                className={`iso-vfx-dome dome-${e.domeKind}`}
                style={{ left: dome.cx, top: dome.cy, zIndex: dome.depth * 4 + 6 }}
              >
                {dome.px.map((p, i) => (
                  <i
                    key={i}
                    style={{
                      left: p.x, top: p.y, width: dome.P, height: dome.P,
                      animationDelay: `${(p.edge * 0.55).toFixed(2)}s`,
                    }}
                  />
                ))}
              </div>
            </React.Fragment>
          );
        }
        const [vdx, vdy] = rotateCoord(e.x, e.y, rotation, map.w, map.h);
        const tile = map.tiles[e.y * map.w + e.x];
        const stand = tileStandPoint(vdx, vdy, tile?.elevation ?? 0, origin);

        // Projectile (arrow / magic bolt): flies from the source tile to the
        // target tile. The outer div animates the travel; the inner head is
        // rotated to point along the flight direction.
        if (e.kind === "arrow" || e.kind === "bolt") {
          const hasFrom = e.fromX != null && e.fromY != null;
          const [fdx, fdy] = hasFrom ? rotateCoord(e.fromX, e.fromY, rotation, map.w, map.h) : [vdx, vdy];
          const ft = hasFrom ? map.tiles[e.fromY * map.w + e.fromX] : tile;
          const from = tileStandPoint(fdx, fdy, ft?.elevation ?? 0, origin);
          const ang = (Math.atan2(stand.y - from.y, stand.x - from.x) * 180) / Math.PI;
          const depth = Math.max(tileDepth(vdx, vdy), tileDepth(fdx, fdy));
          return (
            <div
              key={`v-${e.id}`}
              className="iso-proj"
              style={{
                left: from.x, top: from.y - 24, zIndex: depth * 4 + 5,
                "--tx": `${stand.x - from.x}px`, "--ty": `${stand.y - from.y}px`,
              }}
            >
              <i className={`proj-head proj-${e.kind}`} style={{ transform: `rotate(${ang}deg)` }} />
            </div>
          );
        }
        // Sword slash — a quick silver streak over the target.
        if (e.kind === "slash") {
          return (
            <div key={`v-${e.id}`} className="iso-slash"
              style={{ left: stand.x, top: stand.y - 26, zIndex: tileDepth(vdx, vdy) * 4 + 5 }} />
          );
        }
        // Self-buff (Shield / +AC) — an expanding protective ring on the caster.
        if (e.kind === "shield") {
          return (
            <div key={`v-${e.id}`} className="iso-ring ring-shield"
              style={{ left: stand.x, top: stand.y - 22, zIndex: tileDepth(vdx, vdy) * 4 + 5 }} />
          );
        }

        const n = e.kind === "death" ? 8
          : (e.kind === "heal" || e.kind === "buff" || e.kind === "debuff") ? 5 : 6;
        return (
          <div
            key={`v-${e.id}`}
            className={`iso-vfx vfx-${e.kind}`}
            style={{ left: stand.x, top: stand.y, zIndex: tileDepth(vdx, vdy) * 4 + 3 }}
          >
            {Array.from({ length: n }, (_, i) => <i key={i} />)}
          </div>
        );
      })}
      </div>
    </div>
  );
}
