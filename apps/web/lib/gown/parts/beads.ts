/**
 * 👗 gown/parts/beads — the bead system's shared pieces (prototype v200 `locate`, `beadGeo`, `thin`, `placeSet`,
 * `BEAD_CAP`, the pearl's look): a spot on the gown as a triangle of its cloth, a bead's shape, the phone cap, and a set
 * of beads laid on the cloth as it is now. v200's scattered pearls and its 3D flowers ride on these; the full bead
 * layers, colour mixes and the place-by-hand brush come with A7 and extend this file.
 *
 * Each bead is pinned to a triangle of the gown (barycentric), so it rides the cloth in the twirl. Plain three.js
 * maths: no material (the stage makes them from `GOWN_BEAD_LOOK`).
 */
import * as THREE from 'three';
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownBeadColour, GownBeadLayer, GownConfig } from '../../gown-config';
import { smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import type { GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N;

/** Beads drawn per gown on a phone; the quote still counts them all (v200 `BEAD_CAP`). */
export const GOWN_BEAD_CAP = 2500;
/** The named bead colours (v200 `BEAD_COL`); a custom one is the design's own `beadHex`. */
export const GOWN_BEAD_COLOUR_HEX = { clear: 0xffffff, ivory: 0xf4ecdc, champagne: 0xe3cfa6, silver: 0xd9dde2, gold: 0xd4af5a } as const;
/** A pearl's colour: a clear pearl is a warm white (v200 `beadMat('pearl')`). */
export function gownPearlHex(d: { beadCol: keyof typeof GOWN_BEAD_COLOUR_HEX | 'custom'; beadHex: string | null }): number {
  if (d.beadCol === 'clear') return GOWN_BEAD_LOOK.pearl.clear;
  if (d.beadCol === 'custom') return d.beadHex ? parseInt(d.beadHex.slice(1), 16) : GOWN_BEAD_LOOK.pearl.clear;
  return GOWN_BEAD_COLOUR_HEX[d.beadCol];
}
/** How each bead kind looks (v200 `beadMat`): the stage builds its material from these. `colour` null = the gown's bead colour. */
export const GOWN_BEAD_LOOK = {
  pearl: { clear: 0xf6f1e7, roughness: 0.28, envMapIntensity: 0.8, sheen: 1, sheenColour: 0xffffff, iridescence: 0.5, iridescenceIOR: 1.4 },
} as const;

/**
 * A spot on the cloth (direction round her, 0 = centre front; height) as a triangle of the gown and its weights on the
 * current grid (v200 `locate`). Null where the gown is not (above its top edge, below its hem).
 */
export function gownLocate(D: GownDress, ph: number, y: number): [number, number, number, number, number] | null {
  const c = (((ph / DTH) % N) + N) % N, c0 = Math.floor(c) % N, c1 = (c0 + 1) % N, fu = c - Math.floor(c), last = D.nb + 1 + D.ns;
  for (let i = 1; i < last; i++) {
    const ya = D.y[i * N + c0]!, yc = D.y[(i + 1) * N + c0]!;
    if (y <= ya && y > yc) {
      const fv = (ya - y) / (ya - yc), a = i * N + c0, b = i * N + c1, cc = (i + 1) * N + c0, d = (i + 1) * N + c1;
      return fu + fv <= 1 ? [a, b, cc, fu, fv] : [d, cc, b, 1 - fu, 1 - fv];
    }
  }
  return null;
}

/** A bead's shape, unit size, facing +z (v200 `beadGeo`). */
export function gownBeadGeo(kind: 'crystal' | 'sequin' | 'pearl' | 'seed'): THREE.BufferGeometry {
  if (kind === 'crystal') { const g = new THREE.OctahedronGeometry(0.5, 0); g.scale(1, 1, 0.75); return g; }
  if (kind === 'sequin') { const g = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14); g.rotateX(Math.PI / 2); return g; }
  return new THREE.SphereGeometry(0.5, kind === 'seed' ? 8 : 14, kind === 'seed' ? 6 : 10);
}

/**
 * On a phone, at most `cap` of a set's beads are drawn, picked evenly through it (v200 `thin`). `tri` holds three
 * indices a bead, `bc` two weights, `spin` one turn.
 */
export function gownThinBeads(tri: number[], bc: number[], spin: number[], cap: number, phone: boolean): [number[], number[], number[]] {
  const m = tri.length / 3;
  if (!phone || m <= cap) return [tri, bc, spin];
  const st = m / cap, a: number[] = [], b: number[] = [], c: number[] = [];
  for (let k = 0; k < cap; k++) { const i = Math.floor(k * st); a.push(tri[i * 3]!, tri[i * 3 + 1]!, tri[i * 3 + 2]!); b.push(bc[i * 2]!, bc[i * 2 + 1]!); c.push(spin[i]!); }
  return [a, b, c];
}

/** One set of beads on the gown: where each sits (triangle + weights), its turn, its size (model units), how many it stands for. */
export type GownBeadSet = {
  kind: 'crystal' | 'sequin' | 'pearl' | 'seed';
  tri: Uint32Array; bc: Float32Array; spin: Float32Array;
  /** Drawn; and counted for the quote (a phone draws fewer). */
  n: number; count: number;
  size: number;
  /** The grid it was laid on (a new grid needs a new set). */
  rows: number;
  /** Where it was laid, for the designer. */
  where?: string;
  /** Its colour: a named bead colour or a `#rrggbb` (A7: a layer's colour mix is one set per colour). */
  col?: string;
};

const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _z = new THREE.Vector3(0, 0, 1);
/**
 * Ride the cloth: each bead's matrix from its triangle as the gown is now, facing out along the cloth (v200 `placeSet`).
 * Writes `n` matrices into `out` (16 floats each). False when the set was laid on another grid.
 */
export function placeGownBeadSet(S: GownBeadSet, D: GownDress, out: Float32Array): boolean {
  if (!D.geo || S.rows !== D.rows) return false;
  const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, Nn = (D.geo.attributes.normal as THREE.BufferAttribute).array as Float32Array, T3 = S.tri, W = S.bc, sz = S.size;
  for (let i = 0; i < S.n; i++) {
    const a = T3[i * 3]! * 3, b = T3[i * 3 + 1]! * 3, c = T3[i * 3 + 2]! * 3, u = W[i * 2]!, v = W[i * 2 + 1]!, w = 1 - u - v;
    _p.set(P[a]! * w + P[b]! * u + P[c]! * v, P[a + 1]! * w + P[b + 1]! * u + P[c + 1]! * v, P[a + 2]! * w + P[b + 2]! * u + P[c + 2]! * v);
    _n.set(Nn[a]! * w + Nn[b]! * u + Nn[c]! * v, Nn[a + 1]! * w + Nn[b + 1]! * u + Nn[c + 1]! * v, Nn[a + 2]! * w + Nn[b + 2]! * u + Nn[c + 2]! * v).normalize();
    // Outward, away from the body.
    if (_p.x * _n.x + _n.z * (_p.z - D.cz[T3[i * 3]!]!) < 0) _n.negate();
    _p.addScaledVector(_n, sz * 0.42);
    _q.setFromUnitVectors(_z, _n).multiply(_q2.setFromAxisAngle(_z, S.spin[i]!));
    _s.setScalar(sz);
    _m.compose(_p, _q, _s).toArray(out, i * 16);
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// A7 · bead layers (v202 `buildBeadLayer`, `zoneW`, `BEAD_DEN`, the colour mix)
// ─────────────────────────────────────────────────────────────────────────────

/** Pieces per cm² at 3 mm (v202 `BEAD_DEN`); smaller beads pack closer, sequins 1.6× as close. */
export const GOWN_BEAD_DENSITY = { light: 0.12, medium: 0.35, heavy: 0.9 } as const;
/** At most this many pieces a layer is laid (v202 `MAX`, 12,000 pieces); the phone then draws its share of 2500. */
export const GOWN_BEAD_LAYER_MAX = 12000;
const BEAD_NAMES = { crystal: 'crystals', pearl: 'pearls', seed: 'seed beads', sequin: 'sequins' } as const;

/** Every bead layer of a design, the first one flat on the design (v202 `gown.layers`). */
export function gownBeadLayers(d: GownConfig): GownBeadLayer[] {
  return [{ bead: d.bead, beadAt: d.beadAt, beadDen: d.beadDen, beadCol: d.beadCol, beadMm: d.beadMm, beadHex: d.beadHex, mix: d.mix }, ...d.beadLayers];
}

/** A bead colour as a number: a named colour, or a `#rrggbb` (v202 `beadHex`). A custom colour with no hex reads as clear. */
export function gownBeadHex(col: string): number {
  if (col[0] === '#') return parseInt(col.slice(1), 16);
  return GOWN_BEAD_COLOUR_HEX[col as Exclude<GownBeadColour, 'custom'>] ?? GOWN_BEAD_COLOUR_HEX.clear;
}

/**
 * How much of a zone covers a spot, 0–1 (v202 `zoneW`). `top`, `hemDist` and `waistDist` are in cm; `row` is the
 * gown row, `nb` its bodice rows, `t` how far down the skirt (0 at the waist).
 */
export function gownBeadZoneW(at: GownBeadLayer['beadAt'], t: number, top: number, row: number, nb: number, hemDist: number, waistDist: number): number {
  switch (at) {
    case 'bodice': return row <= nb + 1 ? 1 : 0;
    case 'neck': return 1 - smoothstep(top, 2.5, 4.5);
    case 'waist': return 1 - smoothstep(Math.abs(waistDist), 2.5, 4);
    case 'hem': return 1 - smoothstep(hemDist, 10, 16);
    case 'all': return 1;
    // Cascade: full on the bodice, thinning down the skirt.
    default: return row <= nb + 1 ? 1 : Math.pow(1 - smoothstep(t, 0, 0.8), 1.5);
  }
}

/** A spot wiped with the eraser (A7b fills these; v202 `brush.holes`). `r` in cm. */
export type GownBeadHole = { ph: number; y: number; r: number; what: 'all' | 'beads' | 'lace' };
/** Is this spot inside a wiped area (v202 `inHole`)? `rad` is its distance from her centre line, model units. */
export function gownInHole(holes: readonly GownBeadHole[], ph: number, y: number, cmU: number, rad: number, kind: 'beads' | 'lace'): boolean {
  for (const o of holes) {
    if (o.what !== 'all' && o.what !== kind) continue;
    let d = Math.abs(ph - o.ph);
    if (d > Math.PI) d = TAU - d;
    if (Math.hypot(d * rad * cmU, (y - o.y) * cmU) < o.r) return true;
  }
  return false;
}

/** One bead layer laid on the gown: its sets (one a colour), how many pieces, and its line for the designer. */
export type GownBeadLayerOut = { sets: GownBeadSet[]; n: number; line: string };

/**
 * Lay one bead layer on the gown as it rests (v202 `buildBeadLayer`): its zone, density, kind, size and colour mix.
 * The neckline edge is sewn as a neat row (two when heavy); every other zone is scattered by area. A fixed seed per
 * layer, so the layout never reshuffles; each bead's colour and turn come from where it sits, so erasing one never
 * moves another. A phone draws each colour's share of 2500; the count is every bead.
 */
export function buildGownBeadLayer(B: GownRig, D: GownDress, T: GownEnvelope, layer: GownBeadLayer, li: number, opts: { phone: boolean; holes?: readonly GownBeadHole[] }): GownBeadLayerOut {
  const out: GownBeadLayerOut = { sets: [], n: 0, line: '' };
  if (layer.bead === 'none' || !D.geo) return out;
  const kind = layer.bead, holes = opts.holes ?? [];
  const R = (D.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, idx = D.geo.index!.array, cmU = B.P.S * 100, mm = layer.beadMm;
  const dens = GOWN_BEAD_DENSITY[layer.beadDen] * (3 / mm) ** 2 * (kind === 'sequin' ? 1.6 : 1);
  let seed = 1234567 + li * 7919;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nb = D.nb, yW = BODY_K.yWaist, tri: number[] = [], bc: number[] = [], MAX = GOWN_BEAD_LAYER_MAX * 3;
  if (layer.beadAt === 'neck') {
    const gap = (mm * 1.25) / 10, nRows = layer.beadDen === 'heavy' ? 2 : 1, step = layer.beadDen === 'light' ? gap * 2.2 : gap;
    for (let rr = 0; rr < nRows; rr++) {
      const i0 = 1 + rr * 2;
      let acc = layer.beadDen === 'light' ? gap * 1.5 : gap;
      for (let q = 0; q < N; q++) {
        const a = i0 * N + q, b = i0 * N + ((q + 1) % N), c = a + N, L = Math.hypot(R[b * 3]! - R[a * 3]!, R[b * 3 + 1]! - R[a * 3 + 1]!, R[b * 3 + 2]! - R[a * 3 + 2]!) * cmU;
        while (acc <= L) {
          const f = acc / L, px = R[a * 3]! + (R[b * 3]! - R[a * 3]!) * f, pz = R[a * 3 + 2]! + (R[b * 3 + 2]! - R[a * 3 + 2]!) * f, py = R[a * 3 + 1]!, cz = D.cz[a]!;
          if (!holes.length || !gownInHole(holes, Math.atan2(px, pz - cz), py, cmU, Math.hypot(px, pz - cz), 'beads')) { tri.push(a, b, c); bc.push(f, 0.12); }
          acc += step;
        }
        acc -= L;
      }
    }
  } else {
    for (let k = 0; k < idx.length && tri.length < MAX; k += 3) {
      const a = idx[k]!, b = idx[k + 1]!, c = idx[k + 2]!, row = Math.floor(a / N);
      if (row === 0) continue; // the inner lip of the neckline
      const ax = R[a * 3]!, ay = R[a * 3 + 1]!, az = R[a * 3 + 2]!, ux = R[b * 3]! - ax, uy = R[b * 3 + 1]! - ay, uz = R[b * 3 + 2]! - az, vx = R[c * 3]! - ax, vy = R[c * 3 + 1]! - ay, vz = R[c * 3 + 2]! - az;
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * cmU * cmU, y = D.y[a]!, q = a % N;
      const w = gownBeadZoneW(layer.beadAt, D.t[a]!, (T.top[q]! - y) * cmU, row, nb, (y - T.hemQ[q]!) * cmU, (y - yW) * cmU);
      if (w <= 0.01) continue;
      let m = area * dens * w;
      while (m > 0 && tri.length < MAX) {
        if (m < 1 && rnd() > m) break;
        m -= 1;
        let r1 = rnd(), r2 = rnd();
        if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
        if (holes.length) {
          const px = ax + ux * r1 + vx * r2, pz = az + uz * r1 + vz * r2, py = ay + uy * r1 + vy * r2, cz = D.cz[a]!;
          if (gownInHole(holes, Math.atan2(px, pz - cz), py, cmU, Math.hypot(px, pz - cz), 'beads')) continue;
        }
        tri.push(a, b, c); bc.push(r1, r2);
      }
    }
  }
  const n = tri.length / 3, lab = `Layer ${li + 1}: `;
  if (!n) { out.line = lab + 'no room for beads in this zone with this neckline.'; return out; }
  const main = layer.beadCol === 'custom' ? (layer.beadHex ?? '#ffffff') : layer.beadCol;
  const cols = [{ col: main, pct: Math.max(10, 100 - layer.mix.reduce((t, x) => t + x.pct, 0)) }, ...layer.mix.map((x) => ({ col: x.hex, pct: x.pct }))];
  const tot = cols.reduce((t, x) => t + x.pct, 0), pick = new Uint8Array(n);
  // Each bead's own colour and turn, from where it sits.
  const bh = (i: number, s2: number) => { const x = Math.sin(tri[i * 3]! * 12.9898 + bc[i * 2]! * 78.233 + bc[i * 2 + 1]! * 37.719 + li * 3.1 + s2) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < n; i++) { let r = bh(i, 0) * tot, k = 0; while (k < cols.length - 1 && (r -= cols[k]!.pct) > 0) k++; pick[i] = k; }
  const parts: [string, number][] = [];
  cols.forEach((cc, k) => {
    const T3: number[] = [], W2: number[] = [], SP: number[] = [];
    for (let i = 0; i < n; i++) if (pick[i] === k) { T3.push(tri[i * 3]!, tri[i * 3 + 1]!, tri[i * 3 + 2]!); W2.push(bc[i * 2]!, bc[i * 2 + 1]!); SP.push(bh(i, 5.7) * TAU); }
    const full = T3.length / 3;
    if (!full) return;
    const [T3b, W2b, SPb] = gownThinBeads(T3, W2, SP, Math.max(50, Math.round((GOWN_BEAD_CAP * full) / n)), opts.phone);
    out.sets.push({ kind, tri: Uint32Array.from(T3b), bc: Float32Array.from(W2b), spin: Float32Array.from(SPb), n: SPb.length, count: full, size: mm / 10 / cmU, rows: D.rows, where: `layer${li + 1}`, col: cc.col });
    parts.push([cc.col[0] === '#' ? cc.col.toUpperCase() : cc.col, Math.round(full / 10) * 10]);
  });
  out.n = n;
  out.line = `${lab}about ${Math.round(n / 10) * 10} ${BEAD_NAMES[kind]}, ${mm} mm, ${parts.length > 1 ? parts.map((x) => x[0] + ' ' + x[1]).join(' · ') : (parts[0] ?? [''])[0]}.`;
  return out;
}

/** Every layer (v202 `buildBeads`): the sets to draw and the designer's line ("These counts go to the designer."). */
export function buildGownBeads(B: GownRig, D: GownDress, T: GownEnvelope, d: GownConfig, opts: { phone: boolean; holes?: readonly GownBeadHole[] }): { sets: GownBeadSet[]; lines: string[] } {
  const sets: GownBeadSet[] = [], lines: string[] = [];
  gownBeadLayers(d).forEach((l, i) => { const o = buildGownBeadLayer(B, D, T, l, i, opts); sets.push(...o.sets); if (o.line) lines.push(o.line); });
  return { sets, lines };
}

/** The pieces to buy, by kind, from every set laid (v202 `bc`): the counts, never the drawn share. */
export function gownBeadCounts(sets: readonly GownBeadSet[]): Partial<Record<GownBeadSet['kind'], number>> {
  const bc: Partial<Record<GownBeadSet['kind'], number>> = {};
  for (const s of sets) bc[s.kind] = (bc[s.kind] ?? 0) + (s.count || s.n);
  return bc;
}
