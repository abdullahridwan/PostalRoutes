// Flowers in the orchard, shells on the beaches: things to find and give as gifts.
import { sfx } from "../game/audio";
import { addItem } from "../game/state";
import type { World } from "../scenes/World";

const TILE = 16;
const items = new Map<string, { x: number; y: number; sprite: Phaser.GameObjects.Image; glint?: Phaser.GameObjects.Image; id: string; kind: string }>();

function rngFor(seed: number) {
  let t = seed >>> 0;
  return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; };
}

export function spawn(w: World) {
  items.clear();
  const f = w.mapDef.forage;
  if (!f || w.mapDef.interior) return;
  const s = w.state;
  const rand = rngFor(s.day * 7919 + w.mapId.length * 131);
  const take = 5 + (s.helper === "rocky" ? 3 : 0);
  const order = f.map((_, i) => i).sort(() => rand() - 0.5).slice(0, take);
  for (const i of order) {
    const spot = f[i];
    const id = `${s.day}:${w.mapId}:${i}`;
    if (s.forageTaken.includes(id)) continue;
    const sprite = w.track(w.add.image(spot.x * TILE + 8, spot.y * TILE + 10, spot.kind === "flower" ? "i_flower" : "i_shell").setDepth(10 + spot.y).setScale(1.2));
    w.tweens.add({ targets: sprite, y: sprite.y - 2, yoyo: true, repeat: -1, duration: 700 + i * 40, ease: "Sine.inOut" });
    const glint = s.helper === "rocky" ? w.track(w.add.image(spot.x * TILE + 8, spot.y * TILE + 2, "sparkle").setDepth(4000)) : undefined;
    if (glint) w.tweens.add({ targets: glint, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
    items.set(`${spot.x},${spot.y}`, { x: spot.x, y: spot.y, sprite, glint, id, kind: spot.kind });
  }
}

export function pickup(w: World, x: number, y: number) {
  const it = items.get(`${x},${y}`);
  if (!it) return;
  items.delete(`${x},${y}`);
  it.sprite.destroy();
  it.glint?.destroy();
  w.state.forageTaken.push(it.id);
  const item = it.kind === "flower" ? "flower" : "shell";
  addItem(w.state, item, 1);
  sfx.coin();
  w.floatText(x, y - 0.6, it.kind === "flower" ? "+ Wildflower" : "+ Seashell");
  w.burst(x, y, "sparkle", 5);
}
