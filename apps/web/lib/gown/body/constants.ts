/**
 * 👗 gown/body/constants — the body's tuning numbers, exactly as prototype v186 has them (model units = metres at the
 * mesh's own scale). Women only: the men's table is not ported. Owner, 27 Nov (v187): the trapezius fill (v177/v183
 * `TRAP`) is not ported: it built a hood with a step each side of the neck base; the body structure stays female. Changing one changes how every body is built; the
 * solver sweep in rig.test.ts pins the result.
 */

/** Tape slices: points round the body and the slice spacing (v186 `N`, `DY`). */
export const RING_N = 96;
export const SLICE_DY = 0.01;
export const TAU = Math.PI * 2;

/** v186 `K.female`: the bands the tape reads and the heights the girth profile is shaped at (bind pose). */
export const BODY_K = {
  hipBand: [1.02, 1.1] as const,
  waistBand: [1.19, 1.27] as const,
  belly: [0.95, 1.21, 1.39] as const,
  ubY: 1.39,
  bustBand: [1.42, 1.53] as const,
  yHip: 1.07,
  yWaist: 1.31,
  yUb: 1.39,
  yCh: 1.46,
  yChestTop: 1.52,
  yTop: 1.59,
  yNeck: 1.66,
  bmiRef: 18.4,
  acro: 0.115,
};

/** Head as a share of height (v186 `HEAD_R`). The leg share lives in body-rules (`GOWN_LEG_SHARE`). */
export const HEAD_SHARE = 1 / 7.5;

/** v171: the bust position, [slide, tilt] at Higher and Lower; anywhere between by the bar. */
export const BUST_POS = { high: [0.011, -0.12], low: [-0.009, 0.065] } as const;

/**
 * The mannequin weighs less than a woman with the same tape, so its volume is scaled up (v183: 1.12). v188 (owner's
 * design review): 1.25, because at 1.12 the weight fit made the limbs about 20 % too thick; the default body now
 * solves at a build of about 0.99.
 */
export const BODY_KG_CALIBRATION = 1.25;

/** v169: the build factor, from severely underweight to severe obesity. */
export const BUILD_MIN = 0.6;
export const BUILD_MAX = 2.2;

/** v168: regional fullness for a fuller body (model units at the fullest build), starting above build = from. */
export const FAT = { yBack: 1.38, yAx: 1.49, yLow: 1.1, back: 0.016, ax: 0.014, flank: 0.014, low: 0.025, lowDrop: 0.006, from: 1.2, waistIn: 0.09 };
/** v186: how a bigger cup grows (model units per step of `b`): a teardrop on a wide base. */
export const BREAST = { amp: 0.062, sag: 0.0038, sag2: 0.8, cx: 0, cy: 0, gap: 0.02, lat: 0.075, up: 0.1, dn: 0.05, eUp: 0.8, pDn: 1.8, r0: 0.12, a0: 0, a1: 0.8, out0: 0.1, out: 0.25, sagLow: 2 };
/** v186: where a foot in heels bends: the ball line, half the bend's spread, and the hinge's height above the sole. */
export const HEEL_BEND = { ball: 0.67, soft: 0.15, up: 0.06 };

/** The girth profile: 512 samples every 5 mm. */
export const PROFILE_N = 512;
export const PROFILE_DY = 0.005;
/** v165: the upper ribcage's resting scale; it may ease in for a very small bust, never grow for a big one. */
export const RIB_REST = 0.95;
/** The cup's range (`b`). */
export const CUP_MIN = 0.55;
export const CUP_MAX_STEP = 5;
/** v188: a control point between the hip and the waist (above the hip line), so the hip curves instead of making a ledge. */
export const HIP_TO_WAIST_DY = 0.09;
/** v188: how far that control point sits from the waist toward the hip (0 = the waist's girth, 1 = the hip's). */
export const HIP_TO_WAIST_SHARE = 0.55;
/** v188: a rounded seat on slim and average bodies too (was flat or hollow below a hip scale of 1): base and range. */
export const SEAT_BASE = 0.1;
export const SEAT_MAX = 0.35;
/** "A big tummy always carries some hip with it": inner thighs come together softly, never through each other. */
export const THIGH_GAP = 0.011;
