## 2026-09-18 · fix(vendor-overview): a supplier's "Upcoming" lists every real booking, not only pool rows (SUP-8)

`lib/vendor-overview.ts` built the Overview's Upcoming list from
`fetchVendorPoolBookings`, the one reader its own comment named as "a real gap,
named not fixed". The schedule pool has a single writer, so a supplier who
pressed Agree (`vendor_agree_to_lock`) or whose Locked QR a couple claimed held
no pool row and was missing from their own Upcoming list.

It now reads `fetchVendorRoomEvents`, the same three-arm answer (pool · agreed
lock · claimed Locked QR, day-precision dates only) every day-of screen already
uses. The blocker the comment named — row ids keyed on `poolBookingId`, which
those bookings lack — is fixed by `upcomingRowId`, keyed on (event, date), the
key `dedupe` already makes unique.

Measured against prod 2026-09-18: rosa-ben (contracted, `lock_request_state =
'agreed'`, 2026-10-30, day precision) also holds a pool row, so it appears
exactly once before and after (the pool arm is admitted first; `dedupe` drops
the agreed-lock duplicate). Both live booked rows in prod hold pool rows, so
nobody is missing TODAY — the fix closes the gap before the first Agree-only
booking falls into it.

Guard: `lib/vendor-room-access.test.ts` — the Overview joins the room-read sites
(10 → 11 calls), leaves the pool-read list (12 → 11), and a new test pins the
row id to (event, date) with no `poolBookingId`.

SPEC IMPACT: None.
