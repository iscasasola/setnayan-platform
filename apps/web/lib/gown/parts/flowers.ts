/**
 * 👗 gown/parts/flowers — 3D flowers and scattered pearls (prototype v200 `flowerGeo`, `flwSpots`, `capeFlowerSpots`,
 * `flwSleeveSpots`, `flwFrame`, `flwPlace`, `flwHide`, `buildFlowers`, `flwTopY`, `flwVeil`, `buildPearls`,
 * `prlVeilPlace`, `flowerSummary`, `flowerQuote`, `glitNet`).
 *
 * 3D flowers are ONE instanced mesh (a low-poly petal flower, no lights or shadows of its own). Each flower is pinned to
 * the cloth it is sewn on: a triangle of the gown (as the beads are), a point on the cape's lattice (the cape's flowers),
 * or a point on a sleeve. When that cloth moves (a pose, the twirl, a walk) the flowers are laid again from it
 * (`placeGownFlowers`), so they never float and never sink in: the base sits 0.6 mm off the cloth, the petals stand out
 * along its outward normal. Spots are worked out in the gown's own map (direction round her, height), at real size in
 * cm, from a fixed seed, so they don't reshuffle between poses. A flower that would end up under a cape or an overlay is
 * left out; one an arm or a hand rests on, or whose petals would go into her skin, is not drawn in that pose. Phones draw
 * at most 600 flowers (the beads keep their own 2,500); the quantities count every flower.
 *
 * Pearls: the bead system's pearls, scattered along the neckline (a bead set riding the gown) and the veil's edge.
 * Women only. State is passed in; the matrices are written into plain arrays the stage copies to its instanced meshes.
 */
import * as THREE from 'three';
import {
  GOWN_FLOWER_TYPES,
  GOWN_STRAPLESS,
  gownCapeFlowersOn,
  gownFlowerCm,
  gownFlowersOn,
  gownLayerCount,
  type GownConfig,
} from '../../gown-config';
import { jointP, jointY } from '../body/bones';
import { RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import { GOWN_SLIT_ANGLE, type GownDress } from '../dress/build';
import { CAPE_COLS, CAPE_ROWS, capeAt, capeGrid, type GownCapeMesh, type GownCapePart } from '../dress/cape';
import { bodyReach, czOf, envTopAt, lerpRow, reach, type GownEnvelope } from '../dress/table';
import { GOWN_BEAD_CAP, gownLocate, gownThinBeads, type GownBeadSet } from './beads';
import { gownOverlayHem } from './overlay';
import { SLEEVE_COLS, SLEEVE_ROWS } from './sleeves-grid';
import { VEIL_COLS, VEIL_ROWS } from './veil-grid';

const N = RING_N, DY = SLICE_DY, DTH = TAU / N, CNA = CAPE_COLS, CNR = CAPE_ROWS, SNA = SLEEVE_COLS, SNR = SLEEVE_ROWS, VNA = VEIL_COLS, VNR = VEIL_ROWS;
type P3 = [number, number, number];

/** Flowers drawn on a phone · on a desktop · designed (counted) at most (v200 `FLW_CAP_PHONE`, `FLW_CAP_DESK`, `FLW_MAX`). */
export const GOWN_FLOWER_CAP = { phone: 600, desktop: 1500, max: 1500 } as const;
/** The flower colours that are not the gown's or the accent's (v200 `FLW_COLS`). */
export const GOWN_FLOWER_COLOURS = { ivory: 0xf6efe2, blush: 0xf0d3cd } as const;
/** How the stage draws the flowers (v200 `flwMat`): soft, no lights or shadows of their own; the bead room as their env map. */
export const GOWN_FLOWER_LOOK = { roughness: 0.72, metalness: 0, envMapIntensity: 0.55 } as const;
/** A scattered pearl's size (mm) (v200 `PRL_MM`). */
export const GOWN_PEARL_MM = 4;
/** Where flowers go, in words (v200 `FLW_AT`, `FLW_CAPE`). */
const FLW_AT: Record<Exclude<GownConfig['flowers'], 'none'>, string> = { scatter: 'scattered over the gown', cascade: 'in a cascade', neck: 'along the neckline', hem: 'as a hem border', waist: 'as a cluster at the waist' };
const FLW_CAPE: Record<Exclude<GownConfig['capeFlowers'], 'none'>, string> = { trail: 'trailing down the cape', edge: 'along the cape edge', all: 'all over the cape' };
const DEN: Record<GownConfig['flowerDen'], number> = { light: 0.45, medium: 1, full: 1.7 };
const typeOf = (t: GownConfig['flowerType']) => GOWN_FLOWER_TYPES.find((x) => x.id === t)!;
/** The fixed-seed random v200 uses everywhere (mulberry32 style), so a layout never reshuffles. */
const seeded = (s0: number) => { let seed = s0; return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const angD = (a: number, b: number) => Math.abs((((a - b + Math.PI) % TAU) + TAU) % TAU - Math.PI);

/** A numeric spatial hash (no strings): add points by index, visit the 27 cells round a point (v200 `flwHash`). */
function flwHash(cell: number, n: number) {
  const size = 1 << 15, head = new Int32Array(size).fill(-1), next = new Int32Array(Math.max(1, n)), X = new Float32Array(Math.max(1, n) * 3);
  const key = (gx: number, gy: number, gz: number) => ((Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663) ^ Math.imul(gz, 83492791)) >>> 0) & (size - 1);
  return {
    X,
    add(i: number, x: number, y: number, z: number) { const k = key(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)); next[i] = head[k]!; head[k] = i; X[i * 3] = x; X[i * 3 + 1] = y; X[i * 3 + 2] = z; },
    each(x: number, y: number, z: number, f: (j: number) => boolean | void, R = 1) {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let j = head[key(gx + dx, gy + dy, gz + dz)]!; j >= 0; j = next[j]!) if (f(j) === false) return false;
      return true;
    },
  };
}

/**
 * The flower: petals as small curved fans round a centre, unit diameter, standing up along +z; darker at the heart (a
 * soft shade in its vertex colours, so a coloured flower stays clean, never muddy) (v200 `flowerGeo`).
 */
export function gownFlowerGeo(type: GownConfig['flowerType']): THREE.BufferGeometry {
  const P: number[] = [], shade: number[] = [], tri = (a: number[], b: number[], c: number[]) => { P.push(...a, ...b, ...c); };
  // A rounded petal: narrow at the heart, widest two-thirds out, a soft round tip; its edges curl up a little (cup).
  const petal = (ang: number, r0: number, len: number, wid: number, z0: number, tilt: number, cup: number) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const at = (u: number, v: number) => { const r = r0 + len * u, w = wid * v, z = z0 + tilt * len * (u + 0.25 * u * u) + cup * Math.abs(v) * 2 * Math.min(1, u * 1.6); return [r * ca - w * sa, r * sa + w * ca, z]; };
    const B0 = at(0, 0), Ap = at(0.33, 0.34), Am = at(0.33, -0.34), C1 = at(0.36, 0), Dp = at(0.72, 0.5), Dm = at(0.72, -0.5), C2 = at(0.74, 0), Ep = at(0.93, 0.32), Em = at(0.93, -0.32), Tp = at(1, 0);
    for (const [x, y, z, s0, s1, s2] of [[B0, Ap, C1, 0.72, 0.8, 0.88], [B0, C1, Am, 0.72, 0.88, 0.8], [Ap, Dp, C2, 0.8, 0.84, 1], [Ap, C2, C1, 0.8, 1, 0.88], [C1, C2, Am, 0.88, 1, 0.8], [Am, C2, Dm, 0.8, 1, 0.84], [Dp, Ep, Tp, 0.84, 0.86, 0.95], [Dp, Tp, C2, 0.84, 0.95, 1], [C2, Tp, Dm, 1, 0.95, 0.84], [Dm, Tp, Em, 0.84, 0.95, 0.86]] as const) { tri(x, y, z); shade.push(s0, s1, s2); }
  };
  const bud = (r: number, z: number, h: number) => { const n = 6; for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU; tri([r * Math.cos(a0), r * Math.sin(a0), z], [r * Math.cos(a1), r * Math.sin(a1), z], [0, 0, z + h]); shade.push(0.74, 0.74, 0.84); } };
  if (type === 'rosette') {
    // A rose: three rings, each smaller and more upright.
    for (let k = 0; k < 6; k++) petal((k / 6) * TAU + 0.3, 0.06, 0.42, 0.4, 0.02, 0.36, 0.05);
    for (let k = 0; k < 5; k++) petal((k / 5) * TAU, 0.04, 0.3, 0.32, 0.08, 0.95, 0.04);
    for (let k = 0; k < 4; k++) petal((k / 4) * TAU + 0.7, 0.01, 0.18, 0.24, 0.16, 1.7, 0.02);
    bud(0.05, 0.2, 0.12);
  } else if (type === 'petal') {
    // An open flower with a second ring.
    for (let k = 0; k < 6; k++) petal((k / 6) * TAU, 0.05, 0.45, 0.36, 0.02, 0.28, 0.05);
    for (let k = 0; k < 5; k++) petal((k / 5) * TAU + 0.6, 0.03, 0.25, 0.26, 0.07, 0.8, 0.03);
    bud(0.07, 0.1, 0.1);
  } else {
    // Five round petals and a small heart.
    for (let k = 0; k < 5; k++) petal((k / 5) * TAU, 0.05, 0.45, 0.46, 0.02, 0.16, 0.04);
    bud(0.08, 0.04, 0.08);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(shade.flatMap((s) => { const v = 0.45 + 0.55 * s; return [v, v, v]; }), 3));
  g.computeVertexNormals();
  return g;
}

/** The design keys the flowers and pearls read. */
export type GownFlowerDesign = Pick<GownConfig,
  'flowers' | 'flowerFrom' | 'flowerType' | 'flowerSize' | 'flowerDen' | 'flowerCol' | 'capeFlowers' | 'cape' | 'neck' | 'sleeve' | 'overlay' | 'slits' | 'slitCm' | 'pearls' | 'veil'>;
/** A spot in the gown's map (direction round her, 0 = centre front, + toward her left; height) with its own size and turn. */
type Spot = { ph: number; y: number; sc: number; spin: number };

/**
 * Where the flowers go on the gown, in the gown's map (v200 `flwSpots`). `cutAt` says whether a spot is cut out (the
 * stage reads its cut map); `overlay` whether an overlay lies over the skirt.
 */
export function gownFlowerSpots(B: GownRig, T: GownEnvelope, D: GownDress, d: GownFlowerDesign, opt: { overlay?: boolean; cutAt?: ((ph: number, y: number) => boolean) | null } = {}): Spot[] {
  const out: Spot[] = [], cmU = B.P.S * 100, Dc = gownFlowerCm(d), Dm = Dc / cmU, kind = d.flowers, den = DEN[d.flowerDen];
  const rnd = seeded(424243);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(TAU * rnd());
  const q0 = (ph: number) => { let q = ph / DTH; q = ((q % N) + N) % N; return Math.round(q) % N; };
  const topAt = (ph: number) => envTopAt(T, ph < 0 ? ph + TAU : ph), hemAt = (ph: number) => T.hemQ[q0(ph)]!;
  const rAt = (ph: number, y: number) => lerpRow(T, T.F, clamp(y, T.yHem, T.y0 + (T.n - 2) * DY), q0(ph));
  const yS = T.yS;
  let yTopRow = -1e9, yLo = 1e9;
  for (let q = 0; q < N; q++) { yTopRow = Math.max(yTopRow, T.top[q]!); yLo = Math.min(yLo, T.hemQ[q]!); }
  const slitTop = (ph: number) => { let t = -1e9; for (const s of d.slits || []) if (GOWN_SLIT_ANGLE[s] !== undefined && angD(ph, GOWN_SLIT_ANGLE[s]) < 0.32) t = Math.max(t, hemAt(ph) + (d.slitCm || 45) / cmU); return t; };
  const grid = new Map<string, [number, number][]>(), cell = Dc, key = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  // Arc length round her (cm, from the front) and height (cm): distances at real size.
  const xy = (ph: number, y: number): [number, number] => [ph * rAt(0, y) * cmU, y * cmU];
  const free = (ph: number, y: number, md: number) => {
    const [x, yy] = xy(ph, y), gx = Math.floor(x / cell), gy = Math.floor(yy / cell);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const L = grid.get(`${gx + dx},${gy + dy}`); if (L) for (const [a, b] of L) if (Math.hypot(a - x, b - yy) < md) return false; }
    return true;
  };
  const ok = (ph: number, y: number, edge = 0.55) => {
    if (ph > Math.PI) ph -= TAU;
    if (ph < -Math.PI) ph += TAU;
    if (y > topAt(ph) - edge * Dm || y < hemAt(ph) + 0.5 * Dm) return false;
    if (y < slitTop(ph) + 0.5 * Dm) return false;
    // Under an overlay: it lies over them.
    if (opt.overlay && d.overlay !== 'none' && y < yS - 0.01) { const t = (yS - y) / Math.max(0.05, yS - T.yHem); if (t < gownOverlayHem(d.overlay, ph, 0) + 0.04) return false; }
    // Not over a cut-out.
    if (opt.cutAt && opt.cutAt(ph, y)) return false;
    return !!gownLocate(D, ph, y);
  };
  const take = (ph: number, y: number, md: number, edge: number) => {
    if (ph > Math.PI) ph -= TAU;
    if (ph < -Math.PI) ph += TAU;
    if (out.length >= GOWN_FLOWER_CAP.max || !ok(ph, y, edge) || !free(ph, y, md)) return false;
    const [x, yy] = xy(ph, y), k = key(x, yy);
    (grid.get(k) ?? grid.set(k, []).get(k)!).push([x, yy]);
    out.push({ ph, y, sc: 0.88 + 0.24 * rnd(), spin: rnd() * TAU });
    return true;
  };
  if (kind === 'scatter') {
    // A jittered grid at real size, over bodice and skirt.
    const sp = Dc * (d.flowerDen === 'light' ? 3.6 : d.flowerDen === 'full' ? 1.75 : 2.5);
    for (let y = yTopRow; y > yLo; y -= (sp * 0.88) / cmU) {
      const G = Math.PI * rAt(0, y) * cmU;
      for (let s = -G + rnd() * 0.6 * sp; s < G; s += sp) take(s / (rAt(0, y) * cmU) + ((rnd() - 0.5) * 0.5 * sp) / (rAt(0, y) * cmU), y + ((rnd() - 0.5) * 0.5 * sp) / cmU, Dc * 1.05, 0.6);
    }
  } else if (kind === 'cascade') {
    // From her left shoulder (or the bodice edge) across the front, over the waist, down the skirt to her right.
    let ph0 = 0.42;
    if (d.flowerFrom === 'shoulder' && !GOWN_STRAPLESS.includes(d.neck)) {
      // The middle of the shoulder piece, a little to the front.
      let best = -1e9;
      for (let a = 0.4; a <= 1.6; a += 0.02) best = Math.max(best, topAt(a));
      let sa = 0, na = 0;
      for (let a = 0.4; a <= 1.6; a += 0.02) if (topAt(a) > best - 2 / cmU) { sa += a; na++; }
      ph0 = na ? sa / na - 0.06 : 0.8;
    }
    const yTop = topAt(ph0) - 0.8 * Dm, yHm = hemAt(-0.9), len = yS - yHm;
    const W: [number, number][] = [[ph0, yTop], [0.22, yTop + (yS - yTop) * 0.55], [-0.12, yS + 0.02 * len], [-0.5, yS - 0.4 * len], [-0.82, yHm + 0.14 * len]], segL: number[] = [];
    for (let i = 1; i < W.length; i++) segL.push(Math.hypot((W[i]![0] - W[i - 1]![0]) * rAt(0, W[i]![1]) * cmU, (W[i]![1] - W[i - 1]![1]) * cmU));
    const tot = segL.reduce((a, b) => a + b, 0);
    const at = (s: number): [number, number] => { let dd = s * tot, i = 0; while (i < segL.length - 1 && dd > segL[i]!) dd -= segL[i++]!; const u = clamp(dd / segL[i]!, 0, 1); return [W[i]![0] + (W[i + 1]![0] - W[i]![0]) * u, W[i]![1] + (W[i + 1]![1] - W[i]![1]) * u]; };
    const tries = Math.round((tot / Dc) * 40 * den);
    for (let k = 0; k < tries; k++) {
      const s = Math.pow(rnd(), 1.25), pk = s < 0.3 ? 1 : 1 - (0.75 * (s - 0.3)) / 0.7;
      if (rnd() > pk * Math.min(1, 0.5 * den)) continue;
      const [ph, y] = at(s), wid = (2.2 + 11 * s) * (0.7 + 0.3 * den), dx = gauss() * wid, dy = gauss() * wid * 0.45;
      take(ph + dx / (rAt(ph, y) * cmU), y + dy / cmU, Dc * (s < 0.3 ? 0.9 : 1.05), 0.6);
    }
  } else if (kind === 'neck') {
    // Along the real top edge, round to the back closure, a little inside it.
    const step = Dc * (d.flowerDen === 'light' ? 1.65 : d.flowerDen === 'full' ? 0.86 : 1.05), rows = d.flowerDen === 'full' ? 2 : 1;
    for (let r = 0; r < rows; r++) for (const sg of [1, -1]) {
      let acc = r ? 0 : step * 0.5, pp = 0, py = topAt(0);
      for (let a = 0.004; a <= 2.95; a += 0.004) {
        const ph = sg * a, y = topAt(ph), dd = Math.hypot((a - pp) * rAt(ph, y) * cmU, (y - py) * cmU);
        acc += dd;
        if (acc >= step) {
          acc = 0;
          // Into the cloth, across the edge.
          const ex = (a - pp) * rAt(ph, y) * cmU, ey = (y - py) * cmU, l = Math.hypot(ex, ey) || 1;
          let nx = ey / l, ny = -ex / l;
          if (ny > 0) { nx = -nx; ny = -ny; }
          const o = (0.5 + r * 0.95) * Dc;
          take(ph + (sg * nx * o) / (rAt(ph, y) * cmU), y + (ny * o) / cmU, Dc * 0.82, 0.35);
        }
        pp = a; py = y;
      }
    }
  } else if (kind === 'hem') {
    // A border round the hem (it climbs a high-low front; floor-length only).
    const step = Dc * (d.flowerDen === 'light' ? 1.7 : d.flowerDen === 'full' ? 0.88 : 1.08), rows = d.flowerDen === 'full' ? 2 : 1;
    for (let r = 0; r < rows; r++) for (const sg of [1, -1]) {
      let acc = r ? 0 : step * 0.5, pp = 0;
      for (let a = 0.004; a <= Math.PI; a += 0.004) { const ph = sg * a, y = hemAt(ph); acc += (a - pp) * rAt(ph, y) * cmU; pp = a; if (acc >= step) { acc = 0; take(ph, y + (0.7 + r * 0.92) * Dm, Dc * 0.82, 0.55); } }
    }
  } else if (kind === 'waist') {
    // A cluster on her right front at the waist, a few trailing below it.
    const n = { light: 7, medium: 12, full: 20 }[d.flowerDen], R = (d.flowerDen === 'light' ? 5 : d.flowerDen === 'full' ? 10 : 7) * Math.sqrt(Dc / 4), c0 = -0.62, y0 = yS + 0.004;
    take(c0, y0, Dc * 0.85, 0.6);
    for (let k = 0; k < 600 && out.length < n; k++) {
      const t = rnd(), r = R * Math.sqrt(rnd()), a = rnd() * TAU, ph = c0 + (r * Math.cos(a)) / (rAt(c0, y0) * cmU), y = y0 + (r * Math.sin(a) * (t < 0.7 ? 0.7 : 1.6)) / cmU - (t < 0.7 ? 0 : (0.35 * R) / cmU);
      take(ph, y, Dc * 0.85, 0.6);
    }
  }
  return out;
}

/** A spot on the cape: a point on a panel's lattice (column, length down it). */
type CapeSpot = { part: number; cf: number; s: number; sc: number; spin: number };
/** The cape's own flowers (v200 `capeFlowerSpots`, its `CAPE_FLOWERS` hook): blooms placed on the panels with `capeGrid`. */
export function gownCapeFlowerSpots(B: GownRig, cape: GownCapeMesh, d: GownFlowerDesign, Dc: number): CapeSpot[] {
  const out: CapeSpot[] = [], P = cape.base, cmU = B.P.S * 100, Dm = Dc / cmU, mode = d.capeFlowers, den = DEN[d.flowerDen];
  // A cape carries a few hundred flowers at most (ref 2 shows about 300 a side).
  const most = { light: 180, medium: 400, full: 800 }[d.flowerDen];
  if (!P || !cape.parts.length) return out;
  const rnd = seeded(777001), grid = flwHash(Dm, GOWN_FLOWER_CAP.max + 8);
  let gn = 0;
  const at = (I: GownCapePart, cf: number, s: number): P3 => { const g = capeGrid(I, cf, s); let x = 0, y = 0, z = 0; for (let k = 0; k < g.length; k += 2) { const o = g[k]! * 3; x += P[o]! * g[k + 1]!; y += P[o + 1]! * g[k + 1]!; z += P[o + 2]! * g[k + 1]!; } return [x, y, z]; };
  const lenAt = (I: GownCapePart, cf: number) => { const c = clamp(cf, 0, CNA - 1), c0 = Math.min(CNA - 2, c | 0); return I.lens[c0]! + (I.lens[c0 + 1]! - I.lens[c0]!) * (c - c0); };
  cape.parts.forEach((I, pi) => {
    const take = (cf: number, s: number, md: number) => {
      if (out.length >= Math.min(GOWN_FLOWER_CAP.max, (most * (pi + 1)) / cape.parts.length)) return;
      const L = lenAt(I, cf);
      if (s < 1.1 * Dm || s > L - 0.55 * Dm) return;
      if (!I.ring && (cf < 0.6 || cf > CNA - 1.6)) return;
      const p = at(I, cf, s), lim = md * Dm;
      if (grid.each(p[0], p[1], p[2], (j) => Math.hypot(grid.X[j * 3]! - p[0], grid.X[j * 3 + 1]! - p[1], grid.X[j * 3 + 2]! - p[2]) >= lim) === false) return;
      grid.add(gn++, p[0], p[1], p[2]);
      out.push({ part: pi, cf, s, sc: 0.88 + 0.24 * rnd(), spin: rnd() * TAU });
    };
    const colW = (s: number) => { const a = at(I, (CNA - 1) / 2, s), b = at(I, (CNA - 1) / 2 + 1, s); return Math.max(1e-4, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); };
    if (mode === 'edge') {
      const step = Dm * (d.flowerDen === 'light' ? 1.7 : d.flowerDen === 'full' ? 0.9 : 1.1);
      let acc = 0;
      for (let c = 0.8; c <= CNA - 1.8; c += 0.05) { const s = lenAt(I, c) - 0.8 * Dm, p = at(I, c, s), q = at(I, c + 0.05, s); acc += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (acc >= step) { acc = 0; take(c, s, 0.85); } }
      if (!I.ring) for (const c of [0.9, CNA - 1.9]) for (let s = 1.5 * Dm; s < lenAt(I, c) - Dm; s += step) take(c + ((c < 1 ? 1 : -1) * 0.2 * Dm) / colW(s), s, 0.85);
      return;
    }
    const Smax = Math.max(...I.lens), area = (CNA - 1) * Smax, tries = Math.round((area / (colW(Smax * 0.5) * Dm)) * 0.5 * den + 120);
    for (let k = 0; k < tries; k++) {
      const cf = rnd() * (CNA - 1), s = rnd() * lenAt(I, cf), f = s / Math.max(1e-4, Smax);
      const pk = mode === 'trail' ? Math.pow(1 - f, 0.9) * 0.9 + 0.1 : 0.85;
      if (rnd() > pk * Math.min(1, 0.55 * den)) continue;
      take(cf, s, mode === 'trail' && f < 0.25 ? 0.95 : 1.15);
    }
  });
  return out;
}

/** The visible sleeves' meshes (the stage passes the ones it draws). */
export type GownFlowerSleeves = Partial<Record<'L' | 'R', THREE.BufferGeometry>>;
/** A point on a sleeve (row along the arm, column round it), outward from the arm (v200 `flwSleeveAt`). */
function flwSleeveAt(g: THREE.BufferGeometry, fi: number, fa: number): { p: P3; n: P3; up: P3 } {
  const P = (g.attributes.position as THREE.BufferAttribute).array as Float32Array, A = SNA + 1, i0 = clamp(Math.floor(fi), 0, SNR - 2), u = clamp(fi - i0, 0, 1), a0 = clamp(Math.floor(fa), 0, SNA - 1), v = clamp(fa - a0, 0, 1);
  const V = (i: number, a: number) => (i * A + a) * 3, idx = [V(i0, a0), V(i0, a0 + 1), V(i0 + 1, a0), V(i0 + 1, a0 + 1)], w = [(1 - u) * (1 - v), (1 - u) * v, u * (1 - v), u * v], p: P3 = [0, 0, 0], c: P3 = [0, 0, 0];
  for (let k = 0; k < 4; k++) for (let dd = 0; dd < 3; dd++) p[dd] = p[dd]! + P[idx[k]! + dd]! * w[k]!;
  // The ring's centre: outward is away from it.
  for (let a = 0; a < SNA; a++) { const o = V(i0, a); for (let dd = 0; dd < 3; dd++) c[dd] = c[dd]! + P[o + dd]! / SNA; }
  const t1: P3 = [0, 0, 0], t2: P3 = [0, 0, 0];
  for (let dd = 0; dd < 3; dd++) { t1[dd] = P[V(i0 + 1, a0) + dd]! - P[V(i0, a0) + dd]!; t2[dd] = P[V(i0, a0 + 1) + dd]! - P[V(i0, a0) + dd]!; }
  let n: P3 = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
  const l = Math.hypot(...n) || 1;
  n = [n[0] / l, n[1] / l, n[2] / l];
  if ((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2] < 0) n = [-n[0], -n[1], -n[2]];
  return { p, n, up: t1 };
}
type SleeveSpot = { sd: 'L' | 'R'; i: number; a: number; sc: number; spin: number };
/** Scattered blooms also go on the sleeves (cap, long or butterfly; not flutter or a band) (v200 `flwSleeveSpots`). */
function flwSleeveSpots(B: GownRig, d: GownFlowerDesign, sleeves: GownFlowerSleeves, Dc: number): SleeveSpot[] {
  const out: SleeveSpot[] = [];
  if (d.flowers !== 'scatter' || !['cap', 'long', 'butterfly'].includes(d.sleeve)) return out;
  const cmU = B.P.S * 100, rnd = seeded(31337);
  for (const sd of ['L', 'R'] as const) {
    const g = sleeves[sd];
    if (!g) continue;
    const P = (g.attributes.position as THREE.BufferAttribute).array as Float32Array, A = SNA + 1, len = Math.hypot(P[(SNR - 1) * A * 3]! - P[0]!, P[(SNR - 1) * A * 3 + 1]! - P[1]!, P[(SNR - 1) * A * 3 + 2]! - P[2]!) * cmU;
    let circ = 0;
    { const i = (SNR / 2) | 0; for (let a = 0; a < SNA; a++) { const o = (i * A + a) * 3, q = (i * A + a + 1) * 3; circ += Math.hypot(P[q]! - P[o]!, P[q + 1]! - P[o + 1]!, P[q + 2]! - P[o + 2]!); } circ *= cmU; }
    const sp = Dc * (d.flowerDen === 'light' ? 3.6 : d.flowerDen === 'full' ? 1.75 : 2.5), n = Math.min(90, Math.round((len * circ) / (sp * sp))), got: P3[] = [];
    for (let k = 0; k < n * 8 && got.length < n; k++) {
      const i = 0.1 + rnd() * 0.82, a = rnd() * SNA, p = flwSleeveAt(g, i * (SNR - 1), a);
      if (got.some((q) => Math.hypot(q[0] - p.p[0], q[1] - p.p[1], q[2] - p.p[2]) * cmU < Dc * 1.05)) continue;
      got.push(p.p);
      out.push({ sd, i: i * (SNR - 1), a, sc: 0.85 + 0.2 * rnd(), spin: rnd() * TAU });
    }
  }
  return out;
}

/** The closest point on a triangle, as weights of its corners (Ericson) (v200 `flwTriBary`). */
function flwTriBary(p: P3, A: P3, Bv: P3, C: P3): [number, number] {
  const ab: P3 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], ac: P3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], ap: P3 = [p[0] - A[0], p[1] - A[1], p[2] - A[2]], dt = (q: P3, r: P3) => q[0] * r[0] + q[1] * r[1] + q[2] * r[2];
  const d1 = dt(ab, ap), d2 = dt(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [0, 0];
  const bp: P3 = [p[0] - Bv[0], p[1] - Bv[1], p[2] - Bv[2]], d3 = dt(ab, bp), d4 = dt(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [1, 0];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return [d1 / (d1 - d3), 0];
  const cp: P3 = [p[0] - C[0], p[1] - C[1], p[2] - C[2]], d5 = dt(ab, cp), d6 = dt(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [0, 1];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return [0, d2 / (d2 - d6)];
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [1 - t, t]; }
  const dn = 1 / (va + vb + vc);
  return [vb * dn, vc * dn];
}
const vtx = (P: Float32Array, i: number): P3 => [P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!];
/** A cape spot (column, length) as an exact triangle of the cape mesh and weights, found on the cape at rest (v200 `capeTriAt`). */
function capeTriAt(I: GownCapePart, cf: number, s: number, P: Float32Array): { d: number; t: [number, number, number]; u: number; v: number } | null {
  const g = capeGrid(I, cf, s), p: P3 = [0, 0, 0];
  for (let k = 0; k < g.length; k += 2) for (let dd = 0; dd < 3; dd++) p[dd] = p[dd]! + P[g[k]! * 3 + dd]! * g[k + 1]!;
  let best: { d: number; t: [number, number, number]; u: number; v: number } | null = null;
  const seen = new Set<number>();
  for (let k = 0; k < g.length; k += 2) {
    const vi = g[k]! - I.vo, i = (vi / CNA) | 0, c = vi % CNA;
    for (let ii = Math.max(0, i - 1); ii <= Math.min(CNR - 2, i); ii++) for (let cc = Math.max(0, c - 1); cc <= Math.min(CNA - 2, c); cc++) {
      const q = I.vo + ii * CNA + cc, r = q + CNA;
      if (seen.has(q)) continue;
      seen.add(q);
      for (const t of [[q, r, q + 1], [q + 1, r, r + 1]] as [number, number, number][]) {
        const A = vtx(P, t[0]), Bv = vtx(P, t[1]), C = vtx(P, t[2]), [u, v] = flwTriBary(p, A, Bv, C), w = 1 - u - v;
        const dd = Math.hypot(A[0] * w + Bv[0] * u + C[0] * v - p[0], A[1] * w + Bv[1] * u + C[1] * v - p[1], A[2] * w + Bv[2] * u + C[2] * v - p[2]);
        if (!best || dd < best.d) best = { d: dd, t, u, v };
      }
    }
  }
  return best;
}

/** What one flower is sewn on: a gown triangle (`d`), a cape triangle (`c`) or a sleeve point (`s`). */
export type GownFlowerAnchor =
  | { k: 'd'; t: [number, number, number]; u: number; v: number; rows: number; sc: number; spin: number }
  | { k: 'c'; t: [number, number, number]; u: number; v: number; part: number; cf: number; s: number; ck: string; sc: number; spin: number }
  | { k: 's'; sd: 'L' | 'R'; i: number; a: number; sc: number; spin: number };
export type GownFlowers = {
  A: GownFlowerAnchor[];
  /** Not drawn in this pose (an arm on it, into her skin, through the cape). */
  hid: Uint8Array | null;
  why: { skin: number; cloth: number };
  /** Every flower (the quantities), and where they are. */
  count: number; dressN: number; sleeveN: number; capeN: number;
  /** Gown flowers left off because the cape covers them. */
  coverN: number;
  /** A flower's width (model units); the height outward is decided from this side of her. */
  D: number; yRef: number;
  /** The matrices drawn this pose (16 floats each). */
  mats: Float32Array; drawn: number;
  type: GownConfig['flowerType'];
};
export function emptyGownFlowers(): GownFlowers {
  return { A: [], hid: null, why: { skin: 0, cloth: 0 }, count: 0, dressN: 0, sleeveN: 0, capeN: 0, coverN: 0, D: 0, yRef: 0, mats: new Float32Array(16 * GOWN_FLOWER_CAP.desktop), drawn: 0, type: 'rosette' };
}

/** What the flowers are laid on, as drawn now. */
export type GownFlowerCloth = { T: GownEnvelope; D: GownDress; cape: GownCapeMesh | null; sleeves: GownFlowerSleeves };
const _fv = new THREE.Vector3(), _fn = new THREE.Vector3(), _ft = new THREE.Vector3(), _fb = new THREE.Vector3(), _fm = new THREE.Matrix4(), _fs = new THREE.Vector3();
/** Lay one flower from its cloth: base point, outward normal, a direction along the cloth (v200 `flwFrame`). */
function flwFrame(a: GownFlowerAnchor, F: GownFlowers, c: GownFlowerCloth): boolean {
  if (a.k === 'd') {
    const D = c.D;
    if (!D.geo || a.rows !== D.rows) return false;
    const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, Nn = (D.geo.attributes.normal as THREE.BufferAttribute).array as Float32Array, x = a.t[0] * 3, y = a.t[1] * 3, z = a.t[2] * 3, u = a.u, v = a.v, w = 1 - u - v;
    _fv.set(P[x]! * w + P[y]! * u + P[z]! * v, P[x + 1]! * w + P[y + 1]! * u + P[z + 1]! * v, P[x + 2]! * w + P[y + 2]! * u + P[z + 2]! * v);
    _fn.set(Nn[x]! * w + Nn[y]! * u + Nn[z]! * v, Nn[x + 1]! * w + Nn[y + 1]! * u + Nn[z + 1]! * v, Nn[x + 2]! * w + Nn[y + 2]! * u + Nn[z + 2]! * v).normalize();
    // Near the top edge the vertex normals lean into the folded lip: use the cloth's own face there.
    {
      const e1x = P[y]! - P[x]!, e1y = P[y + 1]! - P[x + 1]!, e1z = P[y + 2]! - P[x + 2]!, e2x = P[z]! - P[x]!, e2y = P[z + 1]! - P[x + 1]!, e2z = P[z + 2]! - P[x + 2]!;
      _fb.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
      const l = _fb.length();
      if (l > 1e-12) { _fb.divideScalar(l); if (Math.abs(_fb.dot(_fn)) < 0.85) _fn.copy(_fb); }
    }
    // Outward: from her centre line, and up over the shoulders.
    if (_fv.x * _fn.x + _fn.y * Math.max(0, _fv.y - F.yRef) + _fn.z * (_fv.z - D.cz[a.t[0]]!) < 0) _fn.negate();
    // Up the cloth: from the row below to this one.
    _ft.set(P[x]! - P[z]!, P[x + 1]! - P[z + 1]!, P[x + 2]! - P[z + 2]!);
    return true;
  }
  if (a.k === 'c') {
    const K = c.cape;
    if (!K || !K.info || K.key !== a.ck) return false;
    const P = (K.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, Nn = (K.geo.attributes.normal as THREE.BufferAttribute).array as Float32Array, x = a.t[0] * 3, y = a.t[1] * 3, z = a.t[2] * 3, u = a.u, v = a.v, w = 1 - u - v;
    _fv.set(P[x]! * w + P[y]! * u + P[z]! * v, P[x + 1]! * w + P[y + 1]! * u + P[z + 1]! * v, P[x + 2]! * w + P[y + 2]! * u + P[z + 2]! * v);
    _fn.set(Nn[x]! * w + Nn[y]! * u + Nn[z]! * v, Nn[x + 1]! * w + Nn[y + 1]! * u + Nn[z + 1]! * v, Nn[x + 2]! * w + Nn[y + 2]! * u + Nn[z + 2]! * v);
    if (!(_fn.lengthSq() > 1e-12)) return false;
    _fn.normalize();
    { const cz = czOf(c.T)(_fv.y); if (_fv.x * _fn.x + _fn.y * Math.max(0, _fv.y - F.yRef) + (_fv.z - cz) * _fn.z < 0) _fn.negate(); }
    _ft.set(P[x]! - P[y]!, P[x + 1]! - P[y + 1]!, P[x + 2]! - P[y + 2]!);
    return true;
  }
  const g = c.sleeves[a.sd];
  if (!g) return false;
  const r = flwSleeveAt(g, a.i, a.a);
  _fv.set(...r.p);
  _fn.set(...r.n);
  _ft.set(-r.up[0], -r.up[1], -r.up[2]);
  return true;
}

/**
 * Every flower from its cloth as it is now, hidden ones left out (v200 `flwPlace`). Call when the cloth under them moved
 * (a pose, the twirl, a walk); `cap` is the phone's or the desktop's.
 */
export function placeGownFlowers(B: GownRig, F: GownFlowers, c: GownFlowerCloth, cap: number): void {
  const lift = 0.0006 / B.P.S, D = F.D, st = Math.max(1, F.A.length / cap);
  if (F.mats.length < cap * 16) F.mats = new Float32Array(cap * 16);
  let n = 0;
  for (let f = 0; f < F.A.length && n < cap; f += st) {
    const i = Math.floor(f), a = F.A[i]!;
    if (F.hid && F.hid[i]) continue;
    if (!flwFrame(a, F, c)) continue;
    _ft.addScaledVector(_fn, -_ft.dot(_fn));
    if (_ft.lengthSq() < 1e-12) _ft.set(0, 1, 0).addScaledVector(_fn, -_fn.y);
    _ft.normalize();
    _fb.crossVectors(_fn, _ft);
    const cs = Math.cos(a.spin), sn = Math.sin(a.spin), X = _ft.clone().multiplyScalar(cs).addScaledVector(_fb, sn), Y = _fn.clone().cross(X);
    _fm.makeBasis(X, Y, _fn);
    _fs.setScalar(D * a.sc);
    _fm.scale(_fs);
    _fm.setPosition(_fv.x + _fn.x * lift, _fv.y + _fn.y * lift, _fv.z + _fn.z * lift);
    _fm.toArray(F.mats, n++ * 16);
  }
  F.drawn = n;
}

/** The triangles of a mesh, hashed by their centres (closest-point searches) (v200 `flwTriGrid`). */
function flwTriGrid(P: Float32Array, I: ArrayLike<number>, n: number) {
  const H = flwHash(0.03, n / 3);
  for (let t = 0; t < n; t += 3) { const a = I[t]! * 3, b = I[t + 1]! * 3, d = I[t + 2]! * 3; H.add(t / 3, (P[a]! + P[b]! + P[d]!) / 3, (P[a + 1]! + P[b + 1]! + P[d + 1]!) / 3, (P[a + 2]! + P[b + 2]! + P[d + 2]!) / 3); }
  return { H, P, I };
}
/** Distance from a point to that mesh, and its height above it on nref's side (negative = through the cloth) (v200 `flwNear`). */
function flwNear(TG: ReturnType<typeof flwTriGrid>, p: P3, nref: P3): { d: number; sd: number } | null {
  let bd = 1e9, bq: P3 | null = null, bn: P3 = [0, 0, 0];
  const { H, P, I } = TG;
  H.each(p[0], p[1], p[2], (j) => {
    const t = j * 3, A = vtx(P, I[t]!), Bv = vtx(P, I[t + 1]!), C = vtx(P, I[t + 2]!), [u, v] = flwTriBary(p, A, Bv, C), w = 1 - u - v, q: P3 = [A[0] * w + Bv[0] * u + C[0] * v, A[1] * w + Bv[1] * u + C[1] * v, A[2] * w + Bv[2] * u + C[2] * v], d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d < bd) { bd = d; bq = q; const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; bn = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]; }
  });
  if (!bq) return null;
  const q = bq as P3, l = Math.hypot(...bn) || 1;
  let n: P3 = [bn[0] / l, bn[1] / l, bn[2] / l];
  if (n[0] * nref[0] + n[1] * nref[1] + n[2] * nref[2] < 0) n = [-n[0], -n[1], -n[2]];
  return { d: bd, sd: (p[0] - q[0]) * n[0] + (p[1] - q[1]) * n[1] + (p[2] - q[2]) * n[2] };
}
/**
 * Her skin as a hash of vertices: signed distance of a point (negative = inside her); further than 7 cm from every
 * vertex counts as outside, her mesh being coarse at the shoulders (v200 `flwSkin`).
 */
function flwSkin(B: GownRig) {
  const V = B.V, NM = B.geo.attributes.normal!.array as Float32Array, H = flwHash(0.03 / B.P.S, B.n), lim2 = (0.07 / B.P.S) ** 2;
  for (let i = 0; i < B.n; i++) H.add(i, V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
  return (p: P3) => {
    let bd = 1e9, bi = -1;
    H.each(p[0], p[1], p[2], (i) => { const d = (p[0] - V[i * 3]!) ** 2 + (p[1] - V[i * 3 + 1]!) ** 2 + (p[2] - V[i * 3 + 2]!) ** 2; if (d < bd) { bd = d; bi = i; } }, 2);
    if (bi < 0 || bd > lim2) return 1;
    const l = Math.hypot(NM[bi * 3]!, NM[bi * 3 + 1]!, NM[bi * 3 + 2]!) || 1;
    return ((p[0] - V[bi * 3]!) * NM[bi * 3]! + (p[1] - V[bi * 3 + 1]!) * NM[bi * 3 + 1]! + (p[2] - V[bi * 3 + 2]!) * NM[bi * 3 + 2]!) / l;
  };
}
/** Deep inside her (more than a centimetre or two): her arms as capsules round their bones, her torso as the body table (v200 `flwDeep`). */
function flwDeep(B: GownRig, T: GownEnvelope) {
  const segs: { a: THREE.Vector3; d: THREE.Vector3; l: number; r: number }[] = [];
  for (const sd of ['L', 'R'] as const) {
    const J = (n: string) => jointP(B, `${n}.${sd}`, new THREE.Vector3()), P3s = [J('upperarm01'), J('lowerarm01'), J('wrist')];
    for (let k = 0; k < 2; k++) {
      const a = P3s[k]!, d = P3s[k + 1]!.clone().sub(a), l = d.length() || 1e-6;
      d.divideScalar(l);
      const rs: number[] = [];
      for (const i of B.armV[sd]) { const px = B.V[i * 3]! - a.x, py = B.V[i * 3 + 1]! - a.y, pz = B.V[i * 3 + 2]! - a.z, t = px * d.x + py * d.y + pz * d.z; if (t < 0.15 * l || t > 0.85 * l) continue; rs.push(Math.hypot(px - d.x * t, py - d.y * t, pz - d.z * t)); }
      rs.sort((x, y) => x - y);
      // A radius well inside her arm (a quarter of its skin is closer to the bone).
      if (rs.length > 8) segs.push({ a, d, l, r: rs[(rs.length * 0.25) | 0]! * 0.85 });
    }
  }
  const top = T.y0 + (T.n - 2) * DY;
  return (p: P3) => {
    for (const g of segs) { const px = p[0] - g.a.x, py = p[1] - g.a.y, pz = p[2] - g.a.z, t = clamp(px * g.d.x + py * g.d.y + pz * g.d.z, 0, g.l); if (Math.hypot(px - g.d.x * t, py - g.d.y * t, pz - g.d.z * t) < g.r) return true; }
    // More than 1.2 cm inside the torso's own reach.
    if (p[1] > T.yHem && p[1] < top - 0.04 / B.P.S) { const e = bodyReach(T, p[0], p[1], p[2]); if (e.r < e.env - 0.012 / B.P.S) return true; }
    return false;
  };
}
/** In this pose: a flower an arm or a hand rests on, one whose petals go into her skin, or one through the cape, is not drawn (v200 `flwHide`). */
function flwHide(B: GownRig, F: GownFlowers, c: GownFlowerCloth, d: GownFlowerDesign, cap: number, geo: THREE.BufferGeometry): void {
  const V = B.V, AH = flwHash(F.D * 0.62 + 0.004 / B.P.S, B.n);
  for (const sd of ['L', 'R'] as const) for (const i of B.armV[sd]) AH.add(i, V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
  F.why = { skin: 0, cloth: 0 };
  // Only the flowers that will be drawn.
  const hid = new Uint8Array(F.A.length), D = F.D, st = Math.max(1, F.A.length / cap), use = new Uint8Array(F.A.length), h0 = typeOf(d.flowerType).h;
  for (let f = 0; f < F.A.length; f += st) use[Math.floor(f)] = 1;
  F.A.forEach((a, i) => {
    if (!use[i] || a.k === 'c' || !flwFrame(a, F, c)) return;
    const r = D * a.sc * 0.5 + 0.004 / B.P.S, h = D * a.sc * h0;
    const ctr: P3 = [_fv.x + _fn.x * h * 0.5, _fv.y + _fn.y * h * 0.5, _fv.z + _fn.z * h * 0.5];
    // An arm or a hand on it.
    if (AH.each(ctr[0], ctr[1], ctr[2], (j) => Math.hypot(V[j * 3]! - ctr[0], V[j * 3 + 1]! - ctr[1], V[j * 3 + 2]! - ctr[2]) >= r) === false) hid[i] = 1;
    // A sleeve flower turned in against her side.
    if (!hid[i] && a.k === 's') { const tip: P3 = [_fv.x + _fn.x * h, _fv.y + _fn.y * h, _fv.z + _fn.z * h], e = reach(c.T, tip[0], tip[1], tip[2]); if (e.r < e.env + 0.003 / B.P.S && tip[1] > c.T.yHem) hid[i] = 1; }
  });
  {
    const skin = flwSkin(B), deep = flwDeep(B, c.T), mm = B.P.S * 1000, K = c.cape, lift = 0.0006 / B.P.S;
    const CG = K && K.info && K.geo.index ? flwTriGrid((K.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, K.geo.index.array, K.geo.groups.length ? K.geo.groups[0]!.count : K.geo.index.count) : null;
    // The flower's outer points (petal edges and tips), its top and its heart.
    const GP = (geo.attributes.position as THREE.BufferAttribute).array as Float32Array, RIM: P3[] = [], seen = new Set<string>();
    for (let k = 0; k < GP.length; k += 3) { const x = GP[k]!, y = GP[k + 1]!, z = GP[k + 2]!, key = `${Math.round(x * 200)},${Math.round(y * 200)},${Math.round(z * 200)}`; if (seen.has(key)) continue; seen.add(key); RIM.push([x, y, z]); }
    RIM.push([0, 0, 0.02], [0.15, 0, 0.03], [-0.15, 0, 0.03], [0, 0.15, 0.03], [0, -0.15, 0.03]);
    // Her skin, coarse: is any of it within reach of a flower at all (her mesh is coarse: vertices can be 4 cm apart)?
    const far = D * 1.15 * 0.62 + 0.04 / B.P.S, FH = flwHash(far, B.n);
    for (let k = 0; k < B.n; k++) FH.add(k, B.V[k * 3]!, B.V[k * 3 + 1]!, B.V[k * 3 + 2]!);
    // The outer petal tips (the cloth check).
    const TIP = RIM.filter((q) => Math.hypot(q[0], q[1]) > 0.455);
    F.A.forEach((a, i) => {
      if (!use[i] || hid[i] || !flwFrame(a, F, c)) return;
      const near = FH.each(_fv.x, _fv.y, _fv.z, (k) => Math.hypot(FH.X[k * 3]! - _fv.x, FH.X[k * 3 + 1]! - _fv.y, FH.X[k * 3 + 2]! - _fv.z) >= far) === false;
      // Far from her skin: nothing to check.
      if (a.k !== 'c' && !near) return;
      _ft.addScaledVector(_fn, -_ft.dot(_fn));
      if (_ft.lengthSq() < 1e-12) _ft.set(0, 1, 0).addScaledVector(_fn, -_fn.y);
      _ft.normalize();
      _fb.crossVectors(_fn, _ft);
      const sc = D * a.sc, cs = Math.cos(a.spin), sn = Math.sin(a.spin), X: P3 = [_ft.x * cs + _fb.x * sn, _ft.y * cs + _fb.y * sn, _ft.z * cs + _fb.z * sn], Y: P3 = [_fn.y * X[2] - _fn.z * X[1], _fn.z * X[0] - _fn.x * X[2], _fn.x * X[1] - _fn.y * X[0]], nn: P3 = [_fn.x, _fn.y, _fn.z];
      const at = (q: P3): P3 => [0, 1, 2].map((dd) => _fv.getComponent(dd) + nn[dd]! * lift + (X[dd]! * q[0] + Y[dd]! * q[1] + nn[dd]! * q[2]) * sc) as P3;
      // Into her skin (a shoulder, an arm): not drawn in this pose.
      for (const q of RIM) { const p = at(q); if (near && (skin(p) * mm < -0.5 || deep(p))) { hid[i] = 1; F.why.skin++; break; } }
      // Through the cape where it folds sharply: not drawn in this pose.
      if (!hid[i] && a.k === 'c' && CG) for (const q of TIP) { const r = flwNear(CG, at(q), nn); if (r && r.sd * mm < -1.5) { hid[i] = 1; F.why.cloth++; break; } }
    });
  }
  F.hid = hid;
}

/**
 * Lay the flowers, after the gown, its sleeves and any cape (v200 `buildFlowers`): their spots, each pinned to its
 * cloth, those under the cape left off, those an arm rests on or that would go into her skin hidden in this pose, then
 * placed. Returns whether any are drawn. `geo` is the flower's shape (`gownFlowerGeo`), whose petal points the skin
 * check reads.
 */
export function buildGownFlowers(
  B: GownRig, c: GownFlowerCloth, d: GownFlowerDesign, F: GownFlowers, geo: THREE.BufferGeometry,
  opt: { phone: boolean; overlay?: boolean; cutAt?: ((ph: number, y: number) => boolean) | null },
): boolean {
  const on = !!c.D.geo && c.T.on && (gownFlowersOn(d) || gownCapeFlowersOn(d));
  F.type = d.flowerType;
  if (!on) { F.A = []; F.hid = null; F.count = F.dressN = F.sleeveN = F.capeN = F.coverN = 0; F.drawn = 0; return false; }
  const Dc = gownFlowerCm(d), A: GownFlowerAnchor[] = [];
  F.D = Dc / (B.P.S * 100);
  F.yRef = jointY(B, 'upperarm01.L') - 0.1 / B.P.S;
  if (gownFlowersOn(d)) {
    for (const sp of gownFlowerSpots(B, c.T, c.D, d, opt)) { const t = gownLocate(c.D, sp.ph, sp.y); if (t) A.push({ k: 'd', t: [t[0], t[1], t[2]], u: t[3], v: t[4], rows: c.D.rows, sc: sp.sc, spin: sp.spin }); }
    for (const sp of flwSleeveSpots(B, d, c.sleeves, Dc)) A.push({ k: 's', sd: sp.sd, i: sp.i, a: sp.a, sc: sp.sc, spin: sp.spin });
  }
  F.dressN = A.filter((a) => a.k === 'd').length;
  F.sleeveN = A.length - F.dressN;
  const K = c.cape && c.cape.info ? c.cape : null;
  if (K && gownCapeFlowersOn(d)) for (const sp of gownCapeFlowerSpots(B, K, d, Dc)) { const T3 = capeTriAt(K.parts[sp.part]!, sp.cf, sp.s, K.base); if (T3) A.push({ k: 'c', t: T3.t, u: T3.u, v: T3.v, part: sp.part, cf: sp.cf, s: sp.s, ck: K.key, sc: sp.sc, spin: sp.spin }); }
  F.capeN = A.length - F.dressN - F.sleeveN;
  // Under the cape: left out.
  if (K) { const keep: GownFlowerAnchor[] = []; for (const a of A) { if (a.k === 'd' && flwFrame(a, F, c) && capeAt(K, _fv.x, _fv.y, _fv.z)) continue; keep.push(a); } F.coverN = A.length - keep.length; A.length = 0; A.push(...keep); }
  else F.coverN = 0;
  F.A = A;
  F.count = A.length;
  const cap = opt.phone ? GOWN_FLOWER_CAP.phone : GOWN_FLOWER_CAP.desktop;
  flwHide(B, F, c, d, cap, geo);
  placeGownFlowers(B, F, c, cap);
  return F.drawn > 0;
}

/** The highest point of any drawn flower (the veil keeps over it) (v200 `flwTopY`). */
export function gownFlowerTopY(F: GownFlowers | null): number {
  if (!F || !F.drawn) return -1e9;
  let t = -1e9;
  for (let i = 0; i < F.drawn; i++) t = Math.max(t, F.mats[i * 16 + 13]! + F.D * 0.6);
  return t;
}
/**
 * Each drawn flower into the veil's grid of the skirt: its centre pushed out by its own radius and height (v200
 * `flwVeil`). `put(j, k0, k1, r)` is `veilGown`'s own.
 */
export function gownFlowerVeil(F: GownFlowers | null, T: GownEnvelope, put: (j: number, k0: number, k1: number, r: number) => void, fl: number, WY: number, nY: number): void {
  if (!F || !F.drawn) return;
  const P = F.mats, h = typeOf(F.type).h, czAt = czOf(T);
  for (let i = 0; i < F.drawn; i++) {
    const o = i * 16, sc = Math.hypot(P[o]!, P[o + 1]!, P[o + 2]!), nx = P[o + 8]! / sc, ny = P[o + 9]! / sc, nz = P[o + 10]! / sc;
    for (const [f, rr] of [[h, 0.25], [h * 0.5, 0.5], [0.1, 0.55]] as const) {
      const x = P[o + 12]! + nx * sc * f, y = P[o + 13]! + ny * sc * f, z = P[o + 14]! + nz * sc * f, cz = czAt(y), r0 = Math.hypot(x, z - cz);
      for (const dy of [-rr, 0, rr]) {
        const yy = y + dy * sc, j = Math.round((yy - fl) / WY);
        if (j < 0 || j >= nY) continue;
        let a = Math.atan2(x, z - cz) / DTH;
        if (a < 0) a += N;
        const k0 = (a | 0) % N, k1 = (k0 + 1) % N;
        put(j, k0, k1, r0 + rr * sc * 0.3);
      }
    }
  }
}

/** Scattered pearls: on the neckline (a bead set riding the gown) and on the veil's edge (moving with the veil). */
export type GownPearls = { neck: GownBeadSet | null; veilA: { a: number; d: number; spin: number }[]; veilSize: number; veilMats: Float32Array; veilDrawn: number };
export function emptyGownPearls(): GownPearls { return { neck: null, veilA: [], veilSize: 0, veilMats: new Float32Array(16 * 2 * VNA), veilDrawn: 0 }; }
/**
 * Lay the scattered pearls (v200 `buildPearls`): along the neckline a few cm inside the top edge, and (with a veil)
 * where each sits on the veil's edge. The veil's pearls are placed by `placeGownVeilPearls` once the veil is built.
 */
export function buildGownPearls(B: GownRig, T: GownEnvelope, D: GownDress, d: Pick<GownConfig, 'pearls' | 'veil'>, S: GownPearls, opt: { phone: boolean; veil: boolean }): void {
  S.neck = null; S.veilA = []; S.veilDrawn = 0;
  if (!D.geo || !T.on || d.pearls === 'none') return;
  const cmU = B.P.S * 100, rnd = seeded(55511);
  if (d.pearls === 'neck' || d.pearls === 'both') {
    const tri: number[] = [], bc: number[] = [], spin: number[] = [], topAt = (ph: number) => envTopAt(T, ph < 0 ? ph + TAU : ph);
    for (let a = -2.9; a <= 2.9; a += 0.0125) {
      if (rnd() > 0.55) continue;
      const ph = a + (rnd() - 0.5) * 0.01, y = topAt(ph) - (0.5 + Math.pow(rnd(), 1.6) * 3.2) / cmU, t = gownLocate(D, ph, y);
      if (!t) continue;
      tri.push(t[0], t[1], t[2]); bc.push(t[3], t[4]); spin.push(rnd() * TAU);
    }
    const n = spin.length;
    if (n) {
      const [tB, bB, sB] = gownThinBeads(tri, bc, spin, GOWN_BEAD_CAP, opt.phone);
      S.neck = { kind: 'pearl', tri: Uint32Array.from(tB), bc: Float32Array.from(bB), spin: Float32Array.from(sB), n: sB.length, count: n, size: GOWN_PEARL_MM / 10 / cmU, rows: D.rows, where: 'neck' };
    }
  }
  if ((d.pearls === 'veil' || d.pearls === 'both') && d.veil !== 'none' && opt.veil) {
    for (let a = 0; a < VNA - 1; a++) for (let k = 0; k < 2; k++) if (rnd() < 0.8) S.veilA.push({ a: a + rnd(), d: (0.6 + Math.pow(rnd(), 1.4) * 5) / cmU, spin: rnd() * TAU });
    S.veilSize = GOWN_PEARL_MM / 10 / cmU;
  }
}
const _vq = new THREE.Quaternion(), _vz = new THREE.Vector3(0, 0, 1);
/** Each veil pearl a few cm in from the veil's free edge, between two columns (v200 `prlVeilPlace`). Call when the veil moved. */
export function placeGownVeilPearls(S: GownPearls, veilGeo: THREE.BufferGeometry, T: GownEnvelope): void {
  S.veilDrawn = 0;
  if (!S.veilA.length) return;
  const P = (veilGeo.attributes.position as THREE.BufferAttribute).array as Float32Array, Nn = (veilGeo.attributes.normal as THREE.BufferAttribute).array as Float32Array, cum = new Float32Array(VNR * VNA), czAt = czOf(T);
  for (let a = 0; a < VNA; a++) for (let i = 1; i < VNR; i++) { const p = (i * VNA + a) * 3, q = p - VNA * 3; cum[i * VNA + a] = cum[(i - 1) * VNA + a]! + Math.hypot(P[p]! - P[q]!, P[p + 1]! - P[q + 1]!, P[p + 2]! - P[q + 2]!); }
  const at = (a: number, s: number) => {
    let j = 0;
    while (j < VNR - 2 && cum[(j + 1) * VNA + a]! < s) j++;
    const l0 = cum[j * VNA + a]!, l1 = cum[(j + 1) * VNA + a]!, f = l1 > l0 ? clamp((s - l0) / (l1 - l0), 0, 1) : 0, p = (j * VNA + a) * 3, q = p + VNA * 3;
    return [0, 1, 2].map((dd) => P[p + dd]! + (P[q + dd]! - P[p + dd]!) * f).concat([0, 1, 2].map((dd) => Nn[p + dd]! + (Nn[q + dd]! - Nn[p + dd]!) * f));
  };
  let n = 0;
  const sz = S.veilSize;
  for (const pa of S.veilA) {
    const a0 = Math.floor(pa.a) % (VNA - 1), a1 = a0 + 1, w = pa.a - Math.floor(pa.a), S0 = cum[(VNR - 1) * VNA + a0]!, S1 = cum[(VNR - 1) * VNA + a1]!;
    if (S0 < pa.d * 2 || S1 < pa.d * 2) continue;
    const A = at(a0, S0 - pa.d), Bq = at(a1, S1 - pa.d), p = [0, 1, 2].map((dd) => A[dd]! + (Bq[dd]! - A[dd]!) * w);
    _fn.set(A[3]! + (Bq[3]! - A[3]!) * w, A[4]! + (Bq[4]! - A[4]!) * w, A[5]! + (Bq[5]! - A[5]!) * w).normalize();
    if (p[0]! * _fn.x + (p[2]! - czAt(p[1]!)) * _fn.z < 0) _fn.negate();
    _fv.set(p[0]!, p[1]!, p[2]!).addScaledVector(_fn, sz * 0.42);
    _vq.setFromUnitVectors(_vz, _fn);
    _fs.setScalar(sz);
    _fm.compose(_fv, _vq, _fs).toArray(S.veilMats, n++ * 16);
  }
  S.veilDrawn = n;
}
/** All the pearls, for the Pearls line: the neckline's (every one, not only those drawn) and the veil's. */
export const gownPearlCount = (S: GownPearls) => (S.neck ? S.neck.count : 0) + S.veilA.length;

/** Glitter tulle by the metre (v200 `glitNet` / `flowerQuote`): layers under the skirt that are glitter, and a glitter veil. */
const GLITTER_VEIL_M: Record<GownConfig['veil'], number> = { none: 0, elbow: 1.2, fingertip: 1.5, floor: 2.5, chapel: 3, cathedral: 3.6 };
const NET_M: Record<GownConfig['petti'], number> = { none: 0, soft: 6, full: 12, hoop: 6 };
export function gownGlitterMetres(d: Pick<GownConfig, 'petti' | 'skirtLayers' | 'layerTypes' | 'veil' | 'veilFab'>): { layers: number; veil: number; layerN: number } {
  const nL = gownLayerCount(d), gl = (d.layerTypes || []).slice(0, nL).filter((x) => x === 'glitter').length;
  return { layers: gl && nL ? (NET_M[d.petti] * (d.skirtLayers / 2) * gl) / nL : 0, veil: d.veilFab === 'glitter' && d.veil !== 'none' ? GLITTER_VEIL_M[d.veil] : 0, layerN: gl };
}
/** How much of the plain petticoat / veil net is glitter tulle instead (v200 `glitNet`), never more than the net. */
export const gownGlitterNet = (net: number, d: Parameters<typeof gownGlitterMetres>[0]) => { const g = gownGlitterMetres(d); return Math.min(net, g.layers + g.veil); };

/** The flowers, raised lace, glitter tulle and pearls in words, for the designer (v200 `flowerSummary`). */
export function gownFlowerSummary(
  d: GownFlowerDesign & Pick<GownConfig, 'laceFinish' | 'veilFab' | 'ovFab' | 'layerTypes' | 'petti' | 'skirtLayers' | 'capeFab'>,
  s: { F: GownFlowers | null; pearls: GownPearls | null; accented: boolean; laceCount: number; capeFab: string | null },
): string[] {
  const out: string[] = [], ty = typeOf(d.flowerType), col = d.flowerCol === 'accent' && s.accented ? 'the accent colour' : d.flowerCol === 'gown' || d.flowerCol === 'accent' ? 'the gown colour' : d.flowerCol;
  const F = s.F;
  if (F && F.count) {
    const on = gownFlowersOn(d), capeOn = gownCapeFlowersOn(d);
    out.push(`3D flowers: about ${F.count} ${ty.name.toLowerCase()}, ${gownFlowerCm(d)} cm across, in ${col}` + [
      on && d.flowers !== 'none' ? ` ${FLW_AT[d.flowers]}${d.flowers === 'cascade' ? ` from her left ${d.flowerFrom === 'shoulder' && !GOWN_STRAPLESS.includes(d.neck) ? 'shoulder' : 'bodice edge'} across the front and down the skirt to her right` : ''}` : '',
      capeOn && d.capeFlowers !== 'none' ? ` ${FLW_CAPE[d.capeFlowers]}` : '',
    ].filter(Boolean).join(' and'));
  }
  if (d.laceFinish === 'raised' && s.laceCount > 0) out.push('Raised (3D) lace: the motifs padded and shaped to stand off the gown');
  const gl = [d.veilFab === 'glitter' && d.veil !== 'none' ? 'veil' : '', d.ovFab === 'glitter' && d.overlay !== 'none' ? 'overlay' : '', d.cape !== 'none' && s.capeFab === 'glitter' ? 'cape' : '', (d.layerTypes || []).slice(0, gownLayerCount(d)).includes('glitter') ? 'layers under the skirt' : ''].filter(Boolean);
  if (gl.length) out.push(`Glitter tulle: ${gl.join(', ')}`);
  const pn = s.pearls ? gownPearlCount(s.pearls) : 0;
  if (d.pearls !== 'none' && pn) out.push(`Scattered pearls (${GOWN_PEARL_MM} mm) ${{ neck: 'along the neckline', veil: 'along the veil edge', both: 'along the neckline and the veil edge' }[d.pearls]}, about ${Math.round(pn / 10) * 10}`);
  return out;
}

/**
 * What the flowers, raised lace and glitter tulle take (v200 `flowerQuote`; unpriced until the designer prices them):
 * every flower to make and attach (counted by tens on the quote), raised lace when there is lace, glitter tulle by the
 * metre for the layers and the veil.
 */
export function gownFlowerQuantities(d: Pick<GownConfig, 'laceFinish' | 'petti' | 'skirtLayers' | 'layerTypes' | 'veil' | 'veilFab'>, F: GownFlowers | null, laceCount: number): { flowers: number; flowerTens: number; laceRaised: boolean; glitter: ReturnType<typeof gownGlitterMetres> } {
  const flowers = F ? F.count : 0;
  return { flowers, flowerTens: Math.ceil(flowers / 10), laceRaised: d.laceFinish === 'raised' && laceCount > 0, glitter: gownGlitterMetres(d) };
}
