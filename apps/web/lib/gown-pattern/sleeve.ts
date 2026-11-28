/**
 * 👗 gown-pattern/sleeve — the one-piece set-in sleeve block (plan step B10). Pure geometry, designer only.
 *
 * ⚠ FROM MEMORY (decision D27): the prototype never drafted a sleeve ("The sleeve block comes next"), so this follows
 * Aldrich's close-fitting one-piece sleeve AS REMEMBERED. Every constant below is in `GOWN_SLEEVE_DRAFT_TABLE` and
 * printed on the sheet, to be checked against Metric Pattern Cutting for Women's Wear before cutting (step B19).
 *
 * Units: mm, x across from the back underarm (the centre line at half the width, the front to its right), y down from
 * the top of the cap. Every x is ≥ 0, like every other block on the sheet.
 *   · Width at the underarm = upper arm + ease; the cap height is SOLVED so the sleeve head is the armhole plus the cap
 *     ease (the check row), then refused if that height is outside the believable range.
 *   · Long: down to the wrist (arm length, bent), shaped at the elbow and the wrist, each = tape + ease.
 *   · Cap: the cap and a short underarm seam only.
 *   · Butterfly and flutter are not fitted sleeves (a cape piece): no block. None: no block.
 * Both underarm seams are drawn the same length, so they sew together. No price on any block.
 * 🔒 lib/gown-pattern/sleeve.test.ts
 */
import { draftEase, draftMeasure, type GownDraftOrder, type GownDraftSource, type GownTape } from './inputs';
import type { GownBlockPiece, GownDraftCheck, GownDraftRefusal, GownPoint } from './skirt';
import type { GownSleeve } from '../gown-config';

/** The sleeve constants, FROM MEMORY: [key, rule, what it sets]. Printed on the sheet beside the bodice's table. */
export const GOWN_SLEEVE_DRAFT_TABLE: ReadonlyArray<readonly [string, string, string]> = [
  ['capEase', '3 cm (2 to 4.5 accepted)', 'how much longer the sleeve head is than the armhole, eased in'],
  ['capHeight', 'solved; accepted between armhole ÷ 4 and armhole ÷ 2.5', 'top of the cap down to the underarm line'],
  ['upperArmEase', 'from the design’s ease rows (3 cm, 4 cm long, 1 cm stretch)', 'added to the upper arm'],
  ['elbowEase', '3 cm', 'added to the elbow (long sleeve)'],
  ['wristEase', 'from the design’s ease rows (3 cm)', 'added to the wrist (long sleeve)'],
  ['elbowLine', 'half the arm length (bent), plus 2.5 cm', 'where the elbow line sits below the cap top'],
  ['capSeam', '8 cm below the underarm line', 'how far a cap sleeve runs down the arm'],
] as const;

export const GOWN_SLEEVE = {
  capEase: 3,
  capEaseMin: 2,
  capEaseMax: 4.5,
  elbowEase: 3,
  wristEase: 3,
  elbowBelowHalf: 2.5,
  capSeam: 8,
} as const;

export type GownSleeveDraft = {
  ok: true;
  sleeve: GownSleeve;
  pieces: GownBlockPiece[];
  checks: GownDraftCheck[];
  src: Record<string, GownDraftSource>;
  est: boolean;
  /** Cap height, cm (for the sheet). */
  capHeight: number;
  note: string;
};
export type GownSleeveNone = { ok: true; sleeve: GownSleeve; pieces: []; checks: []; src: Record<string, never>; est: false; capHeight: 0; note: string };

const mm = (cm: number) => cm * 10;

/** A cubic from p0 to p3, as n points after p0. */
function cubic(p0: GownPoint, p1: GownPoint, p2: GownPoint, p3: GownPoint, n = 16): GownPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ] as const;
  });
}
const pathLen = (pts: readonly GownPoint[]) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return s;
};

/** The cap from the back underarm, over the top, to the front underarm (half width hw, height h, mm). */
function capCurve(hw: number, h: number): GownPoint[] {
  const top: GownPoint = [0, 0];
  const back = cubic([-hw, h], [-hw * 0.9, h * 0.45], [-hw * 0.45, 0], top);
  const front = cubic(top, [hw * 0.4, 0], [hw * 0.85, h * 0.6], [hw, h]);
  return [[-hw, h], ...back, ...front];
}

export function draftSleeve(order: GownDraftOrder & { sleeve: GownSleeve }, tape: GownTape = {}): GownSleeveDraft | GownSleeveNone | GownDraftRefusal {
  const sleeve = order.sleeve;
  if (sleeve === 'none') return { ok: true, sleeve, pieces: [], checks: [], src: {}, est: false, capHeight: 0, note: 'No sleeve.' };
  if (sleeve === 'butterfly') {
    return { ok: true, sleeve, pieces: [], checks: [], src: {}, est: false, capHeight: 0, note: 'Butterfly sleeves are not a fitted sleeve: cut them as a cape piece, no sleeve block.' };
  }
  const long = sleeve === 'long';
  const [ah, ahS] = draftMeasure(order, tape, 'armhole');
  const [ua, uaS] = draftMeasure(order, tape, 'upperArm');
  const [el, elS] = draftMeasure(order, tape, 'elbow');
  const [wr, wrS] = draftMeasure(order, tape, 'wrist');
  const [al, alS] = draftMeasure(order, tape, 'armBent');
  const missing = [!(ah > 0) && 'armhole', !(ua > 0) && 'upper arm', long && !(el > 0) && 'elbow', long && !(wr > 0) && 'wrist', long && !(al > 0) && 'arm length (bent)'].filter(Boolean);
  if (missing.length) return { ok: false, error: `Can't draft the sleeve: missing ${missing.join(', ')}.` };
  const src: Record<string, GownDraftSource> = long
    ? { armhole: ahS, upperArm: uaS, elbow: elS, wrist: wrS, armBent: alS }
    : { armhole: ahS, upperArm: uaS };
  const est = Object.values(src).includes('estimate');

  const uaE = draftEase(order, 'Upper arm') ?? (long ? 4 : 3);
  const wrE = draftEase(order, 'Wrist') ?? GOWN_SLEEVE.wristEase;
  const W = mm(ua + uaE);
  const hw = W / 2;
  const want = mm(ah + GOWN_SLEEVE.capEase);
  // Solve the cap height so the sleeve head is the armhole plus the cap ease.
  let lo = 1;
  let hi = mm(ah);
  for (let it = 0; it < 60; it++) {
    const m = (lo + hi) / 2;
    if (pathLen(capCurve(hw, m)) < want) lo = m;
    else hi = m;
  }
  const h = lo;
  const cap = capCurve(hw, h);
  if (h < mm(ah) / 4 || h > mm(ah) / 2.5 || pathLen(cap) < want - 1) {
    return {
      ok: false,
      error: `Can't draft the sleeve: an upper arm of ${ua} cm and an armhole of ${ah} cm don't make a believable cap. Check both with the tape.`,
    };
  }

  const L = long ? mm(al) : h + mm(GOWN_SLEEVE.capSeam);
  let side: GownPoint[];
  const marks: [number, number, string][] = [[hw, h, 'underarm']];
  if (long) {
    const eY = mm(al / 2 + GOWN_SLEEVE.elbowBelowHalf);
    const eW = mm(el + GOWN_SLEEVE.elbowEase) / 2;
    const wW = mm(wr + wrE) / 2;
    side = [[hw, h], [eW, eY], [wW, L]];
    marks.push([eW, eY, 'elbow']);
  } else {
    side = [[hw, h], [hw * 0.96, L]];
  }
  const front = side;
  const back = side.map(([x, y]) => [-x, y] as const);
  // Drawn from the back underarm (x ≥ 0), as the sheet lays every block out.
  const at = ([x, y]: GownPoint): GownPoint => [x + hw, y];
  const outline: GownPoint[] = [...cap, ...front.slice(1), ...back.slice(1).reverse()].map(at);
  const piece: GownBlockPiece = {
    name: long ? 'Sleeve (long)' : 'Sleeve (cap)',
    cut: 'Cut 2 (a pair)',
    outline,
    darts: [],
    marks: marks.map(([x, y, w]) => [x + hw, y, w] as const),
    points: [],
    grain: [
      [hw, h + 40],
      [hw, Math.max(h + 80, L - 60)],
    ],
    vent: 0,
  };
  const checks: GownDraftCheck[] = [
    ['Sleeve head / armhole + cap ease', ah + GOWN_SLEEVE.capEase, pathLen(cap) / 10],
    ['Upper arm + ease', ua + uaE, W / 10],
    ['Underarm seams back / front', pathLen(back) / 10, pathLen(front) / 10],
  ];
  if (long) {
    checks.push(['Elbow + ease', el + GOWN_SLEEVE.elbowEase, (2 * front[1]![0]) / 10], ['Wrist + ease', wr + wrE, (2 * front[2]![0]) / 10], ['Length (centre)', al, L / 10]);
  }
  return {
    ok: true,
    sleeve,
    pieces: [piece],
    checks,
    src,
    est,
    capHeight: h / 10,
    note: `Cap ease ${GOWN_SLEEVE.capEase} cm, eased into the armhole between the notches. From memory: check against the book before cutting.`,
  };
}
