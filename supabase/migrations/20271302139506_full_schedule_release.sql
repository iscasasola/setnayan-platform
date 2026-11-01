-- full_schedule_release
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 📣 RELEASE — "BASIC, THEN FULL" (owner 2026-11-01, DECISION_LOG "FULL SCHEDULE: A HOST OR COORDINATOR PRESSES
-- RELEASE, NOTIFICATIONS ONLY"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3, §3b, §11b).
-- Owner, verbatim: *"It starts with just the basic schedule. But 1 week before the event, we will show their full
-- schedule."* → *"Coordinator or host presses release"* · *"Just norifications please"*.
--
--   · Until Release, Event Hub › Me shows a guest the chapters they are invited to, and a role holder an ESTIMATED
--     call time. After Release each guest sees their OWN full schedule and their exact call time.
--   · It never goes by itself: one week out the Schedule and Home's widget prompt the host (Home's Release door).
--   · Release is PRO (§3b, ruled 1 Nov). On Free the day stays at the before-Release view for good. The Pro gate is
--     in the app — at the press (`releaseFullSchedule`) AND at every guest render (`lib/guest-your-schedule.server.ts`
--     reads this column only when the event holds Pro) — so a stamp a Free event somehow carries draws nothing.
--
-- ── 1 · THE RECORD: `events.schedule_released_at` ──────────────────────────────────────────────────────────────────
-- NULL = not released. Set ONCE, by `release_full_schedule` below, and never moved again (a second press is a no-op:
-- nobody is notified twice). It is an `events` column on purpose: a write to `events` moves the guest page's stamp
-- (`event_public_rev`, 20271275959355), so every cached Event Hub copy of the event is drawn afresh at once.
--
-- ── 2 · THE ONE WRITER: `release_full_schedule(event)` ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER, for `authenticated`. It refuses anyone who is not a HOST of the event (`current_couple_event_ids`)
-- or a COORDINATOR/helper holding Edit on the Schedule (`moderator_area_level(…, 'schedule') = 'edit'`) — the same two
-- doors that may announce (20271132843141). It stamps the time, then writes ONE in-app notice to every account that
-- holds a guest seat on the event (`event_members.guest_id`, the guest not removed), the presser excepted — one
-- statement, never a per-guest loop in the app. Guests without an account depend on the link the host shares, and see
-- their schedule on their next open of the Hub. No email (owner).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS schedule_released_at TIMESTAMPTZ;

-- `events` SELECT is a column allowlist (20271007100000): a new column is born unreadable to `authenticated`. The
-- hosts' Schedule reads it on their own session. NO UPDATE grant — the one writer is the function below.
GRANT SELECT (schedule_released_at) ON public.events TO authenticated;

COMMENT ON COLUMN public.events.schedule_released_at IS
  'Release (owner 2026-11-01, plan §3): when a host or coordinator released the full schedule to guests. NULL = not '
  'released — guests see only the chapters they are invited to (and role holders an Estimated call time). Written '
  'ONLY by release_full_schedule(), once. Honoured only for an event holding Pro (§3b) — the app asks, at the press '
  'and at every guest render.';

CREATE OR REPLACE FUNCTION public.release_full_schedule(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_at    TIMESTAMPTZ;
  v_was   TIMESTAMPTZ;
  v_name  TEXT;
  v_slug  TEXT;
  v_told  INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'release_full_schedule: sign in first' USING ERRCODE = '42501';
  END IF;
  -- ⚠ NULL-SAFE ON PURPOSE: `moderator_area_level` is NULL for anyone who is not a helper, and `NOT (false OR NULL)`
  -- is NULL — which an IF reads as "do not raise". Caught by the db test on its first run (a stranger released).
  IF NOT (
    p_event_id IN (SELECT public.current_couple_event_ids())
    OR COALESCE(public.moderator_area_level(p_event_id, 'schedule') = 'edit', false)
  ) THEN
    RAISE EXCEPTION 'release_full_schedule: only a host or a coordinator with Edit on the Schedule may release'
      USING ERRCODE = '42501';
  END IF;

  SELECT e.schedule_released_at, e.display_name, e.slug
    INTO v_was, v_name, v_slug
    FROM public.events e
   WHERE e.event_id = p_event_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release_full_schedule: no such event' USING ERRCODE = 'P0002';
  END IF;

  -- Already released: say when, notify nobody again.
  IF v_was IS NOT NULL THEN
    RETURN jsonb_build_object('released_at', v_was, 'told', 0, 'already', true);
  END IF;

  UPDATE public.events SET schedule_released_at = now() WHERE event_id = p_event_id
  RETURNING schedule_released_at INTO v_at;

  -- 🔔 One notice per account holding a guest seat — in-app only (owner: "Just notifications please").
  WITH seats AS (
    SELECT DISTINCT m.user_id
      FROM public.event_members m
      JOIN public.guests g ON g.guest_id = m.guest_id AND g.event_id = p_event_id AND g.deleted_at IS NULL
     WHERE m.event_id = p_event_id
       AND m.guest_id IS NOT NULL
       AND m.user_id IS NOT NULL
       AND m.user_id <> v_uid
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, body, related_url, event_id)
    SELECT s.user_id,
           'schedule_released'::public.notification_type,
           'Your full schedule is ready',
           left(format('%s: open Me on the Event Hub for your own schedule and call time.', COALESCE(NULLIF(btrim(v_name), ''), 'Your event')), 280),
           CASE WHEN v_slug IS NULL THEN NULL ELSE '/' || v_slug || '?tab=me' END,
           p_event_id
      FROM seats s
    RETURNING 1
  )
  SELECT count(*) INTO v_told FROM ins;

  RETURN jsonb_build_object('released_at', v_at, 'told', v_told, 'already', false, 'notice', 'schedule_released');
END;
$$;

REVOKE ALL ON FUNCTION public.release_full_schedule(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_full_schedule(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.release_full_schedule(UUID) IS
  'Release (owner 2026-11-01): a host or a schedule-Edit coordinator stamps events.schedule_released_at once and '
  'every guest account on the event gets ONE in-app schedule_released notice (no email). Idempotent: a second call '
  'returns the first time and notifies nobody. The Pro gate (plan §3b) is the app''s, at the press and at every '
  'guest render.';

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT), so the block below is reproduced
-- VERBATIM from 20271285020592 (the latest carrier of it) — extracted mechanically, not retyped — including its
-- private list and its refuse-if-empty guard.

DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          -- service_role only, named EXPLICITLY. NOT `auth.uid() IS NULL` —
          -- that is also true for anon, which would hand every row to an
          -- unauthenticated caller. Reproduced verbatim from 20271008731642.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';
