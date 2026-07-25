## 2026-07-25 · chore(bir): RETIRE the quarterly 2307 subsystem (owner: "we do not have tax-form — kill that")

Owner call, hours after PR #3675 shipped the compute+record route: Setnayan has no tax-form product — 0% commission, off-platform settlement, not a withholding agent — so the whole quarterly 2307 pipeline is retired, not finished.

- `cron.unschedule('quarterly_2307_generation')` — applied to the live DB 2026-07-25 (zero pg_cron jobs remain); migration `20270930280000` makes it reproducible.
- Deleted `app/api/admin/cron/generate-2307/route.ts`, `lib/bir-2307.ts`, `lib/bir-2307.test.ts` (recoverable from PR #3675 / commit `3431c1b30` if the owner ever revives this — the stage-allocation fix for the 3× withholding stamp lives there too).
- Kept, tombstone-style: the `vendor_2307_filings` table + BIR identity columns (empty; no destructive drops) and the Supabase Vault `cron_secret` twin (nothing consumes it today; the /admin/secrets CRON_SECRET row's copy now says so).

SPEC IMPACT: Iteration 0026's vendor-payout/EWT/2307 half is now retired in CODE as well as spec (the 2026-06-07 as-built banner already declared it dead — the code has caught up). DECISION_LOG row appended this session.
