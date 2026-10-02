import Phaser from "phaser";
import type { Dir } from "../entities/Walker";

const PAD_R = 64;
const DEAD_ZONE = 12;
const FONT = "Inter, system-ui, sans-serif";

type Button = {
  id: "a" | "b" | "run";
  r: number;
  x: number;
  y: number;
  label: string;
  g: Phaser.GameObjects.Graphics;
  t: Phaser.GameObjects.Text;
  pointer: number;
};

/** On-screen D-pad + buttons for phones and tablets. Pure input: the UI scene routes pointers here. */
export class TouchControls {
  enabled = false;
  dir: Dir | null = null;
  run = false;
  showRun = false;
  onA: () => void = () => {};
  onB: () => void = () => {};

  private root: Phaser.GameObjects.Container;
  private pad: Phaser.GameObjects.Graphics;
  private padX = 0;
  private padY = 0;
  private padPointer = -1;
  private buttons: Button[] = [];

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(150).setVisible(false);
    this.pad = scene.add.graphics();
    this.root.add(this.pad);
    const mk = (id: Button["id"], r: number, label: string, size: number): Button => {
      const g = scene.add.graphics();
      const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: "700", color: "#3b2a1a", resolution: Math.max(2, Math.ceil(window.devicePixelRatio || 1)) }).setOrigin(0.5);
      t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add([g, t]);
      return { id, r, x: 0, y: 0, label, g, t, pointer: -1 };
    };
    this.buttons = [mk("a", 40, "A", 26), mk("b", 30, "Bag", 15), mk("run", 28, "Run", 14)];
  }

  layout(width: number, height: number) {
    const m = 22;
    this.padX = m + PAD_R;
    this.padY = height - m - PAD_R;
    const [a, b, run] = this.buttons;
    a.x = width - m - a.r - 6; a.y = height - m - a.r - 34;
    b.x = a.x - a.r - b.r - 18; b.y = height - m - b.r;
    run.x = a.x - 6; run.y = a.y - a.r - run.r - 18;
    this.redraw();
  }

  /** Space the HUD should keep clear at the bottom of the screen. */
  get reservedHeight() {
    return this.enabled ? PAD_R * 2 + 40 : 0;
  }

  setVisible(v: boolean) {
    if (!v && this.root.visible) this.releaseAll();
    this.root.setVisible(v);
    const run = this.buttons[2];
    run.g.setVisible(this.showRun);
    run.t.setVisible(this.showRun);
  }

  down(p: Phaser.Input.Pointer) {
    if (!this.root.visible) return false;
    if (Phaser.Math.Distance.Between(p.x, p.y, this.padX, this.padY) < PAD_R * 1.35) {
      this.padPointer = p.id;
      this.steer(p);
      return true;
    }
    for (const b of this.buttons) {
      if (b.id === "run" && !this.showRun) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, b.x, b.y) < b.r * 1.3) {
        b.pointer = p.id;
        if (b.id === "a") this.onA();
        if (b.id === "b") this.onB();
        if (b.id === "run") this.run = true;
        this.redraw();
        return true;
      }
    }
    return false;
  }

  move(p: Phaser.Input.Pointer) {
    if (p.id === this.padPointer) this.steer(p);
  }

  up(p: Phaser.Input.Pointer) {
    if (p.id === this.padPointer) {
      this.padPointer = -1;
      this.dir = null;
    }
    for (const b of this.buttons) {
      if (b.pointer !== p.id) continue;
      b.pointer = -1;
      if (b.id === "run") this.run = false;
    }
    this.redraw();
  }

  private releaseAll() {
    this.padPointer = -1;
    this.dir = null;
    this.run = false;
    for (const b of this.buttons) b.pointer = -1;
    this.redraw();
  }

  private steer(p: Phaser.Input.Pointer) {
    const dx = p.x - this.padX, dy = p.y - this.padY;
    let dir: Dir | null = null;
    if (Math.hypot(dx, dy) > DEAD_ZONE) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (dir !== this.dir) {
      this.dir = dir;
      this.redraw();
    }
  }

  private redraw() {
    const g = this.pad;
    g.clear();
    g.fillStyle(0x1d2b3a, 0.45).fillCircle(this.padX, this.padY, PAD_R);
    g.lineStyle(3, 0xfff4dc, 0.55).strokeCircle(this.padX, this.padY, PAD_R);
    const arrows: [Dir, number][] = [["up", -Math.PI / 2], ["down", Math.PI / 2], ["left", Math.PI], ["right", 0]];
    for (const [d, ang] of arrows) {
      const on = this.dir === d;
      const cx = this.padX + Math.cos(ang) * PAD_R * 0.6;
      const cy = this.padY + Math.sin(ang) * PAD_R * 0.6;
      const s = on ? 17 : 14;
      const tip = { x: cx + Math.cos(ang) * s, y: cy + Math.sin(ang) * s };
      const l = { x: cx + Math.cos(ang + 2.3) * s, y: cy + Math.sin(ang + 2.3) * s };
      const r = { x: cx + Math.cos(ang - 2.3) * s, y: cy + Math.sin(ang - 2.3) * s };
      g.fillStyle(on ? 0xffe066 : 0xfff4dc, on ? 1 : 0.85).fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
    }
    g.fillStyle(0xfff4dc, 0.25).fillCircle(this.padX, this.padY, 10);

    for (const b of this.buttons) {
      const pressed = b.pointer !== -1;
      b.g.clear();
      b.g.fillStyle(0x000000, 0.25).fillCircle(b.x + 2, b.y + 4, b.r);
      b.g.fillStyle(pressed ? 0xffe066 : 0xfff4dc, pressed ? 1 : 0.9).fillCircle(b.x, b.y + (pressed ? 2 : 0), b.r);
      b.g.lineStyle(3, 0x8a5a3c, 1).strokeCircle(b.x, b.y + (pressed ? 2 : 0), b.r);
      b.t.setPosition(b.x, b.y + (pressed ? 2 : 0));
    }
  }
}
