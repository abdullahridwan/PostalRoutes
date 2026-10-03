import Phaser from "phaser";
import { sfx } from "../game/audio";
import type { Letter } from "../game/letters";
import { clockText, letterById, type GameState } from "../game/state";
import { hearts, tier, voteTally, voters } from "../game/trust";
import { ALL_BUILDINGS as BUILDINGS, VILLAGERS } from "../world/layout";
import { TouchControls } from "./TouchControls";
import type { World } from "./World";

export type Msg = {
  name?: string;
  portrait?: string;
  hearts?: number; // shown next to the name tag (0–5)
  text: string;
  choices?: { label: string; cb: () => void }[];
};

const FONT = "Pixelify Sans, monospace";
const INK = "#3b2a1a";
const PAPER = 0xfff4dc;
const PAPER_EDGE = 0x8a5a3c;
const NAVY = 0x1d2b3a;

const txt = (s: Phaser.Scene, x: number, y: number, t: string, size: number, color = INK, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
  s.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, ...extra });

export type MapInfo = {
  title: string;
  player: { x: number; y: number };
  targets: { x: number; y: number }[];
  buildings: { id: string; label: string; x: number; y: number; hearts?: number }[];
  regions: { label: string; x: number; y: number; locked: boolean }[];
  /** Mail waiting on the other map. */
  elsewhere?: string;
};

// Short names for the map on small screens.
const SHORT_LABELS: Record<string, string> = {
  post: "Post Office", home: "Home", granny: "Marigold", mart: "Mart", clinic: "Clinic",
  shelly: "Shelly", rosa: "Rosa", tobi: "Tobi", finn: "Finn", captain: "Captain",
};

type FriendInfo = { id: string; name: string; sprite: string; ability: string; locked: boolean };

export class UI extends Phaser.Scene {
  queue: Msg[] = [];
  onQueueDone: (() => void) | null = null;
  dialog!: Phaser.GameObjects.Container;
  dialogBg!: Phaser.GameObjects.Graphics;
  dialogName!: Phaser.GameObjects.Text;
  dialogText!: Phaser.GameObjects.Text;
  dialogPortrait!: Phaser.GameObjects.Image;
  dialogMore!: Phaser.GameObjects.Text;
  measure!: Phaser.GameObjects.Text;
  choiceTexts: Phaser.GameObjects.Text[] = [];
  choiceIndex = 0;
  current: Msg | null = null;
  typing = 0;
  typeTimer?: Phaser.Time.TimerEvent;

  letterOpen = false;
  letterCard!: Phaser.GameObjects.Container;
  letterDone: (() => void) | null = null;

  bagOpen = false;
  bagPanel!: Phaser.GameObjects.Container;

  mapOpen = false;
  folkOpen = false;
  folkPanel!: Phaser.GameObjects.Container;
  votePill!: Phaser.GameObjects.Container;
  voteText!: Phaser.GameObjects.Text;
  nameHearts!: Phaser.GameObjects.Container;
  mapPanel!: Phaser.GameObjects.Container;

  hud!: Phaser.GameObjects.Container;
  hudDay!: Phaser.GameObjects.Text;
  hudClock!: Phaser.GameObjects.Text;
  hudCoins!: Phaser.GameObjects.Text;
  hudSnacks!: Phaser.GameObjects.Text;
  hudBag!: Phaser.GameObjects.Text;
  friendsRow!: Phaser.GameObjects.Container;
  friendsKey = "";

  prompt!: Phaser.GameObjects.Text;
  arrows: Phaser.GameObjects.Container[] = [];

  title?: Phaser.GameObjects.Container;
  titleChoices: Phaser.GameObjects.Text[] = [];
  titleIndex = 0;
  titleActions: (() => void)[] = [];

  rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  petals?: Phaser.GameObjects.Particles.ParticleEmitter;

  touch!: TouchControls;

  constructor() { super("UI"); }

  create() {
    this.buildHud();
    this.buildDialog();
    this.letterCard = this.add.container(0, 0).setDepth(300).setVisible(false);
    this.bagPanel = this.add.container(0, 0).setDepth(250).setVisible(false);
    this.mapPanel = this.add.container(0, 0).setDepth(260).setVisible(false);
    this.folkPanel = this.add.container(0, 0).setDepth(270).setVisible(false);
    this.prompt = txt(this, 0, 0, "", 16, "#fff4dc", { backgroundColor: "#1d2b3acc", padding: { x: 12, y: 6 } }).setOrigin(0.5, 1).setDepth(100).setVisible(false);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.moveChoice(-1));
    kb.on("keydown-W", () => this.moveChoice(-1));
    kb.on("keydown-DOWN", () => this.moveChoice(1));
    kb.on("keydown-S", () => this.moveChoice(1));
    kb.on("keydown-ENTER", () => this.titleSelect());
    kb.on("keydown-SPACE", () => this.titleSelect());
    kb.on("keydown-E", () => this.titleSelect());
    // touch: on-screen pad for phones (auto-detected, or force with ?touch)
    this.touch = new TouchControls(this);
    this.touch.onA = () => this.world().onAction();
    this.touch.onB = () => { const w = this.world(); if (w.mode === "play") this.toggleBag(w.state); };
    this.touch.onMap = () => { const w = this.world(); if (w.mode === "play") this.toggleMap(w.mapInfo()); };
    this.input.addPointer(2);
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (coarse || new URLSearchParams(location.search).has("touch")) this.touch.enabled = true;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.wasTouch && !this.touch.enabled) { this.touch.enabled = true; this.layout(); }
      if (this.title) return;
      if (this.isBusy()) {
        // with choices on screen, only a tap on a choice should pick one
        if (this.current?.choices && this.typing >= this.current.text.length) return;
        this.advance();
        return;
      }
      this.touch.down(p);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.touch.move(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.touch.up(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.touch.up(p));

    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));
    this.layout();
  }

  world() {
    return this.scene.get("World") as World;
  }

  update() {
    if (!this.touch.enabled) return;
    const w = this.world();
    this.touch.setVisible(w.mode === "play" && !this.isBusy());
  }

  // ── Layout ──────────────────────────────────────────────────
  layout() {
    const { width, height } = this.scale;
    this.hud.setPosition(14, 14);
    if (this.touch.enabled) {
      // keep the bottom clear for the pad: friends tuck under the HUD, prompt floats above
      this.prompt.setPosition(width / 2, height - this.touch.reservedHeight - 8);
      this.friendsRow.setPosition(14, 14 + 120 + 10 + 46).setScale(0.8);
    } else {
      this.prompt.setPosition(width / 2, height - 18);
      this.friendsRow.setPosition(14, height - 14).setScale(1);
    }
    this.touch.layout(width, height);
    this.drawDialogFrame();
    if (this.title) this.drawTitle();
  }

  // ── HUD ─────────────────────────────────────────────────────
  buildHud() {
    this.hud = this.add.container(0, 0).setDepth(100).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(PAPER, 0.95).fillRoundedRect(0, 0, 216, 80, 10);
    g.lineStyle(3, PAPER_EDGE).strokeRoundedRect(0, 0, 216, 80, 10);
    this.hudDay = txt(this, 12, 8, "", 18);
    this.hudClock = txt(this, 204, 8, "", 18, "#b0503a").setOrigin(1, 0);
    const coin = this.add.image(20, 51, "coin").setScale(2);
    this.hudCoins = txt(this, 32, 40, "", 17);
    const snack = this.add.image(92, 51, "snack").setScale(2);
    this.hudSnacks = txt(this, 104, 40, "", 17);
    const env = this.add.image(154, 51, "envelope").setScale(2);
    this.hudBag = txt(this, 170, 40, "", 17);
    this.hud.add([g, this.hudDay, this.hudClock, coin, this.hudCoins, snack, this.hudSnacks, env, this.hudBag]);

    // the big goal, always visible: Council votes
    this.votePill = this.add.container(0, 88);
    const pg = this.add.graphics();
    pg.fillStyle(NAVY, 0.88).fillRoundedRect(0, 0, 216, 30, 15);
    pg.lineStyle(2, 0xffe066, 0.8).strokeRoundedRect(0, 0, 216, 30, 15);
    this.voteText = txt(this, 36, 6, "", 15, "#fff4dc");
    this.votePill.add([pg, this.add.image(18, 15, "ballot").setScale(2), this.voteText]);
    this.hud.add(this.votePill);
    this.friendsRow = this.add.container(0, 0).setDepth(100).setVisible(false);
  }

  updateHud(s: GameState, friends: FriendInfo[]) {
    this.hud.setVisible(true);
    this.friendsRow.setVisible(true);
    const w = this.registry.get("weather") ?? "sunny";
    const label = w === "rain" ? "Rainy" : w === "breezy" ? "Breezy" : "Sunny";
    this.hudDay.setText(`Day ${s.day} · ${label}`);
    this.hudClock.setText(clockText(s.minutes));
    this.hudCoins.setText(`${s.coins}`);
    this.hudSnacks.setText(`${s.snacks}`);
    this.hudBag.setText(`${s.bag.length}`);
    const tally = voteTally(s);
    const left = Math.max(0, s.voteDay - s.day);
    this.voteText.setText(s.voteWon ? "Post office saved! ♥" : `Votes ${tally.forYou}/${tally.needed} · ${left === 0 ? "vote today" : `${left} days left`}`);

    this.touch.showRun = friends.some((f) => f.id === "bzz");
    const key = friends.map((f) => f.id + f.locked).join();
    if (key !== this.friendsKey) {
      this.friendsKey = key;
      this.friendsRow.removeAll(true);
      friends.forEach((f, i) => {
        const x = i * 120;
        const g = this.add.graphics();
        g.fillStyle(NAVY, 0.8).fillRoundedRect(x, -48, 112, 48, 10);
        const spr = this.add.sprite(x + 22, -6, f.sprite, 1).setOrigin(0.5, 1).setScale(1.5);
        const n = txt(this, x + 40, -45, f.name, 16, "#fff4dc");
        const a = txt(this, x + 40, -24, f.locked ? "Swim: ?" : f.ability, 14, f.locked ? "#8899aa" : "#ffe066");
        this.friendsRow.add([g, spr, n, a]);
      });
    }
  }

  setPrompt(t: string | null) {
    this.prompt.setVisible(!!t);
    if (t && this.prompt.text !== t) this.prompt.setText(t);
  }

  // Off-screen arrows pointing at mailboxes that need mail.
  updateArrows(targets: { x: number; y: number; label?: string }[], cam: Phaser.Cameras.Scene2D.Camera) {
    while (this.arrows.length < targets.length) {
      const c = this.add.container(0, 0).setDepth(90);
      const tri = this.add.triangle(0, 0, 0, -9, 18, 0, 0, 9, 0xe74c3c).setStrokeStyle(2, 0x5a1a10);
      const env = this.add.image(-16, 0, "envelope").setScale(2);
      const lbl = txt(this, 0, 0, "", 14, "#fff4dc", { backgroundColor: "#1d2b3add", padding: { x: 6, y: 3 } }).setOrigin(0.5);
      c.add([tri, env, lbl]);
      this.arrows.push(c);
    }
    const { width, height } = this.scale;
    const busy = this.isBusy();
    this.arrows.forEach((a, i) => {
      const t = targets[i];
      if (!t || busy) return a.setVisible(false);
      const sx = (t.x - cam.worldView.x) * cam.zoom;
      const sy = (t.y - cam.worldView.y) * cam.zoom;
      const m = 40;
      const on = sx > m && sx < width - m && sy > m && sy < height - m;
      if (on) return a.setVisible(false);
      const cx = width / 2, cy = height / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((width / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (height / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      a.setVisible(true).setPosition(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
      (a.list[0] as Phaser.GameObjects.Triangle).setRotation(ang);
      const env = a.list[1] as Phaser.GameObjects.Image;
      env.setPosition(-Math.cos(ang) * 22, -Math.sin(ang) * 22 + Math.sin(this.time.now / 200) * 2);
      const lbl = a.list[2] as Phaser.GameObjects.Text;
      lbl.setVisible(!!t.label);
      if (t.label) {
        if (lbl.text !== t.label) lbl.setText(t.label);
        lbl.setPosition(-Math.cos(ang) * 52, -Math.sin(ang) * 30 + 22);
      }
    });
  }

  toast(text: string) {
    const { width } = this.scale;
    const t = txt(this, width / 2, 24, text, 20, "#fff4dc", { backgroundColor: "#1d2b3add", padding: { x: 14, y: 8 } })
      .setOrigin(0.5, 0).setDepth(400).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: 30, duration: 250, hold: 1800, yoyo: true, onComplete: () => t.destroy() });
  }

  // ── Dialogue ────────────────────────────────────────────────
  buildDialog() {
    this.dialog = this.add.container(0, 0).setDepth(200).setVisible(false);
    this.dialogBg = this.add.graphics();
    this.dialogPortrait = this.add.image(0, 0, "portrait-postboy").setVisible(false);
    this.dialogName = txt(this, 0, 0, "", 18, "#fff4dc", { backgroundColor: "#b0503a", padding: { x: 10, y: 4 } });
    this.dialogText = txt(this, 0, 0, "", 21, INK, { lineSpacing: 6 });
    this.dialogMore = txt(this, 0, 0, "▼", 16, "#b0503a").setOrigin(1, 1);
    this.measure = txt(this, 0, 0, "", 21, INK, { lineSpacing: 6 }).setVisible(false);
    this.tweens.add({ targets: this.dialogMore, alpha: 0.2, yoyo: true, repeat: -1, duration: 400 });
    this.nameHearts = this.add.container(0, 0);
    this.dialog.add([this.dialogBg, this.dialogPortrait, this.dialogName, this.nameHearts, this.dialogText, this.dialogMore]);
  }

  /** Lays out the dialogue box; it grows to fit the message and goes compact on phones. */
  drawDialogFrame() {
    const { width, height } = this.scale;
    const compact = width < 560;
    const w = Math.min(760, width - (compact ? 20 : 32));
    const hasPortrait = !!this.current?.portrait;
    const pSize = compact ? 64 : 108;
    const textOffset = hasPortrait ? 12 + pSize + 14 : 22;
    const wrap = w - textOffset - 24;
    const fontSize = compact ? 18 : 21;
    this.dialogText.setFontSize(fontSize).setWordWrapWidth(wrap);
    this.measure.setFontSize(fontSize).setWordWrapWidth(wrap).setText(this.current?.text ?? "");
    const h = Math.max(compact ? 100 : 132, hasPortrait ? pSize + 24 : 0, this.measure.height + 46);
    const x = (width - w) / 2, y = height - h - (compact ? 10 : 16);

    const g = this.dialogBg;
    g.clear();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 4, y + 6, w, h, 14);
    g.fillStyle(PAPER, 1).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(4, PAPER_EDGE).strokeRoundedRect(x, y, w, h, 14);
    if (hasPortrait) {
      g.fillStyle(0xf3dfb5, 1).fillRoundedRect(x + 12, y + 12, pSize, pSize, 10);
      this.dialogPortrait.setScale(compact ? 1 : 1.6).setPosition(x + 12 + pSize / 2, y + 12 + pSize / 2);
    }
    const tx = x + textOffset;
    this.dialogName.setPosition(tx, y - 16);
    this.nameHearts.setPosition(tx + this.dialogName.width + 8, y - 6);
    this.dialogText.setPosition(tx, y + 22);
    this.dialogMore.setPosition(x + w - 14, y + h - 8);
    this.choiceTexts.forEach((c, i) => c.setPosition(x + w - 22, y - 18 - (this.choiceTexts.length - i) * 38));
  }

  say(msgs: Msg[], onDone?: () => void) {
    if (this.queue.length || this.current) {
      // chain behind whatever is showing
      this.queue.push(...msgs);
      const prev = this.onQueueDone;
      this.onQueueDone = () => { prev?.(); onDone?.(); };
      return;
    }
    this.queue = [...msgs];
    this.onQueueDone = onDone ?? null;
    this.nextMsg();
  }

  nextMsg() {
    this.choiceTexts.forEach((c) => c.destroy());
    this.choiceTexts = [];
    const m = this.queue.shift();
    if (!m) {
      this.current = null;
      this.dialog.setVisible(false);
      const done = this.onQueueDone;
      this.onQueueDone = null;
      done?.();
      return;
    }
    this.current = m;
    this.dialog.setVisible(true);
    this.dialogName.setVisible(!!m.name).setText(m.name ?? "");
    this.nameHearts.removeAll(true);
    if (m.hearts !== undefined) this.heartRow(this.nameHearts, 0, 0, m.hearts, 2);
    if (m.portrait && this.textures.exists(`portrait-${m.portrait}`)) {
      this.dialogPortrait.setTexture(`portrait-${m.portrait}`).setVisible(true).setCrop(64, 0, 64, 64);
      // texture is 128 wide; the art sits in the right half
      this.dialogPortrait.setOrigin(0.75, 0.5);
    } else {
      this.dialogPortrait.setVisible(false);
      m.portrait = undefined;
    }
    this.drawDialogFrame();
    this.typing = 0;
    this.dialogText.setText("");
    this.dialogMore.setVisible(false);
    this.typeTimer?.remove();
    this.typeTimer = this.time.addEvent({
      delay: 18, loop: true, callback: () => {
        this.typing += 1;
        this.dialogText.setText(m.text.slice(0, this.typing));
        if (this.typing % 3 === 0 && m.text[this.typing] !== " ") sfx.talk();
        if (this.typing >= m.text.length) this.finishTyping();
      },
    });
  }

  finishTyping() {
    const m = this.current;
    if (!m) return;
    this.typeTimer?.remove();
    this.typing = m.text.length;
    this.dialogText.setText(m.text);
    if (m.choices && this.choiceTexts.length === 0) {
      this.choiceIndex = 0;
      this.choiceTexts = m.choices.map((c, i) => {
        const t = txt(this, 0, 0, c.label, 19, INK, { backgroundColor: "#fff4dc", padding: { x: 12, y: 6 } })
          .setOrigin(1, 0).setInteractive({ useHandCursor: true });
        t.on("pointerover", () => { this.choiceIndex = i; this.paintChoices(); });
        t.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => { e.stopPropagation(); this.choiceIndex = i; this.advance(); });
        this.dialog.add(t);
        return t;
      });
      this.drawDialogFrame();
      this.paintChoices();
    }
    this.dialogMore.setVisible(!m.choices);
  }

  paintChoices() {
    this.choiceTexts.forEach((t, i) => {
      const on = i === this.choiceIndex;
      t.setText(`${on ? "▶ " : "  "}${this.current!.choices![i].label}`);
      t.setBackgroundColor(on ? "#ffe8a8" : "#fff4dc");
    });
  }

  moveChoice(d: number) {
    if (this.title) {
      this.titleIndex = (this.titleIndex + d + this.titleChoices.length) % this.titleChoices.length;
      this.paintTitle();
      sfx.blip();
      return;
    }
    if (!this.choiceTexts.length) return;
    this.choiceIndex = (this.choiceIndex + d + this.choiceTexts.length) % this.choiceTexts.length;
    this.paintChoices();
    sfx.blip();
  }

  isBusy() {
    return !!this.current || this.letterOpen || this.bagOpen || this.mapOpen || this.folkOpen || !!this.title;
  }

  advance() {
    if (this.letterOpen) return this.closeLetter();
    if (this.bagOpen) return this.toggleBag();
    if (this.folkOpen) return this.toggleFolk();
    if (this.mapOpen) return this.toggleMap();
    const m = this.current;
    if (!m) return;
    if (this.typing < m.text.length) return this.finishTyping();
    if (m.choices) {
      const choice = m.choices[this.choiceIndex];
      sfx.blip();
      this.nextMsg();
      choice.cb();
      return;
    }
    sfx.blip();
    this.nextMsg();
  }

  // ── Letters ─────────────────────────────────────────────────
  showLetter(l: Letter, toName: string, onClose: () => void) {
    const { width, height } = this.scale;
    const c = this.letterCard;
    c.removeAll(true);
    const w = Math.min(460, width - 40);
    const body = txt(this, 0, 0, l.body, 19, INK, { wordWrap: { width: w - 56 }, lineSpacing: 6 });
    const h = Math.max(240, body.height + 170);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.45).fillRect(-width, -height, width * 3, height * 3);
    g.fillStyle(0x000000, 0.25).fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
    g.fillStyle(PAPER, 1).fillRect(-w / 2, -h / 2, w, h);
    // airmail stripes
    for (let i = 0; i < w; i += 12) {
      const sw = Math.min(12, w - i);
      g.fillStyle((i / 12) % 2 === 0 ? 0xe74c3c : 0x3a7bd5, 1);
      g.fillRect(-w / 2 + i, -h / 2, sw, 6);
      g.fillRect(-w / 2 + i, h / 2 - 6, sw, 6);
    }
    g.lineStyle(2, PAPER_EDGE).strokeRect(-w / 2, -h / 2, w, h);
    // stamp
    g.fillStyle(0xf3dfb5, 1).fillRect(w / 2 - 66, -h / 2 + 18, 44, 52);
    g.lineStyle(2, 0xb0503a).strokeRect(w / 2 - 66, -h / 2 + 18, 44, 52);
    const icon = this.add.image(w / 2 - 44, -h / 2 + 44, l.parcel ? "parcel" : "heart").setScale(3);
    const title = txt(this, -w / 2 + 28, -h / 2 + 22, l.title, 23, "#b0503a", { wordWrap: { width: w - 120 } });
    const meta = txt(this, -w / 2 + 28, title.y + title.height + 6, `To: ${toName}   ·   From: ${l.from}`, 15, "#8a6a4a", { wordWrap: { width: w - 120 } });
    body.setPosition(-w / 2 + 28, meta.y + meta.height + 18);
    const hint = txt(this, w / 2 - 20, h / 2 - 16, "E / click ▶", 16, "#b0503a").setOrigin(1, 1);
    const stampTag = txt(this, -w / 2 + 28, h / 2 - 16, "✉ DELIVERED", 16, "#3a7bd5").setOrigin(0, 1).setRotation(-0.05);
    c.add([g, icon, title, meta, body, hint, stampTag]);
    c.setPosition(width / 2, height / 2 - 20).setVisible(true).setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: "Back.out" });
    this.letterOpen = true;
    this.letterDone = onClose;
    sfx.open();
  }

  closeLetter() {
    this.letterOpen = false;
    this.tweens.add({
      targets: this.letterCard, alpha: 0, scale: 0.8, y: this.letterCard.y - 30, duration: 160,
      onComplete: () => this.letterCard.setVisible(false),
    });
    const done = this.letterDone;
    this.letterDone = null;
    done?.();
  }

  // ── Town map ────────────────────────────────────────────────
  toggleMap(info?: MapInfo) {
    if (this.mapOpen || !info) {
      this.mapOpen = false;
      this.tweens.killTweensOf(this.mapPanel.list);
      this.mapPanel.setVisible(false).removeAll(true);
      sfx.blip();
      return;
    }
    if (this.current || this.letterOpen || this.bagOpen) return;
    const { width, height } = this.scale;
    const frame = this.textures.getFrame("worldmap");
    const mw = frame.width, mh = frame.height;
    const compact = width < 560;
    const s = Math.min((width - (compact ? 24 : 80)) / mw, (height - (compact ? 150 : 150)) / mh, 1.3);
    const dw = mw * s, dh = mh * s;
    const ox = (width - dw) / 2, oy = (height - dh) / 2 + 10;
    const at = (tx: number, ty: number) => ({ x: ox + tx * 16 * s, y: oy + ty * 16 * s });
    const p = this.mapPanel;
    p.removeAll(true);

    const g = this.add.graphics();
    g.fillStyle(0x0b1530, 0.75).fillRect(0, 0, width, height);
    g.fillStyle(0x000000, 0.3).fillRoundedRect(ox - 10 + 5, oy - 10 + 7, dw + 20, dh + 20, 14);
    g.fillStyle(PAPER_EDGE, 1).fillRoundedRect(ox - 10, oy - 10, dw + 20, dh + 20, 14);
    p.add(g);
    p.add(this.add.image(ox, oy, "worldmap").setOrigin(0).setScale(s));
    p.add(txt(this, width / 2, oy - 22, info.title, compact ? 22 : 28, "#ffe8a8", { stroke: "#1d2b3a", strokeThickness: 6 }).setOrigin(0.5, 1));

    const tag = (x: number, y: number, label: string, size: number, color: string, bg: string) =>
      p.add(txt(this, x, y, label, size, color, { backgroundColor: bg, padding: { x: 5, y: 2 } }).setOrigin(0.5, 1));

    for (const r of info.regions) {
      if (compact && !r.locked) continue; // small screens: only flag places you can't reach yet
      const pt = at(r.x, r.y);
      tag(pt.x, pt.y, r.locked ? `${r.label} (locked)` : r.label, compact ? 12 : 15, r.locked ? "#c9d2dc" : "#ffe8a8", "#1d2b3acc");
    }
    for (const b of info.buildings) {
      const pt = at(b.x, b.y);
      if (b.hearts !== undefined) this.heartRow(p, pt.x - (compact ? 15 : 22), pt.y + 2, b.hearts, compact ? 1 : 1.5);
      tag(pt.x, pt.y, compact ? SHORT_LABELS[b.id] ?? b.label : b.label, compact ? 11 : 14, INK, "#fff4dcdd");
    }
    for (const t of info.targets) {
      const pt = at(t.x, t.y);
      const env = this.add.image(pt.x, pt.y - 4, "envelope").setScale(compact ? 2 : 2.5);
      p.add(env);
      this.tweens.add({ targets: env, y: env.y - 5, yoyo: true, repeat: -1, duration: 420, ease: "Sine.inOut" });
    }
    const me = at(info.player.x, info.player.y);
    const ring = this.add.circle(me.x, me.y, compact ? 9 : 12, 0xffe066, 0.35).setStrokeStyle(3, 0xe74c3c);
    const dot = this.add.circle(me.x, me.y, compact ? 4 : 5, 0xe74c3c).setStrokeStyle(2, 0xffffff);
    p.add([ring, dot]);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, repeat: -1, duration: 900 });
    tag(me.x, me.y - (compact ? 10 : 14), "You", compact ? 12 : 14, "#ffffff", "#e74c3c");

    const here = info.targets.length ? `✉ = mail to deliver (${info.targets.length})` : "No mail to deliver here";
    const legend = info.elsewhere ? `${here}  ·  more in ${info.elsewhere}` : here;
    const folkBtn = txt(this, ox + dw, oy - 22, compact ? "Townsfolk ▸" : "T · Townsfolk ▸", compact ? 14 : 16, INK, { backgroundColor: "#ffe066", padding: { x: 10, y: 5 } })
      .setOrigin(1, 1).setInteractive({ useHandCursor: true });
    folkBtn.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      const w = this.world();
      this.toggleMap();
      this.toggleFolk(w.state);
    });
    p.add(folkBtn);
    p.add(txt(this, width / 2, oy + dh + 18, `${legend}   ·   ${compact ? "tap" : "M / tap"} to close`, compact ? 13 : 16, "#fff4dc").setOrigin(0.5, 0));
    p.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: p, alpha: 1, duration: 180 });
    this.mapOpen = true;
    sfx.open();
  }

  /** A row of 5 hearts, filled up to n. */
  heartRow(parent: Phaser.GameObjects.Container, x: number, y: number, n: number, scale: number) {
    for (let i = 0; i < 5; i++) {
      const h = this.add.image(x + i * 8 * scale, y, "heart").setScale(scale).setOrigin(0, 0.5);
      if (i >= n) h.setTint(0x5a4a4a).setAlpha(0.45);
      parent.add(h);
    }
  }

  // ── Townsfolk (trust overview) ──────────────────────────────
  toggleFolk(s?: GameState) {
    if (this.folkOpen || !s) {
      this.folkOpen = false;
      this.folkPanel.setVisible(false).removeAll(true);
      sfx.blip();
      return;
    }
    if (this.current || this.letterOpen || this.bagOpen || this.mapOpen) return;
    const { width, height } = this.scale;
    const compact = width < 560;
    const list = voters();
    const cols = compact ? 1 : 2;
    const rowH = compact ? 50 : 58;
    const rows = Math.ceil(list.length / cols);
    const w = Math.min(compact ? width - 20 : 860, width - 20);
    const h = Math.min(height - 20, 120 + rows * rowH);
    const p = this.folkPanel;
    p.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(0x0b1530, 0.6).fillRect(-width, -height, width * 3, height * 3);
    g.fillStyle(PAPER_EDGE, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(PAPER, 1).fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 12);
    p.add(g);
    const tally = voteTally(s);
    p.add(txt(this, 0, -h / 2 + 20, "Townsfolk", compact ? 22 : 26, "#b0503a").setOrigin(0.5, 0));
    p.add(txt(this, 0, -h / 2 + (compact ? 50 : 56), `Council votes for you: ${tally.forYou} / ${tally.needed} needed  ·  3 hearts = a vote`, compact ? 12 : 15, "#8a6a4a").setOrigin(0.5, 0));
    const colW = (w - 40) / cols;
    list.forEach((v, i) => {
      const t = s.trust[v.id] ?? 0;
      const c = i % cols, r = Math.floor(i / cols);
      const x = -w / 2 + 20 + c * colW, y = -h / 2 + (compact ? 80 : 90) + r * rowH;
      const votes = t >= 60;
      g.fillStyle(votes ? 0xfff0b8 : 0xf3e6c8, 1).fillRoundedRect(x, y, colW - 10, rowH - 8, 8);
      p.add(this.add.sprite(x + 20, y + rowH - 12, v.sprite, 1).setOrigin(0.5, 1).setScale(compact ? 1.2 : 1.4));
      p.add(txt(this, x + 42, y + 4, v.name, compact ? 14 : 16));
      this.heartRow(p, x + 42, y + (compact ? 30 : 34), hearts(t), compact ? 1.5 : 1.8);
      p.add(txt(this, x + (compact ? 120 : 140), y + (compact ? 22 : 26), `${tier(t).name}${votes ? "  ✓ vote" : ""}${compact ? "" : `  ·  ${v.likes ?? ""}`}`, compact ? 11 : 13, votes ? "#2e7d32" : "#8a6a4a",
        { fixedWidth: colW - (compact ? 130 : 152) }));
    });
    p.add(txt(this, 0, h / 2 - 26, "T / tap to close", 14, "#8a6a4a").setOrigin(0.5, 0));
    p.setPosition(width / 2, height / 2).setVisible(true);
    this.folkOpen = true;
    sfx.open();
  }

  // ── Mailbag ─────────────────────────────────────────────────
  toggleBag(s?: GameState) {
    if (this.bagOpen || !s) {
      this.bagOpen = false;
      this.bagPanel.setVisible(false);
      sfx.blip();
      return;
    }
    if (this.current || this.letterOpen) return;
    const { width, height } = this.scale;
    const p = this.bagPanel;
    p.removeAll(true);
    const rows = s.bag.map((id) => letterById(s, id)!).filter(Boolean);
    const w = Math.min(520, width - 40);
    const h = 126 + Math.max(1, rows.length) * 52;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRect(-width, -height, width * 3, height * 3);
    g.fillStyle(0x8a5a3c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(0xc8925e, 1).fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 12);
    p.add(g);
    p.add(txt(this, 0, -h / 2 + 22, "✉  Mailbag", 26, "#fff4dc").setOrigin(0.5, 0));
    if (!rows.length) {
      p.add(txt(this, 0, -h / 2 + 76, s.pickedUp ? "Empty! Nice work, courier." : "Empty. Visit Postmaster Gull at the Post Office.", 18, "#fff4dc", { wordWrap: { width: w - 60 }, align: "center" }).setOrigin(0.5, 0));
    }
    rows.forEach((l, i) => {
      const y = -h / 2 + 72 + i * 52;
      const v = VILLAGERS.find((v) => v.id === l.to);
      const b = BUILDINGS.find((b) => b.owner === l.to);
      g.fillStyle(PAPER, 1).fillRoundedRect(-w / 2 + 22, y, w - 44, 44, 6);
      p.add(this.add.image(-w / 2 + 44, y + 22, l.parcel ? "parcel" : "envelope").setScale(2));
      p.add(txt(this, -w / 2 + 66, y + 4, `To ${v?.name ?? l.to}`, 18));
      p.add(txt(this, -w / 2 + 66, y + 23, `${b?.label ?? ""}  ·  "${l.title}"`, 14, "#8a6a4a"));
    });
    p.add(txt(this, 0, h / 2 - 30, "TAB / E to close", 16, "#fff4dc").setOrigin(0.5, 0));
    p.setPosition(width / 2, height / 2).setVisible(true);
    this.bagOpen = true;
    sfx.open();
  }

  // ── Title ───────────────────────────────────────────────────
  showTitle(hasSave: boolean, onNew: () => void, onContinue: () => void) {
    this.title?.destroy();
    this.title = this.add.container(0, 0).setDepth(500);
    this.titleActions = hasSave ? [onContinue, onNew] : [onNew];
    this.titleIndex = 0;
    this.registry.set("titleLabels", hasSave ? ["Continue", "New Game"] : ["Start Delivering"]);
    this.drawTitle();
  }

  drawTitle() {
    const c = this.title!;
    c.removeAll(true);
    const { width, height } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(0x0b1530, 0.35).fillRect(0, 0, width, height);
    c.add(g);
    const cx = width / 2, cy = height * 0.36;
    const sub = txt(this, cx, cy - 64, "~ a cozy mail-delivery game ~", 20, "#fff4dc").setOrigin(0.5);
    const t1 = txt(this, cx, cy, "Postal Route", Math.min(84, width / 8), "#ffe8a8", { stroke: "#7a3a1a", strokeThickness: 10, shadow: { offsetX: 0, offsetY: 6, color: "#00000088", blur: 0, fill: true } }).setOrigin(0.5);
    const t2 = txt(this, cx, cy + 58, "✉  Seabreeze Bay  ✉", 28, "#fff4dc", { stroke: "#1d2b3a", strokeThickness: 6 }).setOrigin(0.5);
    this.tweens.add({ targets: t1, y: cy - 6, yoyo: true, repeat: -1, duration: 1600, ease: "Sine.inOut" });
    const pip = this.add.sprite(cx + t1.width / 2 + 44, cy + 34, "penguin", 1).setScale(4).setOrigin(0.5, 1);
    this.tweens.add({ targets: pip, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 500 });
    c.add([sub, t1, t2, pip]);
    const labels: string[] = this.registry.get("titleLabels");
    this.titleChoices = labels.map((l, i) => {
      const b = txt(this, cx, cy + 140 + i * 52, l, 24, INK, { backgroundColor: "#fff4dc", padding: { x: 22, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on("pointerover", () => { this.titleIndex = i; this.paintTitle(); });
      b.on("pointerdown", () => { this.titleIndex = i; this.titleSelect(); });
      c.add(b);
      return b;
    });
    const credit = txt(this, cx, height - 22, "Art: the Tuxemon project & contributors (CC BY-SA) · Arrows/WASD · E · TAB · M map", 15, "#dfe8f0").setOrigin(0.5, 1);
    c.add(credit);
    this.paintTitle();
  }

  paintTitle() {
    this.titleChoices.forEach((b, i) => {
      const on = i === this.titleIndex;
      b.setBackgroundColor(on ? "#ffe066" : "#fff4dc").setScale(on ? 1.06 : 1);
    });
  }

  titleSelect() {
    if (!this.title) return;
    const act = this.titleActions[this.titleIndex];
    sfx.open();
    this.hideTitle();
    act();
  }

  hideTitle() {
    if (!this.title) return;
    const t = this.title;
    this.title = undefined;
    this.titleChoices = [];
    this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() });
  }

  // ── Weather ────────────────────────────────────────────────
  setWeather(w: "sunny" | "breezy" | "rain") {
    this.registry.set("weather", w);
    this.rain?.destroy();
    this.petals?.destroy();
    this.rain = this.petals = undefined;
    const { width, height } = this.scale;
    if (w === "rain") {
      this.rain = this.add.particles(0, -10, "raindrop", {
        x: { min: -100, max: width + 100 }, lifespan: 900, speedY: { min: 520, max: 680 }, speedX: -120,
        scaleY: { min: 2, max: 3.5 }, scaleX: 2, alpha: 0.55, quantity: 4, frequency: 16,
      }).setDepth(50);
    } else if (w === "breezy") {
      this.petals = this.add.particles(-20, 0, "heart", {
        y: { min: 0, max: height }, lifespan: 9000, speedX: { min: 60, max: 120 }, speedY: { min: -15, max: 25 },
        rotate: { min: 0, max: 360 }, scale: { min: 1, max: 1.8 }, alpha: 0.55, frequency: 700, tint: [0xffc0cb, 0xfff4dc, 0xffe066],
      }).setDepth(50);
    }
  }

  // ── Transitions ────────────────────────────────────────────
  fadeDay(text: string, nextDay: number, mid: () => void, end: () => void) {
    const { width, height } = this.scale;
    const r = this.add.rectangle(0, 0, width, height, 0x0b1530, 0).setOrigin(0).setDepth(600);
    const t = txt(this, width / 2, height / 2 - 20, text, 26, "#fff4dc").setOrigin(0.5).setDepth(601).setAlpha(0);
    const d = txt(this, width / 2, height / 2 + 24, `Day ${nextDay}`, 40, "#ffe066").setOrigin(0.5).setDepth(601).setAlpha(0);
    this.tweens.chain({
      tweens: [
        { targets: r, fillAlpha: 1, duration: 800 },
        { targets: t, alpha: 1, duration: 500 },
        { targets: d, alpha: 1, duration: 500, hold: 700, onComplete: () => mid() },
        { targets: [t, d], alpha: 0, duration: 400 },
        { targets: r, fillAlpha: 0, duration: 800 },
      ],
      onComplete: () => { r.destroy(); t.destroy(); d.destroy(); end(); },
    });
  }

  festival(onDone: () => void) {
    const { width, height } = this.scale;
    const layer = this.add.container(0, 0).setDepth(550);
    const r = this.add.rectangle(0, 0, width, height, 0x0b1530, 0).setOrigin(0);
    layer.add(r);
    this.tweens.add({ targets: r, fillAlpha: 0.75, duration: 1200 });
    sfx.unlock();
    const lanterns = this.add.particles(0, height + 20, "lantern", {
      x: { min: 0, max: width }, lifespan: 7000, speedY: { min: -90, max: -50 }, speedX: { min: -12, max: 12 },
      scale: { min: 2, max: 3.5 }, alpha: { start: 1, end: 0.2 }, frequency: 120,
    }).setDepth(551);
    const lines = [
      "✦ Lantern Night ✦",
      "Hundreds of paper lanterns drift up over Seabreeze Bay.",
      "Out on the island, the old lighthouse flickers… and blazes to life.",
      "The Council voted. The Seabreeze Post Office stays open.",
      "Vane watches the lighthouse blink from the pier. He doesn't say anything. He doesn't need to.",
      "On the pier, Granny Marigold and Captain Barnaby share a quiet cup of tea.",
      "Finn wears a tie. Rosa wears a flower crown. Tobi and Shelly count the lanterns (they lose count).",
      "Pip, Rocky and Bzz fall asleep in a heap on your mailbag.",
      "Grandma Marlo would be so proud. Every word that brought them here passed through your hands.",
      "Thank you for delivering. ♥",
    ];
    const t = txt(this, width / 2, height / 2, "", 26, "#fff4dc", { align: "center", wordWrap: { width: Math.min(700, width - 60) }, stroke: "#0b1530", strokeThickness: 6 })
      .setOrigin(0.5).setDepth(552);
    let i = 0;
    const show = () => {
      if (i >= lines.length) {
        this.tweens.add({ targets: [r, t], alpha: 0, duration: 1200, onComplete: () => { layer.destroy(); t.destroy(); lanterns.destroy(); onDone(); } });
        lanterns.stop();
        return;
      }
      t.setText(lines[i]).setAlpha(0).setFontSize(i === 0 ? 46 : 24).setColor(i === 0 ? "#ffe066" : "#fff4dc");
      this.tweens.add({ targets: t, alpha: 1, duration: 600, hold: i === 0 ? 1600 : 2400, yoyo: true, onComplete: () => { i++; show(); } });
      if (i > 0) sfx.blip();
    };
    this.time.delayedCall(800, show);
  }
}
