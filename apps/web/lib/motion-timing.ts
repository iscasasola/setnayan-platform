/**
 * motion-timing.ts — 🎞 THE APPROVED TIMING TABLE, AND NOTHING ELSE (owner 2026-11-13, DECISION_LOG "Motion system
 * approved"). Split from `lib/grow-motion.ts` so the one press listener every page loads (`PressFeel`, root layout) pulls
 * only these numbers, never the grow player — the shared bundle is capped at 202.3 KB. Mirrors the `--sn-dur-*` /
 * `--sn-ease-emph` tokens in globals.css. 🔒 lib/the-motion-system-is-shared.test.ts
 */

/** The timing table (§ 6 of the prototype). Mirrors `--sn-dur-*` in globals.css. */
export const TIMING = {
  pressMs: 100,
  releaseMs: 280,
  growPressMs: 120,
  openMs: 360,
  closeRatio: 0.8,
  stepMs: 40,
  rowOpenMs: 320,
  rowShutMs: 260,
  toggleMs: 260,
  chipMs: 220,
  chipOutMs: 180,
  fieldMs: 280,
  snapMs: 220,
  reducedMs: 120,
} as const;

/** Anything that travels or opens. */
export const EASE_EMPH = 'cubic-bezier(.2,0,0,1)';
/** Anything that lets go — the house spring (`--sn-pill-spring`). */
export const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';

/** A button dips to .97 on touch-down; a row (wide) only to .985. */
export const PRESS_SCALE = 0.97;
export const ROW_PRESS_SCALE = 0.985;
/** At or past this width a pressed thing is a row, not a button. */
export const ROW_MIN_WIDTH = 300;
/** The page behind steps back to .96 while a layer grows over it. */
export const BEHIND_SCALE = 0.96;
/** Each content step rises this far as it fades in. */
export const STEP_RISE_PX = 10;

export function pressScale(width: number, isRow = false): number {
  return isRow || width >= ROW_MIN_WIDTH ? ROW_PRESS_SCALE : PRESS_SCALE;
}
