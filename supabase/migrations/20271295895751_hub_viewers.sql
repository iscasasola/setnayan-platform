-- ════════════════════════════════════════════════════════════════════════════
-- 20271295895751_hub_viewers.sql — WHO'S HERE: who is looking at the Event Hub
--
-- Owner, 2026-10-29, verbatim: *"on event>home page. can we add a list of who is
-- viewing our event hub or inside the event dashboard now?"* → *"a widget for
-- this as well? so when 2 cohost/helper or coordinator is on the dashboard and
-- which guest is viewing the event hub?"*
--
-- Two halves. The DASHBOARD half (team members on the dashboard now) is pure
-- Realtime presence and stores NOTHING — only its channel authorisation lives
-- here (§ 5). The EVENT HUB half (guests who opened the hub) is the two tables
-- below, written by ONE service-role function and read by ONE invoker function.
--
-- ── THE OWNER'S TOP RULE: NO EVENT HUB MAY CRASH ────────────────────────────
-- A guest never holds a live connection. Their open is ONE tiny write, fired by
-- the page AFTER it has drawn (`app/api/hub/seen/route.ts`), at most once per
-- guest per 30 minutes — debounced in the browser AND here (the upsert below
-- refuses to move a `last_seen_at` younger than 30 minutes, so a refresh storm
-- writes nothing). A stranger is a +1 on ONE row per event per 15 minutes —
-- never a row per visit.
--
-- ── PRIVACY ─────────────────────────────────────────────────────────────────
--   · A guest is NAMED only when they opened the hub with their OWN pass: the
--     route takes the guest id from the verified pass, never from the request
--     body, and only the service role may call the writer.
--   · A stranger is a COUNT, never who: no cookie, no hash, no device id. The
--     bucket row holds an event, a quarter-hour and a number.
--   · Kept a day, no longer: every write deletes this event's rows older than a
--     day (cron-free, the `record_site_visit` way). The card only ever shows the
--     last half hour.
--   · Read by the event's TEAM only (hosts + accepted moderators), and a NAME only
--     where the caller may read that guest's row — the policy asks the guests
--     table, whose own policies decide (a helper without the guest list sees no
--     names). Never anon, never a guest.
--
-- RLS ENABLED AT CREATE TABLE. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1 · hub_guest_views — one row per guest: when they last opened the hub ──
CREATE TABLE IF NOT EXISTS public.hub_guest_views (
  guest_id     UUID PRIMARY KEY REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_guest_views_event_seen_idx
  ON public.hub_guest_views (event_id, last_seen_at DESC);

ALTER TABLE public.hub_guest_views ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.hub_guest_views IS
  'Who''s here (owner 2026-10-29): when each guest last opened the Event Hub WITH THEIR OWN PASS. One row per guest, moved at most once per 30 minutes; rows older than a day are deleted on write. Written only by record_hub_view() (service role); read by the event team through event_hub_viewers().';

-- Supabase grants every column of a new public table to anon/authenticated — take
-- it all back, then hand the team SELECT (RLS below decides which rows).
REVOKE ALL ON TABLE public.hub_guest_views FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hub_guest_views TO authenticated;

DROP POLICY IF EXISTS hub_guest_views_team_read ON public.hub_guest_views;
CREATE POLICY hub_guest_views_team_read
  ON public.hub_guest_views FOR SELECT TO authenticated
  USING (
    (
      event_id IN (SELECT public.current_couple_event_ids())
      OR event_id IN (SELECT public.current_moderator_event_ids())
    )
    -- …and only a guest the caller may read: the guests table's own policies
    -- answer (a delegate without the guest list sees no one).
    AND EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = hub_guest_views.guest_id)
  );

-- ── 2 · hub_visitor_buckets — strangers, as a count per quarter-hour ────────
CREATE TABLE IF NOT EXISTS public.hub_visitor_buckets (
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  bucket_start TIMESTAMPTZ NOT NULL,
  opens        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, bucket_start),
  CONSTRAINT hub_visitor_buckets_opens_chk CHECK (opens >= 0),
  -- A quarter-hour, never a timestamp a visit could be read back from.
  CONSTRAINT hub_visitor_buckets_quarter_chk
    CHECK (bucket_start = date_bin('15 minutes', bucket_start, TIMESTAMPTZ '2000-01-01 00:00:00+00'))
);

ALTER TABLE public.hub_visitor_buckets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.hub_visitor_buckets IS
  'Who''s here (owner 2026-10-29): Event Hub opens by people who are NOT a named guest, as one counter per event per 15 minutes. No person, no cookie, no hash. Rows older than a day are deleted on write. Written only by record_hub_view(); read by the event team.';

REVOKE ALL ON TABLE public.hub_visitor_buckets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.hub_visitor_buckets TO authenticated;

DROP POLICY IF EXISTS hub_visitor_buckets_team_read ON public.hub_visitor_buckets;
CREATE POLICY hub_visitor_buckets_team_read
  ON public.hub_visitor_buckets FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
  );

-- ── 3 · record_hub_view — the ONE write path (service role only) ────────────
-- p_guest_id is the guest the route's VERIFIED PASS names, or NULL (a stranger).
-- Returns what happened, for the route and the load check:
--   'guest'      a guest's open was recorded
--   'debounced'  that guest was recorded less than 30 minutes ago — nothing written
--   'visitor'    a stranger's open was counted
--   'refused'    not this event's guest (or removed), or no such event — nothing written
CREATE OR REPLACE FUNCTION public.record_hub_view(p_event_id UUID, p_guest_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN 'refused';
  END IF;

  IF p_guest_id IS NOT NULL THEN
    INSERT INTO public.hub_guest_views AS v (guest_id, event_id, last_seen_at)
    SELECT g.guest_id, g.event_id, now()
      FROM public.guests g
     WHERE g.guest_id = p_guest_id
       AND g.event_id = p_event_id
       AND g.deleted_at IS NULL
    ON CONFLICT (guest_id) DO UPDATE
       SET last_seen_at = EXCLUDED.last_seen_at
     -- 🔒 THE SERVER-SIDE DEBOUNCE: a guest seen in the last 30 minutes is not
     -- moved — a refresh storm writes nothing.
     WHERE v.last_seen_at < now() - INTERVAL '30 minutes';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      IF EXISTS (SELECT 1 FROM public.hub_guest_views WHERE guest_id = p_guest_id AND event_id = p_event_id) THEN
        RETURN 'debounced';
      END IF;
      RETURN 'refused';
    END IF;
    -- Retention, cron-free: this event's rows older than a day go.
    DELETE FROM public.hub_guest_views
     WHERE event_id = p_event_id AND last_seen_at < now() - INTERVAL '1 day';
    RETURN 'guest';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE event_id = p_event_id) THEN
    RETURN 'refused';
  END IF;
  INSERT INTO public.hub_visitor_buckets AS b (event_id, bucket_start, opens)
  VALUES (p_event_id, date_bin('15 minutes', now(), TIMESTAMPTZ '2000-01-01 00:00:00+00'), 1)
  ON CONFLICT (event_id, bucket_start) DO UPDATE SET opens = b.opens + 1;
  DELETE FROM public.hub_visitor_buckets
   WHERE event_id = p_event_id AND bucket_start < now() - INTERVAL '1 day';
  RETURN 'visitor';
END;
$$;

-- ⚠ Name the roles: Supabase's default privileges grant anon + authenticated
-- their own EXECUTE, which `FROM PUBLIC` alone does not remove.
REVOKE ALL ON FUNCTION public.record_hub_view(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_hub_view(UUID, UUID) TO service_role;

-- ── 4 · event_hub_viewers — the ONE read (the Home card) ────────────────────
-- SECURITY INVOKER on purpose: the two tables' policies (and, through them, the
-- guests table's) decide what this caller sees — no second copy of the rule.
-- `may_name` only WORDS the card for a caller who may not read the guest list
-- ("names show for people with the guest list") instead of drawing "no guests";
-- it never admits a row.
-- Visitors are counted in quarter-hours: every block that overlaps the window.
CREATE OR REPLACE FUNCTION public.event_hub_viewers(p_event_id UUID, p_window_minutes INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH w AS (
    SELECT greatest(5, least(coalesce(p_window_minutes, 30), 60)) AS minutes
  ),
  win AS (
    SELECT minutes, now() - make_interval(mins => minutes) AS since FROM w
  ),
  seen AS (
    SELECT v.guest_id, v.last_seen_at, g.first_name, g.last_name, g.display_name, g.photo_url
      FROM public.hub_guest_views v
      JOIN public.guests g ON g.guest_id = v.guest_id AND g.deleted_at IS NULL
     WHERE v.event_id = p_event_id
       AND v.last_seen_at > (SELECT since FROM win)
  )
  SELECT jsonb_build_object(
    'team', (
      p_event_id IN (SELECT public.current_couple_event_ids())
      OR p_event_id IN (SELECT public.current_moderator_event_ids())
    ),
    'may_name', (
      p_event_id IN (SELECT public.current_couple_event_ids())
      OR public.moderator_area_level(p_event_id, 'guest_list') IS NOT NULL
    ),
    'window_minutes', (SELECT minutes FROM win),
    'guest_total', (SELECT count(*)::int FROM seen),
    'guests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'guest_id', s.guest_id,
               'first_name', s.first_name,
               'last_name', s.last_name,
               'display_name', s.display_name,
               'photo_url', s.photo_url,
               'seen_at', s.last_seen_at
             ) ORDER BY s.last_seen_at DESC)
        FROM (SELECT * FROM seen ORDER BY last_seen_at DESC LIMIT 24) s
    ), '[]'::jsonb),
    'visitors', coalesce((
      SELECT sum(b.opens)::int FROM public.hub_visitor_buckets b
       WHERE b.event_id = p_event_id
         AND b.bucket_start + INTERVAL '15 minutes' > (SELECT since FROM win)
    ), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.event_hub_viewers(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_hub_viewers(UUID, INTEGER) TO authenticated;

-- ── 5 · the dashboard's presence channel (`event-team:{event_id}`) ──────────
-- Who is on the dashboard now is Realtime PRESENCE on a PRIVATE channel, joined
-- once by the event layout (`app/dashboard/[eventId]/_components/event-team-presence.tsx`).
-- Nothing is stored. ⚠ TWO HALVES, AND ONE ALONE IS WORSE THAN NEITHER: these
-- policies AND `private: true` on the client ship together (the call/panood
-- lesson). A policy that RAISES fails every private topic on the table, so the
-- predicate never throws, and `authenticated` must hold EXECUTE on it
-- (tests/db/realtime-policy-predicates-are-callable.db.test.ts).
CREATE OR REPLACE FUNCTION public.event_team_presence_can_access(p_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN FALSE;
  END IF;
  IF p_topic IS NULL OR p_topic NOT LIKE 'event-team:%' THEN
    RETURN FALSE;
  END IF;
  BEGIN
    -- 'event-team:' is 11 characters, so the event id starts at 12.
    v_event := substring(p_topic FROM 12)::uuid;
  EXCEPTION WHEN others THEN
    RETURN FALSE; -- a malformed topic — never throw inside an RLS predicate
  END;
  IF v_event IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN v_event IN (SELECT public.current_couple_event_ids())
      OR v_event IN (SELECT public.current_moderator_event_ids());
END $$;

COMMENT ON FUNCTION public.event_team_presence_can_access(TEXT) IS
  'Authorises the private Realtime presence channel event-team:{event_id} (Who''s here, owner 2026-10-29): the event''s hosts and accepted moderators. FALSE for anon, a guest, another topic or a malformed id; never throws.';

REVOKE ALL ON FUNCTION public.event_team_presence_can_access(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_team_presence_can_access(TEXT) TO authenticated;

COMMIT;

DO $guard$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RAISE NOTICE 'realtime.messages absent (migration replay / local shell) — skipping event-team presence policies';
    RETURN;
  END IF;

  EXECUTE $ddl$
    DROP POLICY IF EXISTS event_team_presence_can_read ON realtime.messages;
    CREATE POLICY event_team_presence_can_read
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        realtime.topic() LIKE 'event-team:%'
        AND public.event_team_presence_can_access(realtime.topic())
      );

    DROP POLICY IF EXISTS event_team_presence_can_write ON realtime.messages;
    CREATE POLICY event_team_presence_can_write
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        realtime.topic() LIKE 'event-team:%'
        AND public.event_team_presence_can_access(realtime.topic())
      );
  $ddl$;
END $guard$;
