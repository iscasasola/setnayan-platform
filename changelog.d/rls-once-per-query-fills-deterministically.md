## 2026-10-21 · test(db): rls-checks-once-per-query fills the same 300/325 tables on every run

`DB replay (4/6)` was flaky on `main`: the META floor in
`apps/web/tests/db/rls-checks-once-per-query.db.test.ts` (≥ 85 % of the matrix
tables hold fixture rows) landed at 277/325 on some runs and 275/325 on others.

**Cause.** The schema-driven filler pointed each FK at a parent row with
`SELECT … FROM <parent> LIMIT 1`, with no ORDER BY. The planner answered
`vendor_profiles` with an Index Only Scan on its uuid primary key, so "the first
shop" was whichever `gen_random_uuid()` sorted lowest. When it was the linked
supplier's shop, every review attempt was refused by the self-review gate
(`block_related_account_review`, `device_match`: the filler gave every writer
the same `device_hash`), and `vendor_reviews` and `vendor_review_flags` both
stayed empty, so 277 became 275.

**Fix (test only).** Parent rows are now chosen by write order (`xmin`, then
`ctid`), never by a key, and every other catalog choice has an explicit order.
Coverage went up as well: composite FKs resolve (`(event_id, guest_id)` and
similar), all-default tables insert `DEFAULT VALUES`, empty FK parents outside
the matrix are filled first, `vendor_services` and `discount_codes` are
hand-seeded, and a mode-1 retry (run only where the plain row was refused)
uses a second person, per-writer text, time columns an hour apart and the
writer's own parent row. Result: 300/325 on six consecutive local runs, with an
identical fill fingerprint each time (the test now prints it). The floor is
raised from 0.85 to 0.90, and the failure message now gives the reason each
table is still empty.

SPEC IMPACT: None.
