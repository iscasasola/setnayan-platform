## 2026-09-20 · fix(vendor-money): the Overview desk, open payment asks, manpower offers and disputes read to the end

This fixes what the #5724 sweep found and left. Stacked on #5724. It reuses #5720's
`readAllPages` / `readInChunks` and the shared `paginate()` + `<ListPager>`. No new helper.

1. **Overview answers desk** (`lib/vendor-overview.ts` → new `lib/vendor-overview-desk-reads.ts`).
   Deposits awaiting acknowledgement, declined deposits, booking asks and deletion
   asks were four un-ranged reads of the shop's bookings. Each now pages to the
   exact count and reports `complete`. `fetchLockAgreementRequests` used to discard
   its error. It now reports it. Any short read sets `deskIncomplete`, and
   `WhatsNewFeed` then says "Some booking asks and deposits couldn't load". It
   never draws "You're all caught up" on top of a read that failed.
   `fetchEventMeta` is now chunked under the gateway's roughly 600-id `in.()` refusal.
2. **Open payment asks on one booking** (`clients/[eventId]/page.tsx` → new
   `lib/vendor-payment-asks-read.ts`). The read was `.limit(20)`, so a 21st open ask
   was hidden. It now reads all of them. A short read is shown as "we could not
   load what you have already asked for". The deploy-window missing-relation
   carve-out still works.
3. **Manpower gig offers** (`manpower/surface.tsx` → new `lib/vendor-manpower-reads.ts`).
   The booked-events read that decides which gigs appear is now paged. The
   open-gig `in.()` is now chunked and merged newest-first. A partial list says so.
4. **Disputes** (`disputes/page.tsx` → new `lib/vendor-disputes-read.ts`). The page
   stopped at 200 rows. It now reads them all and shows 20 per page through the
   shared pager (`?dpage=`). The open count covers every dispute.

Guards: `lib/the-four-small-lists-read-to-the-end.test.ts` is extended on the same
fake server (at most 1,000 rows per request, refuses `.in()` lists over 600). It
drives every reader past its old cap and adds a refused-read case for each one.
New `an-unread-desk-is-not-caught-up.test.ts` renders the feed to check two
things: an incomplete read says "couldn't load", and the "caught up" state is never
drawn over it. Each guard was sabotaged once and went red.
`a-shop-cannot-read-its-own-booking.test.ts` now pins the moved manpower read at
its new module.

SPEC IMPACT: None
