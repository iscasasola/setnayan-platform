## 2026-10-19 · feat(maker-desk): Animate's three phases stacked, Style's looks a 2-column grid (desktop Maker, doc PR 3)

Owner rulings: 2026-10-07 "DESKTOP ADAPTATION APPROVED — ALL FIVE A" (answer 3: "On desktop, Style stacks … and
Animate stacks Build in · Action · Build out"; the doc's "the layout carousel becomes a 2-column grid of real
previews"). Still dark for couples behind `makerDesktopColumnsEnabled`; a phone is untouched.

- **Animate, stacked** (`stage-panel/desk.tsx` `DeskAnimateStack`): the phone's Build in | Action | Build out bar
  once, then Build in, Action and Build out one under the other, each the phone's own rows 2–4 for that phase
  (`AnimateRows` with `phase` + `bare` — the same controls and saves). A press on the bar jumps to its phase;
  scrolling lights the phase in view (the phase ▶ plays and the next part opens on, as the phone's segment).
  Handed to `StageAnimate` by a client store only while a desktop's toolbar is (`useDeskAnimate`); its server
  answer is null, so every first render and every phone draws the four rows of one phase. A one-phase page
  (`only`) keeps its four rows.
- **Style's looks, a 2-column grid** of the same real previews in the same order (CSS on the desk rule set); a
  look of one long line takes the grid's width (the phone gives it 60 % of the strip); the grid stands from the
  rows to the column's foot and scrolls; Style's own last row (Colour · Size) stays last, at the foot; the picked
  look is scrolled into view on opening; a soft gold hover ring on the others.
- Guard: `lib/a-desktop-stacks-animate-a-phone-keeps-one-phase.test.ts` (phone/first render = one phase under one
  bar; desktop = three sections under one bar, each its own phase's rows; handed in only by the desktop's toolbar).
  One source pin re-aimed (`the-rsvp-lines-have-a-look.test.ts`: `only ?? forced ?? phase`).

Decision taken inside the doc (named, not asked): the doc's "Style stacks Look · Background · Arrange" was drawn
when Style had its own three-way bar; the phone retired that bar on 2026-10-09 (one selector, "Edit | Style |
Background | Animate", and Arrange dropped — `TOOLBAR-SPEC-2026-10-09.md`), so on a desktop Style and Background
stay the selector's two tools, as on the phone, and the stacking lands where a second bar still exists: Animate.

SPEC IMPACT: None — builds the approved `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` PR 3.
