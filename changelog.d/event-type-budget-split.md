## 2026-06-24 · feat(event-type): gate the wedding budget split to weddings — iteration 0053 Phase 4 (Unit 2)

A **non-wedding event** no longer gets the wedding "Suggested budget split" — the 26 wedding cost categories (reception/ceremony venue, gown/suit attire, officiant, cake, bridal car, etc.) sourced from `budget_leaf_benchmarks`. It now sees a generic budget: the total-budget setter, the summary strip, and the per-vendor itemization (all already event-type-agnostic). **Weddings byte-identical.**

- **`apps/web/app/dashboard/[eventId]/budget/page.tsx`** (only file) — adds `event_type` to the events SELECT and computes `isWeddingBudget = (event_type ?? 'wedding') === 'wedding'` (the exact equivalent of `profile.budgetTaxonomyKey === 'wedding'` — wedding is the only type with a budget taxonomy). The `#budget-allocate` block (the `Suggested budget split` heading + `<BudgetAllocationPlanner>`) renders only when `isWeddingBudget`. The `Promise.all` (incl. `resolveAllocationInputs`) is **unchanged**, so the wedding path is byte-identical — only the non-wedding *render* of the split is gated.

No migration (the `event_type` column + the wedding budget taxonomy already exist). The budget allocation engine + benchmarks are untouched.

**Deferred to Unit 3 (terminology):** the always-rendered header copy `Set your total wedding budget.` (the in-split `typical Filipino wedding costs` line disappears with the gated block).

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean (budget/page not flagged) · unit suite green. Byte-identity is by construction (wedding → `isWeddingBudget` true → the existing split block renders verbatim; `Promise.all` unchanged) — a conditional render wrapper, no logic change.

SPEC IMPACT: Iteration 0053 Phase 4 Unit 2. Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
