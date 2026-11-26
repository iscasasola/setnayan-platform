## 2026-11-25 · fix(area 7): final-check lane A batch 3 — the supplier's seat plan counts the hosts' seats

Final check (25 Nov), area 7, lane A:

- A7-17 — `get_vendor_seat_plan` now sends each table's `removed_seats` (migration `20271363213887`, CREATE OR REPLACE only, every gate unchanged). The supplier's "N of M seated" counts seats with the hosts' `effectiveCapacity`, so a table with 2 chairs removed reads "6 of 8" on both sides. When a table's covers add up to fewer than its seated guests, one line says why (guests the hosts did not count for this supplier).

Not in this batch: A7-16 (redraw the supplier's map with the shared seat-plan engine) changes the screen — proposed for lane B.

Tests: `tests/db/the-supplier-seat-plan-counts-removed-chairs.db.test.ts` (new).

SPEC IMPACT: None — one more field on an existing read; the count rule is the hosts' own.
