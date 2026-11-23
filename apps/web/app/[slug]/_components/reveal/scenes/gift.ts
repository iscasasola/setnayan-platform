/**
 * 🎁 THE GIFT BOX — the tenth reveal (owner 23 Nov 2026, DECISION_LOG "ten reveals approved"; drawing v25
 * `src/gift3.js`, artifact U4pTTfGDn6TBxA3PixFPLq). A real box on a floor, seen from above and in front: a wrapped base
 * and a wrapped lid (paper with fibre, the event's monogram in gold foil, the folded end, mitred corners), a satin
 * ribbon in four arms from a bow. The bow comes undone, the four arms open outward like a flower and settle on the
 * ground (the ribbon never goes under the box: it is solid), the lid lifts with its weight, light comes up from inside
 * and the camera swings over the box and down onto the card — the Event Hub itself, seen through it.
 *
 * v25 (owner, relayed: *"around the box flowers, rose petals, must be moving via breeze · Pearls and diamonds golden
 * stars need to sparkle · Gift Box needs better lighting … the most realistic look"* · *"floor can be cotton/clouds,
 * egyptian cotton"* · *"ribbons should move with the soft breeze … like veil and curtains"*):
 *   · the breeze is a FORCE on the loose ribbon (`Band.step`), never a drawn wiggle; petals, blooms and leaves sway on
 *     the motion standard's 1.4 s loop and its multiples; about one petal in nine drifts where it cannot reach the box;
 *   · four-point glints on diamonds and gold stars come and go in a wave every 5.6 s (rise ~0.3 s, fall ~0.7 s, never a
 *     strobe); a small light travels slowly for the sheen on pearls, satin and foil;
 *   · photographic light: a key up-left of the lid, a cool fill, a warm rim, a contact shadow and a tight occlusion line,
 *     the inside's glow spilling onto lid, rims and ground; a post pass adds a slight depth of field on the ground, a
 *     light film curve and grain (`render`);
 *   · the couple picks the lining (6), the floor (9, the three cotton ones shaped so the box sits sunk a little) and what
 *     lies around the box (8) — `REVEAL_LOOK_OPTIONS`.
 * ♿ Reduced motion: everything holds still (no breeze, no travelling light, the glints fixed), and the tap cross-fades.
 *
 * The drawing ran three.js r128 (see `kit.ts`): lights are ×π, and r128's linear fall-off is taken at the box.
 */
import * as THREE from 'three';
import type { RevealLooksFull } from '@/lib/std-reveal-effects';
import { canvas, clamp, ctx2d, ease, halfFloatTargets, noise, room, satinTex, stamp, texOf, type Ctx, type Scene } from './kit';

const PI = Math.PI;
const TILE = 0.86;
const R15 = Math.tan((15 * PI) / 180);
const T = 9.0;

/* r128's light fall-off, taken at the box (distance/decay → one factor, see the header) */
const KEY = 3.9 * PI * 0.745;
const LAMP = 2.4 * PI * 0.85;
const SPILL = 1.25 * PI * 0.66;
const SPARK = 0.55 * PI * 0.45;

/** Colours are written as seen; the scene works in linear light (drawing `seen`). */
const seen = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();
const hash = (i: number, j: number) => {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/** A normal map from a height canvas (its light and dark become relief), wrapping. */
function normals(src: HTMLCanvasElement, k: number): THREE.Texture {
  const w = src.width;
  const h = src.height;
  const p = ctx2d(src).getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = p[i * 4]! / 255;
  const c = canvas(w, h);
  const cx = ctx2d(c);
  const o = cx.createImageData(w, h);
  const q = o.data;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const l = g[j * w + ((i + w - 1) % w)]!;
      const r = g[j * w + ((i + 1) % w)]!;
      const u = g[((j + h - 1) % h) * w + i]!;
      const dn = g[((j + 1) % h) * w + i]!;
      const nx = (l - r) * k;
      const ny = (dn - u) * k;
      const nl = Math.sqrt(nx * nx + ny * ny + 1);
      const a = (j * w + i) * 4;
      q[a] = ((nx / nl) * 0.5 + 0.5) * 255;
      q[a + 1] = ((ny / nl) * 0.5 + 0.5) * 255;
      q[a + 2] = ((1 / nl) * 0.5 + 0.5) * 255;
      q[a + 3] = 255;
    }
  cx.putImageData(o, 0, 0);
  return texOf(c, { repeat: true });
}

/* the drawing's defaults for what the couple does not pick (v20–v25): emerald paper, the monogram in foil, champagne
   satin, a classic bow */
const WRAP = '#1d4739';
const RIB: readonly [string, string, string] = ['#8d7446', '#c9b07c', '#e9d6aa'];

/** The wrapping paper: deep stock with fibre in it, the event's monogram printed in gold foil in a half-drop. */
function paperMaterial(c: Ctx): THREE.MeshStandardMaterial {
  const S = 512;
  const col = canvas(S, S);
  const x = ctx2d(col);
  const mr = canvas(S, S);
  const m = ctx2d(mr);
  const hg = canvas(S, S);
  const h = ctx2d(hg);
  x.fillStyle = WRAP;
  x.fillRect(0, 0, S, S);
  m.fillStyle = 'rgb(0,168,0)';
  m.fillRect(0, 0, S, S);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const px = c.rand() * S;
    const py = c.rand() * S;
    const len = 3 + c.rand() * 9;
    const an = c.rand() * 6.283;
    const li = c.rand() > 0.5;
    x.strokeStyle = li ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';
    x.lineWidth = 0.7;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(an) * len, py + Math.sin(an) * len);
    x.stroke();
    h.strokeStyle = li ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';
    h.lineWidth = 0.8;
    h.beginPath();
    h.moveTo(px, py);
    h.lineTo(px + Math.cos(an) * len, py + Math.sin(an) * len);
    h.stroke();
  }
  /* the monogram in foil, and the gold dots of the half-drop between */
  for (const [cx0, cy0] of [
    [128, 128],
    [384, 384],
  ] as const) {
    stamp(x, c.logo, cx0, cy0, 150, '#d9b566', 1);
    stamp(m, c.logo, cx0, cy0, 150, 'rgb(0,74,255)', 1);
    stamp(h, c.logo, cx0, cy0, 150, '#b4b4b4', 1);
  }
  for (const [cx0, cy0] of [
    [384, 128],
    [128, 384],
    [0, 0],
    [256, 256],
    [0, 256],
    [256, 0],
  ] as const)
    for (const [ox, oy] of [
      [0, 0],
      [S, 0],
      [0, S],
      [S, S],
    ] as const)
      [x, m, h].forEach((k, n) => {
        k.fillStyle = n === 0 ? '#d9b566' : n === 1 ? 'rgb(0,74,255)' : '#b4b4b4';
        k.beginPath();
        k.arc(cx0 + ox, cy0 + oy, cx0 % 256 === 0 ? 3.2 : 5, 0, 7);
        k.fill();
      });
  const map = texOf(col, { srgb: true, repeat: true, aniso: 8 });
  const rm = texOf(mr, { repeat: true, aniso: 8 });
  const nm = normals(hg, 2.2);
  nm.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughnessMap: rm, metalnessMap: rm, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 1, metalness: 1, envMapIntensity: 0.4, side: THREE.DoubleSide });
}

function satinMaterial(c: Ctx): THREE.MeshStandardMaterial {
  const t = satinTex(RIB[0], RIB[1], RIB[2]);
  t.repeat.set(1, 9);
  const hc = canvas(128, 128);
  const hx = ctx2d(hc);
  hx.fillStyle = '#808080';
  hx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i++) {
    hx.fillStyle = `rgba(${c.rand() > 0.5 ? '255,255,255,' : '0,0,0,'}${(0.05 + c.rand() * 0.2).toFixed(3)})`;
    hx.fillRect(i, 0, 1, 128);
  }
  for (let i = 0; i < 128; i += 2) {
    hx.fillStyle = 'rgba(0,0,0,.06)';
    hx.fillRect(0, i, 128, 1);
  }
  const nm = normals(hc, 1.3);
  nm.repeat.set(1, 9);
  return new THREE.MeshStandardMaterial({ map: t, normalMap: nm, normalScale: new THREE.Vector2(0.55, 0.2), side: THREE.DoubleSide, roughness: 0.27, metalness: 0.18, envMapIntensity: 1.45 });
}

type Dir = 'y-' | 'y+' | 'x+' | 'x-' | 'z-';
/** A flat piece of paper, its print at the same scale on every face. */
function sheet(w: number, h: number, sx = 1, sy = 1, ou = 0, ov = 0, turn = false): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h, sx, sy);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / TILE + ou;
    const b = p.getY(i) / TILE + ov;
    uv.setXY(i, turn ? b : a, turn ? -a : b);
  }
  return g;
}
function aim<G extends THREE.BufferGeometry>(g: G, dir: Dir): G {
  if (dir === 'y-') g.rotateX(PI / 2);
  else if (dir === 'y+') g.rotateX(-PI / 2);
  else if (dir === 'x+') g.rotateY(PI / 2);
  else if (dir === 'x-') g.rotateY(-PI / 2);
  else g.rotateX(PI);
  return g;
}
function put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** The air a scene's ribbons feel: the breeze's strength this frame (0 under reduced motion). */
type Air = { gust: number };
type Box = { x: number; y: number; z: number; z0?: number };
type BandOpts = { M?: number; sub?: number; n0?: number[]; twist?: (s: number, t: number) => number; camber?: number; damp?: number; col?: Box[]; fz?: ((x: number, y: number) => number) | null; r?: number };

/**
 * A BAND of ribbon (drawing `Band`): a chain with weight that lies on whatever is under it (the lid, the box's sides,
 * the ground), drawn as a strip with real width. Its facing is carried along its length, so it turns the corner of the
 * box as ribbon does. It is drawn finer than it is simulated (SB rows per link), and every drawn vertex is kept OUT of
 * the box and off the floor: the box is solid, so no edge of the ribbon can cut into a face or pass under it.
 */
class Band {
  n: number;
  M: number;
  SB: number;
  rows: number;
  p: Float32Array;
  q: Float32Array;
  inv: Float32Array;
  rest: Float32Array;
  base: Float32Array;
  shape: Float32Array;
  pos: Float32Array;
  fr: Float32Array;
  pin: Record<number, [number, number, number]> = {};
  w: number;
  nrm: number[];
  twist: ((s: number, t: number) => number) | null;
  camber: number;
  damp: number;
  col: Box[] | null;
  fz: ((x: number, y: number) => number) | null;
  r: number;
  fl = 0;
  stiff = 0;
  shrink = 1;
  /** the breeze on it: how hard (`wind`), from the tip (`wtip`) or the middle, and how much it lifts (`wlift`) */
  wind = 0;
  wtip = false;
  wlift = 0;
  geo = new THREE.BufferGeometry();
  mesh: THREE.Mesh;
  /* the arms' own bookkeeping */
  e = 0;
  L = 0;
  d: readonly [number, number] = [0, 0];
  a = 0;
  zz = 0;
  t0 = 0;
  landed = false;
  constructor(
    pts: number[][],
    width: number,
    mat: THREE.Material,
    private air: Air,
    o: BandOpts = {},
  ) {
    const n = (this.n = pts.length);
    const M = (this.M = o.M ?? 4);
    const SB = (this.SB = o.sub ?? 3);
    const rows = (this.rows = (n - 1) * SB + 1);
    const idx: number[] = [];
    const uv = new Float32Array(rows * (M + 1) * 2);
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
    this.inv = new Float32Array(n);
    this.rest = new Float32Array(n - 1);
    this.w = width;
    this.nrm = (o.n0 ?? [0, 0, 1]).slice();
    this.twist = o.twist ?? null;
    this.camber = o.camber ?? 0.008;
    this.damp = o.damp ?? 0.972;
    this.col = o.col ?? null;
    this.fz = o.fz ?? null;
    this.r = o.r ?? 0.016;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 3; j++) this.p[i * 3 + j] = this.q[i * 3 + j] = pts[i]![j]!;
      this.inv[i] = 1;
    }
    for (let i = 0; i < n - 1; i++) this.rest[i] = Math.hypot(pts[i + 1]![0]! - pts[i]![0]!, pts[i + 1]![1]! - pts[i]![1]!, pts[i + 1]![2]! - pts[i]![2]!);
    this.base = Float32Array.from(this.rest);
    this.shape = Float32Array.from(this.p);
    this.pos = new Float32Array(rows * (M + 1) * 3);
    this.fr = new Float32Array(n * 6);
    for (let i = 0; i < rows; i++)
      for (let j = 0; j <= M; j++) {
        uv[(i * (M + 1) + j) * 2] = j / M;
        uv[(i * (M + 1) + j) * 2 + 1] = i / (rows - 1);
        if (i < rows - 1 && j < M) {
          const a = i * (M + 1) + j;
          idx.push(a, a + 1, a + M + 1, a + 1, a + M + 2, a + M + 1);
        }
      }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.update(0);
  }
  hold(i: number, x: number, y: number, z: number): void {
    this.inv[i] = 0;
    this.pin[i] = [x, y, z];
  }
  free(i: number): void {
    this.inv[i] = 1;
    delete this.pin[i];
  }
  scaleRest(s: number): void {
    for (let i = 0; i < this.n - 1; i++) this.rest[i] = this.base[i]! * s;
  }
  step(dt: number, g: number, t: number): void {
    const { p, q, n, damp: d, r, col: c } = this;
    const dt2 = dt * dt;
    const G = this.air.gust;
    for (let i = 0; i < n; i++) {
      if (!this.inv[i]) continue;
      const k = i * 3;
      const vx = (p[k]! - q[k]!) * d;
      const vy = (p[k + 1]! - q[k + 1]!) * d;
      const vz = (p[k + 2]! - q[k + 2]!) * d;
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      const f = this.fl ? noise(p[k]! * 2, p[k + 1]! * 2 + i, t * 2) * this.fl : 0;
      let wx = 0;
      let wy = 0;
      let wz = 0;
      if (this.wind && G) {
        /* the breeze: a force on the loose cloth, never a drawn wiggle */
        const pr = this.wtip ? Math.pow(i / (n - 1), 1.6) : Math.sin((PI * i) / (n - 1));
        const g1 = noise(p[k]! * 0.8 + 3, p[k + 1]! * 0.8, t * 0.75);
        const g2 = noise(p[k + 1]! * 1.1 + 7, p[k]! * 0.7, t * 0.6);
        const wv = this.wind * pr * G;
        wx = (0.35 + g1) * wv * 2.6;
        wy = g2 * wv * 1.5;
        wz = Math.max(0, 0.25 + g1 * g2) * wv * this.wlift;
      }
      p[k] = p[k]! + vx + (f + wx) * dt2;
      p[k + 1] = p[k + 1]! + vy + (f * 0.6 + wy) * dt2;
      p[k + 2] = p[k + 2]! + vz + (g + wz) * dt2;
    }
    if (this.stiff) {
      const sh = this.shape;
      const sk = this.shrink;
      for (let i = 0; i < n; i++) {
        if (!this.inv[i]) continue;
        const k = i * 3;
        for (let cc = 0; cc < 3; cc++) p[k + cc] = p[k + cc]! + (sh[cc]! + (sh[k + cc]! - sh[cc]!) * sk - p[k + cc]!) * this.stiff;
      }
    }
    for (let it = 0; it < 10; it++) {
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
        const e = (len - this.rest[i]!) / len / ws;
        p[a] = p[a]! + dx * e * wa;
        p[a + 1] = p[a + 1]! + dy * e * wa;
        p[a + 2] = p[a + 2]! + dz * e * wa;
        p[b] = p[b]! - dx * e * wb;
        p[b + 1] = p[b + 1]! - dy * e * wb;
        p[b + 2] = p[b + 2]! - dz * e * wb;
      }
      for (let i = 0; i < n; i++) {
        if (!this.inv[i]) continue;
        const k = i * 3;
        let hit = false;
        if (c)
          for (const B of c) {
            const ax = Math.abs(p[k]!) - B.x - r;
            const ay = Math.abs(p[k + 1]!) - B.y - r;
            const az = p[k + 2]! - B.z - r;
            const ab = B.z0 == null ? -9 : B.z0 - r - p[k + 2]!;
            if (ax < 0 && ay < 0 && az < 0 && ab < 0) {
              hit = true;
              const mx = Math.max(ax, ay, az, ab);
              if (mx === az) p[k + 2] = B.z + r;
              else if (mx === ab) p[k + 2] = B.z0! - r;
              else if (mx === ax) p[k] = (p[k]! < 0 ? -1 : 1) * (B.x + r);
              else p[k + 1] = (p[k + 1]! < 0 ? -1 : 1) * (B.y + r);
            }
          }
        const fz = this.fz ? this.fz(p[k]!, p[k + 1]!) : 0;
        if (p[k + 2]! < fz + r) {
          p[k + 2] = fz + r;
          hit = true;
        }
        /* it drags a little on what it lies on */
        if (hit && it === 9) {
          q[k] = q[k]! + (p[k]! - q[k]!) * 0.22;
          q[k + 1] = q[k + 1]! + (p[k + 1]! - q[k + 1]!) * 0.22;
          q[k + 2] = p[k + 2]!;
        }
      }
    }
  }
  update(t: number): void {
    const { p, n, M, SB, pos: v, fr: F, camber: cb, col: c } = this;
    const hw = this.w / 2;
    const N = this.nrm;
    let nx = N[0]!;
    let ny = N[1]!;
    let nz = N[2]!;
    const E = 0.014;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1) * 3;
      const b = Math.min(n - 1, i + 1) * 3;
      let tx = p[b]! - p[a]!;
      let ty = p[b + 1]! - p[a + 1]!;
      let tz = p[b + 2]! - p[a + 2]!;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-6;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const d = nx * tx + ny * ty + nz * tz;
      const mx = nx - tx * d;
      const my = ny - ty * d;
      const mz = nz - tz * d;
      const ml = Math.sqrt(mx * mx + my * my + mz * mz);
      if (ml > 1e-4) {
        nx = mx / ml;
        ny = my / ml;
        nz = mz / ml;
      }
      if (i === 0) {
        N[0] = nx;
        N[1] = ny;
        N[2] = nz;
      }
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      const ph = this.twist ? this.twist(i / (n - 1), t) : 0;
      const cs = Math.cos(ph);
      const sn = Math.sin(ph);
      const f = i * 6;
      F[f] = bx * cs + nx * sn;
      F[f + 1] = by * cs + ny * sn;
      F[f + 2] = bz * cs + nz * sn;
      F[f + 3] = nx * cs - bx * sn;
      F[f + 4] = ny * cs - by * sn;
      F[f + 5] = nz * cs - bz * sn;
    }
    for (let rw = 0; rw < this.rows; rw++) {
      const i0 = Math.min(n - 2, Math.floor(rw / SB));
      const fq = rw / SB - i0;
      const k0 = i0 * 3;
      const k1 = k0 + 3;
      const f0 = i0 * 6;
      const f1 = f0 + 6;
      const g = 1 - fq;
      const px = p[k0]! * g + p[k1]! * fq;
      const py = p[k0 + 1]! * g + p[k1 + 1]! * fq;
      const pz = p[k0 + 2]! * g + p[k1 + 2]! * fq;
      let wx = F[f0]! * g + F[f1]! * fq;
      let wy = F[f0 + 1]! * g + F[f1 + 1]! * fq;
      let wz = F[f0 + 2]! * g + F[f1 + 2]! * fq;
      const wl = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
      wx /= wl;
      wy /= wl;
      wz /= wl;
      const ux = F[f0 + 3]! * g + F[f1 + 3]! * fq;
      const uy = F[f0 + 4]! * g + F[f1 + 4]! * fq;
      const uz = F[f0 + 5]! * g + F[f1 + 5]! * fq;
      for (let j = 0; j <= M; j++) {
        const u = (j / M) * 2 - 1;
        const o = (rw * (M + 1) + j) * 3;
        const cu = cb * (1 - u * u);
        let X = px + wx * u * hw + ux * cu;
        let Y = py + wy * u * hw + uy * cu;
        let Z = pz + wz * u * hw + uz * cu;
        if (c) {
          for (const B of c) {
            const ax = Math.abs(X) - B.x - E;
            const ay = Math.abs(Y) - B.y - E;
            const az = Z - B.z - E;
            const ab = B.z0 == null ? -9 : B.z0 - E - Z;
            if (ax < 0 && ay < 0 && az < 0 && ab < 0) {
              const mx = Math.max(ax, ay, az, ab);
              if (mx === az) Z = B.z + E;
              else if (mx === ab) Z = B.z0! - E;
              else if (mx === ax) X = (X < 0 ? -1 : 1) * (B.x + E);
              else Y = (Y < 0 ? -1 : 1) * (B.y + E);
            }
          }
          const fz2 = this.fz ? this.fz(X, Y) : 0;
          if (Z < fz2 + 0.006) Z = fz2 + 0.006;
        }
        v[o] = X;
        v[o + 1] = Y;
        v[o + 2] = Z;
      }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

function path(corners: number[][], ds: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i]!;
    const b = corners[i + 1]!;
    const l = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!);
    const m = Math.max(1, Math.round(l / ds));
    for (let j = i ? 1 : 0; j <= m; j++) out.push([a[0]! + ((b[0]! - a[0]!) * j) / m, a[1]! + ((b[1]! - a[1]!) * j) / m, a[2]! + ((b[2]! - a[2]!) * j) / m]);
  }
  return out;
}

/* ── the floor the box stands on (drawing v21–v25 `floor`) ───────────────────────────────────────────────────────── */

type Floor = { map: HTMLCanvasElement; height: HTMLCanvasElement; rep: number; ns: number; rough: number; env: number; HF: ((x: number, y: number) => number) | null };

/** Every floor is drawn here in code (no photographs), and every one sits under the same single pool of light. */
function floorOf(c: Ctx, fk: RevealLooksFull['floor'], BX: number, BY: number): Floor {
  const lc = canvas(512, 512);
  const lx = ctx2d(lc);
  const lh = canvas(512, 512);
  const lhx = ctx2d(lh);
  let FL = { rep: 30, ns: 0.3, rough: 0.93, env: 0.06 };
  let HF: Floor['HF'] = null;
  const R = c.rand;
  lhx.fillStyle = '#808080';
  lhx.fillRect(0, 0, 512, 512);
  const weave = (base: string, dark: string, light: string, kd: number, kl: number) => {
    lx.fillStyle = base;
    lx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 128; i++) {
      const la = 0.03 + R() * 0.09;
      const lb = 0.03 + R() * 0.09;
      const ld = R() > 0.5;
      lx.fillStyle = ld ? `rgba(${dark},${la * kd})` : `rgba(${light},${la * kl})`;
      lx.fillRect(0, i * 4, 512, 2);
      lx.fillStyle = R() > 0.5 ? `rgba(${dark},${lb * kd})` : `rgba(${light},${lb * kl})`;
      lx.fillRect(i * 4, 0, 2, 512);
      lhx.fillStyle = `rgba(255,255,255,${la * 2.2})`;
      lhx.fillRect(0, i * 4, 512, 2);
      lhx.fillStyle = `rgba(0,0,0,${lb * 2.2})`;
      lhx.fillRect(i * 4 + 2, 0, 2, 512);
    }
  };
  const speck = (nn: number, dark: string, light: string, a: number) => {
    for (let i = 0; i < nn; i++) {
      const sx = R() * 512;
      const sy = R() * 512;
      const li = R() > 0.5;
      lx.fillStyle = `rgba(${li ? light : dark},${a * (0.4 + R() * 0.6)})`;
      lx.fillRect(sx, sy, 1.3, 1.3);
      lhx.fillStyle = li ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)';
      lhx.fillRect(sx, sy, 1.3, 1.3);
    }
  };
  /** how far a point on the floor is from the box's foot */
  const off = (x: number, y: number) => Math.hypot(Math.max(0, Math.abs(x) - BX), Math.max(0, Math.abs(y) - BY));
  const WRAP5 = [
    [0, 0],
    [512, 0],
    [-512, 0],
    [0, 512],
    [0, -512],
  ] as const;
  if (fk === 'linen') {
    weave('#e6dcc8', '120,96,60', '255,252,244', 1, 1);
    FL = { rep: 30, ns: 0.3, rough: 0.93, env: 0.1 };
  } else if (fk === 'wood') {
    for (let i = 0; i < 4; i++) {
      const tone = [
        [108, 66, 38],
        [96, 58, 33],
        [116, 72, 42],
        [101, 62, 36],
      ][i]!;
      lx.fillStyle = `rgb(${tone.join(',')})`;
      lx.fillRect(i * 128, 0, 128, 512);
      for (let j = 0; j < 70; j++) {
        const gx0 = i * 128 + 3 + R() * 122;
        const ga = 0.05 + R() * 0.16;
        const dk = R() > 0.35;
        const wob = 1 + R() * 3;
        const phs = R() * 6.28;
        lx.strokeStyle = dk ? `rgba(40,20,8,${ga})` : `rgba(214,160,104,${ga * 0.7})`;
        lx.lineWidth = 0.6 + R() * 1.4;
        lx.beginPath();
        lhx.strokeStyle = dk ? `rgba(0,0,0,${ga})` : `rgba(255,255,255,${ga * 0.6})`;
        lhx.lineWidth = lx.lineWidth;
        lhx.beginPath();
        for (let yy = 0; yy <= 512; yy += 16) {
          const gxx = Math.min(i * 128 + 126, Math.max(i * 128 + 2, gx0 + Math.sin((yy / 512) * 6.283 * 2 + phs) * wob));
          if (yy) {
            lx.lineTo(gxx, yy);
            lhx.lineTo(gxx, yy);
          } else {
            lx.moveTo(gxx, yy);
            lhx.moveTo(gxx, yy);
          }
        }
        lx.stroke();
        lhx.stroke();
      }
      lx.fillStyle = 'rgba(24,12,4,.75)';
      lx.fillRect(i * 128, 0, 1.6, 512);
      lhx.fillStyle = '#000';
      lhx.fillRect(i * 128, 0, 2.5, 512);
    }
    FL = { rep: 12, ns: 0.55, rough: 0.5, env: 0.32 };
  } else if (fk === 'marble') {
    lx.fillStyle = '#dedad1';
    lx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26; i++) {
      const bx0 = R() * 512;
      const by0 = R() * 512;
      const br = 60 + R() * 120;
      for (const [ox, oy] of WRAP5) {
        const rg = lx.createRadialGradient(bx0 + ox, by0 + oy, 0, bx0 + ox, by0 + oy, br);
        rg.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(120,114,108,.3)');
        rg.addColorStop(1, 'rgba(200,196,188,0)');
        lx.fillStyle = rg;
        lx.fillRect(0, 0, 512, 512);
      }
    }
    lx.filter = 'blur(1.2px)';
    for (let i = 0; i < 22; i++) {
      let vx0 = R() * 512;
      let vy0 = R() * 512;
      let van = R() * 6.283;
      const vpts: [number, number][] = [[vx0, vy0]];
      const gold = i % 5 === 0;
      for (let j = 0; j < 26; j++) {
        van += (R() - 0.5) * 0.9;
        vx0 += Math.cos(van) * 24;
        vy0 += Math.sin(van) * 24;
        vpts.push([vx0, vy0]);
      }
      for (const [ox, oy] of WRAP5) {
        lx.strokeStyle = gold ? 'rgba(168,128,62,.8)' : `rgba(70,68,70,${0.4 + R() * 0.4})`;
        lx.lineWidth = 0.8 + R() * 3.4;
        lx.beginPath();
        vpts.forEach((q, n) => (n ? lx.lineTo(q[0] + ox, q[1] + oy) : lx.moveTo(q[0] + ox, q[1] + oy)));
        lx.stroke();
      }
    }
    lx.filter = 'none';
    FL = { rep: 7, ns: 0.05, rough: 0.2, env: 0.6 };
  } else if (fk === 'stone') {
    lx.fillStyle = '#6f6b66';
    lx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
      const qx = R() * 512;
      const qy = R() * 512;
      const qr = 30 + R() * 90;
      const qg = lx.createRadialGradient(qx, qy, 0, qx, qy, qr);
      qg.addColorStop(0, i % 2 ? 'rgba(170,165,156,.3)' : 'rgba(92,88,84,.26)');
      qg.addColorStop(1, 'rgba(130,126,120,0)');
      lx.fillStyle = qg;
      lx.fillRect(qx - qr, qy - qr, qr * 2, qr * 2);
    }
    speck(9000, '50,48,46', '214,210,202', 0.5);
    FL = { rep: 7, ns: 0.5, rough: 0.8, env: 0.14 };
  } else if (fk === 'sand') {
    const sd = lx.createImageData(512, 512);
    const hd = lhx.createImageData(512, 512);
    for (let sy = 0; sy < 512; sy++)
      for (let sx = 0; sx < 512; sx++) {
        const rp = Math.sin((sy / 64 + 0.22 * Math.sin((sx / 512) * 6.283) + 0.08 * Math.sin((sx / 512) * 6.283 * 3 + 1)) * 6.283);
        const gr = hash(sx, sy) - 0.5;
        const a4 = (sy * 512 + sx) * 4;
        const sh = 1 + rp * 0.13 + gr * 0.1;
        sd.data[a4] = 218 * sh;
        sd.data[a4 + 1] = 196 * sh;
        sd.data[a4 + 2] = 160 * sh;
        sd.data[a4 + 3] = 255;
        const hv = 128 + rp * 110 + gr * 30;
        hd.data[a4] = hd.data[a4 + 1] = hd.data[a4 + 2] = hv;
        hd.data[a4 + 3] = 255;
      }
    lx.putImageData(sd, 0, 0);
    lhx.putImageData(hd, 0, 0);
    FL = { rep: 6, ns: 1.6, rough: 1, env: 0.04 };
  } else if (fk === 'clouds' || fk === 'clouds_ivory') {
    /* cotton in soft billows: the box sits in it as if on clouds, sunk a little */
    lx.fillStyle = fk === 'clouds' ? '#d9d7d2' : '#d8cab2';
    lx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      const wx0 = R() * 512;
      const wy0 = R() * 512;
      const wr = 26 + R() * 80;
      const wg = lx.createRadialGradient(wx0, wy0, 0, wx0, wy0, wr);
      wg.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(120,116,110,.16)');
      wg.addColorStop(1, 'rgba(240,238,232,0)');
      lx.fillStyle = wg;
      lx.fillRect(wx0 - wr, wy0 - wr, wr * 2, wr * 2);
      const hg = lhx.createRadialGradient(wx0, wy0, 0, wx0, wy0, wr);
      hg.addColorStop(0, i % 2 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.2)');
      hg.addColorStop(1, 'rgba(128,128,128,0)');
      lhx.fillStyle = hg;
      lhx.fillRect(wx0 - wr, wy0 - wr, wr * 2, wr * 2);
    }
    speck(7000, '170,162,150', '255,255,255', 0.3);
    FL = { rep: 7, ns: 0.8, rough: 1, env: 0.05 };
    HF = (x, y) => {
      const d = off(x, y);
      if (d <= 0) return 0;
      let e1 = Math.min(1, d / 0.14);
      let e2 = Math.min(1, Math.max(0, (d - 0.08) / 1.1));
      e1 = e1 * e1 * (3 - 2 * e1);
      e2 = e2 * e2 * (3 - 2 * e2);
      return (
        0.06 * e1 +
        e2 *
          (0.4 * Math.abs(Math.sin(x * 1.7 + Math.sin(y * 1.3))) * Math.abs(Math.sin(y * 1.5 + Math.sin(x * 1.1) + 1)) +
            0.13 * Math.abs(Math.sin(x * 3.9 + y * 1.3)) * Math.abs(Math.sin(y * 4.3 - x * 1.1)) +
            0.03)
      );
    };
  } else if (fk === 'cotton') {
    /* Egyptian cotton: a fine, smooth weave with a soft sheen, lying in gentle folds */
    weave('#d6cfc0', '120,104,76', '255,255,250', 0.5, 0.7);
    FL = { rep: 64, ns: 0.22, rough: 0.56, env: 0.26 };
    HF = (x, y) => {
      const d = off(x, y);
      if (d <= 0) return 0;
      let e = Math.min(1, d / 0.6);
      e = e * e * (3 - 2 * e);
      return 0.014 * Math.min(1, d / 0.1) + e * (0.15 * Math.pow(0.5 + 0.5 * Math.sin(x * 1.15 + y * 0.6 + 0.9 * Math.sin(y * 0.7)), 3) + 0.09 * Math.pow(0.5 + 0.5 * Math.sin(y * 1.4 - x * 0.8 + 1.3 * Math.sin(x * 0.5) + 2), 4));
    };
  } else weave('#3b332b', '10,6,2', '255,236,206', 2, 0.6);
  return { map: lc, height: lh, ...FL, HF };
}

/* ── the scene ───────────────────────────────────────────────────────────────────────────────────────────────────── */

type Item = { x: number; y: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number; sx?: number; sy?: number; sz?: number; c?: THREE.Color; ph?: number; rg?: number; dr?: boolean; _h?: boolean };
type Sway = { im: THREE.InstancedMesh; list: Item[]; kind: 'petal' | 'bloom' | 'leaf' };

export const giftBox = (): Scene => {
  let c: Ctx;
  const air: Air = { gust: 0 };
  let RM = false;
  let key: THREE.SpotLight;
  let spk: THREE.PointLight;
  let spill: THREE.PointLight;
  let lamp: THREE.PointLight;
  let HF: Floor['HF'] = null;
  const sway: Sway[] = [];
  const dm = new THREE.Object3D();
  let glints: { list: Item[]; col: THREE.BufferAttribute; tint: readonly [number, number, number] } | null = null;
  let gscene: THREE.Scene | null = null;
  let lid: THREE.Group;
  let arms: Band[] = [];
  let loops: Band[] = [];
  let tails: Band[] = [];
  let knot: THREE.Mesh;
  let glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let halo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let motes: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  let mv: number[] = [];
  let vig: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  let dof = 1;
  let tnow = 0;
  /* the box's measures, from the screen's shape (the card inside is the cover, at the screen's own shape) */
  let CH = 2.9;
  let CW = 2;
  const CZ = 0.2;
  let IX = 0;
  let IY = 0;
  const TH = 0.05;
  let BX = 0;
  let BY = 0;
  const BZ = 1.0;
  let LX = 0;
  let LY = 0;
  const ZT = BZ + 0.035;
  const SK = 0.36;
  /* the post pass: one target and one quad per stage */
  const PP: { rt?: THREE.WebGLRenderTarget; ps?: THREE.Scene; pc?: THREE.OrthographicCamera; pq?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> } = {};
  const sz = new THREE.Vector2();
  const fwd = new THREE.Vector3();

  function build(cx: Ctx): void {
    c = cx;
    const s = c.scene;
    const R = c.rand;
    RM = c.still;
    CW = (CH * c.W) / c.H;
    IX = CW / 2 + 0.13;
    IY = CH / 2 + 0.13;
    BX = IX + TH;
    BY = IY + TH;
    LX = BX + 0.035;
    LY = BY + 0.035;
    const looks = c.looks;

    s.environment = room(c);
    s.add(new THREE.AmbientLight(0xfff1dc, 0.07 * PI));
    /* the key: its hot spot up-left of the lid, falling off across it */
    key = new THREE.SpotLight(0xffe9cc, KEY, 40, 0.285, 1, 0);
    key.position.set(-4.4, -3.6, 9.0);
    key.target.position.set(-0.45, 0.5, 0.4);
    s.add(key.target);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 3;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 7;
    s.add(key);
    const fill = new THREE.DirectionalLight(0xcfd9ff, 0.13 * PI);
    fill.position.set(4, 1.5, 3);
    s.add(fill);
    const rimL = new THREE.DirectionalLight(0xffd2a0, 0.6 * PI);
    rimL.position.set(1.5, 6, 1.6);
    s.add(rimL);
    /* a small light that travels slowly: pearls, satin and foil take a moving sheen from it */
    spk = new THREE.PointLight(0xfff0d8, SPARK, 9, 0);
    spk.position.set(2.4, -1.4, 3.2);
    s.add(spk);
    /* the glow from inside, falling on the lid, the rims and the ground once the box is open */
    spill = new THREE.PointLight(0xffc98a, 0, 7, 0);
    spill.position.set(0, -0.2, BZ + 0.8);
    s.add(spill);

    /* the floor: the couple's choice */
    const F = floorOf(c, looks.floor, BX, BY);
    HF = F.HF;
    const lin = texOf(F.map, { srgb: true, repeat: true, aniso: 8 });
    const linN = normals(F.height, 1.6);
    linN.anisotropy = 8;
    lin.repeat.set(F.rep, F.rep);
    linN.repeat.set(F.rep, F.rep);
    const tableMat = new THREE.MeshStandardMaterial({ map: lin, normalMap: linN, normalScale: new THREE.Vector2(F.ns, F.ns), roughness: F.rough, metalness: 0, envMapIntensity: F.env });
    const table = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), tableMat);
    table.receiveShadow = true;
    s.add(table);
    if (HF) {
      /* a floor with a shape: its own mesh, darkened where it meets the box (the contact shadow is in the cloth itself) */
      table.position.z = -0.04;
      const cg = new THREE.PlaneGeometry(13, 17, 156, 204);
      const cp = cg.attributes.position as THREE.BufferAttribute;
      const cc2 = new Float32Array(cp.count * 3);
      const uvc = cg.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < cp.count; i++) {
        const hx = cp.getX(i);
        const hy = cp.getY(i);
        const hd = Math.hypot(Math.max(0, Math.abs(hx) - BX), Math.max(0, Math.abs(hy) - BY));
        const hz = HF(hx, hy);
        const ao = (1 - 0.55 * Math.exp(-hd / 0.28)) * (0.66 + 0.34 * Math.min(1, hz / (looks.floor === 'cotton' ? 0.16 : 0.34)));
        cp.setZ(i, hz);
        cc2[i * 3] = cc2[i * 3 + 1] = cc2[i * 3 + 2] = ao;
        uvc.setXY(i, hx / 44 + 0.5, hy / 44 + 0.5);
      }
      cg.setAttribute('color', new THREE.BufferAttribute(cc2, 3));
      cg.computeVertexNormals();
      const cm = tableMat.clone();
      cm.vertexColors = true;
      const cloth = new THREE.Mesh(cg, cm);
      cloth.receiveShadow = true;
      s.add(cloth);
    } else {
      /* the box's shadow on the ground: soft, close under it and thrown away from the light */
      const sc = canvas(256, 256);
      const sx3 = ctx2d(sc);
      sx3.filter = 'blur(20px)';
      sx3.fillStyle = 'rgba(0,0,0,.9)';
      sx3.fillRect(52, 52, 152, 152);
      sx3.filter = 'none';
      const shd = new THREE.Mesh(new THREE.PlaneGeometry(((LX * 2 * 256) / 152) * 1.12, ((LY * 2 * 256) / 152) * 1.1), new THREE.MeshBasicMaterial({ map: texOf(sc), transparent: true, opacity: 0.86, depthWrite: false }));
      shd.position.set(0.3, 0.34, 0.003);
      shd.renderOrder = 1;
      s.add(shd);
      /* ambient occlusion: the tight dark line where the box meets the ground */
      const ac = canvas(256, 256);
      const ax3 = ctx2d(ac);
      ax3.filter = 'blur(7px)';
      ax3.fillStyle = 'rgba(0,0,0,1)';
      ax3.fillRect(40, 40, 176, 176);
      ax3.filter = 'none';
      const aom = new THREE.Mesh(new THREE.PlaneGeometry(((LX * 2 * 256) / 176) * 1.03, ((LY * 2 * 256) / 176) * 1.02), new THREE.MeshBasicMaterial({ map: texOf(ac), transparent: true, opacity: 0.7, depthWrite: false }));
      aom.position.set(0.02, 0.02, 0.0035);
      aom.renderOrder = 1;
      s.add(aom);
    }

    arrange(looks.around);

    /* the paper and its trims */
    const wc = new THREE.Color(WRAP);
    const FOLD = wc.clone().lerp(new THREE.Color(0xffffff), 0.32).getHex();
    const paper = paperMaterial(c);
    const cream = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear().multiplyScalar(0.86), roughness: 0.88, side: THREE.DoubleSide, envMapIntensity: 0.15 });
    const rimM = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear(), roughness: 0.85, envMapIntensity: 0.2 });
    const shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    const edge = new THREE.MeshStandardMaterial({ color: wc.clone().convertSRGBToLinear(), roughness: 0.4, envMapIntensity: 0.9 });
    /* a folded flap of paper lying on a face: its own piece of the print (so the pattern breaks at the fold, as it
       does), a hair proud of the face, with the thin shadow its edge throws */
    const flap = (parent: THREE.Object3D, pts: number[][], dir: 'y-' | 'x-', x: number, y: number, z: number, lift: number, ou: number) => {
      const sh = new THREE.Shape();
      pts.forEach((p, i) => (i ? sh.lineTo(p[0]!, p[1]!) : sh.moveTo(p[0]!, p[1]!)));
      sh.closePath();
      const lp = pts.concat([pts[0]!]).map((q) => new THREE.Vector3(q[0], q[1], 0));
      const lg = aim(new THREE.BufferGeometry().setFromPoints(lp), dir);
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: FOLD, transparent: true, opacity: 0.55 }));
      const nn = dir === 'y-' ? [0, -1, 0] : [-1, 0, 0];
      ln.position.set(x + nn[0]! * (lift + 0.002), y + nn[1]! * (lift + 0.002), z);
      ln.renderOrder = 3;
      parent.add(ln);
      for (const k of [0, 1]) {
        const g = new THREE.ShapeGeometry(sh);
        const p = g.attributes.position as THREE.BufferAttribute;
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) uv.setXY(i, p.getY(i) / TILE + ou, -p.getX(i) / TILE + ou * 1.7);
        if (!k) g.translate(0.009, -0.011, 0);
        aim(g, dir);
        const m = new THREE.Mesh(g, k ? paper : shade);
        const d = k ? lift : lift * 0.5;
        m.position.set(x + nn[0]! * d, y + nn[1]! * d, z);
        m.receiveShadow = !!k;
        m.renderOrder = k ? 2 : 1;
        parent.add(m);
      }
    };

    /* ---- the base: four wrapped walls, a lined inside, the bed, and the card ---- */
    const base = new THREE.Group();
    s.add(base);
    put(base, aim(sheet(BX * 2, BZ, 1, 1, 0.21, 0.4), 'y-'), paper, 0, -BY, BZ / 2);
    put(base, aim(sheet(BX * 2, BZ, 1, 1, 0.6, 0.1), 'y+'), paper, 0, BY, BZ / 2);
    put(base, aim(sheet(BZ, BY * 2, 1, 1, 0.37, 0.15, true), 'x-'), paper, -BX, 0, BZ / 2);
    put(base, aim(sheet(BZ, BY * 2, 1, 1, 0.8, 0.55, true), 'x+'), paper, BX, 0, BZ / 2);
    put(base, aim(new THREE.PlaneGeometry(IX * 2, BZ), 'y+'), cream, 0, -IY, BZ / 2, false);
    put(base, aim(new THREE.PlaneGeometry(IX * 2, BZ), 'y-'), cream, 0, IY, BZ / 2, false);
    put(base, aim(new THREE.PlaneGeometry(BZ, IY * 2), 'x+'), cream, -IX, 0, BZ / 2, false);
    put(base, aim(new THREE.PlaneGeometry(BZ, IY * 2), 'x-'), cream, IX, 0, BZ / 2, false);
    for (const r of [
      [0, -(IY + BY) / 2, BX * 2, TH],
      [0, (IY + BY) / 2, BX * 2, TH],
      [-(IX + BX) / 2, 0, TH, IY * 2],
      [(IX + BX) / 2, 0, TH, IY * 2],
    ])
      put(base, new THREE.PlaneGeometry(r[2], r[3]), rimM, r[0]!, r[1]!, BZ, false);
    /* the classic end of a wrapped box, on the wall that faces us: the top flap folded down, the bottom flap up over it */
    const d45 = BZ - 0.47;
    flap(
      base,
      [
        [-BX, BZ],
        [BX, BZ],
        [BX - d45, 0.47],
        [-BX + d45, 0.47],
      ],
      'y-',
      0,
      -BY,
      0,
      0.004,
      0.31,
    );
    flap(
      base,
      [
        [-BX, 0],
        [BX, 0],
        [BX - 0.53, 0.53],
        [-BX + 0.53, 0.53],
      ],
      'y-',
      0,
      -BY,
      0,
      0.008,
      0.67,
    );
    /* the lining: the cloth the card lies in, and the same cloth up the inside walls — the couple's choice (v23) */
    const th = canvas(256, 256);
    const tx = ctx2d(th);
    tx.fillStyle = '#808080';
    tx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const ax = R() * 256;
      const ay = R() * 256;
      const al = 20 + R() * 70;
      const aa = R() * 6.283;
      tx.strokeStyle = R() > 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)';
      tx.lineWidth = 1 + R() * 2.5;
      tx.beginPath();
      tx.moveTo(ax, ay);
      tx.lineTo(ax + Math.cos(aa) * al, ay + Math.sin(aa) * al);
      tx.stroke();
    }
    /* [colour as seen, roughness, how metallic, reflection, relief, how much it is gathered] */
    const LN = (
      {
        lame: ['#c9a968', 0.46, 0.55, 0.8, 1.2, 1],
        ivory: ['#efe6d2', 0.3, 0.1, 0.9, 0.5, 0.55],
        blush: ['#d9959d', 0.34, 0.08, 0.8, 0.55, 0.6],
        navy: ['#1c2a4e', 0.96, 0, 0.1, 0.3, 0.4],
        sage: ['#7f9672', 0.9, 0, 0.14, 0.9, 0.45],
        card: ['#efe7d6', 0.9, 0, 0.12, 0.05, 0],
      } as const
    )[looks.lining];
    const tissue = new THREE.MeshStandardMaterial({ color: seen(LN[0]), roughness: LN[1], metalness: LN[2], normalMap: normals(th, 3.6), normalScale: new THREE.Vector2(LN[4], LN[4]), side: THREE.DoubleSide, envMapIntensity: LN[3] });
    const wallM = tissue.clone();
    wallM.color = seen(LN[0]).multiplyScalar(0.82);
    wallM.normalScale = new THREE.Vector2(LN[4] * 0.5, LN[4] * 0.5);
    for (const m of base.children) if ((m as THREE.Mesh).material === cream) (m as THREE.Mesh).material = wallM;
    const bed = new THREE.PlaneGeometry(IX * 2, IY * 2, 30, 46);
    const bp = bed.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const ex = Math.max(0, Math.abs(bp.getX(i)) - CW / 2 - 0.035) / (IX - CW / 2 - 0.035);
      const ey = Math.max(0, Math.abs(bp.getY(i)) - CH / 2 - 0.035) / (IY - CH / 2 - 0.035);
      const eg = Math.min(1, Math.max(ex, ey));
      bp.setZ(
        i,
        CZ - 0.04 + eg * 0.3 * Math.min(1, LN[5] * 2.5) + LN[5] * eg * (Math.sin(bp.getX(i) * 23 + bp.getY(i) * 7) * Math.cos(bp.getY(i) * 19 - bp.getX(i) * 5) * 0.035 + (hash(bp.getX(i) * 9, bp.getY(i) * 9) - 0.5) * 0.03),
      );
    }
    bed.computeVertexNormals();
    put(base, bed, tissue, 0, 0, 0, false);
    /* 🪟 the card: the Event Hub itself. It is a window — it writes nothing and clears the alpha, so the guest's own page
       shows through it; as the camera comes down the card fills the screen exactly, and the reveal then fades away */
    const card = put(base, new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: false, blending: THREE.NoBlending, toneMapped: false }), 0, 0, CZ, false);
    card.receiveShadow = false;
    card.renderOrder = 4;

    /* ---- the lid: wrapped on its own, so it lifts clean. A slightly uneven top (paper is never dead flat), mitred ---- */
    lid = new THREE.Group();
    lid.position.set(0, LY, ZT);
    s.add(lid);
    const lidBody = new THREE.Group();
    lidBody.position.set(0, -LY, 0);
    lid.add(lidBody);
    const top = sheet(LX * 2, LY * 2, 14, 22, 0, 0);
    const tp = top.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const fx = Math.abs(tp.getX(i)) / LX;
      const fy = Math.abs(tp.getY(i)) / LY;
      tp.setZ(i, fx > 0.99 || fy > 0.99 ? 0 : 0.007 * Math.sin(tp.getX(i) * 2.3 + 1) * Math.cos(tp.getY(i) * 1.7) + 0.004 * Math.sin(tp.getX(i) * 5.1 + tp.getY(i) * 3.3));
    }
    top.computeVertexNormals();
    put(lidBody, top, paper, 0, 0, 0);
    put(lidBody, aim(sheet(LX * 2, SK, 1, 1, 0.13, 0.72), 'y-'), paper, 0, -LY, -SK / 2);
    put(lidBody, aim(sheet(LX * 2, SK, 1, 1, 0.5, 0.3), 'y+'), paper, 0, LY, -SK / 2);
    put(lidBody, aim(sheet(SK, LY * 2, 1, 1, 0.44, 0.9, true), 'x-'), paper, -LX, 0, -SK / 2);
    put(lidBody, aim(sheet(SK, LY * 2, 1, 1, 0.7, 0.2, true), 'x+'), paper, LX, 0, -SK / 2);
    put(lidBody, aim(new THREE.PlaneGeometry(LX * 2 - 0.02, LY * 2 - 0.02), 'z-'), cream, 0, 0, -0.012, false);
    flap(lidBody, [[-LX, 0], [-LX, -SK], [-LX + SK, -SK]], 'y-', 0, -LY, 0, 0.005, 0.23);
    flap(lidBody, [[LX, 0], [LX, -SK], [LX - SK, -SK]], 'y-', 0, -LY, 0, 0.005, 0.57);
    flap(lidBody, [[0, -LY], [-SK, -LY], [-SK, -LY + SK]], 'x-', -LX, 0, 0, 0.005, 0.41);
    flap(lidBody, [[0, LY], [-SK, LY], [-SK, LY - SK]], 'x-', -LX, 0, 0, 0.005, 0.83);
    /* the folded edges catch the light */
    for (const e of [
      [0, -LY, 0, LX * 2, 'x'],
      [0, LY, 0, LX * 2, 'x'],
      [-LX, 0, 0, LY * 2, 'y'],
      [LX, 0, 0, LY * 2, 'y'],
      [-LX, -LY, -SK / 2, SK, 'z'],
      [LX, -LY, -SK / 2, SK, 'z'],
      [-LX, LY, -SK / 2, SK, 'z'],
    ] as const) {
      const g = new THREE.CylinderGeometry(0.007, 0.007, e[3], 8, 1);
      if (e[4] === 'x') g.rotateZ(PI / 2);
      else if (e[4] === 'z') g.rotateX(PI / 2);
      put(lidBody, g, edge, e[0], e[1], e[2] - 0.006, false);
    }
    for (const [ex, ey] of [
      [-BX, -BY],
      [BX, -BY],
      [-BX, BY],
    ] as const) {
      const g = new THREE.CylinderGeometry(0.006, 0.006, BZ, 8, 1);
      g.rotateX(PI / 2);
      put(base, g, edge, ex, ey, BZ / 2, false);
    }

    /* ---- the ribbon: four arms from the knot, each lying on the lid, over the edge, round the lid's skirt and down the
       base to the ground, tight to the box all the way. On opening the knot lets go and each arm opens outward and comes
       to rest on the ground, like a flower opening (owner, 23 Nov). Nothing is dragged across the box. ---- */
    const satin = satinMaterial(c);
    const col: Box[] = [
      { x: LX, y: LY, z: ZT, z0: ZT - SK },
      { x: BX, y: BY, z: BZ },
    ];
    const r = 0.02;
    const ds = 0.085;
    const KZ = ZT + r;
    const na = canvas(32, 256);
    const nx2 = ctx2d(na);
    nx2.fillStyle = '#fff';
    nx2.fillRect(0, 0, 32, 256);
    nx2.fillStyle = '#000';
    nx2.beginPath();
    nx2.moveTo(0, 0);
    nx2.lineTo(32, 0);
    nx2.lineTo(16, 20);
    nx2.fill();
    const tailMat = satin.clone();
    tailMat.map = satinTex(RIB[0], RIB[1], RIB[2]);
    tailMat.map.repeat.set(1, 1);
    tailMat.alphaMap = texOf(na);
    tailMat.alphaTest = 0.5;
    arms = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).map((d, k) => {
      const [ex, ey] = d;
      const hx = ex ? LX : LY;
      const bx = ex ? BX : BY;
      const zz = KZ + (ey ? 0.006 : 0);
      const P = (o: number, z: number) => [ex * o, ey * o, z];
      const b = new Band(path([P(bx + r, r), P(bx + r, ZT - SK - 0.04), P(hx + r, ZT - SK + 0.02), P(hx + r, zz), P(0, zz)], ds), 0.3, satin, air, { n0: [ex, ey, 0], col, r, damp: 0.96, fz: HF });
      const e = b.n - 1;
      let L = 0;
      for (let i = 0; i < e; i++) L += b.base[i]!;
      b.hold(0, ex * (bx + r), ey * (bx + r), r);
      b.hold(e, 0, 0, zz);
      b.e = e;
      b.L = L;
      b.d = d;
      b.a = bx + r;
      b.zz = zz;
      b.t0 = 1.8 + k * 0.12;
      s.add(b.mesh);
      return b;
    });
    /* the bow: two loops with body, a knot, two tails that lie on the lid and spill over its edge [direction°, size] */
    loops = (
      [
        [9, 1],
        [171, 1],
      ] as const
    ).map(([deg, size]) => {
      const t0 = (deg * PI) / 180;
      const ux = Math.cos(t0);
      const uy = Math.sin(t0);
      const pts: number[][] = [];
      const n = 40;
      const Lp = 0.9 * size;
      const hp = 0.42 * size;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * PI * 2;
        const al = Lp * Math.pow((1 - Math.cos(a)) / 2, 0.8);
        const ac = 0.05 * size * Math.sin(a);
        const up = Math.max(0, Math.sin(a));
        pts.push([ux * al - uy * ac, uy * al + ux * ac + 0.03, KZ + 0.05 + Math.pow(up, 0.7) * 0.78 * hp + ((1 - Math.cos(a)) / 2) * 0.08]);
      }
      const bd = new Band(pts, 0.32, satin, air, { n0: [0, 0, 1], camber: 0.036, damp: 0.9, M: 8, sub: 1 });
      bd.hold(0, 0, 0.05, KZ + 0.06);
      bd.hold(n, 0, 0.05, KZ + 0.06);
      bd.stiff = 0.014;
      bd.wind = 1.2;
      bd.wlift = 2;
      s.add(bd.mesh);
      return bd;
    });
    tails = [-1, 1].map((sg) => {
      const pts = path(
        [
          [0, 0, KZ + 0.03],
          [sg * 0.34, -0.5, KZ + 0.03],
          [sg * 0.78, -0.95, KZ + 0.03],
          [sg * 0.95, -1.32, KZ + 0.03],
        ],
        ds,
      );
      const b = new Band(pts, 0.28, tailMat, air, { n0: [0, 0, 1], col, damp: 0.95, camber: 0.016, M: 6, twist: (q) => 0.35 * Math.sin(q * 3.1 + sg) * q });
      b.hold(0, 0, 0, KZ + 0.03);
      s.add(b.mesh);
      return b;
    });
    knot = new THREE.Mesh(new THREE.SphereGeometry(0.125, 28, 18), satin);
    knot.scale.set(1.2, 1, 0.75);
    knot.position.set(0, 0, KZ + 0.08);
    knot.castShadow = true;
    s.add(knot);
    for (let i = 0; i < 80; i++) for (const b of tails) b.step(1 / 60, -7, 0);
    /* the tails keep their lie, loosely, and the breeze plays with their ends */
    for (const b of tails) {
      b.shape.set(b.p);
      b.stiff = 0.006;
      b.wind = 0.9;
      b.wtip = true;
      b.wlift = 6;
      b.update(0);
    }

    /* ---- the light inside ---- */
    const gc = canvas(128, 128);
    const gx = ctx2d(gc);
    const gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,248,232,1)');
    gg.addColorStop(0.4, 'rgba(255,238,206,.55)');
    gg.addColorStop(1, 'rgba(255,226,180,0)');
    gx.fillStyle = gg;
    gx.fillRect(0, 0, 128, 128);
    glow = new THREE.Mesh(new THREE.PlaneGeometry(BX * 3.4, BY * 3.0), new THREE.MeshBasicMaterial({ map: texOf(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.set(0, 0, BZ - 0.03);
    glow.renderOrder = 5;
    s.add(glow);
    const hc = canvas(128, 222);
    const hx = ctx2d(hc);
    hx.fillStyle = '#000';
    hx.fillRect(0, 0, 128, 222);
    hx.filter = 'blur(9px)';
    hx.fillStyle = '#fff';
    hx.fillRect(22, 22, 84, 178);
    hx.filter = 'none';
    halo = new THREE.Mesh(new THREE.PlaneGeometry((CW * 128) / 84, (CH * 222) / 178), new THREE.MeshBasicMaterial({ map: texOf(hc), color: 0xffe9c6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.position.set(0, 0, CZ - 0.004);
    halo.renderOrder = 3;
    s.add(halo);
    lamp = new THREE.PointLight(0xffd29a, 0, 9, 0);
    lamp.position.set(0, 0.2, 0.82);
    s.add(lamp);
    const n = 90;
    const dp = new Float32Array(n * 3);
    mv = [];
    for (let i = 0; i < n; i++) {
      dp[i * 3] = (R() - 0.5) * IX * 1.8;
      dp[i * 3 + 1] = (R() - 0.5) * IY * 1.8;
      dp[i * 3 + 2] = 0.3 + R() * 2.4;
      mv.push(0.05 + R() * 0.12);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0cc, size: 0.028, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(motes);
    /* the lens: darker toward the corners, as a photograph is */
    const vc = canvas(128, 128);
    const vx = ctx2d(vc);
    const vg = vx.createRadialGradient(64, 64, 26, 64, 64, 92);
    vg.addColorStop(0, 'rgba(10,6,2,0)');
    vg.addColorStop(1, 'rgba(10,6,2,.78)');
    vx.fillStyle = vg;
    vx.fillRect(0, 0, 128, 128);
    vig = new THREE.Mesh(new THREE.PlaneGeometry(2 * R15 * c.camera.aspect, 2 * R15), new THREE.MeshBasicMaterial({ map: texOf(vc), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    vig.renderOrder = 20;
    s.add(vig);
  }

  /** Around the box: an arrangement, the couple's choice (v22, swaying since v25). Four lanes are kept clear, where the
   *  ribbon opens out. */
  function arrange(ak: RevealLooksFull['around']): void {
    const s = c.scene;
    const R = c.rand;
    dm.rotation.order = 'ZXY';
    const okAt = (x: number, y: number, m: number) => !(Math.abs(x) < LX + m && Math.abs(y) < LY + m) && !((Math.abs(y) < 0.38 && Math.abs(x) > LX) || (Math.abs(x) < 0.38 && Math.abs(y) > LY));
    const scatter = (nn: number, m: number, fn: (x: number, y: number, i: number) => Item): Item[] => {
      const out: Item[] = [];
      let g2 = 0;
      while (out.length < nn && g2++ < nn * 40) {
        const near = R() < 0.72;
        const x = (R() - 0.5) * (near ? 5.4 : 9.5);
        const y = (R() - 0.5) * (near ? 7.6 : 13);
        if (okAt(x, y, m)) out.push(fn(x, y, out.length));
      }
      return out;
    };
    const many = (geo: THREE.BufferGeometry, mat: THREE.Material, list: Item[], cast = true, kind?: Sway['kind']) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((o, i) => {
        if (!o._h) {
          o.z = (o.z ?? 0) + (HF ? HF(o.x, o.y) : 0);
          o._h = true;
          if (o.ph == null) o.ph = R() * 6.283;
        }
        dm.position.set(o.x, o.y, o.z ?? 0);
        dm.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
        dm.scale.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
        dm.updateMatrix();
        im.setMatrixAt(i, dm.matrix);
        if (o.c) im.setColorAt(i, o.c);
      });
      im.castShadow = cast;
      im.receiveShadow = true;
      im.frustumCulled = false;
      s.add(im);
      if (kind) sway.push({ im, list, kind });
    };
    /* glints: small four-point stars that come and go, one after another, as the light travels across */
    const starTex = () => {
      const c2 = canvas(64, 64);
      const x2 = ctx2d(c2);
      const g3 = x2.createRadialGradient(32, 32, 0, 32, 32, 30);
      x2.fillStyle = '#000';
      x2.fillRect(0, 0, 64, 64);
      g3.addColorStop(0, 'rgba(255,255,255,1)');
      g3.addColorStop(0.12, 'rgba(255,255,255,.55)');
      g3.addColorStop(0.4, 'rgba(255,255,255,.08)');
      g3.addColorStop(1, 'rgba(255,255,255,0)');
      x2.fillStyle = g3;
      x2.fillRect(0, 0, 64, 64);
      x2.globalCompositeOperation = 'lighter';
      for (const [rw, rh, an] of [
        [30, 1.6, 0],
        [1.6, 30, 0],
        [15, 1, 0.785],
        [1, 15, 0.785],
      ] as const) {
        x2.save();
        x2.translate(32, 32);
        x2.rotate(an);
        const lg = x2.createRadialGradient(0, 0, 0, 0, 0, Math.max(rw, rh));
        lg.addColorStop(0, 'rgba(255,255,255,.95)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        x2.fillStyle = lg;
        x2.fillRect(-rw, -rh, rw * 2, rh * 2);
        x2.restore();
      }
      return texOf(c2);
    };
    const sparkle = (list: Item[], tint: readonly [number, number, number], frac: number, size: number) => {
      /* none behind the box, where the box hides the stone itself */
      const L2 = list.filter((o, i) => hash(i, 9) < frac && !(Math.abs(o.x) < LX + 0.3 && o.y > LY - 0.1 && o.y < LY + 1.0));
      const gp = new Float32Array(L2.length * 3);
      const gc2 = new Float32Array(L2.length * 3);
      L2.forEach((o, i) => {
        gp[i * 3] = o.x;
        gp[i * 3 + 1] = o.y;
        gp[i * 3 + 2] = (o.z ?? 0) + (o.s ?? 0.05) * 1.7 + 0.06;
      });
      const gg2 = new THREE.BufferGeometry();
      gg2.setAttribute('position', new THREE.BufferAttribute(gp, 3));
      gg2.setAttribute('color', new THREE.BufferAttribute(gc2, 3));
      const pts = new THREE.Points(gg2, new THREE.PointsMaterial({ map: starTex(), size, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      pts.frustumCulled = false;
      /* the glints are drawn after the depth-of-field pass, so they stay crisp */
      gscene = new THREE.Scene();
      gscene.add(pts);
      glints = { list: L2, col: gg2.attributes.color as THREE.BufferAttribute, tint };
    };
    const rim = (u: number, d: number): [number, number] => {
      const a = LX + d;
      const b = LY + d;
      let q = (u % 1) * 4 * (a + b);
      if (q < 2 * a) return [-a + q, -b];
      q -= 2 * a;
      if (q < 2 * b) return [a, -b + q];
      q -= 2 * b;
      if (q < 2 * a) return [a - q, b];
      q -= 2 * a;
      return [-a, b - q];
    };
    const pick = <V>(arr: readonly V[]): V => arr[Math.floor(R() * arr.length)]!;
    const psh = new THREE.Shape();
    psh.moveTo(0, 0);
    psh.bezierCurveTo(0.5, 0.12, 0.56, 0.72, 0.06, 1);
    psh.quadraticCurveTo(0, 0.94, -0.06, 1);
    psh.bezierCurveTo(-0.56, 0.72, -0.5, 0.12, 0, 0);
    const pgeo = new THREE.ShapeGeometry(psh, 8);
    const soft = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, side: THREE.DoubleSide, envMapIntensity: 0.22 });
    const ball = new THREE.SphereGeometry(1, 16, 12);
    const ROSE = ['#ecc3c4', '#e3a9b0', '#f3dcd6', '#d98f9c', '#f6ebe4'].map(seen);
    const petals = (nn: number) =>
      many(
        pgeo,
        soft,
        scatter(nn, 0.14, (x, y, i) => ({
          x,
          y,
          z: 0.005 + i * 0.00004,
          rz: R() * 6.283,
          rx: (R() - 0.5) * 0.14,
          s: 0.2 + R() * 0.2,
          c: pick(ROSE),
          /* about one petal in nine drifts a little and tumbles — only where it cannot reach the box or a ribbon lane */
          dr: i % 9 === 4 && okAt(x + 0.4, y, 0.42) && okAt(x - 0.4, y, 0.42) && okAt(x, y + 0.35, 0.42) && okAt(x, y - 0.35, 0.42),
        })),
        false,
        'petal',
      );
    if (ak === 'petals') petals(420);
    if (ak === 'flowers') {
      const PAL = [
        ['#f1c9cc', '#d98f9c'],
        ['#f7efe6', '#e9d3bd'],
        ['#f3d2bd', '#e2a585'],
        ['#e8b7c4', '#c9748c'],
        ['#fbf6ee', '#efdcc8'],
      ] as const;
      const pl: Item[] = [];
      const lv: Item[] = [];
      const ct: Item[] = [];
      for (let fi = 0; fi < 22; fi++) {
        const fp = rim((fi + 0.15 + R() * 0.5) / 22, 0.42 + R() * 0.62);
        const Rr = 0.3 + R() * 0.2;
        const pal = PAL[fi % 5]!;
        const ca = seen(pal[0]);
        const cb = seen(pal[1]);
        if (!okAt(fp[0], fp[1], 0.2)) continue;
        for (const [ri, [cnt, sc, tilt]] of (
          [
            [9, 1, 0.3],
            [7, 0.76, 0.66],
            [5, 0.52, 1.0],
            [3, 0.3, 1.32],
          ] as const
        ).entries())
          for (let j = 0; j < cnt; j++) {
            const an = (j / cnt) * 6.283 + ri * 0.7 + fi;
            pl.push({ x: fp[0], y: fp[1], z: 0.012 + ri * 0.035 * Rr, rz: an - 1.5708, rx: tilt + (R() - 0.5) * 0.12, s: Rr * sc, c: ca.clone().lerp(cb, ri / 3.4), ph: fi * 1.7, rg: ri });
          }
        ct.push({ x: fp[0], y: fp[1], z: 0.1 * Rr, s: 0.1 * Rr, c: seen('#d9b46a') });
        for (let l3 = 0; l3 < 3; l3++) {
          const la = R() * 6.283;
          lv.push({ x: fp[0] + Math.cos(la) * Rr * 0.5, y: fp[1] + Math.sin(la) * Rr * 0.5, z: 0.006, rz: la - 1.5708, rx: 0.1, sx: Rr * 0.5, sy: Rr * 1.25, sz: 1, c: seen(l3 % 2 ? '#5d7a52' : '#46603f'), ph: fi * 1.7 + 1 });
        }
      }
      many(pgeo, soft, lv, false, 'leaf');
      many(pgeo, soft, pl, true, 'bloom');
      many(ball, soft, ct, false);
      petals(70);
    }
    if (ak === 'pearls') {
      const pearl = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.06, envMapIntensity: 1.25 });
      const PC = seen('#f4ecdf');
      const prs: Item[] = [];
      for (const st of [
        [0.3, 0.055, 3, 0],
        [0.62, 0.045, 5, 1.3],
        [0.98, 0.06, 4, 2.6],
      ] as const) {
        const per = 4 * (LX + LY + 2 * st[0]);
        const np = Math.floor(per / (st[1] * 2.04));
        for (let k3 = 0; k3 < np; k3++) {
          const u3 = k3 / np;
          const q3 = rim(u3, st[0] + 0.08 * Math.sin(u3 * 6.283 * st[2] + st[3]));
          if (okAt(q3[0], q3[1], st[1] + 0.04)) prs.push({ x: q3[0], y: q3[1], z: st[1], s: st[1], c: PC });
        }
      }
      many(
        ball,
        pearl,
        prs.concat(
          scatter(70, 0.2, (x, y) => {
            const rr = 0.03 + R() * 0.04;
            return { x, y, z: rr, s: rr, c: PC };
          }),
        ),
      );
      many(ball, new THREE.MeshStandardMaterial({ color: seen('#c9a24e'), roughness: 0.25, metalness: 1, envMapIntensity: 1.4 }), scatter(30, 0.2, (x, y) => ({ x, y, z: 0.03, s: 0.03 })));
    }
    if (ak === 'diamonds') {
      const pav = new THREE.ConeGeometry(1, 1.1, 8);
      pav.rotateX(-PI / 2);
      pav.translate(0, 0, 0.55);
      const crn = new THREE.CylinderGeometry(0.6, 1, 0.38, 8);
      crn.rotateX(PI / 2);
      crn.translate(0, 0, 1.29);
      const gem = new THREE.MeshStandardMaterial({ color: seen('#dfe9f6'), roughness: 0.03, metalness: 1, flatShading: true, envMapIntensity: 2.6 });
      const gl = scatter(190, 0.2, (x, y) => {
        const gs = 0.05 + R() * R() * 0.13;
        return { x, y, z: gs * 0.25, s: gs, rx: (R() - 0.5) * 1.5, ry: (R() - 0.5) * 1.5, rz: R() * 6.283 };
      });
      many(pav, gem, gl);
      many(crn, gem, gl);
      sparkle(gl, [1, 1, 1.05], 0.42, 1.15);
    }
    if (ak === 'confetti' || ak === 'stars') {
      const CF = (ak === 'stars' ? ['#d9b04a', '#e9cd7a', '#c9c9cf', '#b8892f'] : ['#e8b84a', '#e86a5c', '#3aa6a0', '#f2a7b8', '#f5efe2', '#6b8fd6']).map(seen);
      const ssh = new THREE.Shape();
      for (let k4 = 0; k4 < 10; k4++) {
        const ra = k4 % 2 ? 0.42 : 1;
        const aa = (k4 / 10) * 6.283 + 1.5708;
        if (k4) ssh.lineTo(Math.cos(aa) * ra, Math.sin(aa) * ra);
        else ssh.moveTo(Math.cos(aa) * ra, Math.sin(aa) * ra);
      }
      const foil = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: ak === 'stars' ? 0.28 : 0.5, metalness: ak === 'stars' ? 1 : 0.15, side: THREE.DoubleSide, envMapIntensity: ak === 'stars' ? 1.5 : 0.4 });
      const bit = (x: number, y: number, i: number): Item => ({ x, y, z: 0.006 + i * 0.00003, rz: R() * 6.283, rx: (R() - 0.5) * 0.3, ry: (R() - 0.5) * 0.3, s: 0.05 + R() * 0.07, c: pick(CF) });
      if (ak === 'stars') {
        const stl = scatter(300, 0.15, (x, y, i) => {
          const o = bit(x, y, i);
          o.s = o.s! * 1.5;
          return o;
        });
        many(new THREE.ShapeGeometry(ssh), foil, stl, false);
        sparkle(stl, [1, 0.86, 0.56], 0.45, 0.95);
      } else {
        many(new THREE.CircleGeometry(1, 12), foil, scatter(330, 0.15, bit), false);
        many(new THREE.PlaneGeometry(2.2, 0.8), foil, scatter(240, 0.15, bit), false);
      }
    }
    if (ak === 'balloons') {
      const BC = ['#f2b6c1', '#f5e9d6', '#d9b04a', '#a9c7e8', '#f2b6c1', '#d9b04a', '#f5e9d6', '#a9c7e8'].map(seen);
      const bl: Item[] = [];
      (
        [
          [1, 1, 0.5, 0.45],
          [-1, 1, 0.52, 0.5],
          [1, -1, 0.55, 0.5],
          [-1, -1, 0.5, 0.45],
          [1, 0.3, 0.62, 0.1],
          [-1, -0.3, 0.62, 0.1],
          [0.55, 1, 0.2, 0.62],
          [-0.55, -1, 0.2, 0.62],
        ] as const
      ).forEach((b2, i) => {
        const br2 = 0.46 + (i % 3) * 0.07;
        bl.push({ x: b2[0] * (LX + b2[2]), y: b2[1] > 0.9 || b2[1] < -0.9 ? b2[1] * (LY + b2[3]) : b2[1] * LY * 2.2, z: br2 * 1.08, sx: br2, sy: br2, sz: br2 * 1.12, c: BC[i] });
      });
      many(
        new THREE.SphereGeometry(1, 30, 22),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.16, metalness: 0.12, envMapIntensity: 1.1 }),
        bl.filter((o) => okAt(o.x, o.y, o.sx!)),
      );
      many(
        new THREE.CircleGeometry(1, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, side: THREE.DoubleSide }),
        scatter(160, 0.15, (x, y) => ({ x, y, z: 0.006, rz: R() * 6.283, s: 0.05 + R() * 0.05, c: pick(BC) })),
        false,
      );
    }
  }

  return {
    legacyT: T,
    pbr: true,
    ownCam: true,
    fadeMs: 900,
    exposure: 1.02,
    init(cx) {
      build(cx);
    },
    step(dt, t, tau) {
      const on = tau >= 0;
      const cam = c.camera;
      /* 1 · the bow comes undone: a tail is drawn, each loop shrinks through the knot, the knot loosens, the tails follow */
      const a = on ? ease(tau / 0.9) : 0;
      const b = on ? ease((tau - 0.5) / 0.8) : 0;
      const cc = on ? ease((tau - 1.15) / 0.75) : 0;
      loops.forEach((L, k) => {
        const sh = 1 - 0.95 * (k % 2 ? b : a);
        L.scaleRest(sh);
        L.shrink = sh;
        L.mesh.visible = sh > 0.08;
        if (L.mesh.visible) {
          L.step(dt, -1.2, t);
          L.update(t);
        }
      });
      tails.forEach((Tl, k) => {
        const e = Tl.n - 1;
        const c2 = on ? (k ? cc : ease((tau - 1.3) / 0.7)) : 0;
        if (k && a > 0 && cc < 0.04) Tl.hold(e, 0.95 + a * 0.22, -1.32 - a * 0.3, ZT + 0.05 + a * 0.12);
        else Tl.free(e);
        Tl.scaleRest(1 - 0.94 * c2);
        Tl.shrink = 1 - 0.94 * c2;
        if (c2 > 0.02) Tl.stiff = 0.2;
        Tl.mesh.visible = c2 < 0.97;
        if (Tl.mesh.visible) {
          Tl.step(dt, -7, t);
          Tl.update(t);
        }
      });
      const ks = 1 - 0.98 * (on ? ease((tau - 1.25) / 0.7) : 0);
      knot.scale.set(1.2 * ks + 0.001, ks + 0.001, 0.75 * ks + 0.001);
      knot.visible = ks > 0.04;
      /* 2 · the knot lets go and the four arms open outward, each swinging over its edge of the box and settling on the
         ground, like petals opening. The end is carried on an arc about the arm's foot, never through the box. */
      for (const B of arms) {
        const e = on ? ease((tau - B.t0) / 1.55) : 0;
        const ph0 = Math.atan2(B.zz - 0.02, -B.a);
        const d0 = Math.hypot(B.a, B.zz - 0.02);
        const ph = ph0 * (1 - e);
        const rho = d0 + (B.L * 0.965 - d0) * e * e * (3 - 2 * e);
        const o = B.a + rho * Math.cos(ph);
        const z = Math.max((HF ? HF(B.d[0] * o, B.d[1] * o) : 0) + 0.02, 0.02 + rho * Math.sin(ph));
        if (!B.landed) {
          B.hold(B.e, B.d[0] * o, B.d[1] * o, z);
          B.fl = e > 0 && e < 1 ? 0.5 : 0;
          if (e >= 1) {
            /* once down, the arm is loose: its free end lifts and ripples in the breeze, and settles back */
            B.landed = true;
            B.free(B.e);
            B.fl = 0;
            B.shape.set(B.p);
            B.stiff = 0.004;
            B.wind = 0.8;
            B.wtip = true;
            B.wlift = 10;
          }
        }
        B.step(dt, -9, t);
        B.update(t);
      }
      /* 3 · the lid: it unseats, then lifts with its weight, tips, and is carried away behind the box */
      const u1 = on ? ease((tau - 3.7) / 0.55) : 0;
      const u2 = on ? clamp((tau - 4.05) / 3.2, 0, 1) : 0;
      const w = u2 * u2 * (3 - 2 * u2);
      const sw = Math.exp(-Math.max(0, tau - 7.25) * 2.2) * Math.sin(Math.max(0, tau - 7.25) * 7) * 0.035 * (u2 >= 1 ? 1 : 0);
      lid.position.set(0, LY + 0.6 * w, ZT + 0.05 * u1 + 0.12 * w);
      lid.rotation.set(-(0.05 * u1 + 1.96 * Math.pow(w, 1.05)) + sw, 0, 0.01 * u1 * (1 - w));
      /* 4 · the light inside comes up as the lid leaves */
      const L = on ? ease((tau - 3.85) / 1.7) : 0;
      const end = on ? ease((tau - 5.6) / 3.3) : 0;
      const last = on ? ease((tau - 7.8) / 1.1) : 0;
      glow.material.opacity = L * 0.46 * (1 - clamp(end * 2.2, 0, 1));
      glow.scale.setScalar(0.75 + 0.5 * L);
      lamp.intensity = L * LAMP * (1 - 0.6 * last);
      spill.intensity = L * SPILL * (1 - last);
      dof = 1 - end;
      tnow = t;
      key.intensity = KEY * (1 - 0.45 * L);
      halo.material.opacity = L * 0.6 * (1 - last);
      motes.material.opacity = L * 0.8 * (1 - last);
      const mp = motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < mp.count; i++) {
        let z = mp.getZ(i) + dt * mv[i]! * 1.4;
        if (z > 3) z = 0.3;
        mp.setZ(i, z);
        mp.setX(i, mp.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.02);
      }
      mp.needsUpdate = true;
      /* the breeze. Its swells keep to the loop of the motion standard (1.4 s) and its multiples. Reduced motion: still. */
      const G = (air.gust = RM ? 0 : 0.65 + 0.35 * Math.sin(t * 1.122));
      if (G)
        for (const S of sway) {
          const { im, list } = S;
          for (let k2 = 0; k2 < list.length; k2++) {
            const o = list[k2]!;
            const ph = o.ph ?? 0;
            const sa = Math.sin(t * 2.244 + ph);
            const sb = Math.sin(t * 1.496 + ph * 1.7);
            if (S.kind === 'petal') {
              if (o.dr) {
                dm.position.set(o.x + 0.17 * Math.sin(t * 0.748 + ph), o.y + 0.1 * Math.sin(t * 1.122 + ph * 2.1), (o.z ?? 0) + 0.06 + 0.045 * sa);
                dm.rotation.set((o.rx ?? 0) + 0.5 + 0.45 * sa, 0.5 * sb, (o.rz ?? 0) + 0.6 * Math.sin(t * 0.748 + ph));
              } else {
                dm.position.set(o.x, o.y, o.z ?? 0);
                dm.rotation.set((o.rx ?? 0) + G * 0.26 * (0.5 + 0.5 * sa), G * 0.12 * sb, (o.rz ?? 0) + 0.03 * sb);
              }
            } else if (S.kind === 'bloom') {
              dm.position.set(o.x, o.y, o.z ?? 0);
              dm.rotation.set((o.rx ?? 0) + G * 0.075 * Math.sin(t * 2.244 + ph + (o.rg ?? 0) * 0.55) * (1 + (o.rg ?? 0) * 0.25), 0, (o.rz ?? 0) + G * 0.03 * sb);
            } else {
              dm.position.set(o.x, o.y, o.z ?? 0);
              dm.rotation.set((o.rx ?? 0) + G * 0.16 * (0.5 + 0.5 * sa), 0, (o.rz ?? 0) + G * 0.05 * sb);
            }
            dm.scale.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
            dm.updateMatrix();
            im.setMatrixAt(k2, dm.matrix);
          }
          im.instanceMatrix.needsUpdate = true;
        }
      /* the glints: a wave crosses the picture every 5.6 s; each rises in ~0.3 s and falls in ~0.7 s — never a strobe */
      if (glints) {
        const ca = glints.col.array as Float32Array;
        const tint = glints.tint;
        glints.list.forEach((o, i) => {
          let u = (t / 5.6 - o.x * 0.13 - o.y * 0.08 + hash(i, 4) * 0.5) % 1;
          if (u < 0) u += 1;
          let pz = RM ? (i % 3 ? 0 : 0.45) : u < 0.05 ? u / 0.05 : u < 0.17 ? 1 - (u - 0.05) / 0.12 : 0;
          pz = pz * pz * (3 - 2 * pz);
          ca[i * 3] = pz * tint[0];
          ca[i * 3 + 1] = pz * tint[1];
          ca[i * 3 + 2] = pz * tint[2];
        });
        glints.col.needsUpdate = true;
      }
      if (!RM) spk.position.set(2.6 * Math.sin(t * 1.122), -1.8 + 1.4 * Math.cos(t * 1.122), 3.2);
      /* the camera: a slow creep in from the first moment; then it swings up over the box and comes down onto the card */
      const creep = on ? clamp(tau / 5.0, 0, 1) : 0;
      const th = 0.63 * (1 - end);
      const phc = 0.21 * (1 - end);
      const dist = (9.7 - 0.9 * creep) * (1 - end) + (CH / 2 / R15) * end;
      const tx = 0;
      const ty = -0.12 * (1 - end);
      const tz = 0.5 * (1 - end) + CZ * end;
      const fl = on && !RM ? 1 - last : 0;
      cam.up.set(0, 1, 0);
      cam.position.set(tx - Math.sin(th) * Math.sin(phc) * dist + 0.02 * Math.sin(t * 0.6) * fl, ty - Math.sin(th) * Math.cos(phc) * dist + 0.015 * Math.sin(t * 0.83) * fl, tz + Math.cos(th) * dist);
      cam.lookAt(tx, ty, tz);
      vig.quaternion.copy(cam.quaternion);
      vig.position.copy(cam.position).add(fwd.set(0, 0, -1).applyQuaternion(cam.quaternion));
      vig.material.opacity = 1 - last;
    },
    /* 📷 the post pass: the scene to a target, a slight depth of field on the ground (sharp on the box, softer toward the
       edges, fading out before the card fills the screen), film tone, a light film curve and grain; the glints after it,
       so they stay crisp. The card's window (alpha 0) is carried through, so the page shows through it. */
    render(r, scene, camera) {
      r.getDrawingBufferSize(sz);
      if (!PP.rt || PP.rt.width !== sz.x || PP.rt.height !== sz.y) {
        PP.rt?.dispose();
        PP.rt = new THREE.WebGLRenderTarget(sz.x, sz.y, {
          samples: 4,
          type: halfFloatTargets(r) ? THREE.HalfFloatType : THREE.UnsignedByteType,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          generateMipmaps: false,
        });
        if (!PP.pq) {
          PP.pq = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            new THREE.ShaderMaterial({
              uniforms: { tx: { value: null }, px: { value: new THREE.Vector2() }, k: { value: 1 }, tm: { value: 0 } },
              depthTest: false,
              depthWrite: false,
              vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
              fragmentShader: [
                'uniform sampler2D tx; uniform vec2 px; uniform float k, tm; varying vec2 v;',
                'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
                'void main(){',
                /* sharp on the box, softer toward the edges of the ground */
                '  vec2 q = abs(v - vec2(.5, .53)) - vec2(.36, .39); float d = length(max(q, 0.)); float rad = k * 4.6 * smoothstep(.0, .22, d);',
                '  vec4 c = texture2D(tx, v);',
                '  if (rad > .25) { c *= .2; for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996, rr = sqrt((float(i) + .5) / 12.) * rad; c += texture2D(tx, v + vec2(cos(a), sin(a)) * rr * px) * (.8 / 12.); } }',
                '  gl_FragColor = c;',
                '  #include <tonemapping_fragment>',
                '  #include <colorspace_fragment>',
                '  vec3 f = clamp(gl_FragColor.rgb, 0., 1.);',
                '  gl_FragColor.rgb = mix(f, f * f * (3. - 2. * f), .1) + (h(v * 913. + tm) - .5) * .022 * gl_FragColor.a;',
                '}',
              ].join('\n'),
            }),
          );
          PP.ps = new THREE.Scene();
          PP.ps.add(PP.pq);
          PP.pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        }
      }
      const u = PP.pq!.material.uniforms;
      u.tx!.value = PP.rt.texture;
      (u.px!.value as THREE.Vector2).set(1 / sz.x, 1 / sz.y).multiplyScalar(r.getPixelRatio());
      u.k!.value = dof;
      u.tm!.value = RM ? 0 : tnow % 7;
      r.setRenderTarget(PP.rt);
      r.clear();
      r.render(scene, camera);
      r.setRenderTarget(null);
      r.render(PP.ps!, PP.pc!);
      if (gscene && dof > 0.5) {
        const ac = r.autoClear;
        r.autoClear = false;
        r.render(gscene, camera);
        r.autoClear = ac;
      }
    },
    dispose() {
      PP.rt?.dispose();
      PP.pq?.geometry.dispose();
      PP.pq?.material.dispose();
      gscene?.traverse((o) => {
        const p = o as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
        p.geometry?.dispose();
        p.material?.map?.dispose();
        p.material?.dispose?.();
      });
    },
  };
};
