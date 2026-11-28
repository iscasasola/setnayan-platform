/**
 * 👗 gown/motion/walks — the aisle walk, an everyday walk, a runway walk and the bridal photo jump (prototype v206
 * `WALKS`, `motionPose`, `stepMotion`). Women only. Pure numbers: the pose at a moment, and how high she is off the floor.
 */
import { smoothstep } from '../body/rig';
import { TAU } from '../body/constants';
import type { GownJointTurn, GownPoseTurns } from './poses';

/** hz: strides a second (two steps each); hip, knee, foot swing in degrees; bob and sway in model units. */
export type GownWalk = { hz: number; hip: number; k0: number; k: number; ft: number; arm: number; bq?: readonly [GownJointTurn, GownJointTurn]; cross: number; bob: number; sway: number };
export const GOWN_WALKS = {
  // Slow and upright, short steps, the bouquet held still in front.
  aisle: { hz: 0.5, hip: 14, k0: 8, k: 14, ft: 5, arm: 0, bq: [[-26, 0, -36], [0, 0, -58]], cross: 0, bob: 0.004, sway: 0.004 },
  // Everyday: normal pace, arms swing.
  walk: { hz: 0.9, hip: 24, k0: 12, k: 26, ft: 8, arm: 14, cross: 0, bob: 0.012, sway: 0 },
  // Model: feet in one line, hips sway, arms close.
  runway: { hz: 1, hip: 26, k0: 10, k: 28, ft: 10, arm: 8, cross: 7, bob: 0.008, sway: 0.018 },
} as const satisfies Record<string, GownWalk>;
export type GownMotionKind = keyof typeof GOWN_WALKS | 'jump';
/** How often the moving body and gown are rebuilt (a second); the frame loop draws in between. */
export const GOWN_MOTION_HZ = 24;
/** She eases into a walk over this long (s), instead of jumping into it. */
export const GOWN_MOTION_EASE_S = 0.45;

/** v206 `motionPose`: the pose at time t (s), how high she is off the floor (`y`) and how far she sways (`x`). */
export function gownMotionPose(kind: GownMotionKind, t: number): { p: GownPoseTurns; y: number; x: number } {
  if (kind !== 'jump') {
    const W: GownWalk = GOWN_WALKS[kind], f = t * TAU * W.hz, s1 = Math.sin(f), kneeR = W.k0 + W.k * Math.max(0, Math.sin(f + 1.6)), kneeL = W.k0 + W.k * Math.max(0, Math.sin(f + 1.6 + Math.PI));
    // Runway: the leg swinging forward crosses in, so each foot lands in line.
    const inR = W.cross * Math.max(0, -s1), inL = W.cross * Math.max(0, s1);
    const BQ = W.bq;
    // Hands together in front, holding the bouquet; otherwise the arms swing.
    const arms: GownPoseTurns = BQ
      ? { 'upperarm01.L': BQ[0], 'upperarm01.R': [BQ[0][0], -BQ[0][1], -BQ[0][2]], 'lowerarm01.L': BQ[1], 'lowerarm01.R': [BQ[1][0], -BQ[1][1], -BQ[1][2]] }
      : { 'upperarm01.L': [W.arm * s1, 0, -30], 'upperarm01.R': [-W.arm * s1, 0, 30], 'lowerarm01.L': [-10, 0, 0], 'lowerarm01.R': [-10, 0, 0] };
    return {
      p: { 'upperleg01.R': [-W.hip * s1, 0, -inR], 'upperleg01.L': [W.hip * s1, 0, inL], 'lowerleg01.R': [kneeR, 0, 0], 'lowerleg01.L': [kneeL, 0, 0], 'foot.R': [-W.ft * s1, 0, 0], 'foot.L': [W.ft * s1, 0, 0], ...arms },
      y: W.bob * Math.abs(Math.cos(f)), x: W.sway * Math.sin(f),
    };
  }
  // The bridal photo jump: crouch, push, fly, land, stand; the feet kick up behind, the knees stay under the skirt.
  const T = t % 1.6, cr = T < 0.3 ? smoothstep(T, 0, 0.3) : T < 0.4 ? 1 - smoothstep(T, 0.3, 0.4) : T < 0.9 ? 0 : T < 1.05 ? 0.8 * smoothstep(T, 0.9, 1.05) : 0.8 * (1 - smoothstep(T, 1.05, 1.45));
  const air = T > 0.4 && T < 0.9 ? Math.sin((Math.PI * (T - 0.4)) / 0.5) : 0, tuck = air;
  return {
    p: {
      'upperleg01.R': [-8 * cr + 8 * tuck, 0, 2], 'upperleg01.L': [-8 * cr + 8 * tuck, 0, -2], 'lowerleg01.R': [18 * cr + 95 * tuck, 0, 0], 'lowerleg01.L': [18 * cr + 85 * tuck, 0, 0],
      'foot.R': [-10 * cr + 30 * tuck, 0, 0], 'foot.L': [-10 * cr + 30 * tuck, 0, 0], 'upperarm01.L': [-20 * cr, 0, -30 + 70 * air], 'upperarm01.R': [-20 * cr, 0, 30 - 70 * air],
      'lowerarm01.L': [-20 * cr, 0, 0], 'lowerarm01.R': [-20 * cr, 0, 0],
    },
    y: 0.32 * air, x: 0,
  };
}

/** The motion clock (v206 `motion`): how long she has moved, the rebuild accumulator, and her rise and its speed. */
export type GownMotionClock = { kind: GownMotionKind | 'stop'; t: number; acc: number; vy: number; py: number };
export const stillGownMotion = (): GownMotionClock => ({ kind: 'stop', t: 0, acc: 0, vy: 0, py: 0 });

/**
 * v206 `stepMotion`, the clock half: advance by dt; returns where she is (`y` up, `x` sideways, for the stage to move
 * her) and, about 24 times a second, the pose to rebuild (`rebuild`, with how far she has eased in). Between rebuilds the
 * stage only draws.
 */
export function gownStepMotion(M: GownMotionClock, dt: number): { y: number; x: number; rebuild: { p: GownPoseTurns; ease: number } | null } {
  if (M.kind === 'stop') return { y: 0, x: 0, rebuild: null };
  M.t += dt;
  M.acc += dt;
  const m = gownMotionPose(M.kind, M.t);
  M.vy = dt > 0 ? (m.y - M.py) / dt : 0;
  M.py = m.y;
  if (M.acc < 1 / GOWN_MOTION_HZ) return { y: m.y, x: m.x, rebuild: null };
  // A long stall (a tab in the background) does not replay every missed rebuild.
  M.acc = M.acc > 0.2 ? 0 : M.acc - 1 / GOWN_MOTION_HZ;
  const k = Math.min(1, M.t / GOWN_MOTION_EASE_S);
  return { y: m.y, x: m.x, rebuild: { p: m.p, ease: k * k * (3 - 2 * k) } };
}
