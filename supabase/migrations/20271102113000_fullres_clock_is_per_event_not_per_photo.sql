-- High-res originals: ONE clock per EVENT, not one per photo.
--
-- Owner-locked 2026-08-02: *"the total time we keep their high resolution is
-- 6 months from the first day they use the service. the reason why i said
-- 5 month for until the event date is so they have at least 30 days to download
-- the files they have."*
--
-- ── THE DEFECT THIS REPLACES ───────────────────────────────────────────────
-- The sweep aged each photo against ITS OWN captured_at, 90 days. That is fine
-- for a one-day wedding and WRONG for the journey the owner is describing:
--
--   photo taken 5 months (150d) before the wedding
--     → its original was deleted 90 days later
--     → i.e. TWO MONTHS BEFORE THE WEDDING ITSELF.
--
-- The couple's earliest planning photos lost print quality before the day they
-- were planning for. The longer the journey, the more of it was destroyed
-- first — the opposite of what a keepsake product should do.
--
-- A per-photo clock cannot express "6 months from the first day they use the
-- service", because that sentence is about the EVENT. So the clock moves here.
--
-- ── THE RULE, AND WHY THERE ARE TWO TERMS ─────────────────────────────────
-- Droppable once BOTH have passed:
--   (a) first capture on the event + p_retention_days   (the owner's 6 months)
--   (b) the event date            + p_post_event_days   (the owner's REASON)
--
-- (b) is not extra policy — it is the owner's own stated purpose ("at least 30
-- days to download") turned into a rule instead of left as an arithmetic
-- coincidence. Their reasoning holds only while the window opens no earlier than
-- 5 months out. Someone who starts 8 months early, or whose date is pushed back,
-- would otherwise lose their originals BEFORE the event under (a) alone. (b) can
-- only ever KEEP files longer — it can never cause an earlier deletion.
--
-- An event with no event_date falls back to (a) alone rather than becoming
-- undroppable forever.
--
-- Returns EVENT IDS. The sweep's own guards are untouched and still decide every
-- individual file: web copy must exist, Drive custody must clear, Keep-Full-Res
-- events are excluded, sample keys are never touched.

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
           e.event_date
      FROM public.events e
  )
  SELECT f.event_id
    FROM first_use f
   WHERE f.started_at <> 'infinity'::timestamptz
     -- (a) the owner's 6 months, from first use
     AND NOW() >= f.started_at + make_interval(days => GREATEST(p_retention_days, 0))
     -- (b) and never before the download grace after the event itself
     AND (
       f.event_date IS NULL
       OR NOW() >= (f.event_date::timestamptz
                    + make_interval(days => GREATEST(p_post_event_days, 0)))
     );
$$;

COMMENT ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER) IS
  'Events whose full-res originals may be dropped: 6 months from the FIRST capture on the event (owner 2026-08-02), and never sooner than N days after the event date so the couple always gets a download grace. Replaces the per-photo age fuse, which deleted early journey photos before the wedding they were leading up to.';

-- service_role only: the sweep runs on the admin client. No anon/authenticated
-- execute — this reads across every event.
REVOKE ALL ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_events_past_fullres_clock(INTEGER, INTEGER)
  TO service_role;
