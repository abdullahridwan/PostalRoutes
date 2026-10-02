import Phaser from "phaser";

export type Dir = "down" | "left" | "right" | "up";
export const DIRS: Record<Dir, { x: number; y: number }> = {
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 },
};
const ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };

export const TILE = 16;

/** Ensure walk animations exist for a 3x4 Tuxemon overworld sheet. */
export function ensureAnims(scene: Phaser.Scene, key: string) {
  for (const dir of Object.keys(ROW) as Dir[]) {
    const name = `${key}-${dir}`;
    if (scene.anims.exists(name)) continue;
    const r = ROW[dir] * 3;
    scene.anims.create({
      key: name,
      frames: [r, r + 1, r + 2, r + 1].map((f) => ({ key, frame: f })),
      frameRate: 8,
      repeat: -1,
    });
  }
}

/** A grid-stepping character (player, villager, monster). */
export class Walker {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  tx: number;
  ty: number;
  facing: Dir = "down";
  moving = false;
  key: string;
  bob = 0; // vertical offset (e.g. hovering bee)

  constructor(public scene: Phaser.Scene, key: string, tx: number, ty: number) {
    this.key = key;
    this.tx = tx;
    this.ty = ty;
    ensureAnims(scene, key);
    this.shadow = scene.add.ellipse(0, 0, 12, 5, 0x000000, 0.22);
    this.sprite = scene.add.sprite(0, 0, key, 1).setOrigin(0.5, 1);
    this.place();
  }

  get px() { return this.tx * TILE + TILE / 2; }
  get py() { return this.ty * TILE + TILE; }

  place() {
    this.sprite.setPosition(this.px, this.py - 1 + this.bob);
    this.shadow.setPosition(this.px, this.py - 2);
    this.syncDepth();
  }

  syncDepth() {
    this.sprite.setDepth(10 + this.sprite.y / TILE);
    this.shadow.setDepth(9);
  }

  setTexture(key: string) {
    if (this.key === key) return;
    this.key = key;
    ensureAnims(this.scene, key);
    this.sprite.setTexture(key);
    this.idle();
  }

  face(dir: Dir) {
    this.facing = dir;
    if (!this.moving) this.idle();
  }

  idle() {
    this.sprite.anims.stop();
    this.sprite.setFrame(ROW[this.facing] * 3 + 1);
  }

  /** Tween one tile in `dir`. Resolves when the step is done. */
  step(dir: Dir, ms: number, onDone?: () => void) {
    this.facing = dir;
    this.moving = true;
    this.tx += DIRS[dir].x;
    this.ty += DIRS[dir].y;
    this.sprite.anims.play(`${this.key}-${dir}`, true);
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.px,
      y: this.py - 1 + this.bob,
      duration: ms,
      onUpdate: () => {
        this.shadow.setPosition(this.sprite.x, this.sprite.y - this.bob - 1);
        this.syncDepth();
      },
      onComplete: () => {
        this.moving = false;
        onDone?.();
      },
    });
  }

  /** Move toward a tile (used by followers), choosing the direction automatically. */
  stepTo(x: number, y: number, ms: number) {
    const dx = x - this.tx, dy = y - this.ty;
    if (dx === 0 && dy === 0) return;
    const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    this.facing = dir;
    this.moving = true;
    this.tx = x;
    this.ty = y;
    this.sprite.anims.play(`${this.key}-${dir}`, true);
    this.scene.tweens.add({
      targets: this.sprite,
      x: this.px,
      y: this.py - 1 + this.bob,
      duration: ms,
      onUpdate: () => {
        this.shadow.setPosition(this.sprite.x, this.sprite.y - this.bob - 1);
        this.syncDepth();
      },
      onComplete: () => { this.moving = false; },
    });
  }

  setVisible(v: boolean) {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
