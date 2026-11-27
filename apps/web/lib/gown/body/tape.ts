/**
 * 👗 gown/body/tape — the tape measure: slice the posed body at a height, wrap the slice, read the length
 * (prototype v186 `hullLen`, `ringPoints`, `measure`, `apexOf`). Model units; × S × 100 = cm.
 */
import * as THREE from 'three';
import { BODY_K, SLICE_DY } from './constants';
import type { GownRig } from './rig';

/** The length of a tape wrapped round a slice: its convex hull's perimeter. `pts` is [x0, z0, x1, z1, …]. */
export function hullLen(pts: number[]): number {
  const n = pts.length / 2;
  if (n < 3) return 0;
  const o = Array.from({ length: n }, (_, i) => i).sort((a, b) => pts[a * 2]! - pts[b * 2]! || pts[a * 2 + 1]! - pts[b * 2 + 1]!);
  const h: number[] = [];
  const cr = (a: number, b: number, c: number) => (pts[b * 2]! - pts[a * 2]!) * (pts[c * 2 + 1]! - pts[a * 2 + 1]!) - (pts[b * 2 + 1]! - pts[a * 2 + 1]!) * (pts[c * 2]! - pts[a * 2]!);
  for (const i of o) { while (h.length >= 2 && cr(h[h.length - 2]!, h[h.length - 1]!, i) <= 0) h.pop(); h.push(i); }
  const lo = h.length + 1;
  for (let q = n - 2; q >= 0; q--) { const i = o[q]!; while (h.length >= lo && cr(h[h.length - 2]!, h[h.length - 1]!, i) <= 0) h.pop(); h.push(i); }
  let L = 0;
  for (let q = 1; q < h.length; q++) L += Math.hypot(pts[h[q]! * 2]! - pts[h[q - 1]! * 2]!, pts[h[q]! * 2 + 1]! - pts[h[q - 1]! * 2 + 1]!);
  return L;
}

/** Slice points for the planes y0 + j·DY (no arms, no head). `ribJ`: the underbust slice skips the breast (the tape sits on the ribs). */
export function ringPoints(B: GownRig, y0: number, n: number, ribJ = -1): number[][] {
  const V = B.V, tt = B.tt, rings: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < tt.length; t += 3) {
    const a = tt[t]! * 3, b = tt[t + 1]! * 3, c = tt[t + 2]! * 3, ya = V[a + 1]!, yb = V[b + 1]!, yc = V[c + 1]!;
    const lo = Math.min(ya, yb, yc), hi = Math.max(ya, yb, yc);
    const j0 = Math.max(0, Math.ceil((lo - y0) / SLICE_DY)), j1 = Math.min(n - 1, Math.floor((hi - y0) / SLICE_DY));
    for (let j = j0; j <= j1; j++) {
      const y = y0 + j * SLICE_DY, r = rings[j]!;
      if (j === ribJ && B.ttB[t / 3]) continue;
      if (ya <= y !== yb <= y) { const u = (y - ya) / (yb - ya); r.push(V[a]! + (V[b]! - V[a]!) * u, V[a + 2]! + (V[b + 2]! - V[a + 2]!) * u); }
      if (yb <= y !== yc <= y) { const u = (y - yb) / (yc - yb); r.push(V[b]! + (V[c]! - V[b]!) * u, V[b + 2]! + (V[c + 2]! - V[b + 2]!) * u); }
      if (yc <= y !== ya <= y) { const u = (y - yc) / (ya - yc); r.push(V[c]! + (V[a]! - V[c]!) * u, V[c + 2]! + (V[a + 2]! - V[c + 2]!) * u); }
    }
  }
  return rings;
}

/** Bust, waist, hips and underbust as the tape reads them on the posed body (model units). */
export function measure(B: GownRig): { bust: number; waist: number; hips: number; underbust: number } {
  const k = BODY_K, y0 = k.hipBand[0], n = Math.round((k.bustBand[1] - y0) / SLICE_DY) + 1, J = (y: number) => Math.round((y - y0) / SLICE_DY);
  const rings = ringPoints(B, y0, n, J(k.ubY));
  // The fullest girth around the breast's weighted middle (v164: it moves smoothly; one most-forward point jumped ~3 cm).
  let sy = 0, sw = 0;
  for (const i of B.breastV) { const w = B.bw[i]!; sy += B.V[i * 3 + 1]! * w; sw += w; }
  const yC = sy / sw;
  const band: readonly [number, number] = [Math.max(k.ubY + 0.02, yC - 0.035), Math.min(k.bustBand[1], yC + 0.035)];
  const ext = (b: readonly [number, number]) => { let v = 0; for (let j = J(b[0]); j <= J(b[1]); j++) v = Math.max(v, hullLen(rings[j]!)); return v; };
  return { bust: ext(band), waist: ext(k.waistBand), hips: ext(k.hipBand), underbust: hullLen(rings[J(k.ubY)]!) };
}

/** The bust point: the mean of the few most-forward breast points on one side (sg = 1 left, −1 right). */
export function apexOf(B: GownRig, sg: 1 | -1): THREE.Vector3 | null {
  let zm = -1e9;
  for (const i of B.breastV) if (B.V[i * 3]! * sg > 0 && B.V[i * 3 + 2]! > zm) zm = B.V[i * 3 + 2]!;
  const p = new THREE.Vector3();
  let n = 0;
  for (const i of B.breastV) if (B.V[i * 3]! * sg > 0 && B.V[i * 3 + 2]! > zm - 0.004) { p.x += B.V[i * 3]!; p.y += B.V[i * 3 + 1]!; p.z += B.V[i * 3 + 2]!; n++; }
  return n ? p.divideScalar(n) : null;
}
