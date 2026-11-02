## 2026-07-28 · fix(packages): customization options that showed a price now actually charge it

The couple-side package configurator has been rendering priced follow-up
options, priced extra picks on "choose N of M" lines, and an hour stepper — and
committing **₱0** for all three at lock. This completes that charge path.

**The root cause was one select list.** `VENDOR_PACKAGE_ITEM_SELECT` deliberately
withheld the five branching columns (`parent_option_id`, `pick_min`, `pick_max`,
`max_extra_hours`, `extra_hour_centavos`) from the couple-side money path,
because naming a column whose migration had not landed would be a PostgREST 400
on a money action. Every line therefore reached the pricer looking top-level and
exactly-one-of-N, so a follow-up pick and a second pick resolved to nothing and
an extra hour had no field to travel in. **All 14 columns in the widened select
were verified present on live prod `vendor_package_items`** (queried directly,
2026-07-28) before the list was widened, and the list is now pinned against the
migrations by test — so the 400-on-a-money-action risk is discharged
empirically, not just by assertion.

### What changed

- **`VENDOR_PACKAGE_ITEM_SELECT` carries the five branching columns**, for BOTH
  money callers at once (`lockPackage` and `removeItemFromPackage` — widening
  one alone is the drift `priceCustomizedPackage` exists to prevent). The
  now-redundant `, parent_option_id` appends were removed from all three read
  sites, and `/v/[slug]`'s flag-gated two-query split collapsed to one query.
- **The credit engine (`package-credit.ts`) walks a reveal tree.** A follow-up
  whose parent option is in force is resolved like any other choice line and its
  own option delta is charged; `option_on_excluded_item` now fires only for a
  line the booking genuinely does not contain (a plain add-on, or a follow-up
  whose parent was not picked). A line admits up to `pick_max` options and
  **every** pick carries its own delta; `multiple_options_for_item` still fires
  above the cap, and a new `pick_below_minimum` refuses below `pick_min`.
  Follow-ups are reported in a new `revealedItemIds`, kept out of `keptItemIds`,
  so a conditional line still never cascades an `event_vendors` row.
- **Extra hours are wired end to end** — modal → `extra_hours` in the payload →
  server clamp against `max_extra_hours` → billed at `extra_hour_centavos` →
  recorded in `customizations_json`. They are credit SPEND, so they drain the
  pool before touching the price. The modal already had the stepper UI and the
  `ChoiceSelection` already modelled it; only the wire and the pricing were
  missing.
- **`chargeableOptionIds` is still the ONE function** the live total and the
  commit both call, so display total ≡ committed total by construction. It now
  walks `visibleLineTree`, which means **visibility bounds chargeability**: a
  follow-up whose parent was never picked is dropped before pricing, and refused
  by the engine if a hand-rolled payload sends it anyway. `chargeableExtraHours`
  is its hour-axis twin with the same contract.
- **`removeItemFromPackage` re-narrows** rather than replaying stored ids, so
  dropping a parent line drops its follow-up charges with it (replaying would
  have made a legitimate removal throw), and writes the re-narrowed sets back so
  the record matches the total.
- **A latent hole in `vendor-packages.columns.test.ts` was fixed.** Its migration
  parser ended each `ALTER TABLE` at the first `;`, including one inside a SQL
  comment — so it silently reported `extra_hour_centavos`, `hour_base_centavos`,
  `min_hours`, `transport_mode` and `transport_flat_centavos` as not existing. A
  column guard that under-reports the schema red-flags valid selects until
  someone deletes it. Now comment- and quote-aware, with an anti-vacuity test.

### Behaviour a couple or vendor will notice

- A picked follow-up option, every pick on a pick-N line, and each extra hour now
  appear in the total and in `total_locked_centavos`.
- Priced options on a follow-up / second pick are now **offered** where they were
  previously greyed out with "Ask your vendor — not part of this total".
- The extra-hours row reads "Up to N · ₱X per hour" instead of "your vendor
  quotes these".
- A pick-N line below its minimum now has **no price at all** (the lock refuses)
  rather than a price coincidentally equal to the finished one. The modal already
  blocked the button on this.
- An order-dependence disappeared: picking a free option that sorted before an
  already-picked priced one used to silently demote the priced one to ₱0.

### Booking fee

`total_locked_centavos`, `event_vendors.total_cost_php` and
`collectBookingFeeAtLock` consume the widened total automatically; no
booking-fee code was touched. **The §6.4 fee base now includes vendor-authored
option deltas the couple explicitly picked — that is the intended behaviour
completing, not a reprice.** The rate and schedule are unchanged.

### Flags

No new flag. `packageAuthoringEnabled()` (OFF in prod) is the only way a
follow-up / pick-N / hourly line can exist at all, so the new shapes are already
gated at authoring; `packageCreditEnabled()` (OFF in prod) gates the configurator
UI. The flag-OFF pricing path was widened too, because the two flags are
independent and leaving it at ₱0 would mean "credit off" gave every upgrade away
free. Live prod holds **0 `vendor_packages`, 0 `vendor_package_items` and 0
locked bookings** (queried 2026-07-28), so there is no existing data this can
reprice — live behaviour is unchanged until authoring is flipped and a vendor
builds a package.

Gates: `tsc --noEmit` clean · `pnpm run test:unit` 5130/5130 (was 5098) · ESLint
clean on touched files · `lint:dup-rule` green. `dup-rule.baseline.txt` gained 5
lines for the deliberate narrow read at `lib/budget.ts:316`, which needs six
columns for a budget row and none of the branching ones.

No migration: every column already exists in prod.

SPEC IMPACT: The 2026-07-27 boundary "a follow-up pick / an extra pick / an extra
hour is priced at exactly zero" is RETIRED — all three are now charged. Worth a
`DECISION_LOG.md` row noting that the package booking-fee base widened to include
explicitly-picked option deltas and extra hours (no rate change).
