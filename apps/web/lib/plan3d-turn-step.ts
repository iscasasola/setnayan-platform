/**
 * 🔄 A7-05 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 3, approved): on /pa3d and
 * /pa3d/try a phone's up-and-down swipe belongs to the page (`touch-action: pan-y`), so the room needs a visible tap path
 * (house D3): two "Turn left" / "Turn right" rounds, each turning the camera ONE step, easing with Move 320 and the settle
 * curve. Pure, so the step and the curve are tested without WebGL.
 */
import { EASE_SETTLE, MOVE_MS } from './motion-table';

/** One tap turns the camera an eighth of a half turn (22.5°). */
export const TURN_STEP_RAD = Math.PI / 8;

/** The turn's length: the house Move speed. */
export const TURN_MS = MOVE_MS;

/** The settle curve's four numbers, read from the house token (`cubic-bezier(.2,.8,.2,1)`), never typed twice. */
const SETTLE = EASE_SETTLE.replace(/^cubic-bezier\(|\)$/g, '').split(',').map(Number) as [number, number, number, number];

/** The settle curve at time t (0…1): the CSS cubic-bezier, solved for x by Newton's method then bisection. */
export function settleAt(t: number): number {
  const [x1, y1, x2, y2] = SETTLE;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const bx = (u: number) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
  const by = (u: number) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  const dx = (u: number) => 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
  let u = t;
  for (let i = 0; i < 8; i++) {
    const err = bx(u) - t;
    const d = dx(u);
    if (Math.abs(err) < 1e-6) return by(u);
    if (Math.abs(d) < 1e-6) break;
    u -= err / d;
  }
  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 30; i++) {
    const x = bx(u);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return by(u);
}

/** The azimuth at `elapsedMs` of a turn from `from` by `dir` steps; reduced motion cuts straight to the end. */
export function turnAzimuthAt(from: number, dir: -1 | 1, elapsedMs: number, reducedMotion: boolean): number {
  const to = from + dir * TURN_STEP_RAD;
  if (reducedMotion) return to;
  return from + (to - from) * settleAt(Math.min(1, Math.max(0, elapsedMs / TURN_MS)));
}
