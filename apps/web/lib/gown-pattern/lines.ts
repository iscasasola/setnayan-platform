/**
 * 👗 gown-pattern/lines — the design's own lines on the cutting blocks (plan step B9; prototype v209 `lnBlocks`,
 * `lnSummary`, `lnG`, `lnD`, `lnMeasured`; corpus prototypes/gown_maker_2026-11-27, commit "v209"). Pure.
 *
 * The bride's maker measures her neckline, back and hem in cm when she sends (`lnMeasured`: A's mannequin, plan A10),
 * and the order carries those numbers as `lines`. Here they are only drawn: rust "design" lines on the bodice front,
 * bodice back and the skirt front and back blocks, labelled; the block itself is unchanged. The ball gown's circle
 * skirt gets no hem line yet (v209 "Not done"). The order sheet prints them as measurements a designer can check.
 * Designer only: no price, no amount, anywhere.
 * 🔒 lib/gown-pattern/lines.test.ts (held to the prototype's own lnBlocks to 0.01 mm)
 */
import type { GownBlockPiece, GownPoint, GownSkirtDraft, GownDraftRefusal } from './skirt';
import type { GownBodiceDraft } from './bodice';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** v209 `lnMeasured().neck`: cm, measured on her by the maker; L = her left, R = her right. */
export type GownLineNeck = {
  custom: boolean;
  from: string;
  centre: number;
  cornerL: number;
  cornerDepthL: number;
  shoulderL: number;
  shoulderDepthL: number;
  curve: number;
  cornerR: number;
  cornerDepthR: number;
  shoulderR: number;
  shoulderDepthR: number;
};
/** v209 `lnMeasured().back`. */
export type GownLineBack = { custom: boolean; from: string; depth: number; halfL: number; halfR: number; curve: number; sideDepth: number };
export const GOWN_HEM_EDGES = ['plain', 'scallop', 'hanky', 'curved'] as const;
export type GownHemEdge = (typeof GOWN_HEM_EDGES)[number];
/** v209 `lnMeasured().hem`: cm above the floor. */
export type GownLineHem = { custom: boolean; front: number; left: number; back: number; right: number; curve: number; edge: GownHemEdge };
/** v209 `orderData().lines`: what the order carries. Any part may be absent (closed back, a man's design …). */
export type GownOrderLines = { neck?: GownLineNeck; back?: GownLineBack; hem?: GownLineHem; armhole?: number };

/** A design line drawn on a block: points in the piece's own mm, and its label. */
export type GownStyleLine = { pts: GownPoint[]; label: string };

// ── checking what the maker sends (refused, never repaired) ─────────────────────────────────────────────────────

const LIMIT_CM = 400;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < LIMIT_CM;
const word = (v: unknown) => typeof v === 'string' && /^[a-zA-Z]{1,20}$/.test(v);
const NECK_KEYS = ['centre', 'cornerL', 'cornerDepthL', 'shoulderL', 'shoulderDepthL', 'curve', 'cornerR', 'cornerDepthR', 'shoulderR', 'shoulderDepthR'] as const;
const BACK_KEYS = ['depth', 'halfL', 'halfR', 'curve', 'sideDepth'] as const;
const HEM_KEYS = ['front', 'left', 'back', 'right', 'curve'] as const;

function part<K extends string>(v: unknown, keys: readonly K[], extra: (o: Record<string, unknown>) => boolean): Record<K, number> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.custom !== 'boolean' || !keys.every((k) => num(o[k])) || !extra(o)) return null;
  return o as Record<K, number>;
}

/** The order's lines, checked: numbers in cm, the named words, nothing else. Null = refused (never thinned). */
export function sanitizeGownOrderLines(v: unknown): GownOrderLines | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some((k) => !['neck', 'back', 'hem', 'armhole'].includes(k))) return null;
  const out: GownOrderLines = {};
  if (o.neck !== undefined) {
    const n = part(o.neck, NECK_KEYS, (x) => word(x.from));
    if (!n) return null;
    out.neck = { custom: (o.neck as { custom: boolean }).custom, from: String((o.neck as { from: string }).from), ...pick(n, NECK_KEYS) };
  }
  if (o.back !== undefined) {
    const b = part(o.back, BACK_KEYS, (x) => word(x.from));
    if (!b) return null;
    out.back = { custom: (o.back as { custom: boolean }).custom, from: String((o.back as { from: string }).from), ...pick(b, BACK_KEYS) };
  }
  if (o.hem !== undefined) {
    const h = part(o.hem, HEM_KEYS, (x) => (GOWN_HEM_EDGES as readonly unknown[]).includes(x.edge));
    if (!h) return null;
    out.hem = { custom: (o.hem as { custom: boolean }).custom, edge: (o.hem as { edge: GownHemEdge }).edge, ...pick(h, HEM_KEYS) };
  }
  if (o.armhole !== undefined) {
    if (!num(o.armhole) || (o.armhole as number) < 0) return null;
    out.armhole = o.armhole as number;
  }
  return out;
}
function pick<K extends string>(o: Record<K, number>, keys: readonly K[]): Record<K, number> {
  const r = {} as Record<K, number>;
  for (const k of keys) r[k] = o[k];
  return r;
}

// ── the curves (v209 lnG, lnD) ──────────────────────────────────────────────────────────────────────────────────

/** v209 `lnG`: centre to corner; m = how far up the curve is halfway across (0.5 straight). */
export const gownLineG = (u: number, m: number) => Math.pow(clamp(u, 0, 1), Math.log(clamp(m, 0.003, 0.95)) / Math.log(0.5));
/** v209 `lnD`: the back's sides: 0.5 a V, 0.866 the scoop, 0.99 square. */
export function gownLineD(s: number, m: number): number {
  s = clamp(s, 0, 1);
  if (m <= 0.5) return 1 - Math.pow(s, Math.log(1 - clamp(m, 0.2, 0.5)) / Math.log(0.5));
  const sc = Math.sqrt(Math.max(0, 1 - s * s));
  if (m <= 0.866) {
    const t = (m - 0.5) / 0.366;
    return (1 - s) * (1 - t) + sc * t;
  }
  const t = clamp((m - 0.866) / 0.124, 0, 1);
  return sc * (1 - t) + (1 - Math.pow(s, 12)) * t;
}

// ── on the blocks (v209 lnBlocks) ───────────────────────────────────────────────────────────────────────────────

const HEM_EDGE_LABEL: Record<Exclude<GownHemEdge, 'plain'>, string> = { scallop: 'scalloped', hanky: 'handkerchief points', curved: 'curved' };

/**
 * v209 `lnBlocks`: adds the design's lines to the pieces (as `style`); the blocks themselves are unchanged. `waistFloor`
 * is the skirt's waist-to-floor in cm by the order of trust (tape → typed → estimate), 0 when unknown (no hem line).
 */
export function gownLinesOnBlocks(
  lines: GownOrderLines | null,
  waistFloorCm: number,
  bodice: GownBodiceDraft | GownDraftRefusal,
  skirt: GownSkirtDraft | GownDraftRefusal,
): void {
  const ln = lines;
  if (!ln) return;
  const mm = 10;
  const add = (p: GownBlockPiece, s: GownStyleLine) => (p.style = p.style ?? []).push(s);
  if (bodice.ok && ln.neck) {
    const F = bodice.pieces[1]!, P = F.outline, cf = P[0]!, hps = P[6]!, tip = P[7]!, n = ln.neck, y0 = cf[1], pts: GownPoint[] = [];
    const xC = n.cornerL * mm, yC = y0 + n.cornerDepthL * mm, yc = y0 + n.centre * mm;
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      pts.push([xC * u, yc + (yC - yc) * gownLineG(u, n.curve)]);
    }
    let xS = n.shoulderL * mm;
    const yS = y0 + n.shoulderDepthL * mm;
    const shY = (x: number) => hps[1] + (tip[1] - hps[1]) * clamp((x - hps[0]) / Math.max(1, tip[0] - hps[0]), 0, 1);
    if (xS <= hps[0]) xS = hps[0] + 1;
    if (yS < shY(xS) + 15) pts.push([xS, shY(Math.min(xS, tip[0]))]);
    else {
      pts.push([xS, yS]);
      let xr = 0;
      for (let i = 7; i < P.length - 1; i++) {
        const a = P[i]!, b = P[i + 1]!;
        if ((a[1] - yS) * (b[1] - yS) <= 0 && a[1] !== b[1]) xr = Math.max(xr, a[0] + ((b[0] - a[0]) * (yS - a[1])) / (b[1] - a[1]));
      }
      if (xr > xS) pts.push([xr, yS]);
    }
    add(F, { pts, label: n.custom ? 'design neckline (custom)' : 'design neckline' });
  }
  if (bodice.ok && ln.back) {
    const Bk = bodice.pieces[0]!, b = ln.back, pts: GownPoint[] = [], sd = Math.min(b.sideDepth, b.depth) * mm, d = b.depth * mm, w = b.halfL * mm;
    for (let i = 0; i <= 16; i++) {
      const s = i / 16;
      pts.push([w * s, sd + (d - sd) * gownLineD(s, b.curve)]);
    }
    add(Bk, { pts, label: b.custom ? 'design back (custom)' : 'design back' });
  }
  if (skirt.ok && ln.hem && skirt.sil !== 'ball' && (ln.hem.custom || Math.abs(ln.hem.front - ln.hem.back) > 2)) {
    const h = ln.hem, Lf = waistFloorCm * mm;
    // v209 draws both the front and the back from her LEFT side's height (`h.left` for both pieces); kept exactly.
    if (Lf > 200)
      for (const [pc, c, s] of [
        [skirt.pieces[0], h.front, h.left],
        [skirt.pieces[1], h.back, h.left],
      ] as const) {
        if (!pc || !pc.side) continue;
        const P = pc.outline, side = pc.side[pc.side.length - 1]!, maxY = Math.max(...P.map((q) => q[1])), pts: GownPoint[] = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12, x = side[0] * u, hh = c + ((s - c) * (1 - Math.cos(Math.PI * u))) / 2;
          pts.push([x, Math.min(maxY, Lf - hh * mm)]);
        }
        add(pc, { pts, label: 'design hem' + (h.edge !== 'plain' ? ` (${HEM_EDGE_LABEL[h.edge]})` : '') });
      }
  }
}

// ── on the order sheet (v209 lnSummary) ─────────────────────────────────────────────────────────────────────────

const LN_NAME: Record<string, string> = {
  sweetheart: 'Sweetheart', v: 'V-neck', scoop: 'Scoop', square: 'Square', straight: 'Straight across', off: 'Off-shoulder',
  high: 'High neck', bateau: 'Bateau', plunge: 'Plunge', plungewaist: 'Plunge', closed: 'Closed back', scoopB: 'Scoop back', vB: 'V back',
};
const BACK_NAME: Record<string, string> = { scoop: 'Scoop', v: 'V back', closed: 'Closed' };
const r2 = (x: number) => Math.round(x * 2) / 2;
const below = (v: number, what: string) => (Math.abs(v) < 0.25 ? `level with ${what}` : `${r2(Math.abs(v))} cm ${v >= 0 ? 'below' : 'above'} ${what}`);
const curveWord = (m: number) => (m < 0.05 ? 'square corners' : m < 0.3 ? 'a rounded curve' : m < 0.65 ? 'straight sides (a V)' : 'a dipped, sweetheart-like curve');
const backWord = (m: number) => (m < 0.62 ? 'V-shaped' : m < 0.93 ? 'scooped' : 'square');

/**
 * v209 `lnSummary`: her own lines, as a designer measures them ("17.5 cm below the collarbone at centre, 14.5 cm wide
 * at the bust line…"). Only what she changed from the named line is said; a named line needs no sentence.
 * `highNeck`: the armhole sentence names the halter line under the collar band.
 */
export function gownLinesSummary(lines: GownOrderLines | null, highNeck = false): string[] {
  const out: string[] = [];
  if (!lines) return out;
  const { neck: n, back: b, hem: h } = lines;
  if (n && n.custom) {
    const asym = Math.abs(n.cornerL - n.cornerR) > 0.4 || Math.abs(n.cornerDepthL - n.cornerDepthR) > 0.4 || Math.abs(n.shoulderL - n.shoulderR) > 0.4 || Math.abs(n.shoulderDepthL - n.shoulderDepthR) > 0.4;
    out.push(
      `Neckline (custom, from ${LN_NAME[n.from] ?? n.from}): ${below(n.centre, 'the collarbone')} at centre, ${r2(n.cornerL + n.cornerR)} cm wide at the bust line (${below(n.cornerDepthL, 'the collarbone')}${asym ? ` on her left, ${below(n.cornerDepthR, 'it')} on her right` : ''}), meeting the shoulder ${r2(n.shoulderL)} cm from the centre line${asym ? ` on her left and ${r2(n.shoulderR)} cm on her right` : ' each side'}, ${below(n.shoulderDepthL, 'the collarbone')}; ${curveWord(n.curve)}`,
    );
  }
  if (lines.armhole) out.push(`Armholes cut in ${r2(lines.armhole)} cm towards the neck${highNeck ? ', to a halter line under the collar band' : ''}`);
  if (b && b.custom) {
    out.push(
      `Back (custom, from ${BACK_NAME[b.from] ?? b.from}): ${r2(b.depth)} cm below the nape at centre, ${r2(b.halfL + b.halfR)} cm wide at the top${Math.abs(b.halfL - b.halfR) > 0.4 ? ` (${r2(b.halfL)} cm to her left, ${r2(b.halfR)} cm to her right)` : ''}, ${backWord(b.curve)}`,
    );
  }
  if (h && (h.custom || h.edge !== 'plain')) {
    const fl = (x: number) => (x <= 2.5 ? 'on the floor' : `${r2(x)} cm above the floor`), sym = Math.abs(h.left - h.right) < 0.4;
    const edge = h.edge !== 'plain' ? `; ${{ scallop: 'scalloped', hanky: 'handkerchief-point', curved: 'curved (petal)' }[h.edge]} edge` : '';
    out.push(`Hem${h.custom ? ' (custom)' : ''}: front ${fl(h.front)}, ${sym ? `sides ${fl(h.left)}` : `her left side ${fl(h.left)}, her right side ${fl(h.right)}`}, back ${fl(h.back)}${edge}`);
  }
  return out;
}

/** When the stored lines no longer check out: said, never drawn as the named lines. */
export const GOWN_LINES_UNREAD = 'Couldn’t read her neckline, back and hem lines on this design. The blocks show the plain lines.';
