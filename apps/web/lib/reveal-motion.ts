/**
 * lib/reveal-motion.ts — 🎭 THE ONE SET OF MOTION RULES EVERY REVEAL OBEYS.
 *
 * Owner, 23 Nov 2026 (DECISION_LOG "REVEALS ACCEPTED FOR NOW AT v10" · "NINE REVEALS SHIP; THE GIFT BOX IS HELD"):
 * one tap opens every reveal, the veil's motion rules are shared by all, hands-free 12 s (9 · 12 · 16).
 * Drawing: specs `prototypes/reveals_round3_veil_rules_2026-11-23/src/core4.js` (`RV.rules`), whose numbers were
 * READ from the shipped veil (`veil-reveal.tsx` · `lib/veil-cloth.ts` · `DEFAULT_VEIL_LOOK`) and are copied here,
 * not re-tuned. NO REVEAL HAS TIMING OF ITS OWN: the veil (`veil-reveal.tsx`) and every scene reveal
 * (`scene-reveal.tsx`) read the lift, the tap, the swipe and the speed from this file.
 *
 * Pure: no React, no three.js, no window — unit-tested in `lib/reveal-motion.test.ts`.
 */

/** ⏱ The hands-free speeds a couple may pick (seconds from the tap to open). 12 is the house's. */
export const REVEAL_SPEEDS = [9, 12, 16] as const;
export type RevealSpeed = (typeof REVEAL_SPEEDS)[number];
export const DEFAULT_REVEAL_SPEED: RevealSpeed = 12;

/** The nearest allowed speed; anything unreadable is the house's 12. A tie goes to the slower (more drama). */
export function snapRevealSpeed(v: unknown): RevealSpeed {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_REVEAL_SPEED;
  let best: RevealSpeed = DEFAULT_REVEAL_SPEED;
  let bd = Infinity;
  for (const s of REVEAL_SPEEDS) {
    const d = Math.abs(s - v);
    if (d <= bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/**
 * ⏱ EACH REVEAL'S PACE ON THE ONE SCALE (owner 23 Nov 2026: *"Veil curtain slower · Evelope doesnt get slow but should
 * be at slowest"*). The envelopes always play at the slowest speed; the veil and the beach curtains one step slower than
 * the speed they are given (the couple's, else the house's), never slower than the envelopes; every other reveal at the
 * speed it is given. The ONE place a reveal's seconds are decided: the veil and the scene stage both read it.
 */
export const SLOWEST_REVEAL_SPEED: RevealSpeed = REVEAL_SPEEDS[REVEAL_SPEEDS.length - 1]!;
const AT_THE_SLOWEST: readonly string[] = ['envelope-classic', 'envelope-gatefold'];
const ONE_STEP_SLOWER: readonly string[] = ['veil-sheer', 'beach-curtains'];
export function revealPlaysAt(kind: string, speed: unknown): RevealSpeed {
  const s = snapRevealSpeed(speed);
  if (AT_THE_SLOWEST.includes(kind)) return SLOWEST_REVEAL_SPEED;
  if (ONE_STEP_SLOWER.includes(kind)) return REVEAL_SPEEDS[Math.min(REVEAL_SPEEDS.length - 1, REVEAL_SPEEDS.indexOf(s) + 1)]!;
  return s;
}
/** The speeds a couple can pick for this reveal, one per pace it really plays (the stored value, the seconds it plays). */
export function revealSpeedChoices(kind: string): Array<{ key: RevealSpeed; plays: RevealSpeed }> {
  const out: Array<{ key: RevealSpeed; plays: RevealSpeed }> = [];
  for (const key of REVEAL_SPEEDS) {
    const plays = revealPlaysAt(kind, key);
    if (!out.some((o) => o.plays === plays)) out.push({ key, plays });
  }
  return out;
}

/**
 * The rules. Each line names where the shipped veil holds the same number.
 */
export const REVEAL_MOTION = {
  /** Every frame the motion closes this share of what is left (`lift += (liftTarget - lift) * 0.05`). */
  LIFT_K: 0.05,
  /** "Revealed" only when the motion is this far through (`lift > 0.985`). */
  DONE: 0.985,
  /** A tap: shorter than this… (`dur < 300`) */
  TAP_MS: 300,
  /** …and moving less than this (`net < 18`). */
  TAP_PX: 18,
  /** A swipe: further than this… (`up > 40`) */
  SWIPE_PX: 40,
  /** …in less than this (`dur < 460`). */
  SWIPE_MS: 460,
  /** While a scene reveal opens, the camera travels this share of the way in (the drawing's slow push-in). */
  PUSH: 0.36,
  /** The feather phase the hands-free open enters at 30 %, in frames per second of speed (`autoDur * 34`). */
  FEATHER_FPS: 34,
} as const;

/** Smoothstep — the veil's `ss`. */
export function ss(a: number, b: number, x: number): number {
  const t = (x - a) / (b - a);
  return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
}

/**
 * The hands-free curve: where the open aims at `p` (0 → 1 of the speed). Steadier than the veil's old
 * `ss(.05,.95,p)` alone — the owner's reference templates move at an even, unhurried pace from the first moment
 * (drawing `core4.js` `tick`).
 */
export function handsFreeTarget(p: number): number {
  const q = p < 0 ? 0 : p > 1 ? 1 : p;
  return 0.55 * q + 0.45 * ss(0.05, 0.95, q);
}

/** One frame of the lift chasing its target. */
export function stepLift(lift: number, target: number): number {
  return lift + (target - lift) * REVEAL_MOTION.LIFT_K;
}

/** The camera's distance during the push-in (a reveal may push less, e.g. the veil's 0.07). */
export function pushedZ(z0: number, push: number, lift: number): number {
  return z0 * (1 - push * ss(0.02, 1, lift));
}

export type RevealGesture = 'open' | 'close' | 'tap' | 'hold';

/**
 * What a released touch meant — the veil's own reading (`release` in `veil-reveal.tsx`), along the way the reveal
 * opens (`dir`, screen pixels, +y DOWN; the veil opens upward, so its `dir` is [0, -1]).
 */
export function readGesture(g: { dx: number; dy: number; ms: number; dir?: readonly [number, number] }): RevealGesture {
  const [ux, uy] = g.dir ?? [0, -1];
  const along = g.dx * ux + g.dy * uy;
  const across = Math.abs(g.dx * uy - g.dy * ux);
  const R = REVEAL_MOTION;
  if (along > R.SWIPE_PX && g.ms < R.SWIPE_MS && along > across) return 'open';
  if (-along > R.SWIPE_PX && g.ms < R.SWIPE_MS && -along > across) return 'close';
  if (g.ms < R.TAP_MS && Math.hypot(g.dx, g.dy) < R.TAP_PX) return 'tap';
  return 'hold';
}

/** 🧹 Scratch opens only once this share of the foil is rubbed away (owner 23 Nov: *"at least 60%"*). */
export const SCRATCH_OPENS_AT = 0.6;

/** ♿ Reduced motion: the closed reveal stands still; one tap cross-fades it away over this (MOTION_STANDARD 280). */
export const REVEAL_REDUCED_FADE_MS = 280;

/**
 * 🎞 One frame's time. Capped at 33 ms as the veil always has (a stalled frame never jumps the open). A capture
 * script may set `window.__revealFrameClock = true` (the drawing's `RV.seek`): each frame then counts as exactly 1/60 s
 * and is tallied in `window.__revealFrames`, so frame strips are exact on any machine, software GL included.
 * The app never sets it.
 */
export function revealDt(now: number, last: number): number {
  if (typeof window !== 'undefined') {
    const w = window as Window & { __revealFrameClock?: boolean; __revealFrames?: number };
    if (w.__revealFrameClock === true) {
      w.__revealFrames = (w.__revealFrames ?? 0) + 1;
      return 1 / 60;
    }
  }
  return Math.min(0.033, (now - last) / 1000);
}
