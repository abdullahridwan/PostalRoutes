// Everything you can carry besides letters.

export type ItemDef = { id: string; name: string; kind: "treat" | "gift" | "lost"; price?: number; desc: string };

export const ITEMS: Record<string, ItemDef> = {
  // treats: payment for helpers; each helper has a favourite
  treat: { id: "treat", name: "Plain treat", kind: "treat", price: 8, desc: "Any helper will work for this." },
  fishcracker: { id: "fishcracker", name: "Fish cracker", kind: "treat", price: 12, desc: "Pip's favourite." },
  honeydrop: { id: "honeydrop", name: "Honey drop", kind: "treat", price: 12, desc: "Bzz's favourite." },
  biscuit: { id: "biscuit", name: "Pebble biscuit", kind: "treat", price: 12, desc: "Rocky's favourite." },
  teaLeaf: { id: "teaLeaf", name: "Tea leaf", kind: "treat", price: 12, desc: "Leaf's favourite." },
  tart: { id: "tart", name: "Jam tart", kind: "treat", price: 12, desc: "Snug's favourite." },
  // gifts for villagers
  bun: { id: "bun", name: "Honey bun", kind: "gift", price: 20, desc: "Warm from Dot's oven." },
  flower: { id: "flower", name: "Wildflower", kind: "gift", desc: "Picked in Orchard Meadow." },
  shell: { id: "shell", name: "Seashell", kind: "gift", desc: "Found on the harbour beach." },
  ribbon: { id: "ribbon", name: "Silk ribbon", kind: "gift", price: 25, desc: "From a Market Day stall." },
  jam: { id: "jam", name: "Jar of jam", kind: "gift", price: 22, desc: "From a Market Day stall." },
  // lost items (request fetches)
  scarf: { id: "scarf", name: "Lost scarf", kind: "lost", desc: "Somebody is looking for this." },
  locket: { id: "locket", name: "Lost locket", kind: "lost", desc: "Somebody is looking for this." },
  glove: { id: "glove", name: "Lost glove", kind: "lost", desc: "Somebody is looking for this." },
  teddy: { id: "teddy", name: "Lost teddy", kind: "lost", desc: "Somebody is looking for this." },
};

/** What each villager thinks of gifts. Anything else is "neutral". */
export const GIFT_PREFS: Record<string, { loves: string[]; likes: string[]; dislikes?: string[] }> = {
  granny: { loves: ["flower"], likes: ["bun", "jam"] },
  rosa: { loves: ["flower", "ribbon"], likes: ["shell"] },
  dot: { loves: ["jam"], likes: ["flower", "shell"] },
  pell: { loves: ["ribbon"], likes: ["jam"], dislikes: ["shell"] },
  sable: { loves: ["ribbon"], likes: ["flower"] },
  mayor: { loves: ["bun"], likes: ["jam", "flower"] },
  mo: { loves: ["bun"], likes: ["jam", "shell"] },
  ada: { loves: ["flower"], likes: ["bun", "ribbon"] },
  finn: { loves: ["shell"], likes: ["bun"], dislikes: ["ribbon"] },
  shelly: { loves: ["shell"], likes: ["flower", "jam"] },
  tobi: { loves: ["bun"], likes: ["shell", "jam"] },
  captain: { loves: ["jam"], likes: ["shell", "bun"] },
};

export function giftReaction(who: string, item: string): { points: number; line: string } {
  const p = GIFT_PREFS[who];
  if (p?.loves.includes(item)) return { points: 14, line: "Oh! This is exactly what I wanted!" };
  if (p?.likes.includes(item)) return { points: 8, line: "That's really thoughtful. Thank you!" };
  if (p?.dislikes?.includes(item)) return { points: 1, line: "Um… thank you? (They don't seem to like it.)" };
  return { points: 4, line: "How kind of you. Thank you." };
}
