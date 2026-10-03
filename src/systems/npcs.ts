// Villagers with lives: they follow a schedule and walk real routes between places.
// Off-screen they simply reappear where they should be; on-screen they walk to the road and fade out.
import { DIRS, TILE, Walker, type Dir } from "../entities/Walker";
import { sfx } from "../game/audio";
import { HELPERS } from "../game/helpers";
import { count, addItem, has } from "../game/state";
import { targetFor, type Ctx } from "../game/schedule";
import { MAPS, VILLAGERS, type MapId, type Warp } from "../world/layout";
import type { Spot, Vil, World } from "../scenes/World";

/** Where you can walk between maps. */
const ADJ: Record<MapId, MapId[]> = {
  office: ["square", "flat"], flat: ["office"], square: ["office", "village", "orchard"],
  village: ["square", "point"], orchard: ["square"], point: ["village"],
};

export function nextHop(from: MapId, to: MapId): MapId | null {
  if (from === to) return null;
  const prev = new Map<MapId, MapId>([[from, from]]);
  const q: MapId[] = [from];
  while (q.length) {
    const m = q.shift()!;
    if (m === to) break;
    for (const n of ADJ[m]) if (!prev.has(n)) { prev.set(n, m); q.push(n); }
  }
  if (!prev.has(to)) return null;
  let cur = to;
  while (prev.get(cur) !== from) cur = prev.get(cur)!;
  return cur;
}

export function warpToward(from: MapId, hop: MapId): Warp | undefined {
  return MAPS[from].warps.find((w) => w.to === hop);
}

const ENTRY: Record<MapId, { x: number; y: number }> = {
  square: { x: 23, y: 31 }, village: { x: 31, y: 2 }, orchard: { x: 2, y: 19 }, point: { x: 2, y: 19 },
  office: { x: 6, y: 9 }, flat: { x: 8, y: 3 },
};

export const ctx = (w: World): Ctx => ({
  day: w.state.day, minutes: w.state.minutes, bridge: has(w.state, "bridge"), vaneSoftened: w.state.vaneSoftened,
});

export function init(w: World) {
  w.vils.clear();
  for (const def of VILLAGERS) {
    const t = targetFor(def.id, ctx(w));
    w.vils.set(def.id, { id: def.id, def, where: t, path: [], leaving: false, nextIdle: 0 });
  }
}

/** New day: everyone starts where their morning schedule says. */
export function resetDay(w: World) {
  for (const v of w.vils.values()) {
    if (v.id.startsWith("vendor")) { w.vils.delete(v.id); continue; }
    v.where = targetFor(v.id, ctx(w));
    v.path = [];
    v.leaving = false;
  }
}

// ── Wild helpers (first meetings) ────────────────────────────
const wild = new Map<string, Walker>();
const WILD_SPOTS: Record<string, { map: MapId; x: number; y: number; sprite: string }> = {
  bzz: { map: "orchard", x: 30, y: 13, sprite: "bee" },
  rocky: { map: "point", x: 21, y: 27, sprite: "rockitten" },
};

export function unload(w: World) {
  for (const v of w.vils.values()) {
    if (v.w) { v.w.destroy(); v.w = undefined; }
    v.path = [];
  }
  for (const m of wild.values()) { w.tweens.killTweensOf(m.sprite); m.destroy(); }
  wild.clear();
}

export function load(w: World) {
  for (const v of w.vils.values()) {
    if (v.where && v.where.map === w.mapId) spawn(w, v, v.where);
  }
  for (const [id, spot] of Object.entries(WILD_SPOTS)) {
    const met = id === "bzz" ? w.state.bzzMet : w.state.rockyMet;
    if (spot.map !== w.mapId || met) continue;
    const m = new Walker(w, spot.sprite, spot.x, spot.y);
    m.bob = id === "bzz" ? -6 : 0;
    m.place();
    wild.set(id, m);
    w.tweens.add({ targets: m.sprite, y: m.sprite.y - 3, yoyo: true, repeat: -1, duration: 520, ease: "Sine.inOut" });
  }
}

function spawn(w: World, v: Vil, at: { x: number; y: number }, fadeIn = false) {
  const wk = new Walker(w, v.def.sprite, at.x, at.y);
  wk.face("down");
  v.w = wk;
  if (fadeIn) {
    wk.sprite.setAlpha(0); wk.shadow.setAlpha(0);
    w.tweens.add({ targets: wk.sprite, alpha: 1, duration: 450 });
    w.tweens.add({ targets: wk.shadow, alpha: 0.22, duration: 450 });
  }
}

export function wildAt(w: World, x: number, y: number): string | null {
  for (const [id, m] of wild) if (m.tx === x && m.ty === y) return id;
  void w;
  return null;
}

export function meetWild(w: World, id: string) {
  const s = w.state;
  const h = HELPERS[id as keyof typeof HELPERS];
  if (id === "bzz") {
    w.say([
      { text: "A small bee is tangled in a spider's web, buzzing in a very cross way." },
      { text: "Carefully, you free it. It zips in a loop around your head, then lands on your hat.", onShow: () => w.burst(wild.get("bzz")!.tx, wild.get("bzz")!.ty, "heart", 8) },
      { name: "Bzz", text: "Bzzzz! ♪" },
      { text: "Bzz can now be hired as a helper at the Helper Board in the Post Office. It loves honey drops from Dot's Bakery." },
    ], () => {
      s.bzzMet = true;
      if (!s.helpers.includes("bzz")) s.helpers.push("bzz");
      s.helperBond.bzz = (s.helperBond.bzz ?? 0) + 4;
      const m = wild.get("bzz");
      if (m) { w.tweens.killTweensOf(m.sprite); m.destroy(); wild.delete("bzz"); }
      sfx.befriend();
      w.refresh();
    });
    return;
  }
  if (id === "rocky") {
    const treat = ["biscuit", "treat", "fishcracker", "honeydrop", "teaLeaf", "tart"].find((t) => count(s, t) > 0);
    if (!treat) {
      w.say([{ text: "A grumpy Rockitten sits on the cliff path, sniffing the air and glaring. It clearly wants something. A treat, maybe?\n(Dot's Bakery sells them.)" }]);
      return;
    }
    w.say([{
      text: "A grumpy Rockitten blocks the path. It sniffs your bag.",
      choices: [
        { label: "Offer a treat", cb: () => {
          addItem(s, treat, -1);
          s.rockyMet = true;
          if (!s.helpers.includes("rocky")) s.helpers.push("rocky");
          s.helperBond.rocky = (s.helperBond.rocky ?? 0) + (treat === "biscuit" ? 6 : 3);
          const m = wild.get("rocky");
          if (m) w.burst(m.tx, m.ty, "heart", 8);
          if (m) { w.tweens.killTweensOf(m.sprite); m.destroy(); wild.delete("rocky"); }
          sfx.befriend();
          w.say([{ name: "Rocky", text: "Mrrow. (It chomps the treat, then grudgingly nudges your leg.)" }, { text: `Rocky can now be hired at the Helper Board. ${h.perk}.` }], () => w.refresh());
        } },
        { label: "Not now", cb: () => {} },
      ],
    }]);
  }
}

// ── Walking around ───────────────────────────────────────────
function passable(w: World, x: number, y: number) {
  return x >= 0 && y >= 0 && x < w.mapDef.W && y < w.mapDef.H && !w.data2.solid[y][x];
}

function bfs(w: World, from: { x: number; y: number }, to: { x: number; y: number }, limit = 5000) {
  if (from.x === to.x && from.y === to.y) return [];
  const key = (x: number, y: number) => y * w.mapDef.W + x;
  const prev = new Map<number, number>([[key(from.x, from.y), -1]]);
  const q = [from];
  let n = 0;
  while (q.length && n++ < limit) {
    const c = q.shift()!;
    for (const d of Object.values(DIRS)) {
      const nx = c.x + d.x, ny = c.y + d.y;
      const k = key(nx, ny);
      const atGoal = nx === to.x && ny === to.y;
      if (prev.has(k) || (!atGoal && !passable(w, nx, ny))) continue;
      prev.set(k, key(c.x, c.y));
      if (atGoal) {
        const out: { x: number; y: number }[] = [];
        let cur = k;
        while (cur !== key(from.x, from.y)) {
          out.push({ x: cur % w.mapDef.W, y: Math.floor(cur / w.mapDef.W) });
          cur = prev.get(cur)!;
        }
        return out.reverse();
      }
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");

function walkTo(w: World, v: Vil, dest: { x: number; y: number }): "arrived" | "walking" | "stuck" {
  const wk = v.w!;
  if (wk.moving) return "walking";
  if (wk.tx === dest.x && wk.ty === dest.y) return "arrived";
  if (!v.path.length || v.path[v.path.length - 1].x !== dest.x || v.path[v.path.length - 1].y !== dest.y) {
    const p = bfs(w, { x: wk.tx, y: wk.ty }, dest);
    if (!p) return "stuck";
    v.path = p;
  }
  const nxt = v.path[0];
  const blocked = (w.player.tx === nxt.x && w.player.ty === nxt.y) || [...w.vils.values()].some((o) => o !== v && o.w && o.w.tx === nxt.x && o.w.ty === nxt.y);
  if (blocked) { v.path = []; wk.face(dirOf(nxt.x - wk.tx, nxt.y - wk.ty)); return "walking"; }
  v.path.shift();
  wk.step(dirOf(nxt.x - wk.tx, nxt.y - wk.ty), 300, () => wk.idle());
  return "walking";
}

function fadeOut(w: World, v: Vil, then: () => void) {
  const wk = v.w;
  if (!wk) return then();
  w.tweens.add({ targets: [wk.sprite, wk.shadow], alpha: 0, duration: 380, onComplete: () => { wk.destroy(); if (v.w === wk) v.w = undefined; then(); } });
  v.leaving = true;
}

export function tick(w: World) {
  const c = ctx(w);
  for (const v of w.vils.values()) {
    if (v.id.startsWith("vendor") || v.leaving) continue;
    const t = targetFor(v.id, c);
    const visible = !!v.w && v.where?.map === w.mapId;

    // going home for the night
    if (!t) {
      if (v.where) {
        if (visible) fadeOut(w, v, () => { v.where = null; v.leaving = false; });
        else v.where = null;
      }
      continue;
    }

    // arriving from home / another map
    if (!v.where) {
      if (t.map === w.mapId) {
        v.where = { map: t.map, ...ENTRY[t.map] };
        if (!passable(w, v.where.x, v.where.y) || w.walkable(v.where.x, v.where.y) === false) v.where = { map: t.map, x: t.x, y: t.y };
        spawn(w, v, v.where, true);
      } else v.where = t;
      continue;
    }

    if (v.where.map !== t.map) {
      // needs to change maps: walk to the exit, fade through it
      const hop = nextHop(v.where.map, t.map);
      const warp = hop ? warpToward(v.where.map, hop) : undefined;
      if (!warp || !hop) { v.where = t; continue; }
      if (visible) {
        const dest = { x: warp.x + Math.floor(warp.w / 2), y: warp.y + Math.floor(warp.h / 2) };
        const r = walkTo(w, v, dest);
        if (r === "arrived" || r === "stuck") fadeOut(w, v, () => { v.where = { map: hop, ...warp.spawn }; v.leaving = false; });
      } else {
        v.where = t.map === hop ? { map: hop, ...warp.spawn } : { map: hop, ...warp.spawn };
      }
      continue;
    }

    // same map
    if (!visible) {
      if (t.map === w.mapId && !v.w) {
        spawn(w, v, v.where, true);
      } else if (v.where.x !== t.x || v.where.y !== t.y) v.where = t;
      continue;
    }
    const wk = v.w!;
    const r = walkTo(w, v, t);
    if (r === "arrived") {
      v.where = { map: t.map, x: wk.tx, y: wk.ty };
      // little idle shuffles near their spot
      if (v.def.wander > 0 && w.time.now > v.nextIdle) {
        v.nextIdle = w.time.now + 3000 + Math.random() * 5000;
        const d = Object.values(DIRS)[Math.floor(Math.random() * 4)];
        const nx = wk.tx + d.x, ny = wk.ty + d.y;
        if (Math.abs(nx - t.x) <= v.def.wander && Math.abs(ny - t.y) <= v.def.wander && w.walkable(nx, ny) && !(w.player.tx === nx && w.player.ty === ny)) {
          wk.step(dirOf(d.x, d.y), 320, () => wk.idle());
        } else wk.face(dirOf(d.x, d.y));
      }
    } else if (v.where) {
      v.where = { map: v.where.map, x: wk.tx, y: wk.ty };
    }
  }
}

/** Where a villager is right now (for arrows and quests), or null if at home. */
export function whereIs(w: World, id: string): Spot | null {
  const v = w.vils.get(id);
  if (!v) return null;
  if (v.w && v.where?.map === w.mapId) return { map: w.mapId, x: v.w.tx, y: v.w.ty };
  return v.where;
}

export { TILE };
