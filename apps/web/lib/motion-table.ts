/**
 * motion-table.ts — THE ONE TIMING TABLE. Every motion in the app reads from it.
 *
 * TWO RULINGS, COMBINED (owner 18 Nov 2026, *"Combine them"*; specs `MOTION_STANDARD_2026-11-18.md` § 0 + § 2):
 *   · 18 Nov — the standard is the source: FIVE SPEEDS + ONE LOOP, TWO EASINGS (`TAP_MS` 100 · `QUICK_MS` 200 ·
 *     `RELEASE_MS` 280 · `MOVE_MS` 320 · `RISE_MS_STANDARD` 700 · the Sheen loop `SHEEN_MS` 1400 linear; `EASE_SETTLE`
 *     for anything that travels, opens or fades, `EASE_SPRING_LINEAR` — a real spring as `linear()` — for anything that
 *     moves and lets go, with `EASE_SPRING_FALLBACK` where `linear()` is not understood).
 *   · 13 Nov — "motion approved" (`Setnayan-specs/prototypes/approved_2026-11-13/grow-full-screen-fable.html` v1;
 *     DECISION_LOG 2026-11-13 "Motion system approved"): the touch feel, the grow's details (page behind 0.96 + dim,
 *     three content steps 40 ms apart, chrome last, close = the open mirrored at 80 %) keep their numbers below — only
 *     the grow's own speeds are retimed onto the standard (press 120 → Tap 100, shape 360 → Move 320).
 *
 * The old names (`EASE_EMPHASIZED`, `EASE_EMPHASIZED_REVERSED`, `EASE_SPRING`) are kept as ALIASES so no caller breaks:
 * the emphasized `(.2,0,0,1)` of 13 Nov is REPLACED by Settle as the travel / open curve.
 *
 * ONLY transform and opacity move — with two stated exceptions: a row's or a field's own height (grid rows, one small
 * box) and the full-screen shape's clip (one layer).
 *
 * The same numbers are CSS tokens in `app/globals.css` (`--sn-m-*`), so a stylesheet and a Web Animations call can
 * never disagree. 🔒 lib/the-motion-table-is-one.test.ts · lib/the-motion-standard-tokens.test.ts hold the two copies
 * equal; scripts/lint-motion-raw.mjs stops new one-off timings.
 *
 * (Not `lib/motion.ts` — that file is the Event Hub arrival's mirror of `--sn-dur-elem` / `--sn-dur-enter`, held by its own
 * guard; this table is the app's controls and screens. The couple's Event Hub keeps its own motion.)
 */

// ── THE STANDARD (18 Nov 2026, § 2) ─────────────────────────────────────────────────────────────────────────────────
/** Tap — press-in; a label swapping to a spinner. */
export const TAP_MS = 100;
/** Quick — a scrim, a pop, a small change, a "Saved ✓" in / out. */
export const QUICK_MS = 200;
/** Release — the spring back on lift. */
export const RELEASE_MS = 280;
/** Move — anything that travels: every full-screen open, a sheet, an enter, a gap closing. */
export const MOVE_MS = 320;
/** Rise — Highlight (the pill thumb), Picture leads' photo, Count, Hero settle. (Not `RISE_MS` in `lib/rise-motion.ts`,
 *  which is the grow's shape — Move.) */
export const RISE_MS_STANDARD = 700;
/** Sheen — the ONE allowed loop, linear. */
export const SHEEN_MS = 1400;

/** Settle — anything that travels, opens or fades. */
export const EASE_SETTLE = 'cubic-bezier(.2,.8,.2,1)';
/** Settle played backwards in time — a close that mirrors an open. */
export const EASE_SETTLE_REVERSED = 'cubic-bezier(.8,0,.8,.2)';
/** Spring — a real spring as `linear()`: 27 stops, one ~5 % overshoot, no second wobble (the 18 Nov prototype's own
 *  value, `motion_standard_2026-11-18_fable.html` `--spring`). */
export const EASE_SPRING_LINEAR =
  'linear(0, 0.062, 0.204, 0.379, 0.551, 0.704, 0.827, 0.919, 0.983, 1.022, 1.042, 1.05, 1.048, 1.042, 1.034, 1.025, 1.017, 1.01, 1.005, 1.002, 0.999, 0.998, 0.998, 0.998, 0.998, 0.998, 1)';
/** Spring where `linear()` is not understood (`@supports not (transition-timing-function: linear(0, 1))`). */
export const EASE_SPRING_FALLBACK = 'cubic-bezier(.34,1.56,.64,1)';

// ── ALIASES (13 Nov names, kept so callers do not break) ────────────────────────────────────────────────────────────
/** Anything that travels or opens — since 18 Nov this IS Settle. */
export const EASE_EMPHASIZED = EASE_SETTLE;
/** Anything that lets go (the house spring) — the cubic form, `--sn-pill-spring`. */
export const EASE_SPRING = EASE_SPRING_FALLBACK;
/** The close of a grow: the travel curve, reversed — since 18 Nov Settle's reverse. */
export const EASE_EMPHASIZED_REVERSED = EASE_SETTLE_REVERSED;

/*
 * ⏱ THE GROW, RETIMED (18 Nov): the press 120 → Tap 100, the shape 360 → Move 320. The content and the chrome keep the
 * SAME PROPORTIONS OF THE SHAPE that 13 Nov had, measured from the shape's own start (= the press's end):
 *   13 Nov  content  320 − 120 = 200 → 200 / 360 = 0.5556 of the shape
 *           chrome   440 − 120 = 320 → 320 / 360 = 0.8889 of the shape
 *   18 Nov  content  0.5556 × 320 = 177.8 → 178 → from the press 100 + 178 = 278
 *           chrome   0.8889 × 320 = 284.4 → 284 → from the press 100 + 284 = 384
 * Total, press to the bar in place: 384 + 200 = 584 ms (was 640).
 */
export const MOTION_TABLE = {
  /** Press in: scale 0.97 + shade. Reduced: shade only. */
  pressInMs: TAP_MS,
  pressScale: 0.97,
  /** Release: scale back to 1 on the spring. Reduced: none. */
  releaseMs: RELEASE_MS,
  /** Ripple, the row's main button only: from the touch point. Reduced: off. */
  rippleMs: 520,
  /** Loading in a button: fades in, then turns one lap per this many ms (label and size stay). */
  spinnerInMs: 120,
  spinnerLapMs: 700,
  /** Toggle: the knob travels with an overshoot; the fill is scaleX; the tick wipes in. Reduced: jumps. */
  toggleMs: 260,
  toggleTickMs: 140,
  /** "Saved ✓" (the standard's Done): in Quick, hold 1.4 s, out Quick (18 Nov; was 160 / 1600 / 300). */
  savedInMs: QUICK_MS,
  savedHoldMs: 1400,
  savedOutMs: QUICK_MS,
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
  /** Swipe to remove: snap back 220 (13 Nov); the row leaves in Quick (18 Nov, was 240), then the gap closes in Move.
   *  Reduced: fades, no slide. */
  swipeSnapMs: 220,
  swipeLeaveMs: QUICK_MS,
  swipeGapMs: MOVE_MS,
  /** Row expands: height on grid rows, chevron rotate, content 3 steps 40 ms apart. Reduced: opens at once, 120 ms fade. */
  rowOpenMs: 320,
  rowShutMs: 260,
  /** Grow to full screen: the press, then the shape (the clip, one layer). Close: every window mirrored at 80 %.
   *  18 Nov: press 120 → Tap, shape 360 → Move. */
  growPressMs: TAP_MS,
  growShapeMs: MOVE_MS,
  growCloseFactor: 0.8,
  /** The page behind steps back while the shape opens. */
  growBehindScale: 0.96,
  growBehindDim: 0.18,
  /** Content arrives in 3 steps, 40 ms apart, each rising this far — from 278 ms after the press (0.5556 of the shape,
   *  as 13 Nov's 320; arithmetic above). */
  growContentStartMs: 278,
  growStepMs: 40,
  growStepRisePx: 10,
  growStepFadeMs: 180,
  /** ✕ and the bottom bar arrive last: 384 → 544 / 584 ms after the press (0.8889 of the shape, as 13 Nov's 440). */
  growChromeStartMs: 384,
  growChromeMs: 160,
  growBarMs: 200,
  /** Late data fades in when it lands. */
  lateFadeMs: 160,
  /** Every reduced-motion fallback that is a fade. */
  reducedFadeMs: 120,
  /** Content steps: how many. */
  steps: 3,
} as const;

/** "press to last part in place" — 584 ms, the table's own total (shape at 100 + 320, chrome 384 → bar in at 584). */
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
