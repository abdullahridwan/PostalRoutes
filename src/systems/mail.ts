// The mail itself: picking it up, delivering it, and the arrows and objective that guide you.
import { TILE } from "../entities/Walker";
import { sfx } from "../game/audio";
import type { Letter } from "../game/letters";
import { addItem, calendar, clockText, letterById, packBag, save, bagSize, weatherFor, type Request } from "../game/state";
import { addTrust, logEvent, tier } from "../game/trust";
import { MAPS, VILLAGERS, homeOf, type MapId } from "../world/layout";
import type { World } from "../scenes/World";
import type { Msg } from "../scenes/UI";
import * as calendarSys from "./calendar";
import * as friendSys from "./friends";
import * as dronesSys from "./drones";
import * as npcSys from "./npcs";
import * as requestSys from "./requests";

export function lettersFor(w: World, who: string): Letter[] {
  return w.state.bag.map((id) => letterById(w.state, id)!).filter((l) => l && l.to === who);
}

// ── Postmaster Gull ──────────────────────────────────────────
export function talkToGull(w: World) {
  const s = w.state;
  const g = { name: "Postmaster Gull", portrait: "professor" };
  const forYou = lettersFor(w, "you")[0];
  if (forYou) {
    w.say([{ ...g, text: `A letter for YOU, from ${forYou.from}! A real one, by the look of the handwriting. Let's have a look.` }], () => friendSys.receive(w, forYou));
    return;
  }
  if (!s.pickedUp) {
    const { fresh, diverted } = packBag(s);
    const rush = calendarSys.addRush(w);
    sfx.open();
    const lines: Msg[] = [];
    if (s.day === 1) {
      lines.push({ ...g, text: "Your first mailbag. Hand letters over in person when you can, and be quick about it. People remember." });
    } else {
      lines.push({ ...g, text: `Morning! ${fresh.length + (rush ? 1 : 0)} letters today. ${bagFullness(w, fresh.length)}` });
      if (diverted) lines.push({ ...g, text: `Swiftline took ${diverted} more from folks who don't trust us yet. Win them over and their mail comes back.` });
      const hint = hintFor(w);
      if (hint) lines.push({ ...g, text: hint });
    }
    if (rush) lines.push({ ...g, text: `Oh, and this one is express, for ${w.nameOf(rush.to)}. Get it there within three hours and there's a tip in it.` });
    lines.push({ text: `You got the mailbag! (${s.bag.length} letters.) TAB shows who they're for. The bulletin board on the wall has today's requests.` });
    w.say(lines, () => { w.refresh(); dronesSys.schedule(w); });
    return;
  }
  if (s.bag.length === 0) {
    w.say([{ ...g, text: "Bag's empty. Lovely work. The day's yours now: visit friends, check the bulletin board, or spend what you've earned." }]);
  } else {
    w.say([{ ...g, text: `Still ${s.bag.length} to go. Follow the little arrows, they point to the mailboxes!` }]);
  }
}

function bagFullness(w: World, n: number) {
  const cap = bagSize(w.state);
  return n >= cap ? "Your bag's full to the brim." : `Your bag holds ${cap}.`;
}

/** A gentle nudge toward whatever the player might be missing. */
function hintFor(w: World): string {
  const s = w.state;
  if (s.day >= 2 && s.helpers.length >= 1 && !s.helper) return "Don't forget the Helper Board. A helper makes the day easier.";
  if (!s.bzzMet && s.day >= 2) return "Rosa says a bee keeps buzzing around the Orchard Meadow, east of the square.";
  if (!s.townProjects.includes("bridge") && s.day >= 4) return "The Captain at Lighthouse Point hasn't had a letter in years. The Projects Desk can fix the footbridge.";
  return "";
}

// ── Delivering ───────────────────────────────────────────────
export function deliver(w: World, letters: Letter[], to: string, inPerson: boolean) {
  const s = w.state;
  const queue = [...letters];
  const v = w.vils.get(to);
  const at = inPerson && v?.w ? { x: v.w.tx, y: v.w.ty } : (() => {
    const home = homeOf(to);
    const mb = home && w.data2.mailboxes.find((m) => m.id === home.building.id);
    return mb ?? { x: w.player.tx, y: w.player.ty };
  })();
  const next = () => {
    const l = queue.shift();
    if (!l) return afterDeliveries(w);
    s.bag = s.bag.filter((id) => id !== l.id);
    s.delivered.push(l.id);
    s.deliveredToday++;

    const tierIdx = tier(s.trust[to] ?? 0).index;
    const early = s.minutes < 11 * 60;
    const expired = l.deadline !== undefined && s.minutes > l.deadline;
    const express = !!l.express && !expired;
    const raining = weatherFor(s.day) === "rain";
    const tip = [0, 2, 4, 6][tierIdx] + (early ? 3 : 0) + (l.parcel ? 3 : 0) + (express ? 8 : 0) + (raining && s.helper === "leaf" ? 4 : 0);
    const pay = 4 + tip;
    s.coins += pay;
    s.earnedToday += pay;

    const gain = 5 + (inPerson ? 2 : 0) + (early ? 2 : 0) + (l.marlo ? 15 : 0) + (express ? 3 : 0);
    const d = to === "vane" ? 0 : addTrust(s, to, gain);
    const beat = dronesSys.beat(w, l.id);
    logEvent(s, beat ? "beat_drone" : early ? "speedy" : inPerson ? "in_person" : "delivered", to, d);
    // friends who wrote to each other are glad it arrived
    if (l.fromId) { const d2 = addTrust(s, l.fromId, 2); logEvent(s, "delivered", l.fromId, d2); }
    if (l.requestId) requestSys.complete(w, l.requestId);

    sfx.deliver();
    w.time.delayedCall(350, () => sfx.coin());
    w.burst(at.x, at.y, "heart", 6);
    w.floatText(at.x, at.y - 0.6, `+${pay}c${express ? " express!" : early ? " early!" : ""}`);
    if (d > 0) w.heartPop(at.x, at.y, d);
    w.refresh();
    w.ui.showLetter(l, w.nameOf(to), () => {
      if (l.id === "vane1") return calendarSys.vaneTwist(w, next);
      if (l.reply) {
        const r = letterById(s, l.reply)!;
        s.bag.push(r.id);
        w.say([{ ...w.speaker(to), text: `Oh, could you take my reply to ${w.nameOf(r.to)}? Please?` }, { text: `You got a reply letter for ${w.nameOf(r.to)}!` }], next);
      } else next();
    });
  };
  next();
}

export function afterDeliveries(w: World) {
  const s = w.state;
  w.refresh();
  save(s);
  if (s.pickedUp && s.bag.length === 0 && !s.eventToday?.startsWith("done:")) {
    w.say([{ text: `That was the last letter! You earned ${s.earnedToday}c today.\nThe rest of the day is yours: visit friends, take a request from the bulletin board, shop, or head to bed whenever you like.` }]);
  }
}

// ── Arrows and objective ─────────────────────────────────────
export type Target = { x: number; y: number; label?: string };

export function targets(w: World): Target[] {
  const s = w.state;
  const out: Target[] = [];
  let elsewhere: MapId | null = null;
  const exitTo = (to: MapId) => {
    const hop = npcSys.nextHop(w.mapId, to);
    const warp = hop ? npcSys.warpToward(w.mapId, hop) : undefined;
    if (!hop || !warp || elsewhere === hop) return;
    elsewhere = hop;
    out.push({ x: (warp.x + warp.w / 2) * TILE, y: warp.y * TILE + 8, label: `→ ${MAPS[hop].name}` });
  };
  const seen = new Set<string>();
  for (const id of s.bag) {
    const l = letterById(s, id);
    if (!l || seen.has(l.to)) continue;
    seen.add(l.to);
    if (l.to === "you") {
      const g = w.vils.get("gull");
      if (g?.w && g.where?.map === w.mapId) out.push({ x: g.w.px, y: g.w.py - 16 }); else exitTo("office");
      continue;
    }
    const here = w.vils.get(l.to);
    if (here?.w && here.where?.map === w.mapId) { out.push({ x: here.w.px, y: here.w.py - 16 }); continue; }
    const home = homeOf(l.to);
    if (home) {
      if (home.map !== w.mapId) { exitTo(home.map); continue; }
      const mb = w.data2.mailboxes.find((m) => m.id === home.building.id);
      if (mb) out.push({ x: mb.x * TILE + 8, y: mb.y * TILE });
    }
  }
  for (const r of s.requests.filter((r) => r.accepted && !r.done)) {
    const t = requestSys.targetOf(w, r);
    if (!t) continue;
    if (t.map !== w.mapId) { exitTo(t.map); continue; }
    out.push({ x: t.x * TILE + 8, y: t.y * TILE });
  }
  if (!s.pickedUp) {
    const g = w.vils.get("gull");
    if (g?.w && g.where?.map === w.mapId) out.push({ x: g.w.px, y: g.w.py - 16 });
    else exitTo("office");
  }
  return out;
}

export function objective(w: World): string {
  const s = w.state;
  const reqs = s.requests.filter((r) => r.accepted && !r.done);
  if (!s.pickedUp) {
    if (w.mapId === "flat") return "Head downstairs to the sorting hall and talk to Postmaster Gull.";
    if (w.mapId === "office") return "Talk to Postmaster Gull to pick up today's mail.";
    return "Pick up today's mail from Postmaster Gull inside the Post Office.";
  }
  if (s.bag.length) return `Deliver the mail: ${s.bag.length} ${s.bag.length === 1 ? "letter" : "letters"} left. Race the drones, win hearts.`;
  if (reqs.length) return `Mail's done. Now: ${reqs[0].title}.`;
  const c = calendar(s.day);
  if (s.minutes > 21 * 60) return "It's getting late. Your bed is upstairs in the Post Office.";
  return `Mail's done! Your day is yours: visit friends, shop, or check the board. (${c.weekday} ${clockText(s.minutes)})`;
}

export type { Request };
export { addItem };
