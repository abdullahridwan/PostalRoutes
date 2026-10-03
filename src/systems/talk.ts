// Talking to people: chat, gifts, shops, heart events, and gossip between villagers.
import { sfx } from "../game/audio";
import { chatter } from "../game/dialogue";
import { gossipLines } from "../game/gossip";
import { HEART_EVENTS, type HeartEvent } from "../game/heartEvents";
import { HELPERS } from "../game/helpers";
import { ITEMS, giftReaction } from "../game/items";
import {
  BAGS, BIKES, PAINTS, addItem, calendar, count, has, save,
} from "../game/state";
import { addTrust, gossipBetween, hearGossip, logEvent, tier } from "../game/trust";
import { VILLAGERS } from "../world/layout";
import type { Vil, World } from "../scenes/World";
import type { Msg } from "../scenes/UI";
import * as calendarSys from "./calendar";
import * as mailSys from "./mail";
import * as requestSys from "./requests";

const dirOf = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up") as "up" | "down" | "left" | "right";

export function talkTo(w: World, v: Vil) {
  const s = w.state;
  const id = v.def.id;
  const wk = v.w;
  if (wk) wk.face(dirOf(w.player.tx - wk.tx, w.player.ty - wk.ty));
  if (id === "gull") return mailSys.talkToGull(w);
  if (id.startsWith("vendor")) return calendarSys.vendor(w, id);

  const mine = mailSys.lettersFor(w, id);
  if (mine.length) {
    w.say([{ ...w.speaker(id), text: mine.length > 1 ? "Ooh, a whole stack for me?" : "Oh! Is that for me?" }], () => mailSys.deliver(w, mine, id, true));
    return;
  }
  const thanks = requestSys.turnIn(w, id);
  if (thanks) return w.say(thanks);
  const ev = HEART_EVENTS.find((e) => e.who === id && !s.heartEventsSeen.includes(e.id) && (s.trust[id] ?? 0) >= e.trust && (!e.needs || has(s, e.needs)));
  if (ev) return playEvent(w, v, ev);

  if (id === "vane") return talkToVane(w, v);

  // a daily chat warms people up a little
  const t = s.trust[id] ?? 0;
  const level = [0, 1, 3, 3][tier(t).index];
  let line = chatter(id, level, s.day);
  const c = calendar(s.day);
  if (v.def.birthday === c.dayOfSeason) line = `It's my birthday today! ${line}`;
  if (v.def.voter && !s.chattedToday.includes(id)) {
    s.chattedToday.push(id);
    const d = addTrust(s, id, 1);
    logEvent(s, "chat", id, d);
    if (wk) w.heartPop(wk.tx, wk.ty, d);
  }

  const choices: NonNullable<Msg["choices"]> = [];
  if (id === "dot") choices.push({ label: "Treats and buns", cb: () => bakery(w) });
  if (id === "mo") choices.push({ label: "Browse the shop", cb: () => mart(w) });
  if (id === "sable") choices.push({ label: "Bikes and bags", cb: () => bikeShop(w) });
  const gifts = giftables(w, id);
  if (gifts.length && v.def.voter) choices.push({ label: "Give a gift", cb: () => giveGift(w, v) });
  if (choices.length) {
    choices.push({ label: "Just chatting", cb: () => {} });
    w.say([{ ...w.speaker(id), text: `${line}${id === "dot" || id === "mo" || id === "sable" ? `\n(You have ${s.coins} coins.)` : ""}`, choices }]);
  } else {
    w.say([{ ...w.speaker(id), text: line }]);
  }
}

function talkToVane(w: World, v: Vil) {
  const s = w.state;
  const level = s.vaneSoftened ? 3 : s.day > 12 ? 1 : 0;
  w.say([{ ...w.speaker("vane"), text: chatter("vane", level, s.day) }]);
  if (v.w) v.w.face(dirOf(w.player.tx - v.w.tx, w.player.ty - v.w.ty));
}

// ── Heart events ─────────────────────────────────────────────
function playEvent(w: World, v: Vil, ev: HeartEvent) {
  const s = w.state;
  s.heartEventsSeen.push(ev.id);
  const msgs: Msg[] = ev.lines.map((ln) => {
    const i = ln.indexOf(": ");
    const who = ln.slice(0, i), text = ln.slice(i + 2);
    if (who === "you") return { text };
    if (who === "leaf") return { text, name: "Leaf" };
    return { ...w.speaker(who), text };
  });
  const finish = () => {
    const r = ev.reward;
    const lines: Msg[] = [];
    if (r) {
      if (r.coins) { s.coins += r.coins; sfx.coin(); }
      if (r.item) addItem(s, r.item);
      if (r.helper && !s.helpers.includes(r.helper)) { s.helpers.push(r.helper); s.helperBond[r.helper] = (s.helperBond[r.helper] ?? 0) + 4; sfx.befriend(); }
      const text = r.text ?? (r.coins ? `+${r.coins} coins.` : "");
      if (text) lines.push({ text });
    }
    const d = addTrust(s, ev.who, 4);
    logEvent(s, "heart_event", ev.who, d);
    if (v.w) { w.burst(v.w.tx, v.w.ty, "heart", 8); w.heartPop(v.w.tx, v.w.ty, d); }
    w.refresh();
    save(s);
    if (lines.length) w.say(lines);
  };
  if (ev.choices) {
    msgs[msgs.length - 1].choices = ev.choices.map((c) => ({
      label: c.label,
      cb: () => {
        const d = addTrust(s, ev.who, c.trust);
        if (v.w) w.heartPop(v.w.tx, v.w.ty, d);
        w.say([{ ...w.speaker(ev.who), text: c.reply }], finish);
      },
    }));
    w.say(msgs);
  } else {
    w.say(msgs, finish);
  }
}

// ── Gifts ────────────────────────────────────────────────────
function giftables(w: World, _id: string) {
  return Object.keys(w.state.inv).filter((k) => ITEMS[k]?.kind === "gift" && count(w.state, k) > 0);
}

function giveGift(w: World, v: Vil) {
  const s = w.state;
  const id = v.def.id;
  if (s.giftedToday.includes(id)) return w.say([{ ...w.speaker(id), text: "You've already been so generous today. Save some for tomorrow!" }]);
  const have = giftables(w, id);
  w.say([{
    text: `Give ${v.def.name} a gift:`,
    choices: [
      ...have.map((k) => ({ label: `${ITEMS[k].name} ×${count(s, k)}`, cb: () => {
        addItem(s, k, -1);
        s.giftedToday.push(id);
        const c = calendar(s.day);
        const birthday = v.def.birthday === c.dayOfSeason;
        const r = giftReaction(id, k);
        const d = addTrust(s, id, r.points * (birthday ? 2 : 1));
        logEvent(s, "gift", id, d);
        sfx.befriend();
        if (v.w) { w.burst(v.w.tx, v.w.ty, "heart", 8); w.heartPop(v.w.tx, v.w.ty, d); }
        w.say([{ ...w.speaker(id), text: `${birthday ? "On my birthday, too! " : ""}${r.line}` }]);
        w.refresh();
        save(s);
      } })),
      { label: "Never mind", cb: () => {} },
    ],
  }]);
}

// ── Shops ────────────────────────────────────────────────────
export function buy(w: World, item: string, price: number, then?: () => void) {
  const s = w.state;
  if (s.coins < price) { w.say([{ text: "Not quite enough coins. Deliver some mail and come back!" }]); return; }
  s.coins -= price;
  addItem(s, item);
  sfx.coin();
  w.say([{ text: `You bought a ${ITEMS[item].name.toLowerCase()}. (You have ${count(s, item)}.)` }], () => { w.refresh(); then?.(); });
  save(s);
}

function bakery(w: World) {
  w.say([{
    ...w.speaker("dot"), text: "What'll it be? Treats are for your helpers: they work for a treat, and a favourite gets you a better day.",
    choices: [
      { label: "Treats for helpers…", cb: () => treatMenu(w) },
      { label: `Honey bun (${ITEMS.bun.price}c), a lovely gift`, cb: () => buy(w, "bun", ITEMS.bun.price!) },
      { label: "Back", cb: () => {} },
    ],
  }]);
}

function treatMenu(w: World) {
  const s = w.state;
  const fav = (id: string) => Object.values(HELPERS).find((h) => h.fav === id);
  const items = ["treat", "fishcracker", "honeydrop", "biscuit", "teaLeaf", "tart"];
  w.say([{
    text: `Treats (you have ${s.coins}c):`,
    choices: [
      ...items.map((k) => ({ label: `${ITEMS[k].name} (${ITEMS[k].price}c)${fav(k) ? ` · ${fav(k)!.name}'s favourite` : ""}`, cb: () => buy(w, k, ITEMS[k].price!, () => treatMenu(w)) })),
      { label: "Done", cb: () => {} },
    ],
  }]);
}

function mart(w: World) {
  w.say([{
    ...w.speaker("mo"), text: "Everything you could want and several things you couldn't! Gifts, mostly.",
    choices: [
      { label: `Jar of jam (${ITEMS.jam.price}c)`, cb: () => buy(w, "jam", ITEMS.jam.price!, () => mart(w)) },
      { label: `Silk ribbon (${ITEMS.ribbon.price}c)`, cb: () => buy(w, "ribbon", ITEMS.ribbon.price!, () => mart(w)) },
      { label: `Plain treat (${ITEMS.treat.price}c)`, cb: () => buy(w, "treat", ITEMS.treat.price!, () => mart(w)) },
      { label: "Done", cb: () => {} },
    ],
  }]);
}

function bikeShop(w: World) {
  const s = w.state;
  const nextBike = BIKES[s.bikeLevel + 1];
  const nextBag = BAGS[s.bagLevel + 1];
  const choices: NonNullable<Msg["choices"]> = [];
  if (nextBike) choices.push({ label: `${nextBike.name} (${nextBike.cost}c): faster`, cb: () => upgrade(w, "bike") });
  if (nextBag) choices.push({ label: `${nextBag.name} (${nextBag.cost}c): holds ${nextBag.size}`, cb: () => upgrade(w, "bag") });
  if (s.bikeLevel > 0) choices.push({ label: `Repaint the bike (15c): now ${PAINTS[s.paint]}`, cb: () => repaint(w) });
  choices.push({ label: "Back", cb: () => {} });
  w.say([{ ...w.speaker("sable"), text: `Welcome! Everything here gets you around faster or carries more.\nYou have ${s.coins}c. You ride: ${BIKES[s.bikeLevel].name}. Bag: ${BAGS[s.bagLevel].name}.`, choices }]);
}

function upgrade(w: World, kind: "bike" | "bag") {
  const s = w.state;
  const next = kind === "bike" ? BIKES[s.bikeLevel + 1] : BAGS[s.bagLevel + 1];
  if (s.coins < next.cost) return w.say([{ ...w.speaker("sable"), text: "Not quite enough. Come back with more coins, and I'll have it ready." }]);
  s.coins -= next.cost;
  if (kind === "bike") s.bikeLevel++; else s.bagLevel++;
  sfx.unlock();
  w.burst(w.player.tx, w.player.ty, "sparkle", 12);
  w.say([{ ...w.speaker("sable"), text: `${next.name}! Take good care of it, or I'll find out.` }], () => { w.refresh(); bikeShop(w); });
  save(s);
}

function repaint(w: World) {
  const s = w.state;
  if (s.coins < 15) return w.say([{ ...w.speaker("sable"), text: "Fifteen coins for a new coat of paint. You're a few short." }]);
  s.coins -= 15;
  s.paint = (s.paint + 1) % PAINTS.length;
  w.player.setTexture(w.walkSprite());
  w.paintPlayer();
  sfx.unlock();
  w.say([{ ...w.speaker("sable"), text: `${PAINTS[s.paint]}. Very you.` }], () => { w.refresh(); bikeShop(w); });
  save(s);
}

export function knock(w: World, id: string) {
  if (id === "depot") {
    w.say([{ text: "SWIFTLINE LOGISTICS · DEPOT 7\n\"Delivery without the small talk.\"\nThe door is locked. Something whirs inside." }]);
    return;
  }
  const b = w.building(id);
  w.say([{ text: `The door of ${b.label} is shut. ${b.owner ? `${w.nameOf(b.owner)} is usually out front, or around town.` : ""}\nMail goes in the red mailbox.` }]);
}

// ── Gossip: villagers talking about what you did ─────────────
export function gossipTick(w: World) {
  if (w.mode !== "play" || w.ui.isBusy() || w.time.now - w.lastGossipAt < 8000) return;
  const s = w.state;
  const view = w.cameras.main.worldView;
  const here = [...w.vils.values()].filter((v) => v.def.voter && v.w && v.where?.map === w.mapId && view.contains(v.w.px, v.w.py - 8));
  for (const a of here) {
    for (const b of here) {
      if (a === b || Math.abs(a.w!.tx - b.w!.tx) + Math.abs(a.w!.ty - b.w!.ty) > 3) continue;
      const i = gossipBetween(s, a.def.id, b.def.id);
      if (i < 0) continue;
      const e = s.events[i];
      const [l1, l2] = gossipLines(e.type, e.day + i);
      w.lastGossipAt = w.time.now;
      w.bubble(a.w!, l1);
      w.time.delayedCall(1900, () => {
        if (!b.w) return;
        w.bubble(b.w, l2);
        const d = hearGossip(s, i, b.def.id);
        if (d > 0) w.time.delayedCall(900, () => b.w && w.heartPop(b.w.tx, b.w.ty, d));
        save(s);
      });
      return;
    }
  }
}

export { VILLAGERS };
