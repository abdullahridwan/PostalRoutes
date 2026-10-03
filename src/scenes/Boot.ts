import Phaser from "phaser";
import { TILESETS } from "../world/tiles";

export const CHARACTERS = [
  "postboy", "postboy_red", "postboy_green", "postboy_olive", "swimmer", "penguin", "rockitten", "bee", "professor", "granny", "fisher",
  "florist", "riverboatcaptain", "beachcomber", "shopkeeper", "childactor", "nurse",
  "shopassistant", "homemaker", "fashionista", "ceo", "magician", "conileaf", "snugglepot",
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
    for (const k of ["office", "flat"]) {
      this.load.image(`${k}_below`, `assets/interiors/${k}_below.png`);
      this.load.image(`${k}_above`, `assets/interiors/${k}_above.png`);
    }
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

  // ── Post office interior props ──
  const prim = (key: string, w: number, h: number, fn: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.make.graphics({}, false);
    fn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const rect = (g: Phaser.GameObjects.Graphics, c: number, x: number, y: number, w: number, h: number) => { g.fillStyle(c, 1); g.fillRect(x, y, w, h); };

  prim("board_helpers", 32, 30, (g) => {
    rect(g, 0x4a2f1a, 0, 0, 32, 30); rect(g, 0xb98652, 1, 1, 30, 28); rect(g, 0x8a5a3c, 1, 1, 30, 3);
    for (let i = 0; i < 5; i++) { rect(g, 0x2a1a0a, 3 + i * 6, 8, 4, 2); rect(g, [0x3a7bd5, 0xf1c40f, 0x7f8c8d, 0x27ae60, 0xe91e63][i], 3 + i * 6, 10, 4, 6); rect(g, 0xfff4dc, 4 + i * 6, 18, 2, 6); }
  });
  prim("board_bulletin", 32, 30, (g) => {
    rect(g, 0x4a2f1a, 0, 0, 32, 30); rect(g, 0xd6a066, 1, 1, 30, 28);
    rect(g, 0xfff4dc, 4, 5, 9, 9); rect(g, 0xfff0a8, 16, 4, 10, 8); rect(g, 0xffd6d6, 6, 16, 10, 9); rect(g, 0xd6f0ff, 19, 15, 9, 10);
    for (const [x, y] of [[8, 5], [21, 4], [10, 16], [23, 15]]) rect(g, 0xe74c3c, x, y, 2, 2);
  });
  prim("board_projects", 32, 30, (g) => {
    rect(g, 0x2a3f6a, 0, 0, 32, 30); rect(g, 0x3a5fa8, 1, 1, 30, 28);
    g.lineStyle(1, 0xcfe3ff, 1); g.strokeRect(5, 6, 14, 10); g.lineBetween(5, 16, 19, 6); g.lineBetween(19, 16, 5, 6); g.strokeCircle(24, 20, 4); g.lineBetween(4, 23, 16, 23); g.lineBetween(4, 26, 12, 26);
  });
  prim("poster_swiftline", 16, 26, (g) => {
    rect(g, 0x2a2f38, 0, 0, 16, 26); rect(g, 0xd7dde6, 1, 1, 14, 24); rect(g, 0x3a7bd5, 3, 4, 10, 4); rect(g, 0x8a93a3, 3, 11, 10, 2); rect(g, 0x8a93a3, 3, 15, 8, 2); rect(g, 0x3a7bd5, 5, 20, 6, 3);
  });
  prim("stairs_up", 32, 32, (g) => {
    rect(g, 0x2a1a0a, 0, 0, 32, 32); rect(g, 0x6b4f3a, 2, 2, 28, 28);
    for (let i = 0; i < 5; i++) { rect(g, 0xb98652 - i * 0x0a0a06, 2 + i * 2, 4 + i * 5, 28 - i * 2, 4); rect(g, 0x3a2412, 2 + i * 2, 8 + i * 5, 28 - i * 2, 1); }
    rect(g, 0x8a5a3c, 0, 0, 3, 32); rect(g, 0x8a5a3c, 29, 0, 3, 32);
  });
  prim("mail_trays", 32, 16, (g) => {
    for (let i = 0; i < 2; i++) { const x = i * 16; rect(g, 0x5a3e2b, x + 1, 5, 14, 10); rect(g, 0xfff4dc, x + 2, 3, 12, 4); rect(g, 0xe74c3c, x + 4, 2, 3, 3); rect(g, 0xfff0a8, x + 8, 3, 4, 3); rect(g, 0xd6f0ff, x + 3, 7, 10, 3); }
  });
  prim("mail_sacks", 32, 16, (g) => {
    for (let i = 0; i < 2; i++) { const x = i * 16; rect(g, 0x8a6a4a, x + 2, 4, 12, 11); rect(g, 0xb08d62, x + 3, 5, 10, 8); rect(g, 0x5a3e2b, x + 5, 2, 6, 3); rect(g, 0xe74c3c, x + 6, 8, 4, 3); }
  });
  prim("postmark_book", 16, 16, (g) => {
    rect(g, 0x5a1a10, 1, 2, 14, 12); rect(g, 0xb03a48, 2, 3, 12, 10); rect(g, 0xfff4dc, 4, 5, 8, 6); rect(g, 0xb03a48, 6, 7, 4, 2);
  });
  prim("trapdoor", 16, 16, (g) => {
    rect(g, 0x2a1a0a, 0, 0, 16, 16); rect(g, 0x8a5a3c, 1, 1, 14, 14); rect(g, 0xb98652, 2, 2, 12, 12);
    rect(g, 0x5a3e2b, 7, 2, 2, 12); rect(g, 0x2a1a0a, 10, 6, 3, 4); rect(g, 0xf1c40f, 11, 7, 1, 2);
  });
  // Swiftline drone locker (16x24) that appears as the company gains ground
  prim("locker", 16, 24, (g) => {
    rect(g, 0x2a2f38, 0, 0, 16, 24); rect(g, 0x8a93a3, 1, 1, 14, 22);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 2; x++) { rect(g, 0xd7dde6, 2 + x * 7, 3 + y * 7, 5, 5); rect(g, 0x3a7bd5, 4 + x * 7, 5 + y * 7, 1, 1); }
    rect(g, 0x3a7bd5, 1, 0, 14, 2);
  });
  // lighthouse (3 tiles wide, 7 tall): red-and-white tower, lamp room, cap
  prim("lighthouse", 48, 112, (g) => {
    for (let i = 0; i < 6; i++) {
      const y = 36 + i * 12, inset = i;
      rect(g, 0x2b1d1d, 8 + inset, y, 32 - inset * 2, 12);
      rect(g, i % 2 === 0 ? 0xe74c3c : 0xf4efe6, 9 + inset, y, 30 - inset * 2, 12);
      rect(g, 0x000000, 9 + inset, y + 11, 30 - inset * 2, 1);
    }
    rect(g, 0x2b1d1d, 4, 100, 40, 12); rect(g, 0x6b6f78, 5, 101, 38, 10);
    rect(g, 0x2b1d1d, 6, 30, 36, 6); rect(g, 0x4a4f58, 7, 31, 34, 4);
    rect(g, 0x2b1d1d, 12, 14, 24, 16); rect(g, 0xffe066, 13, 15, 22, 14); rect(g, 0xfffbe0, 17, 18, 14, 8);
    rect(g, 0x2b1d1d, 14, 12, 20, 3); g.fillStyle(0xb03a48, 1); g.fillTriangle(24, 0, 10, 14, 38, 14); g.lineStyle(2, 0x2b1d1d, 1); g.strokeTriangle(24, 0, 10, 14, 38, 14);
    rect(g, 0x2b1d1d, 20, 90, 8, 10); rect(g, 0x4a2f1a, 21, 91, 6, 9);
  });

  // ── Item icons (8x8) ──
  const icon = (key: string, rows: string[], palette: Record<string, number>) => draw(key, 8, 8, rows, palette);
  icon("i_treat", ["........", "..kkkk..", ".kttttk.", "kttdttdk", "kttttttk", ".kttttk.", "..kkkk..", "........"], { k: 0x6b3d12, t: 0xd9a05a, d: 0x8a5222 });
  icon("i_fishcracker", ["........", ".kk..kk.", "kbbkkbbk", "kbebbbbk", "kbbbbbbk", ".kkkkkk.", "........", "........"], { k: 0x2a4a6a, b: 0x7fb7e0, e: 0x1d2b3a });
  icon("i_honeydrop", ["...kk...", "..kyyk..", ".kyYyyk.", ".kyyyyk.", ".kyyyyk.", "..kyyk..", "...kk...", "........"], { k: 0x8a5a00, y: 0xf1c40f, Y: 0xfff3a0 });
  icon("i_biscuit", ["........", ".kkkkkk.", "kgGggGgk", "kggggggk", "kgGggggk", ".kkkkkk.", "........", "........"], { k: 0x4a4f58, g: 0x9aa2ad, G: 0xc2c8d0 });
  icon("i_teaLeaf", ["......kk", ".....kgk", "....kggk", "...kgGgk", "..kgggk.", ".kgggk..", "kggk....", "kk......"], { k: 0x1e5a2a, g: 0x4caf50, G: 0x9be08f });
  icon("i_tart", ["........", "..kkkk..", ".krrrrk.", "krRrrrRk", "krrrrrrk", ".kyyyyk.", "..kkkk..", "........"], { k: 0x6b3d12, r: 0xc0392b, R: 0xe74c3c, y: 0xd9a05a });
  icon("i_bun", ["..kkkk..", ".kooook.", "kooOoook", "koooooOk", "kOoooook", "koooOook", ".kooook.", "..kkkk.."], { k: 0x6b3d12, o: 0xd98c3a, O: 0x8a5222 });
  icon("i_flower", ["..pp....", ".pPPp.k.", ".pPYPpk.", "..pPp.k.", "...k.kk.", "..gk.g..", ".ggkgg..", "...gg..."], { p: 0xff8fa8, P: 0xffc0d0, Y: 0xfff0a8, k: 0x2e7d32, g: 0x4caf50 });
  icon("i_shell", ["........", "..kkkk..", ".kwwwwk.", "kwWkwkWk", "kwkwWkwk", ".kwwwwk.", "..kkkk..", "........"], { k: 0x9a7a5a, w: 0xf6e3c8, W: 0xffffff });
  icon("i_ribbon", ["........", "kk....kk", "krk..krk", ".krkkrk.", "..kRRk..", ".krkkrk.", "krk..krk", "kk....kk"], { k: 0x7a1020, r: 0xe74c3c, R: 0xff8a80 });
  icon("i_jam", ["..kkkk..", "..kwwk..", ".kppppk.", ".kpPppk.", ".kppppk.", ".kppppk.", "..kkkk..", "........"], { k: 0x3a1a5a, w: 0xf4efe6, p: 0x8e44ad, P: 0xc39bd3 });
  icon("i_scarf", ["........", ".kkkkkk.", "krwrwrk.", "krwrwrk.", ".kkkkrk.", "....krwk", "....krwk", ".....kk."], { k: 0x5a1a10, r: 0xe74c3c, w: 0xf4efe6 });
  icon("i_locket", ["...kk...", "..k..k..", "..k..k..", "..kkkk..", ".kyyyyk.", ".kyYYyk.", ".kyyyyk.", "..kkkk.."], { k: 0x8a5a00, y: 0xf1c40f, Y: 0xfff3a0 });
  icon("i_glove", ["...kk...", ".kkggkk.", ".kggggk.", ".kggggk.", ".kggggk.", "..kgggk.", "..kkkk..", "........"], { k: 0x1e3a8a, g: 0x3a7bd5 });
  icon("i_teddy", ["kk....kk", "kbk..kbk", ".kbbbbk.", ".kbebek.", ".kbbbbk.", "kbbkkbbk", "kbb..bbk", ".kk..kk."], { k: 0x4a2f1a, b: 0xb98652, e: 0x1d2b3a });

  // soft round glow for night lights
  const g = scene.make.graphics({}, false);
  for (let r = 24; r > 0; r -= 2) {
    g.fillStyle(0xffd27a, 0.05);
    g.fillCircle(24, 24, r);
  }
  g.generateTexture("glow", 48, 48);
  g.destroy();
}
