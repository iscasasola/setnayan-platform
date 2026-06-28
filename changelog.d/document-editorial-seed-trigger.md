## 2026-06-28 · docs(db): COMMENT the editorial-seed trigger + prove auto-apply path

Migration `20270317587803_document_editorial_seed_trigger.sql` adds COMMENTs to `seed_event_editorial()` + its trigger (from `20270316888459`). Idempotent (COMMENT-only).

Doubles as the first end-to-end proof of the FIXED Supabase auto-apply pipeline on the REAL trigger: the earlier fix (#2375 `--include-all` + `DO_NOT_TRACK`) + the ledger reconciliation were validated via `workflow_dispatch`, but never via the production "push to main touching `supabase/migrations/**`" path. Merging this migration exercises exactly that path.

SPEC IMPACT: None. DB documentation only.
