import { LETTERS, fillerLetter, type Letter } from "./letters";

const SAVE_KEY = "postal-route-save-v1";
export const DAY_START = 6 * 60;
export const DAY_END = 24 * 60;
export const SNACK_PRICE = 15;
export const SWIM_AFTER = 6; // deliveries before Pip learns to swim

export type MonsterId = "pip" | "rocky" | "bzz";

export type GameState = {
  day: number;
  minutes: number;
  coins: number;
  snacks: number;
  bag: string[];
  pickedUp: boolean; // collected today's mailbag
  delivered: string[];
  deliveredToday: number;
  friends: MonsterId[];
  hearts: Record<string, number>;
  bouldersSmashed: boolean;
  canSwim: boolean;
  festivalSeen: boolean;
  extraLetters: Record<string, Letter>; // procedurally written post-story mail
  introSeen: boolean;
  uniform: number;
};

export function newGame(): GameState {
  return {
    day: 1, minutes: DAY_START, coins: 0, snacks: 0,
    bag: [], pickedUp: false, delivered: [], deliveredToday: 0,
    friends: ["pip"], hearts: {}, bouldersSmashed: false, canSwim: false,
    festivalSeen: false, extraLetters: {}, introSeen: false, uniform: 0,
  };
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...newGame(), ...JSON.parse(raw) } : null;
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
  // replies are handed over in person, never sorted at the post office
  if (LETTERS.some((o) => o.reply === l.id)) return false;
  return true;
}

/** Fill the mailbag for today. Returns the new letter ids. */
export function packBag(s: GameState): string[] {
  const size = s.day === 1 ? 3 : 4;
  const fresh = LETTERS.filter((l) => available(s, l)).slice(0, size).map((l) => l.id);
  // quiet story days get topped up with everyday mail (only to people you can reach)
  const who = ["granny", "mo", "ada", "shelly", "rosa", "finn"];
  if (s.bouldersSmashed) who.push("tobi");
  if (s.canSwim) who.push("captain");
  const minimum = s.day === 1 ? 3 : storyComplete(s) ? 4 : 3;
  for (let n = 0; fresh.length < minimum && s.delivered.length >= 3; n++) {
    const l = fillerLetter(s.day, n, who);
    s.extraLetters[l.id] = l;
    fresh.push(l.id);
  }
  s.bag.push(...fresh);
  s.pickedUp = true;
  return fresh;
}

export function storyComplete(s: GameState) {
  return s.delivered.includes("gullfinal");
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
