## 2026-07-09 · feat(overview): budget mini-donut in BudgetCountdownHeader

Second "Energy, not skin" density widget on the Overview cockpit: the budget
header (`BudgetCountdownHeader`) gains a **committed-vs-budget mini-donut**
(reusing `ProgressRing`) beside the countdown/date — "X% of budget" committed,
shown only when a target is set.

- Additive: the Target / Committed / Projected three-number row is unchanged;
  the donut is hidden when there's no budget target.
- Can exceed 100% (over budget) — the ring clamps visually, the label shows the
  true %. Over/under messaging stays in the existing Projected-line status copy.
- No data / query changes; reuses `committedCentavos` + `targetCentavos`.

`tsc` + `next lint` clean.

SPEC IMPACT: None.
