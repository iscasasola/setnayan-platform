# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-09 · feat(vendors): crew-meal coverage and derived quantity (no double-count)

Owner-locked 2026-07-09. A booked crew-meal provider covers the crews of OTHER booked vendors. The couple marks which vendors are covered and each vendor's crew size; the crew-meal quantity is DERIVED (Σ covered crew sizes) rather than guessed; and a covered vendor's own per-vendor crew-meal budget line is superseded so the cost is counted ONCE — in the provider's package — not twice.

- **Migration `20270525955536`** — `event_vendors` gains `crew_size INTEGER` (CHECK ≥ 0) + `crew_meal_covered BOOLEAN NOT NULL DEFAULT FALSE`. Additive; inherits the existing couple-only RLS (`event_vendors_couple_read/write` via `current_couple_event_ids()`).
- **`updateVendorCosts`** — parses `crew_size` + `crew_meal_covered`; when covered, sets `food_allowance_php = null`. Because the budget rollup builds `crewMealByVendorId` from `food_allowance_php`, nulling it makes the covered vendor's crew-meal contribution drop out automatically — the anti-double-count guard, no rollup change needed.
- **Vendor workspace costing form** — every non-crew-meal vendor gets a "Crew size on the day" input + a "Crew fed by your crew-meal provider" toggle (shown only when the event actually has a crew-meal provider booked). The crew-meal provider's own workspace shows the derived "Covering N meals" summary to price its Service line against (per-meal rate × count).

Confirms the connect-gate decision: crew-meal vendors must be Verified+ to transact (Option 1) — no change, already enforced.

Verification: `pnpm typecheck` clean; `pnpm test:unit` 1246/1246 pass. Deferred (couple-entered for now): auto-seeding `crew_size` from the marketplace listing's `crew_size` via `marketplace_vendor_id`.

SPEC IMPACT: Extends the Crew-Meal Provider Marketplace — logged in DECISION_LOG.md (2026-07-09 coverage row). Resolves the budget double-count flagged in the 2026-07-09 flow audit.
