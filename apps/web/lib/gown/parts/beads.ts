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
import { RING_N, TAU } from '../body/constants';
import type { GownDress } from '../dress/build';

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
