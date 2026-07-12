-- cron_job_runs_claim — generic CRON-FREE once-per-period claim primitive.
-- ============================================================================
-- Generalizes the single-row timestamp-claim (lib/admin/digest-flush.ts) so many
-- periodic jobs can share ONE atomic compare-and-swap instead of a bespoke
-- platform_settings column each. A job's `after()` wrapper calls
-- claim_periodic_job('<key>', '<gap>'): it returns TRUE for exactly one caller
-- per period (the winner runs the work), FALSE for everyone else. Survives
-- deploys (state is in the DB, not memory) and is cross-instance/cross-region
-- atomic. Replaces the Vercel Cron schedule for the 5 safe jobs (SEO + emails).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cron_job_runs (
  job_key      TEXT PRIMARY KEY,
  last_run_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_job_runs IS
  'CRON-FREE claim watermarks — one row per periodic job. Written only by claim_periodic_job() (service-role). See [[project_setnayan_cron_free]].';

ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;
-- Admin read for observability; all writes go through the DEFINER claim fn.
DROP POLICY IF EXISTS cron_job_runs_admin_read ON public.cron_job_runs;
CREATE POLICY cron_job_runs_admin_read
  ON public.cron_job_runs FOR SELECT TO authenticated
  USING (public.is_admin());

-- Atomic claim: INSERT the key (first ever run) OR conditionally UPDATE it only
-- when the last run is older than p_min_gap. RETURNING fires only on an actual
-- insert/update → TRUE = this caller won the period; NULL/absent → FALSE. The
-- ON CONFLICT row-lock serializes concurrent callers, so exactly one wins.
CREATE OR REPLACE FUNCTION public.claim_periodic_job(
  p_job_key TEXT,
  p_min_gap INTERVAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_won BOOLEAN;
BEGIN
  INSERT INTO public.cron_job_runs (job_key, last_run_at)
  VALUES (p_job_key, now())
  ON CONFLICT (job_key) DO UPDATE
    SET last_run_at = now()
    WHERE public.cron_job_runs.last_run_at < now() - p_min_gap
  RETURNING TRUE INTO v_won;
  RETURN COALESCE(v_won, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) TO service_role;

COMMENT ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) IS
  'CRON-FREE once-per-period claim (compare-and-swap on cron_job_runs). Returns TRUE for exactly one caller per p_min_gap window; the winner runs the job. Service-role only (called from after() wrappers via the admin client).';
