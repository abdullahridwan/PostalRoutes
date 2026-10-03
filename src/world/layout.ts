// Seabreeze: a chain of places described in code.
//
//                 Orchard Meadow
//                       |
//  Harbour Village ── TOWN SQUARE (post office, shops, depot)
//        |
//  Lighthouse Point   (+ ferry dock to future villages)
//
// Only the post office has an interior (sorting hall + your flat upstairs).

export type Terrain = "grass" | "path" | "water" | "forest" | "flowers" | "stone";
export type MapId = "square" | "village" | "orchard" | "point" | "office" | "flat";
export type FacingDir = "down" | "left" | "right" | "up";

export type BuildingDef = {
  id: string;
  stamp: string;
  x: number;
  y: number;
  door: number; // door column within the stamp (bottom row)
  owner?: string; // villager who receives mail here
  label: string;
};

export type Warp = {
  x: number; y: number; w: number; h: number;
  to: MapId;
  spawn: { x: number; y: number; dir: FacingDir };
  label: string;
  /** walking in is blocked until this flag is true (see World.warpOpen) */
  needs?: "bridge";
};

/** Something you can press E on: signs, boards, the bed, the stairs… */
export type Hotspot = { id: string; x: number; y: number; prompt: string };
export type Decor = { tex: string; x: number; y: number; depth?: number };

export type MapDef = {
  id: MapId;
  name: string;
  W: number;
  H: number;
  terrain: Terrain[][];
  buildings: BuildingDef[];
  piers: { x: number; y: number }[];
  fountains: { x: number; y: number }[];
  stalls: { x: number; y: number }[];
  warps: Warp[];
  hotspots: Hotspot[];
  decor: Decor[];
  regions: { label: string; x: number; y: number; lock?: "bridge" }[];
  interior?: string; // key into src/data/interiors.json and public/assets/interiors
  forage?: { kind: "flower" | "shell"; x: number; y: number }[];
};

const EMPTY = { piers: [], fountains: [], stalls: [], warps: [], hotspots: [], decor: [], regions: [], buildings: [] };

function painter(W: number, H: number) {
  const grid: Terrain[][] = Array.from({ length: H }, () => Array<Terrain>(W).fill("grass"));
  const rect = (t: Terrain, x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) grid[j][i] = t;
  };
  return { grid, rect };
}

// ═══ Town Square ══════════════════════════════════════════════
// Stone-paved. The Post Office stands back on its own forecourt, the main building of the
// town; shops line the side streets; Swiftline's depot is across the square.
const square = (() => {
  const W = 50, H = 36;
  const { grid, rect } = painter(W, H);
  rect("forest", 0, 0, W, 4);
  rect("forest", 0, 0, 3, H);
  rect("forest", 47, 0, 3, H);
  rect("forest", 0, 33, W, 3);
  rect("forest", 12, 4, 6, 5); // groves flanking the post office
  rect("forest", 31, 4, 6, 5);
  rect("stone", 16, 8, 18, 5); // post office forecourt
  rect("stone", 8, 12, 34, 19); // the plaza
  rect("stone", 38, 16, 7, 4); // in front of the bike shop
  rect("stone", 22, 31, 3, 2);
  rect("path", 22, 33, 3, 3); // south road to the harbour
  rect("path", 44, 17, 6, 3); // east road to the orchard
  rect("flowers", 4, 30, 4, 2);
  const def: MapDef = {
    ...EMPTY, id: "square", name: "Town Square", W, H, terrain: grid,
    buildings: [
      { id: "post", stamp: "post_office", x: 22, y: 4, door: 3, label: "Post Office" },
      { id: "stationery", stamp: "house_orange", x: 6, y: 13, door: 3, owner: "pell", label: "Pell's Stationery" },
      { id: "bakery", stamp: "house_brick", x: 6, y: 21, door: 3, owner: "dot", label: "Dot's Bakery" },
      { id: "bike", stamp: "cabin_red", x: 39, y: 11, door: 3, owner: "sable", label: "Sable's Bike Shop" },
      { id: "mart", stamp: "mart", x: 38, y: 21, door: 2, owner: "mo", label: "Mo's Mart" },
      { id: "depot", stamp: "warehouse", x: 28, y: 26, door: 4, label: "Swiftline Depot" },
    ],
    fountains: [{ x: 23, y: 17 }],
    stalls: [{ x: 13, y: 21 }, { x: 31, y: 21 }],
    warps: [
      { x: 22, y: 35, w: 3, h: 1, to: "village", spawn: { x: 31, y: 1, dir: "down" }, label: "Harbour Village" },
      { x: 49, y: 17, w: 1, h: 3, to: "orchard", spawn: { x: 1, y: 19, dir: "right" }, label: "Orchard Meadow" },
      { x: 25, y: 7, w: 1, h: 1, to: "office", spawn: { x: 6, y: 9, dir: "up" }, label: "Post Office" },
    ],
    regions: [
      { label: "↓ Harbour Village", x: 24, y: 32 },
      { label: "Orchard Meadow →", x: 44, y: 15.8 },
    ],
  };
  return def;
})();

/** Where Swiftline parks a drone locker as it takes over (see share in the HUD). */
export const LOCKER_SPOTS = [{ x: 12, y: 19 }, { x: 36, y: 20 }, { x: 14, y: 28 }, { x: 34, y: 15 }];

// ═══ Harbour Village ══════════════════════════════════════════
const village = (() => {
  const W = 64, H = 48;
  const { grid, rect } = painter(W, H);
  rect("forest", 0, 0, W, 4);
  rect("forest", 0, 0, 4, 38);
  rect("forest", 60, 0, 4, 28);
  rect("water", 0, 38, W, 10);
  rect("water", 52, 28, 12, 20);
  rect("water", 46, 34, 6, 4);
  rect("water", 0, 36, 10, 2);
  rect("forest", 18, 4, 2, 14);
  rect("forest", 4, 16, 16, 2);
  rect("flowers", 13, 13, 4, 2);
  rect("forest", 56, 12, 4, 6);
  rect("path", 4, 20, 60, 3); // Harbour Road, all the way to the cliff path
  rect("path", 30, 0, 3, 20); // North Road → Town Square
  rect("path", 30, 23, 3, 14); // Beach Lane
  rect("path", 22, 34, 9, 3); // to Finn's shed
  rect("flowers", 21, 8, 3, 2);
  rect("flowers", 24, 25, 4, 2);
  rect("flowers", 6, 24, 4, 2);
  rect("flowers", 36, 34, 3, 2);
  rect("flowers", 34, 15, 4, 2);
  rect("forest", 4, 28, 8, 8);
  rect("forest", 42, 28, 10, 4);
  const def: MapDef = {
    ...EMPTY, id: "village", name: "Harbour Village", W, H, terrain: grid,
    buildings: [
      { id: "granny", stamp: "cabin_pink", x: 40, y: 13, door: 3, owner: "granny", label: "Marigold's Cottage" },
      { id: "clinic", stamp: "clinic", x: 36, y: 24, door: 2, owner: "ada", label: "Seabreeze Clinic" },
      { id: "shelly", stamp: "house_brick", x: 13, y: 24, door: 3, owner: "shelly", label: "Shelly's House" },
      { id: "finn", stamp: "warehouse", x: 19, y: 30, door: 4, owner: "finn", label: "Finn's Fish Shed" },
    ],
    piers: [{ x: 25, y: 37 }, { x: 47, y: 31 }],
    warps: [
      { x: 30, y: 0, w: 3, h: 1, to: "square", spawn: { x: 23, y: 34, dir: "up" }, label: "Town Square" },
      { x: 63, y: 20, w: 1, h: 3, to: "point", spawn: { x: 1, y: 19, dir: "right" }, label: "Lighthouse Point", needs: "bridge" },
    ],
    hotspots: [
      { id: "ferry_sign", x: 50, y: 30, prompt: "Read the ferry sign" },
      { id: "bridge_sign", x: 57, y: 19, prompt: "Read the sign" },
    ],
    regions: [
      { label: "↑ Town Square", x: 31.5, y: 4.5 },
      { label: "Lighthouse Point →", x: 56, y: 18.2, lock: "bridge" },
      { label: "Ferry dock", x: 48.5, y: 29.6 },
    ],
    forage: [
      { kind: "shell", x: 28, y: 36 }, { kind: "shell", x: 33, y: 37 }, { kind: "shell", x: 20, y: 36 },
      { kind: "shell", x: 40, y: 36 }, { kind: "shell", x: 14, y: 35 }, { kind: "shell", x: 45, y: 33 },
      { kind: "shell", x: 36, y: 31 }, { kind: "shell", x: 24, y: 33 },
    ],
  };
  return def;
})();

/** The footbridge to the Point stays blocked until it's rebuilt. */
export const BRIDGE_BARRIER = [{ x: 58, y: 20 }, { x: 58, y: 21 }, { x: 58, y: 22 }];

// ═══ Orchard Meadow ═══════════════════════════════════════════
const orchard = (() => {
  const W = 56, H = 40;
  const { grid, rect } = painter(W, H);
  rect("forest", 0, 0, W, 4);
  rect("forest", 0, 0, 3, H);
  rect("forest", 53, 0, 3, H);
  rect("forest", 0, 37, W, 3);
  rect("flowers", 6, 6, 10, 6);
  rect("flowers", 8, 24, 12, 6);
  rect("flowers", 24, 28, 8, 5);
  rect("flowers", 44, 22, 6, 5);
  rect("forest", 20, 4, 8, 6); // fruit-tree groves
  rect("forest", 6, 32, 6, 5);
  rect("forest", 40, 30, 8, 6);
  rect("forest", 30, 15, 4, 4);
  rect("path", 0, 18, 56, 3); // the meadow road
  rect("path", 40, 14, 3, 5); // up to Rosa's
  rect("path", 16, 12, 3, 6); // to the picnic spot
  rect("stone", 20, 21, 12, 7); // festival grounds
  rect("path", 24, 28, 4, 5);
  const def: MapDef = {
    ...EMPTY, id: "orchard", name: "Orchard Meadow", W, H, terrain: grid,
    buildings: [{ id: "rosa", stamp: "house_orange", x: 38, y: 10, door: 3, owner: "rosa", label: "Rosa's Flower House" }],
    warps: [{ x: 0, y: 18, w: 1, h: 3, to: "square", spawn: { x: 48, y: 18, dir: "left" }, label: "Town Square" }],
    hotspots: [{ id: "picnic", x: 17, y: 11, prompt: "Admire the picnic spot" }],
    regions: [
      { label: "← Town Square", x: 4, y: 17 },
      { label: "Festival Grounds", x: 26, y: 20.5 },
    ],
    forage: [
      { kind: "flower", x: 8, y: 8 }, { kind: "flower", x: 12, y: 10 }, { kind: "flower", x: 14, y: 7 },
      { kind: "flower", x: 10, y: 26 }, { kind: "flower", x: 16, y: 28 }, { kind: "flower", x: 27, y: 30 },
      { kind: "flower", x: 30, y: 31 }, { kind: "flower", x: 46, y: 24 }, { kind: "flower", x: 48, y: 25 },
      { kind: "flower", x: 18, y: 26 },
    ],
  };
  return def;
})();

// ═══ Lighthouse Point ═════════════════════════════════════════
const point = (() => {
  const W = 48, H = 36;
  const { grid, rect } = painter(W, H);
  rect("water", 0, 0, W, 4);
  rect("water", 0, 30, W, 6);
  rect("water", 40, 0, 8, H);
  rect("forest", 0, 4, 3, 26);
  rect("forest", 6, 22, 5, 4);
  rect("forest", 28, 22, 6, 5);
  rect("flowers", 18, 12, 6, 3);
  rect("flowers", 4, 6, 4, 3);
  rect("path", 0, 18, 30, 3); // cliff path out to the lighthouse
  rect("path", 28, 10, 3, 9);
  rect("path", 10, 12, 3, 7);
  rect("stone", 26, 5, 8, 6); // lighthouse apron
  const def: MapDef = {
    ...EMPTY, id: "point", name: "Lighthouse Point", W, H, terrain: grid,
    buildings: [
      { id: "tobi", stamp: "cabin_red", x: 8, y: 8, door: 3, owner: "tobi", label: "Tobi's Cabin" },
      { id: "captain", stamp: "barn", x: 14, y: 21, door: 2, owner: "captain", label: "The Boathouse" },
    ],
    warps: [{ x: 0, y: 18, w: 1, h: 3, to: "village", spawn: { x: 62, y: 21, dir: "left" }, label: "Harbour Village" }],
    hotspots: [{ id: "lighthouse", x: 30, y: 10, prompt: "Look at the lighthouse" }],
    regions: [
      { label: "← Harbour Village", x: 5, y: 17 },
      { label: "The Lighthouse", x: 31, y: 3.8 },
    ],
    forage: [
      { kind: "shell", x: 12, y: 29 }, { kind: "shell", x: 20, y: 29 }, { kind: "shell", x: 27, y: 29 },
      { kind: "shell", x: 35, y: 29 }, { kind: "shell", x: 38, y: 24 }, { kind: "shell", x: 6, y: 29 },
    ],
  };
  return def;
})();

/** The lighthouse is a 3-wide prop (drawn in code); its footprint is solid. */
export const LIGHTHOUSE = { x: 29, y: 8, w: 3, h: 3 };

// ═══ The Post Office (interior) ═══════════════════════════════
const office: MapDef = {
  ...EMPTY, id: "office", name: "Seabreeze Post Office", W: 13, H: 11, terrain: [], interior: "office",
  warps: [{ x: 6, y: 10, w: 1, h: 1, to: "square", spawn: { x: 25, y: 8, dir: "down" }, label: "Outside" }],
  hotspots: [
    { id: "helpers", x: 4, y: 2, prompt: "Helper Board" },
    { id: "helpers", x: 5, y: 2, prompt: "Helper Board" },
    { id: "bulletin", x: 6, y: 2, prompt: "Bulletin Board" },
    { id: "bulletin", x: 7, y: 2, prompt: "Bulletin Board" },
    { id: "projects", x: 8, y: 2, prompt: "Projects Desk" },
    { id: "projects", x: 9, y: 2, prompt: "Projects Desk" },
    { id: "stairs", x: 11, y: 3, prompt: "Go upstairs" },
    { id: "stairs", x: 12, y: 3, prompt: "Go upstairs" },
    { id: "poster", x: 11, y: 2, prompt: "Swiftline poster" },
  ],
  decor: [
    { tex: "board_helpers", x: 4, y: 1 },
    { tex: "board_bulletin", x: 6, y: 1 },
    { tex: "board_projects", x: 8, y: 1 },
    { tex: "poster_swiftline", x: 11, y: 1 },
    { tex: "stairs_up", x: 11, y: 2 },
    { tex: "mail_trays", x: 8, y: 4 },
    { tex: "mail_trays", x: 10, y: 4 },
    { tex: "mail_sacks", x: 8, y: 7 },
    { tex: "mail_sacks", x: 11, y: 7 },
  ],
  regions: [],
};

// ═══ Your flat (interior, upstairs) ═══════════════════════════
const flat: MapDef = {
  ...EMPTY, id: "flat", name: "Your Flat", W: 9, H: 7, terrain: [], interior: "flat",
  warps: [{ x: 7, y: 2, w: 1, h: 1, to: "office", spawn: { x: 11, y: 4, dir: "down" }, label: "Downstairs" }],
  hotspots: [
    { id: "bed", x: 0, y: 3, prompt: "Go to bed" },
    { id: "bed", x: 0, y: 2, prompt: "Go to bed" },
    { id: "desk", x: 3, y: 1, prompt: "Write a letter" },
    { id: "desk", x: 4, y: 1, prompt: "Write a letter" },
    { id: "book", x: 5, y: 1, prompt: "Postmark Book" },
  ],
  decor: [{ tex: "postmark_book", x: 5, y: 1 }],
  regions: [],
};

export const MAPS: Record<MapId, MapDef> = { square, village, orchard, point, office, flat };

// ── People ───────────────────────────────────────────────────
export type VillagerDef = {
  id: string;
  name: string;
  sprite: string;
  wander: number;
  friends?: string[];
  /** Counts as one of the town's 12 friends. */
  voter?: boolean;
  likes?: string;
  birthday?: number; // day of the season
};

export const VILLAGERS: VillagerDef[] = [
  { id: "gull", name: "Postmaster Gull", sprite: "professor", wander: 0 },
  { id: "vane", name: "Director Vane", sprite: "magician", wander: 0 },
  { id: "dot", name: "Dot the Baker", sprite: "homemaker", wander: 1, voter: true, birthday: 4,
    friends: ["mo", "ada", "granny"], likes: "Fast deliveries (bread goes stale!)" },
  { id: "pell", name: "Pell the Stationer", sprite: "shopassistant", wander: 1, voter: true, birthday: 9,
    friends: ["mo", "sable", "mayor"], likes: "Neat, on-time post" },
  { id: "sable", name: "Sable the Mechanic", sprite: "fashionista", wander: 1, voter: true, birthday: 17,
    friends: ["rosa", "pell", "mo"], likes: "Anything shiny and well-oiled" },
  { id: "mo", name: "Mo", sprite: "shopkeeper", wander: 0, voter: true, birthday: 22,
    friends: ["finn", "dot", "pell"], likes: "Chatting. At length." },
  { id: "mayor", name: "Mayor Hollyhock", sprite: "ceo", wander: 3, voter: true, birthday: 11,
    friends: ["ada", "pell", "granny"], likes: "Reliability" },
  { id: "granny", name: "Granny Marigold", sprite: "granny", wander: 2, voter: true, birthday: 3,
    friends: ["rosa", "captain", "ada", "dot"], likes: "Letters handed over in person" },
  { id: "rosa", name: "Rosa", sprite: "florist", wander: 2, voter: true, birthday: 8,
    friends: ["granny", "finn", "sable"], likes: "Early mornings and flowers" },
  { id: "ada", name: "Nurse Ada", sprite: "nurse", wander: 2, voter: true, birthday: 15,
    friends: ["granny", "dot", "mayor"], likes: "Checking in on folks" },
  { id: "finn", name: "Finn", sprite: "fisher", wander: 0, voter: true, birthday: 27,
    friends: ["rosa", "mo", "shelly"], likes: "Being left alone (mostly)" },
  { id: "shelly", name: "Shelly", sprite: "beachcomber", wander: 3, voter: true, birthday: 20,
    friends: ["tobi", "finn"], likes: "Anything the tide brings in" },
  { id: "tobi", name: "Tobi", sprite: "childactor", wander: 3, voter: true, birthday: 12,
    friends: ["shelly", "captain"], likes: "Getting ANY mail at all" },
  { id: "captain", name: "Captain Barnaby", sprite: "riverboatcaptain", wander: 2, voter: true, birthday: 25,
    friends: ["granny", "tobi", "finn"], likes: "Visitors who bring biscuits" },
];

/** A fresh game opens in the Town Square, outside the boarded-up post office. */
export const INTRO_START = { map: "square" as MapId, x: 25, y: 12, dir: "up" as FacingDir };

/** Every morning you wake in your flat above the post office. */
export const PLAYER_START = { map: "flat" as MapId, x: 3, y: 4, dir: "down" as FacingDir };

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
