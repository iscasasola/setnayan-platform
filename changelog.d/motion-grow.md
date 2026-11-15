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
