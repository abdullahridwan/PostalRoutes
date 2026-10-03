// Tileset registry + the Tuxemon tile indices we use.
// GIDs are global: firstgid + local index (same scheme as Tiled).

export const TILESETS = [
  { key: "core_outdoor", file: "core_outdoor.png", firstgid: 1, count: 2775 },
  { key: "core_set pieces", file: "core_set_pieces.png", firstgid: 2776, count: 1550 },
  { key: "core_city_and_country", file: "core_city_and_country.png", firstgid: 4326, count: 1440 },
  { key: "core_buildings", file: "core_buildings.png", firstgid: 5766, count: 2350 },
] as const;

export function gid(tileset: string, index: number): number {
  const ts = TILESETS.find((t) => t.key === tileset);
  if (!ts) throw new Error(`unknown tileset ${tileset}`);
  return ts.firstgid + index;
}

const O = (i: number) => gid("core_outdoor", i);

export const GRASS = O(111);
export const WATER_FRAMES = [O(1269), O(1270), O(1271)];
export const FLOWERS = [O(6), O(7), O(77), O(79), O(80), O(81), O(78)];

// Corner bitmask: NW=1, NE=2, SW=4, SE=8 (bit set = corner belongs to the terrain).
export const PATH_TILES: Record<number, number> = {
  15: O(154),
  12: O(117), 3: O(191), 10: O(153), 5: O(155),
  8: O(116), 4: O(118), 2: O(190), 1: O(192),
  14: O(266), 13: O(265), 11: O(229), 7: O(228),
};

// Shoreline overlays (transparent where water shows through from the base layer).
export const SHORE_TILES: Record<number, number> = {
  15: O(1269),
  12: O(572), 3: O(646), 10: O(608), 5: O(610),
  8: O(571), 4: O(573), 2: O(645), 1: O(647),
  14: O(831), 13: O(830), 11: O(794), 7: O(793),
};

const C = (i: number) => gid("core_city_and_country", i);

/** Cobblestone: a seamless 2x2 pattern, indexed [y % 2][x % 2]. */
export const COBBLE = [[C(613), C(614)], [C(653), C(654)]];

/** 3x3 fountain; animation frames sit 3 tiles apart in the sheet. */
export const FOUNTAIN = {
  rows: [[C(382), C(383), C(384)], [C(422), C(423), C(424)], [C(462), C(463), C(464)]],
  frameOffsets: [0, 3, 6],
};

/** 5x4 market stall: striped awning, posts, counter, plus produce crates. */
const N = null;
export const STALL = {
  base: [
    [C(938), C(939), C(940), C(941), C(942)],
    [C(978), C(979), C(980), C(981), C(982)],
    [C(1018), C(1019), C(1020), C(1021), C(1022)],
    [C(1058), C(1059), C(1060), C(1061), C(1062)],
  ],
  crates: [
    [N, N, N, N, N],
    [N, N, N, N, N],
    [N, C(826), C(827), C(828), N],
    [N, C(866), C(867), C(868), N],
  ] as (number | null)[][],
};

// 2x3 pine tree: canopy row renders above the player.
export const TREE = {
  canopy: [O(1024), O(1025)],
  mid: [O(1061), O(1062)],
  trunk: [O(1098), O(1099)],
};
