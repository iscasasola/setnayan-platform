/**
 * 👗 gown/dress/lines — the gown's own lines on her body (prototype v189 `SIL`, `TRAIN_CM`, `trainW`, `hemPreset`,
 * `neckTop`, `neckFront`, `waistY`). Women only: the collar and the men's lines are not ported.
 */
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import { smoothstep } from '../body/rig';
import type { GownBack, GownConfig, GownHem, GownNeckline, GownSilhouette, GownTrain, GownVeil, GownWaistline } from '../../gown-config';

const N = RING_N, DTH = TAU / N;

/** How each line hangs: hem circumference as a share of the hip at floor length, how fast a close line may draw in, and its folds. */
export const GOWN_SIL: Record<GownSilhouette, { ratio?: number; fold: number; hang?: number }> = {
  aline: { ratio: 2.0, fold: 0.055 },
  ball: { ratio: 4.5, fold: 0.07 },
  mermaid: { ratio: 2.2, fold: 0.05, hang: 0.3 },
  sheath: { hang: 0.08, fold: 0.012 },
  terno: { ratio: 1.7, fold: 0.045 },
};

/** A train's usual length past the hem, on the floor (cm). */
export const GOWN_TRAIN_CM: Record<GownTrain, number> = { none: 0, sweep: 30, chapel: 120, cathedral: 210 };

/** A veil's usual run on the floor past her heel (cm): fingertip ends at the fingertips. */
export const GOWN_VEIL_CM: Record<Exclude<GownVeil, 'none'>, number> = { fingertip: 0, chapel: 140, cathedral: 240 };

/** The cloth's ease over the skin at the bodice (mm). */
export const GOWN_EASE_MM = 7;

/** How much of the train each direction carries: all at centre back, none at the front. */
export const trainShare = (ph: number) => Math.pow(Math.max(0, (0.25 - Math.cos(ph)) / 1.25), 1.6);

/** A length preset's hem height (model units): knee, tea (55 % of the way from knee to ankle) or the floor. */
export function hemPreset(B: GownRig, floorY: number, h: GownHem): number {
  const nt = B.neutral;
  return h === 'knee' ? nt.knee - 0.035 : h === 'midi' ? nt.knee - (nt.knee - nt.ankle) * 0.55 : floorY + 0.018;
}
/** A preset as cm above the floor, for this body (the length slider's snaps). */
export const hemCmOf = (B: GownRig, floorY: number, h: GownHem) => (hemPreset(B, floorY, h) - floorY) * B.P.S * 100;

/** Her landmarks the neckline reads (model units), measured by the dress build each time. */
export type GownNeckLandmarks = {
  /** Bust point height, the cup's fullness, the direction of each breast. */
  yA: number; cup: number; front: number;
  /** Neck joint, shoulder joint, natural waist, the underbust fold. */
  yN: number; ySh: number; yW: number; yUB: number;
  /** The front's highest and lowest; the back's highest and lowest. */
  fTop: number; fLow: number; bTop: number; bLow: number;
};

type NeckDesign = { neck: GownNeckline; neckT: number | null; back: GownBack; backT: number };

/** The neckline in front, for each direction ph (0 = centre front, π = centre back). */
export function neckFront(d: NeckDesign, ph: number, L: GownNeckLandmarks): number {
  const { yA, yN, ySh, cup, front } = L;
  switch (d.neck) {
    case 'v': {
      const PS = 1.32, yV = yA + 0.02, yS = yN + 0.012;
      return ph <= PS ? yV + ((yS - yV) * ph) / PS : yS - (yS - (yA + 0.13)) * smoothstep(ph, PS + 0.1, Math.PI);
    }
    case 'high':
      return yN + 0.05 - 0.008 * Math.exp(-((ph / 0.5) ** 2));
    case 'bateau':
      return yN - 0.022 + 0.014 * Math.pow(Math.sin(ph), 2) - 0.004 * smoothstep(ph, 2, Math.PI);
    case 'off':
      return Math.min(ySh - 0.012, yA + 0.095) - 0.01 * Math.exp(-((ph / 0.4) ** 2));
    default: {
      const dd = (ph - front) / 0.42;
      return yA + (0.034 + 0.03 * Math.exp(-dd * dd)) * cup - 0.03 * smoothstep(ph, 1.25, 2.3);
    }
  }
}

/** The bodice's top edge: the neckline in front, the chosen back behind, blended across the side seam. */
export function neckTop(d: NeckDesign, ph: number, L: GownNeckLandmarks): number {
  let f = neckFront(d, ph, L);
  if (d.neckT !== null && ph < 1.6) {
    // Front depth: from up at the collarbone to a plunge just above the waist (V), or a scoop for the others.
    const c0 = neckFront(d, 0, L), yc = L.fTop + (L.fLow - L.fTop) * d.neckT, V = d.neck === 'v', raise = V || d.neck === 'sweetheart';
    const dl = raise ? yc - c0 : Math.min(0, yc - c0), sh = V ? Math.max(0, 1 - ph / 1.32) : Math.exp(-((ph / 0.6) ** 2));
    f += dl * sh;
  }
  if (ph < 1.6) return f;
  // Back depth: nape to the top of the tailbone.
  const side = neckFront(d, 1.6, L), yB = d.back === 'closed' ? side : Math.min(side, L.bTop + (L.bLow - L.bTop) * d.backT);
  const t = d.back === 'v' ? Math.min(1, Math.max(0, (ph - 1.8) / (Math.PI - 1.8))) : smoothstep(ph, 1.8, 2.6);
  const y = side + (yB - side) * t, w = smoothstep(ph, 1.6, 1.85);
  return f * (1 - w) + Math.min(y, Math.max(f, y)) * w;
}

/** Where the bodice ends and the skirt begins, per direction round her (q = 0 front, N/2 back). */
export function waistY(B: GownRig, waist: GownWaistline, q: number): number {
  const cm = 0.01 / B.P.S, yW = BODY_K.yWaist, ph = q * DTH > Math.PI ? q * DTH - TAU : q * DTH, c = Math.cos(ph);
  switch (waist) {
    case 'empire': return BODY_K.ubY - 1.5 * cm;
    case 'dropped': return yW - 8 * cm;
    case 'basque': return yW - 2 * cm - 11 * cm * Math.max(0, 1 - Math.abs(ph) / 1.05); // a V to a point at centre front
    case 'basqueU': return yW - 2 * cm - 10 * cm * Math.pow(Math.max(0, c), 1.6); // a softer U
    default: return yW;
  }
}

/** The design keys the dress build reads. */
export type GownDressDesign = Pick<GownConfig, 'neck' | 'neckT' | 'back' | 'backT' | 'sil' | 'waist' | 'petti' | 'train' | 'slits' | 'slitCm' | 'boning' | 'hem' | 'hemCm' | 'pleat' | 'pleatN' | 'pleatCm' | 'skirtLayers' | 'fabric'>;
