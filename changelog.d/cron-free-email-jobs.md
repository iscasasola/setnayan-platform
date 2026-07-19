## 2026-07-12 · refactor(cron-free): move the 3 daily email crons off Vercel Cron

Second slice of the platform cron-free migration (after the generic `claim_periodic_job` primitive + the 2 SEO jobs). Converts the three daily email jobs. Only the 2 destructive weekly deletes (retention-sweep, papic-fullres-drop) remain on Vercel Cron now — deferred for a careful pass.

- **`apps/web/lib/daily-email-jobs.ts`** — `runAnniversaryDigest()`, `runRenewalReminders()`, `runPapicDropWarning()`: the retired routes' post-auth bodies extracted **verbatim** (they were `req`-free), each keeping its own atomic send-idempotency lock (`anniversary_email_log` / `renewal_reminder_log` unique inserts, `events.full_res_drop_warned_at` stamp), so a double-fire can never double-send. Plus `runDailyEmailJobs()` — claim-gates each to ~once/day via the shared `claimPeriodicJob`.
- **Fired from PUBLIC surfaces** — `after()` on `app/page.tsx` + `explore/page.tsx` (where the digest flush already fires), so these run daily even when no admin/vendor is online.
- **Deleted** `/api/cron/anniversary-digest`, `/api/cron/renewal-reminders`, `/api/cron/papic-fullres-drop-warning` routes + their `vercel.json` entries. Updated two stale "a daily cron (…)" comments in the email libs.

**Why:** no external scheduler for these — the schedule is emergent from public traffic + a per-job DB claim, self-healing across deploys; nothing to fail/hang. `tsc` / `lint` / `migration:check` green; no lingering route refs.

Depends on the sibling PR's `claim_periodic_job` primitive. Remaining: retention-sweep + papic-fullres-drop (destructive weekly deletes — adversarial-verify pass).

SPEC IMPACT: None (infra/trigger change; no new schema in this slice, no pricing/SKU/behavior change). See DECISION_LOG 2026-07-12.
