/**
 * 👗 gown/parts/closure — the back closure on the cloth itself (prototype v197 `buildClosure`, women): an invisible
 * zipper (a fine seam and a small pull), covered buttons every 2 cm, or a lace-up: an open V gap over a modesty panel,
 * eyelets 2.4 cm either side of centre back every 2.5 cm, a ribbon crossing between them and tied in a bow at the
 * bottom. A high neck with an open back closes its nape band with one covered button. The men's front placket is not
 * ported.
 *
 * Returns the parts in the gown's own cloth, the metal eyelets, the modesty panel (a shade deeper than the gown, so the
 * gap reads) and the ribbon (in the accent colour). Plain three.js maths.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GownConfig } from '../../gown-config';
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import { gownKeyholeBack, type GownNeckLandmarks } from '../dress/lines';
import { lerpRow, type GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N, QB = N / 2;

/** The eyelets' metal, for the stage's material (v193 `eyeletMat`). */
export const GOWN_EYELET = { colour: 0xbfb6a6, roughness: 0.35, metalness: 0.55 } as const;
/** The modesty panel behind the lacing (a shade deeper than the gown) and the ribbon, for the stage (v197). */
export const GOWN_LACE_UP_DRAW = { modestyShade: 0.8, modestyRoughness: 0.65, cordRoughness: 0.35, cordSheenRoughness: 0.3 } as const;

export type GownClosureDesign = Pick<GownConfig, 'closure' | 'neck' | 'neckT' | 'back' | 'backT'>;
export type GownClosureParts = { cloth: THREE.BufferGeometry | null; eyelets: THREE.BufferGeometry | null; modesty: THREE.BufferGeometry | null; cord: THREE.BufferGeometry | null };

/** Where the closure starts at the top: under the keyhole's nape band, or the bodice's top edge at the centre back. */
function closureTop(T: GownEnvelope, L: GownNeckLandmarks | null, d: GownClosureDesign) {
  const KH = L ? gownKeyholeBack(d, T.top[QB]!, L) : null;
  return { KH, yTop: KH ? KH.yB - 0.012 : T.top[QB]! - 0.008 };
}

/**
 * Lacing needs about 15 cm of back above the waist to lace across (v197): when the back is cut lower, a lace-up is not
 * offered and the maker closes it with a zipper, saying "The back is cut too low to lace up, so it closes with a zipper."
 */
export function gownLaceUpFits(B: GownRig, T: GownEnvelope, L: GownNeckLandmarks | null, d: GownClosureDesign): boolean {
  return closureTop(T, L, d).yTop - Math.max(T.yS + 0.015, BODY_K.yWaist - 0.05) >= 0.15 / B.P.S;
}
export const GOWN_LACE_UP_TOO_LOW = 'The back is cut too low to lace up, so it closes with a zipper.';

/** Build the closure down the centre back. Null when the back is cut so low that nothing is left to close. */
export function buildGownClosure(B: GownRig, T: GownEnvelope, L: GownNeckLandmarks | null, d: GownClosureDesign): GownClosureParts | null {
  if (!T.on) return null;
  const mm = 0.001 / B.P.S, kind = d.closure;
  // A point on the cloth at height y, dx to her left of centre back, `out` proud of the cloth.
  const at = (y: number, dx: number, out = 0) => {
    const r0 = lerpRow(T, T.F, y, QB), a = Math.PI - dx / r0, fa = a / DTH, k0 = Math.floor(fa) % N, w = fa - Math.floor(fa);
    const r = lerpRow(T, T.F, y, k0) * (1 - w) + lerpRow(T, T.F, y, (k0 + 1) % N) * w + out;
    return new THREE.Vector3(r * Math.sin(a), y, B.zcAt(Math.max(y, T.yF)) + r * Math.cos(a));
  };
  const { KH, yTop } = closureTop(T, L, d), yLow = T.yS + 0.015, yEnd = kind === 'lace' ? Math.max(yLow, BODY_K.yWaist - 0.05) : yLow;
  if (yTop - yEnd < 0.03) return null;
  const fab: THREE.BufferGeometry[] = [];
  let eyelets: THREE.BufferGeometry | null = null, modesty: THREE.BufferGeometry | null = null, cordG: THREE.BufferGeometry | null = null;
  const tube = (pts: THREE.Vector3[], rad: number) => {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 6), rad, 6, false);
    g.deleteAttribute('uv');
    return g;
  };
  const button = (p: THREE.Vector3) => { const b = new THREE.SphereGeometry(5.5 * mm, 12, 8); b.deleteAttribute('uv'); b.scale(1, 1, 0.55); b.translate(p.x, p.y, p.z); return b; };
  // The nape band closes with one covered button.
  if (KH) fab.push(button(at(KH.yBand + 0.0175 / B.P.S, 0, 2.5 * mm)));
  if (kind === 'zipper') {
    const pts: THREE.Vector3[] = [];
    for (let y = yTop; y >= yEnd; y -= 0.01) pts.push(at(y, 0, 0.6 * mm));
    fab.push(tube(pts, 0.9 * mm));
    const pull = new THREE.BoxGeometry(4 * mm, 11 * mm, 2 * mm), p = at(yTop - 0.008, 0, 1.5 * mm);
    pull.deleteAttribute('uv');
    pull.translate(p.x, p.y, p.z);
    fab.push(pull);
  } else if (kind === 'buttons') {
    for (let y = yTop - 0.006; y >= yEnd; y -= 20 * mm) fab.push(button(at(y, 0, 2.5 * mm)));
  } else {
    const half = 24 * mm, step = 25 * mm, L2: THREE.Vector3[] = [], R: THREE.Vector3[] = [], cord: THREE.BufferGeometry[] = [];
    for (let y = yTop - 0.01; y >= yEnd; y -= step) { L2.push(at(y, half, 1 * mm)); R.push(at(y, -half, 1 * mm)); }
    const eg: THREE.BufferGeometry[] = [];
    for (const p of [...L2, ...R]) { const t = new THREE.TorusGeometry(3.5 * mm, 1.2 * mm, 6, 14); t.deleteAttribute('uv'); t.translate(p.x, p.y, p.z); eg.push(t); }
    {
      // The modesty panel behind the lacing, narrowing to the bottom.
      const pts: THREE.Vector3[] = [];
      for (let y = yTop - 0.004; y >= yEnd - 0.02; y -= 0.01) pts.push(at(y, 0, 0.4 * mm));
      if (pts.length > 1) {
        const n = pts.length, pa = new Float32Array(n * 6), ix: number[] = [];
        for (let i = 0; i < n - 1; i++) { const a = i * 2, b = a + 2; ix.push(a, a + 1, b, b, a + 1, b + 1); }
        pts.forEach((p, i) => { const f = i / (n - 1), w = (half * 2 + 6 * mm) * (1 - 0.35 * f), l = at(p.y, w / 2, 0.4 * mm), r2 = at(p.y, -w / 2, 0.4 * mm); pa.set([l.x, l.y, l.z], i * 6); pa.set([r2.x, r2.y, r2.z], i * 6 + 3); });
        modesty = new THREE.BufferGeometry();
        modesty.setAttribute('position', new THREE.BufferAttribute(pa, 3));
        modesty.setIndex(ix);
        modesty.computeVertexNormals();
      }
    }
    if (eg.length) eyelets = mergeGeometries(eg);
    const lift = (a: THREE.Vector3, b: THREE.Vector3) => [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0, -2.5 * mm)), b];
    for (let i = 0; i + 1 < L2.length; i++) cord.push(tube(lift(L2[i]!, R[i + 1]!), 2.2 * mm), tube(lift(R[i]!, L2[i + 1]!), 2.2 * mm));
    if (L2.length > 1) {
      // Tied in a bow at the bottom, ends hanging.
      const yb = L2[L2.length - 1]!, rb = R[R.length - 1]!, bow = at(yb.y - 0.012, 0, 3 * mm);
      cord.push(tube([yb, bow, rb], 2.2 * mm), tube([bow, at(yb.y - 0.11, 8 * mm, 2 * mm)], 2.2 * mm), tube([bow, at(yb.y - 0.1, -10 * mm, 2 * mm)], 2.2 * mm));
      for (const s2 of [1, -1]) cord.push(tube([bow, at(bow.y + 0.012, s2 * 14 * mm, 4 * mm), at(bow.y - 0.006, s2 * 22 * mm, 4 * mm), at(bow.y - 0.012, s2 * 8 * mm, 3 * mm), bow], 2.2 * mm));
    }
    if (cord.length) cordG = mergeGeometries(cord);
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
  return { cloth, eyelets, modesty, cord: cordG };
}
