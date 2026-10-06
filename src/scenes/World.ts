import Phaser from "phaser";
import { DIRS, TILE, Walker, type Dir } from "../entities/Walker";
import { sfx, startMusic, toggleMute } from "../game/audio";
import { HELPERS } from "../game/helpers";
import {
  BIKES, DAY_END, DAY_START, EVENING, MS_PER_MINUTE, PAINTS, bagSize, calendar, clearSave, has, letterById, load, newGame, save,
  weatherFor, type GameState,
} from "../game/state";
import { overnightGossip, hearts } from "../game/trust";
import { buildWorld, type World as WorldData } from "../world/build";
import {
  BRIDGE_BARRIER, INTRO_START, LIGHTHOUSE, LOCKER_SPOTS, MAPS, PLAYER_START, VILLAGERS, homeOf,
  type Hotspot, type MapDef, type MapId, type VillagerDef,
} from "../world/layout";
import { FOUNTAIN, TILESETS, WATER_FRAMES } from "../world/tiles";
import type { MapInfo, Msg, UI } from "./UI";
import * as calendarSys from "../systems/calendar";
import * as dronesSys from "../systems/drones";
import * as forageSys from "../systems/forage";
import * as introSys from "../systems/intro";
import * as mailSys from "../systems/mail";
import * as npcSys from "../systems/npcs";
import * as officeSys from "../systems/office";
import * as requestSys from "../systems/requests";
import * as talkSys from "../systems/talk";

export type Spot = { map: MapId; x: number; y: number };
export type Vil = {
  id: string;
  def: VillagerDef;
  where: Spot | null; // null = at home, out of sight
  w?: Walker; // only exists while on the map you're looking at
  path: { x: number; y: number }[];
  leaving: boolean;
  nextIdle: number;
};

const PAINT_SPRITES = ["postboy", "postboy_red", "postboy_green", "postboy_olive", "postboy"];

export class World extends Phaser.Scene {
  state!: GameState;
  mapId: MapId = "square";
  mapDef!: MapDef;
  data2!: WorldData;
  ui!: UI;
  player!: Walker;
  vils = new Map<string, Vil>();
  mode: "title" | "play" | "cutscene" = "title";
  playMs = 0; // advances only while you're actually playing (not paused / in dialogue)
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  mapObjects: Phaser.GameObjects.GameObject[] = [];
  tilemap?: Phaser.Tilemaps.Tilemap;
  groundLayer?: Phaser.Tilemaps.TilemapLayer;
  decoLayer?: Phaser.Tilemaps.TilemapLayer;
  nightRect?: Phaser.GameObjects.Rectangle;
  glows: Phaser.GameObjects.Image[] = [];
  mailIcons = new Map<string, Phaser.GameObjects.Image>();
  stickers = new Map<string, Phaser.GameObjects.Image>();
  barrier: Phaser.GameObjects.GameObject[] = [];
  playStartedAt = 0;
  lastBump = 0;
  titlePan = 0;
  waterFrame = 0;
  fountainFrame = 0;
  lastGossipAt = 0;
  yawned = false;
  pendingNews: Msg[] = [];

  constructor() { super("World"); }

  init() {
    this.vils = new Map();
    this.mapObjects = [];
    this.glows = [];
    this.mode = "title";
    this.playMs = 0;
    this.yawned = false;
  }

  // ── Lifecycle ────────────────────────────────────────────────
  create() {
    this.ui = this.scene.get("UI") as UI;
    this.state = load() ?? newGame();
    this.state.helper = null;

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,E,SPACE,ENTER,SHIFT,TAB,Q,M,N,T,J,P,ESC") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture("TAB,SPACE,UP,DOWN,LEFT,RIGHT");
    const playOnly = (f: () => void) => () => { if (this.mode === "play" && !this.ui.pauseOpen) f(); };
    this.keys.E.on("down", () => this.onAction());
    this.keys.SPACE.on("down", () => this.onAction());
    this.keys.ENTER.on("down", () => this.onAction());
    this.keys.TAB.on("down", playOnly(() => this.ui.toggleBag(this.state)));
    this.keys.Q.on("down", playOnly(() => this.ui.toggleBag(this.state)));
    this.keys.M.on("down", playOnly(() => !this.ui.folkOpen && this.ui.toggleMap(this.mapInfo())));
    this.keys.T.on("down", playOnly(() => !this.ui.mapOpen && this.ui.toggleFolk(this.state)));
    this.keys.J.on("down", playOnly(() => this.ui.toggleJournal(this.state)));
    this.keys.N.on("down", () => this.ui.toast(toggleMute() ? "Sound off" : "Sound on"));
    const pause = () => { if (this.mode === "play" || this.ui.pauseOpen) this.ui.togglePause(); };
    this.keys.ESC.on("down", pause);
    this.keys.P.on("down", pause);

    this.scale.on("resize", this.applyZoom, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.applyZoom, this));

    this.player = new Walker(this, this.walkSprite(), 0, 0);
    npcSys.init(this);
    if (!this.state.requests.length) requestSys.generate(this);

    // the title screen floats over Lighthouse Point at dusk; the real start map loads when you press play
    const start = this.startSpot();
    let autostart = false;
    try { autostart = sessionStorage.getItem("postal-autostart") === "1"; sessionStorage.removeItem("postal-autostart"); } catch { /* ignore */ }
    if (autostart) this.loadMap(start.map, { x: start.x, y: start.y, dir: start.dir });
    else this.loadMap("point", { x: 3, y: 19, dir: "right" });

    this.time.addEvent({ delay: 280, loop: true, callback: () => this.animateWater() });
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.animateFountain() });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.sparkle() });
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.mode === "play" && !this.ui.isBusy() && npcSys.tick(this) });
    this.time.addEvent({ delay: 2500, loop: true, callback: () => talkSys.gossipTick(this) });

    this.cameras.main.centerOn((this.mapDef.W / 2) * TILE, (this.mapDef.H / 2) * TILE);
    if (autostart) this.beginPlay();
    else this.ui.showTitle(!!load(), () => this.startGame(false), () => this.startGame(true));
  }

  startSpot() {
    return this.state.introSeen ? PLAYER_START : INTRO_START;
  }

  startGame(continueGame: boolean) {
    if (!continueGame && load()) {
      clearSave();
      try { sessionStorage.setItem("postal-autostart", "1"); } catch { /* ignore */ }
      location.reload();
      return;
    }
    this.beginPlay();
  }

  beginPlay() {
    const start = this.startSpot();
    if (this.mapId !== start.map) this.loadMap(start.map, { x: start.x, y: start.y, dir: start.dir });
    this.mode = "play";
    this.playStartedAt = this.time.now;
    startMusic();
    this.follow();
    this.ui.setWeather(weatherFor(this.state.day));
    this.ui.setIndoors(!!this.mapDef.interior);
    this.refresh();
    if (!this.state.introSeen) introSys.run(this);
    else {
      this.ui.toast(this.dateLine());
      calendarSys.morning(this, false);
    }
  }

  follow() {
    const cam = this.cameras.main;
    cam.panEffect.reset();
    if (this.mapDef.interior) {
      // small rooms sit centred on screen instead of scrolling
      cam.stopFollow();
      cam.centerOn((this.mapDef.W * TILE) / 2, (this.mapDef.H * TILE) / 2);
      return;
    }
    cam.startFollow(this.player.sprite, true, 0.15, 0.15, 0, 8);
  }

  dateLine() {
    const c = calendar(this.state.day);
    return `${c.season} ${c.dayOfSeason} (${c.weekday}) · Year ${c.year}`;
  }

  // ── Maps ─────────────────────────────────────────────────────
  applyZoom() {
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    if (this.mapDef?.interior) {
      // small rooms get their own centred viewport instead of scrolling around
      // whole numbers when they fit; on narrow phones scale down smoothly so the whole room stays visible
      const raw = Math.min(width / (this.mapDef.W * TILE), height / (this.mapDef.H * TILE));
      const z = raw >= 2 ? Math.min(5, Math.floor(raw)) : Math.max(1, raw);
      const vw = this.mapDef.W * TILE * z, vh = this.mapDef.H * TILE * z;
      cam.setSize(vw, vh);
      cam.setPosition((width - vw) / 2, (height - vh) / 2);
      cam.setZoom(z);
      return;
    }
    cam.setSize(width, height);
    cam.setPosition(0, 0);
    const z = Math.max(2, Math.floor(Math.min(width / (TILE * 24), height / (TILE * 14))));
    cam.setZoom(z);
  }

  track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.mapObjects.push(o);
    return o;
  }

  /** Tear down the current map and build another, placing the player at `spawn`. */
  loadMap(id: MapId, spawn: { x: number; y: number; dir: Dir }) {
    for (const o of this.mapObjects) o.destroy();
    this.mapObjects = [];
    npcSys.unload(this);
    dronesSys.unload(this);
    this.mailIcons.clear();
    this.stickers.clear();
    this.glows = [];
    this.barrier = [];
    this.tilemap?.destroy();
    this.tilemap = undefined;
    this.groundLayer = this.decoLayer = undefined;

    this.mapId = id;
    this.mapDef = MAPS[id];
    this.data2 = buildWorld(this.mapDef);
    const s = this.state;
    const { W, H } = this.mapDef;

    if (this.mapDef.interior) {
      const key = this.mapDef.interior;
      this.track(this.add.image(0, 0, `${key}_below`).setOrigin(0).setDepth(0));
      this.track(this.add.image(0, 0, `${key}_above`).setOrigin(0).setDepth(1000));
    } else {
      this.buildTilemap();
    }
    if (this.mapDef.interior) this.cameras.main.removeBounds();
    else this.cameras.main.setBounds(0, 0, W * TILE, H * TILE);
    this.applyZoom();
    this.ui?.setIndoors?.(!!this.mapDef.interior);

    if (!this.mapDef.interior) {
      this.nightRect = this.track(this.add.rectangle(0, 0, W * TILE, H * TILE, 0x10183a, 0).setOrigin(0).setDepth(5000));
      for (const d of this.data2.doors) {
        this.glows.push(this.track(this.add.image(d.x * TILE + 8, d.y * TILE + 4, "glow").setDepth(5001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)));
      }
    } else {
      this.nightRect = undefined;
    }

    // hotspots are solid; signs get a sprite
    for (const h of this.mapDef.hotspots) {
      this.data2.solid[h.y][h.x] = true;
      if (h.id.endsWith("_sign")) this.track(this.add.image(h.x * TILE + 8, h.y * TILE + 16, "sign").setOrigin(0.5, 1).setDepth(10 + h.y + 1));
    }
    for (const d of this.mapDef.decor) {
      const img = this.track(this.add.image(d.x * TILE, d.y * TILE, d.tex).setOrigin(0).setDepth(d.depth ?? 2));
      if (d.tex.startsWith("mail_")) img.setDepth(10 + d.y + 0.9);
    }
    for (const m of this.data2.mailboxes) {
      this.track(this.add.image(m.x * TILE + 8, m.y * TILE + 16, "mailbox").setOrigin(0.5, 1).setDepth(10 + m.y + 1));
      const sticker = this.track(this.add.image(m.x * TILE + 8, m.y * TILE + 9, "sticker").setDepth(10 + m.y + 1.1).setVisible(false));
      this.stickers.set(m.id, sticker);
      const icon = this.track(this.add.image(m.x * TILE + 8, m.y * TILE - 6, "envelope").setDepth(4000).setVisible(false));
      this.tweens.add({ targets: icon, y: icon.y - 3, yoyo: true, repeat: -1, duration: 450, ease: "Sine.inOut" });
      this.mailIcons.set(m.id, icon);
    }

    // place-specific props
    if (id === "village") this.buildBridgeBarrier();
    if (id === "point") {
      const L = LIGHTHOUSE;
      this.track(this.add.image(L.x * TILE, (L.y + L.h) * TILE, "lighthouse").setOrigin(0, 1).setDepth(10 + L.y + L.h));
      for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) this.data2.solid[L.y + j][L.x + i] = true;
    }
    if (id === "square") {
      const post = this.mapDef.buildings.find((b) => b.id === "post")!;
      const missing = 4 - s.projects.length;
      const spots = [[post.x + 3, post.y + 3], [post.x + 1, post.y + 3], [post.x + 1, post.y + 1], [post.x + 3, post.y + 1]];
      spots.slice(0, Math.max(0, missing)).forEach(([bx, by]) => this.track(this.add.image(bx * TILE + 8, by * TILE + 8, "boards").setDepth(6)));
      dronesSys.buildLockers(this);
    }
    if (id === "office" && s.projects.includes("room") && !s.delivered.includes("vane1")) officeSys.addTrapdoor(this);

    npcSys.load(this);
    forageSys.spawn(this);
    requestSys.spawnItems(this);
    calendarSys.onLoadMap(this);
    dronesSys.spawnAmbient(this);

    this.player.tx = spawn.x;
    this.player.ty = spawn.y;
    this.player.setTexture(this.walkSprite());
    this.paintPlayer();
    this.player.face(spawn.dir);
    this.player.place();
    if (this.mode !== "title") this.follow();
    this.refresh();
  }

  buildBridgeBarrier() {
    if (has(this.state, "bridge")) return;
    for (const b of BRIDGE_BARRIER) {
      this.data2.solid[b.y][b.x] = true;
      this.barrier.push(this.track(this.add.image(b.x * TILE + 8, b.y * TILE + 8, "boards").setDepth(10 + b.y + 1)));
    }
  }

  openBridge() {
    for (const o of this.barrier) o.destroy();
    this.barrier = [];
    for (const b of BRIDGE_BARRIER) if (this.mapId === "village") this.data2.solid[b.y][b.x] = false;
  }

  buildTilemap() {
    const { W, H } = this.mapDef;
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: W, height: H });
    this.tilemap = map;
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
      if (i === 2) this.decoLayer = l;
      layers.push(l);
    });
    this.data2.above.forEach((g, i) => layers.push(put(g, `above${i}`, 1000 + i)));

    // bake the map into one texture for the map screen
    if (this.textures.exists("worldmap")) this.textures.remove("worldmap");
    const rt = this.add.renderTexture(0, 0, W * TILE, H * TILE).setOrigin(0).setVisible(false);
    for (const l of layers) rt.draw(l);
    rt.saveTexture("worldmap");
    this.track(rt);
  }

  /** Fade out, swap maps, fade in. */
  travel(to: MapId, spawn: { x: number; y: number; dir: Dir }) {
    if (this.mode !== "play") return;
    this.mode = "cutscene";
    const cam = this.cameras.main;
    cam.fadeOut(240, 11, 21, 48);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadMap(to, spawn);
      cam.fadeIn(300, 11, 21, 48);
      this.ui.toast(MAPS[to].name);
      this.mode = "play";
      calendarSys.onArrive(this);
    });
  }

  // ── Looks ────────────────────────────────────────────────────
  walkSprite() {
    return PAINT_SPRITES[this.state?.paint ?? 0];
  }
  paintPlayer() {
    if ((this.state?.paint ?? 0) === 4) this.player.sprite.setTint(0xd9bfff);
    else this.player.sprite.clearTint();
  }

  /** Move the camera to look at a spot (cutscenes). */
  look(tx: number, ty: number) {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(tx * TILE + 8, ty * TILE + 8, 1100, "Sine.easeInOut");
  }

  // ── Main loop ────────────────────────────────────────────────
  update(_t: number, dt: number) {
    if (this.mode === "title") {
      this.titlePan += 0.002;
      this.cameras.main.centerOn(
        (this.mapDef.W / 2 + Math.sin(this.titlePan) * (this.mapDef.W / 4)) * TILE,
        (this.mapDef.H / 2 + Math.cos(this.titlePan * 0.7) * (this.mapDef.H / 8)) * TILE,
      );
      this.updateNight();
      return;
    }
    dronesSys.updateAmbient(this);
    this.updateNight();
    this.ui.setObjective(mailSys.objective(this));
    this.ui.updateHud(this.state, this.helperCard());
    if (this.mode !== "play") {
      this.ui.setPrompt(null);
      this.ui.updateArrows([], this.cameras.main);
      return;
    }
    const busy = this.ui.isBusy();
    if (!busy) {
      this.playMs += dt;
      this.state.minutes += dt / MS_PER_MINUTE;
      calendarSys.tick(this);
      dronesSys.update(this);
      if (this.state.minutes >= DAY_END) return this.sleep(true);
      this.handleMovement();
    }
    this.ui.setPrompt(busy ? null : this.promptFor());
    this.ui.updateArrows(mailSys.targets(this), this.cameras.main);
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
      return;
    }
    const nx = this.player.tx + DIRS[dir].x, ny = this.player.ty + DIRS[dir].y;
    if (!this.walkable(nx, ny)) {
      this.player.face(dir);
      if (this.time.now - this.lastBump > 350) { sfx.bump(); this.lastBump = this.time.now; }
      return;
    }
    let ms = BIKES[this.state.bikeLevel].ms;
    if (this.state.helper === "bzz") ms = Math.round(ms * 0.8);
    if (this.mapDef.interior) ms = Math.max(ms, 160);
    this.player.setTexture(this.walkSprite());
    this.paintPlayer();
    this.player.step(dir, ms, () => this.afterStep());
    sfx.step();
    if (!this.mapDef.interior && Math.random() < 0.25) this.puff("dust", nx, ny, 1);
  }

  afterStep() {
    const { tx, ty } = this.player;
    forageSys.pickup(this, tx, ty);
    requestSys.pickup(this, tx, ty);
    dronesSys.pickupParcel(this, tx, ty);
    const warp = this.mapDef.warps.find((w) => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h);
    if (warp && this.mode === "play") {
      if (warp.needs === "bridge" && !has(this.state, "bridge")) return;
      this.travel(warp.to, warp.spawn);
    }
  }

  walkable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.mapDef.W || y >= this.mapDef.H) return false;
    if (this.data2.solid[y][x]) return false;
    for (const v of this.vils.values()) if (v.w && v.w.tx === x && v.w.ty === y) return false;
    return true;
  }

  // ── Interaction ──────────────────────────────────────────────
  facingTile() {
    const d = DIRS[this.player.facing];
    return { x: this.player.tx + d.x, y: this.player.ty + d.y };
  }

  building(id: string) {
    return this.mapDef.buildings.find((b) => b.id === id)!;
  }

  targetAt(x: number, y: number) {
    for (const v of this.vils.values()) if (v.w && v.w.tx === x && v.w.ty === y) return { kind: "villager" as const, v };
    const mb = this.data2.mailboxes.find((m) => m.x === x && m.y === y);
    if (mb) return { kind: "mailbox" as const, id: mb.id };
    const hs = this.mapDef.hotspots.find((h) => h.x === x && h.y === y);
    if (hs) return { kind: "hotspot" as const, hs };
    const wild = npcSys.wildAt(this, x, y);
    if (wild) return { kind: "wild" as const, id: wild };
    const door = this.data2.doors.find((d) => d.x === x && d.y === y);
    if (door) return { kind: "door" as const, id: door.id };
    return null;
  }

  promptFor(): string | null {
    if (this.player.moving) return null;
    const f = this.facingTile();
    const t = this.targetAt(f.x, f.y);
    if (!t) return null;
    switch (t.kind) {
      case "villager": {
        const id = t.v.def.id;
        if (mailSys.lettersFor(this, id).length) return `E · Hand over mail to ${t.v.def.name}`;
        return `E · Talk to ${t.v.def.name}`;
      }
      case "mailbox": {
        const b = this.building(t.id);
        return mailSys.lettersFor(this, b.owner!).length ? "E · Deliver mail" : `E · Mailbox (${b.label})`;
      }
      case "hotspot": return `E · ${t.hs.prompt}`;
      case "wild": return "E · Say hi";
      case "door": return t.id === "depot" ? "E · Swiftline Depot" : "E · Knock";
    }
  }

  onAction() {
    if (this.mode !== "play" || this.time.now - this.playStartedAt < 200) return;
    if (this.ui.pauseOpen) return;
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
      case "villager": return talkSys.talkTo(this, t.v);
      case "mailbox": {
        const b = this.building(t.id);
        const mine = mailSys.lettersFor(this, b.owner!);
        if (mine.length) return mailSys.deliver(this, mine, b.owner!, false);
        const trusted = (this.state.trust[b.owner!] ?? 0) >= 25;
        return this.say([{ text: `${b.label}.${trusted ? " The flag is down: no mail for them right now." : " A Swiftline sticker is stuck on the box. They're sending most of their mail with Swiftline… for now."}` }]);
      }
      case "hotspot": return this.hotspot(t.hs);
      case "wild": return npcSys.meetWild(this, t.id);
      case "door": return talkSys.knock(this, t.id);
    }
  }

  hotspot(h: Hotspot) {
    if (officeSys.handle(this, h)) return;
    switch (h.id) {
      case "ferry_sign":
        return this.say([{ text: "FERRY TO DRIFTWOOD COVE\nThe ferry isn't running yet. A hand-painted note says: \"Opens in a future update!\"\nA stack of out-of-town mail sacks waits by the dock, going nowhere for now." }]);
      case "bridge_sign":
        return this.say([{ text: has(this.state, "bridge") ? "The footbridge is solid again. Lighthouse Point is just across." : "COLLAPSED FOOTBRIDGE\nThe cliff path to Lighthouse Point has been closed for years. Pay for the repairs at the Projects Desk in the Post Office." }]);
      case "picnic":
        return this.say([{ text: "A checked blanket under an old apple tree. Rosa's favourite spot. Someone left a half-finished crossword." }]);
      case "lighthouse":
        return this.say([{ text: this.state.springDone ? "The lighthouse turns, slow and golden. Out at sea, a ship answers with a toot." : "The old lighthouse. The lamp room is dusty. The Captain says it just needs one more reason to shine." }]);
    }
  }

  say(msgs: Msg[], onDone?: () => void) {
    this.ui.say(msgs, onDone);
  }

  // ── Days ─────────────────────────────────────────────────────
  sleep(late = false) {
    if (this.mode === "cutscene") return;
    this.mode = "cutscene";
    sfx.sleep();
    const s = this.state;
    for (const id of s.bag) {
      const l = letterById(s, id);
      if (l) { const t = s.trust[l.to] ?? 0; s.trust[l.to] = Math.max(0, t - 1); }
    }
    save(s);
    this.ui.fadeDay(late ? "You doze off… Pip tucks a blanket over you." : "Zzz…", s.day + 1, () => {
      calendarSys.newDay(this);
      this.loadMap(PLAYER_START.map, { x: PLAYER_START.x, y: PLAYER_START.y, dir: PLAYER_START.dir });
      save(s);
      this.ui.setWeather(weatherFor(s.day));
      sfx.morning();
    }, () => {
      this.mode = "play";
      this.yawned = false;
      this.ui.toast(this.dateLine());
      this.refresh();
      calendarSys.morning(this, true);
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  refresh() {
    const s = this.state;
    const owners = new Set(s.bag.map((id) => letterById(s, id)?.to));
    for (const b of this.mapDef.buildings) {
      this.mailIcons.get(b.id)?.setVisible(!!b.owner && owners.has(b.owner));
      this.stickers.get(b.id)?.setVisible(!!b.owner && (s.trust[b.owner] ?? 0) < 25);
    }
    this.ui.updateHud(s, this.helperCard());
  }

  helperCard() {
    const id = this.state.helper;
    if (!id) return null;
    const h = HELPERS[id];
    return { name: h.name, sprite: h.sprite, perk: h.perk };
  }

  nameOf(id: string) {
    return VILLAGERS.find((v) => v.id === id)?.name ?? id;
  }

  /** Name + portrait + hearts for a villager's dialogue line. */
  speaker(id: string): Pick<Msg, "name" | "portrait" | "hearts"> {
    const def = VILLAGERS.find((v) => v.id === id);
    if (!def) return { name: id };
    return { name: def.name, portrait: def.sprite, hearts: def.voter ? hearts(this.state.trust[id] ?? 0) : undefined };
  }

  mapInfo(): MapInfo {
    const s = this.state;
    const targets = mailSys.targets(this);
    const other = targets.find((t) => t.label);
    return {
      title: this.mapDef.name,
      player: { x: this.player.tx + 0.5, y: this.player.ty + 0.5 },
      targets: targets.filter((t) => !t.label).map((t) => ({ x: t.x / TILE, y: t.y / TILE })),
      buildings: this.mapDef.buildings.map((b) => ({
        id: b.id, label: b.label, x: b.x + b.door + 0.5, y: b.y,
        hearts: b.owner ? hearts(s.trust[b.owner] ?? 0) : undefined,
      })),
      regions: this.mapDef.regions.map((r) => ({ label: r.label, x: r.x, y: r.y, locked: r.lock === "bridge" ? !has(s, "bridge") : false })),
      elsewhere: other ? other.label!.replace("→ ", "") : undefined,
    };
  }

  // ── Night, water and sparkle ─────────────────────────────────
  updateNight() {
    if (!this.nightRect) { this.ui.setNight(0); return; }
    const m = this.mode === "title" ? 20.3 * 60 : this.state.minutes;
    const h = m / 60;
    let night = 0;
    if (h >= 18) night = Math.min(1, (h - 18) / 3);
    const dusk = h >= 16.5 && h < 20 ? Math.sin(((h - 16.5) / 3.5) * Math.PI) * 0.22 : 0;
    const color = night > 0.3 ? 0x101a40 : 0xff8a3c;
    this.nightRect.setFillStyle(color, night > 0.3 ? night * 0.55 : dusk + night * 0.5);
    for (const g of this.glows) g.setAlpha(Math.max(night, dusk * 2) * 0.9);
    this.ui.setNight(night);
  }

  animateWater() {
    if (!this.groundLayer) return;
    this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES.length;
    const gidNow = WATER_FRAMES[this.waterFrame];
    for (const c of this.data2.waterCells) {
      const t = this.groundLayer.getTileAt(c.x, c.y);
      if (t) t.index = gidNow;
    }
  }

  animateFountain() {
    if (!this.decoLayer || !this.data2.fountainCells.length) return;
    this.fountainFrame = (this.fountainFrame + 1) % FOUNTAIN.frameOffsets.length;
    const off = FOUNTAIN.frameOffsets[this.fountainFrame];
    for (const c of this.data2.fountainCells) {
      const t = this.decoLayer.getTileAt(c.x, c.y);
      if (t) t.index = c.gid + off;
    }
  }

  sparkle() {
    if (this.mapDef.interior) return;
    const view = this.cameras.main.worldView;
    for (let i = 0; i < 3; i++) {
      const x = Math.floor((view.x + Math.random() * view.width) / TILE);
      const y = Math.floor((view.y + Math.random() * view.height) / TILE);
      if (!this.data2.water[y]?.[x]) continue;
      const s = this.add.image(x * TILE + Math.random() * 16, y * TILE + Math.random() * 16, "sparkle").setDepth(8).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 0.9, yoyo: true, duration: 380, onComplete: () => s.destroy() });
    }
  }

  // ── Effects ──────────────────────────────────────────────────
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

  heartPop(tx: number, ty: number, delta: number) {
    if (delta <= 0) return;
    const h = this.add.image(tx * TILE + 8, ty * TILE - 10, "heart").setDepth(4600).setScale(1.4);
    this.tweens.add({ targets: h, y: "-=14", alpha: 0, duration: 1100, ease: "Cubic.out", onComplete: () => h.destroy() });
  }

  bubble(w: Walker, text: string) {
    const t = this.add.text(w.px, w.py - 36, text, {
      fontFamily: "Pixelify Sans, monospace", fontSize: "8px", color: "#3b2a1a", backgroundColor: "#fff4dc",
      padding: { x: 4, y: 3 }, wordWrap: { width: 120 }, align: "center", resolution: 4,
    }).setOrigin(0.5, 1).setDepth(4700).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 4, duration: 200, hold: 2600, yoyo: true, onComplete: () => t.destroy() });
  }

  // exported for systems
  get bagCap() { return bagSize(this.state); }
  get paints() { return PAINTS; }
  get eveningAt() { return EVENING; }
  get dayStart() { return DAY_START; }
  homeOf = homeOf;
  lockerSpots = LOCKER_SPOTS;
  overnightGossip = () => overnightGossip(this.state);
}
