## 2026-11-25 · fix(supplier): final check area 6, batch 6: the supplier's guest group counts who counts, and the rows still open from batches A1–A3

Lane A fixes from the 25 Nov final check (area 6). No look change beyond one missing number; no amount, fee or rule changed.

- **The supplier's guest group (A6-57).** New pipeline migration `supplier_group_counts_who_counts` replaces only the RETURN of `supplier_booking_group`.
  - The group lists only guests who count by the one guest rule (`countsTowardEvent`): no deleted guest, no pending request, no one who passed away, no represented role holder.
  - A new `counted` field is that number without the declined; a declined guest stays listed with their reply.
  - Their event › Numbers and › Guests show `counted` (`groupCounted`, lib/their-event.ts), never the row count.
- **Their event › Numbers adds up (A6-B19).** "Can't come" is shown beside Coming · Maybe · No reply, so the four parts equal Invited.
- **Their event schedule (A6-52).** The dead "View" word on each schedule row is gone.
- **On the day (A6-19).** The media cap is `MAX_PER_TYPE` from lib/editorial-vendor-media (no second number); the subscription, customers, repertoire, client and profile links use `lib/routes.ts`. (The two "up to 3" words sit in lines #8324 changes; they move to the constant after it lands.)
- **The lock page (A6-29).** A refused date-options read says "We couldn't check it against your date options." instead of a silent "changes your date"; a refused shortlist read says "We couldn't check whether your shortlisted suppliers are free then." instead of dropping the warning; "wedding date" is "event date". Both reads are logged.
- **The Clients hub's addresses (A6-38c).** New `routes.vendorDashboard.customers(query?)`; Customers' ⚙ and asking door, the Dates ⚙ and Today's Inquiries stat use it. (The day sheet's back link sits next to a line #8331 changes; it moves after that lands.)
- **A booked client's chat (A6-B10).** No "An inquiry · Your turn · Reply with an offer" card and no "Sending our price now" quick reply once the client is booked (the brief's booked stage / the thread's booked stage, both from the booked status set).
- **Tests:** `app/vendor-dashboard/area-6-batch-6-holds.test.ts`; `tests/db/the-supplier-group-counts-who-counts.db.test.ts` (a group of 5 with 1 declined and 1 deleted counts 3; passed-away, request and represented guests are neither listed nor counted). Server actions: no new export.
- Migration applied by the pipeline only. Not run by hand.

SPEC IMPACT: None. Honest-state, one-reader and wiring fixes (CLAUDE.md §4 Guest row, §5 rule 4, design-and-wiring A3); no product decision changed.
