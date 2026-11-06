/**
 * home-tile-rotation.ts — THE FACES' TIMING AND WHEN THEY MAY MOVE (owner 2026-10-24: *"for the guests, we can swipe
 * the widget to see what other counters is showing … also apply auto swipe so it rotates by itself … auto swipe
 * resumes after 8-10 seconds?"*; prototype `home_control_center_2026-10-24_fable.html`, "Faces — swipe, and
 * auto-rotate", its timing table).
 *
 * Pure — no React, no DOM — so the rules are held by a test without a browser (`home-tiles-rotate-politely.test.ts`):
 * reduced motion never rotates; a single face and a failed read never rotate; a hold, an off-screen tile and a hidden
 * page pause; a touch rests the tile 9 s and it resumes from the face it was left on.
 */

/** Time on each face. */
export const FACE_MS = 4500;
/** The slide between faces (the house ease). */
export const SLIDE_MS = 320;
/** Stagger between tiles, in grid order — they never all flip at once. */
export const STAGGER_MS = 900;
/** After a hand swipe, a dot tap or a touch: rest, then resume with no touch (owner's 8–10 s). */
export const RESUME_MS = 9000;
/** A swipe moves past 20 % of the tile's width; under 6 px it is a tap. */
export const SWIPE_FRACTION = 0.2;
export const TAP_PX = 6;
/** A tile counts as on screen at 40 % visible (IntersectionObserver). */
export const VISIBLE_THRESHOLD = 0.4;

/** May this tile ever rotate? A single face and a failed read never do; reduced motion never does. */
export function tileRotates(t: { faces: number; failed: boolean; reducedMotion: boolean }): boolean {
  return t.faces > 1 && !t.failed && !t.reducedMotion;
}

/** Is it paused right now? A finger on it · off screen · the page hidden · still resting after a touch. */
export function tilePaused(t: { holding: boolean; onScreen: boolean; pageHidden: boolean; restingUntil: number; now: number }): boolean {
  return t.holding || !t.onScreen || t.pageHidden || t.now < t.restingUntil;
}

/** Where a released swipe lands: past the threshold → the next/previous face (wrapping), else back where it was. */
export function swipeLands(t: { index: number; faces: number; dx: number; width: number }): number {
  const step = Math.abs(t.dx) > t.width * SWIPE_FRACTION ? (t.dx < 0 ? 1 : -1) : 0;
  return (((t.index + step) % t.faces) + t.faces) % t.faces;
}
