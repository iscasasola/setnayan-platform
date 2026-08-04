-- retire_2307_cron
-- ============================================================================
-- RETIRE the quarterly BIR 2307 subsystem (owner, 2026-07-25: "we do not have
-- tax-form. kill that and delete any idea of adding it. we will revise in the
-- future if i decide to keep it.")
-- ============================================================================
-- Unschedules `quarterly_2307_generation` (already done on the live DB
-- 2026-07-25 via cron.unschedule; this makes it reproducible). The companion
-- route /api/admin/cron/generate-2307 + lib/bir-2307.ts are deleted in the
-- same PR — recover them from git history (PR #3675, commit 3431c1b30) if the
-- subsystem is ever revived.
--
-- Deliberately KEPT, tombstone-style (no destructive drops on prod data):
--   • vendor_2307_filings table + vendor_profiles/platform_settings BIR
--     columns (empty today; dropping them buys nothing and burns the audit
--     trail if a filing row ever existed).
--   • Supabase Vault secret 'cron_secret' — nothing consumes it while no
--     pg_cron job is scheduled, but it is the canonical DB-side twin of
--     CRON_SECRET should any future job need to call an app cron route.
--
-- Idempotent: unschedule-if-present.

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; nothing to unschedule.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('quarterly_2307_generation')
    FROM cron.job
    WHERE jobname = 'quarterly_2307_generation';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping quarterly_2307_generation unschedule: %', SQLERRM;
END
$cron$;