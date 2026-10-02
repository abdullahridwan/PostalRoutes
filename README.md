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
| SHIFT | Zoom (once Bzz the bee joins) |
| M | Mute |

## The loop
- **Morning:** talk to Postmaster Gull at the Post Office to get today's mail.
- **Deliver:** use the red mailboxes beside each door, or hand mail to people in person. Off-screen arrows point to every stop. Deliver before noon for bigger tips.
- **Replies:** some villagers hand you a reply to carry on the spot.
- **Monsters:** Pip the penguin starts with you and learns to **Swim** after 6 deliveries. Buy snacks at Mo's Mart to befriend **Rocky** (Smash boulders) and **Bzz** (Zoom).
- **Evening:** sleep at your cottage to save and start a new day. Stay out past midnight and Pip drags you home.
- The story wraps up with **Lantern Night**, and the mail keeps coming after that.

## How the world is built (no map editor)
- `src/world/layout.ts`: the whole map, described in code with `rect("water", …)`, `rect("path", …)` and so on, plus building, villager and monster placements.
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
