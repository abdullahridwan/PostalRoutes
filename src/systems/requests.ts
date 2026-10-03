// The bulletin board: three small requests a day. Lost items to find, treats to bring,
// and parcel errands. Cheap to author, and it gives every day something to choose.
import { sfx } from "../game/audio";
import { GIFT_PREFS, ITEMS } from "../game/items";
import type { Letter } from "../game/letters";
import { addItem, count, has, reachable, save, type Request } from "../game/state";
import { addTrust, logEvent } from "../game/trust";
import { MAPS, VILLAGERS, type MapId } from "../world/layout";
import type { World } from "../scenes/World";
import * as npcSys from "./npcs";

const TILE = 16;

const SPOTS: Record<string, { x: number; y: number }[]> = {
  square: [{ x: 12, y: 16 }, { x: 30, y: 15 }, { x: 20, y: 28 }, { x: 36, y: 28 }, { x: 18, y: 22 }],
  village: [{ x: 28, y: 26 }, { x: 40, y: 22 }, { x: 18, y: 26 }, { x: 35, y: 31 }, { x: 44, y: 24 }],
  orchard: [{ x: 12, y: 14 }, { x: 30, y: 22 }, { x: 38, y: 18 }, { x: 22, y: 16 }, { x: 46, y: 28 }],
  point: [{ x: 20, y: 16 }, { x: 30, y: 24 }, { x: 14, y: 17 }],
};
const LOST = ["scarf", "locket", "glove", "teddy"];
const BRING = ["flower", "shell", "bun", "jam"];

function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function generate(w: World) {
  const s = w.state;
  const who = reachable(s);
  const pick = <T,>(arr: T[], k: number): T => arr[Math.floor(hash(s.day, k) * arr.length) % arr.length];
  const maps: MapId[] = ["square", "village", "orchard"];
  if (has(s, "bridge")) maps.push("point");
  const out: Request[] = [];

  const a = pick(who, 1);
  const lost = pick(LOST, 2);
  const m = pick(maps, 3);
  const spot = SPOTS[m][Math.floor(hash(s.day, 4) * SPOTS[m].length)];
  out.push({
    id: `fetch-${s.day}`, kind: "fetch", from: a, item: lost, spawnMap: m, spawnX: spot.x, spawnY: spot.y,
    title: `Find ${w.nameOf(a)}'s ${ITEMS[lost].name.replace("Lost ", "")}`,
    text: `I've lost my ${ITEMS[lost].name.replace("Lost ", "")} somewhere around ${MAPS[m].name}. I'd be so grateful if you found it!`,
    reward: 18, trust: 8, accepted: false, done: false,
  });

  const b = pick(who.filter((x) => x !== a), 5);
  const prefs = GIFT_PREFS[b];
  const want = pick([...(prefs?.loves ?? []), ...(prefs?.likes ?? []), pick(BRING, 6)], 7);
  out.push({
    id: `bring-${s.day}`, kind: "bring", from: b, item: want,
    title: `${ITEMS[want].name} for ${w.nameOf(b)}`,
    text: `I'd love a ${ITEMS[want].name.toLowerCase()} today, if you come across one. Bring it to me and I'll make it worth your while.`,
    reward: 14, trust: 6, accepted: false, done: false,
  });

  const c = pick(who.filter((x) => x !== a && x !== b), 8);
  const friends = (VILLAGERS.find((v) => v.id === c)?.friends ?? []).filter((f) => who.includes(f));
  const to = friends.length ? pick(friends, 9) : pick(who.filter((x) => x !== c), 9);
  out.push({
    id: `errand-${s.day}`, kind: "errand", from: c, to,
    title: `Parcel run to ${w.nameOf(to)}`,
    text: `Could you carry a parcel to ${w.nameOf(to)} before three? It's rather urgent, and rather fragile.`,
    reward: 20, trust: 8, accepted: false, done: false, deadline: 15 * 60,
  });
  s.requests = out;
}

export function board(w: World) {
  const s = w.state;
  const open = s.requests.filter((r) => !r.accepted && !r.done);
  const mine = s.requests.filter((r) => r.accepted && !r.done);
  const lines = [...mine.map((r) => `✔ In progress: ${r.title}`), ...s.requests.filter((r) => r.done).map((r) => `✓ Done: ${r.title}`)];
  if (!open.length) {
    w.say([{ text: `BULLETIN BOARD\n${lines.length ? lines.join("\n") : "Nothing new today."}\nCheck back tomorrow for new requests.` }]);
    return;
  }
  w.say([{
    text: `BULLETIN BOARD · requests from the town\n${lines.join("\n")}${lines.length ? "\n" : ""}Which would you like to take?`,
    choices: [
      ...open.map((r) => ({ label: `${r.title} (+${r.reward}c)`, cb: () => accept(w, r) })),
      { label: "Not now", cb: () => {} },
    ],
  }]);
}

function accept(w: World, r: Request) {
  const s = w.state;
  r.accepted = true;
  sfx.open();
  if (r.kind === "errand") {
    const l: Letter = {
      id: `req-${r.id}`, to: r.to!, from: w.nameOf(r.from), fromId: r.from, title: "A Fragile Parcel",
      body: `${w.nameOf(r.from)} asked me to send this over, and to say "do be careful with the lid." Enjoy!`,
      parcel: true, express: true, deadline: r.deadline, requestId: r.id,
    };
    s.extraLetters[l.id] = l;
    s.bag.push(l.id);
    w.say([{ ...w.speaker(r.from), text: r.text }, { text: `You took the parcel for ${w.nameOf(r.to!)}. It's in your bag. Deliver it before 3pm for the express bonus.` }], () => w.refresh());
  } else if (r.kind === "fetch") {
    w.say([{ ...w.speaker(r.from), text: r.text }, { text: `Keep an eye out for a glint around ${MAPS[r.spawnMap as MapId].name}. Rocky is good at sniffing things out.` }], () => { spawnItems(w); w.refresh(); });
  } else {
    w.say([{ ...w.speaker(r.from), text: r.text }], () => w.refresh());
  }
  save(s);
}

// ── Lost items on the map ────────────────────────────────────
const lost = new Map<string, { sprite: Phaser.GameObjects.Image; glint: Phaser.GameObjects.Image; reqId: string }>();

export function spawnItems(w: World) {
  lost.clear();
  if (w.mapDef.interior) return;
  for (const r of w.state.requests) {
    if (r.kind !== "fetch" || !r.accepted || r.done || r.found || r.spawnMap !== w.mapId) continue;
    const x = r.spawnX!, y = r.spawnY!;
    const sprite = w.track(w.add.image(x * TILE + 8, y * TILE + 10, `i_${r.item}`).setDepth(10 + y).setScale(1.3));
    const glint = w.track(w.add.image(x * TILE + 8, y * TILE + 2, "sparkle").setDepth(4000));
    w.tweens.add({ targets: glint, alpha: 0.2, yoyo: true, repeat: -1, duration: 450 });
    lost.set(`${x},${y}`, { sprite, glint, reqId: r.id });
  }
}

export function pickup(w: World, x: number, y: number) {
  const it = lost.get(`${x},${y}`);
  if (!it) return;
  lost.delete(`${x},${y}`);
  it.sprite.destroy();
  it.glint.destroy();
  const r = w.state.requests.find((q) => q.id === it.reqId);
  if (!r) return;
  r.found = true;
  addItem(w.state, r.item!, 1);
  sfx.coin();
  w.floatText(x, y - 0.6, `Found it!`);
  w.say([{ text: `You found ${w.nameOf(r.from)}'s ${ITEMS[r.item!].name.replace("Lost ", "")}! Bring it back to them.` }], () => w.refresh());
}

/** Where to point the arrow for a request. */
export function targetOf(w: World, r: Request): { map: MapId; x: number; y: number } | null {
  if (r.kind === "fetch" && !r.found) return { map: r.spawnMap as MapId, x: r.spawnX!, y: r.spawnY! };
  if (r.kind === "errand") return null; // the letter in the bag points the way
  const at = npcSys.whereIs(w, r.from);
  return at ? { map: at.map, x: at.x, y: at.y } : null;
}

/** Called when you talk to a villager: turn in finished requests. Returns lines to say, or null. */
export function turnIn(w: World, id: string) {
  const s = w.state;
  for (const r of s.requests) {
    if (!r.accepted || r.done || r.from !== id) continue;
    if ((r.kind === "fetch" && r.found && count(s, r.item!) > 0) || (r.kind === "bring" && count(s, r.item!) > 0)) {
      addItem(s, r.item!, -1);
      return finish(w, r, true);
    }
  }
  return null;
}

function finish(w: World, r: Request, fromTalk: boolean) {
  const s = w.state;
  r.done = true;
  s.requestsDone++;
  s.coins += r.reward;
  const d = addTrust(s, r.from, r.trust);
  logEvent(s, "favour", r.from, d);
  sfx.deliver();
  const v = w.vils.get(r.from);
  if (v?.w) { w.burst(v.w.tx, v.w.ty, "heart", 8); w.heartPop(v.w.tx, v.w.ty, d); }
  w.refresh();
  save(s);
  if (!fromTalk) return [];
  return [
    { ...w.speaker(r.from), text: r.kind === "fetch" ? "My very own! Oh, thank you. You have no idea." : "Just what I wanted. You're wonderful." },
    { text: `Request done! +${r.reward}c and a warm place in ${w.nameOf(r.from)}'s heart.` },
  ];
}

export function complete(w: World, requestId: string) {
  const r = w.state.requests.find((q) => q.id === requestId);
  if (r && !r.done) finish(w, r, false);
}
