/**
 * 👗 gown/body-rules — the bride's body numbers without 3D (plan step A2). Pure: no three.js, no DOM.
 *
 * Ported from the prototype `gown_maker_v186.html` (the approved drawing for behaviour):
 *   `IDEAL` (v182 height first) · `fineLim` (v164/v169/v185 limits) · `estKgW` and `fatPct` (v169/v173) · `braSize` (v170)
 *   · `CUP_MAX` (v185) · `HEEL_STOPS` and the bar snaps (v171) · the shoulder estimate (v167) · `shaped` (shapewear)
 *   · the measurement input rules (one number moves, the others stay inside her limits) · `measCheck` (the double-check note).
 * The weight balance that needs the body's volume (`balanceKg`, `fitBuild`, `bodyKg`) lands with the body in step A3.
 *
 * Owner rules held here: height first sets every number she has not given to the ideal for that height; a bigger bust
 * never grows the ribs (the bust stops at underbust + 28 cm); weight stays within BMI 10–62 for her height.
 * 🔒 lib/gown/body-rules.test.ts
 */
import {
  GOWN_BMI_MAX,
  GOWN_BMI_MIN,
  GOWN_BODY_RANGE,
  GOWN_CUP_MAX_CM,
  type GownBodyKey,
  type GownBodyVals,
  type GownBra,
  type GownShapewear,
} from '../gown-config';

/** Hip joint to floor, as a share of height (v186 `LEG_R`). `vals.leg` is a share of this. */
export const GOWN_LEG_SHARE = 0.525;
/** The mannequin's default arm, as a share of height (v186 `RANGE.female.arm` is 0.28–0.37 over 0.3). The body (A3) reads its own. */
export const GOWN_ARM_SHARE = 0.3;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** To the nearest half centimetre, as every number she sees. */
export const halfCm = (x: number) => Math.round(x * 2) / 2;

export type GownGirths = { bust: number; underbust: number; waist: number; hips: number };

/**
 * v182: the default figure (155 cm: bust 84, underbust 72, waist 68, hips 90) scaled by (height ÷ 155)^0.75, which keeps
 * her BMI about 21.5 at any height.
 */
export function gownIdeal(height: number): GownGirths {
  const r = Math.pow((height || 155) / 155, 0.75);
  const q = (x: number) => halfCm(x * r);
  return { bust: q(84), underbust: q(72), waist: q(68), hips: q(90) };
}

/**
 * The limits that follow her other numbers (v186 `fineLim`): bust 45–105 %, waist 34–115 %, hips 48–120 % of her height
 * inside the absolute range; the bust at most underbust + 28 cm and the underbust at least bust − 28 (v185, the ribs never
 * grow for the bust) and at most bust − 4; shoulders 21–28 % of height; weight BMI 10–62.
 */
export function gownLimit(vals: GownBodyVals, k: GownBodyKey, armShare = GOWN_ARM_SHARE): [number, number] {
  const H = vals.height;
  const [absLo, absHi] = GOWN_BODY_RANGE[k];
  switch (k) {
    case 'underbust':
      return [Math.max(absLo, vals.bust - GOWN_CUP_MAX_CM), vals.bust - 4];
    case 'shoulders':
      return [halfCm(H * 0.21), halfCm(H * 0.28)];
    case 'bust':
      return [Math.max(absLo, halfCm(H * 0.45)), Math.min(absHi, halfCm(H * 1.05), vals.underbust ? vals.underbust + GOWN_CUP_MAX_CM : Infinity)];
    case 'waist':
      return [Math.max(absLo, halfCm(H * 0.34)), Math.min(absHi, halfCm(H * 1.15))];
    case 'hips':
      return [Math.max(absLo, halfCm(H * 0.48)), Math.min(absHi, halfCm(H * 1.2))];
    case 'weight': {
      const h2 = (H / 100) ** 2;
      return [Math.max(absLo, Math.round(GOWN_BMI_MIN * h2)), Math.min(absHi, Math.round(GOWN_BMI_MAX * h2))];
    }
    case 'arm':
      return [0.28 / armShare, 0.37 / armShare];
    case 'leg':
      return [0.45 / GOWN_LEG_SHARE, 0.6 / GOWN_LEG_SHARE];
    default:
      return [absLo, absHi];
  }
}

export const gownBmi = (vals: Pick<GownBodyVals, 'weight' | 'height'>) => vals.weight / (vals.height / 100) ** 2;

/**
 * v169 `estKgW`: her weight from height, waist and hips (Nunes Filho et al. 2025, PLOS ONE e0316610, eq. EF3; about
 * ±3 kg). The BMI it implies is held to 10–62. Coefficients from a search summary: marked to verify against the paper.
 */
export function gownEstimateKg(vals: Pick<GownBodyVals, 'height' | 'waist' | 'hips'>): number {
  const h = vals.height / 100;
  return clamp(12.574 + 0.233 * vals.waist + 0.227 * vals.hips - 17.657 * h, GOWN_BMI_MIN, GOWN_BMI_MAX) * h * h;
}
/** v169: an athletic build weighs more at the same tape (muscle is denser than fat). The body's weight target. */
export const GOWN_ATHLETIC_KG = 1.07;

/** v173 `fatPct`: Relative Fat Mass for women (76 − 20 × height ÷ waist); about 10 points less when athletic. */
export function gownFatPercent(vals: Pick<GownBodyVals, 'height' | 'waist'>, athletic: boolean): number {
  return clamp(76 - (20 * vals.height) / Math.max(40, vals.waist) - (athletic ? 10 : 0), athletic ? 10 : 8, 65);
}

/** Shoulders as a share of her height until she gives them: v167 23 %, v189 24.5 % (owner-approved design review). */
export const GOWN_SHOULDER_SHARE = 0.245;

/** v167: until she gives them, shoulders follow her height and her ribcage, inside 21–28 % of her height. */
export function gownEstimateShoulders(vals: GownBodyVals, athletic: boolean): number {
  const [a, b] = gownLimit(vals, 'shoulders');
  return clamp(halfCm(GOWN_SHOULDER_SHARE * vals.height + 0.2 * ((vals.underbust || 72) - 72) + (athletic ? 1.5 : 0)), a, b);
}

export type GownBraSize = { eu: string; us: string; uk: string; small: boolean; big: boolean };
const CUPS_EU = ['AA', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const CUPS_US = ['AA', 'A', 'B', 'C', 'D', 'DD', 'DDD', 'G', 'H', 'I', 'J', 'K'];
const CUPS_UK = ['AA', 'A', 'B', 'C', 'D', 'DD', 'E', 'F', 'FF', 'G', 'GG', 'H'];

/**
 * v170: the bra that cups her breasts fully. EU/Asian band = underbust to the nearest 5 cm; one cup per 2 cm of bust over
 * underbust past 10 (AA 10–12, A 12–14 …, as Triumph charts it); US/UK converted the way store charts do (75 ↔ 34).
 */
export function gownBraSize(underbust: number, bust: number): GownBraSize | null {
  if (!(underbust > 0) || !(bust > underbust)) return null;
  const d = bust - underbust;
  const eu = Math.round(underbust / 5) * 5;
  const step = Math.floor((d - 10) / 2);
  const i = clamp(step, 0, CUPS_EU.length - 1);
  const us = Math.round(eu * 0.4 + 4);
  return { eu: `${eu}${CUPS_EU[i]}`, us: `${us}${CUPS_US[i]}`, uk: `${us}${CUPS_UK[i]}`, small: d < 10, big: step >= CUPS_EU.length };
}

/** The bra on her body record: exact only when she gave her underbust herself. */
export function gownBraOf(vals: GownBodyVals, given: readonly GownBodyKey[]): GownBra | null {
  const z = gownBraSize(vals.underbust, vals.bust);
  return z ? { eu: z.eu, us: z.us, uk: z.uk, exact: given.includes('underbust') } : null;
}

/** v170: the bra sentence under the bust. Words only; the numbers come from `gownBraSize`. */
export function gownBraNote(vals: GownBodyVals, given: readonly GownBodyKey[]): string {
  const z = gownBraSize(vals.underbust, vals.bust);
  if (!z) return '';
  const exact = given.includes('underbust');
  return (
    `Bra size for a full, smooth cup: ${exact ? '' : 'about '}${z.eu} (EU/Asian, as Triumph and Wacoal label it) · ${z.us} US · ${z.uk} UK.` +
    (z.small ? ' A very small cup: a soft or padded bra, or cups built into the gown.' : '') +
    (z.big ? ' Beyond most store sizes: a specialist fitter, or cups built into the gown.' : '') +
    (exact ? ' Brands differ: try it on, or ask for a fitting.' : ' Add her underbust in Fine-tune for an exact size.')
  );
}

/** v171: the heel bar snaps to Flat, 4, 7, 10 and 12 cm within 0.75 cm. */
export const GOWN_HEEL_STOPS = [0, 4, 7, 10, 12] as const;
export function gownSnapHeel(cm: number): number {
  for (const s of GOWN_HEEL_STOPS) if (Math.abs(cm - s) <= 0.75) return s;
  return cm;
}
/** v171: the bust position bar (−1 Higher … 0 Average … +1 Lower) snaps to the three within 0.12. */
export function gownSnapBustT(t: number): number {
  for (const s of [-1, 0, 1]) if (Math.abs(t - s) <= 0.12) return s;
  return clamp(t, -1, 1);
}
/** The bust position's name from the bar. */
export function gownBustPosition(t: number): 'high' | 'avg' | 'low' | 'custom' {
  return t === -1 ? 'high' : t === 0 ? 'avg' : t === 1 ? 'low' : 'custom';
}
/** v171 `inFrac`: centimetres as inches to the nearest quarter, written with ¼ ½ ¾ ("2¾"). */
export function gownInches(cm: number): string {
  const q = Math.round((cm / 2.54) * 4) / 4;
  const w = Math.floor(q);
  const fr = ['', '¼', '½', '¾'][Math.round((q - w) * 4)] ?? '';
  return `${w || !fr ? w : ''}${fr}`;
}

/** v186 `SHAPE`: the share each shapewear takes off waist, hips and underbust. */
const SHAPEWEAR: Record<GownShapewear, readonly [number, number, number]> = {
  none: [0, 0, 0],
  light: [0.03, 0.012, 0.02],
  firm: [0.05, 0.022, 0.035],
  corset: [0.06, 0.01, 0.02],
};
/** v186 `shaped`: her numbers in what she wears underneath (the gown is cut to these). */
export function gownShapedVals(vals: GownBodyVals, shape: GownShapewear): GownBodyVals {
  const s = SHAPEWEAR[shape];
  if (!s[0]) return vals;
  const out = { ...vals };
  out.waist = vals.waist - Math.min(6, vals.waist * s[0]);
  out.hips = Math.max(vals.hips - vals.hips * s[1], out.waist + 2);
  if (vals.underbust) out.underbust = vals.underbust - Math.min(3, vals.underbust * s[2]);
  out.bust = Math.max(vals.bust, (out.underbust || 0) + 4);
  return out;
}

/** "A big tummy always carries some hip with it" (v186: 8 cm for women). */
const WAIST_OVER_HIPS = 8;

/**
 * One number moves (v186 the measurement input handler, women). Returns her new numbers and the numbers she has given.
 *   · the number she sets becomes hers (`given`), and is kept through later changes;
 *   · height first: every girth she has not given goes to the ideal for the new height (v182), and shoulders she has not
 *     given stay the same share of her height (v166);
 *   · an underbust change moves shoulders she has not given by 0.2 cm per cm;
 *   · waist and hips keep each other believable; bust and underbust keep 4 cm apart;
 *   · then bust, underbust, waist, hips, shoulders (and weight, once she gave it) are held inside her limits.
 * The weight balance on the pause (v185 `balanceKg`) needs the body's volume and lands in A3.
 */
export function gownSetNumber(
  vals: GownBodyVals,
  given: readonly GownBodyKey[],
  key: GownBodyKey,
  value: number,
): { vals: GownBodyVals; given: GownBodyKey[] } {
  const v = { ...vals };
  const R = GOWN_BODY_RANGE;
  const g = given.includes(key) ? [...given] : [...given, key];
  const has = (k: GownBodyKey) => g.includes(k);
  const old = v[key];
  v[key] = value;
  if (key === 'underbust' && !has('shoulders')) v.shoulders = clamp(halfCm(v.shoulders + (v.underbust - old) * 0.2), R.shoulders[0], R.shoulders[1]);
  if (key === 'height') {
    const id = gownIdeal(v.height);
    for (const k of ['bust', 'underbust', 'waist', 'hips'] as const) if (!has(k)) v[k] = id[k];
    if (old > 0 && !has('shoulders')) v.shoulders = halfCm((v.shoulders * v.height) / old);
  }
  if (key === 'waist') v.hips = clamp(Math.max(v.hips, v.waist - WAIST_OVER_HIPS), R.hips[0], R.hips[1]);
  if (key === 'hips') v.waist = clamp(v.waist, Math.ceil(v.hips * 0.66), v.hips + WAIST_OVER_HIPS);
  if (key === 'waist') v.hips = Math.min(v.hips, Math.floor(v.waist / 0.66));
  if (key === 'bust') v.underbust = Math.min(v.underbust, v.bust - 4);
  if (key === 'underbust') v.bust = clamp(Math.max(v.bust, v.underbust + 4), R.bust[0], R.bust[1]);
  const order: GownBodyKey[] = [...(key === 'underbust' ? (['underbust', 'bust'] as const) : (['bust', 'underbust'] as const)), 'waist', 'hips', 'shoulders'];
  if (has('weight')) order.push('weight');
  for (const k of order) {
    const [a, b] = gownLimit(v, k);
    v[k] = clamp(v[k], a, b);
  }
  return { vals: v, given: g };
}

/**
 * v186 `measCheck`: a soft "double-check" note for unusual numbers, never a block. `reached` is what the mannequin
 * reached (from the body, A3) and `bodyKg` its weight; without them the notes that need the body are left out.
 */
export function gownDoubleCheck(
  vals: GownBodyVals,
  given: readonly GownBodyKey[],
  body: { reached?: Partial<GownGirths>; bodyKg?: number } = {},
): string {
  const out: string[] = [];
  const word = { bust: 'a bust', waist: 'a waist', hips: 'hips', underbust: 'an underbust' } as const;
  for (const k of ['bust', 'waist', 'hips', 'underbust'] as const) {
    const got = body.reached?.[k];
    if (!vals[k] || !(got && got > 0)) continue;
    if (Math.abs(got - vals[k]) > 1.5) out.push(`The mannequin can't quite reach ${word[k]} of ${Math.round(vals[k])} cm with her other numbers (it shows ${Math.round(got)} cm).`);
  }
  if (vals.waist > vals.bust + 25 && vals.waist > vals.hips + 25) out.push('Her waist is much bigger than both her bust and her hips.');
  if (vals.bust - vals.underbust >= GOWN_CUP_MAX_CM - 0.5) {
    out.push(`Bust ${vals.bust} cm is as full as a cup can be on an underbust of ${vals.underbust} cm. If her bust is bigger, set her underbust in Fine-tune first.`);
  } else if (vals.bust - vals.underbust > 22) out.push(`Bust ${vals.bust} cm over an underbust of ${vals.underbust} cm is a very full cup.`);
  if (given.includes('weight') && body.bodyKg && Math.abs(body.bodyKg - vals.weight) > 2) {
    out.push(`With these measurements the mannequin can't weigh ${vals.weight} kg (the closest is ${Math.round(body.bodyKg)} kg).`);
  }
  if (given.includes('weight') && vals.weight && vals.height) {
    const bmi = gownBmi(vals);
    if (bmi < 16 || bmi > 45) out.push(`A weight of ${vals.weight} kg at ${Math.round(vals.height)} cm is unusual.`);
  }
  return out.length ? `Double-check: ${out.join(' ')} Measure again if you can; the designer confirms at the fitting.` : '';
}
