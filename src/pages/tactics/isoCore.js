// ─────────────────────────────────────────────────────────────────────────
// isoCore — geometry + data model for the FFT-style tactical grid.
//
// Pure functions only (no React). Shared by the renderer, the (future) map
// editor and the combat engine. Everything is computed from a "logical" board
// in CSS pixels; the renderer then scales the whole board to fit the viewport,
// which is what keeps the look identical on desktop and mobile.
// ─────────────────────────────────────────────────────────────────────────

// Diamond tile footprint (2:1 isometric) + vertical lift per elevation level.
export const TILE_W = 64;            // full width of the top diamond
export const TILE_H = TILE_W / 2;    // 32 — full height of the top diamond
export const ELEV_STEP = 14;         // px a tile rises per elevation level

export const MAX_GRID = 32;          // hard cap on map dimension (w & h)
export const MAX_ELEV = 10;          // hard cap on elevation

// ── Terrain catalogue ─────────────────────────────────────────────────────
// walkable:false   → cannot be entered at all (holes / void)
// speedFactor      → multiplies the unit's remaining move while STANDING on it
//                    (water = 0.5). Movement cost itself is handled in the
//                    pathfinder; this is the "stuck in it" penalty.
// turnDamage       → HP lost at the start of a turn spent on the tile (lava).
export const TERRAINS = {
  grass: { key: "grass", label: "Erba",  color: "#5a9e3f", walkable: true },
  stone: { key: "stone", label: "Pietra", color: "#8c8f99", walkable: true },
  sand:  { key: "sand",  label: "Sabbia", color: "#d8c489", walkable: true },
  dirt:  { key: "dirt",  label: "Terra",  color: "#8a6a45", walkable: true },
  wood:  { key: "wood",  label: "Legno",  color: "#9b6b3e", walkable: true },
  snow:  { key: "snow",  label: "Neve",   color: "#e8eef2", walkable: true },
  water: { key: "water", label: "Acqua",  color: "#3b78c4", walkable: true, speedFactor: 0.5 },
  lava:  { key: "lava",  label: "Lava",   color: "#d84b1e", walkable: true, turnDamage: 2 },
  acid:  { key: "acid",  label: "Acido",  color: "#8fbf3f", walkable: true, turnDamage: 2 },
  void:  { key: "void",  label: "Vuoto",  color: null,      walkable: false },
};

export const TERRAIN_KEYS = Object.keys(TERRAINS);

// ── Props that sit on a tile and BLOCK movement ───────────────────────────
export const PROPS = {
  tree:   { key: "tree",   label: "Albero",      emoji: "🌳", blocks: true },
  boulder:{ key: "boulder",label: "Sasso enorme",emoji: "🪨", blocks: true },
  column: { key: "column", label: "Colonna",     emoji: "🏛️", blocks: true },
};

// Default move range (in tiles) when a unit has no speed stat. 1 tile = 1 m.
export const DEFAULT_MOVE = 9;

// ── Tile / map helpers ────────────────────────────────────────────────────
export function makeTile(x, y, terrain = "grass", elevation = 0, prop = null) {
  return { x, y, terrain, elevation, prop };
}

/** Build a flat w×h map of a single terrain at elevation 0. */
export function makeFlatMap(w, h, terrain = "grass") {
  const tiles = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) tiles.push(makeTile(x, y, terrain, 0));
  return { w, h, tiles };
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
  return map.tiles[y * map.w + x] || null;
}

export function isWalkable(tile) {
  if (!tile) return false;
  const terr = TERRAINS[tile.terrain];
  if (!terr || !terr.walkable) return false;
  if (tile.prop && PROPS[tile.prop]?.blocks) return false;
  return true;
}

// ── View rotation (4 fixed 90° orientations) ──────────────────────────────
// Rotation is a RENDER-only transform: logic always stays in the original
// (x,y) grid coords. rotateCoord maps an original tile to the coords used for
// projection; odd rotations swap the effective board dimensions (w↔h).
export function rotateCoord(x, y, rotation, w, h) {
  switch (((rotation % 4) + 4) % 4) {
    case 1: return [y, (w - 1) - x];
    case 2: return [(w - 1) - x, (h - 1) - y];
    case 3: return [(h - 1) - y, x];
    default: return [x, y];
  }
}

// Inverse of rotateCoord: map a ROTATED (render-space) coord back to the
// original logical (x,y). Used by the click hit-tester to turn a picked
// render tile back into engine coordinates. w/h are the ORIGINAL board dims.
export function invRotateCoord(rx, ry, rotation, w, h) {
  switch (((rotation % 4) + 4) % 4) {
    case 1: return [(w - 1) - ry, rx];
    case 2: return [(w - 1) - rx, (h - 1) - ry];
    case 3: return [ry, (h - 1) - rx];
    default: return [rx, ry];
  }
}

// ── Isometric projection ──────────────────────────────────────────────────
// Returns the on-board pixel coords (before the viewport scale/offset) of the
// TOP-CENTER vertex of a tile's diamond. Elevation lifts the tile up (−y).
export function tileTopCenter(x, y, elevation, origin) {
  return {
    x: origin.x + (x - y) * (TILE_W / 2),
    y: origin.y + (x + y) * (TILE_H / 2) - elevation * ELEV_STEP,
  };
}

// The point a unit/prop visually "stands on": center of the top diamond.
export function tileStandPoint(x, y, elevation, origin) {
  const c = tileTopCenter(x, y, elevation, origin);
  return { x: c.x, y: c.y + TILE_H / 2 };
}

// Painter's-algorithm depth: larger = nearer the camera = drawn on top.
export function tileDepth(x, y) {
  return x + y;
}

/**
 * Compute the logical board size in px and the origin offset that keeps every
 * tile at positive coordinates (with a half-tile margin all around). maxElev
 * lifts the top edge, so we pad the top by maxElev * ELEV_STEP.
 */
export function computeBoardMetrics(map, rotation = 0) {
  const { w, h } = map;
  // odd rotations swap which dimension runs along each screen diagonal
  const Weff = rotation % 2 ? h : w;
  const Heff = rotation % 2 ? w : h;
  let maxElev = 0;
  for (const t of map.tiles) if (t.elevation > maxElev) maxElev = t.elevation;

  const originX = (Heff - 1) * (TILE_W / 2) + TILE_W / 2;
  const originY = TILE_H / 2 + maxElev * ELEV_STEP;

  const boardW = (Weff + Heff) * (TILE_W / 2);
  const boardH = (Weff + Heff) * (TILE_H / 2) + maxElev * ELEV_STEP + TILE_H;

  return { boardW, boardH, origin: { x: originX, y: originY }, maxElev };
}

// ── Movement / pathfinding ────────────────────────────────────────────────
export const JUMP = 1; // max elevation step per tile (climb one level at a time)

/**
 * Dijkstra flood from (sx,sy). Returns { costs, prev } where costs is a Map
 * "x,y" → cheapest cost, and prev is a Map "x,y" → "px,py" predecessor (for
 * path reconstruction). Enter-cost is 1 per tile, 2 for water (its 0.5
 * speedFactor = costs double to move through). A step is blocked if the
 * elevation gap exceeds JUMP, the tile isn't walkable, or it's occupied.
 * `occupied` is a Set of "x,y" to treat as impassable (other units).
 */
export function computePaths(map, sx, sy, move, occupied = new Set()) {
  const start = tileAt(map, sx, sy);
  const costs = new Map();
  const prev = new Map();
  if (!start) return { costs, prev };
  costs.set(`${sx},${sy}`, 0);
  const frontier = [{ x: sx, y: sy, c: 0 }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (frontier.length) {
    frontier.sort((a, b) => a.c - b.c);
    const cur = frontier.shift();
    const curTile = tileAt(map, cur.x, cur.y);
    if (cur.c > (costs.get(`${cur.x},${cur.y}`) ?? Infinity)) continue;

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nKey = `${nx},${ny}`;
      const nt = tileAt(map, nx, ny);
      if (!isWalkable(nt)) continue;
      if (occupied.has(nKey)) continue;
      if (Math.abs((nt.elevation || 0) - (curTile.elevation || 0)) > JUMP) continue;

      const terr = TERRAINS[nt.terrain];
      const enterCost = terr?.speedFactor && terr.speedFactor < 1 ? 2 : 1;
      const nc = cur.c + enterCost;
      if (nc > move) continue;
      if (nc < (costs.get(nKey) ?? Infinity)) {
        costs.set(nKey, nc);
        prev.set(nKey, `${cur.x},${cur.y}`);
        frontier.push({ x: nx, y: ny, c: nc });
      }
    }
  }
  return { costs, prev };
}

/** Map "x,y" → cost of every tile reachable within `move` (see computePaths). */
export function reachableTiles(map, sx, sy, move, occupied = new Set()) {
  return computePaths(map, sx, sy, move, occupied).costs;
}

/** Reconstruct the step list (incl. start and goal) from a `prev` map. */
export function reconstructPath(prev, sx, sy, tx, ty) {
  const goal = `${tx},${ty}`;
  if (`${sx},${sy}` === goal) return [{ x: sx, y: sy }];
  if (!prev.has(goal)) return null; // unreachable
  const path = [];
  let cur = goal;
  while (cur) {
    const [x, y] = cur.split(",").map(Number);
    path.unshift({ x, y });
    if (cur === `${sx},${sy}`) break;
    cur = prev.get(cur);
  }
  return path;
}

/** Manhattan (diamond) distance — the natural attack-range metric on the grid. */
export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Set of "x,y" tiles within `range` (Manhattan) of (x,y), incl. obstacles. */
export function tilesWithinRange(map, x, y, rangeMin, rangeMax) {
  const out = new Set();
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      const d = manhattan(x, y, tx, ty);
      if (d >= rangeMin && d <= rangeMax) out.add(`${tx},${ty}`);
    }
  }
  return out;
}

// ── Color utils (procedural shading of the cube faces) ────────────────────
export function shade(hex, factor) {
  if (!hex) return "#000";
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}
