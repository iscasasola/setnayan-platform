## 2026-09-19 · fix(vendor-clients): "Booked via Setnayan" lists every real booking, not only pool rows (S43 · 1)

The Clients section of My Customers (`app/vendor-dashboard/clients/surface.tsx`)
built its "Booked via Setnayan" list from `fetchVendorPoolBookings`. The
schedule pool has one writer, so a shop that pressed Agree
(`vendor_agree_to_lock`) or whose Locked QR a couple claimed held no pool row
and was missing from its own booked-customer list — the gap #5634 closed on
Today's Upcoming.

It now reads `fetchVendorRoomEvents` (pool · agreed lock · claimed Locked QR),
the helper #5634 reused. A row with no pool is labelled by the arm that
admitted it ("You agreed to lock" / "Booked with your Locked QR") instead of a
guessed schedule name. The empty-state copy now says a booking lands here when
the shop agrees or the downpayment is recorded.

Guard: `lib/vendor-room-access.test.ts` — Clients joins the room-read sites
(11 → 12 calls) and leaves the pool-read list (11 → 10).

SPEC IMPACT: None.
