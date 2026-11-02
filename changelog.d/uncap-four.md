## 2026-09-20 · fix(vendor-money): the four capped supplier reads #5720 named now read to the end, and the Earnings ledger stops dropping payments past 1,000

Owner, 2026-09-20: "fix the 4 smaller lists too." Stacked on #5720. It reuses
that PR's `readAllPages` (proves completeness against the server's exact count)
and `readInChunks` (100 ids per `in.()`). No new helper.

**The four:**
1. **`vendor_payday_installments()`**: now `readVendorPaydayInstallments`
   (`lib/vendor-payday-read.ts`), paged on (event_vendor_id, seq). It had five
   callers, not three: Payday, the My Customers "Ongoing payments" tile and
   roster money notes, one customer's page (now narrowed to that event), and
   the Overview cash-flow tile. When a read comes up short, those screens say
   "Some payments couldn't load". They never add up what did arrive. The
   customer page used to show "No payments to confirm yet" when the read
   failed. Now it shows the same note.
2. **Calendar blocks**: `fetchVendorBlocksDetailed` (`lib/vendor-schedule.ts`).
   When it comes up short, the Calendar and My Customers show "a date you
   closed may show as open", and Clients' Outside list shows its
   incomplete note.
3. **Unread notifications behind Bookings' "Unread" dot**: now
   `readUnreadChatThreadIds` (`lib/vendor-unread-threads.ts`), moved out of
   `bookings/surface.tsx`.
4. **The booking read inside the booked-events lookup**: the candidate
   `event_vendors` rows and the claimed Locked-QR tokens are now paged, and the
   event lookup is chunked. All three reads moved into `lib/vendor-room-reads.ts`
   so a test can run them (`vendor-room-access.ts` is `server-only`). There is
   also a new `fetchVendorRoomEventsDetailed`. Bookings and Clients' Booked
   list say so when this read comes up short.

**Sweep fixes (money):**
- `fetchVendorLedgerEarnings`: the booking read was capped, and the payments
  were one `in.()` of every booking id (refused past about 600) with
  `.limit(1000)`. Past a thousand payments the year-to-date total was silently
  short. Bookings are now paged, and payments are read 100 bookings at a time,
  each chunk paged. A short read throws.
- The Overview "Earned · this year" tile used to show ₱0 when the ledger threw
  (`.catch(() => [])`). It now shows "Some payments couldn't load"
  (`earningsMeasured`), and the hero's earned figure goes null.
- The Earnings page's payout totals were summed over `.limit(100)`. They are now
  paged, and a short read leaves the totals unset.

Guards: `lib/the-four-small-lists-read-to-the-end.test.ts` uses a fake server
that caps every response at 1,000 rows and refuses an `in.()` of more than 600
ids. It drives each reader past 1,000 rows and asserts the full total, covers
the 1,310-id chunk case, and source-guards each screen's "couldn't load"
branch. Each guard was sabotaged once and went red. Two existing guards pinned
the literal `fetchVendorRoomEvents(` or read one file for the moved queries.
They now accept `…Detailed(` and read both room-read files. Their properties
are unchanged, and a scoping sabotage still turns them red.

SPEC IMPACT: None
