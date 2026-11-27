## 2026-11-27 · fix(guests): the coordinator's Guests row sits under the coordinating line, not over it

Found in the Apple build 10 walkthrough: in an event the account coordinates, Guests showed dark bars down both sides of its top row and a blank gap under it.

- **Cause:** the event layout draws the coordinator's slim dark line (`coordinating-line.tsx`) in the flow under the app's bar, for a coordinator who has a shop. The Guests row is fixed at the bar's bottom (`--gs-top`) on the column's edges. It covered the full-width line: the line's dark ends peeked out either side, "Back to your shop" was under the row, and the row's holder left an empty band under the line.
- **Fix:** Guests' `--gs-top` now counts the part of that line still on screen: all of it at rest, none once it has scrolled under the bar. The row, its group heads and the full-screen views follow the one value. The paper band above the row stops at the line (`--gs-under`). No line (every host, co-host, helper) means the same single write as before and no scroll listener. No redesign.
- **Guard:** `app/dashboard/[eventId]/guests/_components/the-pinned-row-sits-under-the-coordinating-line.test.ts`. Red without the fix. `lib/guests-top-row-and-full-screen.test.ts` (8) now accepts the band's `--gs-under` lift (0 px for everyone else).
- No server action, no migration, no new read.

SPEC IMPACT: None. A bug fix on approved screens (coordinator line, owner 2026-10-28; Guests pinned row, owner 2026-10-30).
