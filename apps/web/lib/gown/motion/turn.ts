/**
 * 👗 gown/motion/turn — her twirl, the sway, the auto-turn, and the skirt that follows her turn (prototype v206
 * `playTwirl`, the twirl and sway steps of the frame loop, `autoStep`, and the cloth drive before `stepCloth`). Women
 * only. Pure numbers: the stage passes her rotation in and sets what comes back.
 */
import { clamp } from '../body/rig';
import { TAU } from '../body/constants';

/** v206 Twirl styles. */
export const GOWN_TWIRL_STYLES = [
  { id: 'classic', label: 'Classic twirl' },
  { id: 'slow', label: 'Slow reveal' },
  { id: 'double', label: 'Double twirl' },
  { id: 'sway', label: 'Sway' },
] as const;
export type GownTwirlStyle = (typeof GOWN_TWIRL_STYLES)[number]['id'];
/** v206 turn styles for the auto-turn: round and round, a showroom turn (a pause at the front, each side and the back), or a sway. */
export const GOWN_TURN_STYLES = [
  { id: 'spin', label: 'Continuous' },
  { id: 'show', label: 'Showcase' },
  { id: 'sway', label: 'Sway' },
] as const;
export type GownTurnStyle = (typeof GOWN_TURN_STYLES)[number]['id'];
/** v206 auto-turn speeds (degrees a second): off, slow, fast. */
export const GOWN_TURN_SPEEDS = [
  { id: 0, label: 'Auto-turn off' },
  { id: 10, label: 'Slow turn' },
  { id: 30, label: 'Fast turn' },
] as const;

export type GownTurn = {
  /** What is left of the twirl (radians), of how much, and its pace (slow 0.42, double 1.15). */
  spin: number; spinAll: number; k: number;
  /** A sway: when it started (ms) and where she faced. */
  swayT: number | null; swayBase: number;
  /** The auto-turn: degrees a second (0 = off), its direction and style. */
  auto: number; dir: 1 | -1; style: GownTurnStyle; ph: number; base: number; hold: number;
};
export const stillGownTurn = (): GownTurn => ({ spin: 0, spinAll: 0, k: 1, swayT: null, swayBase: 0, auto: 0, dir: 1, style: 'spin', ph: 0, base: 0, hold: 0 });

/** v206 `playTwirl`: start a twirl in a style. With motion reduced she just turns round (returns her new rotation). */
export function gownStartTwirl(S: GownTurn, style: GownTwirlStyle, rot: number, now: number, reduce: boolean): number {
  S.auto = 0;
  if (style === 'sway') { S.spin = 0; S.swayT = now; S.swayBase = rot; return rot; }
  S.swayT = null;
  S.k = style === 'slow' ? 0.42 : style === 'double' ? 1.15 : 1;
  if (reduce) return rot + Math.PI;
  S.spin = S.spinAll = Math.PI * (style === 'double' ? 4 : 2);
  return rot;
}

/** Is she turning on her own (a twirl, a sway or the auto-turn)? The frame governor stays awake while she is. */
export const gownTurning = (S: GownTurn) => S.spin > 0 || S.swayT !== null || S.auto > 0;

/** One frame of her turn (v206 frame loop and `autoStep`): returns her new rotation. */
export function gownStepTurn(S: GownTurn, rot: number, dt: number, now: number): number {
  if (S.spin > 0) {
    // A calmer peak so the flare and the veil stay clean.
    const u = 1 - S.spin / S.spinAll, d = Math.min(S.spin, (1.0 + 2.6 * Math.sin(Math.PI * u)) * dt * S.k);
    S.spin -= d;
    if (S.spin <= 0) { S.spin = 0; S.k = 1; }
    return rot + d;
  }
  if (S.swayT !== null) {
    // Twice to each side and back, the skirt following.
    const t = (now - S.swayT) / 1000;
    if (t > 4.4) { S.swayT = null; return S.swayBase; }
    return S.swayBase + 0.6 * Math.sin((TAU * t) / 2.2) * Math.sin((Math.PI * t) / 4.4);
  }
  if (S.auto > 0) {
    const w = (S.dir * S.auto * Math.PI) / 180;
    // About 40° each way around where she faced.
    if (S.style === 'sway') { S.ph += (Math.abs(w) * dt) / 0.7; return S.base + 0.7 * Math.sin(S.ph); }
    if (S.style === 'show') {
      // A showroom turn: a pause at the front, each side and the back.
      if (S.hold > now) return rot;
      const q = Math.PI / 2, r1 = rot + w * dt, a = Math.floor(rot / q + 1e-6), b = Math.floor(r1 / q + 1e-6);
      if (w > 0 && b > a) { S.hold = now + 1400; return b * q; }
      if (w < 0 && Math.ceil(r1 / q - 1e-6) < Math.ceil(rot / q - 1e-6)) { S.hold = now + 1400; return Math.ceil(r1 / q - 1e-6) * q; }
      return r1;
    }
    return rot + w * dt;
  }
  return rot;
}

/** The cloth's feel for her turn (v206 frame loop): the turn smoothed (a drag is jerky), and how fast it changes. */
export type GownClothDrive = { last: number | null; wS: number; wP: number };
export const stillGownClothDrive = (): GownClothDrive => ({ last: null, wS: 0, wP: 0 });
/**
 * Her turn relative to the viewer (a twirl, or dragging the view round her) drives the cloth chain: returns the turn
 * speed and the push for `stepCloth` (speeding up leaves the hem behind; stopping lets it run on). A jump (a reset, a
 * new body) is ignored; with motion reduced the cloth stays still.
 */
export function gownClothDrive(C: GownClothDrive, ang: number, dt: number, reduce: boolean): { w: number; alpha: number } {
  let w = C.last === null || dt <= 0 ? 0 : (ang - C.last) / dt;
  C.last = ang;
  if (Math.abs(w) > 20 || reduce) w = 0;
  C.wS += (w - C.wS) * (1 - Math.exp(-dt * 25));
  const alpha = dt > 0 ? (C.wS - C.wP) / dt : 0;
  C.wP = C.wS;
  return { w: C.wS, alpha: 0.35 * clamp(alpha, -60, 60) };
}
