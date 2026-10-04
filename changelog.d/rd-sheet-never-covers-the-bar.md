## 2026-10-04 · fix(maker): a closed or folded sheet never covers the bottom bar (RSVP stage dead end)

Live on prod 5a1e75a at 375 × 812: on the RSVP stage (Page ▾ › RSVP · Reply) the
phone's bottom bar (Page ▾ · Look · Event Details) could not be tapped, so there
was no way to another stage. Cause: the RSVP stage is a layer the shell draws
over the work area, but the work area hid its own chrome only under Event
Details (`isShellPage` named `details` alone), so it still mounted the scene
sheet for the `rsvp-stage` tool — since #6329 a `MakerHalfSheet`, `fixed
bottom-0 z-30` at a fixed half height with no scrim. Its top lay under the RSVP
layer; its empty foot lay over the bottom bar (`z-20`).

- `MAKER_SHELL_PAGES` (`maker-bar.ts`) names every page the shell draws over the
  work area (`details`, `rsvp-stage`); `editor-shell.tsx` hides its navigator,
  scene sheet, part sheet and type bar under any of them.
- `MakerHalfSheet` draws nothing while closed (no aside, no slim bar, no hit area).
- Both slim bars (the scene sheet's `HalfSheetSlimBar`, the part sheet's) rest ON
  TOP of the bottom bar on a phone (`SLIM_BAR_SEAT`, `lib/element-sheet-state.ts`).
- Guard: `lib/a-sheet-never-covers-the-bottom-bar.test.ts` (renders the shell on
  every stage, the closed sheet, both slim bars; sabotaged red → green).

SPEC IMPACT: None
