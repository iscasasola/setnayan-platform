## 2026-09-18 · feat(merkado): each category rail shows the couple's planned ₱ — the same figure `/budget` prints (SUP-65)

Re-measured first: `/budget` already showed a per-category target (the "Suggested
budget split" and the BA3 ledger's Planned column). The gap was the Merkado, where
the couple actually weighs suppliers: `budgetByPlanGroup` was computed there and fed
only the ranking score.

Each category rail in the Merkado plan now shows its Planned figure — in the
collapsed head, and as a sentence in the open body that says whether it is the
couple's own saved split or our suggestion from their budget, with an Adjust link
to `/budget#budget-allocate`. No plan → nothing is printed (never ₱0).

**One figure, not two.** The ledger's rule (saved plan wins, suggestion is the
fallback, zero is not a plan, wedding-only) was lifted into `resolvePlanned` +
`suggestedPlanByBucket` in `lib/budget-ledger.ts`; `/budget` and the vendors page
both call it. The rails deliberately do NOT print `budgetByPlanGroup`, which also
folds in the band estimate for ranking — that would be a second answer. The
allocation read moved out of the marketplace block so a couple with no shortlist
yet still sees their targets.

Guards: `lib/one-planned-figure-per-category.test.ts` (executes the rule, pins both
pages to it, counts the two mounts); the wedding-gate guard in
`the-plan-meets-the-ledger.test.ts` now EXECUTES the gate in the helper and still
pins that `/budget` passes `isWeddingBudget`.

SPEC IMPACT: None — surfaces an existing computation; no new money source.
