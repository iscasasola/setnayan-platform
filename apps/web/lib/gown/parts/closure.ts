/**
 * 👗 gown/parts/closure — the back closure on the cloth itself (prototype v193 `buildClosure`, women): an invisible
 * zipper (a fine seam and a small pull), covered buttons every 2 cm, or a lace-up (eyelets 1.6 cm either side of
 * centre back every 2.5 cm, the cord crossing between them and tied at the bottom). The men's front placket is not
 * ported.
 *
 * Returns two geometries: the parts in the gown's own cloth, and the metal eyelets. Plain three.js maths.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GownClosure } from '../../gown-config';
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import { lerpRow, type GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N, QB = N / 2;

/** The eyelets' metal, for the stage's material (v193 `eyeletMat`). */
export const GOWN_EYELET = { colour: 0xbfb6a6, roughness: 0.35, metalness: 0.55 } as const;

/**
 * Lacing needs back above the waist to lace across (v193): when the back is cut lower, a lace-up is not offered and the
 * maker closes it with a zipper, saying "The back is cut too low to lace up, so it closes with a zipper."
 */
export const gownLaceUpFits = (T: GownEnvelope) => T.top[QB]! - 0.008 - Math.max(T.yS + 0.015, BODY_K.yWaist - 0.05) >= 0.03;
export const GOWN_LACE_UP_TOO_LOW = 'The back is cut too low to lace up, so it closes with a zipper.';

/** Build the closure down the centre back. Null when the back is cut so low that nothing is left to close. */
export function buildGownClosure(B: GownRig, T: GownEnvelope, kind: GownClosure): { cloth: THREE.BufferGeometry | null; eyelets: THREE.BufferGeometry | null } | null {
  if (!T.on) return null;
  const mm = 0.001 / B.P.S;
  // A point on the cloth at height y, dx to her left of centre back, `out` proud of the cloth.
  const at = (y: number, dx: number, out = 0) => {
    const r0 = lerpRow(T, T.F, y, QB), a = Math.PI - dx / r0, fa = a / DTH, k0 = Math.floor(fa) % N, w = fa - Math.floor(fa);
    const r = lerpRow(T, T.F, y, k0) * (1 - w) + lerpRow(T, T.F, y, (k0 + 1) % N) * w + out;
    return new THREE.Vector3(r * Math.sin(a), y, B.zcAt(Math.max(y, T.yF)) + r * Math.cos(a));
  };
  const yTop = T.top[QB]! - 0.008, yLow = T.yS + 0.015, yEnd = kind === 'lace' ? Math.max(yLow, BODY_K.yWaist - 0.05) : yLow;
  if (yTop - yEnd < 0.03) return null;
  const fab: THREE.BufferGeometry[] = [];
  let eyelets: THREE.BufferGeometry | null = null;
  const tube = (pts: THREE.Vector3[], rad: number) => {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 6), rad, 6, false);
    g.deleteAttribute('uv');
    return g;
  };
  if (kind === 'zipper') {
    const pts: THREE.Vector3[] = [];
    for (let y = yTop; y >= yEnd; y -= 0.01) pts.push(at(y, 0, 0.6 * mm));
    fab.push(tube(pts, 0.9 * mm));
    const pull = new THREE.BoxGeometry(4 * mm, 11 * mm, 2 * mm), p = at(yTop - 0.008, 0, 1.5 * mm);
    pull.deleteAttribute('uv');
    pull.translate(p.x, p.y, p.z);
    fab.push(pull);
  } else if (kind === 'buttons') {
    for (let y = yTop - 0.006; y >= yEnd; y -= 20 * mm) {
      const b = new THREE.SphereGeometry(5.5 * mm, 12, 8), p = at(y, 0, 2.5 * mm);
      b.deleteAttribute('uv');
      b.scale(1, 1, 0.55);
      b.translate(p.x, p.y, p.z);
      fab.push(b);
    }
  } else {
    const half = 16 * mm, step = 25 * mm, L: THREE.Vector3[] = [], R: THREE.Vector3[] = [];
    for (let y = yTop - 0.01; y >= yEnd; y -= step) { L.push(at(y, half, 1 * mm)); R.push(at(y, -half, 1 * mm)); }
    const eg: THREE.BufferGeometry[] = [];
    for (const p of [...L, ...R]) { const t = new THREE.TorusGeometry(3 * mm, 1 * mm, 6, 14); t.deleteAttribute('uv'); t.translate(p.x, p.y, p.z); eg.push(t); }
    if (eg.length) eyelets = mergeGeometries(eg);
    const lift = (a: THREE.Vector3, b: THREE.Vector3) => [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0, -2.5 * mm)), b];
    for (let i = 0; i + 1 < L.length; i++) fab.push(tube(lift(L[i]!, R[i + 1]!), 1.3 * mm), tube(lift(R[i]!, L[i + 1]!), 1.3 * mm));
    if (L.length > 1) {
      // Tied at the bottom, ends hanging.
      const yb = L[L.length - 1]!, rb = R[R.length - 1]!, bow = at(yb.y - 0.012, 0, 3 * mm);
      fab.push(tube([yb, bow, rb], 1.3 * mm), tube([bow, at(yb.y - 0.08, 6 * mm, 2 * mm)], 1.3 * mm), tube([bow, at(yb.y - 0.075, -8 * mm, 2 * mm)], 1.3 * mm));
    }
  }
  let cloth: THREE.BufferGeometry | null = null;
  if (fab.length) {
    // The same cloth as the gown (its print too, later): no lace, cut-outs or techniques on it.
    cloth = mergeGeometries(fab);
    const n = cloth.attributes.position!.count;
    cloth.setAttribute('rest', cloth.attributes.position!);
    cloth.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
    cloth.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(n).fill(-100), 1));
  }
  return { cloth, eyelets };
}
