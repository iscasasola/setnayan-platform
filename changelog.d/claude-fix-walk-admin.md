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
- **F-A-12** Overview: the expense cards name no table or column (`platform_expenses` / `next_due_on`), a failed
  ledger read says so plainly (and is now logged), and the watchlist drops `setnayan.ph` (not ours) and token packs
  (retired).
- **F-A-11** Insights times are Manila time (`lib/admin/manila-stamp.ts`), never a `… UTC` slice or a UTC day.
- **F-A-21** "Celebration removals" reads "Event removals" (page, menu, Work row).
- **F-A-13** Categories no longer names a code file (`lib/attire-designs.ts`). The node keys stay behind their ⓘ, as
  designed.
- **F-A-14** Pricing: the SKU code is not drawn on a price row (the title names it), and "celebration" reads "event".
- **F-A-15** Event types read their admin-managed names ("Get-together", not "simple event") on Intelligence,
  Payments, an account's card, an event's card and Gifts — one reader, `readEventTypeNames()`, over the shipped
  `getEventTypeVocab`.
- **F-A-10** Payouts describes itself once, truly: couples pay suppliers directly, so this is the record of older
  bookings paid through Setnayan. The stage filters no longer advertise the old 20/60/20 split (each older row keeps
  its own share).
- **F-A-16** Problems: an unnamed route no longer prints its code placeholders (`[name]`/`[id]` read "…"), and two
  fingerprints that draw the same sentence (same kind, action, label and page) merge into one row, counts added.
- **F-A-20** Every admin page title reads "Name · Admin" in sentence case (ten were "… HQ", Title Case, or had no
  " · Admin").
- **F-A-24** The admin's name is said once in the header — by the account pill; the loose name beside it is gone.
- **F-A-03** The Work badge (rail and bottom bar) counts the Work page's own total (`deriveQueueUrgency().totalOpen`,
  work waiting) — it summed every queue, the watch-only trails included, and read 624 against the page's 53.
- **F-A-04** Insights' Action Center line states the same numbers as Work ("53 waiting · … — the same as Work"), not its
  own 15-card subset ("15 of 15 queues clear").
- **F-A-05** A queue with no set time (Social) is its own bucket in the Work strip ("no set time") and its row says
  "Oldest 150 days · no set time" — it was counted "on pace" beside "0 past promise".

SPEC IMPACT: None.
