import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import { UI } from "./scenes/UI";
import { World } from "./scenes/World";

async function start() {
  // wait for the pixel font so text renders crisp from the first frame
  try {
    await Promise.race([
      Promise.all(['16px "Pixelify Sans"', '500 16px "Inter"', '600 16px "Inter"', '700 16px "Inter"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to monospace */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#1d2b3a",
    pixelArt: true,
    // ?timer keeps the loop running in hidden tabs (handy for automated playtests)
    fps: { forceSetTimeOut: new URLSearchParams(location.search).has("timer"), target: 60 },
    // a hidden/zero-size iframe at boot breaks WebGL framebuffers, so never start at 0x0
    scale: { mode: Phaser.Scale.RESIZE, width: Math.max(320, window.innerWidth), height: Math.max(240, window.innerHeight) },
    scene: [Boot, World, UI],
  });
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
