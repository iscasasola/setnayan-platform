## 2026-11-01 · chore(security): refresh the prod schema snapshot

`supabase/security/prod-schema.snapshot.txt` regenerated read-only from production (`pnpm schema:snapshot`): ledger 1691 migrations, head 20271300072429 (Chapters). It had fallen 41 migrations behind the repo, past the freshness limit of 40, so every PR adding a migration failed DB replay's "the prod snapshot is fresh enough". Limit unchanged.

SPEC IMPACT: None
