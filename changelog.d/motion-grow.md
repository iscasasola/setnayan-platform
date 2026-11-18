## 2026-11-18 · feat(motion): the 18 Nov motion standard combined with the 13 Nov system — tokens, retimes, Sheet grow, guards

Owner, 18 Nov: *"Combine them"* — `MOTION_STANDARD_2026-11-18.md` (specs) is the source; the 13 Nov details keep their
numbers. This block supersedes the numbers in the 2026-11-15 block below where they differ.

- **Tokens** (`lib/motion-table.ts` ↔ `--sn-m-*` in `globals.css`): Tap 100 · Quick 200 · Release 280 · Move 320 ·
  Rise 700 · Sheen loop 1400 linear. Easings: **Settle `cubic-bezier(.2,.8,.2,1)`** (replaces the emphasized
  `(.2,0,0,1)`; the old names stay as aliases, the reversed close is Settle's reverse `(.8,0,.8,.2)`) and **Spring**, a
  27-stop `linear()` real spring (one ~5 % overshoot) with the `cubic-bezier(.34,1.56,.64,1)` fallback under
  `@supports not (transition-timing-function: linear(0, 1))`.
- **Retimes:** grow press 120 → Tap 100 · grow shape 360 → Move 320 · content 320 → 278 and chrome 440 → 384 ms from the
  press (the same proportions of the shape, 200/360 and 320/360 — arithmetic in `motion-table.ts`) · Saved ✓ 200 / hold
  1400 / out 200 · swipe leave 240 → Quick 200, then the gap closes on Move 320. Kept from 13 Nov: press 100 → 0.97
  (row 0.985), release 280, switch 260, chips 220/180, field 260/280, swipe snap 220, close = open at 80 %, page behind
  0.96 + dim, three content steps 40 ms apart, chrome last.
- **Ported from #7686** onto the ONE grow player (`playGrowParts` / `playBehind` moved from `rise-screen.tsx` into
  `lib/rise-screen.ts`, shared): the **Sheet grows out of the pressed button** (`sheetGrowFrames`, transform + one clip)
  and closes back into it at 80 %, still showing what it showed; with no fresh press it just appears. The **swipe snap**
  reads `--sn-m-swipe-snap` on Settle. `lib/grow-motion.ts` was NOT ported (a second engine).
- **Guards:** new `lib/the-motion-standard-tokens.test.ts` (5 speeds, 2 easings, Sheen, spring + fallback, aliases) ·
  new `lib/no-var-in-keyframe-timing.test.ts` (house rule § 3.7) · re-anchored `the-motion-table-is-one`,
  `the-rise-is-0-7s`, `the-top-scrolls-up-and-locks`, `the-picked-client-opens-over-the-list` · new CI guard
  `scripts/lint-motion-raw.mjs` + `scripts/motion-raw.baseline.json` in the `guards` job (counts may only fall).
- **Not changed:** the couple's Event Hub motion (`lib/motion.ts`, `.sn-editorial`), the `--sn-pill-dur` 700 users,
  toasts, loading, the website — later phases.

SPEC IMPACT: MOTION_STANDARD_2026-11-18.md § 0 (already applied in specs fae41fef)

## 2026-11-15 · feat(motion): one timing table — grow from the pressed element, touch feel, rows that open

Owner "motion approved" on prototype `Setnayan-specs/prototypes/approved_2026-11-13/grow-full-screen-fable.html` v1
(DECISION_LOG 2026-11-13 "Motion system approved": *the faster numbers REPLACE the 0.7 s rise (10 Nov) and the 0.7 s
press family (8 Oct)*).

- **One timing table:** `lib/motion-table.ts` ↔ `--sn-m-*` tokens in `globals.css`.
  - Two curves only: emphasized `(.2,0,0,1)` for anything that travels or opens, the house spring for anything that lets go.
  - `lib/the-motion-table-is-one.test.ts` holds the two copies equal.
  - `lib/motion.ts` (the Event Hub arrival's mirror) is untouched.
- **Grow to full screen**, extending `RiseScreen` / `lib/rise-screen.ts` / `lib/rise-motion.ts` (no second opener):
  - The shape is the clip, on one layer: 360 ms emphasized, from the tapped element's own corner radius.
  - The page behind steps back to 0.96 under a light dim.
  - Content arrives in three steps, 40 ms apart (320 · 360 · 400 ms from the press), each rising 10 px.
  - ✕ and the bar arrive last (440 → 640 ms).
  - Close: every window mirrored at 80 %, chrome out first, the shape last.
  - Transform and opacity only; nothing is held after the motion.
  - Reduced motion: a 120 ms cross-fade.
  - Every door already on `RiseScreen` gets it, including the doors PR #7595 puts on it.
- **Touch feel** (`press-feel.tsx`, still one delegated listener set):
  - The press goes in on touch-down (100 ms ease-out, 0.97; a row 0.985) and springs back on lift (280 ms).
  - The row's main button ripples from the real touch point (520 ms).
  - Reduced motion: shade only.
- **Switch:** fill and knob 260 ms, the knob on the house spring.
- **Rows that open** (`Fold`): 320 ms open, 260 ms shut, emphasized; the chevron turns with them; the inside arrives in three steps 40 ms apart.
  - One open at a time was already shipped (`useOneOpen`, owner 4 Oct); this change keeps it.
  - Reduced motion: opens at once with a 120 ms fade.
- **Guards re-anchored to the new numbers, not weakened:** `the-rise-is-0-7s` (kept by name), `the-rise-screen-is-one-full-screen`, `the-top-scrolls-up-and-locks`, `the-press-feels-the-same-everywhere`, `every-switch-wears-the-one-look`, `the-form-row`.

**Not built here, named:**
- The shared pieces travelling (label → title, icon → title, photo → cover), as opt-in marks.
- The skin in the tapped colour.
- Starting the motion before a heavy body renders (mounting the head and grey slots first).
- Prefetch on press-down.
- The text field's grow / floating label / line, and Send waking.
- The chip's sliding fill, swipe-to-remove's glide, the toggle's tick and "Saved ✓", and the loading spinner in a button.
- Moving the ~230 plain `<details>` onto `Fold` "as they are touched".
- `--sn-pill-dur` (700 ms) still paces the pill selector's thumb, toasts, form-row fields and the slider. Those are not in the table; whether they follow is an owner call.

SPEC IMPACT: None. This builds the approved prototype as ruled.
