// Heart events: short scenes that unlock as a villager's trust grows. Each is played once,
// the next time you talk to them. Lines are "who: text" ("you" is the player).
import type { HelperId } from "./helpers";

export type HeartEvent = {
  id: string;
  who: string;
  trust: number; // minimum trust
  lines: string[];
  choices?: { label: string; trust: number; reply: string }[];
  reward?: { coins?: number; item?: string; helper?: HelperId; text?: string };
  needs?: "bridge";
};

const E = (id: string, who: string, trust: number, lines: string[], choices?: HeartEvent["choices"], reward?: HeartEvent["reward"], needs?: "bridge"): HeartEvent =>
  ({ id, who, trust, lines, choices, reward, needs });

export const HEART_EVENTS: HeartEvent[] = [
  // ── Granny Marigold ─────────────────────────────────────────
  E("granny_tea", "granny", 45, [
    "granny: Come in, dear. I've put the good teapot out. How are you finding your grandmother's post office?",
    "you: Leaky, loud, and wonderful.",
    "granny: That's Marlo all over. We used to share a pot of tea on that very counter, forty years ago.",
  ], [
    { label: "Ask what Marlo was like", trust: 5, reply: "Stubborn. Generous. She read every postcard aloud before she delivered it. Shameless." },
    { label: "Tell her it's going well", trust: 2, reply: "Good. Keep going. She'd be so pleased." },
  ], { coins: 15 }),
  E("granny_marlo", "granny", 70, [
    "granny: I've something for you. Marlo gave me this jar of jam the day before she fell ill. I never opened it. I think she meant it for you.",
    "you: I can't take that.",
    "granny: You can, and you will. A good jam is for sharing, not for keeping.",
  ], undefined, { item: "jam", text: "Granny gave you a jar of jam." }),

  // ── Rosa ────────────────────────────────────────────────────
  E("rosa_bees", "rosa", 45, [
    "rosa: Shh. Listen. Do you hear them? The bees are humming the same note as the church bell.",
    "you: Is that normal?",
    "rosa: Nothing in this orchard is normal. That's why I stay.",
  ], [
    { label: "Stand and listen", trust: 5, reply: "(You listen for a long moment. It does sound like a bell. Rosa smiles at you.)" },
    { label: "Ask about the festival", trust: 2, reply: "Blossom Night! We light the whole orchard with lanterns. Come, if you can." },
  ], { item: "flower", text: "Rosa pinned a flower to your hat." }),
  E("rosa_leaf", "rosa", 65, [
    "rosa: I've been waiting to introduce you to someone. Leaf grows wherever it rains. It followed me home last spring.",
    "leaf: (A tiny green creature peeks out from the marigolds, then bows, very seriously.)",
    "rosa: It likes tea leaves and it likes you. Take it along, if you'd like. It makes the rain bearable.",
  ], undefined, { helper: "leaf", text: "Leaf can now be hired at the Helper Board." }),

  // ── Dot ─────────────────────────────────────────────────────
  E("dot_taste", "dot", 40, [
    "dot: Taste this. I'm trying lavender in the shortbread. Be honest. Actually be kind. No, honest.",
    "you: (It tastes a bit like soap, but charmingly so.)",
  ], [
    { label: "It's wonderful!", trust: 3, reply: "Liar. A lovely liar. Have a bun." },
    { label: "A little soapy, maybe?", trust: 6, reply: "…YES. Thank you! Nobody ever tells me. I'll halve the lavender." },
  ], { item: "bun", text: "Dot handed you a honey bun." }),
  E("dot_oven", "dot", 65, [
    "dot: This oven was my husband's. He'd sing to the dough. Terribly, but the bread loved it.",
    "dot: Since he passed, I bake fast so I don't think too much. You don't know how much it helps to have someone knock on the door each morning.",
  ], undefined, { coins: 20, text: "Dot tucked 20 coins into your hand. \"For the best mail I've had in years.\"" }),

  // ── Pell ────────────────────────────────────────────────────
  E("pell_stamp", "pell", 40, [
    "pell: Do you collect stamps? No? Pity. This one, the blue lighthouse, was printed the year the light last burned.",
    "pell: Don't touch it. Look only. Better yet, simply know that I have it.",
  ], [
    { label: "Look closely", trust: 5, reply: "…Yes. Just like that. Gently. You have a reverent face." },
    { label: "Ask what it's worth", trust: 0, reply: "Everything. And nothing. That's what makes it a stamp." },
  ], { coins: 10 }),
  E("pell_postmark", "pell", 65, [
    "pell: A postmark is proof that someone, somewhere, thought of you and walked to a counter to say so.",
    "pell: You carry that proof around every day. I used to think the post was dying. Watching you, I'm not so sure.",
  ], undefined, { item: "ribbon", text: "Pell tied a silk ribbon around your bag strap." }),

  // ── Sable ───────────────────────────────────────────────────
  E("sable_bell", "sable", 40, [
    "sable: Ring this. Go on. Hear it? That's a seagull with excellent manners.",
    "sable: I built it from three broken bells. I'm very proud. Please don't tell anyone it's from three bells.",
  ], undefined, { coins: 10 }),
  E("sable_gears", "sable", 65, [
    "sable: Everybody asks why a mechanic lives in a town of letters. Easy. Bicycles carry people. Letters carry people. Same thing, different gears.",
    "sable: You'd make a decent mechanic. Terrible haircut, but decent.",
  ], undefined, { coins: 25 }),

  // ── Mo ──────────────────────────────────────────────────────
  E("mo_mum", "mo", 40, [
    "mo: Mum's letters are all the same. 'The city is loud. Nobody waves. Eat vegetables.' I've kept every one.",
  ], [
    { label: "Read one together", trust: 6, reply: "Mo's voice goes thick halfway through. He says it's the dust." },
    { label: "Offer to carry a reply", trust: 3, reply: "Would you? She'd love that. I'll even write something nice." },
  ], { item: "jam", text: "Mo gave you a jar of jam from the shelf." }),
  E("mo_lonely", "mo", 65, [
    "mo: I talk a lot. I know. It's because the shop is quiet when everybody leaves.",
    "mo: But you stop and listen. Nobody does that. It's… well. Thanks.",
  ], undefined, { coins: 15 }),

  // ── Mayor Hollyhock ─────────────────────────────────────────
  E("mayor_bridge", "mayor", 45, [
    "mayor: Between us, the harbour footbridge has been broken for years. The Point's cut off. The Captain hasn't had a visitor since.",
    "mayor: The Council always says there's no budget. But there's a Projects Desk at the Post Office, you know. It takes donations.",
  ], undefined, { text: "(You can pay to rebuild the footbridge at the Projects Desk in the Post Office.)" }),
  E("mayor_people", "mayor", 70, [
    "mayor: A town is just people who write to each other. Your grandmother said that, the day she made me deliver the papers.",
    "mayor: Do you know I was the worst paper boy in the history of the bay? She never once gave up on me.",
  ], undefined, { coins: 20 }),

  // ── Ada ─────────────────────────────────────────────────────
  E("ada_clinic", "ada", 40, [
    "ada: Sit. Drink some water. Not because you're sick. Because I worry and it gives me something to do.",
  ], [
    { label: "Drink the water", trust: 4, reply: "Good. Now eat something green on the way out. A pea counts." },
    { label: "Offer her a lollipop", trust: 5, reply: "…You're the first person to give me one back. Thank you." },
  ], { coins: 10 }),
  E("ada_secret", "ada", 65, [
    "ada: Confession: I came to Seabreeze because of a postcard. A nurse needed in a harbour town. No other reason.",
    "ada: Your grandmother delivered that postcard herself. Through the rain. I took the job on the spot.",
  ], undefined, { coins: 20 }),

  // ── Finn ────────────────────────────────────────────────────
  E("finn_fish", "finn", 35, [
    "finn: …",
    "finn: (He nods at a bucket by the pier.) Caught too many. Take one.",
    "you: Thanks, Finn.",
    "finn: (He looks away, but he's smiling, just slightly.)",
  ], undefined, { coins: 10 }),
  E("finn_tie", "finn", 60, [
    "finn: I have a tie. For tea. With Rosa. I don't know how it works.",
  ], [
    { label: "Help him tie it", trust: 6, reply: "(After four tries it looks almost right. Finn stares at himself in the glass.)" },
    { label: "Tell him she'll love it", trust: 4, reply: "…You think so? It's blue. She likes blue. Don't tell her I asked." },
  ], { coins: 15 }),

  // ── Shelly ──────────────────────────────────────────────────
  E("shelly_tide", "shelly", 40, [
    "shelly: Every tide brings a different thing. Today: a glass float, a whelk, and, I swear, a left sock.",
    "shelly: I keep them all. A beach never stops writing letters. You just have to be the one who reads them.",
  ], undefined, { item: "shell", text: "Shelly pressed a shell into your palm." }),
  E("shelly_bottle", "shelly", 65, [
    "shelly: I put a bottle in the sea every year. Same message. 'Hello.' Never gotten a reply.",
    "shelly: Until you came, I thought that was the whole point. Now I think the point was that someone might.",
  ], undefined, { coins: 20 }),

  // ── Tobi (after the bridge) ─────────────────────────────────
  E("tobi_clouds", "tobi", 40, [
    "tobi: Look up! That one's a dragon. No, a bunny. No, a dragon eating a bunny. No, a penguin.",
    "you: It looks like a penguin.",
    "tobi: !!! You get it! Cloud number 213: the Penguin. I'll draw it tonight.",
  ], undefined, { coins: 10 }, "bridge"),

  // ── Captain Barnaby (after the bridge) ──────────────────────
  E("captain_light", "captain", 45, [
    "captain: Forty years I tended that light. Then one night the lens cracked and I couldn't bring myself to fix it. Silly, isn't it?",
    "you: Not silly.",
    "captain: You're kind. Marigold said you would be.",
  ], undefined, { text: "(The Captain looks toward the lighthouse. Something in him seems lighter.)" }, "bridge"),
  E("captain_vane", "captain", 70, [
    "captain: I knew the director's mother, you know. She stood on that cliff every evening. Waiting for a ship that never brought her boy.",
    "captain: If a letter ever turns up in that old sorting room of yours, remember: some letters are lighthouses.",
  ], undefined, { coins: 25 }, "bridge"),
];
