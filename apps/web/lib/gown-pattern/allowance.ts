/**
 * 👗 gown-pattern/allowance — the CUT LINE round a block (plan step B11; the approved drawing is the prototype
 * `prototypes/gown_maker_2026-11-27/gown_maker_v205.html`, `SA_KINDS` · `saClean` · `saOffset` · `saUntangle` ·
 * `saNotches` · `patGeom`, ported; owner D29 and D30, 28 Nov: on by default, editable, centimetres). Pure; mm.
 *
 * A block's outline is the STITCHING line. Each edge has a role, set by the draft (`GownBlockPiece.edges`): seam ·
 * hem · zip · neck (necklines and armholes) · fold. The cut line is every stitching edge moved outwards by its own
 * allowance (a fold gets none), the corners mitred; where the allowance changes on a nearly straight run it takes a
 * small step, never a long mitre; a needle-sharp outside corner is squared off; where a tight inward curve (an armhole,
 * a neckline) is tighter than its allowance, the small loop the moved edges make is cut off. Notches: a short snip in
 * from the cut line at each end of every seam (never on a fold). A net pattern has no cut line and no notches.
 * 🔒 lib/gown-pattern/allowance.test.ts
 */
import type { GownBlockPiece, GownEdgeRole, GownPoint } from './skirt';

export type GownSeamKind = 'seam' | 'hem' | 'zip' | 'neck';
/** Centimetres per seam type (the shop's defaults, or one order's own). Lengths, never money. */
export type GownSeamAllow = Record<GownSeamKind, number>;

/** v205 `SA_KINDS`: [key, name, usual cm, least, most]. */
export const GOWN_SEAM_KINDS: ReadonlyArray<readonly [GownSeamKind, string, number, number, number]> = [
  ['seam', 'Seams', 1.5, 0.5, 3],
  ['hem', 'Hem', 2.5, 0.5, 8],
  ['zip', 'Zip', 2.0, 1, 4],
  ['neck', 'Necklines and armholes', 1.0, 0.3, 2],
];
export const GOWN_SEAM_ALLOW_DEFAULT: GownSeamAllow = Object.fromEntries(GOWN_SEAM_KINDS.map((k) => [k[0], k[2]])) as GownSeamAllow;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** v205 `saClean`: each kind to one decimal within its range; a missing or unreadable one takes `base`'s. */
export function gownSeamAllowClean(s: unknown, base: GownSeamAllow = GOWN_SEAM_ALLOW_DEFAULT): GownSeamAllow {
  const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
  const o = {} as GownSeamAllow;
  for (const [k, , , lo, hi] of GOWN_SEAM_KINDS) {
    const v = typeof r[k] === 'number' ? (r[k] as number) : Number.NaN;
    o[k] = Number.isFinite(v) && v > 0 ? clamp(Math.round(v * 10) / 10, lo, hi) : base[k];
  }
  return o;
}

/** v205 `saOffset`: the cut line (mm), every edge moved out by D[i] (mm), corners mitred. */
export function gownSeamOffset(P: readonly GownPoint[], D: readonly number[]): GownPoint[] {
  const n0 = P.length;
  let A = 0;
  for (let i = 0; i < n0; i++) { const a = P[i]!, b = P[(i + 1) % n0]!; A += a[0] * b[1] - b[0] * a[1]; }
  const sg = A > 0 ? 1 : -1;
  const E: { a: GownPoint; b: GownPoint; ux: number; uy: number; nx: number; ny: number; d: number }[] = [];
  for (let i = 0; i < n0; i++) {
    const a = P[i]!, b = P[(i + 1) % n0]!, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 1e-3) continue;
    const ux = dx / L, uy = dy / L;
    E.push({ a, b, ux, uy, nx: sg * uy, ny: -sg * ux, d: D[i] || 0 });
  }
  const out: GownPoint[] = [], n = E.length, dm = Math.max(1, ...E.map((e) => e.d));
  for (let k = 0; k < n; k++) {
    const e1 = E[(k - 1 + n) % n]!, e2 = E[k]!;
    const p1: GownPoint = [e1.b[0] + e1.nx * e1.d, e1.b[1] + e1.ny * e1.d], p2: GownPoint = [e2.a[0] + e2.nx * e2.d, e2.a[1] + e2.ny * e2.d];
    const cr = e1.ux * e2.uy - e1.uy * e2.ux, step = Math.abs(e1.d - e2.d) > 1e-6;
    if (Math.abs(cr) < 1e-9 || (step && Math.abs(cr) < 0.42)) { if (step) out.push(p1); out.push(p2); continue; } // nearly in line: a small step, never a long mitre
    const t = ((p2[0] - p1[0]) * e2.uy - (p2[1] - p1[1]) * e2.ux) / cr, X: GownPoint = [p1[0] + e1.ux * t, p1[1] + e1.uy * t];
    if (sg * cr > 0 && Math.hypot(X[0] - e2.a[0], X[1] - e2.a[1]) > 6 * dm) { out.push(p1, p2); continue; } // a needle-sharp outside corner is squared off
    out.push(X);
  }
  return untangle(out);
}

/** v205 `saUntangle`: where a tight inward curve is tighter than its allowance, cut off the small loop. */
function untangle(Q0: GownPoint[]): GownPoint[] {
  let Q = Q0;
  const X = (a: GownPoint, b: GownPoint, c: GownPoint, d: GownPoint): GownPoint | null => {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0]! * s[1]! - r[1]! * s[0]!;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c[0] - a[0]) * s[1]! - (c[1] - a[1]) * s[0]!) / den, u = ((c[0] - a[0]) * r[1]! - (c[1] - a[1]) * r[0]!) / den;
    return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9 ? [a[0] + r[0]! * t, a[1] + r[1]! * t] : null;
  };
  for (let guard = 0; guard < 200; guard++) {
    const n = Q.length, W = Math.min(24, Math.floor(n / 2) - 1);
    let hit: [number, number, GownPoint] | null = null;
    for (let i = 0; i < n && !hit; i++) for (let k = 2; k <= W && !hit; k++) { const P = X(Q[i]!, Q[(i + 1) % n]!, Q[(i + k) % n]!, Q[(i + k + 1) % n]!); if (P) hit = [i, k, P]; }
    if (!hit) break;
    const [i, k, P] = hit, R = Q.slice(i).concat(Q.slice(0, i));
    Q = [R[0]!, P, ...R.slice(k + 1)];
  }
  return Q;
}

/** A notch: a short snip, [x1, y1, x2, y2] mm, from the cut line inwards. */
export type GownNotch = readonly [number, number, number, number];

/** v205 `saNotches`: a short snip in from the cut line at each end of every seam (not on a fold). */
export function gownSeamNotches(P: readonly GownPoint[], roles: readonly GownEdgeRole[], D: readonly number[]): GownNotch[] {
  const n = P.length;
  let A = 0;
  for (let i = 0; i < n; i++) { const a = P[i]!, b = P[(i + 1) % n]!; A += a[0] * b[1] - b[0] * a[1]; }
  const sg = A > 0 ? 1 : -1, out: GownNotch[] = [];
  const ed = (i: number) => {
    const a = P[(i + n) % n]!, b = P[(i + 1 + n) % n]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { ux: (b[0] - a[0]) / L, uy: (b[1] - a[1]) / L, nx: (sg * (b[1] - a[1])) / L, ny: (-sg * (b[0] - a[0])) / L, L };
  };
  for (let v = 0; v < n; v++) {
    const i1 = (v - 1 + n) % n, i2 = v, r1 = roles[i1], r2 = roles[i2];
    if (r1 === 'fold' || r2 === 'fold') continue;
    const e1 = ed(i1), e2 = ed(i2);
    if (e1.L < 1e-3 || e2.L < 1e-3) continue;
    const turn = Math.acos(clamp(e1.ux * e2.ux + e1.uy * e2.uy, -1, 1));
    if (r1 === r2 && turn < 0.6) continue; // a seam end: the seam type changes, or the edge turns a corner
    const V = P[v]!, cr = e1.ux * e2.uy - e1.uy * e2.ux;
    if (sg * cr < 0 && Math.abs(cr) >= 0.42) {
      // an inside corner: one snip at the corner itself
      const d = Math.min(D[i1]!, D[i2]!);
      if (!(d > 0)) continue;
      const p1 = [V[0] + e1.nx * D[i1]!, V[1] + e1.ny * D[i1]!], p2 = [V[0] + e2.nx * D[i2]!, V[1] + e2.ny * D[i2]!];
      const t = ((p2[0]! - p1[0]!) * e2.uy - (p2[1]! - p1[1]!) * e2.ux) / cr, X = [p1[0]! + e1.ux * t, p1[1]! + e1.uy * t];
      const dx = V[0] - X[0]!, dy = V[1] - X[1]!, L = Math.hypot(dx, dy) || 1, s = Math.min(6, 0.6 * d);
      out.push([X[0]!, X[1]!, X[0]! + (dx / L) * s, X[1]! + (dy / L) * s]);
      continue;
    }
    for (const [e, d] of [[e1, D[i1]!], [e2, D[i2]!]] as const) {
      if (!(d > 0)) continue;
      const s = Math.min(6, 0.6 * d), Q = [V[0] + e.nx * d, V[1] + e.ny * d];
      out.push([Q[0]!, Q[1]!, Q[0]! - e.nx * s, Q[1]! - e.ny * s]);
    }
  }
  return out;
}

/** One piece, ready to draw: the stitching line, each edge's role and allowance (mm), the cut line, notches, its box. */
export type GownPieceGeom = { P: GownPoint[]; roles: GownEdgeRole[]; D: number[]; C: GownPoint[] | null; N: GownNotch[]; box: [number, number, number, number] };

/** v205 `patGeom`. */
export function gownPieceGeom(p: GownBlockPiece, sa: GownSeamAllow, net: boolean): GownPieceGeom {
  const roles: GownEdgeRole[] = p.edges && p.edges.length === p.outline.length ? [...p.edges] : p.outline.map(() => 'seam');
  const D = roles.map((r) => (r === 'fold' || net ? 0 : Math.round(sa[r] * 100) / 10));
  const C = net ? null : gownSeamOffset(p.outline, D);
  const N = net ? [] : gownSeamNotches(p.outline, roles, D);
  const pts = C ?? p.outline, xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { P: [...p.outline], roles, D, C, N, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}
