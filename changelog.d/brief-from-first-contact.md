## 2026-09-20 · feat(vendor): the supplier sees the whole brief from first contact

Owner, 2026-09-20, asked whether a supplier who has not agreed yet should see the couple's budget range and guest count or only their name: *"they already see everything from the starts."*

- `get_vendor_event_brief` (migration `20271235469220`) now also opens for an unanswered (pending, not archived) inquiry thread and for any non-archived `event_vendors` row of the caller's shop, such as a shortlist row. It used to open only for a booking, a pending ask or an accepted thread. Nothing that opened before is refused now.
- Every stage now gets the same brief: couple name, date, venue name and address, region, ceremony type, headcount, meal counts (food categories only), the opt-in budget range, palette, monogram, run-of-show, and seat-plan status and size. `vendor_roster` (other shops by name) stays booked-only.
- The brief's timeline now drops a coordinator's `coordinator_only` lines at every stage. This boundary had never been applied inside the function.
- `/vendor-dashboard/clients/[eventId]`: the venue, meals, seat-plan size and a read-only run-of-show render before agreement. The "Unlocks when they book you" rows are gone. "This couple" shows only when the name is missing or blank. Booking-only tools (suggest forms, handovers, floor plan, production sheet) still wait for a booking.
- Tests: `tests/db/the-brief-from-first-contact.db.test.ts` (new, sabotage-proven), `the-brief-reaches-the-page.test.ts` (new, sabotage-proven). The superseded ceiling assertions in `lock-handshake-slice-b` and `the-vendor-brief-survives-its-own-schema-drops` were rewritten as value positives.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-20 "THE SUPPLIER SEES THE WHOLE BRIEF FROM FIRST CONTACT" (Setnayan-specs `2a3d09b`). It supersedes the 2026-07-03 Customer Card disclosure ladder and PR-H slice B's payload ceiling.
