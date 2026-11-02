## 2026-07-12 · refactor(anti-fraud): move the two fake-inquiry sweeps off Vercel Cron → after() + DB claim

Owner hit failing/stuck Vercel crons (+ the plan cron limit). A 9-agent grounded analysis (DECISION_LOG 2026-07-12) confirmed the repo's house pattern is CRON-FREE — a durable single-row compare-and-swap on `platform_settings` fired from Next `after()` (live in `lib/admin/digest-flush.ts` / `lib/social/flush.ts`), deploy-surviving + cross-instance atomic, "the ONE pattern to standardize on." This retires both sweep crons for it. The SQL RPCs are unchanged.

- **`supabase/migrations/20270729269411_sweep_last_run_cols.sql`** — two claim watermarks on the `platform_settings` singleton: `lead_hold_sweep_last_run_at`, `fraud_cluster_sweep_last_run_at`.
- **`apps/web/lib/lead-token-holds.ts`** — `maybeSweepGhostedLeadHolds()`: 30-min in-mem pre-throttle → atomic ~daily claim (id=1, `.or(is.null,lt.cutoff)`) → existing `sweep_ghosted_lead_holds()`. Fired from **vendor-dashboard/layout** `after()` (the RPC is global + idempotent, so any vendor visit sweeps every vendor's ghosts).
- **`apps/web/lib/fraud-cluster-sweep.ts`** (new) — `maybeRunFraudClusterSweep()`: same claim, gated on `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED`, then `refresh_identity_clusters()` + `detect_inquiry_concentration()`. Fired from **admin/layout** `after()` so the heavy matview REFRESH never rides an end-user request.
- **Deleted** `apps/web/app/api/cron/lead-hold-sweep/` + `.../fraud-cluster-sweep/` routes and their two `vercel.json` cron entries.

**Why this fixes "stuck crons":** there is no external scheduler left in the loop — no Vercel Cron entry, no `CRON_SECRET` daily fire, no pg_cron — so no single fragile invocation can fail/hang and silently drop the day. The trigger is emergent from traffic + a DB watermark; a missed attempt self-heals on the next eligible request. **Note (adversarial verify):** the hold sweep was deliberately KEPT physical (not made lazy) — it also DELETEs the paired `vendor_event_unlocks` row read by the verified 10/wk cap, peso-per-lead, demand-radar, analytics, and the couple "in conversation" badge; only its trigger changed.

Follow-ups (not in this PR): admin "Run now" buttons for both sweeps (fallback for long admin absence). Optional pg_cron / GitHub-Actions alternative kept in reserve if a guaranteed-clock fraud sweep is ever wanted.

SPEC IMPACT: None (infra/trigger change; additive migration on `platform_settings`, no pricing/SKU/behavior change). Logged in DECISION_LOG 2026-07-12.
