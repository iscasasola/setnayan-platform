## 2026-11-13 · fix(admin): the admin walk round (F-A-…)

- **F-A-02** Money: a booking fee paid through its order (`vendor_booking_fee__<chargeId>`) counted under "Software
  sales" while "Booking fees" read "0 paid · ₱0". `splitPaidRevenue` (`lib/admin/revenue-statement.ts`) puts each paid
  order in its real kind; a paid fee charge already carried by a paid order is not counted twice. The total is unchanged.
- **F-A-18** `/admin/insights` now opens Insights' first view, Overview (it landed on Intelligence).
- **F-A-19** `/admin/vendors/verification` (a soft 404 — read as a shop id) redirects to `/admin/verify`.
- **F-A-23** The booking-fees empty state read "once the booking fee is switched on" while
  `platform_settings.booking_fee_minting_live` was true. It now reads that setting: on · off · or "could not be read".
- **F-A-08** Verification documents are titled by the paper's name (`DOC_SLOTS`, plus "Government ID"), never the raw
  storage path, and their upload day is Manila time. A paper we cannot name keeps its path.
- **F-A-09** The shop's admin page shows Manila dates, and its Payouts empty state no longer says customers pay through
  Setnayan (apply-then-pay: couples pay suppliers directly).
- **F-A-01** The admin empty state no longer prints "Verified: read permitted · 0 rows" (18+ pages): a plain empty
  state. The read is still proven before Empty draws (`readPermitted: true` stays in the type).

SPEC IMPACT: None.
