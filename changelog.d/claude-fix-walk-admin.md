## 2026-11-13 · fix(admin): the admin walk round (F-A-…)

- **F-A-02** Money: a booking fee paid through its order (`vendor_booking_fee__<chargeId>`) counted under "Software
  sales" while "Booking fees" read "0 paid · ₱0". `splitPaidRevenue` (`lib/admin/revenue-statement.ts`) puts each paid
  order in its real kind; a paid fee charge already carried by a paid order is not counted twice. The total is unchanged.
- **F-A-18** `/admin/insights` now opens Insights' first view, Overview (it landed on Intelligence).
- **F-A-19** `/admin/vendors/verification` (a soft 404 — read as a shop id) redirects to `/admin/verify`.

SPEC IMPACT: None.
