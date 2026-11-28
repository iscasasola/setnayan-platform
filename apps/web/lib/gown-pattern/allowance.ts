/**
 * 👗 gown-pattern/allowance — the CUT LINE round a block (plan step B11; owner D29, 28 Nov: "seam allowances on by
 * default and editable"; D30: centimetres on patterns). Pure; mm in, mm out.
 *
 * A block's outline is the SEWING line. Each edge is sorted once:
 *   · fold   — the centre line of a piece cut on the fold: no allowance (the fold is the edge);
 *   · zip    — the centre back of a piece cut as a pair (the gown closes there): the zip allowance;
 *   · hem    — the bottom edge of a skirt or sleeve: the hem allowance;
 *   · seam   — every other edge: the seam allowance.
 * The cut line is each edge moved outwards by its own allowance, the corners mitred (and squared off where a very
 * sharp corner would throw the point far out). "Net pattern" (allowances off) gives no cut line at all: the outline is
 * the cutting line, and the sheet says so.
 * 🔒 lib/gown-pattern/allowance.test.ts
 */
import type { GownBlockPiece, GownPoint } from './skirt';

/** The designer's allowances, cm (her shop defaults, changed on an order when she wants). */
export type GownSeamAllowance = { on: boolean; seamCm: number; hemCm: number; zipCm: number };
export type GownEdgeKind = 'fold' | 'zip' | 'hem' | 'seam';

/** Common dressmaking defaults, cm — the designer edits them (owner D29). A length, never money. */
export const GOWN_SEAM_ALLOWANCE_DEFAULT: GownSeamAllowance = { on: true, seamCm: 1.5, hemCm: 4, zipCm: 2 };
/** The range a designer can set, cm (0 is allowed: a seam she sews on the line, e.g. bound). */
export const GOWN_SEAM_ALLOWANCE_MAX_CM = 10;

/** Is this allowance one the sheet can draw? (every number a length within range) */
export function sanitizeGownSeamAllowance(v: unknown): GownSeamAllowance | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const cm = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= GOWN_SEAM_ALLOWANCE_MAX_CM ? Math.round(x * 10) / 10 : null);
  const seamCm = cm(r.seamCm), hemCm = cm(r.hemCm), zipCm = cm(r.zipCm);
  if (typeof r.on !== 'boolean' || seamCm === null || hemCm === null || zipCm === null) return null;
  return { on: r.on, seamCm, hemCm, zipCm };
}

const onFold = (p: GownBlockPiece) => /on the fold/i.test(p.cut) && !/half circles on the fold/i.test(p.cut);
const isPair = (p: GownBlockPiece) => /\bcut 2\b/i.test(p.cut);
const hasHem = (p: GownBlockPiece) => /skirt|sleeve/i.test(p.name);

/** Each edge's kind; edge i runs from outline[i] to outline[i + 1] (wrapping). */
export function gownEdgeKinds(p: GownBlockPiece): GownEdgeKind[] {
  const o = p.outline, n = o.length;
  const xs = o.map((q) => q[0]), ys = o.map((q) => q[1]);
  const minX = Math.min(...xs), maxY = Math.max(...ys), minY = Math.min(...ys), H = maxY - minY;
  const circle = /circle/i.test(p.name);
  const maxR = Math.max(...o.map(([x, y]) => Math.hypot(x, y)));
  return o.map((a, i) => {
    const b = o[(i + 1) % n]!;
    const centre = Math.abs(a[0] - minX) < 0.5 && Math.abs(b[0] - minX) < 0.5 && Math.abs(a[1] - b[1]) > 0.5;
    if (centre && onFold(p)) return 'fold';
    if (centre && isPair(p) && /back/i.test(p.name)) return 'zip';
    if (hasHem(p)) {
      if (circle) { if (Math.hypot(a[0], a[1]) >= maxR * 0.95 && Math.hypot(b[0], b[1]) >= maxR * 0.95) return 'hem'; }
      else if (a[1] >= maxY - H * 0.06 && b[1] >= maxY - H * 0.06 && Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) return 'hem';
    }
    return 'seam';
  });
}

/** Twice the signed area: > 0 when the outline runs clockwise on screen (y down). */
function area2(o: readonly GownPoint[]): number {
  let s = 0;
  for (let i = 0; i < o.length; i++) { const a = o[i]!, b = o[(i + 1) % o.length]!; s += a[0] * b[1] - b[0] * a[1]; }
  return s;
}

/** The cut line: every edge moved outwards by its own allowance, corners mitred. Null for a net pattern. */
export function gownCutLine(p: GownBlockPiece, sa: GownSeamAllowance): GownPoint[] | null {
  if (!sa.on) return null;
  const kinds = gownEdgeKinds(p);
  const mmOf = (k: GownEdgeKind) => (k === 'fold' ? 0 : k === 'zip' ? sa.zipCm : k === 'hem' ? sa.hemCm : sa.seamCm) * 10;
  // drop repeated points so every edge has a direction
  const o: GownPoint[] = [], kk: GownEdgeKind[] = [];
  p.outline.forEach((q, i) => { const prev = o[o.length - 1]; if (!prev || Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 1e-6) { o.push(q); kk.push(kinds[i]!); } else kk[kk.length - 1] = kinds[i]!; });
  if (o.length > 2 && Math.hypot(o[0]![0] - o[o.length - 1]![0], o[0]![1] - o[o.length - 1]![1]) < 1e-6) { o.pop(); kk.pop(); }
  const n = o.length, sgn = area2(o) > 0 ? 1 : -1;
  // edge i: its outward normal and its moved line (a point on it, and its direction)
  const lines = o.map((a, i) => {
    const b = o[(i + 1) % n]!, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), d = mmOf(kk[i]!);
    // clockwise on screen (y down) ⇒ outward is to the left of travel: (dy, −dx)
    const nx = (sgn * dy) / L, ny = (-sgn * dx) / L;
    return { p: [a[0] + nx * d, a[1] + ny * d] as GownPoint, q: [b[0] + nx * d, b[1] + ny * d] as GownPoint, dx: dx / L, dy: dy / L, d };
  });
  const out: GownPoint[] = [];
  for (let i = 0; i < n; i++) {
    const A = lines[(i - 1 + n) % n]!, B = lines[i]!, cross = A.dx * B.dy - A.dy * B.dx;
    if (Math.abs(cross) < 1e-6) { out.push(B.p); continue; } // straight on: the lines meet end to end
    const t = ((B.p[0] - A.p[0]) * B.dy - (B.p[1] - A.p[1]) * B.dx) / cross;
    const m: GownPoint = [A.p[0] + A.dx * t, A.p[1] + A.dy * t];
    const corner = o[i]!, reach = Math.hypot(m[0] - corner[0], m[1] - corner[1]), limit = 4 * Math.max(A.d, B.d, 1);
    if (reach > limit) { out.push(A.q, B.p); } // square off a sharp point
    else out.push(m);
  }
  return out;
}

/** The pieces with their cut lines (for the sheet and the export). */
export function gownPiecesWithAllowance(pieces: readonly GownBlockPiece[], sa: GownSeamAllowance) {
  return pieces.map((p) => ({ piece: p, cut: gownCutLine(p, sa), kinds: gownEdgeKinds(p) }));
}
