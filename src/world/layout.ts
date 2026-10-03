// Seabreeze: two maps described in code (the village and the town square),
// joined by a road. Walking off the edge fades you to the other map.

export type Terrain = "grass" | "path" | "water" | "forest" | "flowers" | "cobble";
export type MapId = "village" | "square";
export type FacingDir = "down" | "left" | "right" | "up";

export type BuildingDef = {
  id: string;
  stamp: string;
  x: number;
  y: number;
  door: number; // door column within the stamp (bottom row)
  owner?: string; // villager id who receives mail here
  label: string;
};

export type Warp = {
  x: number; y: number; w: number; h: number;
  to: MapId;
  spawn: { x: number; y: number; dir: FacingDir };
  label: string;
};

export type MapDef = {
  id: MapId;
  name: string;
  W: number;
  H: number;
  terrain: Terrain[][];
  buildings: BuildingDef[];
  piers: { x: number; y: number }[];
  boulders: { x: number; y: number }[];
  fountains: { x: number; y: number }[];
  stalls: { x: number; y: number }[];
  warps: Warp[];
  regions: { label: string; x: number; y: number; lock?: "smash" | "swim" }[];
};

function painter(W: number, H: number) {
  const grid: Terrain[][] = Array.from({ length: H }, () => Array<Terrain>(W).fill("grass"));
  const rect = (t: Terrain, x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) grid[j][i] = t;
  };
  return { grid, rect };
}

// ═══ Seabreeze Village ════════════════════════════════════════
const village = (() => {
  const W = 64, H = 48;
  const { grid, rect } = painter(W, H);
  // forest borders
  rect("forest", 0, 0, W, 4);
  rect("forest", 0, 0, 4, 38);
  rect("forest", 60, 0, 4, 28);
  // the sea
  rect("water", 0, 38, W, 10);
  rect("water", 52, 28, 12, 20);
  rect("water", 46, 34, 6, 4);
  rect("water", 0, 36, 10, 2);
  rect("grass", 48, 40, 10, 6); // Lighthouse Isle
  // Cliffside meadow (NW), walled in by pines, boulders in the gap
  rect("forest", 18, 4, 2, 14);
  rect("forest", 4, 16, 16, 2);
  rect("grass", 10, 16, 2, 2);
  rect("flowers", 5, 5, 3, 2);
  rect("flowers", 13, 13, 4, 2);
  // Flower meadow (NE)
  rect("flowers", 46, 4, 6, 3);
  rect("flowers", 53, 6, 6, 4);
  rect("flowers", 47, 12, 4, 2);
  rect("forest", 56, 12, 4, 6);
  // paths (3 wide so the autotiler gives a nice sandy road)
  rect("path", 4, 20, 50, 3); // Main Street
  rect("path", 30, 0, 3, 20); // North Road → Town Square
  rect("path", 30, 23, 3, 14); // Beach Lane
  rect("path", 9, 18, 3, 2); // up to the boulders
  rect("path", 33, 6, 14, 3); // to the meadow
  rect("path", 22, 34, 9, 3); // to Finn's shed
  // flower beds
  rect("flowers", 21, 8, 3, 2);
  rect("flowers", 24, 25, 4, 2);
  rect("flowers", 6, 24, 4, 2);
  rect("flowers", 36, 34, 3, 2);
  rect("flowers", 34, 15, 4, 2);
  // southern woods
  rect("forest", 4, 28, 8, 8);
  rect("forest", 42, 28, 10, 4);

  const def: MapDef = {
    id: "village", name: "Seabreeze Village", W, H, terrain: grid,
    buildings: [
      { id: "home", stamp: "cabin_grey", x: 22, y: 13, door: 3, label: "Your Cottage" },
      { id: "granny", stamp: "cabin_pink", x: 40, y: 13, door: 3, owner: "granny", label: "Marigold's Cottage" },
      { id: "clinic", stamp: "clinic", x: 36, y: 24, door: 2, owner: "ada", label: "Seabreeze Clinic" },
      { id: "shelly", stamp: "house_brick", x: 13, y: 24, door: 3, owner: "shelly", label: "Shelly's House" },
      { id: "rosa", stamp: "house_orange", x: 47, y: 7, door: 3, owner: "rosa", label: "Rosa's Flower House" },
      { id: "tobi", stamp: "cabin_red", x: 8, y: 6, door: 3, owner: "tobi", label: "Cliffside Cabin" },
      { id: "finn", stamp: "warehouse", x: 19, y: 30, door: 4, owner: "finn", label: "Finn's Fish Shed" },
      { id: "captain", stamp: "barn", x: 51, y: 40, door: 2, owner: "captain", label: "Lighthouse Boathouse" },
    ],
    piers: [{ x: 25, y: 37 }],
    boulders: [{ x: 10, y: 16 }, { x: 11, y: 16 }],
    fountains: [],
    stalls: [],
    warps: [{ x: 30, y: 0, w: 3, h: 1, to: "square", spawn: { x: 23, y: 32, dir: "up" }, label: "Town Square" }],
    regions: [
      { label: "Cliffside", x: 12, y: 14.6, lock: "smash" },
      { label: "Flower Meadow", x: 56.5, y: 9.6 },
      { label: "Lighthouse Isle", x: 53, y: 46.6, lock: "swim" },
      { label: "↑ Town Square", x: 31.5, y: 4.5 },
    ],
  };
  return def;
})();

// ═══ Town Square ══════════════════════════════════════════════
// A real square: the Post Office faces the fountain from the north, shops sit
// round the edges at different depths, and Swiftline's depot looms in the SE corner.
const square = (() => {
  const W = 48, H = 34;
  const { grid, rect } = painter(W, H);
  // forest frame
  rect("forest", 0, 0, W, 5);
  rect("forest", 0, 0, 3, H);
  rect("forest", 45, 0, 3, H);
  rect("forest", 0, 31, W, 3);
  rect("forest", 3, 6, 5, 5); // little groves
  rect("forest", 3, 25, 6, 5);
  rect("forest", 40, 6, 4, 6);
  // the cobbled plaza, plus a forecourt in front of every shop door
  rect("cobble", 12, 13, 24, 18);
  rect("cobble", 21, 10, 5, 3); // Post Office forecourt
  rect("cobble", 9, 12, 6, 2); // Stationery
  rect("cobble", 34, 11, 5, 3); // Tailor
  rect("cobble", 5, 21, 8, 3); // Bakery
  rect("cobble", 36, 20, 8, 3); // Mart
  rect("cobble", 36, 29, 8, 2); // Swiftline depot
  rect("path", 22, 31, 3, 3); // road home to the village
  // flowers
  rect("flowers", 16, 7, 3, 2);
  rect("flowers", 27, 7, 3, 2);
  rect("flowers", 9, 15, 3, 2);
  rect("flowers", 38, 14, 3, 2);

  const def: MapDef = {
    id: "square", name: "Town Square", W, H, terrain: grid,
    buildings: [
      { id: "post", stamp: "post_office", x: 20, y: 6, door: 3, label: "Post Office" },
      { id: "stationery", stamp: "house_orange", x: 8, y: 8, door: 3, owner: "pell", label: "Pell's Stationery" },
      { id: "tailor", stamp: "cabin_red", x: 33, y: 5, door: 3, owner: "sable", label: "Sable's Tailor" },
      { id: "bakery", stamp: "house_brick", x: 4, y: 17, door: 3, owner: "dot", label: "Dot's Bakery" },
      { id: "mart", stamp: "mart", x: 40, y: 16, door: 2, owner: "mo", label: "Mo's Mart" },
      { id: "depot", stamp: "warehouse", x: 37, y: 25, door: 4, label: "Swiftline Depot" },
    ],
    piers: [],
    boulders: [],
    fountains: [{ x: 22, y: 17 }],
    stalls: [{ x: 13, y: 24 }, { x: 29, y: 22 }],
    warps: [{ x: 22, y: 33, w: 3, h: 1, to: "village", spawn: { x: 31, y: 1, dir: "down" }, label: "Village" }],
    regions: [{ label: "↓ Village", x: 23.5, y: 31.5 }],
  };
  return def;
})();

export const MAPS: Record<MapId, MapDef> = { village, square };

// ── People ───────────────────────────────────────────────────
export type VillagerDef = {
  id: string;
  name: string;
  sprite: string;
  map: MapId;
  x: number;
  y: number;
  wander: number;
  /** Midday spot, usually beside a friend in the square, where gossip happens. */
  hangout?: { map: MapId; x: number; y: number };
  /** Friends hear about what you do for this villager (word of mouth). */
  friends?: string[];
  /** Counts toward the Council vote. */
  voter?: boolean;
  /** What they appreciate, shown in the Townsfolk page. */
  likes?: string;
};

export const VILLAGERS: VillagerDef[] = [
  // Town Square
  { id: "gull", name: "Postmaster Gull", sprite: "professor", map: "square", x: 25, y: 11, wander: 0 },
  { id: "vane", name: "Director Vane", sprite: "magician", map: "square", x: 35, y: 26, wander: 0 },
  { id: "dot", name: "Dot the Baker", sprite: "homemaker", map: "square", x: 6, y: 22, wander: 1, voter: true,
    friends: ["mo", "ada"], hangout: { map: "square", x: 18, y: 22 }, likes: "Fast deliveries (bread goes stale!)" },
  { id: "pell", name: "Pell the Stationer", sprite: "shopassistant", map: "square", x: 14, y: 12, wander: 1, voter: true,
    friends: ["mo", "sable", "mayor"], hangout: { map: "square", x: 20, y: 23 }, likes: "Neat, on-time post" },
  { id: "sable", name: "Sable the Tailor", sprite: "fashionista", map: "square", x: 34, y: 12, wander: 1, voter: true,
    friends: ["rosa", "pell"], hangout: { map: "square", x: 21, y: 22 }, likes: "A sharp uniform" },
  { id: "mo", name: "Mo", sprite: "shopkeeper", map: "square", x: 40, y: 21, wander: 0, voter: true,
    friends: ["finn", "dot", "pell"], hangout: { map: "square", x: 19, y: 21 }, likes: "Monsters being well fed" },
  { id: "mayor", name: "Mayor Hollyhock", sprite: "ceo", map: "square", x: 28, y: 20, wander: 3, voter: true,
    friends: ["ada", "pell", "granny"], likes: "Reliability. He's undecided." },
  // Village
  { id: "granny", name: "Granny Marigold", sprite: "granny", map: "village", x: 46, y: 20, wander: 2, voter: true,
    friends: ["rosa", "captain", "ada"], hangout: { map: "square", x: 20, y: 25 }, likes: "Letters handed over in person" },
  { id: "rosa", name: "Rosa", sprite: "florist", map: "village", x: 52, y: 12, wander: 2, voter: true,
    friends: ["granny", "finn", "sable"], hangout: { map: "square", x: 22, y: 24 }, likes: "Early mornings and flowers" },
  { id: "ada", name: "Nurse Ada", sprite: "nurse", map: "village", x: 40, y: 28, wander: 2, voter: true,
    friends: ["granny", "dot", "mayor"], hangout: { map: "square", x: 24, y: 24 }, likes: "Checking in on folks" },
  { id: "finn", name: "Finn", sprite: "fisher", map: "village", x: 26, y: 41, wander: 0, voter: true,
    friends: ["rosa", "mo", "captain"], hangout: { map: "square", x: 26, y: 22 }, likes: "Being left alone (mostly)" },
  { id: "shelly", name: "Shelly", sprite: "beachcomber", map: "village", x: 36, y: 36, wander: 3, voter: true,
    friends: ["tobi", "finn"], likes: "Anything the tide brings in" },
  { id: "tobi", name: "Tobi", sprite: "childactor", map: "village", x: 14, y: 12, wander: 3, voter: true,
    friends: ["shelly", "rosa"], likes: "Getting ANY mail at all" },
  { id: "captain", name: "Captain Barnaby", sprite: "riverboatcaptain", map: "village", x: 55, y: 45, wander: 2, voter: true,
    friends: ["granny", "finn"], likes: "Visitors brave enough to swim" },
];

export const VOTES_NEEDED = 7;

// ── Monsters ─────────────────────────────────────────────────
export type MonsterDef = {
  id: "pip" | "rocky" | "bzz";
  name: string;
  sprite: string;
  map: MapId;
  x: number;
  y: number;
  ability: string;
};

export const WILD_MONSTERS: MonsterDef[] = [
  { id: "rocky", name: "Rocky", sprite: "rockitten", map: "village", x: 14, y: 19, ability: "Smash" },
  { id: "bzz", name: "Bzz", sprite: "bee", map: "village", x: 55, y: 8, ability: "Zoom" },
];

/** A fresh game opens in the Town Square, outside the boarded-up post office. */
export const INTRO_START = { map: "square" as MapId, x: 23, y: 13, dir: "up" as FacingDir };

/** Every morning you wake at your cottage door. */
export const PLAYER_START = { map: "village" as MapId, x: 25, y: 19 };

/** Which building (on which map) a villager's mail goes to. */
export function homeOf(villagerId: string) {
  for (const m of Object.values(MAPS)) {
    const b = m.buildings.find((b) => b.owner === villagerId);
    if (b) return { map: m.id, building: b };
  }
  return null;
}

/** Every building on every map. */
export const ALL_BUILDINGS = Object.values(MAPS).flatMap((m) => m.buildings.map((b) => ({ ...b, map: m.id })));
