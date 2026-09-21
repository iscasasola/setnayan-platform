/**
 * lib/monogram-studio/trace-fit.ts
 *
 * Turns one traced outline — a dense ring of sub-pixel points — into a CLEAN
 * path: exact straight lines, real Bézier curves, and sharp corners.
 *
 * Owner 2026-09-20, on a logo traced from a photo: *"the refinement of the svg
 * from the photo uploaded is not clean. make the curves and the corners clean
 * and the straight lines."*
 *
 * ── WHY THE OLD OUTPUT WOBBLED ────────────────────────────────────────────
 * The tracer simplified its outline with Ramer–Douglas–Peucker and emitted
 * `L` segments only. RDP keeps whichever points deviate most from a chord, and
 * on a pixel staircase those are staircase CORNERS — so a straight stem came
 * out as a zig-zag, a curve as uneven facets, and there was not one curve in
 * the file. No tolerance setting fixes that; the representation was wrong.
 *
 * ── WHAT THIS DOES INSTEAD (the Potrace idea, dependency-free) ────────────
 *   1. find the CORNERS — points where the outline turns sharply;
 *   2. between corners, a run that is straight within a fraction of a pixel
 *      becomes ONE line fitted through all its points (least squares), and a
 *      line within SNAP_DEG of vertical/horizontal is made exactly so — a
 *      letter's stem should be vertical, not 0.4° off;
 *   3. a corner between two straight runs is the INTERSECTION of their lines,
 *      so it is sharp — rather than wherever the blurred pixels put it;
 *   4. every other run is fitted with cubic Béziers (Schneider, "An Algorithm
 *      for Automatically Fitting Digitized Curves", Graphics Gems 1990),
 *      splitting only where the error demands it.
 *
 * Pure and DOM-free on purpose: it is exercised by node tests against shapes
 * whose true geometry is known (a square, a circle, a rotated square).
 */

export type Pt = { x: number; y: number };

/** Turning angle (degrees) that makes a point a corner rather than a curve. */
const CORNER_DEG = 40;
/** How many neighbours each side are used to measure the turning angle. */
const CORNER_SPAN = 4;
/** A run is straight when no point strays further than this from its line (px). */
const STRAIGHT_TOL = 0.6;
/** Maximum distance a fitted curve may stray from the traced points (px). */
const FIT_TOL = 0.5;
/** A straight line this close to vertical/horizontal is snapped to it. */
const SNAP_DEG = 2;
/** Smoothing passes over the points a CURVE is fitted to. */
const SMOOTH_PASSES = 2;
/** A point is locally flat when the outline turns less than this around it. */
const FLAT_DEG = 3;
/** Neighbours each side used to judge local flatness. */
const FLAT_SPAN = 5;
/** Shortest stretch (px) that may become a line WITHOUT a corner at each end.
 *  Below ~20px an arc's change of direction is too small to measure against
 *  sensor noise, so a short stretch of a circle could pass as a line — measured:
 *  at 10px a noisy photo of a circle grew false flats and erred by 1.7px. Lines
 *  bounded by two corners have no such floor (see the corner-to-corner pass). */
const MIN_LINE_LEN = 20;
/** A real straight has the SAME direction at both ends; an arc keeps turning. */
const LINE_TURN_DEG = 2;
/** How far a line may be GROWN past its stable middle (px). Deliberately
 *  tighter than STRAIGHT_TOL: growing at 0.6 let a stem's line creep up into
 *  the start of its serif bracket, and the bracket curve then had to jog back
 *  sideways to meet it — a visible ~1px notch at the join. */
const GROW_TOL = 0.3;
/** Points beside a corner that the blur has rounded into it. */
const CORNER_SKIP = 2;

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const len = (a: Pt): number => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => {
  const l = len(a);
  return l > 1e-12 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
};
const at = <T>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length] as T;

/** [1,2,1]/4 smoothing around a CLOSED ring. */
export function smoothRing(pts: Pt[], passes = SMOOTH_PASSES): Pt[] {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    cur = cur.map((q, i) => {
      const a = at(cur, i - 1);
      const b = at(cur, i + 1);
      return { x: (a.x + 2 * q.x + b.x) / 4, y: (a.y + 2 * q.y + b.y) / 4 };
    });
  }
  return cur;
}

/** Indices of the corners of a closed ring, by turning angle + non-max suppression. */
export function findCorners(pts: Pt[]): number[] {
  const n = pts.length;
  const k = Math.min(CORNER_SPAN, Math.floor(n / 4));
  if (k < 2) return [];
  const ang: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = sub(at(pts, i), at(pts, i - k));
    const b = sub(at(pts, i + k), at(pts, i));
    const c = dot(a, b) / ((len(a) || 1) * (len(b) || 1));
    ang[i] = (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = ang[i] as number;
    if (v < CORNER_DEG) continue;
    let isMax = true;
    for (let j = -k; j <= k && isMax; j++) {
      if (j === 0) continue;
      const w = at(ang, i + j);
      // strict on one side breaks ties, so a plateau yields ONE corner
      if (w > v || (j < 0 && w === v)) isMax = false;
    }
    if (isMax) out.push(i);
  }
  return out;
}

/** The points of the ring from index i to j inclusive, walking forward (wraps). */
function slice(pts: Pt[], i: number, j: number): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let s = i; ; s = (s + 1) % n) {
    out.push(pts[s] as Pt);
    if (s === j) break;
    if (out.length > n) break;
  }
  return out;
}

type Line = { c: Pt; d: Pt };

/** Least-squares line through points (centroid + principal direction). */
function fitLine(pts: Pt[]): Line {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c: { x: cx, y: cy }, d: { x: Math.cos(theta), y: Math.sin(theta) } };
}

function distToLine(p: Pt, l: Line): number {
  const v = sub(p, l.c);
  return Math.abs(v.x * l.d.y - v.y * l.d.x);
}

/** Force a near-axis line exactly onto the axis, through its centroid —
 *  KEEPING its direction of travel, which the curve tangents downstream rely on. */
function snapLine(l: Line): Line {
  const deg = (Math.atan2(l.d.y, l.d.x) * 180) / Math.PI;
  const m = ((deg % 180) + 180) % 180;
  if (m < SNAP_DEG || m > 180 - SNAP_DEG) return { c: l.c, d: { x: Math.sign(l.d.x) || 1, y: 0 } };
  if (Math.abs(m - 90) < SNAP_DEG) return { c: l.c, d: { x: 0, y: Math.sign(l.d.y) || 1 } };
  return l;
}

/** Angle between two DIRECTIONS, ignoring sign (0–90°). */
function lineAngle(a: Pt, b: Pt): number {
  const c = Math.abs(dot(norm(a), norm(b)));
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

function intersect(a: Line, b: Line): Pt | null {
  const den = a.d.x * b.d.y - a.d.y * b.d.x;
  // Near-parallel lines meet somewhere absurd; a corner is only rebuilt from
  // two lines that actually cross at a real angle (> ~15°).
  if (Math.abs(den) < Math.sin((15 * Math.PI) / 180)) return null;
  const w = sub(b.c, a.c);
  const t = (w.x * b.d.y - w.y * b.d.x) / den;
  return add(a.c, mul(a.d, t));
}

function projectOnto(p: Pt, l: Line): Pt {
  return add(l.c, mul(l.d, dot(sub(p, l.c), l.d)));
}

/* ── Schneider cubic fitting ────────────────────────────────────────────── */

type Bez = [Pt, Pt, Pt, Pt];

const B0 = (u: number) => (1 - u) * (1 - u) * (1 - u);
const B1 = (u: number) => 3 * u * (1 - u) * (1 - u);
const B2 = (u: number) => 3 * u * u * (1 - u);
const B3 = (u: number) => u * u * u;

function bezAt(b: Bez, u: number): Pt {
  return {
    x: B0(u) * b[0].x + B1(u) * b[1].x + B2(u) * b[2].x + B3(u) * b[3].x,
    y: B0(u) * b[0].y + B1(u) * b[1].y + B2(u) * b[2].y + B3(u) * b[3].y,
  };
}

function chordParams(d: Pt[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push((u[u.length - 1] as number) + len(sub(d[i] as Pt, d[i - 1] as Pt)));
  const total = u[u.length - 1] as number;
  return total > 0 ? u.map((v) => v / total) : u.map((_, i) => i / Math.max(1, u.length - 1));
}

function generateBezier(d: Pt[], first: number, last: number, u: number[], t1: Pt, t2: Pt): Bez {
  const p0 = d[first] as Pt;
  const p3 = d[last] as Pt;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < u.length; i++) {
    const ui = u[i] as number;
    const a0 = mul(t1, B1(ui));
    const a1 = mul(t2, B2(ui));
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    const base = add(add(mul(p0, B0(ui) + B1(ui)), mul(p3, B2(ui) + B3(ui))), { x: 0, y: 0 });
    const tmp = sub(d[first + i] as Pt, base);
    x0 += dot(a0, tmp);
    x1 += dot(a1, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let aL = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let aR = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  const seg = len(sub(p3, p0));
  const eps = 1e-6 * seg;
  // Degenerate or wild handles (negative, vanishing, or overshooting far past
  // the segment) fall back to the safe one-third heuristic.
  if (aL < eps || aR < eps || aL > 3 * seg || aR > 3 * seg) {
    aL = seg / 3;
    aR = seg / 3;
  }
  return [p0, add(p0, mul(t1, aL)), add(p3, mul(t2, aR)), p3];
}

function maxError(d: Pt[], first: number, last: number, b: Bez, u: number[]): [number, number] {
  let max = 0;
  let split = Math.floor((first + last) / 2);
  for (let i = first + 1; i < last; i++) {
    const e = len(sub(bezAt(b, u[i - first] as number), d[i] as Pt));
    if (e > max) {
      max = e;
      split = i;
    }
  }
  return [max, split];
}

function reparameterize(d: Pt[], first: number, b: Bez, u: number[]): number[] {
  const d1: Pt[] = [mul(sub(b[1], b[0]), 3), mul(sub(b[2], b[1]), 3), mul(sub(b[3], b[2]), 3)];
  const d2: Pt[] = [mul(sub(d1[1] as Pt, d1[0] as Pt), 2), mul(sub(d1[2] as Pt, d1[1] as Pt), 2)];
  return u.map((ui, k) => {
    const q = bezAt(b, ui);
    const q1 = add(add(mul(d1[0] as Pt, (1 - ui) * (1 - ui)), mul(d1[1] as Pt, 2 * ui * (1 - ui))), mul(d1[2] as Pt, ui * ui));
    const q2 = add(mul(d2[0] as Pt, 1 - ui), mul(d2[1] as Pt, ui));
    const diff = sub(q, d[first + k] as Pt);
    const num = dot(diff, q1);
    const den = dot(q1, q1) + dot(diff, q2);
    if (Math.abs(den) < 1e-12) return ui;
    return Math.min(1, Math.max(0, ui - num / den));
  });
}

function centerTangent(d: Pt[], i: number): Pt {
  const a = d[Math.max(0, i - 2)] as Pt;
  const b = d[Math.min(d.length - 1, i + 2)] as Pt;
  return norm(sub(a, b));
}

function fitCubic(d: Pt[], first: number, last: number, t1: Pt, t2: Pt, out: Bez[], depth: number): void {
  const p0 = d[first] as Pt;
  const p3 = d[last] as Pt;
  if (last - first < 2) {
    const k = len(sub(p3, p0)) / 3;
    out.push([p0, add(p0, mul(t1, k)), add(p3, mul(t2, k)), p3]);
    return;
  }
  let u = chordParams(d, first, last);
  let b = generateBezier(d, first, last, u, t1, t2);
  let [err, split] = maxError(d, first, last, b, u);
  if (err <= FIT_TOL) {
    out.push(b);
    return;
  }
  if (err < FIT_TOL * 6) {
    for (let it = 0; it < 6; it++) {
      const up = reparameterize(d, first, b, u);
      b = generateBezier(d, first, last, up, t1, t2);
      [err, split] = maxError(d, first, last, b, up);
      if (err <= FIT_TOL) {
        out.push(b);
        return;
      }
      u = up;
    }
  }
  if (depth > 32 || split <= first || split >= last) {
    out.push(b);
    return;
  }
  const tc = centerTangent(d, split);
  fitCubic(d, first, split, t1, tc, out, depth + 1);
  fitCubic(d, split, last, mul(tc, -1), t2, out, depth + 1);
}

/** Fit an OPEN run (endpoints fixed) with cubics, tangents from its own ends. */
function fitRun(run: Pt[], t1?: Pt, t2?: Pt): Bez[] {
  const n = run.length;
  const k = Math.min(3, n - 1);
  const tA = t1 ?? norm(sub(run[k] as Pt, run[0] as Pt));
  const tB = t2 ?? norm(sub(run[n - 1 - k] as Pt, run[n - 1] as Pt));
  const out: Bez[] = [];
  fitCubic(run, 0, n - 1, tA, tB, out, 0);
  return out;
}

const R = (v: number) => Math.round(v * 10) / 10;
const P = (p: Pt) => `${R(p.x)} ${R(p.y)}`;

type StraightRun = { s: number; e: number; line: Line };

const cyc = (i: number, n: number) => ((i % n) + n) % n;
/** Steps forward from a to b around a ring of n. */
const fwd = (a: number, b: number, n: number) => cyc(b - a, n);

/**
 * Maximal STRAIGHT stretches, found independently of corners.
 *
 * A straight that flows smoothly into a curve — the stem of a D, U or J running
 * into its bowl — has NO corner to split at, so corner-splitting alone fitted
 * the whole outline as one curve and a letter's stem came out as a slightly
 * bowed Bézier. Caught by the stadium test, which is exactly that shape.
 *
 * Telling a real straight from a piece of a large, gentle curve: both can sit
 * within a fraction of a pixel of a line over a short span. What differs is the
 * DIRECTION — a line points the same way at both ends, an arc keeps turning. So
 * a stretch is a line only if its head and tail agree within LINE_TURN_DEG.
 */
function findStraightRuns(smooth: Pt[], raw: Pt[], cornerSet: Set<number>, blocked: Uint8Array): StraightRun[] {
  const n = smooth.length;
  const k = Math.min(FLAT_SPAN, Math.floor(n / 6));
  if (k < 2) return [];
  const flat: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (blocked[i]) {
      flat[i] = false;
      continue;
    }
    const a = sub(at(smooth, i), at(smooth, i - k));
    const b = sub(at(smooth, i + k), at(smooth, i));
    const c = dot(a, b) / ((len(a) || 1) * (len(b) || 1));
    flat[i] = (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI < FLAT_DEG;
  }
  if (!flat.some(Boolean)) return [];
  // start scanning just after a non-flat point so no stretch straddles index 0
  let origin = flat.findIndex((f) => !f);
  if (origin < 0) origin = 0;
  const runs: StraightRun[] = [];
  let t = 0;
  while (t < n) {
    const i0 = cyc(origin + t, n);
    if (!flat[i0]) {
      t++;
      continue;
    }
    let t1 = t;
    while (t1 + 1 < n && flat[cyc(origin + t1 + 1, n)]) t1++;
    let sIdx = i0;
    let eIdx = cyc(origin + t1, n);
    t = t1 + 1;

    /* Find the straight part from its STABLE MIDDLE outwards. A flat stretch
     * can run into the gentle start of a curve (a serif's bracket easing into
     * a stem), and rejecting the whole stretch because its end strays — which
     * the first version did — turned a letter's stem into a slightly bowed
     * curve. Fit the middle half, then walk out while points stay on it. */
    const stretch = slice(raw, sIdx, eIdx);
    if (stretch.length < 6) continue;
    const m0 = Math.floor(stretch.length * 0.25);
    const m1 = Math.max(m0 + 4, Math.ceil(stretch.length * 0.75));
    const mid = stretch.slice(m0, Math.min(stretch.length, m1));
    if (mid.length < 4) continue;
    const midLine = fitLine(mid);
    let a = m0;
    let b = Math.min(stretch.length, m1) - 1;
    while (a > 0 && distToLine(stretch[a - 1] as Pt, midLine) <= GROW_TOL) a--;
    while (b < stretch.length - 1 && distToLine(stretch[b + 1] as Pt, midLine) <= GROW_TOL) b++;
    sIdx = cyc(sIdx + a, n);
    eIdx = cyc(sIdx - a + b, n);

    const core = stretch.slice(a, b + 1);
    if (core.length < 4) continue;
    let arc = 0;
    for (let q = 1; q < core.length; q++) arc += len(sub(core[q] as Pt, core[q - 1] as Pt));
    if (arc < MIN_LINE_LEN) continue;

    const line = fitLine(core);
    if (!core.every((p) => distToLine(p, line) <= STRAIGHT_TOL)) continue;
    const q3 = Math.max(4, Math.floor(core.length * 0.35));
    const head = fitLine(core.slice(0, q3));
    const tail = fitLine(core.slice(core.length - q3));
    if (lineAngle(head.d, tail.d) >= LINE_TURN_DEG) continue;

    /* Reach a CORNER only. The blur rounds the last point or two into every
     * corner, so a line that genuinely ends at one stops a little short of it —
     * extend it the rest of the way, and nowhere else. At a SMOOTH join (stem
     * into bracket) there is no corner to reach and the line stays where the
     * strict grow above left it: pushing it further was what put a notch in the
     * join. Never extends THROUGH a corner — that split a square's edges into
     * twenty curves in an earlier version. */
    const reach = 2 * k + 2;
    for (let g = 1; g <= reach; g++) {
      const cand = cyc(sIdx - g, n);
      if (blocked[cand]) break;
      if (cornerSet.has(cand)) {
        sIdx = cand;
        break;
      }
    }
    for (let g = 1; g <= reach; g++) {
      const cand = cyc(eIdx + g, n);
      if (blocked[cand]) break;
      if (cornerSet.has(cand)) {
        eIdx = cand;
        break;
      }
    }
    let d = line.d;
    if (dot(d, sub(raw[eIdx] as Pt, raw[sIdx] as Pt)) < 0) d = mul(d, -1);
    runs.push({ s: sIdx, e: eIdx, line: snapLine({ c: line.c, d }) });
  }
  return runs;
}

/**
 * One closed traced outline → path data (`M … L … C … Z`).
 *
 * `raw` are the sub-pixel boundary points in order around the loop.
 */
export function fitLoop(raw: Pt[]): string {
  if (raw.length < 3) return '';
  const n = raw.length;
  const smooth = smoothRing(raw);
  const corners = findCorners(smooth);
  const cornerSet = new Set(corners);

  /* Lines, from two sources.
   *
   * 1. CORNER TO CORNER — a stretch bounded by two corners that is straight is
   *    a line, however short. This is what a serif's short flat edges need, and
   *    two corners are strong evidence on their own, so no length floor applies.
   * 2. STANDALONE — a straight that flows smoothly into a curve (a stem into a
   *    bowl) has no corner at one or both ends; findStraightRuns finds those on
   *    whatever the first pass did not already claim. */
  const lines: StraightRun[] = [];
  const blocked = new Uint8Array(n);
  for (let r = 0; r < corners.length && corners.length >= 2; r++) {
    const i = corners[r] as number;
    const j = corners[(r + 1) % corners.length] as number;
    const seg = slice(raw, i, j);
    const trim = seg.length > 8 ? 2 : 0;
    const inner = seg.slice(trim, seg.length - trim);
    if (inner.length < 2 || len(sub(seg[seg.length - 1] as Pt, seg[0] as Pt)) < 3) continue;
    const l = fitLine(inner);
    if (!inner.every((p) => distToLine(p, l) <= STRAIGHT_TOL)) continue;
    let dd = l.d;
    if (dot(dd, sub(seg[seg.length - 1] as Pt, seg[0] as Pt)) < 0) dd = mul(dd, -1);
    lines.push({ s: i, e: j, line: snapLine({ c: l.c, d: dd }) });
    for (let q = i; ; q = (q + 1) % n) {
      blocked[q] = 1;
      if (q === j) break;
    }
  }
  lines.push(...findStraightRuns(smooth, raw, cornerSet, blocked));

  // ── Neither corners nor lines: one smooth closed curve (an "O"). Split it in
  // two and fit each half with SHARED tangents at the joins, so it has no kink.
  if (corners.length === 0 && lines.length === 0) {
    const s1 = Math.floor(n / 2);
    const tan = (i: number) => norm(sub(at(smooth, i + 3), at(smooth, i - 3)));
    const t0 = tan(0);
    const tS = tan(s1);
    const a = fitRun(slice(smooth, 0, s1), t0, mul(tS, -1));
    const b = fitRun(slice(smooth, s1, 0), tS, mul(t0, -1));
    const all = [...a, ...b];
    return `M${P((all[0] as Bez)[0])}` + all.map((z) => `C${P(z[1])} ${P(z[2])} ${P(z[3])}`).join('') + 'Z';
  }

  // ── Breakpoints: every corner, and both ends of every straight run.
  type BP = { idx: number; corner: boolean; lineIn: Line | null; lineOut: Line | null };
  const byIdx = new Map<number, BP>();
  const bp = (idx: number): BP => {
    let b = byIdx.get(idx);
    if (!b) {
      b = { idx, corner: false, lineIn: null, lineOut: null };
      byIdx.set(idx, b);
    }
    return b;
  };
  for (const c of corners) bp(c).corner = true;
  const lineFrom = new Map<number, StraightRun>();
  for (const r of lines) {
    bp(r.s).lineOut = r.line;
    bp(r.e).lineIn = r.line;
    lineFrom.set(r.s, r);
  }
  const pts = [...byIdx.values()].sort((a, b) => a.idx - b.idx);

  // ── Where each breakpoint sits. Between two lines: their intersection
  // (sharp, exact). On one line: the traced point pulled onto it, so the line
  // stays straight. Otherwise: the traced point as found.
  const place = new Map<number, Pt>();
  for (const b of pts) {
    const traced = raw[b.idx] as Pt;
    let p: Pt | null = null;
    if (b.lineIn && b.lineOut) p = intersect(b.lineIn, b.lineOut);
    if (!p && b.lineOut) p = projectOnto(traced, b.lineOut);
    if (!p && b.lineIn) p = projectOnto(traced, b.lineIn);
    place.set(b.idx, p ?? traced);
  }

  let d = `M${P(place.get((pts[0] as BP).idx) as Pt)}`;
  for (let q = 0; q < pts.length; q++) {
    const A = pts[q] as BP;
    const B = pts[(q + 1) % pts.length] as BP;
    const start = place.get(A.idx) as Pt;
    const end = place.get(B.idx) as Pt;
    const run = lineFrom.get(A.idx);
    if (run && run.e === B.idx) {
      d += `L${P(end)}`;
      continue;
    }
    let seg = slice(smooth, A.idx, B.idx);
    if (seg.length < 3) {
      d += `L${P(end)}`;
      continue;
    }
    /* Beside a CORNER the first couple of points were rounded into it by the
     * blur. Fitting through them made the curve leave the corner in the wrong
     * direction and dip — seen on a serif's underside, right by its tip. The
     * corner itself stays pinned; only its rounded neighbours are dropped. */
    const cut0 = A.corner && seg.length > 2 * CORNER_SKIP + 4 ? CORNER_SKIP : 0;
    const cut1 = B.corner && seg.length > 2 * CORNER_SKIP + 4 ? CORNER_SKIP : 0;
    seg = [seg[0] as Pt, ...seg.slice(1 + cut0, seg.length - 1 - cut1), seg[seg.length - 1] as Pt];
    seg[0] = start;
    seg[seg.length - 1] = end;
    /* A curve that flows out of a line leaves ALONG it, and one that flows into
     * a line arrives along it — that is what makes a stem-into-bowl join smooth
     * instead of kinked. At a real corner the curve takes its own tangent. */
    const t1 = !A.corner && A.lineIn ? A.lineIn.d : undefined;
    const t2 = !B.corner && B.lineOut ? mul(B.lineOut.d, -1) : undefined;
    for (const z of fitRun(seg, t1, t2)) d += `C${P(z[1])} ${P(z[2])} ${P(z[3])}`;
  }
  return d + 'Z';
}
