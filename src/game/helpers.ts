// Helpers: monsters you hire for the day with a treat. No walking sprites needed.

export type HelperId = "pip" | "bzz" | "rocky" | "leaf" | "snug";

export type HelperDef = {
  id: HelperId;
  name: string;
  sprite: string; // overworld sheet; frame 1 is used as the portrait on the card
  perk: string; // shown on the card
  blurb: string; // shown on the Helper Board
  fav: string; // favourite treat item id
  unlock: string; // how you meet them (shown when locked)
};

export const HELPERS: Record<HelperId, HelperDef> = {
  pip: { id: "pip", name: "Pip", sprite: "penguin", perk: "Carries 3 more letters", blurb: "Grandma's old penguin. Very punctual.", fav: "fishcracker", unlock: "Starts with you" },
  bzz: { id: "bzz", name: "Bzz", sprite: "bee", perk: "Quick on the route", blurb: "Never sits still. Loves a sweet treat.", fav: "honeydrop", unlock: "Meet in Orchard Meadow" },
  rocky: { id: "rocky", name: "Rocky", sprite: "rockitten", perk: "Sniffs out lost things", blurb: "Grumpy on the outside. Finds hidden things.", fav: "biscuit", unlock: "Find on the cliff path" },
  leaf: { id: "leaf", name: "Leaf", sprite: "conileaf", perk: "Rain brings bigger tips", blurb: "Blooms when it rains.", fav: "teaLeaf", unlock: "Befriend Rosa" },
  snug: { id: "snug", name: "Snug", sprite: "snugglepot", perk: "Slows Swiftline drones", blurb: "Sleepy, but drones fear its yawn.", fav: "tart", unlock: "Market Day, day 5" },
};

export const HELPER_ORDER: HelperId[] = ["pip", "bzz", "rocky", "leaf", "snug"];

export const heartsOf = (bond: number) => Math.min(5, Math.floor(bond / 8));
