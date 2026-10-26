/**
 * photo-viewer-gestures.ts — THE ONE VIEWER'S HANDS, as arithmetic (owner 2026-10-27, on Memories: *"will have pinch
 * zoom. swiping left and right goes to the next or preious photo. swipe down or up will close the preview."* — and on
 * every gallery: *"pinch zoom, swipe, button locations will stay the same"*).
 *
 * Pure, so the thresholds are held by `photo-viewer-gestures.test.ts` without a browser, and every caller of
 * `PhotoViewer` (app/_components/photo-viewer/photo-viewer.tsx) moves the same way.
 *
 *   · the first AXIS_LOCK_PX of a one-finger drag decide its axis — a vertical drag never nudges the photo sideways;
 *   · sideways past SWIPE_PX (or a quick flick past FLICK_PX) = next (to the left) / previous (to the right);
 *   · up OR down past CLOSE_PX (or a quick flick) = close;
 *   · ZOOMED IN, a one-finger drag PANS the photo — it never changes the photo or closes the viewer;
 *   · a pinch scales between MIN_SCALE and MAX_SCALE; a double tap toggles 1× ↔ DOUBLE_TAP_SCALE.
 */

export const AXIS_LOCK_PX = 10;
export const SWIPE_PX = 60;
export const CLOSE_PX = 90;
export const FLICK_PX = 28;
/** px per ms — a flick is a short, fast drag. */
export const FLICK_SPEED = 0.55;
export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
export const DOUBLE_TAP_SCALE = 2.5;
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_SLOP_PX = 28;

export type Axis = 'x' | 'y' | null;
export type SwipeResult = 'next' | 'prev' | 'close' | 'none';

/** Which way a one-finger drag is going, once it has moved far enough to say. */
export function lockAxis(dx: number, dy: number, sideways: boolean): Axis {
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= AXIS_LOCK_PX) return null;
  return sideways && Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/**
 * What a finished one-finger drag means. `scale` > 1 = zoomed in: the drag was a pan, never a swipe. `hasPrev` /
 * `hasNext` = there is a neighbour that way (no wrap at the ends — the first photo does not swipe to the last).
 */
export function classifySwipe(g: {
  dx: number;
  dy: number;
  ms: number;
  axis: Axis;
  scale: number;
  hasPrev: boolean;
  hasNext: boolean;
}): SwipeResult {
  if (g.scale > MIN_SCALE + 0.01 || !g.axis) return 'none';
  const speed = (d: number) => (g.ms > 0 ? Math.abs(d) / g.ms : 0);
  if (g.axis === 'x') {
    const far = Math.abs(g.dx) >= SWIPE_PX || (Math.abs(g.dx) >= FLICK_PX && speed(g.dx) >= FLICK_SPEED);
    if (!far) return 'none';
    if (g.dx < 0) return g.hasNext ? 'next' : 'none';
    return g.hasPrev ? 'prev' : 'none';
  }
  const far = Math.abs(g.dy) >= CLOSE_PX || (Math.abs(g.dy) >= FLICK_PX && speed(g.dy) >= FLICK_SPEED);
  return far ? 'close' : 'none';
}

export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Two fingers: the scale is the start scale times how far apart they have moved. */
export function pinchScale(startScale: number, startDistance: number, distance: number): number {
  if (startDistance <= 0) return clampScale(startScale);
  return clampScale(startScale * (distance / startDistance));
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Keep a zoomed photo on the screen: at scale `s` in a `w × h` stage the picture may move at most (s − 1)·w/2
 * sideways and (s − 1)·h/2 up or down. At 1× it sits centred.
 */
export function clampPan(pan: { x: number; y: number }, s: number, stage: { w: number; h: number }): { x: number; y: number } {
  const mx = Math.max(0, ((s - 1) * stage.w) / 2);
  const my = Math.max(0, ((s - 1) * stage.h) / 2);
  return { x: Math.min(mx, Math.max(-mx, pan.x)), y: Math.min(my, Math.max(-my, pan.y)) };
}

/** A second tap close in time and place to the first. */
export function isDoubleTap(
  prev: { t: number; x: number; y: number } | null,
  now: { t: number; x: number; y: number },
): boolean {
  if (!prev) return false;
  return now.t - prev.t <= DOUBLE_TAP_MS && Math.hypot(now.x - prev.x, now.y - prev.y) <= DOUBLE_TAP_SLOP_PX;
}

/**
 * A double tap zooms IN toward the tapped point (or back OUT to 1×). The pan puts the tapped point where it was: a
 * point `p` from the stage centre moves to `p·s`, so the photo shifts by `−p·(s − 1)`.
 */
export function doubleTapZoom(
  scale: number,
  tap: { x: number; y: number },
  stage: { w: number; h: number; left: number; top: number },
): { scale: number; pan: { x: number; y: number } } {
  if (scale > MIN_SCALE + 0.01) return { scale: MIN_SCALE, pan: { x: 0, y: 0 } };
  const s = DOUBLE_TAP_SCALE;
  const px = tap.x - (stage.left + stage.w / 2);
  const py = tap.y - (stage.top + stage.h / 2);
  return { scale: s, pan: clampPan({ x: -px * (s - 1), y: -py * (s - 1) }, s, stage) };
}

/** The neighbour index in the CURRENT order — null past either end (no wrap). */
export function neighbour(index: number, count: number, dir: 1 | -1): number | null {
  const n = index + dir;
  return n >= 0 && n < count ? n : null;
}

/** A keyboard key on a desktop: ← previous · → next · Escape close. Anything else is not ours. */
export function keyIntent(key: string): 'prev' | 'next' | 'close' | null {
  if (key === 'ArrowLeft') return 'prev';
  if (key === 'ArrowRight') return 'next';
  if (key === 'Escape') return 'close';
  return null;
}
