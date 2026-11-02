## 2026-07-12 · refactor(cron-free): move the last 2 (destructive) crons off Vercel Cron

Final slice of the platform cron-free migration. Converts the two destructive weekly deletes — `retention-sweep` (hard-deletes expired chat) + `papic-fullres-drop` (deletes R2 full-res originals). **`vercel.json` crons is now `[]` — nothing left on Vercel Cron.**

Extra care for destructive jobs: unlike the safe 5, the **routes are RETAINED** (unscheduled) as manual/curl triggers — `papic-fullres-drop` keeps its `?dry=1` preview. Only the *schedule* moved.

- **`apps/web/lib/retention-sweep.ts`** (new) — `runRetentionSweep()` (the route's work, extracted; the safety lives in `purge_expired_chat` — legal-hold exclusion) + `maybeRunRetentionSweep()` (WEEKLY claim). A single atomic DELETE, idempotent, a no-op until events age past 5y.
- **`apps/web/lib/papic-fullres-drop.ts`** — `maybeRunPapicFullResDrop()` (WEEKLY claim → the existing `runFullResDropSweep`, which keeps its `PAPIC_FULLRES_DROP_ENABLED` kill-switch + 500/run limit → bounded + safe-by-default).
- **`apps/web/lib/periodic-jobs.ts`** — `WEEKLY_GAP_MS`.
- **`apps/web/app/admin/layout.tsx`** — fires both weekly maybes from admin-traffic `after()`.
- **`retention-sweep/route.ts`** — refactored to call the shared lib fn; kept as a manual endpoint. **`vercel.json`** — crons emptied.

Trigger change only — the deletion logic + its safety gates are untouched, and the WEEKLY claim fires no more often than the old weekly cron. `tsc` / `lint` / `migration:check` green.

SPEC IMPACT: None (infra/trigger change; no deletion-behavior change). Completes [[project_setnayan_cron_free]] — 0 Vercel crons. See DECISION_LOG 2026-07-12.
