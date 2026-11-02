## 2026-07-30 · chore(ci): CI is cron-free too — both remaining schedules removed, drift now watches the real applier

Owner, 2026-07-30: *"we want to stay cron free."* The Vercel layer has been cron-free since 2026-07-12 (`vercel.json` crons `[]`, periodic work on `claim_periodic_job` fired from `after()`), but **two GitHub Actions schedules were still running** and sat outside that win. Both are gone; `grep -rn "cron:" .github/workflows/` now returns nothing.

### Why the 30-minute migration cron is genuinely redundant now — and wasn't before

It existed because `supabase-migrations.yml`'s `push` trigger can silently skip: the shared concurrency group keeps one in-progress + one pending run, so a burst of migration merges supersedes the middle ones (live 2026-07-22 with #3546/#3549, and **five more times on 2026-07-30**).

But supersession is not what made those skips *persist* — the **`paths: ['supabase/migrations/**']` filter** did. A skipped apply could only be swept up by the next merge that *also* touched that folder, and on 2026-07-30 the merges that followed were security and UI work. Nothing applied for **75 minutes**.

`deploy-prod.yml` has **no paths filter** and runs `db push --include-all` on **every** push to main as the first half of migrate-then-deploy. So any merge, of any kind, now sweeps up everything pending. That is exactly what the cron was standing in for — event-driven instead of scheduled.

### ⚠ The trap this nearly walked into

`migration-drift-monitor.yml` re-checked on `workflow_run` of **`supabase-migrations` only**. Since the cutover that workflow fires only on migration-path merges, so deleting its 2-hourly schedule *without touching that list* would have meant the drift check almost never ran again — **a silent loss of coverage dressed up as a saving.** Its `workflow_run` now lists `['deploy-prod', 'supabase-migrations']`, deploy-prod first, because deploy-prod is the applier that actually runs.

### Both files carry a DO-NOT-RE-ADD

Not just "removed", but why — including that a schedule on `deploy-prod` is far worse than one here: its deploy-hook step is gated only on `gate.outputs.enabled`, never on whether `db push` applied anything, so a cron there fires a **production build every firing** (~48/day of unchanged code) on a repo that has already burned ~$787 on no-op builds.

**If a burst ever does drop the last run:** `gh workflow run deploy-prod.yml --ref main`. That remains the manual fallback, and `workflow_dispatch` is retained on both workflows for it.

SPEC IMPACT: None — CI only. Recorded in `DECISION_LOG.md` 2026-07-30 and memory `project_setnayan_cron_free`.
