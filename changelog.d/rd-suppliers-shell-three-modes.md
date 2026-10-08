## 2026-10-08 · feat(suppliers): one screen — Find · Build · Booked shell (Suppliers PR1)

Owner 2026-10-07: *"we want to create a uni screen interface … which handles
everything we have and still keeps it un clumped."* Plan:
`SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1 (the shell) + what was still missing
from PR0; prototype `prototypes/suppliers_page_2026-10-07_fable.html`.

**What the couple sees on `/dashboard/[eventId]/vendors`**

- **The date · place line** at the top — the only place on the page the date and
  the place appear. Each value opens the shipped field for that fact (the Maker's
  own `DateEditor` / `VenuesEditor`, in the Event Details sheet, with its Undo ·
  Apply). The line itself never writes. A refused event read says "Couldn't load
  your date and place" — never "Pick your date".
- **Find · Build N/M · Booked N** — ONE segmented control (the shipped `ISegmented`,
  wine), counts through `<Count>`. It and the line stay pinned under the app's top
  bar as the page scrolls (`--stick-h` measured; the bar's own height is measured
  too, since it slides away on a phone).
- **One body that swaps**, opening at its top. A body is drawn when first shown and
  then kept (hidden, never unmounted), so its own state survives a switch and the
  first paint draws one body, not three.
- **The cart peek** — a two-line ink card for 2.5 s when a supplier is added to the
  build: who was added, then the build's count and total, and "View this build".
  It peeks only for a pick that SAVED.

**Each body is a stub mounting the shipped section it will replace** (PR2–PR4
redraw them): Find = the "Find a supplier" door + the bench · Build = the picks +
the saved builds · Booked = the team's rows + the payments lens.

**Retired, as the plan names:** the five-row "Your planning" menu (`PlanningList`
+ its test), the hidden `#team-find-area` and its lazy mount, and the second chat
icon on this page (`ChatsDoor`) — the top bar's Messages icon is the only inbox
door. Also gone with the one tall scroll that needed them: the 380 px desktop rail
and the Show / Hide fold on Payments and Your plans.

**Kept, unchanged for every caller:** the `BB_TAB_EVENT` / `goToBuildTab` bus,
`?tab=` and the `#svc-*` anchors. The segmented control drives the bus (a press
dispatches its mode's own tab key) and the bus drives the control (`shortlist` →
Find · `build` / `compare` → Build · `budget` → Booked). One new event beside it,
`bb:build-added`, is how the two shipped "Add to build" buttons tell the shell to
peek.

**No new read, no new schema, +0 server actions.** "Build N/M" and the build's
money come from the plan model `BuildLocked` already draws, summed by the same
`teamMoney` (an unpriced pick is counted, never added as ₱0; with nothing priced
the peek prints no peso figure at all). "Booked N" is `teamCountsLine` over the rows the
Booked body draws. The place is the BOOKED venue by the Event Hub's own rule
(`pickVenueBookingRows`) plus the event's area.

**PR0 (foundation) — measured against the tree, only the gap built.** ActionButton,
`useFitRow`, Count, Fill, the four tone tokens and both guard tests were already
shipped. Missing: the Ugat lines for the six tables this page leans on — added as
six reasoned `map-backlog` lines in `tests/db/ugat-concept.baseline.txt`
(`event_build_picks`, `budget_builds`, `vendor_invites`, `vendor_follows`,
`event_vendor_payments`, `event_manual_vendors`). The check is not weakened.

**Tests.** New: `lib/suppliers-shell.test.ts` (the rules, executed) and
`vendors/build-cart.test.ts`. Re-pointed at the new order:
`your-team-phone-first`, `suppliers-opens-fast` (the first paint is EXECUTED — one
body per paint, for every `?tab=`), `suppliers-keeps-the-shell-bar` (+ the pinned
block sits under the bar), `marketplace-masthead-and-layout`, `pillar-parts`
(Budget's door is the payments lens in Booked), `chats-badge-equals-the-list`
(a second chat door stays gone). Regenerated: `port-control-baseline.json`
(the three deliberate removals), `lib/ugat/screens.generated.json`.

**No "View this build" pill.** The first PR1 text drew a black pill in the thumb
bar; the owner's 2026-10-07 evening ruling took it out ("the Build segment and
the cart peek after Add to build are the doors") and the prototype at corpus
HEAD draws none. In Find the thumb bar is the search · add row, which is PR2.

**Not in this PR (said, not dropped):** the in-place date and venue sheets (PR5 —
the two values open the shipped Event Details field for now, which leaves this
page); the Find thumb bar's expand · search · add (PR2);
`BuildLocked`'s own Date and Location tiles still show inside the Build stub
until PR3 redraws it.

SPEC IMPACT: None — builds `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR0/PR1 as
written; deviations are listed in the PR body for the owner.
