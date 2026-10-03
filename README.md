<p align="center">
  <img src="docs/banner.png" alt="Postal Route: a cozy mail-delivery game set in Seabreeze Bay" width="100%" />
</p>

# Postal Route: Seabreeze Bay

A cozy, browser-based mail-delivery game. You're the new courier in a sleepy seaside town:
pick up the mailbag each morning, deliver letters, befriend monsters, and slowly
uncover the little stories the townsfolk are writing to each other.

Built with **Phaser 3 + TypeScript + Vite**, using art from the open-source **Tuxemon** project.

## Play

```bash
npm install
npm run dev
```

Open http://localhost:5173.

| Key | Action |
| --- | --- |
| Arrows / WASD | Walk |
| E / Space / Enter | Talk, deliver, choose |
| TAB / Q | Open the mailbag |
| T | Townsfolk (hearts, votes) |
| SHIFT | Zoom (once Bzz the bee joins) |
| M | Town map |
| N | Mute |

**On phones and tablets** an on-screen D-pad appears automatically: **A** to talk and deliver, **Bag** for the mailbag, **Map** for the town map, **Run** once Bzz joins, and tap anywhere to advance dialogue. Add `?touch` to the URL to force it on a desktop.

## The story
Your grandma Marlo ran the Seabreeze Post Office for forty years and left it to you. It's broke, boarded up, and **Swiftline Logistics** (a drone-delivery company run by the smiling, ruthless **Director Hollis Vane**) wants to replace it with a drone hub. In 20 days the **Town Council votes**. Win the town's trust, one letter at a time.

## The loop
- **Morning:** walk up the North Road to the **Town Square** and collect the mailbag from Postmaster Gull. Folks who don't trust you yet send some of their mail with Swiftline instead.
- **Deliver:** red mailboxes, or hand letters over in person. Arrows point to every stop, including the road to the other map.
- **Get paid:** your cut of the postage plus tips. Tips grow with trust; quick "speedy" deliveries earn more.
- **Drones are real:** Swiftline drones buzz around the Town Square from the start. From day 2 they also launch from the depot to deliver someone's letter. Beat them to the mailbox or lose the delivery (and a little trust).
- **Trust → votes:** every villager has hidden trust shown as hearts. 3 hearts = they vote for you. You need 7 of 12.
- **Gossip:** at midday villagers gather in the square and talk about what you did; their friends warm (or cool) to you too.
- **Evening:** when the bag is empty the sun sets. Go home, choose how much pay goes into the **Repair Fund**, and sleep. Repairs pull boards off the post office and unlock perks (bigger bag, a bike, and a secret in the old sorting room).
- **Shops:** Dot's Bakery (monster snacks, honey buns to gift), Mo's Mart, Sable's Tailor (uniform colours), Pell's Stationery.
- **Monsters:** Pip learns **Swim**, Rocky (**Smash**) opens the cliffs, Bzz (**Zoom**) helps you beat drones.
- **Finale:** the Council vote at the fountain, and Lantern Night if you win.

## How the world is built (no map editor)
- `src/world/layout.ts`: two maps (Seabreeze Village and the Town Square) described in code with `rect("water", …)`, `rect("cobble", …)` and so on, plus buildings, warps between maps, villagers (with friends and midday hangouts) and monsters.
- `src/world/build.ts`: turns that into tile layers. Paths and shorelines are **autotiled** with a 4-corner bitmask; forests become 2×2 pine stamps with canopies drawn above the player.
- `src/data/stamps.json`: buildings, cut tile-for-tile from real Tuxemon maps.
- `src/game/letters.ts`: every letter and story thread. Add your own!

## Project layout
```
src/
  main.ts            Phaser config
  scenes/Boot.ts     asset loading + pixel props drawn in code
  scenes/World.ts    gameplay: movement, followers, delivery, days, festival
  scenes/UI.ts       HUD, dialogue, letter cards, mailbag, title
  entities/Walker.ts grid-stepping characters
  game/              state & saving, letters, dialogue, synth audio
  world/             layout, autotiler, tile ids
```

Dev tip: `/?timer` keeps the game loop running in a background tab, and `window.game` is exposed in dev builds.

See [CREDITS.md](CREDITS.md) for licensing.
