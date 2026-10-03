// Every piece of mail in Seabreeze Bay. Story threads unlock as you befriend
// monsters (Rocky → cliffside, Pip's swim → Lighthouse Isle) and deliver earlier letters.

export type Requirement = "smash" | "swim" | "sortingRoom";

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
  fromDay?: number; // not sent before this day
  marlo?: boolean; // one of grandma's unsent letters (big trust boost)
};

export const LETTERS: Letter[] = [
  // ── Day one: the stakes ───────────────────────────────────
  {
    id: "mayor1", to: "mayor", from: "Swiftline Logistics",
    title: "Notice: The Council Vote",
    body: "Dear Mayor Hollyhock,\nAs agreed, the Council will vote in 20 days on our offer to replace the Seabreeze Post Office with a modern Swiftline Hub.\nProgress waits for no one.\n— H. Vane, Director",
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
  // ── Cliffside (needs Rocky to Smash the boulders) ───────────
  {
    id: "tobi1", to: "tobi", from: "Shelly", requires: "smash", after: "shelly1",
    title: "Hello up there!",
    body: "Hi! I found a bottle saying you watch the sea every evening. Me too! I collect shells. What do you collect? — Shelly (the beach house)",
    reply: "shelly2",
  },
  {
    id: "shelly2", to: "shelly", from: "Tobi", requires: "smash",
    title: "Hi Shelly!!!",
    body: "I collect CLOUDS. I draw them. I drew 211. Also nobody has ever written me before. Can I write back again? Can I? — Tobi (age 8 and 3/4)",
  },
  {
    id: "tobi2", to: "tobi", from: "Postmaster Gull", requires: "smash", after: "shelly2",
    title: "Official Junior Pen Pal Badge",
    body: "By the authority of the Seabreeze Post Office, Tobi is hereby a Certified Pen Pal. Duties: write letters. Benefits: receiving letters.",
    parcel: true,
  },
  {
    id: "ada2", to: "ada", from: "Tobi", requires: "smash", after: "tobi1",
    title: "A Drawing of a Cloud",
    body: "This cloud looks like a bandage so I thought you would want it. — Tobi",
  },
  // ── Lighthouse Isle (needs Pip to Swim) ─────────────────────
  {
    id: "captain1", to: "captain", from: "Marigold", requires: "swim", after: "granny1",
    title: "A Letter in Lilac Ink",
    body: "Barnaby, it's been forty summers since you rowed out to fix that old light, and you never rowed back. I planted Moonbells. They glow at night. In case you wanted something to steer by. — M.",
    reply: "granny3",
  },
  {
    id: "granny3", to: "granny", from: "Captain Barnaby", requires: "swim",
    title: "Salt-stained Envelope",
    body: "Marigold. I saw them. A little glowing patch on the shore, every night, and I thought it was a dream. I'm an old fool with a leaky boat. Would you… meet me at the pier? — B.",
  },
  {
    id: "captain2", to: "captain", from: "Finn", requires: "swim", after: "granny3", parcel: true,
    title: "Parcel: Boat Patching Kit",
    body: "Heard your boat leaks. Here's my best patching kit. Don't make Granny wait, Cap'n. — Finn\nP.S. Rosa said yes to tea!!",
  },
  {
    id: "rosa3", to: "rosa", from: "Finn", after: "finn1",
    title: "Signed, Finally",
    body: "It was me. Obviously. The mackerel gave it away. Tea on Sunday? I'll wash my hands twice. — Finn",
  },
  {
    id: "mo3", to: "mo", from: "Seabreeze Town Council", after: "captain2", requires: "swim",
    title: "Festival Supplies Order",
    body: "Please stock lanterns, streamers and 300 snacks. If the Council votes to keep the post office, Lantern Night is back on: Captain Barnaby has promised to relight the lighthouse!",
  },
  // ── The twist: found when you open the old sorting room ─────
  {
    id: "vane1", to: "vane", from: "Mum (postmarked 30 years ago)", requires: "sortingRoom",
    title: "The Undelivered Letter",
    body: "My dear Hollis,\nI'm sorry I left without saying goodbye. I'll write to you every single week, I promise.\nWatch the lighthouse. When it blinks, that's me thinking of you.\n— Mum",
  },
];

// After the story, the bay keeps writing to itself.
const FILLER_FROM = ["a cousin overseas", "the Weather Bureau", "a secret admirer", "the Shell Club", "an old friend", "the Pen Pal Society", "a travelling bard", "the Lighthouse Fund"];
const FILLER_TITLES = ["A Cheerful Postcard", "Rainy Day Doodles", "Recipe: Kelp Cookies", "Thank-you Note", "A Pressed Flower", "Gossip (Do Not Share)", "Seashell Trading Card", "Birthday Card (late)"];
const FILLER_BODIES = [
  "Just wanted to say: the sea looked extra sparkly today and I thought of you.",
  "Enclosed is a drawing of your monster. It's mostly circles. It's my best work.",
  "Mix kelp, honey and a pinch of sea salt. Bake until it smells like a summer afternoon.",
  "Thank you for being you. That's the whole letter. Have a nice day!",
  "Did you hear Finn wore a TIE to tea? An actual tie. Seabreeze is changing.",
  "The lighthouse blinked hello at me last night. I blinked back. I think we're friends now.",
];

export function fillerLetter(day: number, n: number, recipients: string[]): Letter {
  const r = (k: number) => Math.abs(Math.sin(day * 97.13 + n * 13.7 + k * 3.1)) % 1;
  return {
    id: `filler-${day}-${n}`,
    to: recipients[Math.floor(r(1) * recipients.length)],
    from: FILLER_FROM[Math.floor(r(2) * FILLER_FROM.length)],
    title: FILLER_TITLES[Math.floor(r(3) * FILLER_TITLES.length)],
    body: FILLER_BODIES[Math.floor(r(4) * FILLER_BODIES.length)],
    parcel: r(5) > 0.75,
  };
}
