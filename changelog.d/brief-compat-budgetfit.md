## 2026-07-12 · feat(vendors): budget planner's compat % now reflects budget fit

The per-candidate compatibility % on the couple's budget-planner accordion fed the scorer only distance/reviews/verified — so `compat-score`'s `budgetFit` dimension (0.20, the second-heaviest) sat frozen at neutral **on the very surface where budget matters most**. The marketplace category-search overlay already scored budget fit; the planner did not.

Now `apps/web/app/dashboard/[eventId]/vendors/page.tsx` runs the same median-anchored allocation engine (`resolveAllocationInputs` → `computeBudgetAllocation`) once per page load — only when a budget is set, fail-open on any error — and stamps a per-vendor `budget_fit_ratio` (`priceFitScore(starting_price_php, the couple's allocated ₱ for the vendor's category)`) onto each `AccordionPick` via `VendorEnrichment`. Both accordion `computeCompatScore` call sites feed it, so the % (and the "Fits your budget" reason from `explainCompatScore`) now move with budget fit. Derivation extracted to a pure, unit-tested helper `lib/vendor-budget-fit.ts` (7 tests). No schema change.

Deferred (own follow-ups): `faithFit` needs a vendor `compatible_ceremony_types` join into the accordion query; `dateHeadroom` needs a multi-date availability RPC; checklist priority-tailoring needs an authored priority→category map.

SPEC IMPACT: None (behaviour — matching signal, no schema/pricing change; realises more of the Event Brief → compat-score wiring).
