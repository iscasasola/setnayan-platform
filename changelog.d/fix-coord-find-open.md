## 2026-11-27 · fix(suppliers): the coordinator's Find › Open now opens Find

Found in the Apple build 10 walkthrough: in an event the account helps with, Suppliers › Find › "Open" did nothing when tapped.

- **Cause:** the row was a link to `/dashboard/<id>/vendors?tab=shortlist`, the page it already stands on. A soft navigation keeps the Suppliers shell mounted, and the shell reads `initialTab` once, so nothing moved (the trap `go-to-find.tsx` already names).
- **Fix:** the row is now a button (`find-open.tsx`). It asks the shell's own bus for Find (`goToBuildTab('shortlist')`) and brings the shell up under the app's bar, at once when Find already shows, or once the shell has swapped to Find. Same words, same row; no redesign.
- **Guard:** `app/dashboard/[eventId]/vendors/the-coordinators-find-open-moves.test.ts` (rendered and executed). Red on the old link.
- No server action, no migration, no new read.

SPEC IMPACT: None. A bug fix on the approved coordinator Suppliers line (drawing `their_event_door_2026-11-21`, frame 4).
