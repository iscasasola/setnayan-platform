/**
 * 👗 gown-pattern/bodice — the close-fitting bodice starting block, after Aldrich, FROM MEMORY (plan step B6; prototype
 * v181 `draftBodice`). Pure geometry; every book constant is read from lib/gown-pattern/draft-constants.ts GOWN_DRAFT,
 * the same table every sheet prints marked "to check" until step B19.
 *
 * Back (cut 2): centre back = nape to waist; armscye depth = nape to waist − side length; neck width from the neck;
 * shoulder = shoulder length + the back shoulder dart, at its slope; back width on the armhole.
 * Front (cut 1 on the fold): the front neck point is placed so the front length over the bust is exact; the bust point
 * sits at shoulder-to-bust-point and half the bust-point spacing; a side bust dart points at it; waist darts under the
 * back width and the bust point; side shaping up to the constant; a waist wider than the bust flares the side out.
 * Units: mm, x across from the centre line, y down from the nape (the back neck point sits above at −backRise).
 * 🔒 lib/gown-pattern/pattern.test.ts (held to the prototype's own outputs, prototype-v197.golden.json)
 */
import type { GownMeasureKey } from '../gown-config';
import { GOWN_DRAFT as K } from './draft-constants';
import { draftEase, draftMeasure, measureLabel, type GownDraftOrder, type GownDraftSource, type GownTape } from './inputs';
import type { GownBlockPiece, GownDraftCheck, GownDraftRefusal, GownPoint } from './skirt';

export type GownBodiceDraft = {
  ok: true;
  pieces: GownBlockPiece[];
  checks: GownDraftCheck[];
  src: Partial<Record<GownMeasureKey, GownDraftSource>>;
  est: boolean;
  /** The side bust dart's width, cm. */
  bustDart: number;
  /** Armscye depth, cm. */
  AD: number;
};

/** The measurements the bodice needs, in the order a missing list names them. */
export const GOWN_BODICE_MEASURES = [
  'napeWaist',
  'frontLen',
  'shoulderApex',
  'apexApex',
  'acrossBack',
  'acrossChest',
  'shoulderLen',
  'sideLen',
  'neck',
] as const satisfies readonly GownMeasureKey[];

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const c = (cm: number) => cm * 10;
const len = (p: GownPoint, q: GownPoint) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** A quadratic curve from a (exclusive) through the control towards b (inclusive), n points. */
const curve = (a: GownPoint, ctl: GownPoint, b: GownPoint, n = 10): GownPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * ctl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctl[1] + t * t * b[1]] as const;
  });
const toMm = (pts: GownPoint[]): GownPoint[] => pts.map(([x, y]) => [c(x), c(y)] as const);

export function draftBodice(order: GownDraftOrder, tape: GownTape = {}): GownBodiceDraft | GownDraftRefusal {
  const v = order.vals;
  const Bu = v.bust ?? 0;
  const W = v.waist ?? 0;
  const UB = (v.underbust ?? 0) > 0 ? (v.underbust as number) : Bu - 12;
  const eB = draftEase(order, 'Bust') ?? 2.5;
  const eW = draftEase(order, 'Waist') ?? 1.5;
  const src: Partial<Record<GownMeasureKey, GownDraftSource>> = {};
  const need = {} as Record<(typeof GOWN_BODICE_MEASURES)[number], number>;
  for (const k of GOWN_BODICE_MEASURES) {
    const [x, s] = draftMeasure(order, tape, k);
    need[k] = x;
    src[k] = s;
  }
  const miss = GOWN_BODICE_MEASURES.filter((k) => !(need[k] > 0)).map(measureLabel);
  if (miss.length || !(Bu > 0 && W > 0)) {
    return { ok: false, error: "Can't draft the bodice: " + (miss.length ? 'missing ' + miss.join(', ') : 'bust and waist') + '.' };
  }

  const N = need.neck / 1.04;
  const NW = need.napeWaist;
  const SdL = need.sideLen;
  const AD = Math.max(12, NW - SdL);
  const nw = N / K.neckWidthDiv - K.neckWidthLess;
  const SL = need.shoulderLen;
  const half = (Bu + eB) / 2;
  const xb = half / 2 - K.sideSplit;
  const xf = half / 2 + K.sideSplit;
  // The bust dart by angle: GOWN_DRAFT.bustDartDegrees for a B cup, scaled by her cup.
  const dAng = (clamp((K.bustDartDegrees * (Bu - UB)) / K.bustDartCupCm, 6, 40) * Math.PI) / 180;
  const bustDart = clamp(2 * Math.max(4, xf - need.apexApex / 2 - K.dartStop) * Math.sin(dAng / 2), 1, 12);
  const tW = (W + eW) / 4;
  const tB = tW - K.sideSplit;
  const tF = tW + K.sideSplit;
  const supp = (x: number, t: number) => Math.min(K.sideShapeMax, Math.max(0, (x - t) * 0.4));

  // Back: centre back at x = 0, nape at y = 0, y down.
  const dB = AD / K.slopeDiv - K.backSlopeLess;
  const hpsB: GownPoint = [nw, -K.backRise];
  const tipB: GownPoint = [nw + Math.sqrt(Math.max(1, (SL + K.backDartWidth) ** 2 - dB * dB)), -K.backRise + dB];
  const bw: GownPoint = [need.acrossBack / 2 + K.widthEase, 0.4 * AD];
  const ua: GownPoint = [xb, AD];
  const sB = supp(xb, tB);
  const wB: GownPoint = [Math.max(xb - sB, tB), NW];
  const dartB = Math.max(0, xb - sB - tB);
  const dcB = bw[0] / 2;
  const backO: GownPoint[] = [
    [0, 0],
    ...curve([0, 0], [nw * 0.7, 0], hpsB, 6),
    tipB,
    ...curve(tipB, [bw[0], bw[1] * 0.6], bw, 5),
    ...curve(bw, [bw[0] + 0.2, AD - 0.5], ua, 6),
    wB,
    [0, NW],
  ];
  const sm: GownPoint = [(hpsB[0] + tipB[0]) / 2, (hpsB[1] + tipB[1]) / 2];
  const halfDart = K.backDartWidth / 2;
  const back: GownBlockPiece = {
    name: 'Bodice back',
    cut: 'Cut 2',
    outline: toMm(backO),
    darts: [
      ...(dartB > 0 ? [{ a: [c(dcB - dartB / 2), c(NW)] as const, apex: [c(dcB), c(AD + 2)] as const, b: [c(dcB + dartB / 2), c(NW)] as const }] : []),
      {
        a: [c(sm[0] - halfDart), c(sm[1] + 0.1)] as const,
        apex: [c(sm[0] + 0.3), c(sm[1] + K.backDartLength)] as const,
        b: [c(sm[0] + halfDart), c(sm[1] - 0.1)] as const,
      },
    ],
    marks: [[c(xb), c(AD), 'underarm']],
    points: [],
    grain: [
      [c(dcB + 3), c(AD + 4)],
      [c(dcB + 3), c(NW - 3)],
    ],
    vent: 0,
  };

  // Front: centre front at x = 0, the same underarm line. The side seam carries the bust dart, so the front waist sits
  // lower by the dart.
  const yWf = AD + SdL + bustDart;
  const dx = need.apexApex / 2 - nw;
  const yHf = yWf - (need.frontLen - need.shoulderApex) - Math.sqrt(Math.max(1, need.shoulderApex ** 2 - dx * dx));
  const BP: GownPoint = [need.apexApex / 2, yWf - (need.frontLen - need.shoulderApex)];
  const dF = AD / K.slopeDiv + K.frontSlopeAdd;
  const hpsF: GownPoint = [nw, yHf];
  const cfN: GownPoint = [0, yHf + N / K.neckWidthDiv + K.frontDepthAdd];
  const tipF: GownPoint = [nw + Math.sqrt(Math.max(1, SL * SL - dF * dF)), yHf + dF];
  const cw: GownPoint = [need.acrossChest / 2 + K.widthEase, cfN[1] + 7];
  const uf: GownPoint = [xf, AD];
  const sF = supp(xf, tF);
  // A waist wider than the bust: the side seam flares out to it.
  const dartF = Math.max(0, xf - sF - tF);
  const d1: GownPoint = [xf, AD + 3];
  const d2: GownPoint = [xf, AD + 3 + bustDart];
  const wF: GownPoint = [Math.max(xf - sF, tF), yWf];
  const apexS: GownPoint = [BP[0] + K.dartStop, BP[1]];
  const frontO: GownPoint[] = [
    cfN,
    ...curve(cfN, [nw * 0.9, cfN[1] - 0.2], hpsF, 6),
    tipF,
    ...curve(tipF, [cw[0], cw[1] * 0.85 + tipF[1] * 0.15], cw, 5),
    ...curve(cw, [cw[0] + 0.3, AD - 0.3], uf, 6),
    d1,
    apexS,
    d2,
    wF,
    [0, yWf],
  ];
  const front: GownBlockPiece = {
    name: 'Bodice front',
    cut: 'Cut 1 on the fold',
    outline: toMm(frontO),
    darts:
      dartF > 0
        ? [{ a: [c(BP[0] - dartF / 2), c(yWf)] as const, apex: [c(BP[0]), c(BP[1] + K.dartStop)] as const, b: [c(BP[0] + dartF / 2), c(yWf)] as const }]
        : [],
    marks: [[c(xf), c(AD), 'underarm']],
    points: [[c(BP[0]), c(BP[1]), 'bust point']],
    grain: [
      [c(BP[0] * 0.5), c(BP[1] + 3)],
      [c(BP[0] * 0.5), c(yWf - 3)],
    ],
    vent: 0,
  };

  const shB = len(hpsB, tipB) - K.backDartWidth;
  const shF = len(hpsF, tipF);
  const sideB = len(ua, wB);
  const sideF = len(uf, d1) + len(d2, wF);
  const checks: GownDraftCheck[] = [
    ['Bust round (front + back, × 2)', Bu + eB, 2 * (xb + xf)],
    ['Waist after darts (× 2)', W + eW, 2 * (wB[0] - dartB + (wF[0] - dartF))],
    ['Centre back, nape to waist', NW, NW],
    ['Front length, neck point over bust to waist', need.frontLen, len(hpsF, BP) + (yWf - BP[1])],
    ['Shoulder to bust point', need.shoulderApex, len(hpsF, BP)],
    ['Bust point to bust point', need.apexApex, 2 * BP[0]],
    ['Side seams, back / front (dart closed)', sideB, sideF],
    ['Shoulder seams, back (dart closed) / front', shB, shF],
  ];
  return { ok: true, pieces: [back, front], checks, src, est: Object.values(src).includes('estimate'), bustDart, AD };
}
