## 2026-09-19 · fix(checklist): the Budget health card says "couldn't check" instead of hiding or guessing (S41b · couple 6)

One of the four on-screen cases S41 left for later (#5654 kept the reason, the
card still hid). COUPLE-FACING tier of `result-dropped-silently`.

- A refused **budget** read returned `null`, which the checklist renders as "no
  budget set": the card HID.
- A refused **committed-suppliers** read degraded to `[]`, and the card was drawn
  from market ranges as if no supplier were booked. On a money screen, that is
  a buffer that is not true.
- A **throw** left `budgetHealth` null, and the card HID.

All three now yield `BUDGET_HEALTH_UNREADABLE`. `ChecklistFull` draws a "We
couldn't check your budget just now" card that still opens /budget. A budget
that was genuinely never set is still `null`, so there is still no card.

Stacked on #5654 (S41 money 4/4), which adds the logged reason in the same
function. Merge order does not matter: this branch contains it.

Proof: `lib/checklist-budget-health-is-honest.test.ts` executes
`computeBudgetHealth` against a client that refuses per table (5/5). Each of four
sabotages turns exactly one test red.

SPEC IMPACT: None
