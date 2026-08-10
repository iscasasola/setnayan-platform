-- The three-month full-res floor counts from when the event ENDS, not when it starts.
--
-- Owner correction, 2026-08-10: *"3 months after the event **ends**."*
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- 20271102113000 introduced the per-EVENT clock and expressed its floor as
-- `e.event_date + p_post_event_days`. `events.event_date` is the FIRST day.
-- `events.event_end_date` (added by 20270807254184, NULL = single-day) existed
-- the whole time and was never consulted anywhere in this function.
--
-- For a one-day wedding the two are identical, which is why nothing showed. For
-- a multi-day celebration — travel is the multi-day type, and the composable
-- event model sets multi_day=TRUE per event type — the last day's photos got
-- LESS than the promised three months, by exactly the length of the event. A
-- ten-day trip's closing-night originals would be compressed nine days early,
-- and the only symptom is a print-quality file that is no longer there.
--
-- Latent today: no production event carries a differing end date yet.
--
-- ── THE FIX, AND WHY IT IS SHAPED LIKE THIS ───────────────────────────────
--   GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date)
--
-- • COALESCE is the owner's stated fallback: use the end date when there is
--   one, otherwise the start date. Single-day events are untouched.
-- • GREATEST is defensiveness, not decoration. `events_end_date_after_start`
--   (20270807254184) is a CHECK, and a CHECK can be dropped, added NOT VALID,
--   or sidestepped by a future backfill. Wrapping the COALESCE in a GREATEST
--   against the start date means a malformed end date EARLIER than the start
--   can only ever be ignored — it can never pull the floor backwards and
--   shorten the promise. The whole point of this term is that it can only ever
--   KEEP files longer.
-- • Postgres GREATEST ignores NULLs (it returns NULL only when every argument
--   is NULL), so an event with an end date and no start date still floors on
--   the end date instead of collapsing to "no floor".
--
-- NULL handling is otherwise unchanged: an event with neither date falls back to
-- the first-capture clock alone rather than becoming undroppable forever.
--
-- ⚠ NOT re-litigated here, deliberately: the ::timestamptz cast on a DATE and
-- the 92-day figure. 92 is the longest three-calendar-month span (1 Mar → 1 Jun)
-- and already absorbs the session-timezone offset a DATE cast can introduce.
--
-- Signature, volatility, security, return type and grants are all IDENTICAL to
-- 20271102113000 — this is a body correction, so PostgREST argument resolution
-- and every existing .rpc() call site are unaffected. The applied migration is
-- NOT edited; this replaces it forward.

CREATE OR REPLACE FUNCTION public.papic_events_past_fullres_clock(
  p_retention_days  INTEGER,
  p_post_event_days INTEGER
) RETURNS TABLE (event_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_use AS (
    -- "The first day they use the service" — the earliest capture on the event,
    -- across BOTH capture tables. A guest's phone and a seat camera are the same
    -- service to the person paying for it, so they share one clock.
    SELECT e.event_id,
           LEAST(
             COALESCE((SELECT MIN(p.captured_at) FROM public.papic_photos p
                        WHERE p.event_id = e.event_id), 'infinity'::timestamptz),
             COALESCE((SELECT MIN(g.captured_at) FROM public.papic_guest_captures g
                        WHERE g.event_id = e.event_id), 'infinity'::timestamptz)
           ) AS started_at,
           -- The event's LAST day. See the header: COALESCE is the owner's
           -- fallback, GREATEST is the one-way valve.
           GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date) AS event_last_day
      FROM public.events e
  )
  SELECT f.event_id
    FROM first_use f
   WHERE f.started_at <> 'infinity'::timestamptz
     -- (a) the owner's 6 months, from first use
     AND NOW() >= f.started_at + make_interval(days => GREATEST(p_retention_days, 0))
     -- (b) and never before the download grace after the event has ENDED
     AND (
       f.event_last_day IS NULL
       OR NOW() >= (f.event_last_day::timestamptz
                    + make_interval(days => GREATEST(p_post_event_days, 0)))
     );
$$;

COMMENT ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER) IS
  'Events whose full-res originals may be replaced by their compressed copy: 6 months from the FIRST capture on the event (owner 2026-08-02), and never sooner than N days after the event''s LAST day — event_end_date when the celebration spans several days, else event_date (owner 2026-08-10, "3 months after the event ends"). Replaces the per-photo age fuse, which compressed early journey photos before the wedding they were leading up to.';

-- Grants are re-asserted rather than assumed. CREATE OR REPLACE keeps the
-- existing ACL, but this migration must also be correct if it is ever the first
-- one to create the function on a fresh database.
REVOKE ALL ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  TO service_role;
