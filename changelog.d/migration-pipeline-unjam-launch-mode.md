## 2026-07-02 · fix(migrations): unjam the auto-apply pipeline (orphan 20270426100000)

The Supabase migration pipeline was jammed again — the same class as the 2026-06-22
incident. `supabase db push` failed for every merge since 2026-07-01 (CI runs for
PRs #2563, #2581, #2584 all RED) with *"Remote migration versions not found in local
migrations directory"* because `20270426100000_event_launch_mode` (from the still-open
PR #2562 `claude/launch-manual-auto-mode`) had been **applied to prod ahead of its
merge** — its ledger row is in `supabase_migrations.schema_migrations` and its
`events.launch_mode`/`manual_phase` columns are live, but the file wasn't on `main`.

The jam silently stranded **4 already-merged migrations** (shipped in code via Vercel,
never applied to the DB): the vendor Locked-QR trio (`20270426214000/215000/216000`,
PR #2584) and `20270426250948_vendor_coverages_addons_base_pax` (PR #2581). The latter
meant the `vendor_coverages` + `vendor_service_addons` tables and `vendor_services.base_pax`
column did **not exist in prod** → the vendor coverage-first feature was erroring live.

Fix, two parts:
1. **Applied the 4 stranded migrations to prod** (`db push --include-all`; all idempotent —
   `CREATE TABLE/ADD COLUMN/OR REPLACE … IF NOT EXISTS`). Verified all objects present with RLS.
2. **Surgical unjam** (documented pattern): land **only** `20270426100000_event_launch_mode.sql`
   onto `main`, byte-identical to PR #2562's copy. `main`'s files now match the remote ledger →
   `db push` unblocked. The columns are already in prod and the migration is idempotent, so it
   records without re-running; when PR #2562 merges, the file is already present and identical → no conflict.

No app-code change. SPEC IMPACT: None (migration-pipeline reconciliation only).
