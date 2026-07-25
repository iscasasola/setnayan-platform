-- quarterly_2307_vault_auth
-- ============================================================================
-- Re-point the quarterly_2307_generation pg_cron job's auth header at
-- Supabase Vault (secret name 'cron_secret').
-- ============================================================================
-- WHY: the original job (migration 20260516100000) read its X-Cron-Secret from
-- `current_setting('app.cron_secret', true)`. That design is IMPOSSIBLE to
-- configure on Supabase: the `postgres` role gets "permission denied to set
-- parameter" for BOTH `ALTER DATABASE ... SET` and `ALTER ROLE ... SET` on
-- custom GUCs (PostgreSQL 15+ placeholder-GUC privilege rules, verified live
-- 2026-07-25). The setting was therefore never set, the job sent an empty
-- secret, and /api/admin/cron/generate-2307 rejected it fail-closed — the
-- quarterly BIR 2307 generation had silently never run.
--
-- NOW: the header value comes from Vault (`vault.decrypted_secrets`, name
-- 'cron_secret'), which pg_cron's postgres-owned jobs CAN read. The Vault row
-- itself is OPERATIONAL state, created/rotated from the owner's machine or the
-- Supabase dashboard — this migration never embeds a secret value. If the Vault
-- row is missing the job degrades to the same fail-closed 401 as before, never
-- to an unauthenticated call.
--
-- This same command was already applied to the live DB on 2026-07-25 via
-- cron.alter_job; the migration makes it reproducible on a fresh environment.
-- The board row "CRON_SECRET" on /admin/secrets documents the rotation coupling.
--
-- Idempotent: unschedule-if-present, then schedule.

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed; skipping quarterly_2307_generation vault re-point.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('quarterly_2307_generation')
    FROM cron.job
    WHERE jobname = 'quarterly_2307_generation';

  -- 18:00 UTC on the 1st of Jan/Apr/Jul/Oct = 02:00 PH time (unchanged).
  PERFORM cron.schedule(
    'quarterly_2307_generation',
    '0 18 1 1,4,7,10 *',
    $sql$
      SELECT net.http_post(
        url := 'https://www.setnayan.com/api/admin/cron/generate-2307',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'), '')
        ),
        body := jsonb_build_object('triggered_by', 'pg_cron')
      );
    $sql$
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Same catch-all posture as the original migration: environments where the
    -- extensions exist but scheduling fails (permissions on a hosted shard)
    -- must not fail the whole migration run.
    RAISE NOTICE 'Skipping quarterly_2307_generation vault re-point: %', SQLERRM;
END
$cron$;