## 2026-07-11 · feat(vendors): smart-sort soft re-rank in category search (flag-off)

Wired the pure ranking engine `lib/smart-sort.ts` (+ `lib/smart-sort-flag.ts`,
20 `node:test` unit tests) into the couple's Category Search overlay as a
**SOFT, flag-gated** re-rank. Everything is behind `NEXT_PUBLIC_SMART_SORT_ENABLED`
and **off by default** — with the flag off the search issues the same queries,
returns the same result shape, and produces the byte-identical owner-locked tier
ladder (Favorites → Boosted → Top-10-reviews → Nearest) as before.

When the flag is ON:
- The couple's **live pax** (`lib/pax` · `resolveLivePax`) drives each vendor's
  pax-adjusted "starts at" (`paxAdjustedStartsAtPhp` / `cheapestStartsAt` over the
  vendor's in-scope, standalone `vendor_services` rows).
- The couple's **per-category budget** — the Budget Planner allocation leaf keyed
  by the search `groupId` (`resolveAllocationInputs` + `computeBudgetAllocation`)
  — feeds a SOFT `priceFitScore` that re-orders **only the tail tier**. Because
  the score is a flat 1.0 for every in-budget vendor, affordable vendors keep
  their existing nearest-first order and only over-budget vendors sink. The
  relationship / boosted / top-10-reviews tiers are never reordered, so the
  re-rank cannot cross a tier boundary (HARD GUARDRAIL a).
- `budgetPressure` surfaces a calm "raise your budget?" nudge in the overlay when
  every priced option shown starts above the category budget (HARD GUARDRAIL b).

All smart-sort DB reads fail open (→ null → neutral fit → no reorder), so the
feature can never break or empty the search. No hard budget/availability filter
is applied in this PR (soft only).

SPEC IMPACT: None. Behavior is inert until `NEXT_PUBLIC_SMART_SORT_ENABLED` is
set; no locked SKU, schema, or pricing decision changes. The soft-rank ladder
matches the owner-locked 2026-05-31 category-search tier order.
