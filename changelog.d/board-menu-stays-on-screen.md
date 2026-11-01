## 2026-10-28 · fix(board): the events board ⋯ menu stays on screen; "View Event Hub" when guests can open one

Owner, 27 Oct (phone screenshots): on a LEFT-column card the ⋯ menu ran off the left edge ("this away", "ove for
good"); and *"View event hub add that if event hub is available for that event"*.

- Cause: the menu's side (`align`) came from the card's grid column; an earlier one-column change removed the
  alternation (and a guard forbade it back), then the board went two-up again. Now the open menu is MEASURED and slid
  inside the 16-px gutter (`menuShiftIntoView`, `lib/menu-place.ts`) — whatever the grid does. Measured at 390
  (Chromium + WebKit): left card's menu starts at x=16 (was ≈ −97), right card's ends at 374.
- "View Event Hub · What your guests see." is the first row when the event has a slug AND its page is Public or
  Unlisted (Home's rule, `lib/home-control.server.ts`); opens through `openEventHub` (in-app sheet / new tab).
  The board reads visibility in its OWN small query — `fetchUserEvents` is not widened (one ungranted column would
  reject every dashboard); a failed read only drops the row.
- Guard `lib/the-board-menu-stays-on-screen.test.ts` — 4 checks, each sabotaged red then restored.

SPEC IMPACT: None
