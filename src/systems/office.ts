// Your base: the sorting hall (helpers, bulletin board, projects) and the flat upstairs (bed, desk, postmarks).
import { sfx } from "../game/audio";
import { HELPERS, HELPER_ORDER, heartsOf, type HelperId } from "../game/helpers";
import { ITEMS } from "../game/items";
import { PROJECTS, TOWN_PROJECTS, addItem, calendar, count, save } from "../game/state";
import { addTrust, voters } from "../game/trust";
import type { Hotspot } from "../world/layout";
import type { World } from "../scenes/World";
import type { Msg } from "../scenes/UI";
import * as requestSys from "./requests";
import * as friendSys from "./friends";

const TILE = 16;

export function handle(w: World, h: Hotspot): boolean {
  switch (h.id) {
    case "helpers": helperBoard(w); return true;
    case "bulletin": requestSys.board(w); return true;
    case "projects": projectsDesk(w); return true;
    case "stairs": w.travel("flat", { x: 8, y: 3, dir: "down" }); return true;
    case "poster": w.say([{ text: "SWIFTLINE: DELIVERY WITHOUT THE SMALL TALK.\nSomeone has drawn a moustache on the drone. It's an improvement." }]); return true;
    case "bed": bed(w); return true;
    case "desk": friendSys.writeLetter(w); return true;
    case "book": friendSys.postmarkBook(w); return true;
    case "trapdoor": trapdoor(w); return true;
  }
  return false;
}

// ── Helper Board ─────────────────────────────────────────────
function helperBoard(w: World) {
  const s = w.state;
  const lines = HELPER_ORDER.map((id) => {
    const h = HELPERS[id];
    if (!s.helpers.includes(id)) return `? ${h.name}: ${h.unlock}`;
    const hearts = heartsOf(s.helperBond[id] ?? 0);
    return `${s.helper === id ? "▶" : "·"} ${h.name} ${"♥".repeat(hearts)}${"♡".repeat(5 - hearts)}: ${h.perk}`;
  });
  const unlocked = HELPER_ORDER.filter((id) => s.helpers.includes(id));
  w.say([{
    text: `HELPER BOARD\nHire one helper a day. Pay with a treat (their favourite makes a happier day). Good friends help for free.\n${lines.join("\n")}`,
    choices: [
      ...unlocked.map((id) => ({ label: `${HELPERS[id].name}: ${HELPERS[id].perk}`, cb: () => hire(w, id) })),
      ...(s.helper ? [{ label: "No helper today", cb: () => { s.helper = null; w.refresh(); } }] : []),
      { label: "Close", cb: () => {} },
    ],
  }]);
}

function hire(w: World, id: HelperId) {
  const s = w.state;
  const h = HELPERS[id];
  const bond = s.helperBond[id] ?? 0;
  const free = heartsOf(bond) >= 3;
  let used: string | null = null;
  if (!free) {
    if (count(s, h.fav) > 0) used = h.fav;
    else if (count(s, "treat") > 0) used = "treat";
    else if (["fishcracker", "honeydrop", "biscuit", "teaLeaf", "tart"].some((k) => count(s, k) > 0)) used = ["fishcracker", "honeydrop", "biscuit", "teaLeaf", "tart"].find((k) => count(s, k) > 0)!;
    else return w.say([{ text: `${h.name} would like a treat first. (Dot's Bakery in the Town Square sells them. ${ITEMS[h.fav].name} is ${h.name}'s favourite.)` }]);
  }
  if (used) addItem(s, used, -1);
  const fav = used === h.fav;
  s.helperBond[id] = bond + (fav ? 3 : 1);
  s.helper = id;
  sfx.befriend();
  w.refresh();
  save(s);
  w.say([{ name: h.name, text: free ? `${h.name} trots over, happy to help. (An old friend: no treat needed.)` : fav ? `${h.name} gobbles up its favourite and gets right to work!` : `${h.name} nibbles the treat and gets to work.` }, { text: `Today's helper: ${h.name}. ${h.perk}.` }]);
}

// ── Projects Desk ────────────────────────────────────────────
function projectsDesk(w: World) {
  const s = w.state;
  const nextPO = PROJECTS.find((p) => !s.projects.includes(p.id));
  const bridge = TOWN_PROJECTS[0];
  const bridgeDone = s.townProjects.includes(bridge.id);
  const done = PROJECTS.filter((p) => s.projects.includes(p.id)).map((p) => `✓ ${p.name}`);
  const choices: NonNullable<Msg["choices"]> = [];
  if (nextPO) choices.push({ label: `${nextPO.name} (${nextPO.cost}c)`, cb: () => pay(w, nextPO.id, nextPO.cost, nextPO.name, nextPO.perk) });
  if (!bridgeDone) choices.push({ label: `${bridge.name} (${bridge.cost}c)`, cb: () => pay(w, bridge.id, bridge.cost, bridge.name, bridge.perk) });
  choices.push({ label: "Close", cb: () => {} });
  w.say([{
    text: `PROJECTS DESK\nYou have ${s.coins}c.\n${done.join("\n")}${done.length ? "\n" : ""}${nextPO ? `Next: ${nextPO.name}. ${nextPO.perk}` : "The post office is fully restored!"}\n${bridgeDone ? "✓ Harbour footbridge" : `Town: ${bridge.name}. ${bridge.perk}`}`,
    choices,
  }]);
}

function pay(w: World, id: string, cost: number, name: string, perk: string) {
  const s = w.state;
  if (s.coins < cost) return w.say([{ text: `You need ${cost}c for that, and you have ${s.coins}c. Keep delivering!` }]);
  s.coins -= cost;
  sfx.unlock();
  if (id === "bridge") {
    s.townProjects.push(id);
    w.openBridge();
  } else {
    s.projects.push(id);
    if (id === "roof") for (const v of voters()) addTrust(s, v.id, 5);
    if (id === "room") addTrapdoor(w);
  }
  w.refresh();
  save(s);
  w.say([{ text: `Done! ${name}.\n${perk}` }]);
}

// ── The old sorting room ─────────────────────────────────────
export function addTrapdoor(w: World) {
  if (w.mapId !== "office") return;
  if (!w.mapDef.hotspots.some((h) => h.id === "trapdoor")) w.mapDef.hotspots.push({ id: "trapdoor", x: 1, y: 9, prompt: "Open the old trapdoor" });
  w.data2.solid[9][1] = true;
  w.track(w.add.image(1 * TILE, 9 * TILE, "trapdoor").setOrigin(0).setDepth(3));
}

function trapdoor(w: World) {
  const s = w.state;
  w.say([
    { text: "You haul up the trapdoor. Cold air, the smell of old paper, a staircase down into the dark." },
    { text: "The old sorting room. Dust-sheets over long tables, thousands of pigeonholes, and, jammed behind a drawer, a bundle of letters tied in string." },
    { text: "One is addressed to \"Hollis\", in a mother's handwriting. Its postmark is thirty years old. It was never delivered." },
  ], () => {
    if (!s.bag.includes("vane1") && !s.delivered.includes("vane1")) s.bag.push("vane1");
    w.mapDef.hotspots = w.mapDef.hotspots.filter((h) => h.id !== "trapdoor");
    w.refresh();
    save(s);
    w.say([{ text: "You've got Hollis's letter. Deliver it to Director Vane, who is usually near the Swiftline depot in the Town Square." }]);
  });
}

// ── Bed ──────────────────────────────────────────────────────
function bed(w: World) {
  const s = w.state;
  const c = calendar(s.day);
  w.say([{
    text: `${s.minutes < 19 * 60 ? "It's still early. " : ""}${s.bag.length ? `You still have ${s.bag.length} undelivered letters. They'll keep till tomorrow, but folks don't love waiting. ` : ""}Go to bed? (${c.season} ${c.dayOfSeason} ends.)`,
    choices: [{ label: "Sleep", cb: () => w.sleep() }, { label: "Not yet", cb: () => {} }],
  }]);
}
