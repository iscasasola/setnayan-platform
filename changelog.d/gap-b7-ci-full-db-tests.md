## 2026-07-24 · fix(ci): run the FULL db suite + app unit tests as merge gates

Gap audit 2026-07-23 · Batch B7. CI ran only a 2-test curated `test:db:ci`
list, so the whole `tests/db/*.db.test.ts` suite (widget-seed reconcile,
open-browse-schema, seat-lookup-exact-match, live-media, …) never gated a PR —
a migration/schema regression could merge silently. And `test:unit`'s
`lib/**` glob missed 19 test cases in 2 `app/**` files.

- `test:db:ci` → the full `tests/db/*.db.test.ts` suite (102 tests, ~20s, all
  in-memory PGlite, no external DB).
- `test:unit` glob widened to `lib/**/*.test.ts` + `app/**/*.test.ts`
  (2957 tests, +19).

Verified: `pnpm test:unit` 2957/2957 · `pnpm test:db:ci` 102/102.

SPEC IMPACT: None — CI hardening only.
