// Swiftline: drones that patrol the square, race you to mailboxes and really deliver, and a
// market share that shows up as drone lockers in the square.
import { TILE } from "../entities/Walker";
import { sfx } from "../game/audio";
import { letterById, save } from "../game/state";
import { addTrust, logEvent } from "../game/trust";
import { LOCKER_SPOTS, MAPS, homeOf, type MapId } from "../world/layout";
import type { World } from "../scenes/World";

type Drone = {
  letterId: string; to: string; map: MapId;
  from: { x: number; y: number }; dest: { x: number; y: number };
  launchAt: number; arriveAt: number; announced: boolean; done: boolean;
  sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse;
};

let drones: Drone[] = [];
let ambient: { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; cx: number; cy: number; rx: number; ry: number; speed: number; phase: number }[] = [];
let parcels = new Map<string, { sprite: Phaser.GameObjects.Image; reward: number }>();

const FLIGHT_MS = 50_000;
const LAUNCH_MS = 25_000;

export function clamp(share: number) { return Math.max(0, Math.min(100, share)); }

export function reset() {
  for (const d of drones) { d.sprite?.destroy(); d.shadow?.destroy(); }
  drones = [];
}

export function unload(_w: World) {
  ambient = [];
  parcels = new Map();
  for (const d of drones) { d.sprite?.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined; }
}

// ── Lockers: Swiftline taking over ───────────────────────────
export function lockerCount(share: number) {
  return share >= 90 ? 4 : share >= 75 ? 3 : share >= 60 ? 2 : share >= 45 ? 1 : 0;
}

export function buildLockers(w: World) {
  const n = lockerCount(w.state.share);
  for (let i = 0; i < n; i++) {
    const s = LOCKER_SPOTS[i];
    w.track(w.add.image(s.x * TILE + 8, s.y * TILE + 24, "locker").setOrigin(0.5, 1).setDepth(10 + s.y + 1));
    w.data2.solid[s.y][s.x] = true;
  }
}

// ── Ambient drones: always there, so the villain feels real ──
export function spawnAmbient(w: World) {
  ambient = [];
  const s = w.state;
  if (w.mapId !== "square" || s.vaneSoftened) return;
  const n = s.share >= 70 ? 4 : s.share >= 40 ? 3 : 2;
  const defs = [
    { cx: 36, cy: 24, rx: 4, ry: 2, speed: 0.0007, phase: 0 },
    { cx: 25, cy: 22, rx: 11, ry: 3, speed: 0.00035, phase: 2 },
    { cx: 24, cy: 10, rx: 8, ry: 2, speed: 0.0005, phase: 4 },
    { cx: 14, cy: 26, rx: 5, ry: 2, speed: 0.0006, phase: 1 },
  ].slice(0, n);
  for (const d of defs) {
    const shadow = w.track(w.add.ellipse(0, 0, 12, 4, 0x000000, 0.22).setDepth(9));
    const sprite = w.track(w.add.image(0, 0, "drone").setDepth(4400).setScale(1.5));
    ambient.push({ sprite, shadow, ...d });
  }
}

export function updateAmbient(w: World) {
  const t = w.time.now;
  for (const d of ambient) {
    if (!d.sprite.active) continue;
    const a = t * d.speed + d.phase;
    const x = (d.cx + Math.cos(a) * d.rx) * TILE + 8;
    const y = (d.cy + Math.sin(a) * d.ry) * TILE;
    d.sprite.setPosition(x, y + Math.sin(t / 160 + d.phase) * 2).setFlipX(-Math.sin(a) * d.rx > 0);
    d.shadow.setPosition(x, y + 22);
  }
}

// ── Delivery drones: they really bring parcels ───────────────
export function schedule(w: World) {
  const s = w.state;
  drones = drones.filter((d) => !d.done);
  if (s.vaneSoftened) return;
  const count = s.day < 2 ? 1 : s.share >= 70 || s.day >= 8 ? 2 : 1;
  const flight = FLIGHT_MS * (s.helper === "snug" ? 1.8 : 1);
  const cands = s.bag.filter((id) => {
    const l = letterById(s, id);
    return l && !l.reply && !l.marlo && !l.requestId && !["vane1", "mayor1"].includes(id) && homeOf(l.to);
  }).sort(() => Math.random() - 0.5).slice(0, count);
  cands.forEach((id, i) => {
    const l = letterById(s, id)!;
    const home = homeOf(l.to)!;
    const b = home.building;
    const door = { x: b.x + b.door, y: b.y + 4 };
    const depot = MAPS.square.buildings.find((x) => x.id === "depot")!;
    const entry = MAPS[home.map].warps[0];
    const from = home.map === "square" ? { x: depot.x + 3, y: depot.y } : { x: entry.x + 1, y: entry.y };
    const launchAt = w.playMs + LAUNCH_MS * (i + 1) + (s.day < 2 ? 15_000 : 0);
    drones.push({ letterId: id, to: l.to, map: home.map, from, dest: { x: door.x + 1, y: door.y - 1 }, launchAt, arriveAt: launchAt + flight, announced: false, done: false });
  });
}

/** You delivered a letter that a drone was heading for. Returns true if you beat it. */
export function beat(w: World, letterId: string) {
  let won = false;
  for (const d of drones) {
    if (d.letterId !== letterId || d.done) continue;
    d.done = true;
    if (w.playMs >= d.launchAt) {
      won = true;
      w.state.share = clamp(w.state.share - 2);
      w.ui.toast("You beat the drone! It buzzes off, empty-handed.");
      sfx.unlock();
    }
    const spr = d.sprite, sh = d.shadow;
    if (spr) w.tweens.add({ targets: [spr, sh], alpha: 0, y: "-=20", duration: 800, onComplete: () => { spr.destroy(); sh?.destroy(); } });
    d.sprite = d.shadow = undefined;
  }
  return won;
}

export function update(w: World) {
  const s = w.state;
  const now = w.playMs;
  for (const d of drones) {
    if (d.done || now < d.launchAt) continue;
    if (!s.bag.includes(d.letterId)) { d.done = true; d.sprite?.destroy(); d.shadow?.destroy(); continue; }
    if (!d.announced) {
      d.announced = true;
      sfx.bump();
      w.ui.toast(`A Swiftline drone is heading for ${w.nameOf(d.to)}'s mailbox!`);
    }
    if (now >= d.arriveAt) { land(w, d); continue; }
    if (d.map !== w.mapId) {
      if (d.sprite) { d.sprite.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined; }
      continue;
    }
    const p = (now - d.launchAt) / (d.arriveAt - d.launchAt);
    const x = (d.from.x + (d.dest.x - d.from.x) * p) * TILE + 8;
    const y = (d.from.y + (d.dest.y - d.from.y) * p) * TILE + 8;
    if (!d.sprite) {
      d.shadow = w.add.ellipse(x, y + 18, 12, 4, 0x000000, 0.25).setDepth(9);
      d.sprite = w.add.image(x, y, "drone").setDepth(4400).setScale(1.5);
    }
    d.sprite.setPosition(x, y + Math.sin(w.time.now / 180) * 2).setFlipX(d.dest.x < d.from.x);
    d.shadow!.setPosition(x, y + 18);
  }
}

/** The drone arrives, drops the parcel, and the villager reacts. */
function land(w: World, d: Drone) {
  const s = w.state;
  d.done = true;
  s.bag = s.bag.filter((id) => id !== d.letterId);
  s.delivered.push(d.letterId);
  s.swiftlineTook++;
  s.share = clamp(s.share + 2);
  const delta = addTrust(s, d.to, -3);
  logEvent(s, "drone_beat", d.to, delta);
  const home = homeOf(d.to);
  const mb = home && w.mapId === d.map ? w.data2.mailboxes.find((m) => m.id === home.building.id) : null;
  if (d.sprite && mb) {
    const spr = d.sprite, sh = d.shadow;
    // land on the doorstep, leave a parcel, take off again
    w.tweens.add({ targets: spr, x: mb.x * TILE + 8, y: mb.y * TILE + 4, duration: 600, onComplete: () => {
      const box = w.add.image(mb.x * TILE + 8, mb.y * TILE + 14, "parcel").setDepth(10 + mb.y + 2);
      w.tweens.add({ targets: box, alpha: 0, delay: 12_000, duration: 800, onComplete: () => box.destroy() });
      w.tweens.add({ targets: [spr, sh], alpha: 0, y: "-=30", delay: 500, duration: 800, onComplete: () => { spr.destroy(); sh?.destroy(); } });
      const v = w.vils.get(d.to);
      if (v?.w) w.bubble(v.w, "Swiftline again…");
    } });
    d.sprite = d.shadow = undefined;
  } else {
    d.sprite?.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined;
  }
  sfx.smash();
  w.ui.toast(`Too slow! Swiftline delivered ${w.nameOf(d.to)}'s letter.`);
  w.refresh();
  save(s);
}

// ── A drone malfunction (daily event): parcels to rescue ─────
export function spawnCrash(w: World) {
  if (w.mapId !== "square") return;
  const spots = [{ x: 31, y: 24 }, { x: 33, y: 20 }, { x: 27, y: 25 }];
  for (const p of spots) {
    const sprite = w.track(w.add.image(p.x * TILE + 8, p.y * TILE + 10, "parcel").setDepth(10 + p.y).setScale(1.3));
    w.tweens.add({ targets: sprite, y: sprite.y - 2, yoyo: true, repeat: -1, duration: 600 });
    parcels.set(`${p.x},${p.y}`, { sprite, reward: 10 });
  }
}

export function pickupParcel(w: World, x: number, y: number) {
  const p = parcels.get(`${x},${y}`);
  if (!p) return;
  parcels.delete(`${x},${y}`);
  p.sprite.destroy();
  w.state.coins += p.reward;
  w.state.earnedToday += p.reward;
  w.state.share = clamp(w.state.share - 1);
  sfx.coin();
  w.floatText(x, y - 0.6, `+${p.reward}c salvage`);
  w.refresh();
}
