-- ============================================================================
-- THE MOOD BOARD'S PHOTOS ARE CHANGED BY THE HOSTS — AND BY WHOEVER THEY GIVE
-- MOOD BOARD ACCESS. Everyone else views.
--
-- Owner, verbatim, 2026-10-30 (DECISION_LOG "THE MOOD BOARD IS CHANGED BY THE
-- HOSTS — AND BY ANY SUPPLIER THEY GIVE ACCESS TO, NOT BY EVERY MEMBER"):
-- "Only the host and whoever supplier they give access to and not all" ·
-- "The rest can view but not edit" · "Host is the owners of the event".
--
-- ── WHAT 20271297469032 LEFT ───────────────────────────────────────────────
-- INSERT/UPDATE on event_inspiration_assets admit the hosts only
-- (current_couple_event_ids(): the creator and every full co-host), UPDATE is
-- column-granted to removed_at / slot_key / slot_position. Its header names
-- the one arm to add the day the Mood Board area becomes settable. This is
-- that day.
--
-- ── THE GRANT IS THE ONE THAT ALREADY EXISTS — NOT A NEW ONE ───────────────
-- A person the hosts let into their event holds an event_moderators seat, and
-- what that seat may change is its permissions_json.areas, area by area, set
-- in Event details › Event access (setDelegateArea) and read by
-- public.moderator_area_level / current_moderator_area_levels. That is how
-- the coordinator (a supplier) and every helper are already granted the guest
-- list, the seat plan, the day and the suppliers. lib/delegate-areas.ts now
-- offers Mood Board as Edit · View (View by default; no Off — nothing about
-- READING the board follows the area, so an Off would be a switch wired to
-- nothing). So the arm is exactly:
--     event_id IN (SELECT l.event_id
--                    FROM public.current_moderator_area_levels('mood_board') l
--                   WHERE l.level = 'edit')
-- No table, no column, no second place a grant could live.
--
-- 🔑 REVOKING IS IMMEDIATE BY CONSTRUCTION. The policy asks the seat on every
-- statement: setting the area back to View or removing the seat (removed_at)
-- changes what the very next write sees. Nothing is cached, nothing is copied.
--
-- ── WHAT DOES NOT MOVE ─────────────────────────────────────────────────────
--   · The column grants (removed_at, slot_key, slot_position) — a granted
--     person replaces, moves and removes photos exactly as a host does, and
--     can no more rewrite a row's image or provenance than a host can.
--   · event_inspiration_assets_host_select — everyone who reads still reads.
--   · admin_all.
--   · The palette, theme and dress code (columns of public.events) stay the
--     hosts': couple_can_update_event is held byte-for-byte by
--     the-events-update-policy-does-not-move.db.test.ts, and widening it would
--     hand a granted person EVERY column of the event row. A supplier's way to
--     the colours remains the separate MB16 colour grant (apply_colour_change).
--   · A booked supplier WITHOUT a seat keeps the 2026-10-19 path: Suggest a
--     photo → the couple taps Keep (SECURITY DEFINER, unchanged).
--
-- ── ONE ANSWER FOR THE SERVER ACTION AND THE POLICY ────────────────────────
-- public.can_change_mood_board_photos(event) asks the same two sets the
-- policies ask (plus is_admin(), which admin_all admits). The server actions
-- call it first and refuse in words, because a refused UPDATE under RLS is an
-- empty success and would otherwise render as a change that happened. The db
-- test holds the function and the policies to the same answer for every
-- person in its cast.
--
-- Idempotent: CREATE OR REPLACE + DROP POLICY IF EXISTS / CREATE POLICY.
-- ⚠ Never apply directly to production — the pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1. The question, once ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_change_mood_board_photos(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_event_id IS NOT NULL
     AND (SELECT auth.uid()) IS NOT NULL
     AND (
       p_event_id IN (SELECT public.current_couple_event_ids())
       OR p_event_id IN (
         SELECT l.event_id
           FROM public.current_moderator_area_levels('mood_board') l
          WHERE l.level = 'edit'
       )
       OR public.is_admin()
     );
$$;

COMMENT ON FUNCTION public.can_change_mood_board_photos(uuid) IS
  'TRUE when the caller may add, replace, move or remove photos on this event''s Mood Board: a host '
  '(current_couple_event_ids), a seat the hosts set to Mood Board Edit (current_moderator_area_levels), or an admin. '
  'The same question the event_inspiration_assets write policies ask (20271297714074); the server actions ask it '
  'first so a refusal is said in words.';

REVOKE ALL ON FUNCTION public.can_change_mood_board_photos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_change_mood_board_photos(uuid) TO authenticated;

-- ── 2. INSERT — a host or a granted person, stamping themself ───────────────
DROP POLICY IF EXISTS event_inspiration_assets_host_insert ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_insert
  ON public.event_inspiration_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by_user_id = (SELECT auth.uid())
    AND (
      event_id IN (SELECT public.current_couple_event_ids())
      OR event_id IN (
        SELECT l.event_id FROM public.current_moderator_area_levels('mood_board') l WHERE l.level = 'edit'
      )
    )
  );

-- ── 3. UPDATE — the same people, and the row stays on such an event ─────────
DROP POLICY IF EXISTS event_inspiration_assets_host_update ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_update
  ON public.event_inspiration_assets
  FOR UPDATE TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT l.event_id FROM public.current_moderator_area_levels('mood_board') l WHERE l.level = 'edit'
    )
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (
      SELECT l.event_id FROM public.current_moderator_area_levels('mood_board') l WHERE l.level = 'edit'
    )
  );

COMMENT ON POLICY event_inspiration_assets_host_insert ON public.event_inspiration_assets IS
  'A host, or a person the hosts set to Mood Board Edit, adds a Mood Board photo stamped as themself. '
  'Everyone else reads the board and does not write it (20271297714074).';
COMMENT ON POLICY event_inspiration_assets_host_update ON public.event_inspiration_assets IS
  'A host, or a person the hosts set to Mood Board Edit, removes or moves a Mood Board photo; column grants limit '
  'UPDATE to removed_at, slot_key, slot_position (20271297469032, 20271297714074).';

-- ── 4. Post-condition — refuse to commit a half-applied change ──────────────
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'event_inspiration_assets'
     AND policyname IN ('event_inspiration_assets_host_insert', 'event_inspiration_assets_host_update')
     AND NOT (
       (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%current_couple_event_ids%'
       AND (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%current_moderator_area_levels%'
     );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'mood board write policy is not hosts + granted: %', bad;
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'event_inspiration_assets'
         AND policyname IN ('event_inspiration_assets_host_insert', 'event_inspiration_assets_host_update')) <> 2 THEN
    RAISE EXCEPTION 'mood board write policies missing';
  END IF;
  -- Nothing in this migration may have widened what UPDATE reaches.
  IF has_table_privilege('authenticated', 'public.event_inspiration_assets', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated holds table-wide UPDATE on event_inspiration_assets';
  END IF;
  IF has_column_privilege('authenticated', 'public.event_inspiration_assets', 'image_url', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated may UPDATE event_inspiration_assets.image_url';
  END IF;
  IF has_function_privilege('anon', 'public.can_change_mood_board_photos(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon may execute can_change_mood_board_photos';
  END IF;
END;
$$;

COMMIT;
