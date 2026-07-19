-- sweep_last_run_cols — move the fake-inquiry sweeps OFF Vercel Cron.
-- ============================================================================
-- The two sweeps (ghosted-hold release, fraud-cluster refresh + concentration
-- detect) are being converted from Vercel Cron routes to the repo's house
-- CRON-FREE pattern: a Next `after()` hook fired by request traffic, gated by a
-- durable single-row conditional-UPDATE TIMESTAMP CLAIM (compare-and-swap) so the
-- work runs ~once/day no matter how many requests trigger it and survives deploys
-- (mirrors lib/admin/digest-flush.ts + lib/social/flush.ts — [[project_setnayan_cron_free]]).
--
-- This adds the two claim columns to the platform_settings singleton (id=1). NULL
-- = never run. Written only by the service-role admin client inside the sweep libs.
-- ============================================================================
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS lead_hold_sweep_last_run_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fraud_cluster_sweep_last_run_at TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.lead_hold_sweep_last_run_at IS
  'CRON-FREE claim watermark: last time maybeSweepGhostedLeadHolds() won the daily compare-and-swap and ran sweep_ghosted_lead_holds(). Fired from vendor/couple layout after() traffic.';
COMMENT ON COLUMN public.platform_settings.fraud_cluster_sweep_last_run_at IS
  'CRON-FREE claim watermark: last time maybeRunFraudClusterSweep() won the daily compare-and-swap and ran refresh_identity_clusters()+detect_inquiry_concentration(). Fired from admin layout after() traffic.';
