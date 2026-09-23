## 2026-09-23 · chore(security): regenerate the prod schema snapshot after the hand-out retirement

`supabase/security/prod-schema.snapshot.txt` is the **production** half of the drift check
(`schema-drift.db.test.ts` replays the migrations prod's ledger says it applied and
compares). It could only be regenerated **after** migration `20271243295861` actually
applied, which is why it was deliberately left out of that PR.

⚠ **The gate was the object, not the merge.** Verified in prod before regenerating:
`papic_seat_allocations` gone, `papic_dedicate_shots` gone, the migration in the ledger —
and the three things the owner said stay still there (free camera grant 4 rows,
`paparazzi_seats` 24 rows, `papic_seat_grant_releases` present). Regenerating against a
not-yet-migrated prod would have written a **plausible** snapshot, which is worse than a
stale one.

Result: 402 → 401 tables, ledger 1,478 → 1,489, and `events.papic_guest_spend_floor_points`
(the per-guest minimum) now recorded. `schema-drift` 8/8.

SPEC IMPACT: None — this file records what prod holds; the decisions are already logged.
