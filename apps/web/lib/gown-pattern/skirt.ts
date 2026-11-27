/**
 * 👗 gown-pattern/skirt — the skirt starting blocks (plan step B6; prototype v180 `draftSkirt`). Pure geometry.
 *
 * Units: mm on the block, x across (centre to side), y down from the waist. Front ("cut 1 on the fold") and back
 * ("cut 2") quarter panels, or a full circle in four quarters for a ball gown. Net: no seam allowance (step B11).
 *   · Sheath: waist to hip shaped by the side seam (up to 2.5 cm a side) and darts, straight to the hem, back vent.
 *   · A-line and Filipiniana saya: the same top, flaring from the hip; the hem rises at the side so every seam is
 *     the same length.
 *   · Mermaid: hip → thigh (0.92 × hip quarter, 6 % of her height below the hip line) → knee (1.9 × knee + 4 cm
 *     round both knees) at a third of her height below the waist; the flare gets exactly the length left.
 *   · Ball gown: a full circle, waist radius = (waist + ease) ÷ 2π.
 * Each draft carries a check table (asked against drawn) and the source of every number. No prices on any block.
 * 🔒 lib/gown-pattern/pattern.test.ts (held to the prototype's own outputs, prototype-v189.golden.json)
 */
import type { GownSilhouette } from '../gown-config';
import { draftEase, draftMeasure, type GownDraftOrder, type GownDraftSource, type GownTape } from './inputs';

export type GownPoint = readonly [number, number];
/** A waist dart from the top edge (skirt) or a dart drawn by its three points (bodice). */
export type GownDart = { x: number; w: number; len: number } | { a: GownPoint; apex: GownPoint; b: GownPoint };
export type GownMark = readonly [number, number, string];

export type GownBlockPiece = {
  name: string;
  cut: string;
  outline: GownPoint[];
  darts: GownDart[];
  /** Horizontal guide lines (hip line, underarm line): [x end, y, label]. */
  marks: GownMark[];
  /** Points marked with a cross (bust point). */
  points: GownMark[];
  grain: [GownPoint, GownPoint];
  /** Back vent length at the hem, mm (sheath back only). */
  vent: number;
  /** The side seam, waist to hem (skirt quarter panels only). */
  side?: GownPoint[];
  /** Where the label sits, mm from the top (set by the sheet). */
  labelY?: number;
};

/** One check: [what, asked cm, drawn cm]. Drawn more than 2.5 mm off the asked is a fault. */
export type GownDraftCheck = readonly [string, number, number];

export type GownSkirtDraft = {
  ok: true;
  sil: GownSilhouette;
  pieces: GownBlockPiece[];
  checks: GownDraftCheck[];
  src: Record<string, GownDraftSource>;
  /** True when any input is a 3D estimate: the sheet prints "ESTIMATE: measure before cutting". */
  est: boolean;
  note: string;
};
export type GownDraftRefusal = { ok: false; error: string };

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mm = (cm: number) => cm * 10;

export function draftSkirt(order: GownDraftOrder, tape: GownTape = {}): GownSkirtDraft | GownDraftRefusal {
  const v = order.vals;
  const sil = order.sil;
  const H = (v.height ?? 0) > 0 ? (v.height as number) : 155;
  const W = v.waist ?? 0;
  const Hp = v.hips ?? 0;
  const eW = draftEase(order, 'Waist') ?? 1.5;
  const eH = draftEase(order, 'Hips') ?? (sil === 'sheath' ? 3 : sil === 'mermaid' ? 2 : 6);
  const [wh, whS] = draftMeasure(order, tape, 'waistHip');
  const [Lf, LfS] = draftMeasure(order, tape, 'waistFloor');
  const [Lh, LhS] = draftMeasure(order, tape, 'waistHem');
  const toFloor = order.hem === 'floor' || !(Lh > 0);
  const L = toFloor ? Lf : Lh;
  const LS = toFloor ? LfS : LhS;
  const src: Record<string, GownDraftSource> = { waist: 'body', hips: 'body', waistHip: whS, length: LS };
  const est = Object.values(src).includes('estimate');
  if (!(W > 0 && Hp > 0 && wh > 5 && L > 20)) {
    return {
      ok: false,
      error: `Can't draft: check ${!(wh > 5) ? 'waist to hip' : !(L > 20) ? 'the length (waist to floor or waist to hem)' : 'waist and hips'}.`,
    };
  }
  const Wq = (W + eW) / 4;
  const Hq = (Hp + eH) / 4;
  const WH = mm(wh);
  const LL = mm(L);
  const checks: GownDraftCheck[] = [];

  if (sil === 'ball') {
    const r = mm((W + eW) / (2 * Math.PI));
    const R = r + LL;
    const arc = (rad: number, n = 24): GownPoint[] =>
      Array.from({ length: n + 1 }, (_, i) => {
        const a = ((Math.PI / 2) * i) / n;
        return [rad * Math.sin(a), rad * Math.cos(a)] as const;
      });
    const piece: GownBlockPiece = {
      name: 'Skirt, quarter circle',
      cut: 'Cut 4 (or 2 half circles on the fold)',
      outline: [...arc(r), ...arc(R).reverse()],
      darts: [],
      marks: [],
      points: [],
      grain: [
        [R * 0.35, R * 0.35],
        [R * 0.6, R * 0.6],
      ],
      vent: 0,
    };
    checks.push(['Waist seam (4 quarters)', W + eW, ((4 * Math.PI) / 2) * r / 10], ['Length (centre)', L, (R - r) / 10]);
    return {
      ok: true,
      sil,
      pieces: [piece],
      checks,
      src,
      est,
      note: 'Ball gown: one circle skirt. For a gathered skirt instead, cut straight panels 2–3 × the waist wide.',
    };
  }

  // Waist to hip: half the difference at the side seam (up to 2.5 cm), the rest in darts (front up to 2.5 cm).
  const D = Hq - Wq;
  const sd = clamp(D * 0.5, 0, 2.5);
  const rem = Math.max(0, D - sd);
  const fd = Math.min(0.8 * rem, 2.5);
  const bd = Math.max(0, 2 * rem - fd);

  const make = (front: boolean): GownBlockPiece => {
    const dt = front ? fd : bd;
    const n = front ? (dt > 0 ? 1 : 0) : dt > 3 ? 2 : dt > 0 ? 1 : 0;
    const top = mm(D >= 0 ? Hq - sd : Wq);
    const hipX = mm(Hq);
    const dlen = mm(front ? 9 : 13);
    const darts: GownDart[] = [];
    for (let i = 0; i < n; i++) {
      darts.push({ x: Math.round((top * (i + 1)) / (n + 1)), w: mm(dt / n), len: Math.min(dlen, WH - 20) });
    }
    // A soft hip curve, fullest at the hip line.
    const side: GownPoint[] = [[top, 0]];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      side.push([Math.round(top + (hipX - top) * Math.sin((Math.PI / 2) * t)), Math.round(WH * t)]);
    }
    let hemPts: GownPoint[];
    if (sil === 'sheath') {
      side.push([hipX, LL]);
      hemPts = [[0, LL]];
    } else if (sil === 'mermaid') {
      const yT = WH + mm(0.06 * H);
      const yK = Math.max(yT + 50, mm(0.33 * H));
      const [kn] = draftMeasure(order, tape, 'knee');
      const Kq = kn > 0 ? mm((1.9 * kn + 4) / 4) : mm(Hq * 0.72);
      const Tq = mm(Hq * 0.92);
      const hemQ = Kq + Math.round((LL - yK) * 0.45);
      side.push([Tq, yT], [Kq, yK]);
      let sofar = 0;
      for (let i = 1; i < side.length; i++) sofar += Math.hypot(side[i]![0] - side[i - 1]![0], side[i]![1] - side[i - 1]![1]);
      // The flare gets exactly the length left, so the side seam equals the centre.
      const sl = Math.hypot(hemQ - Kq, LL - yK);
      const k2 = (LL - sofar) / sl;
      const ex = Math.round(Kq + (hemQ - Kq) * k2);
      const endY = yK + (LL - yK) * k2;
      side.push([ex, Math.round(endY)]);
      hemPts = [
        [Math.round(ex * 0.5), LL - Math.round((LL - endY) * 0.25)],
        [0, LL],
      ];
    } else {
      // A-line and the Filipiniana saya: the hem curves up at the side so every seam is the same length.
      const hemQ = hipX + Math.round((LL - WH) * 0.35);
      const sl = Math.hypot(hemQ - hipX, LL - WH);
      const k2 = (LL - WH) / sl;
      const ex = Math.round(hipX + (hemQ - hipX) * k2);
      const endY = WH + (LL - WH) * k2;
      side.push([ex, Math.round(endY)]);
      hemPts = [
        [Math.round(ex * 0.55), LL - Math.round((LL - endY) * 0.2)],
        [0, LL],
      ];
    }
    return {
      side,
      name: front ? 'Skirt front' : 'Skirt back',
      cut: front ? 'Cut 1 on the fold' : 'Cut 2',
      outline: [[0, 0], ...side, ...hemPts],
      darts,
      marks: [[hipX, WH, 'hip']],
      points: [],
      grain: [
        [Math.round(hipX * 0.4), WH + 40],
        [Math.round(hipX * 0.4), Math.min(LL - 60, WH + 400)],
      ],
      vent: !front && sil === 'sheath' ? mm(20) : 0,
    };
  };

  const F = make(true);
  const Bk = make(false);
  const waistOf = (p: GownBlockPiece) => (p.outline[1]![0] - p.darts.reduce((a, d) => a + ('w' in d ? d.w : 0), 0)) / 10;
  const sideLen = (p: GownBlockPiece) => {
    const q = p.side ?? [];
    let s = 0;
    for (let i = 1; i < q.length; i++) s += Math.hypot(q[i]![0] - q[i - 1]![0], q[i]![1] - q[i - 1]![1]);
    return s / 10;
  };
  checks.push(
    ['Waist seam (front + back, × 2)', W + eW, 2 * (waistOf(F) + waistOf(Bk))],
    ['Hip line (× 4)', Hp + eH, (4 * F.marks[0]![0]) / 10],
    ['Side seams front / back', sideLen(F), sideLen(Bk)],
    ['Side seam / centre length', L, sideLen(F)],
    ['Length (centre)', L, LL / 10],
  );
  return {
    ok: true,
    sil,
    pieces: [F, Bk],
    checks,
    src,
    est,
    note: D < 0 ? 'Her waist is larger than her hips: no darts, the side seam runs in to the hip.' : '',
  };
}
