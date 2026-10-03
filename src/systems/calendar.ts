// The calendar, kept simple: a new day resets the town, mornings announce what's up,
// and the end of Spring (day 28) has a lantern finale. Vane's story beat lives here too.
import { save, calendar, FINALE_DAY, DAY_END, type GameState } from "../game/state";
import { addTrust, friendCount, overnightGossip, voters } from "../game/trust";
import { sfx } from "../game/audio";
import { VILLAGERS } from "../world/layout";
import type { World } from "../scenes/World";
import type { Msg } from "../scenes/UI";
import * as dronesSys from "./drones";
import * as npcSys from "./npcs";
import * as requestSys from "./requests";

/** Called when a new day begins (while the screen is dark). */
export function newDay(w: World) {
  const s = w.state;
  const { forYou } = friendCount(s);
  overnightGossip(s);
  s.day++;
  s.minutes = 7 * 60;
  s.pickedUp = false;
  s.deliveredToday = 0;
  s.earnedToday = 0;
  s.chattedToday = [];
  s.giftedToday = [];
  s.helper = null;
  s.forageTaken = [];
  // Swiftline loses ground when the town has friends, and creeps back when it doesn't
  s.share = dronesSys.clamp(s.share + 1 - Math.floor(forYou / 4));
  if (s.projects.includes("sign")) for (const v of voters().slice(0, 3)) addTrust(s, v.id, 1);
  // a helper unlock that doesn't need a trip: Snug wanders in on day 5
  if (calendar(s.day).dayOfSeason >= 5 && !s.helpers.includes("snug")) s.helpers.push("snug");
  dronesSys.reset();
  requestSys.generate(w);
  npcSys.resetDay(w);
}

/** After waking: tell the player what's going on today. */
export function morning(w: World, afterSleep: boolean) {
  const s = w.state;
  const c = calendar(s.day);
  const news: Msg[] = [];
  const bday = VILLAGERS.filter((v) => v.birthday === c.dayOfSeason);
  if (bday.length) news.push({ text: `It's ${bday.map((b) => b.name).join(" and ")}'s birthday today! A gift goes a long way.` });
  if (s.day === 6 && s.helpers.includes("snug")) news.push({ text: "A sleepy little creature has curled up on the sorting hall counter. Snug can now be hired at the Helper Board." });
  if (afterSleep && !s.pickedUp) news.push({ text: "Good morning! Head downstairs: Postmaster Gull has today's mail ready, and the bulletin board has new requests." });
  if (c.dayOfSeason === FINALE_DAY && !s.springDone) news.push({ text: "It's the last day of Spring. Tonight the Captain says he'll light the lighthouse, if the town can reach him." });
  if (news.length) w.say(news);
  friendIncoming(w);
}

import * as friendSys from "./friends";
function friendIncoming(w: World) { friendSys.checkIncoming(w); }

export function onLoadMap(_w: World) { /* hook for later seasons */ }
export function onArrive(_w: World) { /* hook for later seasons */ }
export function addRush(_w: World): { to: string } | null { return null; }
export function vendor(w: World, _id: string) { w.say([{ text: "…" }]); }

/** Per-frame time triggers. */
export function tick(w: World) {
  const s = w.state;
  if (s.minutes >= DAY_END - 60 && !w.yawned && w.mapId !== "flat") {
    w.yawned = true;
    w.ui.toast("Pip yawns. It's nearly midnight: time for bed.");
  }
  const c = calendar(s.day);
  if (c.dayOfSeason === FINALE_DAY && !s.springDone && s.minutes >= 20 * 60 && !w.mapDef.interior) finale(w);
}

// ── The Vane story beat ──────────────────────────────────────
export function vaneTwist(w: World, next: () => void) {
  const s = w.state;
  s.vaneSoftened = true;
  s.share = dronesSys.clamp(s.share - 15);
  dronesSys.reset();
  save(s);
  w.say([
    { name: "Director Vane", portrait: "magician", text: "This is… my mother's handwriting." },
    { name: "Director Vane", portrait: "magician", text: "She left when I was nine. I waited by that window every day for a letter. It never came. I thought she forgot me." },
    { name: "Director Vane", portrait: "magician", text: "It was in your post office the whole time. Stuck behind a drawer for thirty years." },
    { name: "Director Vane", portrait: "magician", text: "…I'm grounding the drones. I need to think." },
  ], next);
}

// ── End of Spring ────────────────────────────────────────────
function finale(w: World) {
  const s = w.state;
  s.springDone = true;
  save(s);
  if (w.mode !== "play") { s.springDone = false; return; }
  const bridge = s.townProjects.includes("bridge");
  w.mode = "cutscene";
  w.say([
    { text: bridge ? "The whole town has walked out to Lighthouse Point. Lanterns are lit all along the cliff path." : "The whole town has gathered at the harbour. Lanterns bob on every doorstep." },
    { name: "Captain Barnaby", portrait: "riverboatcaptain", text: s.vaneSoftened ? "Lamp's polished. I had a hand from an unexpected friend. Ready, everyone?" : "Lamp's polished. Whenever you're ready, courier." },
  ], () => {
    w.ui.festival(() => {
      sfx.unlock();
      w.mode = "play";
      s.share = dronesSys.clamp(s.share - 10);
      save(s);
      w.say([{ text: "Spring is done. The lighthouse turns, and out at sea a ship answers. Thanks for delivering! ♥\nSummer arrives in the next update. Until then, the mail never stops: keep making friends." }]);
    });
  });
}
export type { GameState };
