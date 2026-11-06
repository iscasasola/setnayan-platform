## 2026-11-06 · feat(plans): bookings per date per service card is a plan allowance · the Ultra add-ons go on sale

Owner, 2026-11-06 (DECISION_LOG): *"Solo has 1 per date/service, pro has 3 per date/service, ultra has 5 per
date/service"* and *"seat, branch + 990 / the rest is +199"*.

- **Bookings per date per card** — `TIER_CAPS[t].bookingsPerDatePerService` (Solo 1 · Pro 3 · Ultra 5 · Custom as
  Ultra) with its SQL twin `vendor_tier_limit(…,'bookings_per_date_per_service')`. One new SQL helper,
  `service_card_daily_limit(card)`, is the card's own "Bookings per day" inside its plan (a blank card takes the plan's
  number), and every reader of the per-card daily limit now reads it: the supplier's yes (`vendor_agree_to_lock`), the
  day check (`vendor_day_check`), the bench search (`service_cards_unbookable_on`) and the couple's ask
  (`finalizeVendor` #2). A Solo card already booked once on a date refuses the second. Bookings a card already holds are
  never touched. ⏳ **Free / Verified: the owner has not ruled** — unchanged (the card's own number; SQL NULL, TS
  `BOOKINGS_PER_DATE_NOT_RULED`).
- **The card editor** shows the cap and the Ultra add-on beside "How many a day · this card", bounds the field, and the
  three save paths refuse a NEW number past the plan (an untouched grandfathered number re-saves).
- **Ultra add-ons** (`vendor_billing_catalog`, per 4 weeks, Ultra only): branch ₱1,990 → **₱990**; seat stays ₱990;
  **+1 category ₱199** (the dark ₱499 `vendor_extra_category` row of 2026-11-04 repriced and put on sale — one row per
  fact) · **+1 service card ₱199** (`vendor_extra_service_card`, new; the dark "+2 cards ₱99" row is marked superseded)
  · **+1 wait list ₱199** (`vendor_extra_waitlist`) · **+1 booking per date ₱199** (`vendor_extra_booking_per_date`).
  New offering types `category · service_card · waitlist · booking_per_date` (the seat/branch pattern). Yearly siblings
  are 10× DERIVED in SQL and dark.
- **Wired the way the seat is**: `canBuyExtraCategories/ServiceCards/Waitlist/BookingsPerDate`; an apply-then-pay order
  `vendor_extra_<kind>__<vendor_profile_id>` (`buyUltraAddOn`, one dispatcher); on approval the sku-activation hook
  recomputes a paid count on `vendor_profiles` (`extra_parent_categories · extra_services_per_leaf ·
  extra_waitlist_acceptances · extra_bookings_per_date`, guarded against self-grant, granted to `authenticated` by
  column, `vendor_profiles_self` rebuilt), a refund lowers it; `fetchEffectiveCaps` adds the counts to the plan's
  allowance, so the service-card, category, coverage and wait-list checks all see what was bought; the waitlist SQL
  clamp counts it too (held under the column's 0..10).
- **One list, from the catalogue**: `ultraAddOns()` (lib/vendor-ultra-addons.ts) returns every Ultra add-on in the
  owner's order — categories · service cards · team seat · branches · wait list · bookings per date. The Plan page's
  new "Bigger than Ultra? Add more." block renders it (Ultra buys; other plans read "Only Ultra can add these"). The
  For Suppliers page (#7328, unmerged, untouched here) should render it too.
- Admin › Pricing labels every supplier offering type (it knew three, so seat/branch/add-on rows had no type).
- Fallbacks moved with the row: `BRANCH_FEE_PHP` 990, and the Custom rate card's branch unit 990 (it prices from the
  same `vendor_additional_branch` row).

Migration `20271316466285_ultra_addons_and_bookings_per_date.sql` (never applied by hand). Tests:
`tests/db/bookings-per-date-is-a-plan-allowance.db.test.ts` (new), `vendor-plan-allowances.db.test.ts` (SQL twin in
step), `lib/vendor-ultra-addons.test.ts` (new — a purchase raises the effective cap), guards retargeted:
`h6-mirrors-the-booking-path`, `activation-ownership-gate`, `vendor-surface-service-keys`, `order-price-authority`,
`a-year-is-ten-four-week-cycles`, `replay-order-is-honest`, the day-check and lock-path-2 DB tests (their 2-a-day
shop is now Pro, since Solo takes 1).

SPEC IMPACT: None in this PR — the controller recorded both 2026-11-06 rulings in DECISION_LOG ("BOOKINGS PER DATE PER
SERVICE IS A PLAN ALLOWANCE", "ULTRA ADD-ON PRICES"). Open for the owner: the Free/Verified bookings-per-date number;
whether the plan cap should also bind a SLOTTED card (today its slots decide, unchanged).
