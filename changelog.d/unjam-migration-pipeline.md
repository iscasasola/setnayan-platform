## 2026-06-22 · fix(migrations): unjam the auto-apply pipeline (orphan 20270210283954)

The Supabase migration pipeline was jammed: `supabase db push` failed for every branch with *"Remote migration versions not found in local migrations directory"* because `20270210283954_integration_openai_secret` (from the still-open Integration Console PR #2001) had been **applied to prod ahead of its merge** — its ledger row exists in `supabase_migrations.schema_migrations` and its column is live, but the file wasn't on `main`. This silently blocked later-merged migrations (smart seat-plan Phase 2 + Phase 3) from applying to prod until they were repaired by hand.

Surgical unjam (per the documented pattern): land **only** that migration file onto `main`, byte-identical to PR #2001's copy (`git show origin/claude/integration-console-pr2:…`). Now `main`'s files match the remote ledger → `db push` is unblocked. The column is already in prod and the migration is idempotent (`ADD COLUMN IF NOT EXISTS`), so push records it without re-running; when PR #2001 merges, the file is already present and identical → no conflict.

No app-code change. SPEC IMPACT: None (migration-pipeline reconciliation only).
