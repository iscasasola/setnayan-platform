## 2026-11-13 · feat(suppliers): a self-added supplier says how its price works — One price · Per guest · Per hour

Owner-approved prototype `prototypes/manual_service_price_basis_2026-11-13/index.html` (owner: "Approved", 13 Nov).
The couple's Add-a-supplier sheet (`new-manual-vendor-modal.tsx`) and its record card (`record-card-folds.tsx`) gain
**How the price works ▾** above the shipped Price row: the Card Maker's own words (`PRICING_BASIS_OPTIONS`, "One price"
for a flat price) in the house PickMenu — a tap opens the three choices, never cycles. Default One price (today's
behaviour, unchanged). The Price row is named by the choice: Per guest shows "× N guests it counts = ₱total" and
"Set who it counts on the guest list ›"; Per hour shows "× H hours on the schedule = ₱total" from that supplier's
Arrive → Done on the schedule, and with no times "No times for them on the schedule yet, so no total." with
"Set their hours on the schedule ›" — and no total. The saved card on Suppliers reads
"₱1,350 per guest · 120 counted · ₱162,000".

- **Schema (migration `20271342032145_a_self_added_price_says_how_it_works`).** Rule 0 first: no existing
  `event_vendors` column encodes a basis or a rate (`pax_quote_base` / `cost_basis_pax` / `pax_surcharge_php` are counts
  and money for the retired added-guest surcharge). New `event_vendors.pricing_basis` ('per_pax' | 'per_hour', NULL =
  One price) + `pricing_rate_php`, set together (CHECK). Columns ride the table's existing RLS. `total_cost_php` stays
  the one total; the save writes it through `updateVendorCosts`.
- **Per head on the guest list.** `event_vendor_counts_per_head` now also counts a booking whose own basis is per guest,
  so a self-added caterer shows on the guest list's per-head Show & sort row and takes "Not counted for ▾" ticks / rules.
- **The total follows, on the pax-follow's own path.** `quote_follow_guest_count_quietly` (called by every guest-list
  trigger since #7516) also runs `self_added_price_follow`; a statement trigger on `event_schedule_blocks` runs it when the
  schedule moves (the per-hour twin). Count = `quote_guest_count` (the same per-service count the pax-follow uses).
  Never a guessed total: no hours / nobody counted → `total_cost_php` is left as it was.
- **Reads are honest.** `get_self_added_price_terms` (numbers only; couple · guest-list helper · admin) — a refused read
  says "Couldn't read your guest list just now, so no total yet." and never draws ₱0.

Tests: `tests/db/a-self-added-price-says-how-it-works.db.test.ts`, `lib/self-added-price-basis.test.ts`; two guards
updated for the moved Price row (`a-typed-row-keeps-its-answer`, `agreed-total-and-its-changes`).

SPEC IMPACT: None — implements the approved 2026-11-13 decision-log rows ("A MANUALLY ADDED SERVICE SAYS HOW ITS PRICE
WORKS", "PER-GUEST SERVICES ARE SET ON THE GUEST LIST · PER-HOUR SERVICES ARE SET ON SCHEDULES", "MANUAL SERVICE PRICE
BASIS — PROTOTYPE APPROVED"). Flagged for the owner in the PR: the hours rule (earliest → latest tagged moment) and
"nobody counted yet → no total" were build choices, not drawn in the prototype.
