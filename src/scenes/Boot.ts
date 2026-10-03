import Phaser from "phaser";
import { TILESETS } from "../world/tiles";

export const CHARACTERS = [
  "postboy", "postboy_red", "postboy_green", "postboy_olive", "swimmer", "penguin", "rockitten", "bee", "professor", "granny", "fisher",
  "florist", "riverboatcaptain", "beachcomber", "shopkeeper", "childactor", "nurse",
  "shopassistant", "homemaker", "fashionista", "ceo", "magician",
];
export const PORTRAITS = [
  "postboy", "professor", "granny", "fisher", "florist", "riverboatcaptain",
  "beachcomber", "childactor", "nurse", // (shopkeeper portrait is a "?" placeholder upstream)
  "shopassistant", "homemaker", "fashionista", "ceo", "magician",
];

export class Boot extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 100, height / 2, 0, 8, 0xf4d58d).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 204, 12).setStrokeStyle(2, 0xf4d58d);
    this.load.on("progress", (p: number) => (bar.width = 200 * p));

    for (const t of TILESETS) this.load.image(t.key, `assets/tilesets/${t.file}`);
    for (const c of CHARACTERS) this.load.spritesheet(c, `assets/sprites/${c}.png`, { frameWidth: 16, frameHeight: 32 });
    for (const p of PORTRAITS) this.load.image(`portrait-${p}`, `assets/portraits/${p}.png`);
    this.load.image("boulder", "assets/sprites/boulder.png");
    this.load.image("sign", "assets/sprites/sign.png");
  }

  create() {
    makePixelTextures(this);
    this.scene.launch("UI");
    this.scene.start("World");
  }
}

/** Little pixel-art props drawn in code. */
function makePixelTextures(scene: Phaser.Scene) {
  const draw = (key: string, w: number, h: number, rows: string[], palette: Record<string, number>) => {
    const g = scene.make.graphics({}, false);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === "." || !(ch in palette)) return;
        g.fillStyle(palette[ch], 1);
        g.fillRect(x, y, 1, 1);
      }),
    );
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // Red post box (16x16)
  draw("mailbox", 16, 16, [
    "................",
    "......kkkk......",
    ".....krrrrk.....",
    "....krRRRRrk....",
    "....krRRRRrk.yy.",
    "....kkkkkkkk.yy.",
    "....krwwwwrk.k..",
    "....krrrrrrk.k..",
    "....krRRRRrk.k..",
    "....krRRRRrk.k..",
    "....krRRRRrkkk..",
    "....krrrrrrk....",
    "....kkkkkkkk....",
    "......kbbk......",
    "......kbbk......",
    ".....kkkkkk.....",
  ], { k: 0x2b1d1d, r: 0xc0392b, R: 0xe74c3c, w: 0x2b1d1d, y: 0xf1c40f, b: 0x6b4f3a });

  // Envelope icon (11x8)
  draw("envelope", 11, 8, [
    "kkkkkkkkkkk",
    "kwwkwwwkwwk",
    "kwwwkwkwwwk",
    "kwwwwkwwwwk",
    "kwwwwwwwwwk",
    "kwwwwwwrrwk",
    "kwwwwwwrrwk",
    "kkkkkkkkkkk",
  ], { k: 0x5a3e2b, w: 0xfff4dc, r: 0xe74c3c });

  // Parcel icon (10x9)
  draw("parcel", 10, 9, [
    "kkkkkkkkkk",
    "kbbbsbbbbk",
    "kbbbsbbbbk",
    "kssssssssk",
    "kbbbsbbbbk",
    "kbbbsbbbbk",
    "kbbbsbbbbk",
    "kbbbsbbbbk",
    "kkkkkkkkkk",
  ], { k: 0x5a3e2b, b: 0xc89f6b, s: 0xe74c3c });

  draw("heart", 7, 6, [
    ".rr.rr.",
    "rRRrRRr",
    "rRRRRRr",
    ".rRRRr.",
    "..rRr..",
    "...r...",
  ], { r: 0xb03a48, R: 0xff6b81 });

  draw("coin", 7, 7, [
    "..kkk..",
    ".kyyyk.",
    "kyYyyyk",
    "kyYyyyk",
    "kyyyyyk",
    ".kyyyk.",
    "..kkk..",
  ], { k: 0x8a5a00, y: 0xf1c40f, Y: 0xfff3a0 });

  draw("snack", 8, 8, [
    "..kkkk..",
    ".kooook.",
    "kooOoook",
    "koooooOk",
    "kOoooook",
    "koooOook",
    ".kooook.",
    "..kkkk..",
  ], { k: 0x6b3d12, o: 0xd98c3a, O: 0x8a5222 });

  draw("sparkle", 5, 5, [
    "..w..",
    "..w..",
    "wwWww",
    "..w..",
    "..w..",
  ], { w: 0xffffff, W: 0xfffbe0 });

  draw("dust", 3, 3, [".w.", "www", ".w."], { w: 0xe8dcc0 });
  draw("ripple", 12, 4, [".wwwwwwwwww.", "w..........w", "w..........w", ".wwwwwwwwww."], { w: 0xdff6ff });
  draw("raindrop", 1, 5, ["w", "w", "w", "w", "w"], { w: 0xbfd9ff });

  draw("lantern", 7, 9, [
    "...k...",
    ".kkkkk.",
    "koOOOok",
    "kOYYYOk",
    "kOYWYOk",
    "kOYYYOk",
    "koOOOok",
    ".kkkkk.",
    "...o...",
  ], { k: 0x5a2a0a, o: 0xd35400, O: 0xf39c12, Y: 0xffd36b, W: 0xffffff });

  draw("bang", 5, 9, [
    ".kkk.",
    "kyyyk",
    "kyyyk",
    "kyyyk",
    ".kyk.",
    ".kyk.",
    "..k..",
    ".kyk.",
    ".kkk.",
  ], { k: 0x3a2a10, y: 0xffe066 });

  // Swiftline drone (16x10): grey body, rotors, blinking light
  draw("drone", 16, 10, [
    "kkkk........kkkk",
    ".kk..........kk.",
    "..k..........k..",
    "..kkkkkkkkkkkk..",
    "..kggggggggggk..",
    "..kgGGGGGGGGgk..",
    "..kgGbbGGGGGgk..",
    "..kggggggggrgk..",
    "...kkkkkkkkkk...",
    "....k......k....",
  ], { k: 0x2a2f38, g: 0x8a93a3, G: 0xb6bfcc, b: 0x3a7bd5, r: 0xe74c3c });

  // boarded-up planks (crossed, 16x16) nailed over the post office
  draw("boards", 16, 16, [
    "kk............kk",
    "kbbk........kbbk",
    "kbBbk......kbBbk",
    ".kbBbk....kbBbk.",
    "..kbBbk..kbBbk..",
    "...kbBbkkbBbk...",
    "....kbBbbBbk....",
    ".....kbBnBk.....",
    ".....kbBBBk.....",
    "....kbBbbBbk....",
    "...kbBbkkbBbk...",
    "..kbBbk..kbBbk..",
    ".kbBbk....kbBbk.",
    "kbBbk......kbBbk",
    "kbbk........kbbk",
    "kk............kk",
  ], { k: 0x3a2412, b: 0xe2b77a, B: 0xc48a4a, n: 0x2a2a2a });

  // ballot icon for the vote tally (9x9)
  draw("ballot", 9, 9, [
    "..kkkkk..",
    "..kwwwk..",
    "..kwrwk..",
    "kkkkkkkkk",
    "kbbbbbbbk",
    "kbbkkkbbk",
    "kbbbbbbbk",
    "kbbbbbbbk",
    "kkkkkkkkk",
  ], { k: 0x3a2a10, w: 0xfff4dc, r: 0xe74c3c, b: 0xc89f6b });

  // Swiftline sticker (6x6) slapped on mailboxes of people who don't trust you yet
  draw("sticker", 6, 6, [
    "kkkkkk",
    "kGGGGk",
    "kGbbGk",
    "kGbGGk",
    "kGGbGk",
    "kkkkkk",
  ], { k: 0x2a2f38, G: 0xd7dde6, b: 0x3a7bd5 });

  // honey bun (8x7)
  draw("bun", 8, 7, [
    "..kkkk..",
    ".kyyyyk.",
    "kyYyyyYk",
    "kyyhhyyk",
    "kyyyyyyk",
    ".kkkkkk.",
    "........",
  ], { k: 0x6b3d12, y: 0xe0a85a, Y: 0xf6d38f, h: 0xf1c40f });

  // soft round glow for night lights
  const g = scene.make.graphics({}, false);
  for (let r = 24; r > 0; r -= 2) {
    g.fillStyle(0xffd27a, 0.05);
    g.fillCircle(24, 24, r);
  }
  g.generateTexture("glow", 48, 48);
  g.destroy();
}
