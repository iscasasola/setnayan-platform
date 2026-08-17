## 2026-08-17 · fix(security): the second lock — batch 2, 17 more tables closed to anon

Continues batch 1 (`20271145190664`, 16 tables). **33 of 213 now closed.**
🟢 Nothing was leaking and nothing changes for any client: RLS denies all of
these already. What goes is the spare key underneath — the Supabase default
privilege set, applied to `public` and never narrowed.

**Re-derived from scratch** against the live catalog and `origin/main`; batch 1's
shortlist was NOT reused, because grants and code both move. All **six** gates,
with gate 6 (`security_invoker` view chains) now applied from the start rather
than learned mid-batch: 188 candidates passed gates 1/2/3/6, 171 fail gate 4,
15 failed gate 5 and were each **read** before inclusion.

**Two corrections to batch 1's own method, applied here:**
- Gate 5 used a **bare substring** — `render_jobs` looked queried 13 times
  because it is a substring of `patiktok_render_jobs`. Wrong in the conservative
  direction (it only shrank the batch) but it made the shortlist untrustworthy.
  Word-bounded now.
- Gate 4 now resolves a table name held in a **constant** (`from(TABLE)` where
  `const TABLE = '…'`) — 18 call sites use it, and a literal-only scan is blind
  to them. Same blind spot that made the switches guard accuse a working screen.

🔑 **Four of the seventeen are reached ONLY through `SECURITY DEFINER`
functions**, which execute as owner and never consult the caller's table grants —
read from `pg_proc.prosecdef` in prod, not inferred: `rate_limit_hits`
(`check_rate_limit`, which anon cannot even execute) · `seating_editor_locks`
(four RPCs) · `papic_event_pool_usage` and `papic_seat_day_usage` (the metering
family). `lib/ugat/graph.ts` says of the locks table: *"LOOKS DEAD AND IS FULLY
LIVE … It was nearly deleted on the strength of that grep."* The grep is not the
access path, and neither is it the grant.

🪤 **`rate_limit_hits` has no `CREATE TABLE` in any migration — because it is
`CREATE UNLOGGED TABLE`.** My declaration check was too narrow, not the schema
drifting, and `schema-drift.db.test.ts` had already written that exact false
positive down. All 17 were then confirmed present in the replay directly, so a
plain REVOKE is replay-safe and none needs batch 1's `to_regclass` guard.

**Verification.** Dry-run against production in a rolled-back transaction:
anon SELECT 17→0, TRUNCATE 17→0; controls `guests`, `vendor_ad_subscriptions`,
`vendor_tool_bundles` and `authenticated`-on-`render_jobs` all unmoved;
column-ACL rows 376→376 (no collateral); `vendor_market_stats` still returns its
rows. Then confirmed all 17 still granted after ROLLBACK.

Mutations, occurrence counts before → after: drop one REVOKE 1→0 ✅ red, naming
the table · add a view-backed table to the batch 0→1 ✅ red on the gate-6
assertion · empty batch 2's list 17→0 ✅ red on META — that last one caught a
defect in my own guard, where the anti-vacuity check still measured only batch
1's length and would have absorbed the deletion of all seventeen.

⏭ The remaining ~180 are dominated by gate-4 failures — tables the app genuinely
queries — so the next batch is **not** another easy sweep.

SPEC IMPACT: None.
