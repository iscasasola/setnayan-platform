/**
 * 👗 gown/dress/cloth — the skirt as a hanging chain of bands (prototype v189 `cloth`, `stepCloth`, `pleatWave`,
 * `writeDress`). Each band, waist to hem, has its own swing angle and flare with inertia: a turn reaches the hem late,
 * the hem overshoots when she stops and settles in a few waves; spin flings it out, gravity brings it back. Stiffness and
 * damping come from the fabric (gownClothFeel). Pleats fold the skirt and open as she moves.
 */
import { RING_N, TAU } from '../body/constants';
import { clamp, smoothstep } from '../body/rig';
import type { GownPleat } from '../../gown-config';
import type { GownDress } from './build';
import { RING_COS, RING_SIN, type GownEnvelope } from './table';

const N = RING_N, DTH = TAU / N;
export const CLOTH_BANDS = 10;

export type GownCloth = { th: Float32Array; thV: Float32Array; phi: Float32Array; phiV: Float32Array; kc: number; damp: number; gain: number; still: boolean };

export function restingCloth(): GownCloth {
  const z = () => new Float32Array(CLOTH_BANDS);
  return { th: z(), thV: z(), phi: z(), phiV: z(), kc: 70, damp: 2.4, gain: 1, still: true };
}

/** One step: `w` her turn speed, `alpha` its change, `vy` her rise or fall (model units a second). */
export function stepCloth(C: GownCloth, w: number, alpha: number, dt: number, vy = 0): void {
  const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  for (let s2 = 0; s2 < n; s2++) {
    for (let k = 1; k < CLOTH_BANDS; k++) {
      const tk = k / (CLOTH_BANDS - 1);
      // Pulled by its neighbours, pushed back by the body's own turn.
      const below = k < CLOTH_BANDS - 1 ? C.th[k + 1]! - C.th[k]! : 0;
      const acc = C.kc * (C.th[k - 1]! - C.th[k]!) + 0.6 * C.kc * below - C.damp * C.thV[k]! + alpha * tk + 1.0 * w * tk;
      C.thV[k]! += acc * h;
      const nt = C.th[k]! + C.thV[k]! * h, ct = clamp(nt, -0.6, 0.6);
      C.th[k] = ct;
      if (ct !== nt) C.thV[k] = 0; // at full trail the band moves with her
      // Spin flings it out; falling lets it billow up, rising lets it cling.
      const wk = w - C.thV[k]!, goal = C.gain * clamp((wk * wk) / 12 + clamp(-vy * 2.2, -0.15, 1.1) * (0.3 + 0.7 * tk), -0.15, 1.3) * (0.35 + 0.65 * tk);
      C.phiV[k]! += (34 * (goal - C.phi[k]!) - 5 * C.phiV[k]!) * h;
      C.phi[k] = clamp(C.phi[k]! + C.phiV[k]! * h, -0.15, 1.3);
    }
  }
  let e = 0;
  for (let k = 0; k < CLOTH_BANDS; k++) e += Math.abs(C.th[k]!) + Math.abs(C.thV[k]!) * 0.1 + Math.abs(C.phi[k]!) + Math.abs(C.phiV[k]!) * 0.1;
  C.still = e < 0.002 && Math.abs(w) < 0.01 && Math.abs(vy) < 0.01;
  if (C.still) { C.th.fill(0); C.thV.fill(0); C.phi.fill(0); C.phiV.fill(0); }
}

/** Pleats folded round the body (−0.5 … 0.5): knife all one way, box in meeting pairs, accordion a sharp zigzag. */
export function pleatWave(pleat: GownPleat, pleatN: number, q: number): number {
  const ph = (q / N) * pleatN, f = ph - Math.floor(ph);
  if (pleat === 'knife') return (f < 0.85 ? f / 0.85 : (1 - f) / 0.15) - 0.5;
  if (pleat === 'box') return smoothstep(f, 0.18, 0.3) - smoothstep(f, 0.7, 0.82) - 0.5;
  return Math.abs(f - 0.5) * 2 - 0.5;
}

/** Pleats as the dress build needs them: on or off, and their depth in model units. */
export type GownPleats = { pleat: GownPleat; n: number; amp: number };

/** v197's even ribs, kept only for a dress laid before its build has set the fabric's folds. */
const EVEN_FOLDS = Float32Array.from({ length: N }, (_, q) => 0.5 + 0.5 * Math.cos(9 * q * DTH + 0.6));

/** Lay the dress grid into its mesh: rest shape (for the fabric print), then the swung, flared, folded cloth. */
export function writeDress(D: GownDress, T: GownEnvelope, C: GownCloth, pleats: GownPleats): void {
  const geo = D.geo;
  if (!geo) return;
  const p = geo.attributes.position!.array as Float32Array, K = CLOTH_BANDS - 1, on = pleats.pleat !== 'none';
  const rest = geo.attributes.rest!.array as Float32Array, gm = geo.attributes.gmap!.array as Float32Array, gcz = geo.attributes.gcz!.array as Float32Array;
  const fw = D.fw ?? EVEN_FOLDS; // v207: the fabric's own uneven folds (the build sets them; even ribs only before a build)
  for (let o = 0, e = D.rows * N; o < e; o++) {
    const q = o % N, t = D.t[o]!, ao = D.ang[o]!, an = q * DTH + ao;
    let r = D.r[o]!;
    const y = D.y[o]!;
    let s = ao ? Math.sin(an) : RING_SIN[q]!, c = ao ? Math.cos(an) : RING_COS[q]!;
    if (D.restDirty) {
      const rr = D.r[o]! * (t > 0 && !on ? 1 + D.fold * t * fw[q]! : 1) + (on && t > 0 ? pleats.amp * pleatWave(pleats.pleat, pleats.n, q) * smoothstep(t, 0, 0.12) : 0);
      rest[o * 3] = rr * s; rest[o * 3 + 1] = y; rest[o * 3 + 2] = D.cz[o]! + rr * c;
      // On the train, length along the floor.
      const row = (o / N) | 0, o0 = (D.nb + 1 + D.ns) * N + q, yv = row > D.nb + 1 + D.ns ? T.yHem - (D.r[o]! - D.r[o0]!) : y;
      gcz[o] = D.cz[o]!;
      gm[o * 2] = (q <= N / 2 ? q : N - q) / (N / 2);
      gm[o * 2 + 1] = (yv - D.gmapY0) / (D.gmapY1 - D.gmapY0);
    }
    if (t > 0) {
      // This height's own band.
      const fk = t * K, k = Math.min(K - 1, fk | 0), w = fk - k, f = C.phi[k]! * (1 - w) + C.phi[k + 1]! * w, lag = C.th[k]! * (1 - w) + C.th[k + 1]! * w;
      const fold = on ? 0 : D.fold * (1 - 0.6 * clamp(f, 0, 1));
      r *= (1 + fold * t * fw[q]!) * (1 + 0.24 * f);
      if (on) r += pleats.amp * pleatWave(pleats.pleat, pleats.n, q) * smoothstep(t, 0, 0.12) * (1 + 0.9 * Math.max(0, f)); // pleats open as the skirt swings out
      if (Math.abs(lag) > 0.0005) { const a = an - lag; s = Math.sin(a); c = Math.cos(a); } // each band trails the turn by its own angle
    }
    p[o * 3] = r * s; p[o * 3 + 1] = y; p[o * 3 + 2] = D.cz[o]! + r * c;
  }
  geo.attributes.position!.needsUpdate = true;
  geo.computeVertexNormals();
  if (D.restDirty) {
    geo.attributes.rest!.needsUpdate = true;
    geo.attributes.gmap!.needsUpdate = true;
    geo.attributes.gcz!.needsUpdate = true;
    D.restDirty = false;
  }
}
