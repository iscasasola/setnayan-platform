/**
 * 👗 gown/dress/lines — the gown's own lines on her body (prototype v189 `SIL`, `TRAIN_CM`, `trainW`, `hemPreset`,
 * `neckTop`, `neckFront`, `waistY`). Women only: the collar and the men's lines are not ported.
 */
import { BODY_K, RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import { smoothstep } from '../body/rig';
import type { GownBack, GownConfig, GownHem, GownNeckline, GownPetticoat, GownSilhouette, GownTrain, GownVeil, GownWaistline } from '../../gown-config';
import { GOWN_STRAPLESS, type GownIllusionBack, type GownIllusionCups, type GownIllusion } from '../../gown-config';

const N = RING_N, DTH = TAU / N;

/**
 * How each line hangs: hem circumference as a share of the hip at floor length, how fast a close line may draw in, its
 * folds; `waist` for skirts that start at the waistline, `ease` (cm) for a skirt that skims the hip with that much room.
 * Accuracy review (owner, 27 Nov; v197): the A-line and the Filipiniana saya leave the body at the waistline, skim the
 * hip with about 10 cm of ease and open to about 3 × hips at the hem; the old hip-hugging shape is Fit and flare.
 */
export const GOWN_SIL: Record<GownSilhouette, { ratio?: number; fold: number; hang?: number; waist?: boolean; ease?: number }> = {
  aline: { ratio: 3.0, fold: 0.055, waist: true, ease: 10 },
  fitflare: { ratio: 2.0, fold: 0.055 },
  ball: { ratio: 4.5, fold: 0.07, waist: true },
  mermaid: { ratio: 2.2, fold: 0.05, hang: 0.3 },
  sheath: { hang: 0.08, fold: 0.012 },
  terno: { ratio: 3.0, fold: 0.045, waist: true, ease: 10 },
};
/** Skirts that start at the waistline (ball gown, A-line, Filipiniana) rather than at the hip (v197 `fromWaist`). */
export const gownFromWaist = (s: GownSilhouette) => !!GOWN_SIL[s]?.waist;
/** A ball skirt's hem comes from its petticoat or hoop (cm round), never below 2.5 × hips (v197 `BALL_HEM`). */
export const GOWN_BALL_HEM_CM: Record<GownPetticoat, number> = { none: 0, soft: 320, full: 380, hoop: 420 };

/** A train's usual length past the hem, on the floor (cm). */
export const GOWN_TRAIN_CM: Record<GownTrain, number> = { none: 0, sweep: 30, chapel: 120, cathedral: 210 };

/**
 * A long veil's length from the crown, as shops sell it (cm) (v197 `VEIL_CM`; chapel about 230, cathedral 275–305).
 * Elbow, fingertip and floor end where their names say.
 */
export const GOWN_VEIL_CM: Record<'chapel' | 'cathedral', number> = { chapel: 230, cathedral: 290 };
/** Chapel and cathedral run on along the floor (v197 `VEIL_LONG`); a floor veil touches it (`VEIL_FLOOR`). */
export const gownVeilLong = (v: GownVeil): v is 'chapel' | 'cathedral' => v === 'chapel' || v === 'cathedral';
export const gownVeilFloor = (v: GownVeil) => v === 'floor' || gownVeilLong(v);

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
  /** One centimetre in model units (v197 `L.cm`). */
  cm: number;
};

export type NeckDesign = { neck: GownNeckline; neckT: number | null; back: GownBack; backT: number; illuBack?: GownIllusionBack };
/** An illusion back holds a strapless bodice up, so its back may go below the bra line (v198 `illuLiftsBackCap`). */
export const gownIlluLiftsBackCap = (d: Partial<Pick<NeckDesign, 'neck' | 'back' | 'illuBack'>>) => d.illuBack === 'on' && d.back !== 'closed' && !!d.neck && GOWN_STRAPLESS.includes(d.neck);

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
    case 'bateau': {
      // Accuracy review (v197): wide and shallow, out along the shoulder ridge (not a round jewel neck).
      const c = yN - 0.024 - 0.004 * smoothstep(ph, 2, Math.PI), sx = Math.min(ySh + 0.022, c);
      return c + (sx - c) * Math.pow(Math.sin(ph), 1.6);
    }
    case 'straight':
      // Strapless, straight across at the top of the cups (v197).
      return yA + 0.058 * cup - 0.03 * smoothstep(ph, 1.25, 2.3);
    case 'off':
      return Math.min(ySh - 0.012, yA + 0.095) - 0.01 * Math.exp(-((ph / 0.4) ** 2));
    default: {
      const dd = (ph - front) / 0.42;
      return yA + (0.034 + 0.03 * Math.exp(-dd * dd)) * cup - 0.03 * smoothstep(ph, 1.25, 2.3);
    }
  }
}

/** The sweetheart's own depth on its bar (0 = straight across at the top of the cups) (v197 `sweetDepth`). */
export function gownSweetDepth(d: NeckDesign, L: GownNeckLandmarks): { cH: number; tOwn: number } {
  const cH = neckFront(d, L.front, L), c0 = neckFront(d, 0, L);
  return { cH, tOwn: Math.min(0.9, Math.max(0.02, (cH - c0) / Math.max(1e-4, cH - L.fLow))) };
}
/** A strapless bodice grips round at the bra line: its back may not be cut lower (v197 `backLimitY`). */
export const gownBackLimitY = (d: Pick<NeckDesign, 'neck'> & Partial<Pick<NeckDesign, 'back' | 'illuBack'>>, L: GownNeckLandmarks) =>
  GOWN_STRAPLESS.includes(d.neck) && L.yUB && !gownIlluLiftsBackCap(d) ? L.yUB + 1.5 * L.cm : -1e9; // v198: an illusion back lifts it
/** V: straight sides to a point; scoop: a rounded U (v197 `backD`). */
const backD = (b: GownBack, ph: number) => { const sv = Math.min(1, Math.max(0, (Math.PI - ph) / (Math.PI - 1.8))); return b === 'v' ? 1 - sv : Math.sqrt(Math.max(0, 1 - sv * sv)); };

/** The bodice's top edge: the neckline in front, the chosen back behind, blended across the side seam. */
export function neckTop(d: NeckDesign, ph: number, L: GownNeckLandmarks): number {
  let f = neckFront(d, ph, L);
  if (d.neckT !== null && ph < 1.6) {
    const c0 = neckFront(d, 0, L), V = d.neck === 'v';
    if (d.neck === 'sweetheart') {
      // Accuracy review (v197): the sweetheart's bar runs from straight across (no point rising to the throat) down to a plunge.
      const sw = gownSweetDepth(d, L), t = d.neckT;
      if (t >= sw.tOwn) f += (sw.cH + (L.fLow - sw.cH) * t - c0) * Math.exp(-((ph / 0.6) ** 2));
      else { const w = 1 - t / sw.tOwn, flat = sw.cH + (f - sw.cH) * smoothstep(ph, 0.9, 1.6); f = f * (1 - w) + flat * w; }
    } else {
      // Front depth: from up at the collarbone to a plunge just above the waist (V), or a scoop for the others.
      const yc = L.fTop + (L.fLow - L.fTop) * d.neckT, dl = V ? yc - c0 : Math.min(0, yc - c0), sh = V ? Math.max(0, 1 - ph / 1.32) : Math.exp(-((ph / 0.6) ** 2));
      f += dl * sh;
    }
  }
  if (ph < 1.6) return f;
  // Back depth: nape to the top of the tailbone. A high neck stays closed at the nape (its opening is a keyhole below);
  // a strapless back stops at the bra line (v197).
  const side = neckFront(d, 1.6, L), b: GownBack = d.neck === 'high' && d.back !== 'closed' ? 'closed' : d.back;
  const yB = b === 'closed' ? side : Math.max(Math.min(side, L.bTop + (L.bLow - L.bTop) * d.backT), gownBackLimitY(d, L));
  const t = backD(b, ph);
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
export type GownDressDesign = Pick<GownConfig, 'neck' | 'neckT' | 'back' | 'backT' | 'sil' | 'waist' | 'petti' | 'train' | 'slits' | 'slitCm' | 'boning' | 'hem' | 'hemCm' | 'pleat' | 'pleatN' | 'pleatCm' | 'skirtLayers' | 'fabric' | 'bustle' | 'shape' | 'illu' | 'illuBase' | 'illuBack'>;

/**
 * A high neck with an open back stays closed at the nape: a band with one covered button, and the chosen scoop or V
 * opens below it as a keyhole (v197 `keyholeBack`). Null otherwise, or when the opening would not clear the band.
 * `top` is the bodice's top edge at the centre back; `poly` the hole's outline (direction, height) for the cut map.
 */
export function gownKeyholeBack(d: NeckDesign, topBack: number, L: GownNeckLandmarks): { yBand: number; yB: number; poly: [number, number][] } | null {
  if (d.neck !== 'high' || d.back === 'closed') return null;
  const side = neckFront(d, 1.6, L), yB = Math.min(side, L.bTop + (L.bLow - L.bTop) * d.backT), yBand = topBack - 3.5 * L.cm;
  if (yB > yBand - 2 * L.cm) return null;
  const lo: [number, number][] = [], n = 40;
  for (let i = 0; i <= n; i++) { const ph = Math.PI - 1.34 + (2.68 * i) / n, p2 = ph > Math.PI ? TAU - ph : ph, y = side + (yB - side) * backD(d.back, p2); lo.push([ph, Math.min(y, yBand)]); }
  return { yBand, yB, poly: [...lo, [Math.PI + 1.34, yBand], [Math.PI - 1.34, yBand]] };
}

/**
 * The deepest a strapless back may be cut on her, on the back's own bar (v197 `backCapT`; 1 when it is not strapless,
 * or (v198) an illusion back holds it up).
 */
export function gownBackCapT(d: Pick<NeckDesign, 'neck'> & Partial<Pick<NeckDesign, 'back' | 'illuBack'>>, L: GownNeckLandmarks | null): number {
  if (!L || !GOWN_STRAPLESS.includes(d.neck) || gownIlluLiftsBackCap(d)) return 1;
  const y = gownBackLimitY(d, L);
  return Math.min(1, Math.max(0, (L.bTop - y) / Math.max(1e-4, L.bTop - L.bLow)));
}

/** The lined cups' top edge for each direction (ph 0 = centre front, π = centre back) (v198 `illuBaseY`). */
export function gownIlluBaseY(base: GownIllusionCups, ph: number, L: GownNeckLandmarks): number {
  const { yA, cup, front } = L, d = (ph - front) / 0.42, back = 0.03 * smoothstep(ph, 1.25, 2.3), sw = yA + (0.034 + 0.03 * Math.exp(-d * d)) * cup - back;
  if (base === 'straight') return yA + cup * (0.034 + 0.016 * (1 - smoothstep(ph, 1.0, 1.6))) - back;
  if (base === 'plunge') {
    const yP = Math.min(sw - 0.02, Math.max(L.yW + 0.06, (L.yUB || L.yW + 0.08) - 0.05)), f = Math.pow(Math.min(1, Math.max(0, 1 - ph / (front * 0.9))), 0.9);
    return sw - (sw - yP) * f;
  }
  return sw;
}
/** A sheer corset: where each lined cup ends below (the cups meet in a point at the centre; at the side the cup closes up to the top edge) (v198 `illuCupBot`). */
export function gownIlluCupBot(base: GownIllusionCups, ph: number, L: GownNeckLandmarks, top: number): number {
  const cb = (L.yUB || L.yA - 0.06) - 0.004, inner = smoothstep(ph, 0, L.front * (base === 'plunge' ? 0.3 : 0.8)), outer = Math.pow(smoothstep(ph, L.front + 0.1, L.front + 1.2), 0.8);
  let y = top + (cb - top) * inner;
  y += (top - y) * outer;
  return Math.min(y, top);
}
/** v198's illusion choices the bodice's outline reads. */
export type GownIlluDesign = { illu: GownIllusion; illuBase: GownIllusionCups; illuBack: GownIllusionBack };
/**
 * The gown's top edge as cut: the sheer reaches it (v198 `illuOuterTop`). A strapless sweetheart with straight-across
 * cups runs straight; with an illusion back, the closed back line.
 */
export function gownIlluOuterTop(d: NeckDesign & GownIlluDesign, ph: number, L: GownNeckLandmarks): number {
  const t = neckTop(d, ph, L);
  if (d.illu !== 'none' && d.neck === 'sweetheart' && d.illuBase === 'straight' && ph < 1.6) return gownIlluBaseY('straight', ph, L);
  if (gownIlluBackOn(d) && ph >= 1.6) return Math.max(t, neckTop({ ...d, back: 'closed' }, ph, L));
  return t;
}
/** An illusion back is worn when it is on and the back is open (v198 `illuBackOn`). */
export const gownIlluBackOn = (d: Pick<NeckDesign, 'back'> & Pick<GownIlluDesign, 'illuBack'>) => d.illuBack === 'on' && d.back !== 'closed';
