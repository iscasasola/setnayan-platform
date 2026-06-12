/**
 * apps/web/lib/calligraphy.ts
 *
 * Calligraphy RESTROKE engine (owner design 2026-06-11): two script initials
 * the couple positions/overlaps are redrawn as STROKES (centerlines) and
 * joined into ONE continuous variable-width pen ribbon, so they flow together
 * cleanly — the exit swash of one letter sews into the entry of the next.
 *
 * Deterministic, ₱0/use, offline. Letterforms come from EMS Allure (a
 * single-line/centerline SVG font derived from Allura, the Spencerian wedding
 * script · SIL OFL). Its glyphs are open M/L polylines = ready-made
 * centerlines, no outline-to-skeleton extraction. Variable width via
 * perfect-freehand (SVG has no native variable stroke) with synthetic
 * direction-derived pressure → hairline upstroke, swelling downstroke.
 */

import { getStroke } from 'perfect-freehand';

export type Pt = { x: number; y: number };
export type Anchor = { p: Pt; t: Pt }; // t = unit tangent, forward

export interface Stroke {
  centerline: Pt[];
  entry: Anchor;
  exit: Anchor;
}

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
const len = (a: Pt) => Math.hypot(a.x, a.y) || 1e-6;
const unit = (a: Pt): Pt => mul(a, 1 / len(a));
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;

/* ── Parse an EMS-Allure glyph `d` (M/L only) into screen-space substrokes ──
 * SVG fonts are Y-UP; we negate Y so downstrokes are +y (screen space). */
export function parseGlyphSubstrokes(d: string): Pt[][] {
  return d
    .split('M')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((chunk) => {
      const nums = (chunk.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        pts.push({ x: nums[i]!, y: -nums[i + 1]! }); // flip Y → screen space (loop bound guarantees the pair)
      }
      return pts;
    })
    .filter((p) => p.length >= 2);
}

/** Resample a polyline to ~uniform arc-length spacing. */
export function resample(pts: Pt[], spacing: number): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]!];
  let prev = pts[0]!;
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let segLen = len(sub(pts[i]!, prev));
    const dir = unit(sub(pts[i]!, prev));
    while (carry + segLen >= spacing) {
      const step = spacing - carry;
      prev = add(prev, mul(dir, step));
      out.push(prev);
      segLen -= step;
      carry = 0;
    }
    carry += segLen;
    prev = pts[i]!;
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function tangentAt(pts: Pt[], i: number): Pt {
  const a = pts[Math.max(0, i - 1)]!;
  const b = pts[Math.min(pts.length - 1, i + 1)]!;
  return unit(sub(b, a));
}

/** Build a Stroke from a centerline polyline (already transformed/placed). */
export function toStroke(centerline: Pt[]): Stroke {
  const n = centerline.length;
  return {
    centerline,
    entry: { p: centerline[0]!, t: tangentAt(centerline, 0) },
    // exit tangent points FORWARD (out of the letter, into the connector)
    exit: { p: centerline[n - 1]!, t: tangentAt(centerline, n - 1) },
  };
}

function sampleCubic(B0: Pt, B1: Pt, B2: Pt, B3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    const w0 = u * u * u,
      w1 = 3 * u * u * t,
      w2 = 3 * u * t * t,
      w3 = t * t * t;
    out.push({
      x: w0 * B0.x + w1 * B1.x + w2 * B2.x + w3 * B3.x,
      y: w0 * B0.y + w1 * B1.y + w2 * B2.y + w3 * B3.y,
    });
  }
  return out;
}

function segCross(a: Pt, b: Pt, c: Pt, e: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, e) && o(c, e, a) !== o(c, e, b);
}
function selfIntersects(pts: Pt[]): boolean {
  for (let i = 0; i < pts.length - 1; i++)
    for (let j = i + 2; j < pts.length - 1; j++)
      if (Math.abs(i - j) > 1 && segCross(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!))
        return true;
  return false;
}

/**
 * Join two strokes into ONE continuous centerline via a G1-continuous cubic
 * connector (Hermite→Bézier), with a loop/cusp guard that shrinks the handles
 * if the connector would self-cross or overshoot.
 */
export function connect(a: Stroke, b: Stroke, k = 0.5): Pt[] {
  const P0 = a.exit.p,
    T0 = a.exit.t;
  const P1 = b.entry.p,
    T1 = b.entry.t;
  const d = len(sub(P1, P0));
  let ha = k * d,
    hb = k * d;
  let conn: Pt[] = [];
  for (let tries = 0; tries < 5; tries++) {
    const B1 = add(P0, mul(T0, ha / 3));
    const B2 = sub(P1, mul(T1, hb / 3));
    conn = sampleCubic(P0, B1, B2, P1, Math.max(10, Math.ceil(d / 3)));
    if (!(ha > 1.2 * d || hb > 1.2 * d) && !selfIntersects([P0, ...conn])) break;
    ha *= 0.8;
    hb *= 0.8;
  }
  return [...a.centerline, ...conn, ...b.centerline];
}

/**
 * Join two centerlines into one, choosing the CLOSEST pair of endpoints and
 * reversing either polyline as needed so the connector spans the natural gap
 * (the couple free-places the letters, so the writing exit isn't guaranteed
 * to face the next entry). Wraps connect() after orientation.
 */
export function connectNearest(a: Pt[], b: Pt[], k = 0.5): Pt[] {
  const ends: [Pt, boolean][] = [
    [a[0]!, false],
    [a[a.length - 1]!, true],
  ];
  const starts: [Pt, boolean][] = [
    [b[0]!, false],
    [b[b.length - 1]!, true],
  ];
  let best = Infinity,
    aRev = false,
    bRev = false;
  for (const [pa, ra] of ends)
    for (const [pb, rb] of starts) {
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (d < best) {
        best = d;
        aRev = !ra; // the chosen endpoint must become a's LAST point
        bRev = rb; // and b's FIRST point
      }
    }
  const A = aRev ? [...a].reverse() : a;
  const B = bRev ? [...b].reverse() : b;
  return connect(toStroke(A), toStroke(B), k);
}

export type PenOptions = {
  size?: number; // nib size (px)
  thinning?: number; // 0..1, how much upstrokes thin
  /** Direction treated as the "down" (thick) stroke. Screen space → +y. */
  down?: Pt;
};

/**
 * Variable-width pointed-pen outline for a centerline → a single filled SVG
 * path `d`. Pressure is synthesised from stroke direction (downstroke thick).
 * Rendering the WHOLE merged centerline in one call makes the join seamless.
 */
export function penOutline(centerline: Pt[], opts: PenOptions = {}): string {
  const { size = 18, thinning = 0.62, down = { x: 0, y: 1 } } = opts;
  if (centerline.length < 2) return '';
  const input = centerline.map((p, i) => {
    const tan = tangentAt(centerline, i);
    const pressure = Math.min(1, Math.max(0, 0.5 + 0.5 * dot(tan, down)));
    return [p.x, p.y, pressure] as [number, number, number];
  });
  const outline = getStroke(input, {
    size,
    thinning,
    smoothing: 0.6,
    streamline: 0.4,
    simulatePressure: false,
    start: { taper: size * 6, cap: true },
    end: { taper: size * 6, cap: true },
  });
  if (!outline.length) return '';
  let d = `M ${outline[0]![0]!.toFixed(2)},${outline[0]![1]!.toFixed(2)} Q `;
  for (let i = 0; i < outline.length; i++) {
    const [x0 = 0, y0 = 0] = outline[i]!;
    const [x1 = 0, y1 = 0] = outline[(i + 1) % outline.length]!;
    d += `${x0.toFixed(2)},${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)},${((y0 + y1) / 2).toFixed(2)} `;
  }
  return d + 'Z';
}

export type Placed = { x: number; y: number; scale: number; rot: number };

/** Apply a user placement (translate, rotate, uniform scale) to points. */
export function place(pts: Pt[], t: Placed): Pt[] {
  const c = Math.cos((t.rot * Math.PI) / 180),
    s = Math.sin((t.rot * Math.PI) / 180);
  return pts.map((p) => ({
    x: t.x + t.scale * (p.x * c - p.y * s),
    y: t.y + t.scale * (p.x * s + p.y * c),
  }));
}
