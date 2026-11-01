-- ============================================================================
-- THE MOOD BOARD'S PHOTOS ARE CHANGED BY THE HOSTS — and only the columns the
-- app actually changes.
--
-- WHAT WAS TRUE: the INSERT and UPDATE policies on event_inspiration_assets
-- (20260625000000, re-issued once-per-query by 20271281556823) admitted ANY
-- event_members row of the event, whatever its member_type — the same
-- unscoped-membership class 20270920030000 closed on the money tables. And the
-- table carried Supabase's stock table-wide grants, so UPDATE reached every
-- column.
--
-- WHO WRITES IT (measured 2026-10-30 — code and prod):
--   · studio/mood-board/actions.ts — reorderMoodboardSlot (slot_key,
--     slot_position), applyMoodboardTemplate + applyGalleryPick (INSERT;
--     removed_at) — the caller's OWN session client;
--   · wizard-actions.ts — uploadMoodboardSlot (removed_at; INSERT),
--     removeMoodboardSlot (removed_at) — the caller's OWN session client;
--   · couple_decide_inspiration_suggestion / couple_undo_kept_inspiration_
--     suggestion — SECURITY DEFINER, gated on colour_access_caller_is_couple;
--     not subject to these policies or grants and unchanged here.
--   No server path writes it with the service-role client, and no app path
--   DELETEs it. Prod: every row ever written was added by a 'couple' member.
--
-- WHO MAY WRITE IT NOW: the hosts — member_type 'couple' (the creator and
-- every full co-host; sync_delegate_membership makes a full co-host a couple
-- member) through current_couple_event_ids(), the SECURITY DEFINER helper the
-- sibling host-only policies use — and admins (event_inspiration_assets_
-- admin_all, unchanged). This matches lib/delegate-areas.ts: the Mood Board
-- area is not settable for a delegate (FIXED_AREA_LEVEL mood_board = 'view')
-- and "the Mood Board saves for the hosts alone", exactly as the palette and
-- theme on public.events already do (couple_can_update_event). Prod holds 0
-- delegate seats with mood_board = 'edit'. If that area is ever made settable,
-- the area arm (current_moderator_area_levels('mood_board') … = 'edit') is the
-- one line to add to both policies.
--
-- UNCHANGED: event_inspiration_assets_host_select (everyone who reads today
-- still reads), admin_all, the SELECT grants.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY; REVOKE/GRANT re-runnable.
-- ============================================================================

BEGIN;

-- ── 1. INSERT — a host, stamping themself ───────────────────────────────────
DROP POLICY IF EXISTS event_inspiration_assets_host_insert ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_insert
  ON public.event_inspiration_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by_user_id = (SELECT auth.uid())
    AND event_id IN (SELECT public.current_couple_event_ids())
  );

-- ── 2. UPDATE — a host, and the row stays on a host's event ─────────────────
DROP POLICY IF EXISTS event_inspiration_assets_host_update ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_update
  ON public.event_inspiration_assets
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ── 3. Grants — UPDATE only the three columns the app changes ───────────────
-- removed_at (soft remove / replace-in-place), slot_key + slot_position (the
-- drag-reorder). Everything else on a board row (image_url, the swatches,
-- added_by_user_id, event_id, provenance) is written once, at INSERT.
-- anon: no policy has ever admitted it (every predicate needs auth.uid());
-- the write grants are removed so the surface says so. SELECT is untouched.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.event_inspiration_assets FROM anon;
REVOKE UPDATE, TRUNCATE ON public.event_inspiration_assets FROM authenticated;
GRANT UPDATE (removed_at, slot_key, slot_position) ON public.event_inspiration_assets TO authenticated;

COMMENT ON POLICY event_inspiration_assets_host_insert ON public.event_inspiration_assets IS
  'A host (member_type couple, via current_couple_event_ids) adds a Mood Board photo, stamped as themself. '
  'Guests, suppliers and delegates read the board but do not write it (20271297469032).';
COMMENT ON POLICY event_inspiration_assets_host_update ON public.event_inspiration_assets IS
  'A host removes or moves a Mood Board photo; column grants limit UPDATE to removed_at, slot_key, slot_position '
  '(20271297469032).';

-- ── 4. Post-condition — refuse to commit a half-applied lock ────────────────
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO bad
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'event_inspiration_assets'
     AND policyname IN ('event_inspiration_assets_host_insert', 'event_inspiration_assets_host_update')
     AND NOT (coalesce(qual, '') || coalesce(with_check, '')) ILIKE '%current_couple_event_ids%';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'mood board write policy not host-scoped: %', bad;
  END IF;
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'event_inspiration_assets'
         AND policyname IN ('event_inspiration_assets_host_insert', 'event_inspiration_assets_host_update')) <> 2 THEN
    RAISE EXCEPTION 'mood board write policies missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.event_inspiration_assets', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still holds table-wide UPDATE on event_inspiration_assets';
  END IF;
  IF has_column_privilege('authenticated', 'public.event_inspiration_assets', 'image_url', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated may still UPDATE event_inspiration_assets.image_url';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.event_inspiration_assets', 'removed_at', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated lost UPDATE on event_inspiration_assets.removed_at — the app''s remove would break';
  END IF;
END;
$$;

COMMIT;
