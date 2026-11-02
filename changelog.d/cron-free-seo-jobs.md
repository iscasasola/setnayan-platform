## 2026-07-12 · refactor(cron-free): generic claim primitive + move the 2 SEO crons off Vercel Cron

Owner is going platform cron-free (hit failing/stuck Vercel crons). This lands the **generic** reusable primitive + converts the two safe SEO jobs; the 3 email jobs follow in a sibling PR, the 2 destructive weekly deletes later (careful pass).

- **`supabase/migrations/20270729519877_cron_job_runs_claim.sql`** — `cron_job_runs(job_key, last_run_at)` + `claim_periodic_job(key, gap)` (SECURITY DEFINER, service-role): an atomic INSERT-or-conditional-UPDATE compare-and-swap that returns TRUE for exactly one caller per window. Generalizes the `lib/admin/digest-flush.ts` single-column claim so N jobs share one primitive.
- **`apps/web/lib/periodic-jobs.ts`** — `claimPeriodicJob(key, minGapMs)` + `DAILY_GAP_MS`: cheap in-mem pre-throttle per key → the DB claim. Deploy-surviving, cross-instance atomic.
- **`apps/web/lib/seo/seo-cron-jobs.ts`** — `runSeoHealthAudit()` + `runSeoGscPull()` (the retired routes' work bodies, extracted verbatim; they were `req`-free post-auth) + `runSeoPeriodicJobs()` fired from **admin/layout** `after()` (both feed /admin/seo → admin traffic is the right trigger).
- **Deleted** `/api/cron/seo-health` + `/api/cron/seo-gsc` routes and their `vercel.json` entries. Fixed the stale "the nightly /api/cron/seo-health" hint on the SEO admin surface.

**Why:** no external scheduler left for these — no single fragile daily fire to hang/fail; the claim + `after()` makes the schedule emergent from traffic and self-healing across deploys. `tsc` / `lint` / `migration:check` green; no lingering route refs.

SPEC IMPACT: None (infra/trigger change; additive `cron_job_runs` table + claim RPC, no pricing/SKU/behavior change). Establishes the reusable cron-free primitive for the remaining conversions. See DECISION_LOG 2026-07-12.
