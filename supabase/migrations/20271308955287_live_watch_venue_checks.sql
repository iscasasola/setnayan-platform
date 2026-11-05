-- ============================================================================
-- live_watch_venue_checks — the venue connection check Live Watch setup promised.
--
-- Owner, 5 Nov 2026 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS … RULED ONE BY ONE",
-- item 8), on the setup page's "run a venue connectivity check a week ahead"
-- with no tool behind it: "it should". Spec: iteration 0011 offline note,
-- mitigation #1 — a check the couple or coordinator runs at the venue, with a
-- green / yellow / red answer.
--
-- One row per check. It is written when the check STARTS (the insert is the
-- permission check: RLS below decides who may run one) and completed when the
-- phone reports its measurements; the server re-judges those with
-- lib/venue-check.ts and writes the result with the service role (see GRANTS),
-- so `verdict` is never a value the browser chose.
-- A row with finished_at NULL is a check that was started and never finished
-- (the phone left the page). Its test upload is removed by the sweep
-- (lib/venue-check-sweep.ts), which reads storage, not this table.
--
-- No user column on purpose: the result belongs to the EVENT (the couple and
-- the coordinator both see it), and it names nobody.
--
-- verdict:
--   full        the Live Studio encoder would have stayed at full quality
--   reduced     it would have stepped down its ladder and kept streaming
--   not_enough  average upload under the lowest ladder rung — no stream
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_watch_venue_checks (
  check_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  place_name    TEXT CHECK (place_name IS NULL OR char_length(place_name) BETWEEN 1 AND 80),
  verdict       TEXT CHECK (verdict IN ('full', 'reduced', 'not_enough')),
  -- What was measured, so the result can be read back in numbers, not only a colour.
  average_kbps  INTEGER CHECK (average_kbps IS NULL OR average_kbps >= 0),
  slowest_kbps  INTEGER CHECK (slowest_kbps IS NULL OR slowest_kbps >= 0),
  worst_rung    SMALLINT CHECK (worst_rung IS NULL OR worst_rung BETWEEN 0 AND 2),
  delay_ms      INTEGER CHECK (delay_ms IS NULL OR delay_ms >= 0),
  -- Finished and judged are one fact: a finished row always has its verdict.
  CONSTRAINT live_watch_venue_checks_finished_has_verdict
    CHECK ((finished_at IS NULL) = (verdict IS NULL))
);

ALTER TABLE public.live_watch_venue_checks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS live_watch_venue_checks_event_latest
  ON public.live_watch_venue_checks (event_id, finished_at DESC);

COMMENT ON TABLE public.live_watch_venue_checks IS
  'Live Watch venue connection checks: one row per run, judged server-side by lib/venue-check.ts against the Live Studio encoder bitrate ladder. Read and run by the couple, co-hosts and coordinators (delegated or booked); never by guests.';

-- Who may read and run a check: the couple and a delegated coordinator member,
-- an accepted co-host/helper (event_moderators, which includes the external
-- wedding planner), and the BOOKED coordinator supplier — but never a guest,
-- which is why this is not current_event_ids().
DROP POLICY IF EXISTS live_watch_venue_checks_team_select ON public.live_watch_venue_checks;
CREATE POLICY live_watch_venue_checks_team_select ON public.live_watch_venue_checks
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS live_watch_venue_checks_team_insert ON public.live_watch_venue_checks;
CREATE POLICY live_watch_venue_checks_team_insert ON public.live_watch_venue_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
    OR event_id IN (SELECT public.current_coordinator_booked_event_ids())
  );

-- No UPDATE or DELETE policy. A check is a record of what the venue measured;
-- event deletion cascades.

-- ── GRANTS — the verdict is the SERVER's to write ─────────────────────────
-- A signed-in team member may READ checks and START one (insert its event_id,
-- nothing else). They may NOT write a verdict or a number: the result is written
-- by the finish step with the service role, only after it has re-judged the
-- phone's measurements and proved (through this table's RLS) that the caller
-- can see the check. Without these grants the default table privileges would
-- let a team member PATCH `verdict = 'full'` straight through the API.
REVOKE ALL ON public.live_watch_venue_checks FROM anon, authenticated;
GRANT SELECT ON public.live_watch_venue_checks TO authenticated;
GRANT INSERT (event_id) ON public.live_watch_venue_checks TO authenticated;
GRANT ALL ON public.live_watch_venue_checks TO service_role;
