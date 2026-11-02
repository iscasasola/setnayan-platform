## 2026-07-08 · feat(checklist): live budget health-check on the checklist

Wires the previously-dead `computeBudgetHealth()` into the checklist page — the
first piece of the "printable list → execution engine" turn. A budget-health
card now shows the couple whether their plan is affordable: best/worst-case
buffer range + one honest health line (good range / you're close / might be
over), linking to the budget page.

- New pure `lib/checklist-budget-format.ts` (`formatPeso`, `budgetHealthCopy`)
  — unit-tested, importable outside a request context (checklist-budget.ts is
  server-only).
- `checklist/page.tsx` calls `computeBudgetHealth` (try/catch graceful-degrade →
  null); `ChecklistFull` renders the card only when a budget is set.

Additive + null-safe: the existing task list is untouched; the card is hidden
when no budget exists or the budget tables error. No schema change.

SPEC IMPACT: PR-1 (engine wiring) of
`02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md`. Corpus current.
