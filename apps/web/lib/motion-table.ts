/**
 * motion-table.ts — THE ONE TIMING TABLE. Every motion in the app reads from it (owner 13 Nov 2026, "motion approved" on
 * `Setnayan-specs/prototypes/approved_2026-11-13/grow-full-screen-fable.html` v1, § 6 "One timing table"; DECISION_LOG
 * 2026-11-13 "Motion system approved": *"The faster numbers REPLACE the 0.7 s rise (10 Nov) and the 0.7 s press family
 * (8 Oct)."*).
 *
 * TWO CURVES ONLY: `EASE_EMPHASIZED` for anything that travels or opens, `EASE_SPRING` (the house spring) for anything
 * that lets go. ONLY transform and opacity move — with two stated exceptions: a row's or a field's own height (grid
 * rows, one small box) and the full-screen shape's clip (one layer).
 *
 * The same numbers are CSS tokens in `app/globals.css` (`--sn-m-*`), so a stylesheet and a Web Animations call can
 * never disagree. 🔒 lib/the-motion-table-is-one.test.ts holds the two copies equal.
 *
 * (Not `lib/motion.ts` — that file is the Event Hub arrival's mirror of `--sn-dur-elem` / `--sn-dur-enter`, held by its own
 * guard; this table is the app's controls and screens.)
 */

/** Anything that travels or opens. */
export const EASE_EMPHASIZED = 'cubic-bezier(.2,0,0,1)';
/** Anything that lets go (the house spring). */
export const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)';
/** The close of a grow: the emphasized curve, reversed. */
export const EASE_EMPHASIZED_REVERSED = 'cubic-bezier(1,0,.8,1)';

export const MOTION_TABLE = {
  /** Press in: scale 0.97 + shade. Reduced: shade only. */
  pressInMs: 100,
  pressScale: 0.97,
  /** Release: scale back to 1 on the spring. Reduced: none. */
  releaseMs: 280,
  /** Ripple, the row's main button only: from the touch point. Reduced: off. */
  rippleMs: 520,
  /** Loading in a button: fades in, then turns one lap per this many ms (label and size stay). */
  spinnerInMs: 120,
  spinnerLapMs: 700,
  /** Toggle: the knob travels with an overshoot; the fill is scaleX; the tick wipes in. Reduced: jumps. */
  toggleMs: 260,
  toggleTickMs: 140,
  /** "Saved ✓": in, hold, out. */
  savedInMs: 160,
  savedHoldMs: 1600,
  savedOutMs: 300,
  /** Field focus: the box grows to writing size; label and line move by transform. Reduced: opens at once. */
  fieldGrowMs: 280,
  fieldLabelMs: 200,
  fieldLineMs: 260,
  /** The text box grows one line. Reduced: snaps. */
  fieldLineGrowMs: 160,
  /** Send wakes. Reduced: colour only. */
  sendWakeMs: 260,
  /** Chip picked: the fill slides in / out; the words cross-fade. Reduced: fills at once. */
  chipInMs: 220,
  chipOutMs: 180,
  /** Row press: scale 0.985 + shade. Reduced: shade only. */
  rowPressScale: 0.985,
  /** Swipe to remove: snap and leave; the gap closes on grid rows. Reduced: fades, no slide. */
  swipeSnapMs: 220,
  swipeLeaveMs: 240,
  /** Row expands: height on grid rows, chevron rotate, content 3 steps 40 ms apart. Reduced: opens at once, 120 ms fade. */
  rowOpenMs: 320,
  rowShutMs: 260,
  /** Grow to full screen: the press, then the shape (the clip, one layer). Close: every window mirrored at 80 %. */
  growPressMs: 120,
  growShapeMs: 360,
  growCloseFactor: 0.8,
  /** The page behind steps back while the shape opens. */
  growBehindScale: 0.96,
  growBehindDim: 0.18,
  /** Content arrives in 3 steps, 40 ms apart, each rising this far — from 320 ms after the press (shape > 70 % open). */
  growContentStartMs: 320,
  growStepMs: 40,
  growStepRisePx: 10,
  growStepFadeMs: 180,
  /** ✕ and the bottom bar arrive last: 440 → 600 / 640 ms after the press. */
  growChromeStartMs: 440,
  growChromeMs: 160,
  growBarMs: 200,
  /** Late data fades in when it lands. */
  lateFadeMs: 160,
  /** Every reduced-motion fallback that is a fade. */
  reducedFadeMs: 120,
  /** Content steps: how many. */
  steps: 3,
} as const;

/** "press to last part in place" — 640 ms, the table's own total (shape at 120 + 360, chrome to 640). */
export const GROW_TOTAL_MS = MOTION_TABLE.growChromeStartMs + MOTION_TABLE.growBarMs;

/** Every motion's reduced-motion fallback in words — the guard reads it, the build follows it. */
export const REDUCED_MOTION = {
  press: 'shade only, no scale',
  release: 'none',
  ripple: 'off',
  spinner: 'kept: it carries meaning',
  toggle: 'jumps; Saved ✓ still fades',
  saved: 'same',
  field: 'opens at once',
  fieldLine: 'snaps',
  send: 'colour only',
  chip: 'fills at once',
  rowPress: 'shade only',
  swipe: 'fades, no slide',
  rowExpand: 'opens at once, 120 ms fade',
  grow: '120 ms cross-fade',
} as const;
