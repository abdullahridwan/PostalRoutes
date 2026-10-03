// The first minutes: grandma's letter, then Postmaster Gull explains the town and the stakes.
import { sfx } from "../game/audio";
import type { Letter } from "../game/letters";
import { packBag, save } from "../game/state";
import type { World } from "../scenes/World";
import * as dronesSys from "./drones";
import * as friendSys from "./friends";
import * as npcSys from "./npcs";

export function run(w: World) {
  const s = w.state;
  s.introSeen = true;
  w.mode = "cutscene";
  const post = w.mapDef.buildings.find((b) => b.id === "post")!;
  const depot = w.mapDef.buildings.find((b) => b.id === "depot")!;
  const g = { name: "Postmaster Gull", portrait: "professor" };
  const vane = { name: "Director Vane", portrait: "magician" };

  // Gull steps out front for the introduction
  const gv = w.vils.get("gull")!;
  gv.where = { map: "square", x: 25, y: 10 };
  gv.w?.destroy();
  npcSys.load(w);
  const gull = gv.w;
  gull?.face("down");

  const letter: Letter = {
    id: "grandma", to: "you", from: "Grandma Marlo",
    title: "If You're Reading This…",
    body: "My dear, the Seabreeze Post Office is yours now. I ran it for forty years.\nIt's a little broke and a little boarded-up, and a company called Swiftline wants every letter in town to travel by drone.\nDon't let them. Deliver the mail. Get to know everyone. Win them back, one letter at a time.\nGull will explain. Pip knows the way. — Gran",
  };
  w.ui.showLetter(letter, "You", () => {
    w.say([
      { text: "You stand in the Town Square of Seabreeze. The Post Office is in front of you: tired, patched with boards, but standing.", onShow: () => w.look(post.x + 2, post.y + 2) },
      { ...g, text: "There you are. Marlo's grandchild. I'm Gull, her postmaster, and the last of the staff. Welcome home.", onShow: () => gull && w.look(gull.tx, gull.ty) },
      { ...g, text: "When your grandmother passed, the town stopped writing. And then Swiftline moved in. Look over there.", onShow: () => w.look(depot.x + 2, depot.y + 1) },
      { text: "A grey warehouse hums on the edge of the square. Drones whirr in and out, carrying parcels overhead." },
      { ...vane, text: "Director Hollis Vane, Swiftline Logistics. Nothing personal, courier. Efficiency is just… kinder. We already carry over half of this town's mail.", onShow: () => { const v = w.vils.get("vane"); if (v?.w) w.look(v.w.tx, v.w.ty); } },
      { ...g, text: "That's the fight, and it never ends. Every letter you deliver quickly, every friend you make, takes mail back from the drones.", onShow: () => gull && w.look(gull.tx, gull.ty) },
      { ...g, text: "You'll get paid your cut plus tips, and tips grow as people come to trust you. Hearts show how folks feel. Spend your pay at the Projects Desk inside to fix this place up board by board." },
      { ...g, text: "Your day is yours. Deliver the mail, then visit friends, take requests from the bulletin board, hire a helper monster, or ride off exploring. Esc pauses, J is your journal, M the map." },
      { ...g, text: "Here's your first mailbag. And watch the sky: Swiftline's drones race you to people's mailboxes. Beat them there!" },
    ], () => {
      packBag(s);
      sfx.open();
      w.mode = "play";
      w.follow();
      w.refresh();
      dronesSys.schedule(w);
      w.say([
        { text: `You got the mailbag! (${s.bag.length} letters.) TAB shows who they're for. The arrows on the edge of the screen point the way.` },
        { text: "Arrows / WASD to walk · E to talk & deliver · TAB mailbag · M map · T townsfolk · J journal · Esc pause." },
      ], () => { save(s); friendSys.checkIncoming(w); });
    });
  });
}
