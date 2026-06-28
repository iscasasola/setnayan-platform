## 2026-06-28 · fix(ci): supabase auto-apply uses `db push --include-all`

The `supabase-migrations.yml` auto-apply workflow was failing on every migration merge, so no migration had been auto-applying to prod (the backlog was being applied by hand). Two root causes, both fixed today:

1. **Phantom-ledger drift (one-time, fixed via DB reconciliation):** the prod `supabase_migrations.schema_migrations` table held 21 "version" rows with no migration file in the repo (migrations applied out-of-band via the dashboard SQL editor / MCP). `db push` aborts with "Remote migration versions not found in local migrations directory" until reconciled. Cleared the 21 orphan rows (DDL stays — `repair --status reverted` equivalent) and recorded 3 already-applied-but-unrecorded migrations (`papic_unlock_bundle_granting_sku`, `iteration_0017_patiktok_clip_tagging`, `vendor_business_owner_name`) so push skips them. A 6-agent verification workflow classified each pending migration against prod first — it caught that re-running `papic_unlock_bundle_granting_sku` would have silently resurrected the SDE bundle child that `remove_sde` just removed.

2. **Out-of-order guard (this PR):** the remaining genuinely-pending migrations have timestamps that sort before the latest applied version, so `db push` refuses without `--include-all`. Added the flag. The `pnpm migration:new` allocator keeps new prefixes monotonic, so `--include-all` is a no-op on the normal path and only matters for the out-of-order tail.

Net: every future migration now self-applies on merge to `main` — no manual `db push`, no out-of-band applies (the practice that created the drift).

SPEC IMPACT: None. CI/infra only.
