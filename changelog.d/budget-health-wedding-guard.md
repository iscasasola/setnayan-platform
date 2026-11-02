## 2026-07-08 · fix(checklist): gate the budget health-check card to weddings

`computeBudgetHealth`'s tiers, benchmarks, and paperwork line are all
wedding-shaped, and generic onboarding DOES write `estimated_budget_centavos`
(`lib/onboarding/event-insert.ts:71-72`) — so a non-wedding event with a budget
rendered wedding-shaped health numbers on the checklist. The card is now
wedding-only (null → hidden for other types), mirroring the `isWeddingBudget`
gate the budget page already has (`budget/page.tsx:141`).

Lifted by the per-event-type budget model — PR-B1 of
`02_Specifications/Budget_Genericization_Design_2026-07-08.md` §4; PR-B3
re-enables per type with real per-type tiers/benchmarks.

No schema change. Wedding behavior unchanged.

SPEC IMPACT: implements PR-B1 of the budget genericization plan. Corpus current.
