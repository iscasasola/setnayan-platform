/**
 * 🎭 THE SCENE KIT — what every scene reveal is built from (Beach curtains · Envelope classic + gatefold · Fabric ·
 * Scratch · Smoke · Cathedral doors · Petals · Fireworks). The veil keeps its own engine (`../veil-reveal.tsx`).
 *
 * A port of the approved drawing's shared stage (specs `prototypes/reveals_round3_veil_rules_2026-11-23/src/`
 * `core4.js` + `old.js`): the camera, the lights, the shadow catchers, the hinge spring, the verlet ribbon, the
 * event's logo as a stamp. Timing is NOT here: every reveal is driven by the one lift in `lib/reveal-motion.ts`
 * (`scene-reveal.tsx` runs it). Loaded only inside a reveal's own chunk, never on the page's first load.
 *
 * 💡 THE DRAWING RAN three.js r128; the app runs a current three.js. Two things changed between them and are
 * translated here, once, rather than re-tuned per scene:
 *   · lights: r128's "legacy" light units were π times dimmer than today's physical ones — every light is made
 *     through `light()` below, which multiplies by π (and punctual lights drop their distance decay, as r128's
 *     linear cut-off did over these short distances);
 *   · colour: r128 used hex colours and textures as raw numbers. `scene-reveal.tsx` builds each scene with
 *     `ColorManagement` off and sets each texture's colour space as the drawing did, so a colour means what it
 *     meant on the drawing.
 */
import * as THREE from 'three';
import { buildMarkCanvas } from '@/lib/wax-seal/paint';
import type { WaxSealConfig } from '@/lib/wax-seal/types';

/**
 * r128 → today's bump units. r128 measured a bump against the screen pixel's size in the world; today's three.js
 * normalises it away. On the drawing's phone (5.2 world units over 520 px) one pixel is 0.01, so a drawing's
 * `bumpScale` is multiplied by 100 to press as deep.
 */
export const BUMP = 100;

/** The veil's plane and camera (`veil-reveal.tsx`: `frontZ`, `camZ`, `fov`). */
export const FZ = 0.6;
export const CAMZ = 4.4;
export const FOV = 45;
/** The solid reveals' world: a phone cover H tall at z = 0, filled by a 30° camera (drawing `old.js`). */
export const LEGACY_H = 5.2;
export const LEGACY_FOV = 30;
/** The drawing's phone: 300 × 520. */
export const PHONE_ASPECT = 300 / 520;
/**
 * 🖥 HOW MANY PHONE-WIDTHS THIS SCREEN IS (1 on a phone, ~3.6 on a 1280 × 800 desktop). A reveal never stretches its
 * art to a wide screen (owner 23 Nov: *"all reveal do not stretch … extend it"*): it lays more of it, at the
 * drawing's own size, and multiplies its counts (folds, petals, stars) by this.
 */
export function wideness(px: { w: number; h: number }): number {
  return px.h > 0 ? Math.max(1, px.w / px.h / PHONE_ASPECT) : 1;
}

/**
 * 🖥 LAY AN IMAGE ACROSS A CANVAS AT ITS OWN SIZE — never stretched to the screen (owner 23 Nov: *"all reveal do not
 * stretch"*). One copy is drawn `dw × dh` (its size on the drawing's phone) and repeated every `step`, outward from
 * `anchor` (the centre, or one edge), every other copy mirrored so neighbours meet. On the phone it is the one copy
 * the drawing drew; a wide screen gets more of the art, not wider art.
 */
export function lay(
  x: CanvasRenderingContext2D,
  img: CanvasImageSource,
  crop: [number, number, number, number],
  cw: number,
  box: { dy: number; dw: number; dh: number; step: number; anchor: 'center' | 'left' | 'right' },
): void {
  const [sx, sy, sw, sh] = crop;
  const { dy, dw, dh, step, anchor } = box;
  const x0 = anchor === 'left' ? 0 : anchor === 'right' ? cw - dw : (cw - dw) / 2;
  const n = Math.ceil(cw / step) + 1;
  for (let i = -n; i <= n; i++) {
    const tx = x0 + i * step;
    if (tx >= cw || tx + dw <= 0) continue;
    x.save();
    x.translate(tx, 0);
    if (i % 2 !== 0) {
      x.translate(dw, 0);
      x.scale(-1, 1);
    }
    x.drawImage(img, sx, sy, sw, sh, 0, dy, dw, dh);
    x.restore();
  }
}

export type Pt = { x: number; y: number };
export type SceneState = 'closed' | 'opening' | 'open';

/** The art a scene may ask for — files in `public/reveal/art/` (sample art from the drawing; webp). */
export type ArtName = 'satin' | 'paper' | 'damask' | 'calla' | 'foil' | 'doors' | 'hall' | 'arch' | 'bank' | 'drape' | 'chand';

export type Ctx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Solid reveals: the cover's world size (H fixed, W from the screen's shape) and halves. */
  W: number;
  H: number;
  HW: number;
  HH: number;
  /** Cloth reveals: the half-extents of the veil's plane at FZ. */
  vw: number;
  vh: number;
  /** Screen size in CSS px. */
  px: { w: number; h: number };
  rand: () => number;
  art: (name: ArtName) => Promise<HTMLImageElement>;
  /** The event's logo: 256 px, white, its shape in the alpha. */
  logo: HTMLCanvasElement;
  /** The couple's names as the reveal prints them (e.g. "A & J"). */
  names: string;
  /** The veil's tulle colour (the couple's, else the Mood Board's) — the veil's still face only. */
  veilColor: string;
  /**
   * 🔏 The couple's wax seal (the candle-stamp maker's recipe): its pour shape and press always (a couple who never
   * minted one gets the recipe seeded from their event, as the maker does); its wax `color` only when they MINTED one —
   * else null, and the envelope keeps the drawing's gold.
   */
  seal: { recipe: WaxSealConfig; color: string | null };
  /** Scratch: ask the stage to open (at 60 % rubbed). */
  open: (nx: number, ny: number) => void;
  state: () => SceneState;
  /** Scratch: how much is rubbed, for the hint. */
  progress: (p: number) => void;
};

export type Scene = {
  /** Solid reveals: the drawing's own length in seconds; the lift drives it (tau = lift × T). Cloth reveals: absent. */
  legacyT?: number;
  /** The way the reveal opens, in screen pixels (+y down). Default: up. */
  dir?: readonly [number, number];
  /** No tap opens it (scratch: it opens at 60 % rubbed). */
  noTap?: boolean;
  /** It flies its own camera (the doors' glide) — no shared push-in. */
  ownCam?: boolean;
  /** How far the shared push-in travels (default `REVEAL_MOTION.PUSH`). */
  push?: number;
  /** The cross-fade to the cover once open, ms. */
  fadeMs?: number;
  /** Physical materials: ACES film tone and sRGB output. */
  pbr?: boolean;
  /** sRGB output without film tone. */
  srgb?: boolean;
  exposure?: number;
  /** Where a drag is read (cloth: in front of the cloth). */
  dragZ?: number;
  init: (c: Ctx) => Promise<void> | void;
  /** One frame. `x` is the lift (cloth) or tau in seconds (solid; −1 while closed). */
  step: (dt: number, t: number, x: number, feather: boolean) => void;
  opened?: (wx: number, wy: number, nx: number, ny: number) => void;
  grab?: (id: number, w: Pt, nx: number, ny: number) => void;
  drag?: (id: number, w: Pt, nx: number, ny: number) => void;
  release?: (id: number, nx: number, ny: number) => void;
  /** The hands-free demo (previews): scratch rubs by itself. */
  demo?: () => void;
  dispose?: () => void;
};

/* ── numbers ─────────────────────────────────────────────────────────────── */

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const ease = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
export const noise = (x: number, y: number, tt: number) =>
  Math.sin(x * 1.7 + tt * 1.3) * Math.cos(y * 1.3 - tt * 0.9) + 0.5 * Math.sin(x * 3.1 - tt * 2.1 + y * 2.3);
/** The drawing's seeded random (`RV.rand`), so a reveal looks the same every time it plays. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── canvases and textures ───────────────────────────────────────────────── */

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d')!;
}
/** A texture from a canvas or picture; `srgb` when the drawing marked it so. */
export function texOf(src: HTMLCanvasElement | HTMLImageElement, o: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}): THREE.Texture {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
  t.colorSpace = o.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = o.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

/** Stamp the logo in a colour (drawing `RV.stamp`). */
export function stamp(x: CanvasRenderingContext2D, logo: HTMLCanvasElement, cx: number, cy: number, size: number, color: string, alpha = 1): void {
  const k = canvas(256, 256);
  const kx = ctx2d(k);
  kx.fillStyle = color;
  kx.fillRect(0, 0, 256, 256);
  kx.globalCompositeOperation = 'destination-in';
  kx.drawImage(logo, 0, 0);
  x.globalAlpha = alpha;
  x.drawImage(k, cx - size / 2, cy - size / 2, size, size);
  x.globalAlpha = 1;
}

/* ── lights (r128 units → today's, see the header) ───────────────────────── */

const PI = Math.PI;
export function ambient(c: Ctx, color: number, i: number): THREE.AmbientLight {
  const l = new THREE.AmbientLight(color, i * PI);
  c.scene.add(l);
  return l;
}
export function directional(c: Ctx, color: number, i: number, p: [number, number, number]): THREE.DirectionalLight {
  const l = new THREE.DirectionalLight(color, i * PI);
  l.position.set(...p);
  c.scene.add(l);
  return l;
}
export function point(color: number, i: number, dist: number): THREE.PointLight {
  return new THREE.PointLight(color, i * PI, dist, 0);
}
/** A shadow camera the drawing's way. */
export function castShadows(l: THREE.DirectionalLight, size: number, box: [number, number, number, number], bias: number, radius: number, far = 20): void {
  l.castShadow = true;
  l.shadow.mapSize.set(size, size);
  const sc = l.shadow.camera;
  [sc.left, sc.right, sc.top, sc.bottom] = box;
  sc.near = 1;
  sc.far = far;
  l.shadow.bias = bias;
  l.shadow.radius = radius;
}

/** The veil's own three lights, scaled (`RV.lights(k)`). */
export function veilLights(c: Ctx, k: number): void {
  c.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x1c1610, 0.55 * k * PI));
  /* r128 faded this light linearly to nothing at 40 units: ~0.85 at the cloth, 5.9 units away — today it does not fade. */
  const key = new THREE.SpotLight(0xfff3e0, 2.2 * k * PI * 0.85, 40, Math.PI / 5, 0.7, 0);
  key.position.set(2.8, 3.6, 4.4);
  c.scene.add(key, key.target);
  directional(c, 0xfff0d8, 0.5 * k, [-3, 0.4, 2.0]);
}
/** The solid reveals' lights (`RV.lights(o)`): a warm fill, a shadow-casting key, an optional back light. */
export function solidLights(c: Ctx, o: { amb?: number; key?: number; back?: number; kx?: number; ky?: number; kz?: number }): THREE.DirectionalLight {
  ambient(c, 0xfff4e6, o.amb ?? 0.62);
  const kl = directional(c, 0xffffff, o.key ?? 0.75, [o.kx ?? -2.2, o.ky ?? 3.4, o.kz ?? 6]);
  castShadows(kl, 1024, [-3, 3, 4, -4], -0.0015, 4);
  if (o.back !== 0) directional(c, 0xffe2b8, o.back || 0.35, [1.5, 1, -4]);
  return kl;
}
/** A light that throws shadows only, and a plane that shows only them (the cover is the page behind the canvas). */
export function shadowsOnly(c: Ctx, opacity = 0.3, z = FZ - 0.3): void {
  const l = new THREE.DirectionalLight(0xffffff, 0.001);
  l.position.set(-1.6, 2.6, 5);
  castShadows(l, 1024, [-2.4, 2.4, 2.6, -2.6], -0.002, 5, 14);
  c.scene.add(l);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity }));
  m.position.z = z;
  m.receiveShadow = true;
  c.scene.add(m);
}
/** A shadow catcher the size of the solid world (`RV.shadowPlane`). */
export function shadowPlane(c: Ctx, z = -0.02, opacity = 0.32): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(c.W * 2, c.H * 2), new THREE.ShadowMaterial({ opacity }));
  m.position.z = z;
  m.receiveShadow = true;
  c.scene.add(m);
  return m;
}

/* ── physics pieces ──────────────────────────────────────────────────────── */

/** A damped torsion spring: the angle chases its target with inertia, overshoots a little, settles. */
export class Hinge {
  a = 0;
  v = 0;
  target = 0;
  constructor(
    public k: number,
    public c: number,
  ) {}
  step(dt: number): number {
    this.v += (this.k * (this.target - this.a) - this.c * this.v) * dt;
    this.a += this.v * dt;
    return this.a;
  }
}

/** A verlet chain — the satin ribbon's spine (drawing `old.js` `RV.Strip`). */
export class Strip {
  n: number;
  p: Float32Array;
  q: Float32Array;
  inv: Float32Array;
  rest: Float32Array;
  pin: Record<number, [number, number, number]> = {};
  shape: Float32Array;
  anchor: [number, number, number];
  stiff = 0;
  shrink = 1;
  damp = 0.985;
  fl: number | null = null;
  base: Float32Array | null = null;
  constructor(pts: number[][]) {
    const n = (this.n = pts.length);
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
    this.inv = new Float32Array(n);
    this.rest = new Float32Array(n - 1);
    for (let i = 0; i < n; i++) {
      const pt = pts[i]!;
      this.p[i * 3] = this.q[i * 3] = pt[0]!;
      this.p[i * 3 + 1] = this.q[i * 3 + 1] = pt[1]!;
      this.p[i * 3 + 2] = this.q[i * 3 + 2] = pt[2] ?? 0;
      this.inv[i] = 1;
    }
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      this.rest[i] = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, (b[2] ?? 0) - (a[2] ?? 0));
    }
    this.shape = Float32Array.from(this.p);
    this.anchor = [pts[0]![0]!, pts[0]![1]!, pts[0]![2] ?? 0];
  }
  hold(i: number, x: number, y: number, z = 0): void {
    this.inv[i] = 0;
    this.pin[i] = [x, y, z];
  }
  free(i: number): void {
    this.inv[i] = 1;
    delete this.pin[i];
  }
  scaleRest(base: Float32Array, s: number): void {
    for (let i = 0; i < this.n - 1; i++) this.rest[i] = base[i]! * s;
  }
  step(dt: number, gx: number, gy: number, gz: number, tt: number | null): void {
    const { p, q, n } = this;
    const dt2 = dt * dt;
    const d = this.damp;
    for (let i = 0; i < n; i++) {
      if (!this.inv[i]) continue;
      const k = i * 3;
      const vx = (p[k]! - q[k]!) * d;
      const vy = (p[k + 1]! - q[k + 1]!) * d;
      const vz = (p[k + 2]! - q[k + 2]!) * d;
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      const fl = tt == null ? 0 : noise(p[k]! * 2, p[k + 1]! * 2 + i, tt * 2) * 1.2 * (this.fl ?? 1);
      p[k] = p[k]! + vx + (gx + fl) * dt2;
      p[k + 1] = p[k + 1]! + vy + gy * dt2;
      p[k + 2] = p[k + 2]! + vz + (gz + fl * 0.6) * dt2;
    }
    if (this.stiff > 0) {
      const sh = this.shape;
      const an = this.anchor;
      for (let i = 0; i < n; i++) {
        if (!this.inv[i]) continue;
        const k = i * 3;
        for (let c = 0; c < 3; c++) {
          const target = an[c]! + (sh[k + c]! - an[c]!) * this.shrink;
          p[k + c] = p[k + c]! + (target - p[k + c]!) * this.stiff;
        }
      }
    }
    for (let it = 0; it < 8; it++) {
      for (const key of Object.keys(this.pin)) {
        const i = Number(key);
        const pin = this.pin[i]!;
        p[i * 3] = pin[0];
        p[i * 3 + 1] = pin[1];
        p[i * 3 + 2] = pin[2];
      }
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3;
        const b = a + 3;
        const dx = p[b]! - p[a]!;
        const dy = p[b + 1]! - p[a + 1]!;
        const dz = p[b + 2]! - p[a + 2]!;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const wa = this.inv[i]!;
        const wb = this.inv[i + 1]!;
        const ws = wa + wb;
        if (!ws) continue;
        const f = (len - this.rest[i]!) / len / ws;
        p[a] = p[a]! + dx * f * wa;
        p[a + 1] = p[a + 1]! + dy * f * wa;
        p[a + 2] = p[a + 2]! + dz * f * wa;
        p[b] = p[b]! - dx * f * wb;
        p[b + 1] = p[b + 1]! - dy * f * wb;
        p[b + 2] = p[b + 2]! - dz * f * wb;
      }
    }
  }
}

/* ── the event's logo ────────────────────────────────────────────────────── */

/** The box the logo's ink actually occupies (alpha > 32), or null when the canvas is empty. */
export function alphaBox(c: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const d = ctx2d(c).getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3]! <= 32) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The event's own logo as a white shape (drawing `RV.logo`, there the cale-ice monogram): the couple's mark when they
 * have one, else their initials lettered in a serif. Never throws: a mark that will not draw falls back to the letters.
 *
 * 🔏 The mark is read by the candle-stamp maker's own die reader (`buildMarkCanvas`, lib/wax-seal/paint.ts): a vector
 * mark by its shape, an uploaded picture by its dark ink — so a logo on a white ground presses as the logo, never as a
 * solid square. Then it is FITTED: cropped to its own ink and scaled to fill the 256 square for its shape, so a wide
 * or a tall logo is as large as a square one (owner 23 Nov: *"Seal needs to adapt to logo"*).
 */
export async function logoMask(markSvg: string | null | undefined, letters: string): Promise<HTMLCanvasElement> {
  const k = canvas(256, 256);
  const x = ctx2d(k);
  let die: HTMLCanvasElement | null = null;
  try {
    die = markSvg ? await buildMarkCanvas(markSvg, 512) : null;
  } catch {
    die = null;
  }
  if (!die) {
    die = canvas(512, 512);
    const t = ctx2d(die);
    t.fillStyle = '#ffffff';
    t.textAlign = 'center';
    t.textBaseline = 'middle';
    const word = (letters || '✦').trim();
    t.font = `italic 600 ${word.length > 3 ? 184 : 300}px Georgia, 'Times New Roman', serif`;
    t.fillText(word, 256, 268, 472);
  }
  const box = alphaBox(die);
  if (!box) return k;
  const s = 236 / Math.max(box.w, box.h);
  const w = box.w * s;
  const h = box.h * s;
  x.drawImage(die, box.x, box.y, box.w, box.h, 128 - w / 2, 128 - h / 2, w, h);
  return k;
}

/** Free everything a scene put on the GPU. */
export function disposeScene(scene: THREE.Scene): void {
  const seen = new Set<unknown>();
  const freeTex = (m: THREE.Material) => {
    for (const v of Object.values(m as unknown as Record<string, unknown>)) {
      if (v instanceof THREE.Texture && !seen.has(v)) {
        seen.add(v);
        v.dispose();
      }
    }
  };
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !seen.has(mesh.geometry)) {
      seen.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      freeTex(m);
      m.dispose();
    }
  });
  if (scene.environment && !seen.has(scene.environment)) scene.environment.dispose();
}
