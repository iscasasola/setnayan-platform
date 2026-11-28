/**
 * 👗 gown/parts/overlay — a soft layer over the skirt: asymmetric, tiered or cascade (handkerchief points) (prototype v195
 * `buildOverlay`, `placeOverlay`, `ovHem`, `ovFold`, `ovMetres`, `OV_OUT`). Sewn at the waist and laid over the skirt as
 * it is really drawn (its folds, a slit, the twirl), standing a little off it, so it can never sink into the skirt.
 * Each direction round her has its own hem height: a diagonal for the asymmetric panel (high at her right hip, low at
 * her left with a soft cascade), straight tiers, or six soft points. It stops at the skirt's hem: a train stays the
 * gown's own. Women only.
 */
import * as THREE from 'three';
import type { GownConfig, GownOverlay } from '../../gown-config';
import { BODY_K, RING_N, TAU } from '../body/constants';
import { clamp, smoothstep, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import type { GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N;
/** The asymmetric panel's low point (front-left), and overlay columns per gown column. */
const OV_LOW = 1.15, OV_SC = 2;
/** How far each overlay can stand off the skirt (cm): a cape or a veil keeps outside this. */
export const GOWN_OVERLAY_OUT: Record<Exclude<GownOverlay, 'none'>, number> = { asym: 4.8, tiered: 3.2, cascade: 3.8 };
/** The overlay draws after the skirt (v195 `renderOrder` 2). */
export const GOWN_OVERLAY_DRAW = { renderOrder: 2 } as const;

/** How far the overlay stands off the skirt for this design (model units): the cape and the veil add it below the waist. */
export const gownOverlayOut = (B: GownRig, overlay: GownOverlay) => (overlay === 'none' ? 0 : GOWN_OVERLAY_OUT[overlay] / 100 / B.P.S);

/** The angle between two directions round her. */
const angD = (a: number, b: number) => Math.abs(((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI);

/** Where the overlay ends in each direction: 0 = the waist, 1 = the skirt's hem (ph 0 = centre front, + toward her left). */
export function gownOverlayHem(kind: Exclude<GownOverlay, 'none'>, ph: number, layer: number): number {
  if (kind === 'tiered') return [0.9, 0.66, 0.42][layer]!; // layer 0 lies on the skirt and is the longest; each one over it is shorter
  if (kind === 'cascade') { const st = TAU / 6, x = ((ph % st) + st) % st, dd = Math.min(x, st - x) / (st / 2); return 0.9 - 0.36 * Math.pow(dd, 0.8); } // six soft points
  // A diagonal (a plane through the skirt), the cascade a soft point at the low end.
  const dl = angD(ph, OV_LOW);
  return 0.53 + 0.31 * Math.cos(dl) + 0.07 * Math.exp(-((dl / 0.3) ** 2));
}

/** Soft folds (cm), outward only, deeper toward the hem; the asymmetric cascade gathers into deeper, closer folds. */
function ovFold(kind: Exclude<GownOverlay, 'none'>, ph: number, tr: number, layer: number): number {
  const g = smoothstep(tr, 0.08, 0.85);
  let a = 1.5 * g * (0.5 + 0.5 * Math.sin(16 * ph + 1.3 + layer * 1.9));
  if (kind === 'asym') { const w = Math.exp(-((angD(ph, OV_LOW) / 0.42) ** 2)); a = a * (1 - 0.6 * w) + 3.0 * w * smoothstep(tr, 0.25, 1) * (0.5 + 0.5 * Math.sin(34 * ph + 0.4)); }
  if (kind === 'cascade') { const st = TAU / 6, x = ((ph % st) + st) % st, dd = Math.min(x, st - x) / (st / 2); a += 1.2 * (1 - dd) * smoothstep(tr, 0.3, 1) * (0.5 + 0.5 * Math.sin(30 * ph)); }
  return a;
}

/** The overlay as built: its mesh and how each point rides the skirt (four skirt points, weighted, plus a lift). */
export type GownOverlayMesh = {
  geo: THREE.BufferGeometry;
  src: Uint32Array; wt: Float32Array; disp: Float32Array; nv: number;
  cz: Float32Array; NR: number; NC: number; nL: number;
};

/**
 * Build the overlay on the dress (v195 `buildOverlay`). The skirt must be written (`writeDress`); then `placeGownOverlay`
 * lays it on. Null for no overlay. A new mesh only when the skirt's grid changed (`prev` is reused otherwise).
 */
export function buildGownOverlay(B: GownRig, T: GownEnvelope, D: GownDress, d: Pick<GownConfig, 'overlay'>, prev: GownOverlayMesh | null = null): GownOverlayMesh | null {
  const kind = d.overlay;
  if (kind === 'none' || !D.geo || !D.rows || !D.ns) return null;
  const nL = kind === 'tiered' ? 3 : 1, NR = kind === 'tiered' ? 18 : 26, NC = N * OV_SC;
  const nv = nL * NR * NC, src = new Uint32Array(nv * 4), wt = new Float32Array(nv * 4), disp = new Float32Array(nv), col = new Float32Array(nv * 4), ix: number[] = [];
  const cm = 1 / 100 / B.P.S, r0 = D.nb + 1, ns = D.ns;
  for (let l = 0; l < nL; l++) for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const v = (l * NR + r) * NC + c, ph0 = (c / OV_SC) * DTH, ph = ph0 > Math.PI ? ph0 - TAU : ph0, tH = gownOverlayHem(kind, ph, l), tr = r / (NR - 1);
    const fq = c / OV_SC, q0 = Math.floor(fq) % N, q1 = (q0 + 1) % N, a = fq - Math.floor(fq);
    const DYc = (j: number) => D.y[j * N + q0]!;
    // Sewn at the waist (or an empire seam), down to its own hem.
    const yTop = Math.min(DYc(1) - 0.01, Math.max(T.yS, BODY_K.yWaist)), yEnd = DYc(r0) + (DYc(r0 + ns) - DYc(r0)) * tH, yy = yTop + (yEnd - yTop) * tr;
    let i0 = 1;
    while (i0 < r0 + ns - 1 && DYc(i0 + 1) >= yy) i0++;
    const ya = DYc(i0), yb = DYc(i0 + 1), b = ya === yb ? 0 : clamp((ya - yy) / (ya - yb), 0, 1);
    const ids = [i0 * N + q0, i0 * N + q1, (i0 + 1) * N + q0, (i0 + 1) * N + q1], ws = [(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b];
    for (let k = 0; k < 4; k++) { src[v * 4 + k] = ids[k]!; wt[v * 4 + k] = ws[k]!; }
    // Never on the skirt: a little off it, a little more toward the hem, plus the folds.
    disp[v] = (0.45 + 0.45 * l + 0.5 * tr + ovFold(kind, ph, tr, l)) * cm;
    // Two layers of the cloth read a touch deeper than one; a rolled hem: the folded edge shows denser.
    const hm = r === NR - 1 ? 1 : r === NR - 2 ? 0.6 : 0;
    col[v * 4] = col[v * 4 + 1] = col[v * 4 + 2] = 0.9 - 0.08 * hm;
    col[v * 4 + 3] = 0.85 + 0.15 * hm;
  }
  for (let l = 0; l < nL; l++) for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC; c++) {
    const a0 = (l * NR + r) * NC + c, b0 = (l * NR + r) * NC + ((c + 1) % NC), c0 = a0 + NC, d0 = b0 + NC;
    ix.push(a0, c0, b0, b0, c0, d0);
  }
  prev?.geo.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('gmap', new THREE.BufferAttribute(new Float32Array(nv * 2).fill(-1), 2));
  g.setAttribute('gcz', new THREE.BufferAttribute(new Float32Array(nv).fill(-100), 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(ix);
  const ov: GownOverlayMesh = { geo: g, src, wt, disp, nv, cz: D.cz, NR, NC, nL };
  placeGownOverlay(ov, D, true);
  return ov;
}

/** Ride the skirt (v195 `placeOverlay`): call after every `writeDress` (twirl, walk, a change morphing in). `rest` also stores the still shape. */
export function placeGownOverlay(S: GownOverlayMesh, D: GownDress, rest = false): void {
  if (!D.geo) return;
  const P = (D.geo.attributes.position as THREE.BufferAttribute).array as Float32Array, pa = (S.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  for (let v = 0; v < S.nv; v++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const id = S.src[v * 4 + k]! * 3, w = S.wt[v * 4 + k]!; x += P[id]! * w; y += P[id + 1]! * w; z += P[id + 2]! * w; }
    const cz = S.cz[S.src[v * 4]!]!, dz = z - cz, l = Math.hypot(x, dz) || 1, d = S.disp[v]!;
    pa[v * 3] = x + (x / l) * d; pa[v * 3 + 1] = y; pa[v * 3 + 2] = z + (dz / l) * d;
  }
  if (rest) { const ra = S.geo.attributes.rest as THREE.BufferAttribute; (ra.array as Float32Array).set(pa); ra.needsUpdate = true; }
  (S.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  S.geo.computeVertexNormals();
  S.geo.computeBoundingSphere();
}

/** The overlay laid flat on 150 cm fabric (metres, v195 `ovMetres`): at least its longest line, more when its area needs more than one width (+30 % for the curves). */
export function overlayMetres(B: GownRig, S: GownOverlayMesh | null): number {
  if (!S) return 0;
  const P = (S.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, ix = S.geo.index!.array, Sc = B.P.S, { NC, NR } = S;
  let L = 0, A = 0;
  for (let l = 0; l < S.nL; l++) for (let c = 0; c < NC; c++) {
    let s = 0;
    for (let r = 1; r < NR; r++) { const a = ((l * NR + r - 1) * NC + c) * 3, b = ((l * NR + r) * NC + c) * 3; s += Math.hypot(P[b]! - P[a]!, P[b + 1]! - P[a + 1]!, P[b + 2]! - P[a + 2]!); }
    L = Math.max(L, s);
  }
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]! * 3, b = ix[t + 1]! * 3, c = ix[t + 2]! * 3;
    const ux = P[b]! - P[a]!, uy = P[b + 1]! - P[a + 1]!, uz = P[b + 2]! - P[a + 2]!, vx = P[c]! - P[a]!, vy = P[c + 1]! - P[a + 1]!, vz = P[c + 2]! - P[a + 2]!;
    A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return Math.max(L * Sc + 0.1, ((A * Sc * Sc) / 1.4) * 1.3 + 0.1);
}

/** The overlay's own fabric line when it is not cut from the gown (v195 quote: its metres +15 %, to the next 10 cm). */
export const overlayOwnMetres = (m: number) => Math.round(m * 1.15 * 10) / 10;
