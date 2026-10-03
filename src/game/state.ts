import { LETTERS, personalLetters, type Letter } from "./letters";
import { VILLAGERS } from "../world/layout";
import type { HelperId } from "./helpers";

const SAVE_KEY = "postal-route-save-v3";

// ── Time ─────────────────────────────────────────────────────
export const DAY_START = 7 * 60; // you wake at 7:00
export const DAY_END = 24 * 60; // gentle bedtime at midnight
export const EVENING = 18 * 60 + 30;
export const MS_PER_MINUTE = 700; // ≈ 12 real minutes from 7am to midnight

// ── Prices ───────────────────────────────────────────────────
export const BIKES = [
  { name: "Walking boots", cost: 0, ms: 190 },
  { name: "Old Postie Bike", cost: 120, ms: 150 },
  { name: "Racing Bike", cost: 280, ms: 120 },
];
export const BAGS = [
  { name: "Canvas bag", cost: 0, size: 4 },
  { name: "Saddlebags", cost: 90, size: 6 },
  { name: "Cargo basket", cost: 200, size: 8 },
];
export const PAINTS = ["Postie Blue", "Mailbox Red", "Seaweed Green", "Sunset Orange", "Lavender"];

/** Post office projects you pay for at the counter. Each one visibly changes the building. */
export const PROJECTS = [
  { id: "roof", cost: 60, name: "Patch the roof", perk: "The whole town notices. Everyone warms to you a little." },
  { id: "desk", cost: 120, name: "New sorting desk", perk: "Your mailbag holds 1 more letter each day." },
  { id: "sign", cost: 160, name: "Repaint the sign", perk: "Passers-by stop to say hello: a little trust each day." },
  { id: "room", cost: 300, name: "Open the old sorting room", perk: "Something has been waiting down there for a long time…" },
] as const;

export const TOWN_PROJECTS = [
  { id: "bridge", cost: 180, name: "Rebuild the harbour footbridge", perk: "Opens the cliff path to Lighthouse Point." },
] as const;

export type TrustEvent = { type: string; who: string; day: number; delta: number; heard: string[] };

export type Request = {
  id: string;
  kind: "fetch" | "bring" | "errand";
  from: string; // villager id
  title: string;
  text: string;
  item?: string; // item id for fetch/bring
  to?: string; // errand recipient
  reward: number;
  trust: number;
  accepted: boolean;
  done: boolean;
  deadline?: number; // minutes (errand)
  spawnMap?: string; // where the lost item is
  spawnX?: number;
  spawnY?: number;
  found?: boolean;
};

export type GameState = {
  day: number; // total days since the start (1-based)
  minutes: number;
  coins: number;
  inv: Record<string, number>; // treats, gifts, found items
  bag: string[];
  pickedUp: boolean;
  delivered: string[];
  deliveredToday: number;
  earnedToday: number;
  trust: Record<string, number>;
  chattedToday: string[];
  giftedToday: string[];
  events: TrustEvent[];
  // helpers
  helper: HelperId | null; // hired for today
  helpers: HelperId[]; // unlocked
  helperBond: Record<string, number>;
  // projects
  projects: string[]; // completed project ids
  townProjects: string[];
  bikeLevel: number;
  bagLevel: number;
  paint: number;
  // swiftline
  share: number; // Swiftline's share of the town's mail, 0–100
  swiftlineTook: number;
  vaneSoftened: boolean;
  // requests & daily stuff
  requests: Request[];
  requestsDone: number;
  forageTaken: string[];
  eventToday: string | null;
  // story flags
  introSeen: boolean;
  bzzMet: boolean;
  rockyMet: boolean;
  heartEventsSeen: string[];
  marketSeen: number[];
  blossomSeen: boolean;
  springDone: boolean;
  // social
  postmarks: string[]; // names of friends whose letters you've received
  sent: string[]; // names you've written to
  receivedLetters: { from: string; body: string }[];
  extraLetters: Record<string, Letter>;
  settings: { sound: boolean };
};

const START_TRUST: Record<string, number> = {
  granny: 35, rosa: 20, dot: 15, pell: 5, sable: 10, mayor: 25,
  mo: 20, ada: 22, finn: 8, shelly: 18, tobi: 30, captain: 15,
};

export function newGame(): GameState {
  return {
    day: 1, minutes: DAY_START, coins: 0,
    inv: {}, bag: [], pickedUp: false, delivered: [], deliveredToday: 0, earnedToday: 0,
    trust: { ...START_TRUST }, chattedToday: [], giftedToday: [], events: [],
    helper: null, helpers: ["pip"], helperBond: {},
    projects: [], townProjects: [], bikeLevel: 0, bagLevel: 0, paint: 0,
    share: 55, swiftlineTook: 0, vaneSoftened: false,
    requests: [], requestsDone: 0, forageTaken: [], eventToday: null,
    introSeen: false, bzzMet: false, rockyMet: false, heartEventsSeen: [], marketSeen: [],
    blossomSeen: false, springDone: false,
    postmarks: [], sent: [], receivedLetters: [], extraLetters: {}, settings: { sound: true },
  };
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = { ...newGame(), ...JSON.parse(raw) } as GameState;
    s.trust = { ...START_TRUST, ...s.trust };
    return s;
  } catch {
    return null;
  }
}

export function save(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. — the game still works, it just won't remember */
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function letterById(s: GameState, id: string): Letter | undefined {
  return LETTERS.find((l) => l.id === id) ?? s.extraLetters[id];
}

export const has = (s: GameState, id: string) => s.projects.includes(id) || s.townProjects.includes(id);
export const count = (s: GameState, item: string) => s.inv[item] ?? 0;
export function addItem(s: GameState, item: string, n = 1) {
  s.inv[item] = Math.max(0, (s.inv[item] ?? 0) + n);
  if (s.inv[item] === 0) delete s.inv[item];
}

export const bagSize = (s: GameState) =>
  BAGS[s.bagLevel].size + (s.projects.includes("desk") ? 1 : 0) + (s.helper === "pip" ? 3 : 0);

function available(s: GameState, l: Letter) {
  if (s.delivered.includes(l.id) || s.bag.includes(l.id)) return false;
  if (l.after && !s.delivered.includes(l.after)) return false;
  if (l.requires === "bridge" && !s.townProjects.includes("bridge")) return false;
  if (l.requires === "room" && !s.projects.includes("room")) return false;
  if (l.requires === "orchard" && !s.bzzMet) return false;
  if (l.fromDay && s.day < l.fromDay) return false;
  if (LETTERS.some((o) => o.reply === l.id)) return false; // replies are handed over in person
  return true;
}

/** People you can currently reach. */
export function reachable(s: GameState) {
  return VILLAGERS.filter((v) => v.voter)
    .map((v) => v.id)
    .filter((id) => (id !== "captain" && id !== "tobi") || s.townProjects.includes("bridge"));
}

/**
 * Fill today's mailbag. Story letters come first, then notes between villagers.
 * Folks who don't trust you yet may send some of their mail with Swiftline instead.
 */
export function packBag(s: GameState, rand = Math.random): { fresh: string[]; diverted: number } {
  const size = bagSize(s);
  const fresh = LETTERS.filter((l) => available(s, l)).slice(0, Math.max(2, Math.floor(size * 0.6))).map((l) => l.id);
  let diverted = 0;
  const who = reachable(s);
  const notes = personalLetters(s.day, who, s.trust);
  for (const l of notes) {
    if (fresh.length >= size) break;
    const t = s.trust[l.to] ?? 0;
    const lostChance = t < 25 ? 0.5 : t < 60 ? 0.2 : 0;
    if (s.day > 1 && rand() < lostChance) {
      diverted++;
      continue;
    }
    s.extraLetters[l.id] = l;
    fresh.push(l.id);
  }
  s.bag.push(...fresh);
  s.pickedUp = true;
  s.swiftlineTook = diverted;
  return { fresh, diverted };
}

// ── Calendar ────────────────────────────────────────────────
export const SEASON_LENGTH = 28;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function calendar(day: number) {
  const dayOfSeason = ((day - 1) % SEASON_LENGTH) + 1;
  const year = Math.floor((day - 1) / SEASON_LENGTH) + 1;
  return { dayOfSeason, year, weekday: WEEKDAYS[(day - 1) % 7], season: "Spring" };
}
export const MARKET_DAYS = [5, 12, 19, 26];
export const BLOSSOM_DAY = 14;
export const FINALE_DAY = 28;

export function clockText(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m - (m % 10)).padStart(2, "0")}${ampm}`;
}

export function weatherFor(day: number): "sunny" | "breezy" | "rain" {
  if (day === 1) return "sunny";
  const r = Math.abs(Math.sin(day * 12.9898) * 43758.5453) % 1;
  return r < 0.22 ? "rain" : r < 0.55 ? "breezy" : "sunny";
}
