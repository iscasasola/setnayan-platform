/**
 * 👗 gown/parts/cuts — cut-outs (prototype v195 `CUTS`, `cutShape`, `buildCuts`, `cutForbidden`): ready-made shapes
 * placed from her own landmarks, at real size on a cut map round the body (u = direction, v = height), which the cloth
 * shader opens (or fills with illusion mesh) with the chosen edge. A cropped top leaves a band of skin. Hand-cut holes
 * (the scissors) come with A7 and use `gownCutForbidden`, the same rule as the ready-made ones.
 */
import type { GownConfig, GownCutEdge, GownCutout } from '../../gown-config';
import { GOWN_CUT_FORBIDDEN } from '../../gown-config';
import { BODY_K, RING_N, SLICE_DY, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import type { GownNeckLandmarks } from '../dress/lines';
import { lerpRow, type GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N;
export type GownCutShape = 'oval' | 'diamond' | 'drop' | 'round' | 'slash';
/** Where each ready-made cut-out sits (direction round her, height from her landmarks), its size (cm) and shape. */
export const GOWN_CUTS: Record<GownCutout, { at: (L: GownNeckLandmarks) => [number, number][]; w: number; h: number; shape: GownCutShape }> = {
  waist: { at: (L) => [[1.45, L.yW], [-1.45, L.yW]], w: 7, h: 12, shape: 'drop' },
  keyhole: { at: (L) => [[0, L.yA + 0.035]], w: 5, h: 9, shape: 'drop' },
  under: { at: (L) => [[0, L.yA - 0.07]], w: 12, h: 3.2, shape: 'oval' },
  diamond: { at: (L) => [[Math.PI, L.yW + 0.11]], w: 14, h: 18, shape: 'diamond' },
  window: { at: (L) => [[Math.PI, L.yA + 0.01]], w: 16, h: 13, shape: 'round' },
  hip: { at: (L) => [[0.95, L.yW - 0.12], [-0.95, L.yW - 0.12]], w: 6, h: 9, shape: 'oval' },
  slash: { at: (L) => [[0.36, L.yW - 0.28], [-0.36, L.yW - 0.28]], w: 7, h: 12, shape: 'slash' },
};
/** The cut map's size (px). */
export const GOWN_CUT_MAP = 2048;
/** The shader's edge styles. */
export const GOWN_CUT_EDGE_CODE: Record<GownCutEdge, number> = { clean: 0, bound: 1, frayed: 2, scalloped: 3, beaded: 4 };

export type GownCutCanvas = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'lineCap' | 'lineJoin' | 'setTransform' | 'clearRect' | 'fillRect' | 'rotate' | 'scale' | 'beginPath' | 'closePath' | 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'arc' | 'arcTo' | 'ellipse' | 'fill' | 'stroke'
>;

/** One unit shape (red = open; red + green = a slash with threads across) (v195 `cutShape`). */
export function drawGownCutShape(g: GownCutCanvas, shape: GownCutShape): void {
  g.fillStyle = shape === 'slash' ? 'rgb(255,255,0)' : 'rgb(255,0,0)';
  g.beginPath();
  if (shape === 'diamond') { g.moveTo(0, -0.5); g.lineTo(0.5, 0); g.lineTo(0, 0.5); g.lineTo(-0.5, 0); g.closePath(); }
  else if (shape === 'drop') { g.moveTo(0, -0.5); g.bezierCurveTo(0.08, -0.25, 0.5, 0.05, 0.5, 0.2); g.arc(0, 0.2, 0.5, 0, Math.PI); g.bezierCurveTo(-0.5, 0.05, -0.08, -0.25, 0, -0.5); } // teardrop, point up
  else if (shape === 'round') { const r = 0.18; g.moveTo(-0.5 + r, -0.5); g.arcTo(0.5, -0.5, 0.5, 0.5, r); g.arcTo(0.5, 0.5, -0.5, 0.5, r); g.arcTo(-0.5, 0.5, -0.5, -0.5, r); g.arcTo(-0.5, -0.5, 0.5, -0.5, r); }
  else if (shape === 'slash') {
    // Short ragged slits, one above the other.
    for (let k = 0; k < 4; k++) {
      const y = -0.42 + k * 0.28, w = 0.85 - 0.12 * Math.abs(k - 1.5), j = k % 2 ? 0.06 : -0.04;
      g.moveTo(-w / 2 + j, y);
      for (let x = -w / 2; x <= w / 2; x += 0.05) g.lineTo(x + j, y - 0.022 - 0.012 * Math.sin(x * 40 + k));
      for (let x = w / 2; x >= -w / 2; x -= 0.05) g.lineTo(x + j, y + 0.022 + 0.012 * Math.sin(x * 33 + k * 2));
      g.closePath();
    }
  } else g.ellipse(0, 0, 0.5, 0.5, 0, 0, Math.PI * 2);
  g.fill();
}

/** A cut placed on the map: direction, height, size (cm), shape. */
export type GownCutPlaced = { ph: number; y: number; w: number; h: number; shape: GownCutShape };
export type GownCutPlan = {
  placed: GownCutPlaced[];
  /** The cropped top's band of skin (model heights), when two-piece cropped. */
  crop: [number, number] | null;
  /** The shader's uniforms: the map's height range, the edge band (map units), the edge style and fill. */
  y0: number; y1: number; band: [number, number]; edge: number; fill: number;
  /** One line for the designer, and the one structural warning v195 gives. */
  note: string;
};

/**
 * Lay out and paint the cut-outs (v195 `buildCuts`). Null when there are none. `g` (2048 px square) is painted when
 * given; the cut map wraps round the body, so a shape across the centre back is drawn three times.
 */
export function buildGownCuts(B: GownRig, T: GownEnvelope, D: GownDress, d: Pick<GownConfig, 'cuts' | 'cutScale' | 'cutEdge' | 'cutFill' | 'pieces' | 'neck'>, strapless: boolean, g: GownCutCanvas | null = null): GownCutPlan | null {
  const L = D.L;
  if (!T.on || !L || (!d.cuts.length && d.pieces !== 'crop')) return null;
  const W = GOWN_CUT_MAP, H = GOWN_CUT_MAP, y0 = D.gmapY0, y1 = D.gmapY1, cmU = B.P.S * 100;
  if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); }
  const rAt = (ph: number, y: number) => { let q = ph / DTH; q = ((q % N) + N) % N; const yy = clamp(y, T.yHem, T.y0 + (T.n - 2) * SLICE_DY); return lerpRow(T, T.F, yy, Math.round(q) % N); };
  const placed: GownCutPlaced[] = [], k = d.cutScale / 100;
  for (const id of d.cuts) {
    const c = GOWN_CUTS[id];
    for (const [ph, y] of c.at(L)) {
      placed.push({ ph, y, w: c.w * k, h: c.h * k, shape: c.shape });
      if (!g) continue;
      const sx = W / (TAU * rAt(ph, y) * cmU), sy = H / ((y1 - y0) * cmU), x = (ph / TAU + 0.5) * W, yp = (1 - (y - y0) / (y1 - y0)) * H;
      for (const dx of [-W, 0, W]) { g.setTransform(sx, 0, 0, sy, x + dx, yp); g.scale(c.w * k, c.h * k); drawGownCutShape(g, c.shape); }
    }
  }
  let crop: [number, number] | null = null;
  if (d.pieces === 'crop') {
    // Cropped top: a band of skin between top and skirt.
    const yW = BODY_K.yWaist, u = 0.01 / B.P.S, ya = yW + 1.5 * u, yb = yW + 7 * u;
    crop = [ya, yb];
    if (g) { const pa = (1 - (yb - y0) / (y1 - y0)) * H, pb = (1 - (ya - y0) / (y1 - y0)) * H; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, pa, W, pb - pa); }
  }
  if (g) g.setTransform(1, 0, 0, 1, 0, 0);
  const bandCm = d.cutEdge === 'clean' ? 0.25 : 0.7, rW = rAt(0, L.yW);
  const names = d.cuts.map((id) => GOWN_CUT_NAMES[id]);
  if (d.pieces === 'crop') names.push('cropped-top gap');
  const warn = d.cuts.includes('keyhole') && strapless ? ' A keyhole on a strapless bodice needs boning on both sides.' : '';
  return {
    placed, crop, y0, y1,
    band: [bandCm / (TAU * rW * cmU), bandCm / ((y1 - y0) * cmU)],
    edge: GOWN_CUT_EDGE_CODE[d.cutEdge], fill: d.cutFill === 'illusion' ? 1 : 0,
    note: `Cut-outs: ${names.join(', ')}; ${d.cutScale}% size; edge ${d.cutEdge}; ${d.cutFill === 'illusion' ? 'filled with illusion mesh' : 'open'}.${warn}`,
  };
}
const GOWN_CUT_NAMES: Record<GownCutout, string> = { waist: 'side waist', keyhole: 'keyhole', under: 'under-bust', diamond: 'back diamond', window: 'back window', hip: 'hip', slash: 'distressed slashes' };

/**
 * The same rule for hand-drawn cuts (v195 `cutForbidden`): no cutting the closure strip down the centre back, or the
 * band under the bust that holds it. Returns the plain reason, or '' when the cut is allowed. `rcm` is its radius (cm).
 */
export function gownCutForbidden(B: GownRig, T: GownEnvelope, L: GownNeckLandmarks, ph: number, y: number, rcm: number): string {
  const cmU = B.P.S * 100;
  let dd = Math.abs(ph - Math.PI);
  if (dd > Math.PI) dd = TAU - dd;
  dd = Math.min(dd, Math.abs(ph + Math.PI));
  if (dd * lerpRow(T, T.F, clamp(y, T.yHem, T.y0 + (T.n - 2) * SLICE_DY), N / 2) * cmU < 4 + rcm && y < T.top[N / 2]! + 0.01 && y > T.yS - 0.01) return GOWN_CUT_FORBIDDEN.diamond!;
  if (Math.abs(ph) < 0.65 && y > L.yA - 0.11 && y < L.yA - 0.02) return GOWN_CUT_FORBIDDEN.under!;
  return '';
}
