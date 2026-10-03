// Turns the code layout into tile layers + a collision grid.
import stampsJson from "../data/stamps.json";
import interiorsJson from "../data/interiors.json";
import type { MapDef, Terrain } from "./layout";
import { STONE, FLOWERS, FOUNTAIN, GRASS, PATH_TILES, SHORE_TILES, STALL, TREE, WATER_FRAMES, gid } from "./tiles";

type StampTile = [string, number] | null;
type Stamp = { w: number; h: number; layers: { above: boolean; tiles: StampTile[][] }[] };
const STAMPS = stampsJson as unknown as Record<string, Stamp>;
export const INTERIORS = interiorsJson as unknown as Record<string, { w: number; h: number; solid: number[][] }>;

export const BELOW_LAYERS = 4; // ground, overlay, deco1, deco2
export type LayerGrid = number[][]; // gid per cell, 0 = empty

export type World = {
  below: LayerGrid[];
  above: LayerGrid[];
  waterCells: { x: number; y: number }[];
  /** Fountain tiles with their frame-0 gid, for animation. */
  fountainCells: { x: number; y: number; gid: number }[];
  solid: boolean[][];
  water: boolean[][];
  doors: { id: string; x: number; y: number }[];
  mailboxes: { id: string; x: number; y: number }[];
  /** interiors are pre-rendered images; this is their key */
  interior?: string;
};

// The map currently being built (set at the top of buildWorld).
let W = 0, H = 0;
let terrain: Terrain[][] = [];

const blank = (): LayerGrid => Array.from({ length: H }, () => Array<number>(W).fill(0));

function at(x: number, y: number): Terrain {
  const cx = Math.max(0, Math.min(W - 1, x));
  const cy = Math.max(0, Math.min(H - 1, y));
  return terrain[cy][cx];
}

/** Corner mask for a cell of terrain `t`: a corner counts only if all 4 cells sharing it are `t`. */
function cornerMask(x: number, y: number, t: Terrain): number {
  // sand paths run flush into the cobbled square
  const same = (o: Terrain) => o === t || (t === "path" && o === "stone");
  const is = (dx: number, dy: number) => same(at(x + dx, y + dy));
  let m = 0;
  if (is(-1, 0) && is(0, -1) && is(-1, -1)) m |= 1; // NW
  if (is(1, 0) && is(0, -1) && is(1, -1)) m |= 2; // NE
  if (is(-1, 0) && is(0, 1) && is(-1, 1)) m |= 4; // SW
  if (is(1, 0) && is(0, 1) && is(1, 1)) m |= 8; // SE
  return m;
}

// Deterministic sprinkle so the world looks the same every load.
function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function buildWorld(map: MapDef): World {
  W = map.W;
  H = map.H;
  terrain = map.terrain;
  if (map.interior) {
    const solid = INTERIORS[map.interior].solid.map((row) => row.map((c) => !!c));
    return {
      below: [], above: [], waterCells: [], fountainCells: [], solid,
      water: Array.from({ length: H }, () => Array<boolean>(W).fill(false)),
      doors: [], mailboxes: [], interior: map.interior,
    };
  }
  const below = Array.from({ length: BELOW_LAYERS }, blank);
  const above = [blank(), blank()];
  const solid = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const water = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const waterCells: { x: number; y: number }[] = [];
  const [ground, overlay, deco1, deco2] = below;

  // 1. Terrain + autotiling
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = terrain[y][x];
      ground[y][x] = GRASS;
      if (t === "water") {
        ground[y][x] = WATER_FRAMES[0];
        waterCells.push({ x, y });
        const m = cornerMask(x, y, "water");
        if (m !== 15) overlay[y][x] = SHORE_TILES[m] ?? 0;
        water[y][x] = true;
        solid[y][x] = true;
      } else if (t === "stone") {
        ground[y][x] = STONE[y % 2][x % 2];
      } else if (t === "path") {
        ground[y][x] = PATH_TILES[cornerMask(x, y, "path")] ?? PATH_TILES[15];
      } else if (t === "flowers") {
        if (hash(x, y) < 0.55) ground[y][x] = FLOWERS[Math.floor(hash(y, x) * FLOWERS.length)];
      } else if (t === "forest") {
        solid[y][x] = true;
      }
    }
  }

  // 2. Trees on 2x2 forest blocks (canopy hangs over the row above, drawn above player)
  const covered = Array.from({ length: H }, () => Array<boolean>(W).fill(false));
  const isForest = (x: number, y: number) => x < W && y < H && terrain[y][x] === "forest" && !covered[y][x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!(isForest(x, y) && isForest(x + 1, y) && isForest(x, y + 1) && isForest(x + 1, y + 1))) continue;
      for (let i = 0; i < 2; i++) {
        covered[y][x + i] = covered[y + 1][x + i] = true;
        // alternate decoration layers so neighbouring trees overlap nicely
        const layer = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 ? deco1 : deco2;
        layer[y][x + i] = TREE.mid[i];
        layer[y + 1][x + i] = TREE.trunk[i];
        if (y > 0) above[Math.floor(y / 2) % 2][y - 1][x + i] = TREE.canopy[i];
      }
    }
  }

  // 3. Piers (walkable over water: middle column)
  for (const p of map.piers) {
    stampAt("pier", p.x, p.y, below, above, () => {});
    for (let j = 0; j < STAMPS.pier.h; j++) {
      solid[p.y + j][p.x + 1] = false;
      water[p.y + j][p.x + 1] = false;
    }
  }

  // 4. Buildings
  const doors: World["doors"] = [];
  const mailboxes: World["mailboxes"] = [];
  for (const b of map.buildings) {
    const s = STAMPS[b.stamp];
    stampAt(b.stamp, b.x, b.y, below, above, (x, y) => (solid[y][x] = true));
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) solid[b.y + j][b.x + i] = true;
    const door = { id: b.id, x: b.x + b.door, y: b.y + s.h - 1 };
    doors.push(door);
    if (b.owner) {
      // mailbox sits just right of the doorstep
      const mx = door.x + 1, my = door.y + 1;
      mailboxes.push({ id: b.id, x: mx, y: my });
      solid[my][mx] = true;
    }
  }

  // doors that are warps (the post office) are walkable so you can step inside
  for (const w of map.warps) {
    const inside = map.buildings.some((b) => w.x >= b.x && w.x < b.x + STAMPS[b.stamp].w && w.y >= b.y && w.y < b.y + STAMPS[b.stamp].h);
    if (inside) for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) solid[w.y + j][w.x + i] = false;
  }

  // 5. Town square props
  const fountainCells: World["fountainCells"] = [];
  for (const f of map.fountains) {
    FOUNTAIN.rows.forEach((row, j) => row.forEach((g, i) => {
      deco1[f.y + j][f.x + i] = g;
      solid[f.y + j][f.x + i] = true;
      fountainCells.push({ x: f.x + i, y: f.y + j, gid: g });
    }));
  }
  for (const st of map.stalls) {
    STALL.base.forEach((row, j) => row.forEach((g, i) => {
      deco1[st.y + j][st.x + i] = g;
      solid[st.y + j][st.x + i] = true;
    }));
    STALL.crates.forEach((row, j) => row.forEach((g, i) => { if (g) deco2[st.y + j][st.x + i] = g; }));
  }

  return { below, above, waterCells, fountainCells, solid, water, doors, mailboxes };
}

function stampAt(
  name: string, ox: number, oy: number,
  below: LayerGrid[], above: LayerGrid[],
  onCell: (x: number, y: number) => void,
) {
  const s = STAMPS[name];
  let bi = 2; // stamps start on deco layers
  let ai = 0;
  for (const L of s.layers) {
    const target = L.above ? above[Math.min(ai++, above.length - 1)] : below[Math.min(bi++, below.length - 1)];
    L.tiles.forEach((row, j) =>
      row.forEach((t, i) => {
        const x = ox + i, y = oy + j;
        if (!t || x >= W || y >= H) return;
        target[y][x] = gid(t[0], t[1]);
        onCell(x, y);
      }),
    );
  }
}
