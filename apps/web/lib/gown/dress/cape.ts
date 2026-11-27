/**
 * 👗 gown/dress/cape — a side cape (her left shoulder), a back cape or a capelet, in the gown's own fabric (prototype v193
 * `buildCape`, `capeArms`, `writeCape`, `capeMetres`). Hung from the base of her neck. Each column of the cape is a ray
 * out from her centre line at one direction round her: going down, it lies on whatever is widest so far (shoulder, arm,
 * sleeve, bodice, skirt) and never comes back in, so past the widest point it falls straight. Neighbouring columns are
 * eased into each other, so a fold over the arm tapers instead of standing up as a wall.
 *
 * State is passed in: the posed body, its envelope, the dress as built and the cloth's swing. Plain three.js maths.
 */
import * as THREE from 'three';
import type { GownCape, GownSilhouette, GownTrain } from '../../gown-config';
import { jointP, jointY } from '../body/bones';
import { RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from './build';
import { CLOTH_BANDS, type GownCloth } from './cloth';
import { GOWN_TRAIN_CM, trainShare } from './lines';
import type { GownEnvelope } from './table';

const N = RING_N, DY = SLICE_DY, DTH = TAU / N;
/** Columns round her, rows from the neck to the hem or the floor. */
export const CAPE_COLS = 61;
export const CAPE_ROWS = 72;
const CNA = CAPE_COLS, CNR = CAPE_ROWS;

/** Poses (by name: the motion step names them) where a floor-length cape can't hang clean (kneeling, seated): hidden there, still in the design. */
export const GOWN_CAPE_HIDE: Record<Exclude<GownCape, 'none'>, readonly string[]> = {
  side: ['kneel', 'sit', 'cross'],
  back: ['kneel', 'sit', 'cross'],
  capelet: [],
};
/** How far a cape runs on along the floor past her heel, before any train (cm). */
export const GOWN_CAPE_FLOOR_CM = 15;

export type GownCapeShape = {
  ys: number[];
  Rm: Float32Array;
  j0: Int32Array;
  tops: Float32Array;
  hems: Float32Array;
  a0: number;
  a1: number;
  ring: boolean;
  czAt: (y: number) => number;
};

export type GownCapeMesh = {
  geo: THREE.BufferGeometry;
  /** The still shape, before the swing. */
  base: Float32Array;
  info: GownCapeShape | null;
  kind: GownCape;
  /** The swing it was last written for. */
  th: number | null;
};

/** The design keys the cape reads. */
export type GownCapeDesign = { cape: GownCape; sil: GownSilhouette; train: GownTrain };

export function emptyCape(): GownCapeMesh {
  const g = new THREE.BufferGeometry(), ix: number[] = [], n = CNR * CNA;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  // No lace, cut-outs or techniques on the cape.
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  for (let i = 0; i < CNR - 1; i++) for (let a = 0; a < CNA - 1; a++) { const p = i * CNA + a, q = p + CNA; ix.push(p, q, p + 1, p + 1, q, q + 1); }
  g.setIndex(ix);
  return { geo: g, base: new Float32Array(n * 3), info: null, kind: 'none', th: null };
}

/** Whether the cape hangs in this pose (a floor-length cape hides while she kneels or sits). */
export const gownCapeShown = (kind: GownCape, pose: string) => kind !== 'none' && !GOWN_CAPE_HIDE[kind].includes(pose);

const armEdges = new WeakMap<GownRig, Partial<Record<'L' | 'R', Uint32Array>>>();

/**
 * The arms (and any sleeves) as small balls, each touching the skin at one vertex from inside: the cape lies on the real
 * arm. `sleeves` are the sleeve meshes' posed positions, when she wears sleeves.
 */
export function capeArms(B: GownRig, sides: readonly ('L' | 'R')[], sleeves: Partial<Record<'L' | 'R', ArrayLike<number>>> = {}): number[] {
  const out: number[] = [], V = B.V, vox = new Set<number>(), seen = new Uint8Array(B.n);
  let rho = 0.025;
  const NM = B.geo.attributes.normal ? (B.geo.attributes.normal.array as Float32Array) : null;
  for (const sd of sides) {
    const J = (s: string) => jointP(B, `${s}.${sd}`, new THREE.Vector3()), S = J('upperarm01'), E = J('lowerarm01'), W = J('wrist');
    const Hd = W.clone().addScaledVector(W.clone().sub(E).normalize(), B.handLen);
    const pts = [S, E, W, Hd], seg: { a: THREE.Vector3; d: THREE.Vector3; l: number }[] = [];
    for (let k = 0; k < 3; k++) { const d = pts[k + 1]!.clone().sub(pts[k]!), l = d.length() || 1e-6; seg.push({ a: pts[k]!, d: d.divideScalar(l), l }); }
    let nx: number | null = null, ny = 0, nz = 0;
    const addP = (x: number, y: number, z: number) => {
      // One ball per 12 mm: they overlap by far more than that.
      const key = (Math.round(x / 0.012) * 73856093) ^ (Math.round(y / 0.012) * 19349663) ^ (Math.round(z / 0.012) * 83492791);
      if (vox.has(key)) return;
      vox.add(key);
      let best = 1e9, bx = 0, by = 0, bz = 0; // the nearest point on the arm's own centre line
      for (const g of seg) {
        const px = x - g.a.x, py = y - g.a.y, pz = z - g.a.z, t = clamp(px * g.d.x + py * g.d.y + pz * g.d.z, 0, g.l);
        const qx = g.a.x + g.d.x * t, qy = g.a.y + g.d.y * t, qz = g.a.z + g.d.z * t, dd = Math.hypot(x - qx, y - qy, z - qz);
        if (dd < best) { best = dd; bx = qx; by = qy; bz = qz; }
      }
      const r = Math.min(rho, best);
      // Inset along the skin's own normal: the ball touches the skin at the vertex and nowhere stands out of it.
      if (nx === null) { const k = best > 1e-6 ? r / best : 0; out.push(x - (x - bx) * k, y - (y - by) * k, z - (z - bz) * k, r + 0.002); }
      else out.push(x - nx * r, y - ny * r, z - nz * r, r + 0.002);
    };
    const addV = (i: number) => {
      if (seen[i]) return;
      seen[i] = 1;
      if (NM) { const l = Math.hypot(NM[i * 3]!, NM[i * 3 + 1]!, NM[i * 3 + 2]!) || 1; nx = NM[i * 3]! / l; ny = NM[i * 3 + 1]! / l; nz = NM[i * 3 + 2]! / l; }
      addP(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
    };
    for (const L of [B.armS[sd], B.armV[sd]]) for (const i of L) addV(i);
    {
      // The armpit and the front and back of the shoulder, where the body table stops.
      const r0 = rho;
      rho = 0.012;
      const cache = armEdges.get(B) ?? {};
      armEdges.set(B, cache);
      const ex = cache[sd] ?? (cache[sd] = Uint32Array.from({ length: B.n }, (_, i) => i).filter((i) => B.aw[i]! > 0.1 && B.hw[i]! < 0.5 && B.pos0[i * 3]! > 0 === (sd === 'L')));
      for (const i of ex) addV(i);
      rho = r0;
    }
    nx = null;
    const sl = sleeves[sd];
    if (sl) for (let i = 0; i < sl.length; i += 3) addP(sl[i]!, sl[i + 1]!, sl[i + 2]!);
  }
  return out;
}

/**
 * Hang the cape on her (v193 `buildCape`). `T` and `D` are the envelope and the dress of the same pose (the dress already
 * written by `writeDress`); `floorY` is where she stands. Returns false (nothing to draw) for no cape, or a pose that
 * hides it.
 */
export function buildCape(
  B: GownRig, T: GownEnvelope, D: GownDress, C: GownCloth, cape: GownCapeMesh, design: GownCapeDesign,
  opt: { floorY: number; pose: string; pleatAmp?: number; dressShown?: boolean; sleeves?: Partial<Record<'L' | 'R', ArrayLike<number>>> },
): boolean {
  const kind = design.cape;
  cape.kind = kind;
  if (kind === 'none' || !T.on || !gownCapeShown(kind, opt.pose)) { cape.info = null; return false; }
  const P = B.P, cm = 0.01 / P.S, yN = jointY(B, 'neck01'), ySh = jointY(B, 'upperarm01.L'), Ltr = GOWN_TRAIN_CM[design.train];
  const yFl = opt.floorY + (Ltr > 0 ? 0.03 : 0.012);
  // The capelet's seam is at centre back.
  const side = kind === 'side', ring = kind === 'capelet', a0 = side ? 1.15 : kind === 'back' ? 1.9 : Math.PI, a1 = side ? 2.75 : kind === 'back' ? TAU - 1.9 : Math.PI + TAU;
  const ang = new Float32Array(CNA);
  for (let c = 0; c < CNA; c++) ang[c] = a0 + ((a1 - a0) * c) / (CNA - 1);
  const back = (a: number) => (1 - Math.cos(a)) / 2;
  const hem = (a: number) =>
    ring ? ySh - 0.045 - 0.05 * smoothstep(back(a), 0.1, 0.6)
      : side ? (a < 1.95 ? ySh + 0.02 - 0.12 * smoothstep(a, 1.15, 1.6) : ySh - 0.1 + (yFl - (ySh - 0.1)) * smoothstep(a, 1.95, 2.45))
        : yFl;
  const floorW = (a: number) => (ring ? 0 : side ? smoothstep(a, 2.25, 2.75) : smoothstep(back(a), 0.6, 0.95));
  const FL = (GOWN_CAPE_FLOOR_CM + Ltr * 0.9) / 100 / P.S;

  // The lattice: rows at fixed heights (fine over the shoulders), one column per direction.
  let yLo = 1e9;
  const tops = new Float32Array(CNA), hems = new Float32Array(CNA), yHi = yN + 0.005;
  for (let c = 0; c < CNA; c++) { hems[c] = Math.max(yFl, hem(ang[c]!)); yLo = Math.min(yLo, hems[c]!); }
  const ys: number[] = [];
  // Fine over the shoulders, finer where a full skirt springs out from the waist.
  for (let y = yHi; y > yLo - 1e-6;) { ys.push(y); y -= y > yHi - 0.13 ? 0.0025 : y > ySh - 0.25 || (design.sil === 'ball' && y > T.yS - 0.25) ? 0.005 : 0.01; }
  const NJ = ys.length, need = new Float32Array(NJ * CNA), Rm = new Float32Array(NJ * CNA), j0 = new Int32Array(CNA);
  const arms = capeArms(B, side ? ['L'] : ['L', 'R'], opt.sleeves), off = 0.45 * cm, offA = 0.4 * cm, tableTop = T.y0 + (T.n - 2) * DY;
  const czAt = (y: number) => { const f = clamp((y - T.y0) / DY, 0, T.n - 1.001), j = f | 0; return T.cz[j]! + (T.cz[j + 1]! - T.cz[j]!) * (f - j); };
  const SN = Array.from(ang, Math.sin), CS = Array.from(ang, Math.cos);
  const CK0 = new Int32Array(CNA), CKW = new Float32Array(CNA);
  for (let c = 0; c < CNA; c++) { let a = Math.atan2(SN[c]!, CS[c]!) / DTH; if (a < 0) a += N; CK0[c] = (a | 0) % N; CKW[c] = a - (a | 0); }
  // Body, or the gown where the gown really is (not above its top edge).
  const envAt = (c: number, y: number) => {
    const f = clamp((y - T.y0) / DY, 0, T.n - 1.001), j = f | 0, u = f - j, k0 = CK0[c]!, k1 = (k0 + 1) % N, w = CKW[c]!;
    const rd = (A: Float32Array, jj: number) => A[jj * N + k0]! * (1 - w) + A[jj * N + k1]! * w;
    const bodyR = rd(T.H, j) * (1 - u) + rd(T.H, j + 1) * u;
    if (!T.on) return bodyR;
    const top = T.top[k0]! * (1 - w) + T.top[k1]! * w, y2 = Math.min(y, top - 0.002), f2 = clamp((y2 - T.y0) / DY, 0, T.n - 1.001), j2 = f2 | 0, u2 = f2 - j2;
    if (j2 < T.jHem || j2 >= T.jTop) return bodyR;
    const cl = (rd(T.F, j2) * (1 - u2) + rd(T.F, j2 + 1) * u2) * (y2 < T.yF ? 1.07 : 1);
    // Above the gown's top edge the cloth fades into the body: no ledge.
    return Math.max(bodyR, cl - 0.3 * Math.max(0, y - y2));
  };
  const pl = opt.pleatAmp ?? 0;
  for (let j = 0; j < NJ; j++) {
    const y = ys[j]!, tS = clamp((T.yS - y) / Math.max(0.05, T.yS - T.yHem), 0, 1), gS = smoothstep(tS, 0.35, 1), sk = y < T.yS ? 1 + D.fold * tS : 1, plY = pl && y < T.yS ? pl : 0;
    for (let c = 0; c < CNA; c++) {
      if (j < j0[c]!) continue;
      const sx = SN[c]!, sz = CS[c]!;
      let r = 0;
      if (y < tableTop) {
        const phV = Math.abs(Math.atan2(sx, sz)), runOn = D.Lt && T.on ? D.Lt * trainShare(phV) * 0.14 * gS * gS * 1.1 : 0;
        r = envAt(c, y) * sk + plY + runOn + off + 0.004 * tS;
      }
      need[j * CNA + c] = r;
    }
    {
      // A stray value in the body table (a ray grazing a toe or a fold, up to 0.7 m out) never props the cape out.
      const o = j * CNA, row = Array.from(need.subarray(o, o + CNA)).filter((v) => v > 0).sort((a, b) => a - b), md = row.length ? row[row.length >> 1]! : 0;
      for (let c = 0; c < CNA; c++) if (md && need[o + c]! > 1.8 * md + 0.06) need[o + c] = Math.max(md, j > 0 && need[o - CNA + c]! <= 1.8 * md + 0.06 ? need[o - CNA + c]! : 0);
    }
  }
  {
    // The top edge: where her neck meets the shoulders (the body has widened 1.2 cm past the neck), smoothed round her.
    const yt = new Float32Array(CNA);
    for (let c = 0; c < CNA; c++) { const n0 = need[c]!; let j = 0; while (j < NJ - 1 && need[j * CNA + c]! < n0 + 0.012 && ys[j]! > yN - 0.08) j++; yt[c] = ys[Math.max(0, j - 1)]!; }
    for (let c = 0; c < CNA; c++) {
      let s = 0, w = 0;
      for (let d = -3; d <= 3; d++) { let c2 = c + d; c2 = ring ? (((c2 % (CNA - 1)) + (CNA - 1)) % (CNA - 1)) : clamp(c2, 0, CNA - 1); const k = 4 - Math.abs(d); s += yt[c2]! * k; w += k; }
      let j = 0;
      while (j < NJ - 1 && ys[j]! > s / w + 1e-6) j++;
      j0[c] = j;
      tops[c] = Math.max(ys[j]!, s / w);
    }
  }
  if (D.geo && opt.dressShown !== false) {
    // The gown as it is really drawn (folds, a full skirt springing from the waist), not the train on the floor.
    const DP = D.geo.attributes.position!.array as Float32Array, rS = Math.min(D.rows, 2 + D.nb + D.ns), st = (a1 - a0) / (CNA - 1), hwD = DTH * 0.75;
    for (let q = 0; q < N; q++) {
      if (!ring) { const aq = q * DTH; if (aq < a0 - 0.35 || aq > a1 + 0.35) continue; }
      for (let r = 0; r < rS - 1; r++) {
        const p1 = (r * N + q) * 3, p2 = p1 + N * 3, y1 = DP[p1 + 1]!, y2 = DP[p2 + 1]!, yA = Math.max(y1, y2), yB = Math.min(y1, y2);
        let lo = 0, hi = NJ - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m]! > yA) lo = m + 1; else hi = m; }
        for (let j = lo; j < NJ && ys[j]! >= yB; j++) {
          if (ys[j]! > yA) continue;
          const y = ys[j]!, u = y1 === y2 ? 0 : (y - y1) / (y2 - y1), cz = czAt(y), x = DP[p1]! + (DP[p2]! - DP[p1]!) * u, z = DP[p1 + 2]! + (DP[p2 + 2]! - DP[p1 + 2]!) * u - cz;
          const rr = Math.hypot(x, z) + off + 0.002 + 0.003 * clamp((T.yS - y) / 0.3, 0, 1);
          let ac = Math.atan2(x, z);
          if (ring) { while (ac < a0) ac += TAU; while (ac > a1) ac -= TAU; } else if (ac < 0) ac += TAU;
          for (const sh of ring ? [0, TAU, -TAU] : [0]) {
            for (let c = Math.max(0, Math.ceil((ac + sh - hwD - a0) / st)); c <= Math.min(CNA - 1, Math.floor((ac + sh + hwD - a0) / st)); c++) { const o = j * CNA + c; if (rr > need[o]!) need[o] = rr; }
          }
        }
      }
    }
  }
  {
    // The body as cloth feels it: small hollows between bumps (shoulder blades, the spine) bridged over, about 5 cm round.
    const st = (a1 - a0) / (CNA - 1), t2 = new Float32Array(CNA);
    for (let c = 0; c < CNA; c++) for (let j = j0[c]!; j < NJ; j++) {
      const o = j * CNA + c;
      let m = need[o]!;
      if (ys[j]! > T.yS) for (const dk of [-2, 2]) for (let k = j + dk; k >= j0[c]! && k < NJ; k += dk) { const dy = ys[j]! - ys[k]!; if (Math.abs(dy) > 0.06 || ys[k]! < T.yS) break; const v = need[k * CNA + c]! - 10 * dy * dy; if (v > m) m = v; }
      Rm[o] = m;
    }
    for (let j = 0; j < NJ; j++) {
      const o = j * CNA;
      for (let c = 0; c < CNA; c++) {
        if (j < j0[c]!) { t2[c] = need[o + c]!; continue; }
        let m = Rm[o + c]!;
        for (let d = 1; d * st < 0.4; d++) for (let e = -1; e <= 1; e += 2) {
          const cc = c + e * d;
          let c2 = cc;
          if (ring) c2 = ((cc % (CNA - 1)) + (CNA - 1)) % (CNA - 1); else if (cc < 0 || cc >= CNA) continue;
          if (j < j0[c2]!) continue;
          const arc = Rm[o + c2]! * d * st, v = Rm[o + c2]! - 10 * arc * arc;
          if (v > m) m = v;
        }
        t2[c] = m;
      }
      for (let c = 0; c < CNA; c++) need[o + c] = t2[c]!;
    }
  }
  {
    // Each arm ball: the rows it crosses, the columns it covers, where each ray leaves it.
    const st = (a1 - a0) / (CNA - 1);
    // A ray that misses by less than one column's width counts as a hit: the cloth between two columns then clears the ball too.
    const hit = (j: number, c: number, px: number, pz: number, d: number, rho: number) => {
      if (c < 0 || c >= CNA || j < j0[c]!) return;
      const pr = px * SN[c]! + pz * CS[c]!;
      if (pr <= 0) return;
      const perp = Math.sqrt(Math.max(0, d * d - pr * pr)), pe = Math.max(0, perp - pr * st);
      if (pe >= rho) return;
      const far = pr + Math.sqrt(rho * rho - pe * pe) + offA, o = j * CNA + c;
      if (far > need[o]!) need[o] = far;
    };
    for (let s = 0; s < arms.length; s += 4) {
      const sxp = arms[s]!, syp = arms[s + 1]!, szp = arms[s + 2]!, sr = arms[s + 3]!;
      let lo = 0, hi = NJ - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (ys[m]! > syp + sr) lo = m + 1; else hi = m; }
      for (let j = lo; j < NJ && ys[j]! >= syp - sr; j++) {
        const dy = ys[j]! - syp, rho = Math.sqrt(Math.max(0, sr * sr - dy * dy)), px = sxp, pz = szp - czAt(ys[j]!), d = Math.hypot(px, pz);
        if (d < 1e-4) continue;
        let ac = Math.atan2(px, pz);
        if (ring) { while (ac < a0) ac += TAU; while (ac > a1) ac -= TAU; } else if (ac < 0) ac += TAU;
        const hw = (rho >= d ? Math.PI : Math.asin(rho / d)) + st * 1.2;
        for (const sh of ring ? [0, TAU, -TAU] : [0]) { const aa = ac + sh; for (let c = Math.ceil((aa - hw - a0) / st); c <= Math.floor((aa + hw - a0) / st); c++) hit(j, c, px, pz, d, rho); }
      }
    }
  }
  {
    // Below the arms the cloth eases over an edge (the gown's top, the shoulder blades) instead of stepping out at it.
    const n0 = Float32Array.from(need);
    for (let c = 0; c < CNA; c++) for (let j = NJ - 2; j >= j0[c]!; j--) {
      if (ys[j]! > ySh - 0.03) break;
      const o = j * CNA + c, v = Math.min(need[o + CNA]! - 0.25 * (ys[j]! - ys[j + 1]!), n0[o]! + 0.012);
      if (v > need[o]!) need[o] = v;
    }
  }
  // Fabric hangs: it never comes back in below the widest point.
  for (let c = 0; c < CNA; c++) for (let j = j0[c]!; j < NJ; j++) { const o = j * CNA + c; Rm[o] = j > j0[c]! ? Math.max(need[o]!, Rm[o - CNA]!) : need[o]!; }
  {
    // Ease the columns into each other: a fold over the arm slopes off at most this steeply.
    const tmp = new Float32Array(CNA), K = 2, W = 0.42, stp = (a1 - a0) / (CNA - 1);
    for (let j = 0; j < NJ; j++) {
      const o = j * CNA;
      for (let c = 0; c < CNA; c++) {
        if (j < j0[c]!) { tmp[c] = 0; continue; }
        let m = Rm[o + c]!;
        for (let d = 1; d * stp <= W; d++) for (let e = -1; e <= 1; e += 2) {
          const cc = c + e * d, da = d * stp;
          let c2 = cc;
          if (ring) c2 = ((cc % (CNA - 1)) + (CNA - 1)) % (CNA - 1); else if (cc < 0 || cc >= CNA) continue;
          if (j < j0[c2]!) continue;
          const v = Rm[o + c2]! * (1 - K * da);
          if (v > m) m = v;
        }
        tmp[c] = m;
      }
      for (let c = 0; c < CNA; c++) if (j >= j0[c]!) {
        const l = ring ? tmp[(c + CNA - 2) % (CNA - 1)]! : tmp[Math.max(0, c - 1)]!, r2 = ring ? tmp[(c + 1) % (CNA - 1)]! : tmp[Math.min(CNA - 1, c + 1)]!;
        Rm[o + c] = Math.max(tmp[c]!, (l + 2 * tmp[c]! + r2) / 4);
      }
    }
  }
  for (let c = 0; c < CNA; c++) for (let j = j0[c]! + 1; j < NJ; j++) { const o = j * CNA + c; if (Rm[o]! < Rm[o - CNA]!) Rm[o] = Rm[o - CNA]!; }
  // A crease where the cloth leaves her (shoulder blades, the gown's top edge) rounds over, about 5 cm round, instead of
  // folding sharp (above the skirt only: on a sloping skirt it would lift the cape off).
  for (let c = 0; c < CNA; c++) for (let j = j0[c]!; j < NJ; j++) {
    const o = j * CNA + c;
    let m = Rm[o]!;
    if (ys[j]! > T.yS) for (let k = j + 1; k < NJ; k++) { const dy = ys[j]! - ys[k]!; if (dy > 0.1 || ys[k]! < T.yS) break; const v = Rm[k * CNA + c]! - 10 * dy * dy; if (v > m) m = v; }
    Rm[o] = m;
  }

  // Each column: its outline from the neck to the hem (and along the floor), then the rows spaced evenly along it.
  type Pt = { R: number; y: number; s: number; cl: number; fr: number; fl: number };
  const prof: Pt[][] = [], lens = new Float32Array(CNA);
  let Smax = 0;
  for (let c = 0; c < CNA; c++) {
    const pr: Pt[] = [{ R: Rm[j0[c]! * CNA + c]!, y: tops[c]!, s: 0, cl: 0, fr: 0, fl: 0 }], h = hems[c]!; // starts exactly on the smoothed top edge
    let s = 0, yC = tops[c]!;
    for (let j = j0[c]!; j < NJ; j++) {
      let y = ys[j]!, R = Rm[j * CNA + c]!;
      const cl = R - need[j * CNA + c]!;
      if (cl < 0.003) yC = y; // the last place the cloth touched her
      if (y < h) { const yp = ys[j - 1]!, f = (yp - h) / Math.max(1e-6, yp - y), Rp = Rm[(j - 1) * CNA + c]!; R = Rp + (R - Rp) * f; y = h; }
      if (pr.length) { const q = pr[pr.length - 1]!; s += Math.hypot(R - q.R, y - q.y); }
      pr.push({ R, y, s, cl: Math.max(0, cl), fr: yC - y, fl: 0 });
      if (y <= h) break;
    }
    const fw = floorW(ang[c]!);
    if (h <= yFl + 1e-4 && fw > 0.01) { const q = pr[pr.length - 1]!; pr.push({ R: q.R, y: q.y, s: s + FL * fw, cl: q.cl, fr: q.fr, fl: FL * fw }); s += FL * fw; }
    prof.push(pr);
    lens[c] = s;
    Smax = Math.max(Smax, s);
  }
  const pw = ring ? 1.15 : 1.7, pos = cape.base, foldK = ring ? 0.035 : 0.06;
  for (let c = 0; c < CNA; c++) {
    const pr = prof[c]!, sx = SN[c]!, sz = CS[c]!, bk = back(ang[c]!);
    let k = 0;
    const fx = 0.25 * sx, fz = -(0.6 + 0.4 * bk), fn = Math.hypot(fx, fz); // along the floor: mostly behind her, a little outward
    for (let i = 0; i < CNR; i++) {
      const s = Math.min(lens[c]!, Smax * Math.pow(i / (CNR - 1), pw));
      while (k < pr.length - 2 && pr[k + 1]!.s < s) k++;
      const A = pr[k]!, Bp = pr[Math.min(pr.length - 1, k + 1)]!, u = Bp.s > A.s ? clamp((s - A.s) / (Bp.s - A.s), 0, 1) : 0, o = (i * CNA + c) * 3;
      const onFloor = Bp.fl > 0 && u > 0, R0 = onFloor ? A.R : A.R + (Bp.R - A.R) * u, y = onFloor ? A.y : A.y + (Bp.y - A.y) * u;
      const cl = A.cl + (Bp.cl - A.cl) * (onFloor ? 0 : u), fr = A.fr + (Bp.fr - A.fr) * (onFloor ? 0 : u);
      // Soft folds, outward only, and only where the cloth hangs free.
      const fold = Math.min(foldK * R0 * smoothstep(fr, 0.03, 0.45), 0.6 * cl) * (0.5 + 0.5 * Math.sin(14 * ang[c]! + 1.3)), R = R0 + fold, cz = czAt(y);
      let x = R * sx, z = cz + R * sz;
      if (onFloor) { const d = Bp.fl * u; x += (fx / fn) * d; z += (fz / fn) * d; }
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    }
  }
  cape.info = { ys, Rm, j0, tops, hems, a0, a1, ring, czAt };
  const rest = cape.geo.attributes.rest as THREE.BufferAttribute;
  (rest.array as Float32Array).set(pos);
  rest.needsUpdate = true;
  cape.th = null;
  writeCape(cape, T, C, true);
  return true;
}

/** Twirl and turn: below the waist the cape swings out and trails like the skirt it lies on (v193 `writeCape`). */
export function writeCape(cape: GownCapeMesh, T: GownEnvelope, C: GownCloth, force = false): void {
  if (!cape.info) return;
  const K = CLOTH_BANDS - 1, sig = C.th[K]! * 7 + C.phi[K]! * 3 + C.th[3]! + C.phi[3]!;
  if (!force && cape.th === sig) return;
  cape.th = sig;
  const src = cape.base, posA = cape.geo.attributes.position as THREE.BufferAttribute, p = posA.array as Float32Array;
  const len = Math.max(0.05, T.yS - T.yHem), czAt = cape.info.czAt, still = Math.abs(sig) < 1e-5;
  if (still) p.set(src);
  else for (let o = 0; o < src.length; o += 3) {
    const y = src[o + 1]!;
    if (y >= T.yS) { p[o] = src[o]!; p[o + 1] = y; p[o + 2] = src[o + 2]!; continue; }
    const t = clamp((T.yS - y) / len, 0, 1), fk = t * K, k = Math.min(K - 1, fk | 0), w = fk - k, f = C.phi[k]! * (1 - w) + C.phi[k + 1]! * w;
    const lag = (C.th[k]! * (1 - w) + C.th[k + 1]! * w) * smoothstep(t, 0, 0.15);
    const cz = czAt(y), x = src[o]!, z = src[o + 2]! - cz, r = Math.hypot(x, z) * (1 + 0.24 * f * smoothstep(t, 0, 0.15)), a = Math.atan2(x, z) - lag;
    p[o] = r * Math.sin(a); p[o + 1] = y; p[o + 2] = cz + r * Math.cos(a);
  }
  posA.needsUpdate = true;
  cape.geo.computeVertexNormals();
  if (cape.info.ring) {
    // No line where the capelet closes.
    const nmA = cape.geo.attributes.normal as THREE.BufferAttribute, nm = nmA.array as Float32Array;
    for (let i = 0; i < CNR; i++) { const a = i * CNA * 3, b = (i * CNA + CNA - 1) * 3; for (let k = 0; k < 3; k++) { const v = (nm[a + k]! + nm[b + k]!) / 2; nm[a + k] = nm[b + k] = v; } }
    nmA.needsUpdate = true;
  }
  cape.geo.computeBoundingSphere();
}

/**
 * The cape laid flat on 150 cm fabric (metres): at least its longest line, more when its area needs more than one width
 * (+30 % for the curves). Zero when there is no cape hung.
 */
export function capeMetres(B: GownRig, cape: GownCapeMesh | null): number {
  if (!cape || !cape.info || cape.kind === 'none') return 0;
  const P = (cape.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, ix = cape.geo.index!.array, S = B.P.S;
  let L = 0, A = 0;
  for (let c = 0; c < CNA; c++) {
    let l = 0;
    for (let i = 1; i < CNR; i++) { const a = ((i - 1) * CNA + c) * 3, b = (i * CNA + c) * 3; l += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
    L = Math.max(L, l);
  }
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3, b = ix[t + 1]! * 3, c = ix[t + 2]! * 3;
    const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
    A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return Math.max(L * S + 0.1, ((A * S * S) / 1.4) * 1.3 + 0.1);
}
