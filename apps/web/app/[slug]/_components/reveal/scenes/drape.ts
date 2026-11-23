/**
 * 🎭 THE CLOTH REVEALS — one cloth, the shipped veil's (drawing `src/drape.js`): the same grid, the same strain-soft
 * solver, the same hem lift and finger pinch as `veil-reveal.tsx` / `lib/veil-cloth.ts`, with the same owner-locked
 * numbers (`DEFAULT_VEIL_LOOK`). Three reveals:
 *   · Beach curtains — the veil's cloth in a thicker thread, two halves on a rod, rings sliding apart;
 *   · Fabric        — one opaque satin drape lying crumpled like the pilak satin, taken by a palm of cloth and drawn
 *                     slowly off the cover like a car reveal, its creases easing out as it goes;
 *   · Veil (still)  — only for reduced motion: the closed veil drawn once, then a cross-fade (the live veil is
 *                     `veil-reveal.tsx`, untouched by this file).
 * The solver here keeps the drawing's one addition — a top pin may be let go (`free`, the fabric) — which the
 * shipped `relaxPass` (pins = the first row, always) does not model.
 */
import * as THREE from 'three';
import { ss } from '@/lib/reveal-motion';
import { DEFAULT_VEIL_LOOK } from '@/lib/reveal-config-pure';
import { CAMZ, FZ, canvas, ctx2d, shadowsOnly, stamp, texOf, veilLights, wideness, type Ctx, type Pt, type Scene } from './kit';

const L = DEFAULT_VEIL_LOOK;
const COMP = 0.16;
const TENB = 0.42;
const CLAMP = 1.012;
const RELAX = 6;
const CLAMPS = 4;
const env = (rf: number) => 0.16 + 0.84 * Math.pow(rf, 1.5);
/* 🤲 A HAND, NOT A PIXEL (owner 23 Nov: *"fabric should not be grabbed in 1 pixel, have a bigger coverage so the pixels
   do not get distorted"*). A finger, a tap and the slide's hand all take a palm-wide patch of cloth: its radius is
   measured in the cloth's own size (`vh`, half the cover's height), never in pixels, and set by the look's tap-pinch
   `hold` (22 → about a palm on a phone). The pull fades out across the patch (a bell, not an edge), and the patch is
   only gathered a little in the hand (`GATHER`) — never squeezed to a point, which is what spiked the mesh and
   stretched the satin. */
const palmR = (vh: number, hold: number) => vh * (0.12 + (hold / 100) * 0.32);
const bell = (d2: number, R: number) => Math.exp((-d2 * 3) / (R * R));
const GATHER = 0.85;
/* While a hand holds or walks the cloth, the stretch clamp runs more passes, so no spring ends a frame much past its
   rest length (the texture never smears between a held patch and the rest). */
const HELD_CLAMPS = 1;
/** …and this many more once the frame's relaxing is done (a held cloth only) */
const HELD_FINAL = 5;
/** the satin's stiffness against folding one thread wide (`bend`) */
const BEND = 0.14;

/**
 * 🧵 THE PILAK SATIN'S FORM (owner 23 Nov: *"we want fabric to be crumpled like that and be pulled from that form"*;
 * the reference is `prototypes/maker_themes_redraw_2026-11-23/batch6/art/pilak.webp` in the specs, never shipped):
 * a few deep, rounded folds swirling into one gather a little right of centre, wide soft crests and narrower creased
 * valleys, uneven in width and depth like real cloth. Its height off the cover (≥ 0) at a point of the CLOTH (its
 * flat rest position), in the cloth's own size (`vh`), so a wide screen gathers more satin, never wider satin.
 * The folds are REAL slack, never a height painted on: the cloth is gathered in until every thread is at its own
 * length again, so the satin's picture is never stretched over a fold (and pulled, the folds straighten out).
 */
function crumpleZ(x: number, y: number, vh: number): number {
  const u = x / vh - 0.16;
  const v = y / vh - 0.08;
  const r = Math.hypot(u, v);
  const th = Math.atan2(v, u);
  const wob = 0.8 * Math.sin(1.7 * u - 1.1 * v + 0.6) + 0.45 * Math.sin(3.1 * v + 0.9 * u);
  /* the swirl's eye is one soft pinch, not a point where every fold meets */
  const arm = 0.5 + 0.5 * ss(0.03, 0.2, r) * Math.cos(2 * th + 5 * r + 4.2 * Math.log(r + 0.1) + wob);
  /* deep, but no fold steeper than about 45° — steeper, and the gathered cloth folds over itself */
  const depth = 0.034 + 0.026 * Math.exp(-r * 1.4) + 0.013 * Math.sin(2.3 * u + 1.7 * v + 1.1);
  /* broad crests, narrower valleys — and a finite slope at the valley floor (a cusp there renders as a slit) */
  return arm * (1.6 - 0.6 * arm) * depth * vh;
}

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
  /** The pilak satin's crumpled rest (`crumpleZ`): it lies gathered, and the creases ease out as it is pulled. */
  crumple?: boolean;
  /** at most this many times the threads across on a wide screen (default 3) */
  wideMax?: number;
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
  /** Crumpled cloth (`crumpleZ`): each thread's fold height, which a soft shape spring holds while the cloth lies
      still; `held` is how much a hand has taken that thread right now (0 – 1), and the spring lets it go there. */
  fold: Float32Array | null = null;
  held: Float32Array | null = null;
  crease = 1;
  /** Where the slide's hand is this frame (the fold easing follows it). */
  hand: Pt | null = null;
  geo: THREE.PlaneGeometry;
  pos: THREE.BufferAttribute;
  mesh: THREE.Mesh;
  letGo = 0;
  grabs: Record<number, { cluster: Lead[]; cx: number; cy: number; x0: number; y0: number; age: number; off?: boolean; px?: number; py?: number }> = {};
  t = 0;
  settling = false;
  tapAt: Pt | null = null;
  lead: Lead[] | null = null;
  constructor(
    private c: Ctx,
    o: DrapeOpts,
  ) {
    /* 🖥 a wide screen hangs MORE cloth, not stretched cloth (owner 23 Nov: *"create more fabric … extend it"*): the
       weave is laid per pixel already, so here the threads across and the folds multiply with the width */
    const wide = wideness(c.px);
    const cols = (this.cols = Math.round((o.cols ?? 66) * Math.min(o.wideMax ?? 3, wide)));
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
    const extra = o.crumple ? 0 : 0.04 + (cf.full / 100) * 0.4;
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
        this.pz[q] = iy === 0 || o.crumple ? FZ : FZ + (cf.full / 100) * 0.26 * env(rf) * Math.sin(fx * 6.2832 * cf.folds * wide * (pinW / (2.4 * vw)) + rf * this.twist);
        this.qx[q] = this.px[q]!;
        this.qy[q] = this.py[q]!;
        this.qz[q] = this.pz[q]!;
      }
    if (o.crumple) {
      /* it lies gathered: the folds stand up, and the cloth is drawn in around them until every thread is its own
         length again (the pinned top row lies flat on the cover) */
      const fold = (this.fold = new Float32Array(N));
      this.held = new Float32Array(N);
      for (let q = 0; q < N; q++) fold[q] = ss(0, 0.06, Math.floor(q / cols) / (rows - 1)) * crumpleZ(this.px[q]!, this.py[q]!, vh);
      for (let it = 0; it < 90; it++) {
        for (let q = cols; q < N; q++) this.pz[q] = FZ + fold[q]!;
        this.relax(0.004);
        this.clampPass();
      }
      for (let q = cols; q < N; q++) this.pz[q] = FZ + fold[q]!;
      this.qx.set(this.px);
      this.qy.set(this.py);
      this.qz.set(this.pz);
    }
    this.settling = true;
    /* crumpled satin has already settled into its folds */
    for (let s = 0, n = o.crumple ? 40 : 120; s < n; s++) this.step(1 / 60, 0, false);
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
  /** Satin has a little stiffness: pushed together it buckles into rounded folds a few threads wide, never a zigzag one
   *  thread wide (which renders as a jagged slit). Each inner thread is drawn a touch toward its four neighbours. */
  bend(b: number): void {
    const { px, py, pz, cols, rows } = this;
    for (let iy = 1; iy < rows - 1; iy++)
      for (let ix = 1; ix < cols - 1; ix++) {
        const k = iy * cols + ix;
        px[k] = px[k]! + ((px[k - 1]! + px[k + 1]! + px[k - cols]! + px[k + cols]!) * 0.25 - px[k]!) * b * 0.5;
        py[k] = py[k]! + ((py[k - 1]! + py[k + 1]! + py[k - cols]! + py[k + cols]!) * 0.25 - py[k]!) * b * 0.5;
        pz[k] = pz[k]! + ((pz[k - 1]! + pz[k + 1]! + pz[k - cols]! + pz[k + cols]!) * 0.25 - pz[k]!) * b;
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
      /* crumpled satin may gather, never fold a triangle flat (a collapsed one renders as a slit) */
      const lo = this.fold ? cr[c]! * 0.72 : 0;
      if (dd > lim || dd < lo) {
        const f = ((dd - (dd > lim ? lim : lo)) / dd) * 0.5;
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
    if (this.held) {
      /* the crumple's hold eases as it lifts, and around the hand while it holds the cloth (a wide bell, three palms),
         so the pull can draw the folds out there first; it settles back slowly once let go */
      this.crease = 1 - ss(0.02, 0.6, lift);
      const hd = this.held;
      const RH = palmR(vh, cf.hold) * 3;
      const at: Array<[number, number, number]> = [];
      for (const gg of Object.values(this.grabs)) at.push([gg.cx, gg.cy, gg.off ? ss(0, 0.25, gg.age) : 1]);
      if (this.hand && lift > 0.004) at.push([this.hand.x, this.hand.y, ss(0, 0.08, lift)]);
      for (let k = 0; k < N; k++) {
        let want = 0;
        for (const [x, y, a] of at) {
          const dx = px[k]! - x;
          const dy = py[k]! - y;
          want = Math.max(want, Math.min(1, 1.4 * a * bell(dx * dx + dy * dy, RH)));
        }
        const h = hd[k]!;
        hd[k] = h + (want - h) * (want > h ? 0.3 : 0.015);
      }
    }
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
    if (this.fold && this.held) {
      /* the crumple holds while it lies still; it lets go as it lifts, and at once where a hand has it — then the pull
         straightens the folds out of the slack, thread by thread, never stretching them */
      const { fold, held } = this;
      for (let k = cols; k < N; k++) pz[k] = pz[k]! + (FZ + fold[k]! - pz[k]!) * 0.25 * this.crease * (1 - held[k]!);
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
      if (!this.lead) this.lead = this.leadAround(sp, palmR(vh, cf.hold) * 1.3, 0);
      const dn = ss(0.0, 1, lift);
      const hx = sp.x * (1 - 0.6 * dn);
      const hy2 = sp.y + (-vh * 3.4 - sp.y) * dn;
      const hz2 = FZ + 0.22 * Math.sin(Math.PI * Math.min(1, dn * 3));
      if (this.fold && this.hand) {
        /* crumpled satin: the cloth below the hand slides on ahead of it (carried, not pushed), so the slack never
           ploughs up under the hand */
        const dyH = hy2 - this.hand.y;
        for (let k = 0; k < N; k++) {
          const below = 0.9 * ss(0, 0.3, hy2 - py[k]!);
          if (below > 0) {
            py[k] = py[k]! + dyH * below;
            qy[k] = qy[k]! + dyH * below;
          }
        }
      }
      this.hand = { x: hx, y: hy2 };
      const hw = 0.5 * ss(0.0, 0.06, lift);
      for (const Sk of this.lead) {
        const wz = hw * Sk.w;
        px[Sk.k] = px[Sk.k]! + (hx + Sk.ox * GATHER - px[Sk.k]!) * wz;
        py[Sk.k] = py[Sk.k]! + (hy2 + Sk.oy * GATHER - py[Sk.k]!) * wz;
        pz[Sk.k] = pz[Sk.k]! + (hz2 - pz[Sk.k]!) * wz;
      }
    }
    const maxS = 0.004 + (cf.stretch / 100) * 0.12;
    /* the veil's hold lifts its cloth well forward; satin lying on the cover is gathered up a little, not tented */
    const pz0 = FZ + (cf.liftPk / 100) * (this.fold ? 0.3 : 0.9);
    const gl = Object.values(this.grabs);
    const held = gl.length > 0 || (this.lead !== null && lift > 0.004);
    if (this.fold) {
      /* crumpled satin under a finger: the cloth beyond the palm, the way it is pulled, goes along with the hand
         (carried, not pushed), so the slack never folds over itself in a lip */
      const R = palmR(vh, cf.hold);
      for (const gg of gl) {
        if (gg.off) continue;
        const mx = gg.cx - (gg.px ?? gg.x0);
        const my = gg.cy - (gg.py ?? gg.y0);
        gg.px = gg.cx;
        gg.py = gg.cy;
        const m = Math.hypot(mx, my);
        if (m < 1e-6) continue;
        const ux = mx / m;
        const uy = my / m;
        for (let k = cols; k < N; k++) {
          const dx = px[k]! - gg.cx;
          const dy = py[k]! - gg.cy;
          const ahead = dx * ux + dy * uy;
          const side = dx * uy - dy * ux;
          const w = 0.9 * ss(R * 0.6, R * 1.4, ahead) * bell(side * side, R * 2);
          if (w > 0.002) {
            px[k] = px[k]! + mx * w;
            py[k] = py[k]! + my * w;
            qx[k] = qx[k]! + mx * w;
            qy[k] = qy[k]! + my * w;
          }
        }
      }
    }
    /* a hand closes on the cloth over a quarter of a second — never a yank in one frame — and opens the same way */
    for (const [id, gg] of Object.entries(this.grabs)) {
      gg.age += gg.off ? -dt * 0.75 : dt;
      if (gg.off && gg.age <= 0) delete this.grabs[Number(id)];
    }
    for (let it = 0; it < RELAX; it++) {
      for (const gg of gl) {
        const take = ss(0, 0.25, gg.age);
        for (const cl of gg.cluster) {
          const kk = cl.k;
          if (kk < cols && !this.free[kk]) continue;
          const a = cl.w * take;
          px[kk] = px[kk]! + (gg.cx + cl.ox * GATHER - px[kk]!) * 0.4 * a;
          py[kk] = py[kk]! + (gg.cy + cl.oy * GATHER - py[kk]!) * 0.4 * a;
          pz[kk] = pz[kk]! + (pz0 - pz[kk]!) * 0.32 * a;
        }
      }
      this.relax(maxS);
      if (held) for (let s = 0; s < HELD_CLAMPS; s++) this.clampPass();
    }
    /* stiffer as it slides: the gathered hem folds in soft pleats, never in creases one thread wide */
    if (this.fold) this.bend(BEND * (1 + 2 * ss(0.02, 0.3, lift)));
    for (let s = 0, n = held ? HELD_FINAL : CLAMPS; s < n; s++) this.clampPass();
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
      if (d2 < R * R) out.push({ k, ox: dx, oy: dy, w: bell(d2, R) });
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
    /* the finger takes a palm of cloth around the nearest thread it touches — never one vertex */
    let best = -1;
    let bd = 1e9;
    for (let k = this.cols; k < this.N; k++) {
      const dx = this.px[k]! - w.x;
      const dy = this.py[k]! - w.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = k;
      }
    }
    if (best < 0 || bd > 0.25) return false;
    const at = { x: this.px[best]!, y: this.py[best]! };
    this.grabs[id] = { cluster: this.leadAround(at, palmR(this.c.vh, this.cfg.hold), this.cols), cx: at.x, cy: at.y, x0: at.x, y0: at.y, age: 0 };
    return true;
  }
  drag(id: number, w: Pt): void {
    const g = this.grabs[id];
    if (g) {
      /* the cloth gives about a palm and a bit before it holds back — a hand never drags it thin */
      const dx = w.x - g.x0;
      const dy = w.y - g.y0;
      const d = Math.hypot(dx, dy);
      const m = palmR(this.c.vh, this.cfg.hold) * 1.2;
      const k = d > m ? m / d : 1;
      g.cx = g.x0 + dx * k;
      g.cy = g.y0 + dy * k;
    }
  }
  release(id: number): void {
    /* the hand opens over a third of a second — the gathered cloth settles back, it never drops in one frame */
    const g = this.grabs[id];
    if (!g) return;
    g.off = true;
    g.age = Math.min(g.age, 0.25);
    delete this.grabs[id];
    this.grabs[-1 - this.letGo++] = g;
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
      const lap = 0.04 + 0.06 * (wideness(c.px) - 1);
      const out: Drape[] = [];
      for (const side of [-1, 1]) {
        const mat = clothMaterial({ color: '#efe6d6', alphaMap: weave(c, '#d2d2d2', 0.5, 6, 2.2, [0.5, 0.75]), opacity: 1, fresnel: 0.2, fresnelA: 0.35 });
        out.push(
          new Drape(c, {
            cols: 40,
            rows: 50,
            mode: 'curtain',
            side,
            /* the halves overlap at the middle; more folds on a wide screen gather more, so they overlap more */
            x0: side < 0 ? -vw * 1.12 : -lap,
            x1: side < 0 ? lap : vw * 1.12,
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

/** 5 · FABRIC — one drape of satin lying crumpled (the pilak's gather), the logo embroidered large; a palm of it is taken
    and it slides off slowly, the creases easing out, the last corner trailing. */
export const fabric = (): Scene =>
  clothScene({
    dir: [0, 1],
    push: 0.14,
    fromTap: true,
    async build(c) {
      veilLights(c, 0.5);
      shadowsOnly(c, 0.3);
      /* 🖥 the satin at its own size, laid outward across a wide screen (more fabric, never wider fabric); the logo
         embroidered once, in the middle, at its phone size */
      const wide = Math.min(4, wideness(c.px));
      const cw = Math.round(512 * wide);
      const sc = canvas(cw, 888);
      const sx = ctx2d(sc);
      sx.fillStyle = '#d8c49a';
      sx.fillRect(0, 0, cw, 888);
      /* the satin's own sheen: a fine weft at the cloth's own pixel size, laid across any width. Its folds and light are
         the cloth's real 3D form now (`crumpleZ`), never a photo's baked folds */
      for (let y = 0; y < 888; y += 2) {
        sx.fillStyle = `rgba(255,248,232,${(0.03 + 0.07 * c.rand()).toFixed(3)})`;
        sx.fillRect(0, y, cw, 1);
      }
      stamp(sx, c.logo, cw / 2 + 2, 446, 250, '#7a6238', 0.35);
      stamp(sx, c.logo, cw / 2, 444, 250, '#fff6dc', 0.7);
      const mat = clothMaterial({ color: '#f1e4cf', map: texOf(sc), opacity: 1, rough: 0.24, fresnel: 0.3, fresnelA: 0, solid: true });
      /* gathered satin draws in around its folds, so it is cut larger (and as finely woven) to still cover the screen */
      return [new Drape(c, { cols: 88, rows: 80, wideMax: 1.6, x0: -c.vw * 1.25, x1: c.vw * 1.25, mode: 'slide', material: mat, twist: 5.5, shadow: true, crumple: true, cfg: { weight: 30, wind: 14, full: 100, folds: 7, reach: -18, bounce: 90 } })];
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
