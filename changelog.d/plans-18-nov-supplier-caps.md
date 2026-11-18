## 2026-11-18 · feat(plans): supplier plans rebuilt — cards in total, no plan cap on bookings per date, 500 a day

Owner 2026-11-18, DECISION_LOG "SUPPLIER PLANS REBUILT" + "SUPPLIER CARDS: MAX 80, ULTRA 200" (rulings 17 · 18 · 23 ·
24 · 26 · 28–33 · 35 · 39 in `PLAN_RULINGS_2026-11-18.md`). Plans never limit what brings a booking; they differ only
on reach, size and tools. This change carries the numbers for the five plans that exist today — `enterprise` carries
the numbers of the plan now called **Max**. The new top plan (Ultra ₱19,990), the "Max" label and the ₱990-per-10
extra-cards pack are separate changes.

- **Bookings per date are no longer a plan limit** (ruling 17). `TIER_CAPS[t].bookingsPerDatePerService` removed;
  `service_card_daily_limit` returns the card's own `daily_capacity`; the editor's refusal is only the 500 ceiling;
  the plan table, plan sheet and downgrade sheet drop their "bookings a day" rows.
- **The shop's own daily limit 50 → 500** (ruling 18): `DAILY_CAPACITY_MAX` and the CHECK on
  `vendor_schedule_pools.daily_booking_capacity`.
- **Service cards counted IN TOTAL** (rulings 23 · 39): `servicesPerLeaf` → `serviceCardsTotal` 1 · 3 · 10 · 20 · 80.
  Both create gates, the card maker's standing, the hold picker, the open-shop meter and every page line count the
  total. Shops already over keep every card.
- Main categories 1 · 1 · 2 · 8 · 12 · seats beyond the owner 0 · 0 · 1 · 5 · 11 · branches 0 · 0 · 0 · 2 · 5 ·
  storage — · — · 5 · 10 · 20 GB · reach 5 · 10 · 50 · 100 km · nationwide · waitlist no plan limit (10, the
  column's own ceiling) · form video links Pro and up, uploads Max · basic graphs from Verified ·
  `cardMakerDetailed` (Verified and up) and `floorPlanUnits` (Pro and up) added for the card maker build to read.
- Migration `20271350427190_supplier_plans_rebuilt_2026_11_18`: the CHECK, `vendor_plan_contents` rows (new key
  `service_cards_total`; the `services_per_leaf` and `bookings_per_date_per_service` rows removed), the catalogue
  plan rows' `max_categories` / `max_sub_seats`, `vendor_tier_limit()` fallback, `service_card_daily_limit()`.
  No price is written.

SPEC IMPACT: `DECISION_LOG.md` 2026-11-18 rows say "NOT BUILT" for these items — a follow-up row records what this PR
built and what is still open (Ultra tier, Max label, extra-cards pack, Home snapshot hidden for unverified Free).
