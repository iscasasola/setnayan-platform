## 2026-09-19 · fix(vendor-bookings): the Bookings list tags a row from the booking, not from chat activity (S43 · 2)

`app/vendor-dashboard/bookings/surface.tsx` tagged each row "New" when it had an
unread chat notification and "Stale" when nobody had typed for 30 days. Neither
is a fact about the booking: a paid couple who went quiet read as Stale, and a
declined ask with one unread "thanks" read as New.

The tag is now derived in `bookings/booking-list-status.ts` from the booking
state, through the existing ladder (`resolveThreadStage`):

- **New** — the couple asked and the shop has not answered (`inquiry_status = 'pending'`);
- **In progress** — In conversation · Quoted · Booked (the row pill shows which);
- **Closed** — Completed or Cancelled.

Booked comes from `fetchVendorRoomEvents` (pool · agreed lock · Locked QR),
Quoted from sent/viewed `vendor_proposals`, Completed from `rowReadsCompleted`
over the shop's own `event_vendors` rows (admin client, scoped by shop id).
Each read degrades toward "not yet" and is logged. Unread stays visible as its
own marker. The retired `?status=stale` link lands on All.

Guard: `bookings/booking-list-status.test.ts` (ladder cases + a source check that
the surface uses it and the 30-day timer is gone; sabotage-checked red).

SPEC IMPACT: None.
