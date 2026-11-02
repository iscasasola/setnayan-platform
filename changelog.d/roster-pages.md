## 2026-09-20 · feat(vendor-customers): the roster and every long supplier list page by 20, the roster gains a name search, and the reads under them stop dropping customers at scale

Owner, 2026-09-19, on My Customers as Saysay: "if they have 50 customers/100
customers, can we do it in pages? so if they have 1000 inquiries, they can
still manage all and still be able to see the lower parts of the page?"

**Paging, one rule.** `lib/paginate.ts` (`paginate`, `pageWindowFor`,
`pagerWindow`, `pageHref`, `filterBySearch`; `LIST_PAGE_SIZE = 20`) and one
shared `<ListPager>` (`app/vendor-dashboard/_components/list-pager.tsx`,
"1–20 of 1,000 · ‹ Prev · 1 2 … 50 · Next ›", compact "3 / 50" below `sm`).
An out-of-range page clamps to the last page. Every list on the hub pages
through its own param so they never reset each other:

- Customers roster — `?page=`, plus a name search `?q=` (couple/event name,
  accent-insensitive, applied before paging). Lane chips and the heading's
  "N waiting on you" stay whole-list totals. Composed in the pure
  `customers/roster-view.ts`: count → lane → search → page → decorate, so
  page 1 still opens on who is waiting.
- Bookings (always on under the roster) — `?bkpage=`. Latest-message previews
  and customer names are now read for the page's rows only.
- Messages — `?mpage=` (active) and `?mapage=` (Archived).
- Clients — `?cbpage=` (Booked), `?cipage=` (In conversation), `?copage=` (Outside).
- Proposals — `?ppage=`, paged in SQL with an exact count. **This list was a
  silent `.limit(50)`**: proposal 51 onward was unreachable.

**Scale honesty — reads that dropped customers with `error: null`.**

- `fetchVendorThreads` (roster, Bookings, Messages, Clients) and
  `fetchVendorPoolBookings` were one un-ranged SELECT each, capped by
  PostgREST's max-rows (Supabase default 1000). Both now page to the server's
  exact count via `readAllPages` (moved unchanged from `lib/verification-docs.ts`
  to `lib/read-all-pages.ts`, re-exported). `fetchVendorThreadsDetailed`
  reports `complete`, and a list whose read did not reach the end says so under
  the list instead of looking shorter.
- The roster's `event_vendors` read — same cap, same fix.
- `.in('event_id', <every id>)` enrichment reads (roster events, customer
  names, pool bookings, room events, Bookings' quoted/completed facts). Measured
  against production on 2026-09-20 with random UUIDs: 600 ids → 200, 700 ids →
  **400 Bad Request**. A refused read blanked every name/date on the list at
  once. Now chunked 100 ids a read (`readInChunks`), failures logged.

Guards: `lib/paginate.test.ts` (boundaries, clamping, totals, SQL/in-memory
parity) and `customers/the-roster-pages.test.ts` (executes `rosterView` on
1,000 customers, renders the roster and counts 20 `<li>` against whole-list
chip counts, source-guards that the page renders the slice and that all five
lists mount the shared pager on distinct params). Each sabotaged once.

Not fixed, named: `vendor_payday_installments` (an RPC, same 1000-row cap, feeds
the money notes and the Payday tile), `fetchVendorBlocks`, the notifications
read behind Bookings' "Unread" dot, and `fetchVendorRoomEvents`' own
`event_vendors` candidate read are still single un-ranged reads.

SPEC IMPACT: None.
