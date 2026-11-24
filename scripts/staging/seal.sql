-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- THE STAGING SEAL — nothing leaves a staging copy on its own. Run by scripts/staging/seed.ts FIRST, before any row
-- is written, on the staging database only.
--
-- The migrations schedule pg_cron jobs, and a trigger posts every new chat message to `/api/notify` — by default
-- at the LIVE site (`notify_webhook_url` unset ⇒ https://www.setnayan.com/api/notify, see
-- 20271115531329_backfill_prod_only_functions_and_triggers.sql). On a real Postgres those fire. So:
--   · every pg_cron job is switched off (the copy has no business running the live site's schedules);
--   · the notify webhook is REFUSED if it could reach production: its secret is set while its URL is unset or
--     names setnayan.com / the production vercel.app alias. (Unset secret = the trigger skips the call — safe.)
-- Same idea as the release rehearsal's seal (apps/web/tests/rehearsal/apply-migrations.mts), for a hosted branch.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

DO $seal$
DECLARE
  v_switched int := 0;
  v_left     int := 0;
  v_job      record;
  v_has_active boolean := false;
BEGIN
  -- ── pg_cron: every job off ───────────────────────────────────────────────────────────────────────────────────
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'active') INTO v_has_active;
  END IF;
  IF v_has_active THEN
    FOR v_job IN EXECUTE 'SELECT jobid FROM cron.job WHERE active' LOOP
      BEGIN
        -- Hosted pg_cron: a job is changed through cron.alter_job by the role that scheduled it.
        EXECUTE 'SELECT cron.alter_job($1, active := false)' USING v_job.jobid;
        v_switched := v_switched + 1;
      EXCEPTION WHEN undefined_function OR insufficient_privilege THEN
        EXECUTE 'UPDATE cron.job SET active = false WHERE jobid = $1' USING v_job.jobid;
        v_switched := v_switched + 1;
      END;
    END LOOP;
    EXECUTE 'SELECT count(*) FROM cron.job WHERE active' INTO v_left;
    IF v_left > 0 THEN
      RAISE EXCEPTION 'staging seal REFUSED: % pg_cron job(s) are still active and could not be switched off. Nothing was seeded.', v_left;
    END IF;
  END IF;
  RAISE NOTICE 'staging seal: % scheduled job(s) switched off', v_switched;

  -- ── the notify webhook: never at production ──────────────────────────────────────────────────────────────────
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM vault.decrypted_secrets
                WHERE name = 'notify_webhook_secret' AND btrim(coalesce(decrypted_secret, '')) <> '')
       AND NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets
                        WHERE name = 'notify_webhook_url'
                          AND btrim(coalesce(decrypted_secret, '')) <> ''
                          AND decrypted_secret !~* '(^|[/.])setnayan\.com([/:]|$)'
                          AND decrypted_secret !~* '//setnayan-platform-web\.vercel\.app([/:]|$)') THEN
      RAISE EXCEPTION 'staging seal REFUSED: the notify webhook secret is set and its URL is production (or unset, which defaults to production). Point notify_webhook_url at the staging preview, or remove the secret. Nothing was seeded.';
    END IF;
  END IF;
  RAISE NOTICE 'staging seal: the notify webhook cannot reach production';
END
$seal$;
