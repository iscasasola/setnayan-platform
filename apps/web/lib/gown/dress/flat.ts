/**
 * 👗 gown/dress/flat — the gown laid flat (prototype v189 `flatGown`, `fabricMetres`): each column of the cloth at rest
 * unrolled from the waist row, so the front and back half-pieces can be measured and laid on the fabric. Metres only:
 * the shop turns them into its quote on the server (owner rule: the bride's device holds quantities, never money).
 */
import { BODY_K, RING_N } from '../body/constants';
import type { GownRig } from '../body/rig';
import type { GownDress } from './build';
import { capeMetres, type GownCapeMesh } from './cape';

const N = RING_N;

/** The cloth at rest, unrolled (cm): X across each row from centre front, Y down each column from the waist row. */
export function flatGown(B: GownRig, D: GownDress): { X: Float32Array; Y: Float32Array; half: number; rows: number } {
  const R = D.geo!.attributes.rest!.array as Float32Array, rows = D.rows, cmU = B.P.S * 100, half = N / 2, W = half + 1;
  const X = new Float32Array(rows * W), Y = new Float32Array(rows * W), yW = BODY_K.yWaist;
  const d = (i: number, q: number, i2: number, q2: number) => {
    const a = (i * N + (q % N)) * 3, b = (i2 * N + (q2 % N)) * 3;
    return Math.hypot(R[a]! - R[b]!, R[a + 1]! - R[b + 1]!, R[a + 2]! - R[b + 2]!) * cmU;
  };
  for (let q = 0; q <= half; q++) {
    // The waist row on this column is the zero line.
    let iw = 1, best = 1e9;
    for (let i = 1; i < rows; i++) { const y = D.y[i * N + (q % N)]!, e = Math.abs(y - yW); if (y >= yW - 0.3 && e < best) { best = e; iw = i; } }
    Y[iw * W + q] = 0;
    for (let i = iw + 1; i < rows; i++) Y[i * W + q] = Y[(i - 1) * W + q]! + d(i, q, i - 1, q);
    for (let i = iw - 1; i >= 0; i--) Y[i * W + q] = Y[(i + 1) * W + q]! - d(i, q, i + 1, q);
  }
  for (let i = 0; i < rows; i++) { X[i * W] = 0; for (let q = 1; q <= half; q++) X[i * W + q] = X[i * W + q - 1]! + d(i, q, i, q - 1); }
  return { X, Y, half, rows };
}

/**
 * The outer fabric this gown needs (metres of 150 cm cloth): each half-piece on folded fabric is its own length times
 * how many widths it needs (a train is cut as part of the back panels: at most two widths), plus 15 % for matching and
 * waste, rounded up to the next 10 cm. A cape is cut from the same fabric (v193); `alsoM` is any other piece cut from it
 * (v195: flutter sleeves in the gown fabric, an overlay in the gown fabric), already in metres.
 */
export function fabricMetres(B: GownRig, D: GownDress, cape: GownCapeMesh | null = null, alsoM = 0): number {
  return Math.ceil((gownPanelMetres(B, D) + capeMetres(B, cape) + alsoM) * 1.15 * 10) / 10;
}
/** The gown's own panels on folded 150 cm fabric (metres), before the cape, the extras and the 15 % (A10's quote adds those). */
export function gownPanelMetres(B: GownRig, D: GownDress): number {
  const { X, Y, half, rows } = flatGown(B, D), side = half / 2, W = half + 1;
  let m = 0;
  for (const [q0, q1, back] of [[0, side, false], [side, half, true]] as const) {
    let w = 0, lo = 1e9, hi = -1e9;
    for (let i = 1; i < rows; i++) {
      const o = i * W;
      w = Math.max(w, back ? X[o + half]! - X[o + side]! : X[o + side]!);
      for (let q = q0; q <= q1; q++) { lo = Math.min(lo, Y[o + q]!); hi = Math.max(hi, Y[o + q]!); }
    }
    m += ((hi - lo + 10) * Math.min(2, Math.ceil((w + 3) / 75))) / 100;
  }
  return m;
}
