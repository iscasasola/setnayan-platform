## 2026-11-28 · docs(audit): duplicates + under-layer screens

Read-only audit of `apps/web` for duplicate pages and routes, duplicate components and helpers, under-layer (stacked) screens and dead code. The full report is `docs/audits/2026-11-28/dupes-layers.md`.
- It traces the cause of the supplier Plan page's double error: the `@rise/(.)subscription` intercept, no `@rise/error.tsx`, and layout notices outside the boundary.
- 66 rows, in 12 builder groups with no file overlap, plus a NOT COVERED list.
- No app code changed.

SPEC IMPACT: None. A read-only audit. Eight owner or controller calls are flagged inside (R6, R7, R11, D-C3, D-E3, D-F2, X1, X2).
