/**
 * 👗 gown/dress/cape — the cape catalogue (prototype v196, as v197 has it: `CAPE_DEF`, `capeSpecs`, `hangPart`,
 * `capeStrap`, `capeTrimBuild`, `buildCape`, `writeCape`, `capeAt`, `capeMetres`): a neck cape, a back cape, a pair of
 * shoulder capes, a side cape, a capelet and a one-shoulder drape.
 *
 * A cape is one or two panels. Each panel is hung the v193 way: each column is a ray out from her centre line at one
 * direction round her; going down it lies on whatever is widest so far (shoulder, arm, sleeve, bodice, skirt) and never
 * comes back in, so past the widest point it falls straight. What each cape changes is where its columns start (the base
 * of the neck, a band round the neck, the line of a strap over the shoulder, the shoulders), where they end (its length;
 * the neck cape's short front) and which directions round her it covers. Whatever the cape carries (a lace or appliqué
 * border, beads, a neck band, a strap, a clasp) is built into the same mesh as extra groups, so every cape is one mesh to
 * draw (groups: 0 its cloth, 1 its border, 2 bands and straps, 3 clasps and beads), and it rides the twirl with the cloth
 * under it.
 *
 * State is passed in: the posed body, its envelope, the dress as built and the cloth's swing. Plain three.js maths.
 */
import * as THREE from 'three';
import { GOWN_CAPE_STRAP, GOWN_STRAPLESS, gownCapeKind, gownCapeNow, gownStrapCovers, type GownCapeKind, type GownCapeLength, type GownConfig } from '../../gown-config';
import { gownSleeveBandTop } from '../parts/sleeves-extra';
import { jointP, jointY } from '../body/bones';
import { RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from './build';
import { CLOTH_BANDS, type GownCloth } from './cloth';
import { GOWN_TRAIN_CM, trainShare } from './lines';
import { czOf, envTabR as capeTabR, envTopAt as capeTopAt, type GownEnvelope } from './table';

const N = RING_N, DY = SLICE_DY, DTH = TAU / N;
/** Columns round her, rows from the top to the hem or the floor; vertices per panel; room for the trim. */
export const CAPE_COLS = 61;
export const CAPE_ROWS = 72;
const CNA = CAPE_COLS, CNR = CAPE_ROWS, CNV = CNA * CNR, CTRIM = 5600;
export const CAPE_PANEL_VERTS = CNV;
/** Two panels at most, then the trim. */
export const CAPE_VERTS = 2 * CNV + CTRIM;

/** Poses (by name: the motion step names them) where a long cape can't hang clean (kneeling, seated): hidden there, still in the design (v196 `CAPE_HIDE_POSES`). */
export const GOWN_CAPE_HIDE_POSES: readonly string[] = ['kneel', 'sit', 'cross'];
/** A cape's own train on the floor when she has not set one (cm), and how far other capes run on (v196). */
export const GOWN_CAPE_FLOOR_CM = { train: 60, back: 15, other: 6 } as const;
/** The clasps' and beads' look, for the stage's material (v196 `capeJewelMat`). */
export const GOWN_CAPE_JEWEL = { colour: 0xf4f1ea, metalness: 0.35, roughness: 0.12, envMapIntensity: 1.8 } as const;
/** How sheer each cape fabric is drawn (v196 `capeMatNow`). */
export const GOWN_CAPE_SHEER_OPACITY: Partial<Record<string, number>> = { tulle: 0.26, chiffon: 0.44, organza: 0.36 };

/** One panel as hung: its lattice, top and hem per column, the directions it covers, and where it sits in the mesh. */
export type GownCapePart = {
  ys: number[];
  Rm: Float32Array;
  j0: Int32Array;
  tops: Float32Array;
  hems: Float32Array;
  a0: number;
  a1: number;
  ring: boolean;
  czAt: (y: number) => number;
  lens: Float32Array;
  Smax: number;
  pw: number;
  /** Its first vertex in the mesh. */
  vo: number;
};
/** Kept for the cape's first panel (the tests read it). */
export type GownCapeShape = GownCapePart;

export type GownCapeMesh = {
  geo: THREE.BufferGeometry;
  /** The still shape, before the swing. */
  base: Float32Array;
  parts: GownCapePart[];
  /** The first panel, or null when no cape is hung. */
  info: GownCapePart | null;
  kind: GownCapeKind;
  /** The swing it was last written for. */
  th: number | null;
  /** Vertices in use (the panels and the trim). */
  nUsed: number;
  /** The free edge's length (metres) and the beads on it. */
  edgeL: number;
  beadN: number;
  /** The index's shape, so it is only re-made when the cape changes. */
  key: string;
  /** The cape is drawn sheer (not the gown's own opaque cloth): the stage draws it after the gown. */
  sheer: boolean;
};

/** The design keys the cape reads. */
export type GownCapeDesign = Pick<GownConfig, 'cape' | 'capeFab' | 'capeLen' | 'capeEdge' | 'capeFasten' | 'capeCm' | 'sil' | 'train' | 'neck'> & Partial<Pick<GownConfig, 'straps' | 'illu' | 'sleeve'>>;

export function emptyCape(): GownCapeMesh {
  const g = new THREE.BufferGeometry(), n = CAPE_VERTS;
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  // No lace, cut-outs or techniques on the cape.
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  return { geo: g, base: new Float32Array(n * 3), parts: [], info: null, kind: 'none', th: null, nUsed: 0, edgeL: 0, beadN: 0, key: '', sheer: false };
}

/** Whether the cape hangs in this pose: a cape to the fingertips or longer hides while she kneels or sits. */
export const gownCapeShown = (d: Pick<GownConfig, 'cape' | 'capeFab' | 'capeLen' | 'capeEdge' | 'capeFasten'> & Partial<Pick<GownConfig, 'sleeve'>>, pose: string) =>
  gownCapeKind(d) !== 'none' && !(gownCapeNow(d).long && GOWN_CAPE_HIDE_POSES.includes(pose));
/** A cape hung from one shoulder on a neckline with no strap gets a narrow strap there (v196 `capeStrapNeeded`). */
export const gownCapeStrapNeeded = (d: Pick<GownConfig, 'cape' | 'neck'> & Partial<Pick<GownConfig, 'straps' | 'illu' | 'sleeve'>>) =>
  !!GOWN_CAPE_STRAP[gownCapeKind(d)] && GOWN_STRAPLESS.includes(d.neck) && !gownStrapCovers(strapsOf(d), GOWN_CAPE_STRAP[gownCapeKind(d)]!); // v199: a strap already on that shoulder carries it
/** The design's straps as the strap rules read them (absent: none). */
const strapsOf = (d: Pick<GownConfig, 'neck'> & Partial<Pick<GownConfig, 'straps' | 'illu' | 'sleeve'>>) => ({ neck: d.neck, straps: d.straps ?? 'none', illu: d.illu ?? 'none', sleeve: d.sleeve ?? 'none' });

const armEdges = new WeakMap<GownRig, Partial<Record<'L' | 'R', Uint32Array>>>();

/**
 * The arms (and any sleeves) as small balls, each touching the skin at one vertex from inside: the cape lies on the real
 * arm. `sleeves` are the sleeve meshes' posed positions, when she wears sleeves.
 */
export function capeArms(B: GownRig, sides: readonly ('L' | 'R')[], sleeves: Partial<Record<'L' | 'R', ArrayLike<number>>> = {}, robe: Partial<Record<'L' | 'R', ArrayLike<number>>> = {}): number[] {
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
    // v203: the over-robe lies on its own sleeves.
    const rs = robe[sd];
    if (rs) for (let i = 0; i < rs.length; i += 3) addP(rs[i]!, rs[i + 1]!, rs[i + 2]!);
  }
  return out;
}

type Side = 'L' | 'R';
/** What every panel of this cape shares (v196 `G`). */
type CapeG = { M: number; cm: number; yN: number; ySh: number; yFl: number; yBand: number; FL: number; yTopMax: number; strap: Partial<Record<Side, CapeStrapLine>> };
export type CapeStrapLine = { yAt: (a: number) => number; drawn: { x: number; y: number; z: number; ny: number; nz: number }[]; top: { x: number; y: number; z: number; ny: number; nz: number } };
/** One panel to hang: the directions it covers, where its columns start and end, which arms it lies on, its folds. */
type CapeSpec = {
  a0: number; a1: number; ring: boolean; arms: Side[]; foldK: number; foldF: number; pw: number;
  top: ((a: number, t: number) => number) | null; hem: (a: number) => number; floorW: (a: number) => number;
};

/** The line a strap takes over one shoulder: up the front from the bodice, over the top, down the back (v196 `capeStrap`). */
export function capeStrap(B: GownRig, T: GownEnvelope, sd: Side): CapeStrapLine {
  const czAt = czOf(T), M = 1 / B.P.S, V = B.V, sg = sd === 'L' ? 1 : -1, ySh = jointY(B, `upperarm01.${sd}`), xUA = Math.abs(jointP(B, `upperarm01.${sd}`, new THREE.Vector3()).x), yN = jointY(B, 'neck01');
  const xNk = capeTabR(T, sg > 0 ? Math.PI / 2 : 1.5 * Math.PI, yN), xs = xNk + 0.45 * Math.max(0.02 * M, xUA - xNk), half = 0.0095 * M, yC = ySh - 0.13 * M, zC = czAt(ySh);
  const NB = 64, th0 = -0.45, th1 = Math.PI + 0.45, D = new Float32Array(NB);
  for (let i = 0; i < B.n; i++) {
    const x = V[i * 3]! * sg;
    if (Math.abs(x - xs) > half) continue;
    const dy = V[i * 3 + 1]! - yC, dz = V[i * 3 + 2]! - zC;
    if (dy < -0.12 * M) continue;
    const th = Math.atan2(dy, dz);
    if (th < th0 || th > th1) continue;
    const b = Math.min(NB - 1, (((th - th0) / (th1 - th0)) * NB) | 0), d = Math.hypot(dy, dz);
    if (d > D[b]! && d < 0.3 * M) D[b] = d;
  }
  for (let b = 0; b < NB; b++) if (!D[b]) {
    let l = b - 1, r = b + 1;
    while (l >= 0 && !D[l]) l--;
    while (r < NB && !D[r]) r++;
    D[b] = l >= 0 && r < NB ? (D[l]! + D[r]!) / 2 : l >= 0 ? D[l]! : r < NB ? D[r]! : 0.12 * M;
  }
  // A cord laid over the shoulder bridges small hollows.
  const D1 = Float32Array.from(D, (v, b) => Math.max(v, D[Math.max(0, b - 1)]! * 0.985, D[Math.min(NB - 1, b + 1)]! * 0.985));
  const Dm = Float32Array.from(D1, (v, b) => { let t = 0, w = 0; for (let d = -3; d <= 3; d++) { const k = 4 - Math.abs(d); t += D1[clamp(b + d, 0, NB - 1)]! * k; w += k; } return Math.max(v, t / w); });
  const pts: { x: number; y: number; z: number; ny: number; nz: number; a: number }[] = [];
  for (let b = 0; b < NB; b++) {
    const th = th0 + ((b + 0.5) / NB) * (th1 - th0), d = Dm[b]!, y = yC + d * Math.sin(th), z = zC + d * Math.cos(th), x = sg * xs;
    let a = Math.atan2(x, z - czAt(y));
    if (a < 0) a += TAU;
    pts.push({ x, y, z, ny: Math.sin(th), nz: Math.cos(th), a });
  }
  const yAt = (a: number) => {
    const asc = pts[pts.length - 1]!.a > pts[0]!.a, A = (p: { a: number }) => (asc ? p.a : -p.a), t = asc ? a : -a;
    if (t <= A(pts[0]!)) return pts[0]!.y;
    for (let k = 1; k < pts.length; k++) if (t <= A(pts[k]!)) { const p = pts[k - 1]!, q = pts[k]!, u = (t - A(p)) / Math.max(1e-6, A(q) - A(p)); return p.y + (q.y - p.y) * u; }
    return pts[pts.length - 1]!.y;
  };
  // The strap runs from where it is sewn under the bodice's top edge, front and back.
  const tuck = 0.012 * M, on = (p: { y: number; a: number }) => p.y > capeTopAt(T, p.a) - tuck;
  let f = 0, l = pts.length - 1;
  while (f < l && !on(pts[f]!)) f++;
  while (l > f && !on(pts[l]!)) l--;
  return { yAt, drawn: pts.slice(Math.max(0, f - 1), Math.min(pts.length, l + 2)), top: pts[NB >> 1]! };
}

/** The hem height for a length (arm lengths are her own, whatever the pose) (v196 `capeLens`). */
function capeLens(B: GownRig, G: CapeG, len: GownCapeLength): number {
  const J = (s: string) => jointP(B, s, new THREE.Vector3()), up = J('upperarm01.L').distanceTo(J('lowerarm01.L')), fore = J('lowerarm01.L').distanceTo(J('wrist.L'));
  const y = { shoulder: G.ySh - 0.08 * G.M, elbow: G.ySh - up * 0.95, fingertip: G.ySh - (up + fore + (B.handLen || 0.08)) * 0.97, floor: G.yFl, train: G.yFl }[len];
  return Math.max(G.yFl, y);
}

/** The panels of a cape: directions, where each column starts and ends, which arms it lies on (v196 `capeSpecs`). */
function capeSpecs(B: GownRig, kind: Exclude<GownCapeKind, 'none'>, G: CapeG, now: ReturnType<typeof gownCapeNow>, sleeves: Partial<Record<Side, ArrayLike<number>>> = {}): CapeSpec[] {
  const len = now.len, yL = capeLens(B, G, len), back = (a: number) => (1 - Math.cos(a)) / 2, mir = (a: number) => (a > Math.PI ? TAU - a : a), M = G.M, floorish = len === 'floor' || len === 'train';
  const S = (o: Partial<CapeSpec> & Pick<CapeSpec, 'a0' | 'a1' | 'hem' | 'floorW'>): CapeSpec => ({ ring: false, arms: ['L', 'R'], top: null, foldK: 0.06, foldF: 14, pw: 1.7, ...o });
  if (kind === 'robe') {
    // v203: worn as a coat: open at the front from the shoulders, over the arms and its own sleeves.
    const a0 = 1.0;
    return [S({ a0, a1: TAU - a0, foldK: 0.05, foldF: 12, pw: 1.55, hem: () => yL, floorW: (a) => (floorish ? smoothstep(back(a), 0.45, 0.95) : 0) })];
  }
  if (kind === 'capesl') return (['L', 'R'] as const).map((sd) => {
    // v203: from the band round each upper arm: round the outside of the arm and behind it, falling free.
    const A0 = 1.3, A1 = 2.6, yT = gownSleeveBandTop(B, sd, sleeves[sd] ?? null);
    return S({ a0: sd === 'L' ? A0 : TAU - A1, a1: sd === 'L' ? A1 : TAU - A0, arms: [sd], foldK: 0.07, foldF: 16, pw: 1.6, top: () => yT, hem: () => yL, floorW: (a) => (floorish ? smoothstep(mir(a), 1.6, 2.5) : 0) });
  });
  if (kind === 'neck') {
    // Fastened at a band round her neck: over both shoulders and arms; open at the front below the band.
    const yB = G.yBand, yF = G.ySh - 0.1 * M;
    return [S({ a0: Math.PI, a1: Math.PI + TAU, ring: true, foldK: 0.045, foldF: 12, top: () => yB, hem: (a) => yL + (yF - yL) * smoothstep(Math.cos(a), Math.cos(1.3), Math.cos(0.42)), floorW: (a) => (floorish ? smoothstep(back(a), 0.35, 0.95) : 0) })];
  }
  if (kind === 'back') {
    const sh = now.fasten === 'shoulders';
    return [S({ a0: sh ? 2.0 : 1.9, a1: TAU - (sh ? 2.0 : 1.9), top: sh ? (_a, t) => Math.min(t, G.ySh + 0.025 * M) : null, hem: (a) => yL - (floorish ? 0 : 0.04 * M * smoothstep(back(a), 0.8, 1)), floorW: (a) => (floorish ? smoothstep(back(a), 0.6, 0.95) : 0) })];
  }
  if (kind === 'capelet') {
    // Open at the front; a small clasp holds it at the neck.
    return [S({
      a0: 0.3, a1: TAU - 0.3, foldK: 0.035, pw: 1.15,
      hem: (a) => (len === 'elbow' ? yL - 0.03 * M * back(a) - 0.02 * M * smoothstep(Math.cos(a), 0.7, 0.96) : G.ySh - 0.045 - 0.05 * smoothstep(back(a), 0.1, 0.6) - 0.015 * M * smoothstep(Math.cos(a), 0.7, 0.96)),
      floorW: () => 0,
    })];
  }
  if (kind === 'side') {
    // From the strap on her left shoulder, round to the front-side, over the arm, down the side and back.
    const st = G.strap.L!;
    return [S({ a0: 0.85, a1: 2.7, arms: ['L'], top: (a) => st.yAt(a), hem: () => yL, floorW: (a) => (floorish ? smoothstep(a, 1.8, 2.6) : 0) })];
  }
  if (kind === 'pair') {
    // One panel from each shoulder, her back bare between them.
    return (['L', 'R'] as const).map((sd) => {
      const st = G.strap[sd]!, A0 = 1.22, A1 = 2.42;
      return S({ a0: sd === 'L' ? A0 : TAU - A1, a1: sd === 'L' ? A1 : TAU - A0, arms: [sd], top: (a) => st.yAt(a), hem: () => yL, floorW: (a) => (floorish ? smoothstep(mir(a), 1.75, 2.55) : 0) });
    });
  }
  // The one-shoulder drape: one strip of chiffon from her right shoulder, beside the arm, to the floor.
  const st = G.strap.R!;
  return [S({ a0: TAU - 1.9, a1: TAU - 1.2, arms: ['R'], foldK: 0.11, foldF: 46, top: (a) => st.yAt(a), hem: () => yL, floorW: (a) => (floorish ? 0.35 + 0.65 * smoothstep(mir(a), 1.4, 1.9) : 0) })];
}

type HangOpt = { pleatAmp?: number; dressShown?: boolean; sleeves?: Partial<Record<Side, ArrayLike<number>>>; robeSleeves?: Partial<Record<Side, ArrayLike<number>>>; overlayOut?: number };
/** One panel: the v193 lattice and fall, into its own block of the mesh (v196 `hangPart`). */
function hangPart(B: GownRig, T: GownEnvelope, D: GownDress, design: GownCapeDesign, sp: CapeSpec, G: CapeG, pi: number, base: Float32Array, uvs: Float32Array, opt: HangOpt): GownCapePart {
  const { a0, a1, ring } = sp, cm = G.cm, yN = G.yN, ySh = G.ySh, yFl = G.yFl, FL = G.FL;
  const ang = new Float32Array(CNA);
  for (let c = 0; c < CNA; c++) ang[c] = a0 + ((a1 - a0) * c) / (CNA - 1);
  const back = (a: number) => (1 - Math.cos(a)) / 2;

  // The lattice: rows at fixed heights (fine over the shoulders), one column per direction.
  let yLo = 1e9;
  const tops = new Float32Array(CNA), hems = new Float32Array(CNA), yHi = Math.max(yN + 0.005, G.yTopMax);
  for (let c = 0; c < CNA; c++) { hems[c] = Math.max(yFl, sp.hem(ang[c]!)); yLo = Math.min(yLo, hems[c]!); }
  const ys: number[] = [];
  // Fine over the shoulders, finer where a full skirt springs out from the waist.
  for (let y = yHi; y > yLo - 1e-6;) { ys.push(y); y -= y > yHi - 0.13 ? 0.0025 : y > ySh - 0.25 || (design.sil === 'ball' && y > T.yS - 0.25) ? 0.005 : 0.01; }
  const NJ = ys.length, need = new Float32Array(NJ * CNA), Rm = new Float32Array(NJ * CNA), j0 = new Int32Array(CNA);
  const arms = capeArms(B, sp.arms, opt.sleeves, opt.robeSleeves), off = 0.45 * cm, offA = 0.4 * cm, tableTop = T.y0 + (T.n - 2) * DY;
  const czAt = czOf(T);
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
  const pl = opt.pleatAmp ?? 0, ovOut = opt.overlayOut ?? 0; // v195: over an overlay, below the waist
  for (let j = 0; j < NJ; j++) {
    const y = ys[j]!, tS = clamp((T.yS - y) / Math.max(0.05, T.yS - T.yHem), 0, 1), gS = smoothstep(tS, 0.35, 1), sk = y < T.yS ? 1 + D.fold * tS : 1, plY = pl && y < T.yS ? pl : 0;
    for (let c = 0; c < CNA; c++) {
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
    // The top edge: where her neck meets the shoulders (the body has widened 1.2 cm past the neck), smoothed round her;
    // or where this cape is fastened.
    const yt = new Float32Array(CNA);
    for (let c = 0; c < CNA; c++) { const n0 = need[c]!; let j = 0; while (j < NJ - 1 && need[j * CNA + c]! < n0 + 0.012 && ys[j]! > yN - 0.08) j++; yt[c] = ys[Math.max(0, j - 1)]!; }
    for (let c = 0; c < CNA; c++) {
      let s = 0, w = 0;
      for (let d = -3; d <= 3; d++) { let c2 = c + d; c2 = ring ? (((c2 % (CNA - 1)) + (CNA - 1)) % (CNA - 1)) : clamp(c2, 0, CNA - 1); const k = 4 - Math.abs(d); s += yt[c2]! * k; w += k; }
      let t = s / w;
      if (sp.top) t = sp.top(ang[c]!, t);
      t = Math.max(t, hems[c]! + 0.01);
      let j = 0;
      while (j < NJ - 1 && ys[j]! > t + 1e-6) j++;
      j0[c] = j;
      tops[c] = Math.min(ys[0]!, Math.max(ys[j]!, t));
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
          const rr = Math.hypot(x, z) + off + 0.002 + 0.003 * clamp((T.yS - y) / 0.3, 0, 1) + (y < T.yS ? ovOut : 0);
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
      if (y < h) { const yp = j > 0 ? ys[j - 1]! : y, f = (yp - h) / Math.max(1e-6, yp - y), Rp = j > 0 ? Rm[(j - 1) * CNA + c]! : R; R = Rp + (R - Rp) * f; y = h; }
      if (pr.length) { const q = pr[pr.length - 1]!; s += Math.hypot(R - q.R, y - q.y); }
      pr.push({ R, y, s, cl: Math.max(0, cl), fr: yC - y, fl: 0 });
      if (y <= h) break;
    }
    const fw = sp.floorW(ang[c]!);
    if (h <= yFl + 1e-4 && fw > 0.01) { const q = pr[pr.length - 1]!; pr.push({ R: q.R, y: q.y, s: s + FL * fw, cl: q.cl, fr: q.fr, fl: FL * fw }); s += FL * fw; }
    prof.push(pr);
    lens[c] = s;
    Smax = Math.max(Smax, s);
  }
  const pw = sp.pw, pos = base, vo = pi * CNV, foldK = sp.foldK, tile = 0.12 * G.M;
  for (let c = 0; c < CNA; c++) {
    const pr = prof[c]!, sx = SN[c]!, sz = CS[c]!, bk = back(ang[c]!);
    let k = 0;
    const fx = 0.25 * sx, fz = -(0.6 + 0.4 * bk), fn = Math.hypot(fx, fz); // along the floor: mostly behind her, a little outward
    for (let i = 0; i < CNR; i++) {
      const s = Math.min(lens[c]!, Smax * Math.pow(i / (CNR - 1), pw));
      while (k < pr.length - 2 && pr[k + 1]!.s < s) k++;
      const A = pr[k]!, Bp = pr[Math.min(pr.length - 1, k + 1)]!, u = Bp.s > A.s ? clamp((s - A.s) / (Bp.s - A.s), 0, 1) : 0, o = (vo + i * CNA + c) * 3;
      const onFloor = Bp.fl > 0 && u > 0, R0 = onFloor ? A.R : A.R + (Bp.R - A.R) * u, y = onFloor ? A.y : A.y + (Bp.y - A.y) * u;
      const cl = A.cl + (Bp.cl - A.cl) * (onFloor ? 0 : u), fr = A.fr + (Bp.fr - A.fr) * (onFloor ? 0 : u);
      // Soft folds, outward only, and only where the cloth hangs free.
      const fold = Math.min(foldK * R0 * smoothstep(fr, 0.03, 0.45), 0.6 * cl) * (0.5 + 0.5 * Math.sin(sp.foldF * ang[c]! + 1.3)), R = R0 + fold, cz = czAt(y);
      let x = R * sx, z = cz + R * sz;
      if (onFloor) { const d = Bp.fl * u; x += (fx / fn) * d; z += (fz / fn) * d; }
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      uvs[(vo + i * CNA + c) * 2] = ((ang[c]! - a0) * 0.3 * G.M) / tile;
      uvs[(vo + i * CNA + c) * 2 + 1] = s / tile;
    }
  }
  return { ys, Rm, j0, tops, hems, a0, a1, ring, czAt, lens, Smax, pw, vo };
}

/** A point on a panel by column (fractional) and length down it: four lattice vertices and their weights (v196 `capeGrid`). */
export function capeGrid(I: GownCapePart, cf: number, s: number): number[] {
  let c = cf;
  if (I.ring) c = ((c % (CNA - 1)) + (CNA - 1)) % (CNA - 1);
  c = clamp(c, 0, CNA - 1);
  const c0 = Math.min(CNA - 2, c | 0), w = c - c0, out: number[] = [];
  for (const [cc, wc] of [[c0, 1 - w], [c0 + 1, w]] as const) {
    const L = I.lens[cc]!, fi = (CNR - 1) * Math.pow(clamp(Math.min(s, L) / Math.max(1e-6, I.Smax), 0, 1), 1 / I.pw), i0 = Math.min(CNR - 2, fi | 0), v = fi - i0;
    out.push(I.vo + i0 * CNA + cc, wc * (1 - v), I.vo + (i0 + 1) * CNA + cc, wc * v);
  }
  return out;
}
type P3 = [number, number, number];
/** A panel's free edge (not where it is fastened) as points on the lattice, in order (v196 `capeEdgeLine`). */
function capeEdgeLine(I: GownCapePart, P: Float32Array) {
  const raw: { cf: number; s: number; p: P3 }[] = [], st = (I.a1 - I.a0) / (CNA - 1);
  const at = (cf: number, s: number): P3 => { const g = capeGrid(I, cf, s); let x = 0, y = 0, z = 0; for (let k = 0; k < g.length; k += 2) { const o = g[k]! * 3, wv = g[k + 1]!; x += P[o]! * wv; y += P[o + 1]! * wv; z += P[o + 2]! * wv; } return [x, y, z]; };
  const push = (cf: number, s: number) => raw.push({ cf, s, p: at(cf, s) });
  if (!I.ring) for (let k = 0; k <= 24; k++) push(0, ((I.lens[0]! * k) / 24) * 0.999);
  for (let c = 0; c < CNA; c++) push(c, I.lens[c]!);
  if (!I.ring) for (let k = 24; k >= 0; k--) push(CNA - 1, ((I.lens[CNA - 1]! * k) / 24) * 0.999);
  const L = [0];
  for (let k = 1; k < raw.length; k++) L.push(L[k - 1]! + Math.hypot(raw[k]!.p[0] - raw[k - 1]!.p[0], raw[k]!.p[1] - raw[k - 1]!.p[1], raw[k]!.p[2] - raw[k - 1]!.p[2]));
  return { raw, L, tot: L[L.length - 1]!, st, at, R: (p: P3) => Math.hypot(p[0], p[2] - I.czAt(p[1])) };
}

/** Border strip, beads, neck band, strap, clasps: extra vertices after the panels, in the same mesh (v196 `capeTrimBuild`). */
function capeTrimBuild(B: GownRig, T: GownEnvelope, cape: GownCapeMesh, uvs: Float32Array, G: CapeG, kind: Exclude<GownCapeKind, 'none'>, now: ReturnType<typeof gownCapeNow>, strapAt: (sd: Side) => boolean) {
  const M = G.M, P = cape.base, U = uvs, t0 = 2 * CNV, edge = now.edge, czAt = czOf(T), grp = { edge: [] as number[], hw: [] as number[], jw: [] as number[] };
  let nv = t0;
  const room = (n: number) => nv + n <= t0 + CTRIM;
  const vtx = (x: number, y: number, z: number, u = 0, v = 0) => { const o = nv * 3; P[o] = x; P[o + 1] = y; P[o + 2] = z; U[nv * 2] = u; U[nv * 2 + 1] = v; return nv++; };
  // Outward from her. Where the cloth lies flat on the floor that test is a near-zero number and v196 lands either side at
  // random: there the border lies on top of the cloth.
  const outN = (p: P3, n: P3): P3 => {
    if (Math.abs(n[1]) > 0.9) return n[1] < 0 ? [-n[0], -n[1], -n[2]] : n;
    const r = p[0] * n[0] + (p[2] - czAt(p[1])) * n[2];
    return r < 0 ? [-n[0], -n[1], -n[2]] : n;
  };
  // A narrow band along a path: width w across, thickness t outwards.
  const box = (pts: P3[], nr: P3[], bn: P3[], w: number, t: number, list: number[]) => {
    if (!room(pts.length * 4)) return;
    const b0 = nv;
    for (let k = 0; k < pts.length; k++) { const p = pts[k]!, n = nr[k]!, b = bn[k]!; for (const [sw, sn] of [[0.5, 1], [-0.5, 1], [-0.5, 0], [0.5, 0]] as const) vtx(p[0] + b[0] * w * sw + n[0] * t * sn, p[1] + b[1] * w * sw + n[1] * t * sn, p[2] + b[2] * w * sw + n[2] * t * sn, k / 8, sn); }
    for (let k = 0; k < pts.length - 1; k++) for (let f = 0; f < 4; f++) { const a = b0 + k * 4 + f, b = b0 + k * 4 + ((f + 1) % 4), c = a + 4, d = b + 4; list.push(a, c, b, b, c, d); }
  };
  const jewel = (p: P3, s: number, list: number[]) => {
    if (!room(6)) return;
    const b0 = nv;
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) vtx(p[0] + d[0] * s, p[1] + d[1] * s * 1.25, p[2] + d[2] * s * 0.8);
    for (const [a, b, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]] as const) list.push(b0 + a, b0 + b, b0 + c);
  };
  // The border: lace or appliqué laid on the free edge, a little proud of the cloth; beads along it.
  let edgeL = 0, beadN = 0;
  for (const I of cape.parts) {
    const E = capeEdgeLine(I, P);
    edgeL += E.tot;
    if (edge === 'plain' || E.tot < 0.05 * M) continue;
    const NS = 150, ER = 4, w = (edge === 'applique' ? 0.15 : edge === 'lace' ? 0.09 : 0.012) * M, tile = (edge === 'applique' ? 0.15 : 0.1) * M;
    const samp: { cf: number; s: number; d: number }[] = [];
    for (let k = 0, q = 0; k < NS; k++) {
      const d = (E.tot * k) / (NS - 1);
      while (q < E.raw.length - 2 && E.L[q + 1]! < d) q++;
      const a = E.raw[q]!, b = E.raw[q + 1]!, u = clamp((d - E.L[q]!) / Math.max(1e-6, E.L[q + 1]! - E.L[q]!), 0, 1);
      samp.push({ cf: a.cf + (b.cf - a.cf) * u, s: a.s + (b.s - a.s) * u, d });
    }
    // Across the edge, into the cloth, as (columns, length).
    const into = (k: number): [number, number] => {
      const a = samp[Math.max(0, k - 2)]!, b = samp[Math.min(NS - 1, k + 2)]!, p = E.at(samp[k]!.cf, samp[k]!.s), Rr = Math.max(0.02 * M, E.R(p)), du = (b.cf - a.cf) * Rr * E.st, dv = b.s - a.s, l = Math.hypot(du, dv) || 1;
      return [dv / l / (Rr * E.st), -du / l];
    };
    const nrm = (cf: number, s: number): P3 => {
      const p = E.at(cf, s), q = E.at(I.ring ? cf + 0.5 : Math.min(CNA - 1, cf + 0.5), s), q2 = E.at(I.ring ? cf - 0.5 : Math.max(0, cf - 0.5), s), r = E.at(cf, Math.max(0, s - 0.01 * M));
      const t1 = [q[0] - q2[0], q[1] - q2[1], q[2] - q2[2]] as const, t2 = [p[0] - r[0], p[1] - r[1], p[2] - r[2]] as const;
      const n: P3 = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]], l = Math.hypot(...n) || 1;
      return outN(p, [n[0] / l, n[1] / l, n[2] / l]);
    };
    const clampS = (cf: number, s: number): [number, number] => {
      const g = I.ring ? ((cf % (CNA - 1)) + (CNA - 1)) % (CNA - 1) : clamp(cf, 0, CNA - 1), c0 = Math.min(CNA - 2, g | 0), L2 = I.lens[c0]! + (I.lens[c0 + 1]! - I.lens[c0]!) * (g - c0);
      return [g, clamp(s, 0, L2)];
    };
    if (edge === 'beaded') {
      const NBd = 140;
      for (let k = 0; k < NBd; k++) {
        const q = Math.round((k / (NBd - 1)) * (NS - 1)), [dc, ds] = into(q), [cf, s] = clampS(samp[q]!.cf + dc * w, samp[q]!.s + ds * w), p = E.at(cf, s), n = nrm(cf, s);
        jewel([p[0] + n[0] * 0.003 * M, p[1] + n[1] * 0.003 * M, p[2] + n[2] * 0.003 * M], 0.0028 * M, grp.jw);
        beadN++;
      }
      continue;
    }
    if (!room(NS * ER)) continue;
    const b0 = nv;
    for (let k = 0; k < NS; k++) {
      const [dc, ds] = into(k);
      for (let r = 0; r < ER; r++) { const f = r / (ER - 1), [cf, s] = clampS(samp[k]!.cf + dc * w * f, samp[k]!.s + ds * w * f), p = E.at(cf, s), n = nrm(cf, s), lift = 0.0018 * M; vtx(p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift, samp[k]!.d / tile, f); }
    }
    for (let k = 0; k < NS - 1; k++) for (let r = 0; r < ER - 1; r++) { const a = b0 + k * ER + r, b = a + ER; grp.edge.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  // What fastens it. Every vertex of her at this height (arms and shoulders too, which the body table leaves out).
  const slab = (y: number) => {
    const NB = 120, R = new Float32Array(NB), V = B.V, cz = czAt(y), h = 0.012 * M;
    for (let i = 0; i < B.n; i++) {
      const dy = V[i * 3 + 1]! - y;
      if (dy > h || dy < -h) continue;
      const x = V[i * 3]!, z = V[i * 3 + 2]! - cz, r = Math.hypot(x, z);
      if (r > 0.35 * M) continue;
      let a = Math.atan2(x, z);
      if (a < 0) a += TAU;
      const b = Math.min(NB - 1, ((a / TAU) * NB) | 0);
      if (r > R[b]!) R[b] = r;
    }
    return (a: number) => { const f = (((a % TAU) + TAU) % TAU / TAU) * NB, b = f | 0; let m = 0; for (let d = -1; d <= 1; d++) m = Math.max(m, R[(b + d + NB) % NB]!); return m; };
  };
  const ring = (y: number, aS: number, aE: number, n: number, w: number, t: number, list: number[]) => {
    const pts: P3[] = [], nr: P3[] = [], bn: P3[] = [], sR = slab(y);
    for (let k = 0; k <= n; k++) { const a = aS + ((aE - aS) * k) / n, r = Math.max(capeTabR(T, a, y), capeTabR(T, a, y - 0.008 * M), capeTabR(T, a, y + 0.008 * M), sR(a)) + 0.002 * M, cz = czAt(y); pts.push([r * Math.sin(a), y, cz + r * Math.cos(a)]); nr.push([Math.sin(a), 0, Math.cos(a)]); bn.push([0, 1, 0]); }
    box(pts, nr, bn, w, t, list);
  };
  if (kind === 'neck') {
    // A thin band round her neck, the clasp at the nape.
    ring(G.yBand, 0, TAU, 48, 0.011 * M, 0.0025 * M, grp.hw);
    const r = capeTabR(T, Math.PI, G.yBand) + 0.004 * M;
    jewel([0, G.yBand, czAt(G.yBand) - r], 0.0045 * M, grp.jw);
  }
  if ((kind === 'back' && now.fasten === 'neck') || kind === 'capelet') {
    // A cord across the front of her neck with a small clasp.
    const I = cape.parts[0]!, yc = Math.min(I.tops[0]!, I.tops[CNA - 1]!) - 0.004 * M, half = I.a0;
    ring(yc, -half, half, 20, 0.004 * M, 0.003 * M, grp.hw);
    const r = capeTabR(T, 0, yc) + 0.005 * M;
    jewel([0, yc, czAt(yc) + r], 0.006 * M, grp.jw);
  }
  if (kind === 'back' && now.fasten === 'shoulders') {
    // A clasp on each shoulder.
    const I = cape.parts[0]!;
    for (const c of [0, CNA - 1]) {
      const g = capeGrid(I, c, 0.004 * M);
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < g.length; k += 2) { const o = g[k]! * 3, wv = g[k + 1]!; x += P[o]! * wv; y += P[o + 1]! * wv; z += P[o + 2]! * wv; }
      const n = outN([x, y, z], [Math.sign(x) * 0.7, 0.7, 0]);
      jewel([x + n[0] * 0.004 * M, y + 0.004 * M, z], 0.006 * M, grp.jw);
    }
  }
  for (const sd of ['L', 'R'] as const) {
    // A narrow strap: her neckline has none.
    const want = (kind === 'pair' || GOWN_CAPE_STRAP[kind] === sd) && strapAt(sd);
    if (!want) continue;
    const st = G.strap[sd]!, pts: P3[] = [], nr: P3[] = [], bn: P3[] = [];
    for (const p of st.drawn) { pts.push([p.x, p.y + p.ny * 0.0058 * M, p.z + p.nz * 0.0058 * M]); nr.push([0, p.ny, p.nz]); bn.push([1, 0, 0]); }
    if (pts.length > 1) box(pts, nr, bn, 0.016 * M, 0.0025 * M, grp.hw);
  }
  if (kind === 'pair' || kind === 'side' || kind === 'drape') for (const sd of kind === 'pair' ? (['L', 'R'] as const) : [GOWN_CAPE_STRAP[kind]!]) {
    // A small brooch where it is fastened on the shoulder.
    const p = G.strap[sd]!.top;
    jewel([p.x, p.y + p.ny * 0.007 * M, p.z + p.nz * 0.007 * M], 0.006 * M, grp.jw);
  }
  return { nv, grp, edgeL: edgeL / M, beadN };
}

/**
 * Hang the cape on her (v196 `buildCape`). `T` and `D` are the envelope and the dress of the same pose (the dress already
 * written by `writeDress`); `floorY` is where she stands. Returns false (nothing to draw) for no cape, or a long cape in a
 * pose that hides it. `sheer` says whether the stage draws its cloth see-through (`GOWN_CAPE_SHEER_OPACITY`).
 */
export function buildCape(
  B: GownRig, T: GownEnvelope, D: GownDress, C: GownCloth, cape: GownCapeMesh, design: GownCapeDesign,
  opt: { floorY: number; pose: string; pleatAmp?: number; dressShown?: boolean; sleeves?: Partial<Record<Side, ArrayLike<number>>>; robeSleeves?: Partial<Record<Side, ArrayLike<number>>>; overlayOut?: number },
): boolean {
  const kind = gownCapeKind(design);
  cape.kind = kind;
  if (kind === 'none' || !T.on || !gownCapeShown(design, opt.pose)) { cape.info = null; cape.parts = []; cape.nUsed = 0; return false; }
  const now = gownCapeNow(design), P = B.P, M = 1 / P.S, yN = jointY(B, 'neck01'), ySh = jointY(B, 'upperarm01.L'), Ltr = GOWN_TRAIN_CM[design.train];
  const yFl = opt.floorY + (Ltr > 0 ? 0.03 : 0.012);
  const flCm = now.len === 'train' ? design.capeCm : kind === 'back' ? GOWN_CAPE_FLOOR_CM.back : GOWN_CAPE_FLOOR_CM.other;
  const G: CapeG = { M, cm: 0.01 / P.S, yN, ySh, yFl, yBand: yN + 0.03 * M, strap: {}, FL: (flCm + Ltr * 0.9) / 100 / P.S, yTopMax: 0 };
  if (kind === 'side' || kind === 'pair' || kind === 'drape') for (const sd of kind === 'pair' ? (['L', 'R'] as const) : [GOWN_CAPE_STRAP[kind]!]) G.strap[sd] = capeStrap(B, T, sd);
  G.yTopMax = kind === 'neck' ? G.yBand + 0.002 : yN + 0.005;
  const uvs = (cape.geo.attributes.uv as THREE.BufferAttribute).array as Float32Array;
  cape.parts = capeSpecs(B, kind, G, now, opt.sleeves).map((sp, i) => hangPart(B, T, D, design, sp, G, i, cape.base, uvs, opt));
  cape.info = cape.parts[0] ?? null;
  if (cape.parts.length < 2) cape.base.fill(0, CNV * 3, 2 * CNV * 3);
  // A narrow strap (and its brooch) where a strapless neckline has none; v199: not where a strap already is.
  const tr = capeTrimBuild(B, T, cape, uvs, G, kind, now, (sd) => GOWN_STRAPLESS.includes(design.neck) && !gownStrapCovers(strapsOf(design), sd));
  cape.nUsed = tr.nv;
  cape.edgeL = tr.edgeL;
  cape.beadN = tr.beadN;
  const g = cape.geo, key = [kind, cape.parts.length, tr.nv, tr.grp.edge.length, tr.grp.hw.length, tr.grp.jw.length].join('|');
  if (cape.key !== key) {
    cape.key = key;
    const all: number[] = [];
    for (let p = 0; p < cape.parts.length; p++) { const v0 = p * CNV; for (let i = 0; i < CNR - 1; i++) for (let a = 0; a < CNA - 1; a++) { const q = v0 + i * CNA + a, r = q + CNA; all.push(q, r, q + 1, q + 1, r, r + 1); } }
    g.clearGroups();
    g.addGroup(0, all.length, 0);
    let t = all.length;
    for (const [arr, m] of [[tr.grp.edge, 1], [tr.grp.hw, 2], [tr.grp.jw, 3]] as const) { if (!arr.length) continue; g.addGroup(t, arr.length, m); for (const v of arr) all.push(v); t += arr.length; }
    g.setIndex(all);
  }
  const rest = g.attributes.rest as THREE.BufferAttribute;
  (rest.array as Float32Array).set(cape.base);
  rest.needsUpdate = true;
  (g.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
  cape.sheer = now.fab !== 'gown';
  cape.th = null;
  writeCape(cape, T, C, true);
  return true;
}

/** Twirl and turn: below the waist the cape swings out and trails like the skirt it lies on (v196 `writeCape`). */
export function writeCape(cape: GownCapeMesh, T: GownEnvelope, C: GownCloth, force = false): void {
  if (!cape.info) return;
  const K = CLOTH_BANDS - 1, sig = C.th[K]! * 7 + C.phi[K]! * 3 + C.th[3]! + C.phi[3]!;
  if (!force && cape.th === sig) return;
  cape.th = sig;
  const src = cape.base, posA = cape.geo.attributes.position as THREE.BufferAttribute, p = posA.array as Float32Array;
  const len = Math.max(0.05, T.yS - T.yHem), czAt = cape.info.czAt, still = Math.abs(sig) < 1e-5, end = cape.nUsed * 3;
  if (still) p.set(src.subarray(0, end));
  else for (let o = 0; o < end; o += 3) {
    const y = src[o + 1]!;
    if (y >= T.yS) { p[o] = src[o]!; p[o + 1] = y; p[o + 2] = src[o + 2]!; continue; }
    const t = clamp((T.yS - y) / len, 0, 1), fk = t * K, k = Math.min(K - 1, fk | 0), w = fk - k, f = C.phi[k]! * (1 - w) + C.phi[k + 1]! * w;
    const lag = (C.th[k]! * (1 - w) + C.th[k + 1]! * w) * smoothstep(t, 0, 0.15);
    const cz = czAt(y), x = src[o]!, z = src[o + 2]! - cz, r = Math.hypot(x, z) * (1 + 0.24 * f * smoothstep(t, 0, 0.15)), a = Math.atan2(x, z) - lag;
    p[o] = r * Math.sin(a); p[o + 1] = y; p[o + 2] = cz + r * Math.cos(a);
  }
  posA.needsUpdate = true;
  cape.geo.computeVertexNormals();
  {
    // No line where a ring closes.
    const nmA = cape.geo.attributes.normal as THREE.BufferAttribute, nm = nmA.array as Float32Array;
    for (const I of cape.parts) if (I.ring) for (let i = 0; i < CNR; i++) { const a = (I.vo + i * CNA) * 3, b = (I.vo + i * CNA + CNA - 1) * 3; for (let k = 0; k < 3; k++) { const v = (nm[a + k]! + nm[b + k]!) / 2; nm[a + k] = nm[b + k] = v; } }
    nmA.needsUpdate = true;
  }
  cape.geo.computeBoundingSphere();
}

/**
 * The cape laid flat on 150 cm fabric (metres): at least its longest line, more when its area needs more than one width
 * (+30 % for the curves), over every panel (v196 `capeMetres`). Zero when there is no cape hung.
 */
export function capeMetres(B: GownRig, cape: GownCapeMesh | null): number {
  if (!cape || !cape.info || cape.kind === 'none') return 0;
  const P = (cape.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, S = B.P.S;
  let L = 0, A = 0;
  const tri = (ia: number, ib: number, ic: number) => {
    const a = ia * 3, b = ib * 3, c = ic * 3, ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
    A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  };
  for (const I of cape.parts) {
    for (let c = 0; c < CNA; c++) {
      let l = 0;
      for (let i = 1; i < CNR; i++) { const a = (I.vo + (i - 1) * CNA + c) * 3, b = (I.vo + i * CNA + c) * 3; l += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
      L = Math.max(L, l);
    }
    for (let i = 0; i < CNR - 1; i++) for (let c = 0; c < CNA - 1; c++) { const q = I.vo + i * CNA + c; tri(q, q + CNA, q + 1); tri(q + 1, q + CNA, q + CNA + 1); }
  }
  return Math.max(L * S + 0.1, ((A * S * S) / 1.4) * 1.3 + 0.1);
}

/** The cape's own reach at a point's height and direction, over every panel (v196 `capeAt`): the veil keeps outside it. Null off the cape. */
export function capeAt(cape: GownCapeMesh | null, x: number, y: number, z: number): { r: number; env: number; c: number } | null {
  if (!cape || !cape.info) return null;
  let best: { r: number; env: number; c: number } | null = null;
  for (const I of cape.parts) {
    const ys = I.ys;
    if (y > ys[0]! || y < ys[ys.length - 1]!) continue;
    const cz = I.czAt(y);
    let a = Math.atan2(x, z - cz);
    if (I.ring) { while (a < I.a0) a += TAU; while (a > I.a1) a -= TAU; }
    else { if (a < 0) a += TAU; if (a < I.a0 - 0.08 || a > I.a1 + 0.08) continue; }
    const c = clamp(Math.round(((a - I.a0) / (I.a1 - I.a0)) * (CNA - 1)), 0, CNA - 1);
    if (y > I.tops[c]! || y < I.hems[c]!) continue;
    let j = 0;
    while (j < ys.length - 1 && ys[j + 1]! > y) j++;
    const r = { r: Math.hypot(x, z - cz), env: I.Rm[j * CNA + c]! * 1.07, c };
    if (!best || r.env > best.env) best = r;
  }
  return best;
}
