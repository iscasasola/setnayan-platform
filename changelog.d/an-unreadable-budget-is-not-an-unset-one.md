## 2026-09-02 · fix(clusters): an unreadable budget is not an unset one

Follow-up to 7d (#5091), found reviewing my own diff rather than by a failure.

`fetchClusterBudgets` collapsed two different facts into one branch:

```ts
if (centavos === null || !Number.isFinite(centavos)) return { state: 'none' };
```

A NULL column is the host's own answer — *no target yet*. An **unparseable**
value is not: it is a figure we failed to read. Folded together, a garbled
`estimated_budget_centavos` would print **"No budget set yet"** over a budget
the host really typed — which is precisely the defect the module was written to
prevent, surviving in its own least likely branch.

`estimated_budget_centavos` is `BIGINT` and PostgREST may return it as a string,
so the parse is defensive and this is not reachable through normal data. It is
fixed anyway: the two cases are now separate returns, and unparseable falls to
`unknown`. Mutation-proved — folding it back into `none` turns the new test red.

23 unit tests green (was 22), `tsc` clean.

SPEC IMPACT: None — 7d's recorded behaviour is unchanged; this makes the code
match what the DECISION_LOG row and the PR already claim it does.
