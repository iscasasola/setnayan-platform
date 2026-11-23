/**
 * 🎭 THE CLOTH REVEALS — one cloth, the shipped veil's (drawing `src/drape.js`): the same grid, the same strain-soft
 * solver, the same hem lift and finger pinch as `veil-reveal.tsx` / `lib/veil-cloth.ts`, with the same owner-locked
 * numbers (`DEFAULT_VEIL_LOOK`). Three reveals:
 *   · Beach curtains — the veil's cloth in a thicker thread, two halves on a rod, rings sliding apart;
 *   · Fabric        — one opaque satin drape, let go and drawn slowly off the cover like a car reveal;
 *   · Veil (still)  — only for reduced motion: the closed veil drawn once, then a cross-fade (the live veil is
 *                     `veil-reveal.tsx`, untouched by this file).
 * The solver here keeps the drawing's one addition — a top pin may be let go (`free`, the fabric) — which the
 * shipped `relaxPass` (pins = the first row, always) does not model.
 */
import * as THREE from 'three';
import { ss } from '@/lib/reveal-motion';
import { DEFAULT_VEIL_LOOK } from '@/lib/reveal-config-pure';
import { CAMZ, FZ, canvas, ctx2d, shadowsOnly, stamp, texOf, veilLights, type Ctx, type Pt, type Scene } from './kit';

const L = DEFAULT_VEIL_LOOK;
const COMP = 0.16;
const TENB = 0.42;
const CLAMP = 1.012;
const RELAX = 6;
const CLAMPS = 4;
const env = (rf: number) => 0.16 + 0.84 * Math.pow(rf, 1.5);

/** The tulle: a ground and crossed threads, drawn as `lib/veil-style.ts` `weaveOf` draws them — the logo woven in. */
function weave(c: Ctx, ground: string, threadAlpha: number, pitch: number, line: number, mark: [number, number] | null): THREE.Texture {
  const S = 1024;
  const k = canvas(S, S);
  const a = ctx2d(k);
  a.fillStyle = ground;
  a.fillRect(0, 0, S, S);
  a.strokeStyle = `rgba(255,255,255,${threadAlpha})`;
  a.lineWidth = line;
  for (let d = -S; d < S * 2; d += pitch) {
    a.beginPath();
    a.moveTo(d, 0);
    a.lineTo(d + S, S);
    a.stroke();
    a.beginPath();
    a.moveTo(d, S);
    a.lineTo(d + S, 0);
    a.stroke();
  }
  if (mark) stamp(a, c.logo, S / 2, S / 2, S * mark[0], '#ffffff', mark[1]);
  return texOf(k, { repeat: true, aniso: 8 });
}

/** The veil's material: matte cloth, whiter and more solid where it folds away from you (its Fresnel sheen). */
function clothMaterial(o: { color: string; rough?: number; opacity?: number; solid?: boolean; map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; fresnel?: number; fresnelA?: number }): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(o.color),
    roughness: o.rough ?? 0.82,
    metalness: 0,
    transparent: true,
    opacity: o.opacity ?? 0.92,
    side: THREE.DoubleSide,
    depthWrite: o.solid === true,
    map: o.map ?? null,
    alphaMap: o.alphaMap ?? null,
  });
  const fr = (o.fresnel ?? 0.6).toFixed(3);
  const fa = (o.fresnelA ?? 0.45).toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader =
      'varying vec3 vWP;varying vec3 vNN;\n' +
      sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;vNN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader =
      'varying vec3 vWP;varying vec3 vNN;\n' +
      sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\nvec3 V=normalize(cameraPosition-vWP);float fr=pow(1.0-abs(dot(V,normalize(vNN))),1.8);gl_FragColor.rgb+=fr*${fr};gl_FragColor.a=clamp(gl_FragColor.a+fr*${fa},0.0,1.0);`,
      );
  };
  return mat;
}

type DrapeCfg = { weight: number; bounce: number; float: number; trail: number; wind: number; full: number; folds: number; reach: number; valance: number; liftPk: number; hold: number; stretch: number };
type DrapeOpts = {
  cols?: number;
  rows?: number;
  mode?: 'veil' | 'curtain' | 'slide';
  side?: number;
  twist?: number;
  keep?: boolean;
  x0?: number;
  x1?: number;
  material: THREE.MeshStandardMaterial;
  tilePx?: number;
  shadow?: boolean;
  flipU?: boolean;
  cfg?: Partial<DrapeCfg>;
};
type Lead = { k: number; ox: number; oy: number; w: number };

class Drape {
  cols: number;
  rows: number;
  N: number;
  cfg: DrapeCfg;
  mode: 'veil' | 'curtain' | 'slide';
  side: number;
  twist: number;
  keep: boolean;
  hang = 0;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  qx: Float32Array;
  qy: Float32Array;
  qz: Float32Array;
  free: Uint8Array;
  topPin: number;
  clothH: number;
  pinW: number;
  dy: number;
  pinX: Float32Array;
  pin0: Float32Array;
  rowDx: Float32Array;
  ca: Int32Array;
  cb: Int32Array;
  cr: Float64Array;
  geo: THREE.PlaneGeometry;
  pos: THREE.BufferAttribute;
  mesh: THREE.Mesh;
  grabs: Record<number, { cluster: Array<{ k: number; ox: number; oy: number }>; cx: number; cy: number }> = {};
  t = 0;
  settling = false;
  tapAt: Pt | null = null;
  lead: Lead[] | null = null;
  constructor(
    private c: Ctx,
    o: DrapeOpts,
  ) {
    const cols = (this.cols = o.cols ?? 66);
    const rows = (this.rows = o.rows ?? 50);
    const N = (this.N = cols * rows);
    const { vh, vw } = c;
    this.cfg = { weight: L.weight, bounce: L.bounce, float: L.floatUp, trail: L.trail, wind: L.wind, full: L.fullness, folds: L.folds, reach: L.reaches, valance: L.topValance, liftPk: L.liftPk, hold: L.hold, stretch: L.stretch, ...(o.cfg ?? {}) };
    const cf = this.cfg;
    this.mode = o.mode ?? 'veil';
    this.side = o.side ?? 0;
    this.twist = o.twist ?? 0;
    this.keep = !!o.keep;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.pz = new Float32Array(N);
    this.qx = new Float32Array(N);
    this.qy = new Float32Array(N);
    this.qz = new Float32Array(N);
    this.free = new Uint8Array(cols);
    this.topPin = vh * 1.06;
    this.clothH = vh * (2.12 - cf.reach / 47);
    const x0 = o.x0 ?? -vw * 1.2;
    const x1 = o.x1 ?? vw * 1.2;
    const pinW = (this.pinW = x1 - x0);
    const extra = 0.04 + (cf.full / 100) * 0.4;
    this.dy = this.clothH / (rows - 1);
    this.pinX = new Float32Array(cols);
    this.pin0 = new Float32Array(cols);
    this.rowDx = new Float32Array(rows);
    for (let ix = 0; ix < cols; ix++) this.pin0[ix] = this.pinX[ix] = x0 + (ix / (cols - 1)) * pinW;
    for (let iy = 0; iy < rows; iy++) this.rowDx[iy] = (pinW * (1 + extra * env(iy / (rows - 1)))) / (cols - 1);
    const A: number[] = [];
    const B: number[] = [];
    const R: number[] = [];
    for (let iy = 0; iy < rows; iy++)
      for (let ix = 0; ix < cols; ix++) {
        const a = iy * cols + ix;
        if (ix < cols - 1) {
          A.push(a);
          B.push(a + 1);
          R.push(this.rowDx[iy]!);
        }
        if (iy < rows - 1) {
          A.push(a);
          B.push(a + cols);
          R.push(this.dy);
        }
        if (ix < cols - 1 && iy < rows - 1) {
          A.push(a);
          B.push(a + cols + 1);
          R.push(Math.hypot(this.rowDx[iy]!, this.dy));
        }
      }
    this.ca = new Int32Array(A);
    this.cb = new Int32Array(B);
    this.cr = new Float64Array(R);
    const geo = (this.geo = new THREE.PlaneGeometry(pinW, this.clothH, cols - 1, rows - 1));
    this.pos = geo.attributes.position as THREE.BufferAttribute;
    if (o.flipU) {
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    this.mesh = new THREE.Mesh(geo, o.material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = !!o.shadow;
    if (o.material.alphaMap && o.tilePx) o.material.alphaMap.repeat.set(((pinW / (2 * vw)) * c.px.w) / o.tilePx, ((this.clothH / (2 * vh)) * c.px.h) / o.tilePx);
    for (let iy = 0; iy < rows; iy++)
      for (let ix = 0; ix < cols; ix++) {
        const q = iy * cols + ix;
        const fx = ix / (cols - 1);
        const rf = iy / (rows - 1);
        this.px[q] = this.pin0[ix]!;
        this.py[q] = this.topPin - iy * this.dy;
        this.pz[q] = iy === 0 ? FZ : FZ + (cf.full / 100) * 0.26 * env(rf) * Math.sin(fx * 6.2832 * cf.folds * (pinW / (2.4 * vw)) + rf * this.twist);
        this.qx[q] = this.px[q]!;
        this.qy[q] = this.py[q]!;
        this.qz[q] = this.pz[q]!;
      }
    this.settling = true;
    for (let s = 0; s < 120; s++) this.step(1 / 60, 0, false);
    this.settling = false;
    this.sync();
  }
  relax(maxS: number): void {
    const { px, py, pz, ca, cb, cr, cols, free: fr } = this;
    for (let c = 0, n = ca.length; c < n; c++) {
      const A = ca[c]!;
      const B = cb[c]!;
      const rest = cr[c]!;
      const ex = px[B]! - px[A]!;
      const ey = py[B]! - py[A]!;
      const ez = pz[B]! - pz[A]!;
      const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
      const diff = dd - rest;
      const strain = diff / rest;
      const stiff = strain <= 0 ? COMP : TENB + (1 - TENB) * Math.min(1, strain / maxS);
      const f = (diff / dd) * stiff * 0.5;
      const ox = ex * f;
      const oy = ey * f;
      const oz = ez * f;
      if (A >= cols || fr[A]) {
        px[A] = px[A]! + ox;
        py[A] = py[A]! + oy;
        pz[A] = pz[A]! + oz;
      }
      if (B >= cols || fr[B]) {
        px[B] = px[B]! - ox;
        py[B] = py[B]! - oy;
        pz[B] = pz[B]! - oz;
      }
    }
  }
  clampPass(): void {
    const { px, py, pz, ca, cb, cr, cols, free: fr } = this;
    for (let c = 0, n = ca.length; c < n; c++) {
      const A = ca[c]!;
      const B = cb[c]!;
      const lim = cr[c]! * CLAMP;
      const ex = px[B]! - px[A]!;
      const ey = py[B]! - py[A]!;
      const ez = pz[B]! - pz[A]!;
      const dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-4;
      if (dd > lim) {
        const f = ((dd - lim) / dd) * 0.5;
        const ox = ex * f;
        const oy = ey * f;
        const oz = ez * f;
        if (A >= cols || fr[A]) {
          px[A] = px[A]! + ox;
          py[A] = py[A]! + oy;
          pz[A] = pz[A]! + oz;
        }
        if (B >= cols || fr[B]) {
          px[B] = px[B]! - ox;
          py[B] = py[B]! - oy;
          pz[B] = pz[B]! - oz;
        }
      }
    }
  }
  step(dt: number, lift: number, fth: boolean): void {
    const { cfg: cf, cols, rows, N, px, py, pz, qx, qy, qz } = this;
    const { vh, vw } = this.c;
    this.t += dt;
    const t = this.t;
    const le = ss(0, 0.7, lift);
    const veil = this.mode === 'veil';
    const slide = this.mode === 'slide';
    if (this.keep && lift > 0.02 && this.hang < 1) this.hang = Math.min(1, this.hang + 1 / 60);
    let drag = slide ? 0.955 : this.keep && lift > 0.5 ? 0.9 : 0.952 + (cf.bounce / 100) * 0.03 + (fth ? 0.012 : 0);
    let g = -(2.5 + (cf.weight / 100) * 7) * (fth && veil && !this.keep ? 0.5 : 1) * (1 - (veil ? (cf.float / 100) * 0.92 * le * (1 - this.hang) : 0));
    const wind = this.settling ? 0 : (cf.wind / 100) * 5 * (slide && lift > 0.004 ? 0 : 1);
    if (this.mode === 'curtain') {
      /* its rings slide along the rod: the inner ring leads; each ring stops against the next */
      const s = this.side;
      const inner = s < 0 ? this.pin0[cols - 1]! : this.pin0[0]!;
      const outer = s < 0 ? this.pin0[0]! : this.pin0[cols - 1]!;
      const gap = 0.0105;
      const edge = inner + (outer - inner) * ss(0.0, 0.86, lift) + s * 0.9 * ss(0.8, 1, lift) * vw;
      for (let ix = 0; ix < cols; ix++) {
        const n = s < 0 ? cols - 1 - ix : ix;
        const lim = edge + s * n * gap;
        this.pinX[ix] = s < 0 ? Math.min(this.pin0[ix]!, lim) : Math.max(this.pin0[ix]!, lim);
      }
    }
    if (slide && lift > 0.004) for (let ix = 0; ix < cols; ix++) this.free[ix] = 1;
    if (slide) {
      g = 0;
      drag = 0.86;
    }
    for (let k = 0; k < N; k++) {
      if (k < cols && !this.free[k]) {
        px[k] = this.pinX[k]!;
        py[k] = this.topPin + 0.005 * Math.sin(t * 0.7 + k * 0.3);
        pz[k] = FZ + (this.mode === 'curtain' ? 0.03 * Math.sin(k * 1.9) * ss(0.1, 0.7, lift) : 0);
        qx[k] = px[k]!;
        qy[k] = py[k]!;
        qz[k] = pz[k]!;
        continue;
      }
      const ix = k % cols;
      const iy = (k / cols) | 0;
      const rf = iy / (rows - 1);
      const we = rf * rf * (0.35 + 0.65 * rf);
      const aw = wind * we * (Math.sin(t * 0.6 + iy * 0.24 + ix * 0.13) + 0.35 * Math.sin(t * 1.1 + ix * 0.3));
      const az = wind * 0.55 * we * Math.cos(t * 0.5 + ix * 0.12 + iy * 0.1);
      const nx = px[k]! + (px[k]! - qx[k]!) * drag + aw * dt * dt;
      const ny = py[k]! + (py[k]! - qy[k]!) * drag + g * dt * dt;
      const nz = pz[k]! + (pz[k]! - qz[k]!) * drag + az * dt * dt;
      qx[k] = px[k]!;
      qy[k] = py[k]!;
      qz[k] = pz[k]!;
      px[k] = nx;
      py[k] = ny;
      pz[k] = nz;
    }
    if (veil && lift > 0.015) {
      let pull0 = (0.05 + (cf.trail / 100) * 0.32) * ss(0.02, 0.42, lift);
      const hemUp = Math.max(0.2, this.clothH / vh - 4 * ((this.keep ? L.drape : cf.valance) / 100));
      const hy = this.topPin + vh * hemUp * ss(0.02, 1, lift);
      const hz = FZ - 0.25;
      const tp = this.tapAt;
      const tfx = tp ? (tp.x - this.pin0[0]!) / this.pinW : -1;
      if (tp) {
        if (!this.lead) this.lead = this.leadAround(tp, 0.2, cols);
        const up = ss(0.0, 0.9, lift);
        const ly = tp.y + (this.topPin + vh * (this.keep ? 0.02 : 0.5) - tp.y) * up;
        const lx = tp.x * (1 - 0.35 * up);
        const lz = FZ + 0.55 * Math.sin(Math.PI * Math.min(1, up * 1.15)) - 0.25 * up;
        const lw = 0.22 * ss(0.0, 0.12, lift) * (this.keep ? 1 - ss(0.75, 1, lift) : 1);
        for (const Lk of this.lead) {
          const ww = lw * Lk.w;
          px[Lk.k] = px[Lk.k]! + (lx + Lk.ox * (1 - 0.7 * up) - px[Lk.k]!) * ww;
          py[Lk.k] = py[Lk.k]! + (ly + Lk.oy * (1 - 0.7 * up) - py[Lk.k]!) * ww;
          pz[Lk.k] = pz[Lk.k]! + (lz - pz[Lk.k]!) * ww;
        }
        pull0 *= ss(0.18, 0.6, lift);
      }
      for (let ix = 0; ix < cols; ix++) {
        const fx = ix / (cols - 1);
        const endW = tp ? Math.exp(-Math.pow((fx - tfx) / 0.34, 2)) : Math.max(0, 1 - Math.min(fx, 1 - fx) / 0.3);
        const w = pull0 * (0.3 + 0.7 * endW);
        const vk = (rows - 1) * cols + ix;
        px[vk] = px[vk]! + (this.pinX[ix]! - px[vk]!) * w * 0.4;
        py[vk] = py[vk]! + (hy - py[vk]!) * w;
        pz[vk] = pz[vk]! + (hz - pz[vk]!) * w;
      }
    }
    if (slide && lift > 0.004) {
      /* the hand: it lifts a pinch of cloth and walks it down and off */
      const sp = this.tapAt ?? { x: 0, y: -vh * 0.55 };
      if (!this.lead) this.lead = this.leadAround(sp, 0.26, 0);
      const dn = ss(0.0, 1, lift);
      const hx = sp.x * (1 - 0.6 * dn);
      const hy2 = sp.y + (-vh * 3.4 - sp.y) * dn;
      const hz2 = FZ + 0.22 * Math.sin(Math.PI * Math.min(1, dn * 3));
      const hw = 0.5 * ss(0.0, 0.06, lift);
      for (const Sk of this.lead) {
        const wz = hw * Sk.w;
        px[Sk.k] = px[Sk.k]! + (hx + Sk.ox * 0.25 - px[Sk.k]!) * wz;
        py[Sk.k] = py[Sk.k]! + (hy2 + Sk.oy * 0.25 - py[Sk.k]!) * wz;
        pz[Sk.k] = pz[Sk.k]! + (hz2 - pz[Sk.k]!) * wz;
      }
    }
    const maxS = 0.004 + (cf.stretch / 100) * 0.12;
    const pz0 = FZ + (cf.liftPk / 100) * 0.9;
    const gl = Object.values(this.grabs);
    for (let it = 0; it < RELAX; it++) {
      for (const gg of gl) {
        for (const cl of gg.cluster) {
          const kk = cl.k;
          if (kk < cols && !this.free[kk]) continue;
          px[kk] = px[kk]! + (gg.cx + cl.ox * 0.3 - px[kk]!) * 0.4;
          py[kk] = py[kk]! + (gg.cy + cl.oy * 0.3 - py[kk]!) * 0.4;
          pz[kk] = pz[kk]! + (pz0 - pz[kk]!) * 0.32;
        }
      }
      this.relax(maxS);
    }
    for (let s = 0; s < CLAMPS; s++) this.clampPass();
    if (slide && lift > 0.004) {
      const sm = 0.22;
      for (let iy = 1; iy < rows - 1; iy++)
        for (let ix = 1; ix < cols - 1; ix++) {
          const k = iy * cols + ix;
          px[k] = px[k]! + ((px[k - 1]! + px[k + 1]! + px[k - cols]! + px[k + cols]!) * 0.25 - px[k]!) * sm;
          py[k] = py[k]! + ((py[k - 1]! + py[k + 1]! + py[k - cols]! + py[k + cols]!) * 0.25 - py[k]!) * sm;
          pz[k] = pz[k]! + ((pz[k - 1]! + pz[k + 1]! + pz[k - cols]! + pz[k + cols]!) * 0.25 - pz[k]!) * sm;
        }
      for (let k = 0; k < N; k++) pz[k] = Math.min(FZ + 0.5, Math.max(FZ - 0.02, pz[k]!));
    }
    if (!this.settling) this.sync();
  }
  private leadAround(p: Pt, R: number, from: number): Lead[] {
    const out: Lead[] = [];
    for (let k = from; k < this.N; k++) {
      const dx = this.px[k]! - p.x;
      const dy = this.py[k]! - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R * R) out.push({ k, ox: dx, oy: dy, w: 1 - Math.sqrt(d2) / R });
    }
    return out;
  }
  sync(): void {
    const p = this.pos.array as Float32Array;
    const zc = CAMZ - 0.7;
    for (let k = 0, o = 0; k < this.N; k++, o += 3) {
      p[o] = this.px[k]!;
      p[o + 1] = this.py[k]!;
      p[o + 2] = Math.min(zc, this.pz[k]!);
    }
    this.pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
  grab(id: number, w: Pt): boolean {
    const Rr = 0.018 + (this.cfg.hold / 100) * 0.1;
    const R2 = Rr * Rr;
    const cl: Array<{ k: number; ox: number; oy: number }> = [];
    let best = -1;
    let bd = 1e9;
    for (let k = this.cols; k < this.N; k++) {
      const dx = this.px[k]! - w.x;
      const dy = this.py[k]! - w.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2) cl.push({ k, ox: dx, oy: dy });
      if (d2 < bd) {
        bd = d2;
        best = k;
      }
    }
    if (!cl.length) {
      if (bd > 0.25) return false;
      cl.push({ k: best, ox: 0, oy: 0 });
    }
    this.grabs[id] = { cluster: cl, cx: w.x, cy: w.y };
    return true;
  }
  drag(id: number, w: Pt): void {
    const g = this.grabs[id];
    if (g) {
      g.cx = w.x;
      g.cy = w.y;
    }
  }
  release(id: number): void {
    delete this.grabs[id];
  }
}

function clothScene(o: { dir?: readonly [number, number]; push?: number; srgb?: boolean; fromTap?: boolean; build: (c: Ctx) => Promise<Drape[]> | Drape[] }): Scene {
  let drapes: Drape[] = [];
  return {
    dir: o.dir,
    push: o.push,
    srgb: o.srgb ?? true,
    dragZ: FZ + 0.63,
    async init(c) {
      drapes = await o.build(c);
      for (const d of drapes) c.scene.add(d.mesh);
    },
    step(dt, _t, lift, fth) {
      for (const d of drapes) d.step(dt, lift, fth);
    },
    opened(wx, wy) {
      if (o.fromTap) for (const d of drapes) d.tapAt = { x: wx, y: wy };
    },
    grab(id, w) {
      for (const d of drapes) d.grab(id, w);
    },
    drag(id, w) {
      for (const d of drapes) d.drag(id, w);
    },
    release(id) {
      for (const d of drapes) d.release(id);
    },
  };
}

/** 2 · BEACH CURTAINS — the veil's cloth in a thicker thread, hung in two halves on a rod, parting sideways. */
export const beachCurtains = (): Scene =>
  clothScene({
    build(c) {
      veilLights(c, 0.42);
      shadowsOnly(c, 0.22);
      const { vw } = c;
      const out: Drape[] = [];
      for (const side of [-1, 1]) {
        const mat = clothMaterial({ color: '#efe6d6', alphaMap: weave(c, '#d2d2d2', 0.5, 6, 2.2, [0.5, 0.75]), opacity: 1, fresnel: 0.2, fresnelA: 0.35 });
        out.push(
          new Drape(c, {
            cols: 40,
            rows: 50,
            mode: 'curtain',
            side,
            x0: side < 0 ? -vw * 1.12 : -0.04,
            x1: side < 0 ? 0.04 : vw * 1.12,
            material: mat,
            tilePx: 96,
            shadow: true,
            flipU: side > 0,
            cfg: { weight: 52, wind: 34, full: 100, folds: 16, reach: 2 },
          }),
        );
      }
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, vw * 2.6, 12), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6 }));
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, c.vh * 1.04, FZ + 0.02);
      c.scene.add(rod);
      return out;
    },
  });

/** 5 · FABRIC — one twisted drape of satin, the logo embroidered large; it slides off slowly, the last corner trailing. */
export const fabric = (): Scene =>
  clothScene({
    dir: [0, 1],
    push: 0.14,
    fromTap: true,
    async build(c) {
      veilLights(c, 0.5);
      shadowsOnly(c, 0.3);
      const sc = canvas(512, 888);
      const sx = ctx2d(sc);
      sx.fillStyle = '#d8c49a';
      sx.fillRect(0, 0, 512, 888);
      const satin = await c.art('satin');
      sx.drawImage(satin, 0, 0, 512, 888);
      stamp(sx, c.logo, 258, 446, 250, '#7a6238', 0.35);
      stamp(sx, c.logo, 256, 444, 250, '#fff6dc', 0.7);
      const mat = clothMaterial({ color: '#f1e4cf', map: texOf(sc), opacity: 1, rough: 0.5, fresnel: 0.3, fresnelA: 0, solid: true });
      return [new Drape(c, { cols: 88, rows: 76, mode: 'slide', material: mat, twist: 5.5, shadow: true, cfg: { weight: 30, wind: 14, full: 100, folds: 7, reach: 0, bounce: 90 } })];
    },
  });

/** ♿ The veil, closed and still — the reduced-motion face of the shipped veil (the drawing's veil: its weave and logo). */
export const veilStill = (): Scene =>
  clothScene({
    push: 0.07,
    fromTap: true,
    build(c) {
      veilLights(c, 0.8);
      const mat = clothMaterial({ color: c.veilColor, alphaMap: weave(c, '#4e4e4e', 0.075, 12, 2, [0.42, 0.5]) });
      return [new Drape(c, { material: mat, tilePx: 125, keep: true })];
    },
  });
