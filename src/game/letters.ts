import { VILLAGERS } from "../world/layout";

// Every piece of mail in Seabreeze Bay. Story threads unlock as you befriend
// the footbridge to Lighthouse Point (a Projects Desk project) and deliver earlier letters.

export type Requirement = "bridge" | "room" | "orchard";

export type Letter = {
  id: string;
  to: string; // villager id
  from: string;
  title: string;
  body: string;
  requires?: Requirement;
  after?: string; // only appears once this letter has been delivered
  reply?: string; // handing this over gives you another letter on the spot
  parcel?: boolean;
  express?: boolean; // deliver within 3 game hours for a bonus
  deadline?: number; // game minutes; express bonus lost after this
  requestId?: string; // errand letters complete a bulletin-board request
  fromId?: string; // villager id of the sender, if a villager wrote it
  fromDay?: number; // not sent before this day
  marlo?: boolean; // one of grandma's unsent letters (big trust boost)
};

export const LETTERS: Letter[] = [
  // ── Day one: the stakes ───────────────────────────────────
  {
    id: "mayor1", to: "mayor", from: "Swiftline Logistics",
    title: "Notice: A Generous Offer",
    body: "Dear Mayor Hollyhock,\nSwiftline Logistics is pleased to renew our offer to replace the Seabreeze Post Office with a modern Swiftline Hub. Our drone coverage already reaches 55% of your town.\nProgress waits for no one.\n— H. Vane, Director",
  },
  {
    id: "dot1", to: "dot", from: "Mainland Mills", parcel: true,
    title: "Parcel: Flour (10 sacks)",
    body: "Your flour order. Note: Swiftline now offers Flour-by-Drone. It arrives faster. Mostly in the sea.",
  },
  {
    id: "granny1", to: "granny", from: "Seed & Sprout Catalog",
    title: "Spring Seed Catalog",
    body: "NEW this season: Moonbell tulips! They glow faintly at night. Perfect for anyone waiting up for someone.",
  },
  {
    id: "mo1", to: "mo", from: "Driftwood Wholesale", parcel: true,
    title: "Parcel: Monster Snacks (x40)",
    body: "Your order of crunchy Monster Snacks. Reminder: monsters befriended with snacks remain friends for life. No refunds on friendship.",
  },
  {
    id: "rosa1", to: "rosa", from: "???",
    title: "A Folded Poem",
    body: "Roses are red, the sea is quite blue,\nI smell like old fish, but I think of you.\n\n(no signature, just a tiny drawing of a hook)",
  },
  {
    id: "pell1", to: "pell", from: "Swiftline Logistics",
    title: "Bulk Postage Discount!",
    body: "Valued partner! Switch your shop's post to Swiftline and save 30%. Drones never need lunch breaks, or small talk.",
  },
  {
    id: "sable1", to: "sable", from: "Velvet & Thread Co.", parcel: true,
    title: "Parcel: Fabric Swatches",
    body: "Swatches enclosed: Seafoam, Sunset, and 'Courier Blue' (strangely popular this season).",
  },
  // ── Grandma Marlo's unsent letters, found in the sorting trays ──
  {
    id: "marlo_pell", to: "pell", from: "Marlo (an old letter, never sent)", fromDay: 4, marlo: true,
    title: "To Pell, Finally",
    body: "Pell, your father taught me to love good paper. I never thanked him. So I'm thanking you: every letter I ever delivered was a little bit his. — Marlo",
  },
  {
    id: "marlo_finn", to: "finn", from: "Marlo (an old letter, never sent)", fromDay: 8, marlo: true,
    title: "To Finn, Who Doesn't Like Fuss",
    body: "Finn. You pretend you don't want mail. I've seen you wait at the window. Someone in this town is going to write to you one day, and I hope you write back. — M.",
  },
  {
    id: "marlo_mayor", to: "mayor", from: "Marlo (an old letter, never sent)", fromDay: 12, marlo: true,
    title: "To the Mayor (Before You Were Mayor)",
    body: "Hollyhock, you used to deliver papers with me when you were small. You said a town is just people who write to each other. Don't forget that, whatever they offer you. — Marlo",
  },
  // ── Day two-ish ────────────────────────────────────────────
  {
    id: "ada1", to: "ada", from: "Mainland Medical Supply",
    title: "Bandages & Lollipops",
    body: "Enclosed: 200 bandages, 1 stethoscope, 600 lollipops. Our records indicate the lollipop ratio is 'concerning'. Please advise.",
  },
  {
    id: "shelly1", to: "shelly", from: "A bottle on the tide",
    title: "Message in a Bottle",
    body: "If you find this: there's a kid on the cliff who watches the sea every evening. Somebody should say hi.\n\n— a friend",
  },
  {
    id: "granny2", to: "granny", from: "Seabreeze Clinic", after: "ada1",
    title: "Checkup Reminder",
    body: "Dear Marigold, it's time for your yearly checkup. Bring your knitting, the waiting room is cosy. — Ada\nP.S. Yes, there are still lollipops.",
  },
  {
    id: "rosa2", to: "rosa", from: "???", after: "rosa1",
    title: "Another Folded Poem",
    body: "The tide goes out, the tide comes in,\nI'd trade every fish for one of your grins.\n\n(a faint smell of bait…)",
    reply: "finn1",
  },
  {
    id: "finn1", to: "finn", from: "Rosa",
    title: "A Note Pinned to a Daisy",
    body: "To whoever keeps sending poems: the hook drawing is adorable. Also, the envelope smells like mackerel. I have a guess. Come by the flower house? — R.",
  },
  {
    id: "mo2", to: "mo", from: "Mo's Mum",
    title: "Postcard from the Mainland",
    body: "Hi sweetie! The city is loud and nobody waves. Do you still put a snack out for the stray monsters? Never stop. Love, Mum",
  },
  // ── Lighthouse Point (needs the footbridge) ───────────
  {
    id: "tobi1", to: "tobi", from: "Shelly", requires: "bridge", after: "shelly1",
    title: "Hello up there!",
    body: "Hi! I found a bottle saying you watch the sea every evening. Me too! I collect shells. What do you collect? — Shelly (the beach house)",
    reply: "shelly2",
  },
  {
    id: "shelly2", to: "shelly", from: "Tobi", requires: "bridge",
    title: "Hi Shelly!!!",
    body: "I collect CLOUDS. I draw them. I drew 211. Also nobody has ever written me before. Can I write back again? Can I? — Tobi (age 8 and 3/4)",
  },
  {
    id: "tobi2", to: "tobi", from: "Postmaster Gull", requires: "bridge", after: "shelly2",
    title: "Official Junior Pen Pal Badge",
    body: "By the authority of the Seabreeze Post Office, Tobi is hereby a Certified Pen Pal. Duties: write letters. Benefits: receiving letters.",
    parcel: true,
  },
  {
    id: "ada2", to: "ada", from: "Tobi", requires: "bridge", after: "tobi1",
    title: "A Drawing of a Cloud",
    body: "This cloud looks like a bandage so I thought you would want it. — Tobi",
  },
  // ── The Captain, out at the Point ─────────────────────
  {
    id: "captain1", to: "captain", from: "Marigold", requires: "bridge", after: "granny1",
    title: "A Letter in Lilac Ink",
    body: "Barnaby, it's been forty summers since you rowed out to fix that old light, and you never rowed back. I planted Moonbells. They glow at night. In case you wanted something to steer by. — M.",
    reply: "granny3",
  },
  {
    id: "granny3", to: "granny", from: "Captain Barnaby", requires: "bridge",
    title: "Salt-stained Envelope",
    body: "Marigold. I saw them. A little glowing patch on the shore, every night, and I thought it was a dream. I'm an old fool with a leaky boat. Would you… meet me at the pier? — B.",
  },
  {
    id: "captain2", to: "captain", from: "Finn", requires: "bridge", after: "granny3", parcel: true,
    title: "Parcel: Boat Patching Kit",
    body: "Heard your boat leaks. Here's my best patching kit. Don't make Granny wait, Cap'n. — Finn\nP.S. Rosa said yes to tea!!",
  },
  {
    id: "rosa3", to: "rosa", from: "Finn", after: "finn1",
    title: "Signed, Finally",
    body: "It was me. Obviously. The mackerel gave it away. Tea on Sunday? I'll wash my hands twice. — Finn",
  },
  {
    id: "mo3", to: "mo", from: "Seabreeze Town Council", after: "captain2", requires: "bridge",
    title: "Festival Supplies Order",
    body: "Please stock lanterns, streamers and 300 snacks. Captain Barnaby has promised to relight the lighthouse for the end of Spring: Lantern Night is back on!",
  },
  // ── Orchard Meadow ────────────────────────────────────────
  {
    id: "rosa_orchard", to: "rosa", from: "Seabreeze Gardening Club", requires: "orchard", fromDay: 3,
    title: "The Spring Fête Committee",
    body: "Rosa, the committee would like you to host Blossom Night in the Orchard again this year. We'll need flowers. Lots of flowers.",
  },
  // ── The twist: found when you open the old sorting room ─────
  {
    id: "vane1", to: "vane", from: "Mum (postmarked 30 years ago)", requires: "room",
    title: "The Undelivered Letter",
    body: "My dear Hollis,\nI'm sorry I left without saying goodbye. I'll write to you every single week, I promise.\nWatch the lighthouse. When it blinks, that's me thinking of you.\n— Mum",
  },
];

// ── Notes between villagers: the everyday mail ───────────────
// Each villager has a few things they might write to a friend. The sender is always
// one of the recipient's friends, so the mail is people talking to each other.
type Note = [title: string, body: string];
const NOTES: Record<string, Note[]> = {
  granny: [
    ["Tea on Thursday?", "Dear one, I've found my good teapot. Come by and let me fuss over you."],
    ["Moonbells!", "The bulbs are coming up. They'll glow by the weekend, and I'll save you the first one."],
    ["A Recipe, Finally", "You asked how I get the shortbread so crumbly. The secret is cold hands and warm company."],
    ["Thinking of Marlo", "Forty years ago today your grandmother lent me her bicycle. I never gave it back. Don't tell."],
  ],
  rosa: [
    ["Come see the tulips", "They've all opened overnight. You'll have to see them before the wind does."],
    ["Spare seedlings", "I've potted far too many marigolds. Please take some before they take over my kitchen."],
    ["Sunday?", "Tea on Sunday? I'll wear the flower crown. Finn won't notice, but I will."],
    ["Bees!", "The bees have returned to the orchard. Humming like a choir. Come listen."],
  ],
  dot: [
    ["Fresh loaf, saved for you", "Warm honey loaf. Come before ten or it'll be gone, I'm not joking."],
    ["Taste test", "I tried lavender in the shortbread. Tell me honestly. Dishonestly, if it's bad."],
    ["Flour shortage", "Swiftline's drone dropped my flour in the harbour AGAIN. Do you have a spare sack?"],
    ["Festival buns", "Fifty honey buns for Blossom Night. I'll need a taster. Or six."],
  ],
  pell: [
    ["New stationery in", "Cream paper, deckled edges. I thought of you the moment the box opened."],
    ["A small complaint", "Your handwriting is lovely. Your envelopes are crooked. We should discuss this."],
    ["Stamp collecting", "I've found a stamp from the year the lighthouse last lit. I'll show you, but you may not touch it."],
    ["Postmarks matter", "A postmark means someone was thinking of you, somewhere. Never forget that."],
  ],
  sable: [
    ["Bike news", "I've re-oiled every chain in town. Yours squeaked the loudest. I'm judging you."],
    ["Spokes and scarves", "Come by the shop. I've a new bell that sounds like a seagull with good manners."],
    ["Fashion advice", "Wear the red scarf. Trust me. You walk like a person with somewhere to be."],
    ["Quick favour?", "Could you bring me a spare inner tube? I'd ask Mo but he'd talk for an hour."],
  ],
  mayor: [
    ["Council notes", "Between us, I'm keen to see the post office thrive. Please keep this letter private."],
    ["A thought on drones", "They're efficient, I'll grant. But nobody has ever waved at a drone."],
    ["Lunch?", "I'm free at noon if you'd like to talk town business over something deep-fried."],
    ["Dull but important", "The harbour footbridge has been broken for years. If someone could raise the funds…"],
  ],
  mo: [
    ["Snacks restocked!", "New crunchy ones in. Monster-approved. Come see, bring your helper."],
    ["Mum wrote", "Mum says the city has no stray monsters. Sad city. Anyway, how are you?"],
    ["Bulk order", "I've got far too many tins of beans. Please advise. Please take some."],
    ["A rumour", "I heard the lighthouse has a ghost. Finn says it's just the Captain, snoring."],
  ],
  ada: [
    ["A friendly reminder", "Drink water. Wear a hat. Eat something green. Yours, with love, Nurse Ada."],
    ["Lollipops", "I have six hundred. Please, take some. For the children. For you."],
    ["Quiet week", "Nobody has come to the clinic all week. Either you're all healthy, or you're all hiding."],
    ["Tobi's knee", "The little one scraped his knee on the cliff path. He was very brave and also very loud."],
  ],
  finn: [
    ["Fish.", "Caught some. Left them by the pier. Take them if you want. If you don't, that's fine too."],
    ["…", "Nothing to report. Weather's weather. The tide came in. Then it went out."],
    ["About Sunday", "I'll wear the tie. Don't make it a thing."],
    ["Shelly's shell", "She found a whelk bigger than my head. I may have smiled. Just once."],
  ],
  shelly: [
    ["Look what the tide brought", "A glass float, a whelk and an entire left boot. The sea is generous."],
    ["Cloud report", "Tobi says today's clouds look like dragons. I said bunnies. We're still arguing."],
    ["Beachcomber's note", "Meet me at the low tide at four. I found a rock pool with a tiny crab. He's very rude."],
    ["Bottle post", "I put a message in a bottle again. This time it says 'hello'. Simple is best."],
  ],
  tobi: [
    ["Cloud number 212", "I drew cloud 212 today. It looks like a penguin. Does it look like a penguin?"],
    ["Hi!!!", "Dear friend. I'm writing a letter because the post is the best thing in the world."],
    ["Lighthouse", "The Captain let me look through the lens. It's very big. Please come."],
    ["Secrets", "I know where the best shells are, but I'm only telling people with three hearts. Heh."],
  ],
  captain: [
    ["The light", "The lens is cleaned. One day soon she'll turn again. I'd like it if you were here."],
    ["Barnaby here", "Fair winds, friend. The sea's been calm. Too calm. Nothing to fix, nothing to do. I miss it."],
    ["Biscuits", "The ship's biscuits are finished. If you have any left, I'm not too proud."],
    ["A confession", "I'm not good at letters. I'm trying. It helps that someone bothers to answer."],
  ],
};

const OUTSIDE: Note[] = [
  ["Weather Bureau", "A change in the wind is expected on Thursday. Hold on to your hat. Or your mail."],
  ["The Pen Pal Society", "You've been selected to receive a free postcard of a seagull. Do not respond."],
  ["A Cousin Overseas", "Hope the bay is sparkling! The city's dull. Do send me a shell. A big one."],
];

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Everyday mail for today: notes from villagers to their friends, plus the odd outside letter. */
export function personalLetters(day: number, who: string[], trust: Record<string, number>): Letter[] {
  const out: Letter[] = [];
  const order = [...who].sort((a, b) => hash(day, a.length * 31 + a.charCodeAt(0)) - hash(day, b.length * 31 + b.charCodeAt(0)));
  order.forEach((to, i) => {
    const friends = (VILLAGERS.find((v) => v.id === to)?.friends ?? []).filter((f) => who.includes(f));
    if (!friends.length) return;
    // closer friendships make people write more often
    if (hash(day, i + 7) > 0.35 + (trust[to] ?? 0) / 200) return;
    const from = friends[Math.floor(hash(day, i + 1) * friends.length)];
    const notes = NOTES[from];
    if (!notes) return;
    const [title, body] = notes[Math.floor(hash(day + i, from.length) * notes.length)];
    out.push({ id: `note-${day}-${i}`, to, from: VILLAGERS.find((v) => v.id === from)!.name, fromId: from, title, body });
  });
  const o = OUTSIDE[Math.floor(hash(day, 99) * OUTSIDE.length)];
  const to = who[Math.floor(hash(day, 55) * who.length)];
  if (to && hash(day, 3) < 0.35) out.push({ id: `outside-${day}`, to, from: o[0], title: "A Postcard", body: o[1] });
  return out;
}
