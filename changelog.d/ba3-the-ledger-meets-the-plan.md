## 2026-09-03 · feat(budget): the plan and the ledger finally meet

`/dashboard/[eventId]/budget` now prints one row per category —
**Planned · Agreed · Paid · Owed** — with a bar showing paid inside agreed and
the overage drawn past the plan mark, and the absorption plan behind a tap.

Both halves already shipped and neither could see the other:

* `EventMoney.byBucket` (`apps/web/lib/budget-truth.ts`) has computed per-plan-group
  `committedPhp · paidPhp · stillOwedPhp · overpaidPhp · hasBenchmark · benchmarkPhp · due`
  on **every** budget page load since BUD-1, and outside tests and
  `apps/web/scripts/budget-parity.ts` it had **zero readers**. Computed and thrown away.
* `computeBudgetOverspend` (`apps/web/lib/budget-overspend.ts`) is caller-agnostic by
  design, and its only caller passed the couple's **slider** as `actualPhp` — so the
  one surface that could say "you signed for more than you planned" was instead
  saying "you dragged a slider past a suggestion".

A couple could plan ₱450,000 for catering, sign a ₱480,000 caterer, and read nothing
anywhere that put those two numbers in one sentence. They do now, and the absorption
plan names the categories with the headroom to cover it.

**New:** `apps/web/lib/budget-ledger.ts` (pure), `budget-ledger-table.tsx` (server
component — the disclosure is a native `<details>`, no client JS), and
`fetchSavedAllocationPlan` in `apps/web/lib/budget-allocation-data.ts` — the first
read-back of a couple's own `budget_allocation_decisions` snapshot, which has been
write-only from the couple's side since it shipped.

**§18.5 rule 5 is structural, not remembered.** 13 of 27 active benchmark leaves carry
a NULL `benchmark_php` in production (measured 2026-09-03) and real money lands in them
anyway — prod event `947e7bab…` has ₱30,000 agreed on Cake, ₱45,000 on Cocktail Booths,
₱22,000 on Photobooth, all against no seeded price. `plannedFrom()` folds 0 to `null`,
so **a ₱0 Planned figure is not representable**; those rows render "—" and say
"no typical price yet".

**The row says whose number it is.** `budget_allocation_decisions` had **0 rows in
production** on 2026-09-03, so today every Planned figure is the allocation engine's
suggestion, and each row is labelled *"Suggested — not yet saved"* rather than filed
under "what you budgeted". Same precedent as `AllocationInputs.budgetSource`.

**Headroom that is banked vs merely unspent.** Feeding agreed money to the absorption
engine means a category nobody has booked shows its whole plan as headroom — which is
not savings. `nothingAgreedYet` / `unbankedSourceKeys` split them, and the disclosure
says so instead of promising cover that disappears the moment the couple books.

Guards: `apps/web/app/dashboard/[eventId]/budget/the-plan-meets-the-ledger.test.ts`
(a bucket carrying money always gets a row · an unseeded category never prints ₱0
Planned · the four names are never abbreviated or reordered · the measurement reaches
the render · BA2's no-quotes rule still holds), plus `apps/web/lib/budget-ledger.test.ts`.
Every source detector is run against hand-written sabotage as well as the real file —
the first version of the ₱0 guard scanned the **totals** cell while the sabotage lands
in the **row** cell, passed green, and would have shipped inert.

Not touched: no migration; `resolveEventMoney` unchanged; the planner's own
"over the suggested split" banner is left alone — it is about the plan being drafted,
not about signed money, and its copy already names its own subject.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §18.5 — the four column names
(Planned · Agreed · Paid · Owed) and the saved-then-suggested provenance rule for
"Planned" are now shipped and fenced; §18.5 rule 5's "never ₱0" is enforced
structurally by `plannedFrom()`. Applied to the corpus in the same commit.
