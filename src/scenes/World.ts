import Phaser from "phaser";
import { DIRS, TILE, Walker, type Dir } from "../entities/Walker";
import { sfx, startMusic, toggleMute } from "../game/audio";
import { chatter } from "../game/dialogue";
import type { Letter } from "../game/letters";
import {
  DAY_END, DAY_START, SNACK_PRICE, SWIM_AFTER, clearSave, letterById, load, newGame, packBag, save,
  storyComplete, weatherFor, type GameState, type MonsterId,
} from "../game/state";
import { buildWorld, type World as WorldData } from "../world/build";
import {
  BOULDERS, BUILDINGS, H, PLAYER_START, VILLAGERS, W, WILD_MONSTERS, type VillagerDef,
} from "../world/layout";
import { TILESETS, WATER_FRAMES } from "../world/tiles";
import type { MapInfo, Msg, UI } from "./UI";

const MS_PER_GAME_MINUTE = 330;
const DYE_PRICE = 40;
const UNIFORMS = [
  { sprite: "postboy", name: "Classic Blue" },
  { sprite: "postboy_red", name: "Mailbox Red" },
  { sprite: "postboy_green", name: "Seaweed Green" },
  { sprite: "postboy_olive", name: "Driftwood Olive" },
];
const WALK_MS = 190;
const ZOOM_MS = 115;
const SWIM_MS = 230;

const MONSTER_INFO: Record<MonsterId, { name: string; sprite: string; ability: string; bob: number }> = {
  pip: { name: "Pip", sprite: "penguin", ability: "Swim", bob: 0 },
  rocky: { name: "Rocky", sprite: "rockitten", ability: "Smash", bob: 0 },
  bzz: { name: "Bzz", sprite: "bee", ability: "Zoom", bob: -6 },
};

type Villager = { def: VillagerDef; w: Walker; home: { x: number; y: number }; busy: boolean };

export class World extends Phaser.Scene {
  state!: GameState;
  data2!: WorldData;
  ui!: UI;
  player!: Walker;
  followers: { id: MonsterId; w: Walker }[] = [];
  trail: { x: number; y: number }[] = [];
  villagers = new Map<string, Villager>();
  wild = new Map<MonsterId, Walker>();
  boulders: Phaser.GameObjects.Image[] = [];
  mailIcons = new Map<string, Phaser.GameObjects.Image>();
  groundLayer!: Phaser.Tilemaps.TilemapLayer;
  nightRect!: Phaser.GameObjects.Rectangle;
  glows: Phaser.GameObjects.Image[] = [];
  mode: "title" | "play" | "cutscene" = "title";
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  lastBump = 0;
  waterFrame = 0;
  warnedWater = false;
  bonusGiven = false;
  titlePan = 0;

  playStartedAt = 0;

  constructor() { super("World"); }

  init() {
    // scene.restart() reuses this instance, so reset everything per run
    this.followers = [];
    this.trail = [];
    this.villagers = new Map();
    this.wild = new Map();
    this.boulders = [];
    this.mailIcons = new Map();
    this.glows = [];
    this.mode = "title";
    this.warnedWater = false;
    this.bonusGiven = false;
  }

  create() {
    this.ui = this.scene.get("UI") as UI;
    this.data2 = buildWorld();
    this.buildTilemap();
    this.cameras.main.setBounds(0, 0, W * TILE, H * TILE).setRoundPixels(true);
    this.applyZoom();
    this.scale.on("resize", this.applyZoom, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.applyZoom, this));

    // night overlay + window glows live in world space so lights can shine through the dark
    this.nightRect = this.add.rectangle(0, 0, W * TILE, H * TILE, 0x10183a, 0).setOrigin(0).setDepth(5000);
    for (const d of this.data2.doors) {
      const g = this.add.image(d.x * TILE + 8, d.y * TILE + 4, "glow").setDepth(5001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.glows.push(g);
    }

    this.state = load() ?? newGame();
    this.spawnEverything();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,E,SPACE,ENTER,SHIFT,TAB,Q,M,N,R") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture("TAB,SPACE,UP,DOWN,LEFT,RIGHT");
    this.keys.E.on("down", () => this.onAction());
    this.keys.SPACE.on("down", () => this.onAction());
    this.keys.ENTER.on("down", () => this.onAction());
    this.keys.TAB.on("down", () => this.mode === "play" && this.ui.toggleBag(this.state));
    this.keys.Q.on("down", () => this.mode === "play" && this.ui.toggleBag(this.state));
    this.keys.M.on("down", () => this.mode === "play" && this.ui.toggleMap(this.mapInfo()));
    this.keys.N.on("down", () => this.ui.toast(toggleMute() ? "Sound off" : "Sound on"));

    // water shimmer + sparkles
    this.time.addEvent({ delay: 280, loop: true, callback: () => this.animateWater() });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.sparkle() });
    this.time.addEvent({ delay: 1600, loop: true, callback: () => this.wanderTick() });

    this.cameras.main.centerOn(36 * TILE, 30 * TILE);
    let autostart = false;
    try {
      autostart = sessionStorage.getItem("postal-autostart") === "1";
      sessionStorage.removeItem("postal-autostart");
    } catch { /* ignore */ }
    if (autostart) this.beginPlay();
    else this.ui.showTitle(!!load(), () => this.startGame(false), () => this.startGame(true));
  }

  // ── Setup ────────────────────────────────────────────────────
  applyZoom() {
    const { width, height } = this.scale;
    const z = Math.max(2, Math.floor(Math.min(width / (TILE * 24), height / (TILE * 14))));
    this.cameras.main.setZoom(z);
  }

  buildTilemap() {
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: W, height: H });
    const sets = TILESETS.map((t) => map.addTilesetImage(t.key, t.key, TILE, TILE, 0, 0, t.firstgid)!);
    const put = (grid: number[][], name: string, depth: number) => {
      const layer = map.createBlankLayer(name, sets)!;
      layer.setDepth(depth);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x]) layer.putTileAt(grid[y][x], x, y);
      return layer;
    };
    const layers: Phaser.Tilemaps.TilemapLayer[] = [];
    this.data2.below.forEach((g, i) => {
      const l = put(g, `below${i}`, i);
      if (i === 0) this.groundLayer = l;
      layers.push(l);
    });
    this.data2.above.forEach((g, i) => layers.push(put(g, `above${i}`, 1000 + i)));

    // bake the whole town into one texture for the map screen
    if (this.textures.exists("worldmap")) this.textures.remove("worldmap");
    const rt = this.add.renderTexture(0, 0, W * TILE, H * TILE).setOrigin(0).setVisible(false);
    for (const l of layers) rt.draw(l);
    rt.saveTexture("worldmap");
  }

  /** Everything the map screen needs, in tile coordinates. */
  mapInfo(): MapInfo {
    const s = this.state;
    const targets = this.deliveryTargets().map((t) => ({ x: t.x / TILE, y: t.y / TILE }));
    return {
      player: { x: this.player.tx + 0.5, y: this.player.ty + 0.5 },
      targets,
      buildings: BUILDINGS.map((b) => ({ id: b.id, label: b.label, x: b.x + b.door + 0.5, y: b.y })),
      regions: [
        { label: "Cliffside", x: 12, y: 14.6, locked: !s.bouldersSmashed },
        { label: "Flower Meadow", x: 56.5, y: 9.6, locked: false },
        { label: "Lighthouse Isle", x: 53, y: 46.6, locked: !s.canSwim },
        { label: "Seabreeze Bay", x: 36, y: 43.5, locked: false },
      ],
    };
  }

  spawnEverything() {
    const s = this.state;
    this.player = new Walker(this, this.walkSprite(), PLAYER_START.x, PLAYER_START.y);
    this.player.face("down");
    this.trail = [];
    for (const id of s.friends) this.addFollower(id, false);

    for (const def of VILLAGERS) {
      const home = this.homeFor(def);
      const w = new Walker(this, def.sprite, home.x, home.y);
      w.face("down");
      this.villagers.set(def.id, { def, w, home, busy: false });
    }
    for (const m of WILD_MONSTERS) {
      if (s.friends.includes(m.id)) continue;
      const w = new Walker(this, m.sprite, m.x, m.y);
      w.bob = MONSTER_INFO[m.id].bob;
      w.place();
      w.face("down");
      this.wild.set(m.id, w);
      this.tweens.add({ targets: w.sprite, y: w.sprite.y - 3, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
    }
    if (!s.bouldersSmashed) {
      for (const b of BOULDERS) {
        this.boulders.push(this.add.image(b.x * TILE + 8, b.y * TILE + 16, "boulder").setOrigin(0.5, 1).setDepth(10 + b.y + 1));
      }
    } else {
      for (const b of BOULDERS) this.data2.solid[b.y][b.x] = false;
    }
    for (const m of this.data2.mailboxes) {
      this.add.image(m.x * TILE + 8, m.y * TILE + 16, "mailbox").setOrigin(0.5, 1).setDepth(10 + m.y + 1);
      const icon = this.add.image(m.x * TILE + 8, m.y * TILE - 6, "envelope").setDepth(4000).setVisible(false);
      this.tweens.add({ targets: icon, y: icon.y - 3, yoyo: true, repeat: -1, duration: 450, ease: "Sine.inOut" });
      this.mailIcons.set(m.id, icon);
    }
  }

  homeFor(def: VillagerDef) {
    // after Lantern Night, the Captain finally moves to the mainland… next to Marigold.
    if (def.id === "captain" && this.state?.festivalSeen) return { x: 45, y: 19 };
    return { x: def.x, y: def.y };
  }

  addFollower(id: MonsterId, atPlayer: boolean) {
    const info = MONSTER_INFO[id];
    const last = this.followers[this.followers.length - 1]?.w ?? this.player;
    // tuck in behind whoever is last in line
    const behind = atPlayer ? { x: last.tx, y: last.ty } : { x: last.tx - 1, y: last.ty };
    const w = new Walker(this, info.sprite, behind.x, behind.y);
    w.bob = info.bob;
    w.place();
    w.face(this.player.facing);
    this.followers.push({ id, w });
  }

  startGame(continueGame: boolean) {
    if (!continueGame && load()) {
      // fresh start: wipe the save and reload into the game
      clearSave();
      try { sessionStorage.setItem("postal-autostart", "1"); } catch { /* ignore */ }
      location.reload();
      return;
    }
    this.beginPlay();
  }

  beginPlay() {
    this.mode = "play";
    this.playStartedAt = this.time.now;
    startMusic();
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15, 0, 8);
    this.ui.setWeather(weatherFor(this.state.day));
    this.refresh();
    if (!this.state.introSeen) {
      this.state.introSeen = true;
      this.say([
        { text: "Welcome to Seabreeze Bay, the sleepiest little harbour on the coast." },
        { text: "You're the new courier! Your trusty penguin, Pip, waddles along behind you." },
        { name: "Pip", text: "Pweep! ♪" },
        { text: "Head to the Post Office (the wooden building with the anchor, just east) and talk to Postmaster Gull for your mailbag." },
        { text: "Arrows / WASD to walk · E or Space to talk & deliver · TAB for your mailbag · M for the map · N to mute." },
      ]);
    } else {
      this.ui.toast(`Day ${this.state.day}`);
    }
  }

  // ── Main loop ───────────────────────────────────────────────
  update(_t: number, dt: number) {
    if (this.mode === "title") {
      this.titlePan += dt * 0.00012;
      this.cameras.main.centerOn((32 + Math.sin(this.titlePan) * 14) * TILE, (30 + Math.cos(this.titlePan * 0.7) * 4) * TILE);
      this.updateNight();
      return;
    }
    if (this.mode !== "play") {
      this.updateNight();
      this.ui.updateHud(this.state, this.friendsInfo());
      this.ui.setPrompt(null);
      this.ui.updateArrows([], this.cameras.main);
      return;
    }

    const busy = this.ui.isBusy();
    if (!busy) {
      this.state.minutes += dt / MS_PER_GAME_MINUTE;
      if (this.state.minutes >= DAY_END) {
        this.passOut();
        return;
      }
      this.handleMovement();
    }
    this.updateNight();
    this.ui.updateHud(this.state, this.friendsInfo());
    this.ui.setPrompt(busy ? null : this.promptFor());
    this.ui.updateArrows(this.deliveryTargets(), this.cameras.main);
  }

  handleMovement() {
    if (this.player.moving) return;
    const c = this.cursors, k = this.keys;
    let dir: Dir | null = null;
    if (c.left.isDown || k.A.isDown) dir = "left";
    else if (c.right.isDown || k.D.isDown) dir = "right";
    else if (c.up.isDown || k.W.isDown) dir = "up";
    else if (c.down.isDown || k.S.isDown) dir = "down";
    else dir = this.ui.touch.dir;
    if (!dir) {
      this.player.idle();
      for (const f of this.followers) if (!f.w.moving) f.w.idle();
      return;
    }
    const nx = this.player.tx + DIRS[dir].x, ny = this.player.ty + DIRS[dir].y;
    if (!this.walkable(nx, ny)) {
      this.player.face(dir);
      if (this.time.now - this.lastBump > 350) {
        sfx.bump();
        this.lastBump = this.time.now;
        if (this.data2.water[ny]?.[nx] && !this.state.canSwim && !this.warnedWater) {
          this.warnedWater = true;
          this.say([{ name: "Pip", text: "Pip stares at the waves, then at you. He doesn't look quite brave enough… yet." }]);
        }
      }
      return;
    }
    const swimming = this.data2.water[ny][nx];
    const zoom = this.state.friends.includes("bzz") && (k.SHIFT.isDown || this.ui.touch.run) && !swimming;
    const ms = swimming ? SWIM_MS : zoom ? ZOOM_MS : WALK_MS;
    this.player.setTexture(swimming ? "swimmer" : this.walkSprite());

    this.trail.unshift({ x: this.player.tx, y: this.player.ty });
    this.trail.length = Math.min(this.trail.length, this.followers.length);
    this.player.step(dir, ms);
    this.followers.forEach((f, i) => {
      const t = this.trail[i];
      if (t) f.w.stepTo(t.x, t.y, ms);
    });
    if (swimming) {
      sfx.splash();
      this.puff("ripple", nx, ny, 0.8);
    } else {
      sfx.step();
      if (zoom || Math.random() < 0.3) this.puff("dust", nx, ny, 1);
    }
  }

  walkable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const water = this.data2.water[y][x];
    if (this.data2.solid[y][x] && !(water && this.state.canSwim)) return false;
    for (const v of this.villagers.values()) if (v.w.tx === x && v.w.ty === y) return false;
    for (const m of this.wild.values()) if (m.tx === x && m.ty === y) return false;
    return true;
  }

  // ── Interaction ─────────────────────────────────────────────
  facingTile() {
    const d = DIRS[this.player.facing];
    return { x: this.player.tx + d.x, y: this.player.ty + d.y };
  }

  targetAt(x: number, y: number) {
    for (const v of this.villagers.values()) if (v.w.tx === x && v.w.ty === y) return { kind: "villager" as const, v };
    for (const [id, m] of this.wild) if (m.tx === x && m.ty === y) return { kind: "wild" as const, id };
    const mb = this.data2.mailboxes.find((m) => m.x === x && m.y === y);
    if (mb) return { kind: "mailbox" as const, id: mb.id };
    const door = this.data2.doors.find((d) => d.x === x && d.y === y);
    if (door) return { kind: "door" as const, id: door.id };
    if (!this.state.bouldersSmashed && BOULDERS.some((b) => b.x === x && b.y === y)) return { kind: "boulder" as const };
    return null;
  }

  promptFor(): string | null {
    if (this.player.moving) return null;
    const f = this.facingTile();
    const t = this.targetAt(f.x, f.y);
    if (!t) return null;
    switch (t.kind) {
      case "villager": return this.lettersFor(t.v.def.id).length ? `E · Hand over mail to ${t.v.def.name}` : `E · Talk to ${t.v.def.name}`;
      case "wild": return `E · Say hi to the wild ${MONSTER_INFO[t.id].name}`;
      case "mailbox": {
        const b = BUILDINGS.find((b) => b.id === t.id)!;
        return this.lettersFor(b.owner!).length ? "E · Deliver mail" : `E · Mailbox (${b.label})`;
      }
      case "door": return t.id === "home" ? "E · Go to bed" : t.id === "post" ? "E · Post Office" : "E · Knock";
      case "boulder": return this.state.friends.includes("rocky") ? "E · Rocky, SMASH!" : "E · Inspect boulder";
    }
  }

  onAction() {
    if (this.mode !== "play" || this.time.now - this.playStartedAt < 200) return;
    if (this.ui.isBusy()) {
      this.ui.advance();
      return;
    }
    if (this.player.moving) return;
    const f = this.facingTile();
    const t = this.targetAt(f.x, f.y);
    if (!t) return;
    sfx.blip();
    switch (t.kind) {
      case "villager": return this.talkTo(t.v);
      case "wild": return this.meetWild(t.id);
      case "mailbox": {
        const b = BUILDINGS.find((b) => b.id === t.id)!;
        const mine = this.lettersFor(b.owner!);
        if (mine.length) return this.deliver(mine, b.owner!, true);
        return this.say([{ text: `${b.label}. The flag is down: no mail for them right now.` }]);
      }
      case "door": return this.knock(t.id);
      case "boulder": return this.boulder();
    }
  }

  lettersFor(who: string): Letter[] {
    return this.state.bag.map((id) => letterById(this.state, id)!).filter((l) => l && l.to === who);
  }

  talkTo(v: Villager) {
    const id = v.def.id;
    // turn to face the player
    const dx = this.player.tx - v.w.tx, dy = this.player.ty - v.w.ty;
    v.w.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    const portrait = v.def.sprite;

    if (id === "gull") return this.talkToGull(portrait);

    const mine = this.lettersFor(id);
    if (mine.length) {
      this.say([{ name: v.def.name, portrait, text: mine.length > 1 ? "Ooh, a whole stack for me?" : "Oh! Is that for me?" }], () => this.deliver(mine, id, false));
      return;
    }
    const hearts = this.state.hearts[id] ?? 0;
    const line = chatter(id, hearts, this.state.day);
    if (id === "mo") {
      this.say([{
        name: v.def.name, portrait, text: `${line}\nSnacks are ${SNACK_PRICE} coins. You have ${this.state.coins}.`,
        choices: [
          { label: `Buy a Monster Snack (${SNACK_PRICE}c)`, cb: () => this.buySnack() },
          { label: `New uniform colour (${DYE_PRICE}c)`, cb: () => this.buyDye() },
          { label: "Just browsing", cb: () => {} },
        ],
      }]);
      return;
    }
    this.say([{ name: v.def.name, portrait, text: line }]);
  }

  talkToGull(portrait: string) {
    const s = this.state;
    const name = "Postmaster Gull";
    if (!s.pickedUp) {
      const fresh = packBag(s);
      if (fresh.length === 0) {
        this.say([{ name, portrait, text: this.gullHint() || "Nothing new today. Enjoy the sea breeze, explore, and come back tomorrow!" }]);
        return;
      }
      sfx.open();
      const lines: Msg[] = [];
      if (s.day === 1) {
        lines.push({ name, portrait, text: "Ah, the new courier! And a penguin. Excellent. Penguins are very punctual." });
        lines.push({ name, portrait, text: "Every house has a red mailbox beside its door. Pop the letter in, or hand it over in person." });
        lines.push({ name, portrait, text: "Deliver before noon and folks tip a little extra. Off you go!" });
      } else {
        lines.push({ name, portrait, text: `Morning! ${fresh.length} pieces of mail today.` });
        const hint = this.gullHint();
        if (hint) lines.push({ name, portrait, text: hint });
      }
      lines.push({ text: `You got the mailbag! (${fresh.length} items) · Press TAB to read the addresses.` });
      this.say(lines, () => this.refresh());
      return;
    }
    if (s.bag.length === 0) {
      this.say([{ name, portrait, text: "Bag's empty! Splendid. Have a wander, then get some sleep. New mail comes in each morning." }]);
    } else {
      this.say([{ name, portrait, text: `Still ${s.bag.length} to go. Follow the little envelope arrows. They point to the mailboxes!` }]);
    }
  }

  /** A nudge toward whatever is blocking the story, or "" if nothing is. */
  gullHint(): string {
    const s = this.state;
    if (!s.bouldersSmashed && s.delivered.includes("shelly1"))
      return "There's mail waiting for someone up on the cliff, but those boulders block the path. A Rockitten could smash them… and they love Mo's snacks.";
    if (!s.canSwim && s.delivered.includes("granny1"))
      return `Mail is piling up for Lighthouse Isle. Shame you can't swim! Pip's been watching the waves… (${s.delivered.length}/${SWIM_AFTER} deliveries)`;
    if (!s.friends.includes("bzz") && s.day >= 3 && s.day % 2 === 1)
      return "Rosa says a bee keeps buzzing round her meadow. Bees are speedy. Very handy for a courier, I'd think!";
    return "";
  }

  deliver(letters: Letter[], to: string, viaMailbox: boolean) {
    const s = this.state;
    const v = this.villagers.get(to)!;
    const queue = [...letters];
    const next = () => {
      const l = queue.shift();
      if (!l) return this.afterDeliveries();
      s.bag = s.bag.filter((id) => id !== l.id);
      s.delivered.push(l.id);
      s.deliveredToday++;
      const early = s.minutes < 12 * 60;
      const tip = 5 + (early ? 3 : 0) + (l.parcel ? 4 : 0);
      s.coins += tip;
      s.hearts[to] = (s.hearts[to] ?? 0) + 1;
      sfx.deliver();
      this.time.delayedCall(350, () => sfx.coin());
      const target = viaMailbox ? this.data2.mailboxes.find((m) => BUILDINGS.find((b) => b.id === m.id)?.owner === to)! : { x: v.w.tx, y: v.w.ty };
      this.burst(target.x, target.y, "heart", 6);
      this.floatText(target.x, target.y, `+${tip}c${early ? " early!" : ""}`);
      this.refresh();
      this.ui.showLetter(l, v.def.name, () => {
        if (l.reply) {
          const r = letterById(s, l.reply)!;
          s.bag.push(r.id);
          const rto = this.villagers.get(r.to)!.def.name;
          this.say([{ name: v.def.name, portrait: v.def.sprite, text: `Oh, could you take my reply to ${rto}? Please?` }, { text: `You got a reply letter for ${rto}!` }], next);
        } else next();
      });
    };
    next();
  }

  afterDeliveries() {
    const s = this.state;
    this.refresh();
    save(s);
    if (s.delivered.includes("gullfinal") && !s.festivalSeen) {
      this.time.delayedCall(400, () => this.festival());
      return;
    }
    const msgs: Msg[] = [];
    if (!s.canSwim && s.delivered.length >= SWIM_AFTER) {
      s.canSwim = true;
      sfx.unlock();
      msgs.push({ name: "Pip", text: "Pweep!! Pip splashes in a puddle, then puffs out his chest." });
      msgs.push({ text: "Watching you work so hard has made Pip brave. Pip learned SWIM!\nWalk into the sea to swim. Lighthouse Isle is to the south-east…" });
    }
    if (s.pickedUp && s.bag.length === 0 && !this.bonusGiven) {
      this.bonusGiven = true;
      s.coins += 10;
      sfx.coin();
      msgs.push({ text: "Mailbag empty! +10c route bonus from the Post Office.\nExplore, or head home to sleep." });
    }
    if (msgs.length) this.say(msgs, () => this.refresh());
    save(s);
  }

  buySnack() {
    const s = this.state;
    if (s.coins < SNACK_PRICE) {
      this.say([{ name: "Mo", portrait: "shopkeeper", text: "Ah, you're a few coins short, friend. Deliver some mail and come back!" }]);
      return;
    }
    s.coins -= SNACK_PRICE;
    s.snacks++;
    sfx.coin();
    this.say([{ text: `You bought a crunchy Monster Snack! (You have ${s.snacks}.) Wild monsters can't resist them.` }]);
    this.refresh();
    save(s);
  }

  buyDye() {
    const s = this.state;
    if (s.coins < DYE_PRICE) {
      this.say([{ name: "Mo", portrait: "shopkeeper", text: "Fancy! But that's a premium dye, friend. Come back with a few more coins." }]);
      return;
    }
    s.coins -= DYE_PRICE;
    s.uniform = (s.uniform + 1) % UNIFORMS.length;
    this.player.setTexture(this.walkSprite());
    sfx.unlock();
    this.burst(this.player.tx, this.player.ty, "sparkle", 12);
    this.say([{ text: `Swish! Your uniform is now ${UNIFORMS[s.uniform].name}. Very dapper.` }]);
    save(s);
  }

  walkSprite() {
    return UNIFORMS[this.state.uniform ?? 0].sprite;
  }

  meetWild(id: MonsterId) {
    const info = MONSTER_INFO[id];
    const s = this.state;
    if (s.snacks <= 0) {
      const flavour = id === "rocky" ? "The wild Rockitten headbutts a pebble and stares at your bag." : "The wild bee buzzes in a happy loop around the flowers… then sniffs your bag.";
      this.say([{ text: `${flavour}\nMaybe it would like a snack from Mo's Mart?` }]);
      return;
    }
    this.say([{
      text: id === "rocky" ? "The wild Rockitten eyes your snack." : "The wild bee hovers closer to your snack.",
      choices: [
        { label: "Offer a Monster Snack", cb: () => this.befriend(id) },
        { label: "Not now", cb: () => {} },
      ],
    }]);
    void info;
  }

  befriend(id: MonsterId) {
    const s = this.state;
    const info = MONSTER_INFO[id];
    const w = this.wild.get(id)!;
    s.snacks--;
    s.friends.push(id);
    sfx.befriend();
    this.burst(w.tx, w.ty, "heart", 10);
    this.tweens.killTweensOf(w.sprite);
    w.destroy();
    this.wild.delete(id);
    this.addFollower(id, true);
    const how = id === "rocky"
      ? "Ability: SMASH. Face a boulder and press E. Those rocks blocking the cliff path don't stand a chance."
      : "Ability: ZOOM. Hold SHIFT to dash around town at bee speed!";
    this.say([{ text: `${info.name} munches the snack happily… and decides to follow you!` }, { text: `${info.name} joined your route! ${how}` }], () => this.refresh());
    save(s);
  }

  boulder() {
    if (!this.state.friends.includes("rocky")) {
      this.say([{ text: "A huge boulder blocks the path to the cliffside. You hear a kid humming somewhere beyond it.\nA strong monster might be able to smash it…" }]);
      return;
    }
    this.mode = "cutscene";
    sfx.smash();
    this.cameras.main.shake(300, 0.006);
    for (const b of this.boulders) {
      this.burst(Math.floor(b.x / TILE), Math.floor(b.y / TILE) - 1, "dust", 14);
      this.tweens.add({ targets: b, alpha: 0, scale: 1.3, duration: 350, onComplete: () => b.destroy() });
    }
    this.boulders = [];
    for (const b of BOULDERS) this.data2.solid[b.y][b.x] = false;
    this.state.bouldersSmashed = true;
    save(this.state);
    this.time.delayedCall(600, () => {
      this.mode = "play";
      sfx.unlock();
      this.say([{ name: "Rocky", text: "Mrrrrow! ✦" }, { text: "Rocky smashed the boulders! The Cliffside path is open. New mail may arrive for whoever lives up there." }]);
    });
  }

  knock(id: string) {
    if (id === "home") {
      this.say([{
        text: this.state.bag.length ? `You still have ${this.state.bag.length} letters. They'll keep till tomorrow. Go to bed?` : "Cosy bed, warm blanket, Pip's little snores. Go to bed?",
        choices: [
          { label: "Sleep", cb: () => this.sleep() },
          { label: "Not yet", cb: () => {} },
        ],
      }]);
      return;
    }
    if (id === "post") {
      const gull = this.villagers.get("gull")!;
      return this.talkTo(gull);
    }
    const b = BUILDINGS.find((b) => b.id === id)!;
    this.say([{ text: `Knock knock… The door of ${b.label} is shut. Mail goes in the red mailbox!` }]);
  }

  // ── Days ────────────────────────────────────────────────────
  sleep(passedOut = false) {
    this.mode = "cutscene";
    sfx.sleep();
    save(this.state);
    this.ui.fadeDay(passedOut ? "You dozed off under the stars… Pip dragged you home." : "Zzz…", this.state.day + 1, () => {
      const s = this.state;
      s.day++;
      s.minutes = DAY_START;
      s.pickedUp = false;
      s.deliveredToday = 0;
      this.bonusGiven = false;
      this.resetPositions();
      save(s);
      this.ui.setWeather(weatherFor(s.day));
      sfx.morning();
    }, () => {
      this.mode = "play";
      this.ui.toast(`Day ${this.state.day} · ${weatherFor(this.state.day)}`);
      this.refresh();
    });
  }

  passOut() {
    this.state.minutes = DAY_END - 1;
    this.sleep(true);
  }

  resetPositions() {
    this.player.tx = PLAYER_START.x;
    this.player.ty = PLAYER_START.y;
    this.player.setTexture(this.walkSprite());
    this.player.face("down");
    this.player.place();
    this.trail = [];
    for (const f of this.followers) {
      f.w.tx = PLAYER_START.x;
      f.w.ty = PLAYER_START.y;
      f.w.place();
    }
    for (const v of this.villagers.values()) {
      v.home = this.homeFor(v.def);
      v.w.tx = v.home.x;
      v.w.ty = v.home.y;
      v.w.place();
    }
  }

  festival() {
    this.mode = "cutscene";
    this.state.minutes = 21 * 60;
    this.say([
      { name: "Granny Marigold", portrait: "granny", text: "An invitation… Lantern Night! Oh, I haven't been in forty years." },
      { name: "Granny Marigold", portrait: "granny", text: "Thank you, little courier. You carried every word between us." },
    ], () => {
      this.ui.festival(() => {
        this.state.festivalSeen = true;
        const cap = this.villagers.get("captain")!;
        cap.home = this.homeFor(cap.def);
        cap.w.tx = cap.home.x;
        cap.w.ty = cap.home.y;
        cap.w.place();
        save(this.state);
        this.mode = "play";
        this.say([{ text: "The story of Seabreeze Bay is told… but the mail never stops. New letters arrive every morning. Thanks for playing! ♥" }]);
      });
    });
  }

  // ── Helpers ─────────────────────────────────────────────────
  say(msgs: Msg[], onDone?: () => void) {
    this.ui.say(msgs, onDone);
  }

  refresh() {
    const owners = new Set(this.state.bag.map((id) => letterById(this.state, id)?.to));
    for (const b of BUILDINGS) {
      const icon = this.mailIcons.get(b.id);
      if (icon) icon.setVisible(!!b.owner && owners.has(b.owner));
    }
    this.ui.updateHud(this.state, this.friendsInfo());
  }

  friendsInfo() {
    return this.state.friends.map((id) => ({ ...MONSTER_INFO[id], id, locked: id === "pip" && !this.state.canSwim }));
  }

  deliveryTargets() {
    const owners = new Set(this.state.bag.map((id) => letterById(this.state, id)?.to));
    const out: { x: number; y: number }[] = [];
    for (const m of this.data2.mailboxes) {
      const b = BUILDINGS.find((b) => b.id === m.id)!;
      if (b.owner && owners.has(b.owner)) out.push({ x: m.x * TILE + 8, y: m.y * TILE });
    }
    if (!this.state.pickedUp) {
      const gull = this.villagers.get("gull")!;
      out.push({ x: gull.w.px, y: gull.w.py - 16 });
    }
    return out;
  }

  updateNight() {
    const m = this.mode === "title" ? 19 * 60 : this.state.minutes;
    const h = m / 60;
    // 0 = full day, 1 = deep night
    let night = 0;
    if (h >= 18) night = Math.min(1, (h - 18) / 3);
    else if (h < 7) night = Math.max(0, (7 - h) / 1.5) * 0.6;
    const dusk = h >= 16.5 && h < 20 ? Math.sin(((h - 16.5) / 3.5) * Math.PI) * 0.18 : 0;
    const color = night > 0.3 ? 0x101a40 : 0xff8a3c;
    this.nightRect.setFillStyle(color, night > 0.3 ? night * 0.55 : dusk + night * 0.5);
    for (const g of this.glows) g.setAlpha(night * 0.9);
  }

  animateWater() {
    this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES.length;
    const gidNow = WATER_FRAMES[this.waterFrame];
    for (const c of this.data2.waterCells) {
      const t = this.groundLayer.getTileAt(c.x, c.y);
      if (t) t.index = gidNow;
    }
  }

  sparkle() {
    const view = this.cameras.main.worldView;
    for (let i = 0; i < 3; i++) {
      const x = Math.floor((view.x + Math.random() * view.width) / TILE);
      const y = Math.floor((view.y + Math.random() * view.height) / TILE);
      if (!this.data2.water[y]?.[x]) continue;
      const s = this.add.image(x * TILE + Math.random() * 16, y * TILE + Math.random() * 16, "sparkle").setDepth(8).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 0.9, yoyo: true, duration: 380, onComplete: () => s.destroy() });
    }
  }

  wanderTick() {
    if (this.mode !== "play" || this.ui.isBusy()) return;
    const dirs: Dir[] = ["up", "down", "left", "right"];
    for (const v of this.villagers.values()) {
      if (v.def.wander === 0 || v.w.moving || Math.random() < 0.5) continue;
      const dir = dirs[Math.floor(Math.random() * 4)];
      const nx = v.w.tx + DIRS[dir].x, ny = v.w.ty + DIRS[dir].y;
      const far = Math.abs(nx - v.home.x) > v.def.wander || Math.abs(ny - v.home.y) > v.def.wander;
      const onPlayer = nx === this.player.tx && ny === this.player.ty;
      const onFollower = this.followers.some((f) => f.w.tx === nx && f.w.ty === ny);
      if (far || onPlayer || onFollower || !this.walkable(nx, ny) || this.data2.water[ny][nx]) {
        v.w.face(dir);
        continue;
      }
      v.w.step(dir, 320, () => v.w.idle());
    }
    for (const m of this.wild.values()) if (Math.random() < 0.4) m.face(dirs[Math.floor(Math.random() * 4)]);
  }

  puff(key: string, tx: number, ty: number, alpha: number) {
    const p = this.add.image(tx * TILE + 8, ty * TILE + 14, key).setDepth(9).setAlpha(alpha);
    this.tweens.add({ targets: p, alpha: 0, scale: 1.8, y: p.y - 2, duration: 420, onComplete: () => p.destroy() });
  }

  burst(tx: number, ty: number, key: string, n: number) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(tx * TILE + 8, ty * TILE + 4, key).setDepth(4500);
      const a = Math.random() * Math.PI * 2;
      this.tweens.add({
        targets: p, x: p.x + Math.cos(a) * (10 + Math.random() * 14), y: p.y - 10 - Math.random() * 16,
        alpha: 0, duration: 700 + Math.random() * 400, ease: "Cubic.out", onComplete: () => p.destroy(),
      });
    }
  }

  floatText(tx: number, ty: number, text: string) {
    const t = this.add.text(tx * TILE + 8, ty * TILE - 6, text, {
      fontFamily: "Pixelify Sans, monospace", fontSize: "8px", color: "#ffe066", stroke: "#3a2a10", strokeThickness: 2, resolution: 4,
    }).setOrigin(0.5).setDepth(4600);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 1300, ease: "Cubic.out", onComplete: () => t.destroy() });
  }
}
