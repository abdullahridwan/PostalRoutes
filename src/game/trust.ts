// Trust: one number (0–100) per villager. Players never see the number, only hearts and tiers.
// Word of mouth: when trust changes, the event is logged; friends who later "hear" it
// (gossip in the square, or overnight) get a share of the change.
import { VILLAGERS } from "../world/layout";
import type { GameState } from "./state";

export const VOTE_AT = 60;
const SPREAD = 0.3;
const CHAMPION_SPREAD = 0.5;

export type Tier = { name: string; index: 0 | 1 | 2 | 3 };

export function hearts(trust: number) {
  return Math.max(0, Math.min(5, Math.floor(trust / 20)));
}

export function tier(trust: number): Tier {
  if (trust >= 90) return { name: "Champion", index: 3 };
  if (trust >= VOTE_AT) return { name: "Trusts you", index: 2 };
  if (trust >= 25) return { name: "Warming up", index: 1 };
  return { name: "Wary", index: 0 };
}

export const voters = () => VILLAGERS.filter((v) => v.voter);

/** How many of the town's 12 count you as a friend (3+ hearts). */
export function friendCount(s: GameState) {
  const forYou = voters().filter((v) => (s.trust[v.id] ?? 0) >= VOTE_AT).length;
  return { forYou, total: voters().length };
}

export function friendsOf(id: string) {
  return VILLAGERS.find((v) => v.id === id)?.friends ?? [];
}

/** Change someone's trust. Returns the actual delta applied. */
export function addTrust(s: GameState, id: string, delta: number) {
  const before = s.trust[id] ?? 0;
  const after = Math.max(0, Math.min(100, before + delta));
  s.trust[id] = after;
  return after - before;
}

/** Record something worth gossiping about. Friends hear it later. */
export function logEvent(s: GameState, type: string, who: string, delta: number) {
  if (!friendsOf(who).length || delta === 0) return;
  s.events.push({ type, who, day: s.day, delta, heard: [] });
  if (s.events.length > 14) s.events.shift();
}

/** A friend hears about an event: they get a share of the trust change. */
export function hearGossip(s: GameState, eventIndex: number, listener: string) {
  const e = s.events[eventIndex];
  if (!e || e.heard.includes(listener)) return 0;
  e.heard.push(listener);
  const share = (s.trust[e.who] ?? 0) >= 90 ? CHAMPION_SPREAD : SPREAD;
  return addTrust(s, listener, Math.round(e.delta * share));
}

/** Overnight, anything not yet gossiped about in person still gets around town. */
export function overnightGossip(s: GameState) {
  s.events.forEach((e, i) => {
    for (const f of friendsOf(e.who)) hearGossip(s, i, f);
  });
  s.events = s.events.filter((e) => e.day >= s.day - 1);
}

/** The first unheard event between a friend pair (a told b), or -1. */
export function gossipBetween(s: GameState, a: string, b: string) {
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i];
    if (e.who === a && friendsOf(a).includes(b) && !e.heard.includes(b)) return i;
  }
  return -1;
}
