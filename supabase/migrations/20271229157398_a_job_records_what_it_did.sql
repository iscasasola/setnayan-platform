-- ============================================================================
-- A JOB RECORDS WHAT IT DID — outcome columns on cron_job_runs
-- ============================================================================
-- Until now `public.cron_job_runs` held exactly two columns — job_key and
-- last_run_at — and `claim_periodic_job()` stamped last_run_at at the instant
-- of the CLAIM, BEFORE the job body ran in the app. The body then ran inside a
-- `try { … } catch { /* best-effort */ }` that swallowed every failure.
--
-- 🔑 SO A RETENTION SWEEP THAT THREW LEFT A FRESH TIMESTAMP AND DID NOT RETRY
--    FOR A FULL WEEK. A silently failing deletion job and a working one were
--    BYTE-IDENTICAL from every record we keep. /privacy promises deletions with
--    dates on them under RA 10173; the only evidence they ever happened was a
--    timestamp that means "somebody was about to try".
--
-- This adds the OUTCOME. The claim stays exactly as it was — same single-winner
-- compare-and-swap, same signature, same predicate — and a second call,
-- finish_periodic_job(), closes the row when the body returns or throws.
--
-- ⛔ WHAT THIS DELIBERATELY DOES NOT DO
--   · It does NOT make the claim conditional on the previous run having
--     succeeded. A job that failed once would then never run again — worse than
--     the defect being fixed. The claim predicate is untouched: last_run_at only.
--   · It does NOT introduce a scheduler. This repo is CRON-FREE by decision
--     (see app/admin/admin-carries-the-cron-free-jobs.test.ts); jobs still ride
--     on request traffic through Next `after()`. What changes is that when one
--     stops happening, the record says so.
--   · It does NOT keep history. One row per job key, holding the LAST run's
--     outcome. A per-run log table would answer "show me every sweep for the
--     last two years", which is a better compliance artefact and an unbounded
--     one; that is an owner call, not a side effect of this migration.
--
-- 🕯 LEGACY ROWS ARE LEFT NULL ON PURPOSE. The 22 rows that exist today were
--    written before any outcome was recorded, so we genuinely do not know what
--    they did. started_at IS NULL is the honest state and the app renders it as
--    "ran before outcomes were recorded" — NOT as a failure, and NOT as a
--    success. Backfilling either way would be inventing evidence.
-- ============================================================================

ALTER TABLE public.cron_job_runs
  ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ok            BOOLEAN,
  ADD COLUMN IF NOT EXISTS rows_affected INTEGER,
  ADD COLUMN IF NOT EXISTS error         TEXT;

COMMENT ON COLUMN public.cron_job_runs.last_run_at IS
  'When the job was CLAIMED — i.e. when a caller won the window and was about to start. NOT evidence that anything ran to completion; that is finished_at/ok.';
COMMENT ON COLUMN public.cron_job_runs.started_at IS
  'When the current/last run was claimed, re-stamped by claim_periodic_job on every win and cleared of its outcome. NULL means the row predates outcome recording (added 20271229157398) — unknown, not failed.';
COMMENT ON COLUMN public.cron_job_runs.finished_at IS
  'When the job body returned or threw. NULL while started_at IS NOT NULL means the run was claimed and NEVER CLOSED — the process died, the after() budget ran out, or the body hung. This is the state the old two-column table could not express.';
COMMENT ON COLUMN public.cron_job_runs.ok IS
  'TRUE the body returned, FALSE it threw (see error). NULL = not finished, or the row predates outcome recording. Deliberately has NO DEFAULT: a default of TRUE would make "never finished" read as "succeeded", which is the exact defect this migration exists to remove.';
COMMENT ON COLUMN public.cron_job_runs.rows_affected IS
  'What the run actually touched — deleted/purged/sent. 0 means it RAN AND NOTHING WAS DUE, which is a legitimate outcome and must stay distinguishable from NULL. NULL means this job reports no count (or the run has not finished).';
COMMENT ON COLUMN public.cron_job_runs.error IS
  'The message from a thrown body, truncated. The catch that used to swallow the failure now writes here instead of vanishing — it still never rethrows into the page render that fired it.';

COMMENT ON TABLE public.cron_job_runs IS
  'CRON-FREE job ledger — one row per periodic job, holding the LAST run''s claim AND its outcome. Written only by claim_periodic_job()/finish_periodic_job() (service-role). See [[project_setnayan_cron_free]].';

-- ── The claim, unchanged in semantics ───────────────────────────────────────
-- Same INSERT … ON CONFLICT DO UPDATE, same `WHERE last_run_at < now() - gap`,
-- same RETURNING TRUE, same signature, same grants. The ONLY addition is that a
-- winning claim opens a fresh run: started_at = now() and the previous run's
-- outcome cleared, so last window's `ok = true` can never be read as this
-- window's result.
-- ⚠ THE PREDICATE MUST NOT GROW AN `ok` OR `finished_at` TERM. A job that failed
--   once, or died mid-run, would then be locked out forever.
CREATE OR REPLACE FUNCTION public.claim_periodic_job(
  p_job_key TEXT,
  p_min_gap INTERVAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_won BOOLEAN;
BEGIN
  INSERT INTO public.cron_job_runs (job_key, last_run_at, started_at)
  VALUES (p_job_key, now(), now())
  ON CONFLICT (job_key) DO UPDATE
    SET last_run_at   = now(),
        started_at    = now(),
        finished_at   = NULL,
        ok            = NULL,
        rows_affected = NULL,
        error         = NULL
    WHERE public.cron_job_runs.last_run_at < now() - p_min_gap
  RETURNING TRUE INTO v_won;
  RETURN COALESCE(v_won, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) TO service_role;

COMMENT ON FUNCTION public.claim_periodic_job(TEXT, INTERVAL) IS
  'CRON-FREE once-per-period claim (compare-and-swap on cron_job_runs). Returns TRUE for exactly one caller per p_min_gap window and OPENS that run (started_at=now(), outcome cleared). The winner must close it with finish_periodic_job(). The predicate reads last_run_at ONLY — never ok — so a failed run is retried, not locked out. Service-role only.';

-- ── The completion write ────────────────────────────────────────────────────
-- Closes the OPEN run for a key. `finished_at IS NULL` in the predicate means a
-- late finisher from an already-closed window cannot re-stamp a closed row.
-- ⚠ KNOWN, ACCEPTED WINDOW: a run that outlives its own gap could still close a
--   row that a NEWER claim had just re-opened. Runs here are seconds-to-minutes
--   inside an after() budget and the shortest gap is 10 minutes, so this is not
--   reachable today; closing it properly needs a per-run token, which would
--   change claim_periodic_job's signature. Named rather than pretended away.
-- Returns TRUE if a row was closed, FALSE if there was nothing open to close —
-- so a caller that finishes twice, or finishes a run it never claimed, is
-- visible rather than silently successful.
CREATE OR REPLACE FUNCTION public.finish_periodic_job(
  p_job_key       TEXT,
  p_ok            BOOLEAN,
  p_rows_affected INTEGER DEFAULT NULL,
  p_error         TEXT    DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_closed BOOLEAN;
BEGIN
  UPDATE public.cron_job_runs
     SET finished_at   = now(),
         ok            = p_ok,
         rows_affected = p_rows_affected,
         -- Bounded: an error message is diagnostics, not a log sink.
         error         = CASE WHEN p_error IS NULL THEN NULL ELSE left(p_error, 2000) END
   WHERE job_key = p_job_key
     AND finished_at IS NULL
  RETURNING TRUE INTO v_closed;
  RETURN COALESCE(v_closed, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.finish_periodic_job(TEXT, BOOLEAN, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_periodic_job(TEXT, BOOLEAN, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION public.finish_periodic_job(TEXT, BOOLEAN, INTEGER, TEXT) IS
  'Closes the open run for a job key: finished_at=now() plus ok / rows_affected / error. Returns FALSE when nothing was open to close. rows_affected = 0 means "ran, nothing was due" and is NOT the same as NULL. Service-role only.';
