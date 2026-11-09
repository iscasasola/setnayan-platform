## 2026-11-08 · feat(date-picker): the one shared date sheet — Build 3 Lane D part 1

The app's ONE date pop-up, built to the approved prototype v3.1 (`Setnayan-specs/prototypes/date_picker_2026-11-09/`,
artifact MfhZ3LUJpns19SDzFGDtTx v4; DECISION_LOG 📆 2026-11-09). Built on the shipped parts, never beside them:
`CalendarGrid` is the month, `ActionButton` the buttons, `InfoTip` the ⓘ, `OverlayBackdrop` the dark.

- `app/_components/date-sheet.tsx` — the house bottom sheet: quick choices first, the month only after "Pick a date";
  the month never stretched (the sheet minus 16-px sides, 360 px cap; greyed whole neighbours when they fit; swipe,
  ‹ › or a tap on a greyed month); a not-available day can never be chosen and a tap says why on the hint line;
  meetings get a slot list where only times free for everyone can be Set; Cancel | Set at equal widths. The month glide
  and the rise read `--sn-pill-dur` (700 ms, via `press-feel.tsx`'s `pressMs`) and `--sn-pill-spring`; reduced motion
  moves nothing.
- `app/_components/date-sheet-lazy.tsx` — the one door: `React.lazy`, so the sheet is its own chunk fetched on first open.
- `lib/date-sheet.ts` — the pure rules (widths, neighbours, quick choices per use, busy words, the Set gate).
- `calendar.tsx` `CalendarGrid` — additive props: `month` (held by the screen), `steps`, `glide`, `refuse` + `onRefused`.
  Every existing caller is unchanged.
- `form-row-date.tsx` `DateRow` — opt-in `sheet` prop opens the shared sheet; without it the row is exactly as before.
  No screen passes it yet (the rollout is Part 2).
- `/dev/date-sheet-lab` — the four uses of the prototype on fixtures (404 in production).
- Guard: `app/_components/the-date-sheet.test.ts`. `lib/the-calendar.test.ts` reads the row's new `open && !sheet` branch.

The Build 3 card date fields (Valid until, Meeting) are not on `main` yet, so nothing is wired to them here.

SPEC IMPACT: None. Builds the approved Lane D contract as written; no ruling changed.
