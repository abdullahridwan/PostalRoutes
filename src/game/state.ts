import { LETTERS, fillerLetter, type Letter } from "./letters";
import { VILLAGERS } from "../world/layout";

const SAVE_KEY = "postal-route-save-v2";

// Shift-based days: time only moves when you finish deliveries.
export const DAY_START = 8 * 60;
export const MINUTES_PER_DELIVERY = 35;
export const EVENING = 18 * 60 + 30;

export const SEASON_DAYS = 20; // the Council votes at the start of this day
export const SNACK_PRICE = 15;
export const BUN_PRICE = 20;
export const DYE_PRICE = 40;
export const SWIM_AFTER = 6; // deliveries before Pip learns to swim

/** Post office repairs, paid for from the Repair Fund. */
export const REPAIRS = [
  { cost: 60, name: "Patch the roof", perk: "The town notices: everyone warms to you a little." },
  { cost: 120, name: "New sorting desk", perk: "Your mailbag holds one more letter each day." },
  { cost: 200, name: "Bike rack (and a bike!)", perk: "You get around town faster." },
  { cost: 320, name: "Open the old sorting room", perk: "Something has been waiting down there for a long time…" },
];

export type MonsterId = "pip" | "rocky" | "bzz";
export type TrustEvent = { type: string; who: string; day: number; delta: number; heard: string[] };

export type GameState = {
  day: number;
  minutes: number;
  coins: number;
  snacks: number;
  buns: number;
  bag: string[];
  pickedUp: boolean;
  pickedUpAt: number; // ms timestamp of today's pickup (for "speedy" bonuses)
  delivered: string[];
  deliveredToday: number;
  earnedToday: number;
  swiftlineTook: number;
  friends: MonsterId[];
  trust: Record<string, number>;
  chattedToday: string[];
  giftedToday: string[];
  events: TrustEvent[];
  repairFund: number;
  repairs: number;
  bouldersSmashed: boolean;
  canSwim: boolean;
  voteDay: number;
  voteWon: boolean;
  vaneSoftened: boolean;
  festivalSeen: boolean;
  extraLetters: Record<string, Letter>;
  introSeen: boolean;
  metVane: boolean;
  uniform: number;
};

// Where everyone starts. Marigold knew your grandma; the shopkeepers have been charmed by Swiftline's prices.
const START_TRUST: Record<string, number> = {
  granny: 35, rosa: 20, dot: 15, pell: 5, sable: 10, mayor: 25,
  mo: 20, ada: 22, finn: 8, shelly: 18, tobi: 30, captain: 15,
};

export function newGame(): GameState {
  return {
    day: 1, minutes: DAY_START, coins: 0, snacks: 0, buns: 0,
    bag: [], pickedUp: false, pickedUpAt: 0, delivered: [], deliveredToday: 0, earnedToday: 0, swiftlineTook: 0,
    friends: ["pip"], trust: { ...START_TRUST }, chattedToday: [], giftedToday: [], events: [],
    repairFund: 0, repairs: 0, bouldersSmashed: false, canSwim: false,
    voteDay: SEASON_DAYS, voteWon: false, vaneSoftened: false, festivalSeen: false,
    extraLetters: {}, introSeen: false, metVane: false, uniform: 0,
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

function available(s: GameState, l: Letter) {
  if (s.delivered.includes(l.id) || s.bag.includes(l.id)) return false;
  if (l.after && !s.delivered.includes(l.after)) return false;
  if (l.requires === "smash" && !s.bouldersSmashed) return false;
  if (l.requires === "swim" && !s.canSwim) return false;
  if (l.requires === "sortingRoom" && s.repairs < 4) return false;
  if (l.fromDay && s.day < l.fromDay) return false;
  // replies are handed over in person, never sorted at the post office
  if (LETTERS.some((o) => o.reply === l.id)) return false;
  return true;
}

/** People you can currently reach. */
export function reachable(s: GameState) {
  const who = VILLAGERS.filter((v) => v.voter).map((v) => v.id);
  return who.filter((id) => (id !== "tobi" || s.bouldersSmashed) && (id !== "captain" || s.canSwim));
}

/**
 * Fill today's mailbag. Story letters always come to you; everyday mail from people
 * who don't trust you yet may go to Swiftline instead.
 */
export function packBag(s: GameState, rand = Math.random): { fresh: string[]; diverted: number } {
  const size = (s.day === 1 ? 3 : 4) + (s.repairs >= 2 ? 1 : 0);
  const story = LETTERS.filter((l) => available(s, l)).slice(0, size).map((l) => l.id);
  const fresh = [...story];
  let diverted = 0;
  const who = reachable(s);
  const target = Math.max(size, 3);
  for (let n = 0; fresh.length < target && n < 12; n++) {
    const l = fillerLetter(s.day, n, who);
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
