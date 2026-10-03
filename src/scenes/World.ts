import Phaser from "phaser";
import { DIRS, TILE, Walker, type Dir } from "../entities/Walker";
import { sfx, startMusic, toggleMute } from "../game/audio";
import { chatter } from "../game/dialogue";
import { gossipLines } from "../game/gossip";
import type { Letter } from "../game/letters";
import {
  BUN_PRICE, DAY_START, DYE_PRICE, EVENING, MINUTES_PER_DELIVERY, REPAIRS, SNACK_PRICE, SWIM_AFTER,
  clearSave, letterById, load, newGame, packBag, save, weatherFor, type GameState, type MonsterId,
} from "../game/state";
import { addTrust, gossipBetween, hearGossip, hearts, logEvent, overnightGossip, tier, voteTally } from "../game/trust";
import { buildWorld, type World as WorldData } from "../world/build";
import {
  MAPS, PLAYER_START, VILLAGERS, WILD_MONSTERS, homeOf, type MapDef, type MapId, type VillagerDef,
} from "../world/layout";
import { FOUNTAIN, TILESETS, WATER_FRAMES } from "../world/tiles";
import type { MapInfo, Msg, UI } from "./UI";

const UNIFORMS = [
  { sprite: "postboy", name: "Classic Blue" },
  { sprite: "postboy_red", name: "Mailbox Red" },
  { sprite: "postboy_green", name: "Seaweed Green" },
  { sprite: "postboy_olive", name: "Driftwood Olive" },
];
const WALK_MS = 190;
const BIKE_MS = 150;
const ZOOM_MS = 115;
const SWIM_MS = 230;
const SPEEDY_MS = 60_000; // a delivery within a minute of the last one counts as "speedy"
const DRONE_DELAY_MS = 25_000;
const DRONE_FLIGHT_MS = 50_000;

const MONSTER_INFO: Record<MonsterId, { name: string; sprite: string; ability: string; bob: number }> = {
  pip: { name: "Pip", sprite: "penguin", ability: "Swim", bob: 0 },
  rocky: { name: "Rocky", sprite: "rockitten", ability: "Smash", bob: 0 },
  bzz: { name: "Bzz", sprite: "bee", ability: "Zoom", bob: -6 },
};

type Villager = { def: VillagerDef; w: Walker; home: { x: number; y: number } };
type Spot = { map: MapId; x: number; y: number };
type Drone = {
  letterId: string; to: string; map: MapId;
  from: { x: number; y: number }; dest: { x: number; y: number };
  launchAt: number; arriveAt: number; announced: boolean; done: boolean;
  sprite?: Phaser.GameObjects.Image; shadow?: Phaser.GameObjects.Ellipse;
};

export class World extends Phaser.Scene {
  state!: GameState;
  mapId: MapId = "village";
  mapDef!: MapDef;
  data2!: WorldData;
  ui!: UI;
  player!: Walker;
  followers: { id: MonsterId; w: Walker }[] = [];
  trail: { x: number; y: number }[] = [];
  villagers = new Map<string, Villager>();
  wild = new Map<MonsterId, Walker>();
  boulders: Phaser.GameObjects.Image[] = [];
  mailIcons = new Map<string, Phaser.GameObjects.Image>();
  stickers = new Map<string, Phaser.GameObjects.Image>();
  mapObjects: Phaser.GameObjects.GameObject[] = [];
  tilemap?: Phaser.Tilemaps.Tilemap;
  groundLayer!: Phaser.Tilemaps.TilemapLayer;
  decoLayer!: Phaser.Tilemaps.TilemapLayer;
  nightRect!: Phaser.GameObjects.Rectangle;
  glows: Phaser.GameObjects.Image[] = [];
  noticeboard?: { x: number; y: number };
  drones: Drone[] = [];
  mode: "title" | "play" | "cutscene" = "title";
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  lastBump = 0;
  waterFrame = 0;
  warnedWater = false;
  titlePan = 0;
  playStartedAt = 0;
  lastDeliveryAt = 0;
  lastGossipAt = 0;
  pendingNews: Msg[] = [];

  constructor() { super("World"); }

  init() {
    this.followers = [];
    this.trail = [];
    this.villagers = new Map();
    this.wild = new Map();
    this.drones = [];
    this.mode = "title";
  }

  create() {
    this.ui = this.scene.get("UI") as UI;
    this.state = load() ?? newGame();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,E,SPACE,ENTER,SHIFT,TAB,Q,M,N,T") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture("TAB,SPACE,UP,DOWN,LEFT,RIGHT");
    this.keys.E.on("down", () => this.onAction());
    this.keys.SPACE.on("down", () => this.onAction());
    this.keys.ENTER.on("down", () => this.onAction());
    this.keys.TAB.on("down", () => this.mode === "play" && this.ui.toggleBag(this.state));
    this.keys.Q.on("down", () => this.mode === "play" && this.ui.toggleBag(this.state));
    this.keys.M.on("down", () => this.mode === "play" && !this.ui.folkOpen && this.ui.toggleMap(this.mapInfo()));
    this.keys.T.on("down", () => this.mode === "play" && !this.ui.mapOpen && this.ui.toggleFolk(this.state));
    this.keys.N.on("down", () => this.ui.toast(toggleMute() ? "Sound off" : "Sound on"));

    this.scale.on("resize", this.applyZoom, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.applyZoom, this));

    // player + monster friends persist across maps
    this.player = new Walker(this, this.walkSprite(), PLAYER_START.x, PLAYER_START.y);
    this.player.face("down");
    for (const id of this.state.friends) this.addFollower(id);

    this.loadMap(PLAYER_START.map, { x: PLAYER_START.x, y: PLAYER_START.y, dir: "down" });

    this.time.addEvent({ delay: 280, loop: true, callback: () => this.animateWater() });
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.animateFountain() });
    this.time.addEvent({ delay: 400, loop: true, callback: () => this.sparkle() });
    this.time.addEvent({ delay: 1600, loop: true, callback: () => this.wanderTick() });
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.gossipTick() });

    this.cameras.main.centerOn(36 * TILE, 30 * TILE);
    let autostart = false;
    try {
      autostart = sessionStorage.getItem("postal-autostart") === "1";
      sessionStorage.removeItem("postal-autostart");
    } catch { /* ignore */ }
    if (autostart) this.beginPlay();
    else this.ui.showTitle(!!load(), () => this.startGame(false), () => this.startGame(true));
  }

  // ── Maps ────────────────────────────────────────────────────
  applyZoom() {
    const { width, height } = this.scale;
    const z = Math.max(2, Math.floor(Math.min(width / (TILE * 24), height / (TILE * 14))));
    this.cameras.main.setZoom(z);
  }

  /** Tear down the current map and build another, placing the player at `spawn`. */
  loadMap(id: MapId, spawn: { x: number; y: number; dir: Dir }) {
    for (const o of this.mapObjects) o.destroy();
    this.mapObjects = [];
    for (const v of this.villagers.values()) v.w.destroy();
    this.villagers.clear();
    for (const m of this.wild.values()) { this.tweens.killTweensOf(m.sprite); m.destroy(); }
    this.wild.clear();
    this.boulders = [];
    this.mailIcons.clear();
    this.stickers.clear();
    this.glows = [];
    for (const d of this.drones) { d.sprite?.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined; }
    this.tilemap?.destroy();

    this.mapId = id;
    this.mapDef = MAPS[id];
    this.data2 = buildWorld(this.mapDef);
    const s = this.state;
    if (s.bouldersSmashed) for (const b of this.mapDef.boulders) this.data2.solid[b.y][b.x] = false;
    this.buildTilemap();

    const Wpx = this.mapDef.W * TILE, Hpx = this.mapDef.H * TILE;
    this.cameras.main.setBounds(0, 0, Wpx, Hpx).setRoundPixels(true);
    this.applyZoom();
    this.nightRect = this.track(this.add.rectangle(0, 0, Wpx, Hpx, 0x10183a, 0).setOrigin(0).setDepth(5000));
    for (const d of this.data2.doors) {
      this.glows.push(this.track(this.add.image(d.x * TILE + 8, d.y * TILE + 4, "glow").setDepth(5001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)));
    }

    // props
    if (!s.bouldersSmashed) {
      for (const b of this.mapDef.boulders) {
        this.boulders.push(this.track(this.add.image(b.x * TILE + 8, b.y * TILE + 16, "boulder").setOrigin(0.5, 1).setDepth(10 + b.y + 1)));
      }
    }
    for (const m of this.data2.mailboxes) {
      this.track(this.add.image(m.x * TILE + 8, m.y * TILE + 16, "mailbox").setOrigin(0.5, 1).setDepth(10 + m.y + 1));
      const sticker = this.track(this.add.image(m.x * TILE + 8, m.y * TILE + 9, "sticker").setDepth(10 + m.y + 1.1).setVisible(false));
      this.stickers.set(m.id, sticker);
      const icon = this.track(this.add.image(m.x * TILE + 8, m.y * TILE - 6, "envelope").setDepth(4000).setVisible(false));
      this.tweens.add({ targets: icon, y: icon.y - 3, yoyo: true, repeat: -1, duration: 450, ease: "Sine.inOut" });
      this.mailIcons.set(m.id, icon);
    }
    this.noticeboard = undefined;
    if (id === "square") {
      // the post office starts boarded up; each repair pulls a board off
      const post = this.mapDef.buildings.find((b) => b.id === "post")!;
      const spots = [[post.x + 3, post.y + 3], [post.x + 1, post.y + 3], [post.x + 1, post.y + 1], [post.x + 3, post.y + 1]];
      spots.slice(0, Math.max(0, REPAIRS.length - s.repairs)).forEach(([bx, by]) =>
        this.track(this.add.image(bx * TILE + 8, by * TILE + 8, "boards").setDepth(6)));
      this.noticeboard = { x: post.x - 1, y: post.y + 4 };
      this.track(this.add.image(this.noticeboard.x * TILE + 8, this.noticeboard.y * TILE + 16, "sign").setOrigin(0.5, 1).setDepth(10 + this.noticeboard.y + 1));
      this.data2.solid[this.noticeboard.y][this.noticeboard.x] = true;
    }

    // people & monsters that are on this map right now
    for (const def of VILLAGERS) {
      const at = this.whereIs(def);
      if (at.map === id) this.spawnVillager(def, at);
    }
    for (const m of WILD_MONSTERS) {
      if (m.map !== id || s.friends.includes(m.id)) continue;
      const w = new Walker(this, m.sprite, m.x, m.y);
      w.bob = MONSTER_INFO[m.id].bob;
      w.place();
      w.face("down");
      this.wild.set(m.id, w);
      this.tweens.add({ targets: w.sprite, y: w.sprite.y - 3, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
    }

    // player + followers
    this.player.tx = spawn.x;
    this.player.ty = spawn.y;
    this.player.setTexture(this.walkSprite());
    this.player.face(spawn.dir);
    this.player.place();
    this.trail = [];
    const back = DIRS[spawn.dir];
    this.followers.forEach((f, i) => {
      f.w.tx = spawn.x - back.x * (i + 1);
      f.w.ty = spawn.y - back.y * (i + 1);
      f.w.place();
      f.w.face(spawn.dir);
    });
    if (this.mode !== "title") this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15, 0, 8);
    this.refresh();
  }

  track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.mapObjects.push(o);
    return o;
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
    this.mode = "cutscene";
    const cam = this.cameras.main;
    cam.fadeOut(260, 11, 21, 48);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadMap(to, spawn);
      cam.fadeIn(320, 11, 21, 48);
      this.ui.toast(MAPS[to].name);
      this.mode = "play";
      this.onArrive();
    });
  }

  /** First visit to the square: meet the villain. */
  onArrive() {
    const s = this.state;
    if (this.mapId === "square" && !s.metVane) {
      s.metVane = true;
      this.say([
        { name: "Director Vane", portrait: "magician", text: "Ah. You must be Marlo's grandchild. Director Hollis Vane, Swiftline Logistics." },
        { name: "Director Vane", portrait: "magician", text: "Nothing personal. Efficiency is just… kinder. In twenty days, the Council votes, and this square gets a proper drone hub." },
        { name: "Director Vane", portrait: "magician", text: "Do enjoy your little route while it lasts." },
        { text: "Win the town's trust before the vote. Every villager who trusts you (3 hearts) votes for the post office. You need 7 votes." },
      ]);
    }
  }

  // ── Where everyone is ───────────────────────────────────────
  middayActive() {
    const s = this.state;
    return s.pickedUp && s.deliveredToday >= 2 && s.minutes < EVENING;
  }

  whereIs(def: VillagerDef): Spot {
    if (def.id === "captain" && this.state.voteWon) return { map: "village", x: 45, y: 21 }; // he moved in next to Marigold
    if (def.hangout && this.middayActive()) return def.hangout;
    return { map: def.map, x: def.x, y: def.y };
  }

  spawnVillager(def: VillagerDef, at: Spot) {
    const w = new Walker(this, def.sprite, at.x, at.y);
    w.face("down");
    this.villagers.set(def.id, { def, w, home: { x: at.x, y: at.y } });
    return w;
  }

  /** Move people to where their schedule says, quietly when off-screen and with a fade when on-screen. */
  refreshSchedule() {
    const view = this.cameras.main.worldView;
    const visible = (x: number, y: number) => view.contains(x * TILE + 8, y * TILE + 8);
    for (const def of VILLAGERS) {
      const want = this.whereIs(def);
      const v = this.villagers.get(def.id);
      if (v && (want.map !== this.mapId || v.home.x !== want.x || v.home.y !== want.y)) {
        const leave = () => { v.w.destroy(); this.villagers.delete(def.id); };
        if (visible(v.w.tx, v.w.ty)) {
          this.tweens.add({ targets: [v.w.sprite, v.w.shadow], alpha: 0, duration: 400, onComplete: () => { leave(); if (want.map === this.mapId) this.arriveVillager(def, want); } });
        } else {
          leave();
          if (want.map === this.mapId) this.arriveVillager(def, want);
        }
      } else if (!v && want.map === this.mapId) {
        this.arriveVillager(def, want);
      }
    }
  }

  arriveVillager(def: VillagerDef, at: Spot) {
    const occupied = at.x === this.player.tx && at.y === this.player.ty;
    const w = this.spawnVillager(def, occupied ? { ...at, x: at.x + 1 } : at);
    w.sprite.setAlpha(0);
    w.shadow.setAlpha(0);
    this.tweens.add({ targets: [w.sprite, w.shadow], alpha: 1, duration: 400 });
  }

  addFollower(id: MonsterId) {
    const info = MONSTER_INFO[id];
    const last = this.followers[this.followers.length - 1]?.w ?? this.player;
    const w = new Walker(this, info.sprite, last.tx, last.ty);
    w.bob = info.bob;
    w.place();
    w.face(this.player.facing);
    this.followers.push({ id, w });
  }

  // ── Flow ────────────────────────────────────────────────────
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
    this.mode = "play";
    this.playStartedAt = this.time.now;
    startMusic();
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15, 0, 8);
    this.ui.setWeather(weatherFor(this.state.day));
    this.refresh();
    if (!this.state.introSeen) {
      this.state.introSeen = true;
      const grandma: Letter = {
        id: "grandma", to: "you", from: "Grandma Marlo",
        title: "If You're Reading This…",
        body: "My dear, the Seabreeze Post Office is yours now. I ran it for forty years.\nIt's broke, it's boarded up, and a company called Swiftline wants to tear it down.\nDon't let them. Deliver the mail. Get to know everyone. Win them back, one letter at a time.\nPip will help. He knows the way. — Gran",
      };
      this.ui.showLetter(grandma, "You", () => {
        this.say([
          { name: "Pip", text: "Pweep! ♪ (Pip tugs your sleeve toward the north road.)" },
          { text: "The Post Office is in the Town Square, up the North Road. Postmaster Gull is waiting with your first mailbag." },
          { text: "Arrows / WASD to walk · E to talk & deliver · TAB mailbag · M map · T townsfolk · N mute." },
        ]);
      });
    } else {
      this.ui.toast(`Day ${this.state.day}`);
    }
  }

  // ── Main loop ───────────────────────────────────────────────
  update(_t: number, _dt: number) {
    if (this.mode === "title") {
      this.titlePan += 0.002;
      this.cameras.main.centerOn((32 + Math.sin(this.titlePan) * 14) * TILE, (30 + Math.cos(this.titlePan * 0.7) * 4) * TILE);
      this.updateNight();
      return;
    }
    this.updateDrones();
    this.updateNight();
    this.ui.updateHud(this.state, this.friendsInfo());
    if (this.mode !== "play") {
      this.ui.setPrompt(null);
      this.ui.updateArrows([], this.cameras.main);
      return;
    }
    const busy = this.ui.isBusy();
    if (!busy) this.handleMovement();
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
    const ms = swimming ? SWIM_MS : zoom ? ZOOM_MS : this.state.repairs >= 3 ? BIKE_MS : WALK_MS;
    this.player.setTexture(swimming ? "swimmer" : this.walkSprite());

    this.trail.unshift({ x: this.player.tx, y: this.player.ty });
    this.trail.length = Math.min(this.trail.length, this.followers.length);
    this.player.step(dir, ms, () => this.afterStep());
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

  afterStep() {
    const { tx, ty } = this.player;
    const warp = this.mapDef.warps.find((w) => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h);
    if (warp && this.mode === "play") this.travel(warp.to, warp.spawn);
  }

  walkable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.mapDef.W || y >= this.mapDef.H) return false;
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

  building(id: string) {
    return this.mapDef.buildings.find((b) => b.id === id)!;
  }

  targetAt(x: number, y: number) {
    for (const v of this.villagers.values()) if (v.w.tx === x && v.w.ty === y) return { kind: "villager" as const, v };
    for (const [id, m] of this.wild) if (m.tx === x && m.ty === y) return { kind: "wild" as const, id };
    const mb = this.data2.mailboxes.find((m) => m.x === x && m.y === y);
    if (mb) return { kind: "mailbox" as const, id: mb.id };
    const door = this.data2.doors.find((d) => d.x === x && d.y === y);
    if (door) return { kind: "door" as const, id: door.id };
    if (this.noticeboard && this.noticeboard.x === x && this.noticeboard.y === y) return { kind: "notice" as const };
    if (!this.state.bouldersSmashed && this.mapDef.boulders.some((b) => b.x === x && b.y === y)) return { kind: "boulder" as const };
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
        const b = this.building(t.id);
        return this.lettersFor(b.owner!).length ? "E · Deliver mail" : `E · Mailbox (${b.label})`;
      }
      case "door": return t.id === "home" ? "E · Go to bed" : t.id === "post" ? "E · Post Office" : "E · Knock";
      case "notice": return "E · Read the noticeboard";
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
        const b = this.building(t.id);
        const mine = this.lettersFor(b.owner!);
        if (mine.length) return this.deliver(mine, b.owner!, false);
        const trusted = (this.state.trust[b.owner!] ?? 0) >= 25;
        return this.say([{ text: `${b.label}.${trusted ? " The flag is down: no mail for them right now." : " There's a Swiftline sticker on it. They send most of their mail with Swiftline… for now."}` }]);
      }
      case "door": return this.knock(t.id);
      case "notice": return this.readNoticeboard();
      case "boulder": return this.boulder();
    }
  }

  lettersFor(who: string): Letter[] {
    return this.state.bag.map((id) => letterById(this.state, id)!).filter((l) => l && l.to === who);
  }

  nameOf(id: string) {
    return VILLAGERS.find((v) => v.id === id)?.name ?? id;
  }

  /** Name + portrait + hearts for a villager's dialogue line. */
  speaker(id: string): Pick<Msg, "name" | "portrait" | "hearts"> {
    const def = VILLAGERS.find((v) => v.id === id)!;
    return { name: def.name, portrait: def.sprite, hearts: def.voter ? hearts(this.state.trust[id] ?? 0) : undefined };
  }

  talkTo(v: Villager) {
    const id = v.def.id;
    const s = this.state;
    const dx = this.player.tx - v.w.tx, dy = this.player.ty - v.w.ty;
    v.w.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    if (id === "gull") return this.talkToGull();

    const mine = this.lettersFor(id);
    if (mine.length) {
      this.say([{ ...this.speaker(id), text: mine.length > 1 ? "Ooh, a whole stack for me?" : "Oh! Is that for me?" }], () => this.deliver(mine, id, true));
      return;
    }

    // a daily chat warms people up a little
    const t = s.trust[id] ?? 0;
    const level = id === "vane" ? (s.vaneSoftened ? 3 : s.day > 10 ? 1 : 0) : [0, 1, 3, 3][tier(t).index];
    let line = chatter(id, level, s.day);
    if (v.def.voter && !s.chattedToday.includes(id)) {
      s.chattedToday.push(id);
      const d = addTrust(s, id, 1);
      logEvent(s, "chat", id, d);
      this.heartPop(v.w.tx, v.w.ty, d);
    }
    if (id === "mayor" && !s.voteWon) {
      const tally = voteTally(s);
      line += `\n(The Council votes in ${Math.max(0, s.voteDay - s.day)} days. Right now ${tally.forYou} of 12 would back the post office. You need ${tally.needed}.)`;
    }

    const choices: Msg["choices"] = [];
    if (id === "dot") {
      choices.push({ label: `Monster Snack (${SNACK_PRICE}c)`, cb: () => this.buy("snack") });
      choices.push({ label: `Honey Bun, a gift (${BUN_PRICE}c)`, cb: () => this.buy("bun") });
    }
    if (id === "mo") choices.push({ label: `Monster Snack (${SNACK_PRICE}c)`, cb: () => this.buy("snack") });
    if (id === "sable") choices.push({ label: `New uniform colour (${DYE_PRICE}c)`, cb: () => this.buy("dye") });
    if (v.def.voter && s.buns > 0 && !s.giftedToday.includes(id)) {
      choices.push({ label: "Give a Honey Bun", cb: () => this.giveBun(v) });
    }
    if (choices.length) {
      choices.push({ label: "Just chatting", cb: () => {} });
      this.say([{ ...this.speaker(id), text: `${line}${choices.some((c) => c.label.includes("c)")) ? `\nYou have ${s.coins} coins.` : ""}`, choices }]);
    } else {
      this.say([{ ...this.speaker(id), text: line }]);
    }
  }

  talkToGull() {
    const s = this.state;
    const g = { name: "Postmaster Gull", portrait: "professor" };
    if (!s.pickedUp) {
      const { fresh, diverted } = packBag(s);
      s.pickedUpAt = Date.now();
      this.lastDeliveryAt = Date.now();
      sfx.open();
      const lines: Msg[] = [];
      if (s.day === 1) {
        lines.push({ ...g, text: "You came! Marlo's grandchild. She talked about you every single day." });
        lines.push({ ...g, text: "Here's how it works: folks pay postage, you deliver, and you get a cut. Plus tips, if they like you." });
        lines.push({ ...g, text: "Every house has a red mailbox. Handing letters over in person, and delivering quickly, earns more trust." });
        lines.push({ ...g, text: "Put what you can into the Repair Fund at night. Fix the post office, win the vote, and we keep our home." });
      } else {
        lines.push({ ...g, text: `Morning! ${fresh.length} letters today.` });
        if (diverted) lines.push({ ...g, text: `Swiftline took ${diverted} more from folks who don't trust us yet. Win them over and their mail comes back to us.` });
        const hint = this.gullHint();
        if (hint) lines.push({ ...g, text: hint });
      }
      lines.push({ text: `You got the mailbag! (${fresh.length} letters) · TAB to read the addresses · M for the map.` });
      this.say(lines, () => { this.refresh(); this.scheduleDrones(); });
      return;
    }
    if (s.bag.length === 0) {
      this.say([{ ...g, text: "Bag's empty! Splendid work. Head home and get some rest. Don't forget the Repair Fund." }]);
    } else {
      this.say([{ ...g, text: `Still ${s.bag.length} to go. Follow the little arrows, they point to the mailboxes!` }]);
    }
  }

  gullHint(): string {
    const s = this.state;
    if (!s.bouldersSmashed && s.delivered.includes("shelly1"))
      return "There's mail for someone up on the cliffs, but boulders block the path. A Rockitten could smash them… Dot's snacks might tempt one.";
    if (!s.canSwim && s.delivered.includes("granny1") && s.day >= 3)
      return `Mail's piling up for Lighthouse Isle. Pip's been watching the waves… (${s.delivered.length}/${SWIM_AFTER} deliveries)`;
    if (!s.friends.includes("bzz") && s.day >= 3 && s.day % 2 === 1)
      return "Rosa says a bee keeps buzzing round her meadow. Bees are speedy. Handy for beating drones!";
    if (s.day >= 6 && s.day % 3 === 0) return "Vane's drones are getting bolder. Deliver fast and they'll turn back empty-handed.";
    return "";
  }

  deliver(letters: Letter[], to: string, inPerson: boolean) {
    const s = this.state;
    const queue = [...letters];
    const v = this.villagers.get(to);
    const at = inPerson && v ? { x: v.w.tx, y: v.w.ty } : (() => {
      const home = homeOf(to);
      const mb = home && this.data2.mailboxes.find((m) => m.id === home.building.id);
      return mb ?? { x: this.player.tx, y: this.player.ty };
    })();
    const next = () => {
      const l = queue.shift();
      if (!l) return this.afterDeliveries();
      const now = Date.now();
      const speedy = now - this.lastDeliveryAt < SPEEDY_MS;
      this.lastDeliveryAt = now;
      s.bag = s.bag.filter((id) => id !== l.id);
      s.delivered.push(l.id);
      s.deliveredToday++;
      s.minutes = Math.min(EVENING - 30, s.minutes + MINUTES_PER_DELIVERY);

      // pay: your cut of the postage + a tip that grows with trust
      const tierIdx = tier(s.trust[to] ?? 0).index;
      const tip = [0, 2, 4, 6][tierIdx] + (speedy ? 3 : 0) + (l.parcel ? 3 : 0);
      const pay = 4 + tip;
      s.coins += pay;
      s.earnedToday += pay;

      // trust: delivering builds it; in person, speedy and grandma's letters build more
      const beatDrone = this.drones.some((d) => !d.done && d.letterId === l.id && Date.now() >= d.launchAt);
      const gain = 5 + (inPerson ? 2 : 0) + (speedy ? 3 : 0) + (l.marlo ? 15 : 0) + (beatDrone ? 2 : 0);
      const d = to === "vane" ? 0 : addTrust(s, to, gain);
      logEvent(s, beatDrone ? "beat_drone" : speedy ? "speedy" : inPerson ? "in_person" : "delivered", to, d);
      this.recallDrone(l.id);

      sfx.deliver();
      this.time.delayedCall(350, () => sfx.coin());
      this.burst(at.x, at.y, "heart", 6);
      this.floatText(at.x, at.y - 0.6, `+${pay}c${speedy ? " speedy!" : ""}`);
      if (d > 0) this.heartPop(at.x, at.y, d);
      this.refresh();
      this.ui.showLetter(l, this.nameOf(to), () => {
        if (l.id === "vane1") return this.vaneTwist(next);
        if (l.reply) {
          const r = letterById(s, l.reply)!;
          s.bag.push(r.id);
          this.say([{ ...this.speaker(to), text: `Oh, could you take my reply to ${this.nameOf(r.to)}? Please?` }, { text: `You got a reply letter for ${this.nameOf(r.to)}!` }], next);
        } else next();
      });
    };
    next();
  }

  afterDeliveries() {
    const s = this.state;
    const msgs: Msg[] = [];
    if (!s.canSwim && s.delivered.length >= SWIM_AFTER) {
      s.canSwim = true;
      sfx.unlock();
      msgs.push({ name: "Pip", text: "Pweep!! Pip splashes in a puddle, then puffs out his chest." });
      msgs.push({ text: "Watching you work has made Pip brave. Pip learned SWIM! Walk into the sea to swim. Lighthouse Isle is to the south-east of the village…" });
    }
    if (s.pickedUp && s.bag.length === 0) {
      msgs.push({ text: `That's the last letter! The sun's setting over the bay.\nYou earned ${s.earnedToday}c today. Head home to rest, and decide what goes into the Repair Fund.` });
      this.tweens.addCounter({
        from: s.minutes, to: EVENING, duration: 2500,
        onUpdate: (tw) => { s.minutes = tw.getValue() ?? EVENING; },
        onComplete: () => { s.minutes = EVENING; this.refreshSchedule(); save(s); }, // everyone heads home for the evening
      });
    }
    this.refreshSchedule();
    this.refresh();
    if (msgs.length) this.say(msgs, () => this.refresh());
    save(s);
  }

  heartPop(tx: number, ty: number, delta: number) {
    if (delta <= 0) return;
    const h = this.add.image(tx * TILE + 8, ty * TILE - 10, "heart").setDepth(4600).setScale(1.4);
    const t = this.add.text(tx * TILE + 15, ty * TILE - 14, "+", {
      fontFamily: "Pixelify Sans, monospace", fontSize: "8px", color: "#ff6b81", stroke: "#3a1020", strokeThickness: 2, resolution: 4,
    }).setOrigin(0.5).setDepth(4600);
    this.tweens.add({ targets: [h, t], y: "-=14", alpha: 0, duration: 1100, ease: "Cubic.out", onComplete: () => { h.destroy(); t.destroy(); } });
  }

  buy(what: "snack" | "bun" | "dye") {
    const s = this.state;
    const price = what === "snack" ? SNACK_PRICE : what === "bun" ? BUN_PRICE : DYE_PRICE;
    if (s.coins < price) {
      this.say([{ text: "Not quite enough coins. Deliver some mail and come back!" }]);
      return;
    }
    s.coins -= price;
    sfx.coin();
    if (what === "snack") {
      s.snacks++;
      this.say([{ text: `You bought a crunchy Monster Snack! (You have ${s.snacks}.) Wild monsters can't resist them.` }]);
    } else if (what === "bun") {
      s.buns++;
      this.say([{ text: `A warm Honey Bun! (You have ${s.buns}.) Give it to someone in town: people love being brought a treat.` }]);
    } else {
      s.uniform = (s.uniform + 1) % UNIFORMS.length;
      this.player.setTexture(this.walkSprite());
      sfx.unlock();
      this.burst(this.player.tx, this.player.ty, "sparkle", 12);
      this.say([{ name: "Sable the Tailor", portrait: "fashionista", text: `Swish! ${UNIFORMS[s.uniform].name}. Now you look like someone people trust.` }]);
    }
    this.refresh();
    save(s);
  }

  giveBun(v: Villager) {
    const s = this.state;
    s.buns--;
    s.giftedToday.push(v.def.id);
    const d = addTrust(s, v.def.id, 8);
    logEvent(s, "gift", v.def.id, d);
    sfx.befriend();
    this.burst(v.w.tx, v.w.ty, "heart", 8);
    this.heartPop(v.w.tx, v.w.ty, d);
    this.say([{ ...this.speaker(v.def.id), text: "For me? Oh, you shouldn't have. (They absolutely should have.)" }]);
    save(s);
  }

  walkSprite() {
    return UNIFORMS[this.state.uniform ?? 0].sprite;
  }

  meetWild(id: MonsterId) {
    const s = this.state;
    if (s.snacks <= 0) {
      const flavour = id === "rocky" ? "The wild Rockitten headbutts a pebble and stares at your bag." : "The wild bee buzzes in a happy loop around the flowers… then sniffs your bag.";
      this.say([{ text: `${flavour}\nMaybe it would like a Monster Snack from Dot's Bakery or Mo's Mart?` }]);
      return;
    }
    this.say([{
      text: id === "rocky" ? "The wild Rockitten eyes your snack." : "The wild bee hovers closer to your snack.",
      choices: [
        { label: "Offer a Monster Snack", cb: () => this.befriend(id) },
        { label: "Not now", cb: () => {} },
      ],
    }]);
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
    this.addFollower(id);
    const how = id === "rocky"
      ? "Ability: SMASH. Face a boulder and press E. Those rocks blocking the cliff path don't stand a chance."
      : "Ability: ZOOM. Hold SHIFT (or the Run button) to dash at bee speed. Perfect for beating drones!";
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
    for (const b of this.mapDef.boulders) this.data2.solid[b.y][b.x] = false;
    this.state.bouldersSmashed = true;
    save(this.state);
    this.time.delayedCall(600, () => {
      this.mode = "play";
      sfx.unlock();
      this.say([{ name: "Rocky", text: "Mrrrrow! ✦" }, { text: "Rocky smashed the boulders! The Cliffside path is open. Someone lives up there…" }]);
    });
  }

  readNoticeboard() {
    const s = this.state;
    const tally = voteTally(s);
    const next = REPAIRS[s.repairs];
    const fund = next ? `Repair Fund: ${s.repairFund} / ${next.cost}c for "${next.name}".` : "The post office is fully repaired!";
    this.say([{
      text: `SEABREEZE POST OFFICE: SAVE OUR POST!\n${s.voteWon ? "The Council voted to keep us. Thank you!" : `Council vote in ${Math.max(0, s.voteDay - s.day)} days. Votes for us: ${tally.forYou} of ${tally.needed} needed.`}\n${fund}`,
    }]);
  }

  knock(id: string) {
    const s = this.state;
    if (id === "home") {
      const msgs: Msg[] = [];
      const pay = Math.min(s.earnedToday, s.coins);
      if (pay > 0 && s.repairs < REPAIRS.length) {
        const half = Math.floor(pay / 2);
        const next = REPAIRS[s.repairs];
        msgs.push({
          text: `Before bed: how much of today's pay (${pay}c) goes into the Repair Fund?\nFund: ${s.repairFund} / ${next.cost}c → "${next.name}"`,
          choices: [
            { label: `All of it (${pay}c)`, cb: () => this.fund(pay) },
            { label: `Half (${half}c)`, cb: () => this.fund(half) },
            { label: "Keep it for myself", cb: () => this.fund(0) },
          ],
        });
      } else {
        msgs.push({
          text: s.bag.length ? `You still have ${s.bag.length} letters. They'll keep till tomorrow (folks won't love the wait). Go to bed?` : "Cosy bed, warm blanket, Pip's little snores. Go to bed?",
          choices: [
            { label: "Sleep", cb: () => this.sleep() },
            { label: "Not yet", cb: () => {} },
          ],
        });
      }
      this.say(msgs);
      return;
    }
    if (id === "post") return this.talkToGull();
    if (id === "depot") {
      this.say([{ text: "SWIFTLINE LOGISTICS · DEPOT 7\n\"Delivery without the small talk.\"\nThe door is locked. Something whirs inside." }]);
      return;
    }
    const b = this.building(id);
    this.say([{ text: `Knock knock… The door of ${b.label} is shut. Mail goes in the red mailbox!` }]);
  }

  fund(amount: number) {
    const s = this.state;
    s.coins -= amount;
    s.repairFund += amount;
    while (s.repairs < REPAIRS.length && s.repairFund >= REPAIRS[s.repairs].cost) {
      const r = REPAIRS[s.repairs];
      s.repairFund -= r.cost;
      s.repairs++;
      this.pendingNews.push({ text: `Overnight, the town pitched in: "${r.name}" is done!\n${r.perk}` });
      if (s.repairs === 1) for (const v of VILLAGERS) if (v.voter) addTrust(s, v.id, 5);
    }
    if (amount > 0) sfx.coin();
    this.sleep();
  }

  // ── Days ────────────────────────────────────────────────────
  sleep() {
    this.mode = "cutscene";
    sfx.sleep();
    const s = this.state;
    for (const id of s.bag) {
      const l = letterById(s, id);
      if (l) addTrust(s, l.to, -2); // nobody likes their mail sitting in a bag overnight
    }
    save(s);
    this.ui.fadeDay("Zzz…", s.day + 1, () => {
      overnightGossip(s);
      s.day++;
      s.minutes = DAY_START;
      s.pickedUp = false;
      s.deliveredToday = 0;
      s.earnedToday = 0;
      s.chattedToday = [];
      s.giftedToday = [];
      for (const d of this.drones) { d.sprite?.destroy(); d.shadow?.destroy(); }
      this.drones = [];
      this.loadMap(PLAYER_START.map, { x: PLAYER_START.x, y: PLAYER_START.y, dir: "down" });
      save(s);
      this.ui.setWeather(weatherFor(s.day));
      sfx.morning();
    }, () => {
      this.mode = "play";
      this.ui.toast(`Day ${s.day} · ${weatherFor(s.day)}`);
      this.refresh();
      const news = this.pendingNews.splice(0);
      if (s.day >= s.voteDay && !s.voteWon) news.push({ text: "Today's the day. The Council is meeting at the fountain in the Town Square…" });
      if (news.length) this.say(news, () => { if (s.day >= s.voteDay && !s.voteWon) this.councilVote(); });
    });
  }

  /** The finale: the Council meets in the square. */
  councilVote() {
    const s = this.state;
    this.mode = "cutscene";
    this.cameras.main.fadeOut(300, 11, 21, 48);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadMap("square", { x: 19, y: 20, dir: "up" });
      this.cameras.main.fadeIn(400, 11, 21, 48);
      const tally = voteTally(s);
      const won = tally.forYou >= tally.needed;
      const mayor = { name: "Mayor Hollyhock", portrait: "ceo" };
      const lines: Msg[] = [
        { ...mayor, text: "Order, order! The Council of Seabreeze will now vote: sign with Swiftline, or keep our post office?" },
        { ...mayor, text: `The votes are in… ${tally.forYou} for the post office.` },
      ];
      if (won) {
        lines.push({ ...mayor, text: "The Seabreeze Post Office STAYS!" });
        lines.push({ name: "Director Vane", portrait: "magician", text: s.vaneSoftened ? "…Good. It should stay. Thank you, courier." : "…Inefficient. Sentimental. Fine. Swiftline withdraws." });
      } else {
        lines.push({ ...mayor, text: `That's not enough: we needed ${tally.needed}. But it's close, and this town is clearly changing its mind.` });
        lines.push({ ...mayor, text: "The Council will meet again in five days. Make them count, courier." });
      }
      this.say(lines, () => {
        if (won) {
          s.voteWon = true;
          this.drones = [];
          save(s);
          this.ui.festival(() => {
            s.festivalSeen = true;
            save(s);
            this.mode = "play";
            this.say([{ text: "The post office is saved! The story of this season is told… but the mail never stops. Thanks for playing! ♥" }]);
          });
        } else {
          s.voteDay = s.day + 5;
          save(s);
          this.mode = "play";
        }
      });
    });
  }

  vaneTwist(next: () => void) {
    const s = this.state;
    s.vaneSoftened = true;
    for (const d of this.drones) d.done = true;
    save(s);
    this.say([
      { name: "Director Vane", portrait: "magician", text: "This is… my mother's handwriting." },
      { name: "Director Vane", portrait: "magician", text: "She left when I was nine. I waited by that window every day for a letter. It never came. I thought she forgot me." },
      { name: "Director Vane", portrait: "magician", text: "It was in your post office the whole time. Stuck behind a sorting tray for thirty years." },
      { name: "Director Vane", portrait: "magician", text: "…I'm grounding the drones. I need to think." },
    ], next);
  }

  // ── Swiftline drones ────────────────────────────────────────
  scheduleDrones() {
    const s = this.state;
    if (s.day < 2 || s.vaneSoftened || s.voteWon) return;
    const count = s.day >= 6 ? 2 : 1;
    // drones go after ordinary mail; never replies, grandma's letters, or key story notes
    const targets = s.bag.filter((id) => {
      const l = letterById(s, id);
      return l && !l.reply && !l.marlo && !["vane1", "mayor1"].includes(id);
    }).sort(() => Math.random() - 0.5).slice(0, count);
    targets.forEach((id, i) => {
      const l = letterById(s, id)!;
      const home = homeOf(l.to);
      if (!home) return;
      const map = MAPS[home.map];
      const b = home.building;
      const door = { x: b.x + b.door, y: b.y + 4 };
      const depot = MAPS.square.buildings.find((x) => x.id === "depot")!;
      const from = home.map === "square" ? { x: depot.x + 3, y: depot.y } : { x: map.warps[0].x + 1, y: 0 };
      const launchAt = Date.now() + DRONE_DELAY_MS * (i + 1);
      this.drones.push({ letterId: id, to: l.to, map: home.map, from, dest: { x: door.x + 1, y: door.y - 1 }, launchAt, arriveAt: launchAt + DRONE_FLIGHT_MS, announced: false, done: false });
    });
  }

  recallDrone(letterId: string) {
    for (const d of this.drones) {
      if (d.letterId !== letterId || d.done) continue;
      d.done = true;
      if (d.sprite) {
        const spr = d.sprite, sh = d.shadow;
        this.tweens.add({ targets: [spr, sh], alpha: 0, y: "-=20", duration: 800, onComplete: () => { spr.destroy(); sh?.destroy(); } });
        d.sprite = d.shadow = undefined;
      }
      if (Date.now() >= d.launchAt) this.ui.toast("You beat the drone! It buzzes off, empty-handed.");
    }
  }

  updateDrones() {
    const s = this.state;
    const now = Date.now();
    for (const d of this.drones) {
      if (d.done || now < d.launchAt) continue;
      if (!s.bag.includes(d.letterId)) { this.recallDrone(d.letterId); continue; }
      if (!d.announced) {
        d.announced = true;
        sfx.bump();
        this.ui.toast(`A Swiftline drone is heading for ${this.nameOf(d.to)}'s mailbox!`);
      }
      if (now >= d.arriveAt) {
        d.done = true;
        s.bag = s.bag.filter((id) => id !== d.letterId);
        s.delivered.push(d.letterId); // it still arrives, just not by you (story continues)
        s.swiftlineTook++;
        const delta = addTrust(s, d.to, -3);
        logEvent(s, "drone_beat", d.to, delta);
        d.sprite?.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined;
        sfx.smash();
        this.ui.toast(`Too slow! Swiftline delivered ${this.nameOf(d.to)}'s letter.`);
        this.refresh();
        save(s);
        if (s.pickedUp && s.bag.length === 0) this.afterDeliveries();
        continue;
      }
      if (d.map !== this.mapId) {
        if (d.sprite) { d.sprite.destroy(); d.shadow?.destroy(); d.sprite = d.shadow = undefined; }
        continue;
      }
      const p = (now - d.launchAt) / (d.arriveAt - d.launchAt);
      const x = (d.from.x + (d.dest.x - d.from.x) * p) * TILE + 8;
      const y = (d.from.y + (d.dest.y - d.from.y) * p) * TILE + 8;
      if (!d.sprite) {
        d.shadow = this.add.ellipse(x, y + 18, 12, 4, 0x000000, 0.25).setDepth(9);
        d.sprite = this.add.image(x, y, "drone").setDepth(4400);
      }
      d.sprite.setPosition(x, y + Math.sin(now / 180) * 2).setFlipX(d.dest.x < d.from.x);
      d.shadow!.setPosition(x, y + 18);
    }
  }

  // ── Gossip ──────────────────────────────────────────────────
  gossipTick() {
    if (this.mode !== "play" || this.ui.isBusy() || this.time.now - this.lastGossipAt < 7000) return;
    const s = this.state;
    const view = this.cameras.main.worldView;
    const here = [...this.villagers.values()].filter((v) => v.def.voter && view.contains(v.w.px, v.w.py - 8));
    for (const a of here) {
      for (const b of here) {
        if (a === b || Math.abs(a.w.tx - b.w.tx) + Math.abs(a.w.ty - b.w.ty) > 3) continue;
        const i = gossipBetween(s, a.def.id, b.def.id);
        if (i < 0) continue;
        const e = s.events[i];
        const [l1, l2] = gossipLines(e.type, e.day + i);
        this.lastGossipAt = this.time.now;
        this.bubble(a.w, l1, 0);
        this.time.delayedCall(1900, () => {
          this.bubble(b.w, l2, 0);
          const d = hearGossip(s, i, b.def.id);
          if (d > 0) this.time.delayedCall(900, () => this.heartPop(b.w.tx, b.w.ty, d));
          if (d < 0) this.floatText(b.w.tx, b.w.ty - 0.6, "hmm…");
          save(s);
        });
        return;
      }
    }
  }

  bubble(w: Walker, text: string, delay: number) {
    const t = this.add.text(w.px, w.py - 36, text, {
      fontFamily: "Pixelify Sans, monospace", fontSize: "8px", color: "#3b2a1a", backgroundColor: "#fff4dc",
      padding: { x: 4, y: 3 }, wordWrap: { width: 120 }, align: "center", resolution: 4,
    }).setOrigin(0.5, 1).setDepth(4700).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 4, delay, duration: 200, hold: 2600, yoyo: true, onComplete: () => t.destroy() });
  }

  // ── Helpers ─────────────────────────────────────────────────
  say(msgs: Msg[], onDone?: () => void) {
    this.ui.say(msgs, onDone);
  }

  refresh() {
    const s = this.state;
    const owners = new Set(s.bag.map((id) => letterById(s, id)?.to));
    for (const b of this.mapDef.buildings) {
      this.mailIcons.get(b.id)?.setVisible(!!b.owner && owners.has(b.owner));
      this.stickers.get(b.id)?.setVisible(!!b.owner && (s.trust[b.owner] ?? 0) < 25);
    }
    this.ui.updateHud(s, this.friendsInfo());
  }

  friendsInfo() {
    return this.state.friends.map((id) => ({ ...MONSTER_INFO[id], id, locked: id === "pip" && !this.state.canSwim }));
  }

  /** Where the arrows point: mailboxes here, people here, or the road to the other map. */
  deliveryTargets() {
    const s = this.state;
    const out: { x: number; y: number; label?: string }[] = [];
    let elsewhere: MapId | null = null;
    const exitTo = (to: MapId) => {
      if (elsewhere) return;
      elsewhere = to;
      const w = this.mapDef.warps.find((x) => x.to === to)!;
      out.push({ x: (w.x + w.w / 2) * TILE, y: w.y * TILE + 8, label: `→ ${MAPS[to].name}` });
    };
    const seen = new Set<string>();
    for (const id of s.bag) {
      const l = letterById(s, id);
      if (!l || seen.has(l.to)) continue;
      seen.add(l.to);
      const here = this.villagers.get(l.to);
      if (here) {
        // they're out and about on this map: hand it over in person
        out.push({ x: here.w.px, y: here.w.py - 16 });
        continue;
      }
      const home = homeOf(l.to);
      if (home) {
        if (home.map !== this.mapId) { exitTo(home.map); continue; }
        const mb = this.data2.mailboxes.find((m) => m.id === home.building.id);
        if (mb) out.push({ x: mb.x * TILE + 8, y: mb.y * TILE });
      } else {
        const def = VILLAGERS.find((v) => v.id === l.to);
        if (!def) continue;
        const at = this.whereIs(def);
        if (at.map !== this.mapId) { exitTo(at.map); continue; }
        const v = this.villagers.get(l.to);
        if (v) out.push({ x: v.w.px, y: v.w.py - 16 });
      }
    }
    if (!s.pickedUp) {
      if (this.mapId === "square") {
        const gull = this.villagers.get("gull");
        if (gull) out.push({ x: gull.w.px, y: gull.w.py - 16 });
      } else exitTo("square");
    }
    return out;
  }

  mapInfo(): MapInfo {
    const s = this.state;
    const targets = this.deliveryTargets();
    const other = targets.find((t) => t.label);
    return {
      title: this.mapDef.name,
      player: { x: this.player.tx + 0.5, y: this.player.ty + 0.5 },
      targets: targets.filter((t) => !t.label).map((t) => ({ x: t.x / TILE, y: t.y / TILE })),
      buildings: this.mapDef.buildings.map((b) => ({
        id: b.id, label: b.label, x: b.x + b.door + 0.5, y: b.y,
        hearts: b.owner ? hearts(s.trust[b.owner] ?? 0) : undefined,
      })),
      regions: this.mapDef.regions.map((r) => ({
        label: r.label, x: r.x, y: r.y,
        locked: r.lock === "smash" ? !s.bouldersSmashed : r.lock === "swim" ? !s.canSwim : false,
      })),
      elsewhere: other ? other.label!.replace("→ ", "") : undefined,
    };
  }

  updateNight() {
    const m = this.mode === "title" ? 19 * 60 : this.state.minutes;
    const h = m / 60;
    let night = 0;
    if (h >= 18) night = Math.min(1, (h - 18) / 3);
    const dusk = h >= 16.5 && h < 20 ? Math.sin(((h - 16.5) / 3.5) * Math.PI) * 0.22 : 0;
    const color = night > 0.3 ? 0x101a40 : 0xff8a3c;
    this.nightRect.setFillStyle(color, night > 0.3 ? night * 0.55 : dusk + night * 0.5);
    for (const g of this.glows) g.setAlpha(Math.max(night, dusk * 2) * 0.9);
  }

  animateWater() {
    this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES.length;
    const gidNow = WATER_FRAMES[this.waterFrame];
    for (const c of this.data2.waterCells) {
      const t = this.groundLayer.getTileAt(c.x, c.y);
      if (t) t.index = gidNow;
    }
  }

  fountainFrame = 0;
  animateFountain() {
    if (!this.data2.fountainCells.length) return;
    this.fountainFrame = (this.fountainFrame + 1) % FOUNTAIN.frameOffsets.length;
    const off = FOUNTAIN.frameOffsets[this.fountainFrame];
    for (const c of this.data2.fountainCells) {
      const t = this.decoLayer.getTileAt(c.x, c.y);
      if (t) t.index = c.gid + off;
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
      if (v.def.hangout && this.middayActive()) continue; // stay put and chat
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
