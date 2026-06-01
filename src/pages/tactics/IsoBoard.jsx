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
//   highlights    { "x,y": "move"|"target"|"selected"|"path" }
//   scale         number — viewport fit factor
//   onTileClick   (x, y, tile) => void
//   onUnitClick   (unit, ev) => void
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState, useEffect } from "react";
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

export default function IsoBoard({
  map,
  units = [],
  highlights = {},
  scale = 1,
  rotation = 0,
  onTileClick,
  onUnitClick,
}) {
  const { boardW, boardH, origin } = useMemo(
    () => computeBoardMetrics(map, rotation),
    [map, rotation]
  );
  const tex = useTileTextures();

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
            {/* user-drawn iso cube tile (square PNG: diamond top + cube body).
                Scaled ×2 and lifted so the diamond-top vertex lands on the cell;
                the cube body hangs below. When absent we fall back to procedural
                polygons in the SVG. */}
            {texSrc && (
              <img
                className="iso-tile-tex"
                src={texSrc}
                alt=""
                draggable={false}
                style={{ left: 0, top: -TILE_W / 4, width: TILE_W, height: TILE_W }}
              />
            )}
            <svg
              width={TILE_W}
              height={svgH}
              viewBox={`0 0 ${TILE_W} ${svgH}`}
              className="iso-cube"
            >
              {!texSrc && EH > 0 && (
                <>
                  <polygon className="iso-face" points={leftFace} fill={shade(terr.color, 0.62)} />
                  <polygon className="iso-face" points={rightFace} fill={shade(terr.color, 0.46)} />
                </>
              )}
              {!texSrc && (
                <polygon
                  className="iso-face"
                  points={topFace}
                  fill={terr.color}
                  stroke={shade(terr.color, 1.18)}
                  strokeWidth="1"
                />
              )}
              {/* highlight overlay (non-interactive) */}
              {hl && (
                <polygon
                  className={`iso-hl iso-hl-${hl}`}
                  points={topFace}
                />
              )}
              {/* transparent hit target */}
              <polygon
                points={topFace}
                fill="transparent"
                className="iso-hit"
                onClick={(e) => {
                  e.stopPropagation();
                  onTileClick?.(tile.x, tile.y, tile);
                }}
              />
            </svg>

            {prop && (
              <span className="iso-prop" style={{ top: -TILE_H * 0.55 }}>
                {prop.emoji}
              </span>
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
                style={{ animationDelay: `${(u.x * 0.3 + u.y * 0.17).toFixed(2)}s` }}
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
    </div>
  );
}
