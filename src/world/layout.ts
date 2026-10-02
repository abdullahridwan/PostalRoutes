// Seabreeze Bay: the whole world, described in code.
// Terrain is painted with a few helpers, then buildings/props are dropped on top.

export const W = 64;
export const H = 48;

export type Terrain = "grass" | "path" | "water" | "forest" | "flowers";

const grid: Terrain[][] = Array.from({ length: H }, () => Array<Terrain>(W).fill("grass"));

function rect(t: Terrain, x: number, y: number, w: number, h: number) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) grid[j][i] = t;
}

// ── Forest borders ────────────────────────────────────────────
rect("forest", 0, 0, W, 4); // north
rect("forest", 0, 0, 4, 38); // west
rect("forest", 60, 0, 4, 28); // east

// ── The sea ───────────────────────────────────────────────────
rect("water", 0, 38, W, 10); // south coast
rect("water", 52, 28, 12, 20); // east bay
rect("water", 46, 34, 6, 4); // bay curls in
rect("water", 0, 36, 10, 2); // little western cove
rect("grass", 48, 40, 10, 6); // Lighthouse Isle

// ── Cliffside meadow (NW), walled in by pines ────────────────
rect("forest", 18, 4, 2, 14);
rect("forest", 4, 16, 16, 2);
rect("grass", 10, 16, 2, 2); // gap… blocked by boulders
rect("flowers", 5, 5, 3, 2);
rect("flowers", 13, 13, 4, 2);

// ── Flower meadow (NE) ────────────────────────────────────────
rect("flowers", 46, 4, 6, 3);
rect("flowers", 53, 6, 6, 4);
rect("flowers", 47, 12, 4, 2);
rect("forest", 56, 12, 4, 6);

// ── Paths (3 wide so the autotiler gives a nice sandy road) ───
rect("path", 4, 20, 50, 3); // Main Street
rect("path", 30, 6, 3, 14); // North Lane
rect("path", 30, 23, 3, 14); // Beach Lane
rect("path", 9, 18, 3, 2); // up to the boulders
rect("path", 33, 6, 14, 3); // to the meadow
rect("path", 22, 34, 9, 3); // to Finn's shed

// a few decorative flower beds in town
rect("flowers", 21, 8, 3, 2);
rect("flowers", 41, 24, 3, 2);
rect("flowers", 6, 24, 4, 2);
rect("flowers", 36, 34, 3, 2);

// ── Southern woods (fill + frame) ─────────────────────────────
rect("forest", 4, 28, 8, 8);
rect("forest", 42, 28, 10, 4);

export const terrain = grid;

// ── Buildings ────────────────────────────────────────────────
export type BuildingDef = {
  id: string;
  stamp: string;
  x: number;
  y: number;
  door: number; // door column within the stamp (bottom row)
  owner?: string; // villager id who receives mail here
  label: string;
};

export const BUILDINGS: BuildingDef[] = [
  { id: "post", stamp: "post_office", x: 34, y: 15, door: 3, label: "Post Office" },
  { id: "home", stamp: "cabin_grey", x: 22, y: 13, door: 3, label: "Your Cottage" },
  { id: "granny", stamp: "cabin_pink", x: 40, y: 13, door: 3, owner: "granny", label: "Marigold's Cottage" },
  { id: "mart", stamp: "mart", x: 24, y: 24, door: 2, owner: "mo", label: "Mo's Mart" },
  { id: "clinic", stamp: "clinic", x: 36, y: 24, door: 2, owner: "ada", label: "Seabreeze Clinic" },
  { id: "shelly", stamp: "house_brick", x: 13, y: 24, door: 3, owner: "shelly", label: "Shelly's House" },
  { id: "rosa", stamp: "house_orange", x: 47, y: 7, door: 3, owner: "rosa", label: "Rosa's Flower House" },
  { id: "tobi", stamp: "cabin_red", x: 8, y: 6, door: 3, owner: "tobi", label: "Cliffside Cabin" },
  { id: "finn", stamp: "warehouse", x: 19, y: 30, door: 4, owner: "finn", label: "Finn's Fish Shed" },
  { id: "captain", stamp: "barn", x: 51, y: 40, door: 2, owner: "captain", label: "Lighthouse Boathouse" },
];

export const PIERS = [{ x: 25, y: 37 }];

export const BOULDERS = [
  { x: 10, y: 16 },
  { x: 11, y: 16 },
];

// ── People ───────────────────────────────────────────────────
export type VillagerDef = {
  id: string;
  name: string;
  sprite: string;
  x: number;
  y: number;
  wander: number;
};

export const VILLAGERS: VillagerDef[] = [
  { id: "gull", name: "Postmaster Gull", sprite: "professor", x: 36, y: 19, wander: 0 },
  { id: "granny", name: "Granny Marigold", sprite: "granny", x: 46, y: 20, wander: 2 },
  { id: "mo", name: "Mo", sprite: "shopkeeper", x: 28, y: 28, wander: 0 },
  { id: "ada", name: "Nurse Ada", sprite: "nurse", x: 40, y: 28, wander: 2 },
  { id: "shelly", name: "Shelly", sprite: "beachcomber", x: 36, y: 36, wander: 3 },
  { id: "rosa", name: "Rosa", sprite: "florist", x: 50, y: 13, wander: 3 },
  { id: "tobi", name: "Tobi", sprite: "childactor", x: 14, y: 12, wander: 3 },
  { id: "finn", name: "Finn", sprite: "fisher", x: 26, y: 41, wander: 0 },
  { id: "captain", name: "Captain Barnaby", sprite: "riverboatcaptain", x: 55, y: 45, wander: 2 },
];

// ── Monsters ─────────────────────────────────────────────────
export type MonsterDef = {
  id: "pip" | "rocky" | "bzz";
  name: string;
  sprite: string;
  x: number;
  y: number;
  ability: string;
};

export const WILD_MONSTERS: MonsterDef[] = [
  { id: "rocky", name: "Rocky", sprite: "rockitten", x: 14, y: 19, ability: "Smash" },
  { id: "bzz", name: "Bzz", sprite: "bee", x: 55, y: 8, ability: "Zoom" },
];

export const PLAYER_START = { x: 25, y: 19 };
