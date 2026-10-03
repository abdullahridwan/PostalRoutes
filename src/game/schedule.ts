// Where everyone is, hour by hour. Villagers walk between these spots (see World.stepVillagers).
// Off-screen movement is instant; on-screen they walk to the road and fade through the exit.
import { BLOSSOM_DAY, FINALE_DAY } from "./state";
import type { MapId } from "../world/layout";

export type Spot = { map: MapId; x: number; y: number };
type Slot = [hour: number, map: MapId | null, x: number, y: number];

const S = (hour: number, map: MapId | null, x = 0, y = 0): Slot => [hour, map, x, y];

const SCHEDULE: Record<string, Slot[]> = {
  gull: [S(0, "office", 3, 6), S(19, "square", 24, 9), S(21, null)],
  vane: [S(0, null), S(8, "square", 30, 30), S(11, "square", 25, 24), S(13, "square", 30, 30), S(17, "square", 22, 11), S(19, "square", 30, 30), S(21, null)],
  dot: [S(0, null), S(7, "square", 8, 25), S(12, "square", 24, 22), S(13, "square", 8, 25), S(19, "square", 26, 22), S(21, null)],
  pell: [S(0, null), S(8, "square", 8, 17), S(12.5, "square", 21, 21), S(14, "square", 8, 17), S(19, "square", 20, 14), S(21, null)],
  sable: [S(0, null), S(8, "square", 41, 17), S(12.5, "square", 27, 21), S(14, "square", 41, 17), S(19, "square", 30, 14), S(21, null)],
  mo: [S(0, null), S(8, "square", 39, 25), S(12, "square", 28, 22), S(13.5, "square", 39, 25), S(19, "square", 36, 22), S(21, null)],
  mayor: [S(0, null), S(8, "square", 24, 11), S(10, "square", 22, 22), S(13, "square", 29, 23), S(15, "square", 20, 14), S(18, "square", 26, 16), S(21, null)],
  granny: [S(0, null), S(7, "village", 45, 19), S(10, "square", 21, 21), S(13, "square", 22, 22), S(16, "village", 45, 19), S(20, null)],
  rosa: [S(0, null), S(7, "orchard", 41, 15), S(11, "orchard", 17, 14), S(14, "square", 26, 22), S(17, "orchard", 41, 15), S(20, null)],
  ada: [S(0, null), S(8, "village", 37, 28), S(12.5, "square", 25, 21), S(14, "village", 37, 28), S(19, "village", 33, 21), S(21, null)],
  finn: [S(0, null), S(7, "village", 22, 34), S(9, "village", 26, 37), S(15, "village", 22, 34), S(18, "square", 27, 22), S(20, null)],
  shelly: [S(0, null), S(7, "village", 34, 36), S(12, "village", 29, 34), S(15, "square", 15, 23), S(18, "village", 34, 36), S(20, null)],
  tobi: [S(0, null), S(7, "point", 12, 15), S(11, "point", 20, 29), S(15, "point", 29, 14), S(19, "point", 12, 15), S(20, null)],
  captain: [S(0, null), S(7, "point", 15, 26), S(10, "point", 29, 14), S(17, "point", 15, 26), S(20, null)],
};

const BLOSSOM_SPOTS = Array.from({ length: 16 }, (_, i) => ({ x: 21 + 2 * (i % 5), y: 22 + 2 * Math.floor(i / 5) }));
const FINALE_SPOTS = Array.from({ length: 16 }, (_, i) => ({ x: 22 + 2 * (i % 6), y: 13 + 2 * Math.floor(i / 6) }));
const PEOPLE = Object.keys(SCHEDULE);

export type Ctx = { day: number; minutes: number; bridge: boolean; vaneSoftened: boolean };

/** Where a villager should be right now, or null if they're at home and out of sight. */
export function targetFor(id: string, ctx: Ctx): Spot | null {
  const hour = ctx.minutes / 60;
  const i = PEOPLE.indexOf(id);
  const day = ((ctx.day - 1) % 28) + 1;
  if (id !== "gull") {
    if (day === BLOSSOM_DAY && hour >= 18.5 && hour < 23.5 && id !== "vane") {
      const sp = BLOSSOM_SPOTS[i % BLOSSOM_SPOTS.length];
      return { map: "orchard", ...sp };
    }
    if (day === 28 && hour >= 19 && ctx.bridge && (id !== "vane" || ctx.vaneSoftened)) {
      const sp = FINALE_SPOTS[i % FINALE_SPOTS.length];
      return { map: "point", ...sp };
    }
  }
  const slots = SCHEDULE[id];
  if (!slots) return null;
  let cur = slots[0];
  for (const s of slots) if (s[0] <= hour) cur = s;
  if (!cur[1]) return null;
  // people beyond the broken bridge simply stay at the Point; nobody crosses until it's rebuilt
  return { map: cur[1], x: cur[2], y: cur[3] };
}

/** Initial spots when a map loads, so people are already where they should be. */
export const FESTIVAL_DAYS = { BLOSSOM_DAY, FINALE_DAY };
