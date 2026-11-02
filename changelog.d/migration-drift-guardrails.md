## 2026-07-02 · feat(migrations): drift guardrails so the pipeline stops jamming

Root-cause fix for the recurring migration failure class. ~Every migration
incident in this repo (the 2026-07-02 `event_launch_mode` jam, 2026-06-22, 2026-06-17,
2026-06-08 …) is the same shape: a migration reaches the prod ledger **before its
PR merges** (a local `db push` from a feature worktree, an MCP apply, or a raw
`db query`), leaving an **orphan** (ledger row, no file on `main`) that makes
`supabase db push` refuse for *every* branch and silently **strands** later-merged
migrations in code-but-not-DB until a user hits a broken feature.

Existing tooling covered duplicate timestamps + auto-apply-on-merge but nothing
*prevented* or *detected* this class. Added four pieces:

1. **`pnpm migration:doctor`** (`scripts/migration-doctor.mjs`, unit-tested) — diffs
   the prod ledger against `origin/main` and reports **orphans** (with the owning
   branch, so the surgical file-land or `migration repair` is one copy-paste) and
   **stranded** migrations (merged-but-unapplied; freshly-merged files within a
   grace window are ignored as normal post-merge latency). One command replaces
   the ~30-step hand playbook.
2. **`migration-drift-monitor.yml`** — runs the doctor every 2 h + after each apply,
   and FAILS (→ GitHub notifies) on real drift, so a jam surfaces in minutes not days.
3. **Self-diagnosing apply** — `supabase-migrations.yml` now runs the doctor when
   `db push` fails, printing *which* orphan is blocking and the exact fix in the run.
4. **`pnpm db:push`** (`scripts/db-push-guard.mjs`) — guarded wrapper that refuses to
   apply any migration that is unmerged AND unapplied (the precise orphan-creating
   condition). README now documents CI as the sole applier + rolled-back-txn
   verification, replacing the old "apply with `supabase db push`" anti-pattern line.

No app-code / schema change. SPEC IMPACT: None (developer tooling + CI only).
