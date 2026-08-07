-- 20271119535345_kwento_voice_depth_and_rpc_arg.sql
--
-- A LIVE, USER-FACING BUG: every guest who writes a message on a Papic photo
-- gets "save failed", and has since the Kwento Phase 1 Flash tier shipped
-- (commit a8262740e).
--
-- WHAT BROKE, EXACTLY
-- -------------------
-- The route posts EIGHT named arguments:
--   app/api/papic/kwento/route.ts:95  admin.rpc('submit_photo_message', {
--     p_guest_id, p_source_table, p_source_id, p_body, p_prompt,
--     p_moderation_state, p_moderation_labels, p_voice_depth })
--
-- Production's function takes SEVEN — there is no p_voice_depth:
--   submit_photo_message(p_guest_id uuid, p_source_table text, p_source_id uuid,
--                        p_body text, p_prompt text, p_moderation_state text,
--                        p_moderation_labels jsonb)
--
-- PostgREST resolves an RPC by its exact set of NAMED arguments. One unknown
-- name means NO candidate matches, so the call fails before the body ever runs.
-- The route's error handler matches the failure against its FRIENDLY table,
-- finds nothing, and returns a generic 500 `save_failed`. Nothing throws in our
-- code, nothing is logged as a schema problem, and CI is green — because CI
-- never calls the live database.
--
-- 🔑 A PHANTOM ARGUMENT KILLS THE CALL EXACTLY LIKE A PHANTOM COLUMN KILLS A
-- SELECT. This repo has written that lesson down twice — once for columns
-- ("a Supabase select naming a phantom column returns an ERROR, not a crash, so
-- it ships as a silently empty drawer") and once for enum values. Arguments are
-- the third face of the same rule.
--
-- WHY THE SCHEMA WAS NEVER APPLIED
-- --------------------------------
-- The Phase 1 commit put its migration in `apps/supabase/migrations/`, an
-- ORPHAN directory. `supabase db push` reads `<repoRoot>/supabase/migrations`
-- only, so that file has never been applied and never will be. The application
-- code shipped; the schema it depends on went somewhere nothing reads. Both
-- halves looked done.
--
-- ⚠ The orphan file also carried `last_kwento_notify_at` and
-- `kwento_flash_auto_wall`. Those two DID reach prod later, via
-- `20271011120000_reconcile_columns_the_code_already_uses.sql` — a migration
-- whose name is itself a confession. `voice_depth` and its two CHECK
-- constraints were missed by that reconciliation and are still absent, which is
-- why the feature is broken rather than merely undocumented.
--
-- Verified against prod 2026-08-07 before writing this:
--   photo_messages.voice_depth ......... ABSENT
--   events.last_kwento_notify_at ....... present
--   events.kwento_flash_auto_wall ...... present
--   submit_photo_message ............... 7 args, no p_voice_depth
--   callers of the RPC ................. exactly one (the route above)

-- ── 1 · the column the feature needs ────────────────────────────────────────
ALTER TABLE public.photo_messages
  ADD COLUMN IF NOT EXISTS voice_depth TEXT NOT NULL DEFAULT 'story';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_voice_depth'
      AND conrelid = 'public.photo_messages'::regclass
  ) THEN
    ALTER TABLE public.photo_messages
      ADD CONSTRAINT chk_voice_depth CHECK (voice_depth IN ('flash', 'story'));
  END IF;

  -- Length is enforced by the API first; these are the DB-level safety net.
  -- Flash is the short, auto-walling tier; Story is the existing 280-char path.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_flash_length'
      AND conrelid = 'public.photo_messages'::regclass
  ) THEN
    ALTER TABLE public.photo_messages
      ADD CONSTRAINT chk_flash_length
        CHECK (voice_depth <> 'flash' OR length(body_text) <= 50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_story_length'
      AND conrelid = 'public.photo_messages'::regclass
  ) THEN
    ALTER TABLE public.photo_messages
      ADD CONSTRAINT chk_story_length
        CHECK (voice_depth <> 'story' OR length(body_text) <= 280);
  END IF;
END $$;

COMMENT ON COLUMN public.photo_messages.voice_depth IS
  'Kwento tier: flash (<=50 chars, auto-walls when clean) or story (<=280, couple-review). Added 2026-08-07; the original migration sat unapplied in an orphan apps/supabase/migrations dir since the Phase 1 commit, which is why every guest message save returned save_failed.';

-- ── 2 · the RPC argument the route has been sending all along ───────────────
-- DROP then CREATE, not CREATE OR REPLACE: adding a parameter changes the
-- SIGNATURE, so REPLACE would leave the 7-arg function in place alongside the
-- new one. With p_voice_depth defaulted, a 7-named-argument call would then
-- match BOTH and PostgREST would fail on the ambiguity — trading a broken
-- feature for a differently broken one. There is exactly one caller (verified),
-- and it always sends all eight.
DROP FUNCTION IF EXISTS public.submit_photo_message(uuid, text, uuid, text, text, text, jsonb);

CREATE FUNCTION public.submit_photo_message(
  p_guest_id          UUID,
  p_source_table      TEXT,
  p_source_id         UUID,
  p_body              TEXT,
  p_prompt            TEXT,
  p_moderation_state  TEXT,
  p_moderation_labels JSONB DEFAULT NULL,
  p_voice_depth       TEXT  DEFAULT 'story'
)
RETURNS SETOF public.photo_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event         UUID;
  v_anchor_event  UUID;
  v_existing      public.photo_messages%ROWTYPE;
  v_max_len       INT;
BEGIN
  IF p_moderation_state NOT IN ('clean','flagged') THEN
    RAISE EXCEPTION 'kwento:invalid_state';
  END IF;

  IF p_voice_depth IS NULL OR p_voice_depth NOT IN ('flash','story') THEN
    RAISE EXCEPTION 'kwento:invalid_depth';
  END IF;

  -- Depth decides the ceiling. Previously hardcoded 280 for everything, which
  -- would have let a 280-char "flash" through the RPC and then be rejected by
  -- chk_flash_length as a raw constraint violation instead of a named error.
  v_max_len := CASE WHEN p_voice_depth = 'flash' THEN 50 ELSE 280 END;
  IF p_body IS NULL OR char_length(trim(p_body)) < 1 OR char_length(p_body) > v_max_len THEN
    RAISE EXCEPTION 'kwento:invalid_body';
  END IF;

  SELECT g.event_id INTO v_event FROM public.guests g
    WHERE g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF v_event IS NULL THEN RAISE EXCEPTION 'kwento:unknown_guest'; END IF;

  -- Block lever.
  IF EXISTS (
    SELECT 1 FROM public.guest_message_blocks b
    WHERE b.event_id = v_event AND b.guest_id = p_guest_id AND b.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'kwento:blocked'; END IF;

  -- Anchor must exist and belong to the SAME event.
  IF p_source_table = 'papic_photos' THEN
    SELECT pp.event_id INTO v_anchor_event FROM public.papic_photos pp WHERE pp.photo_id = p_source_id;
  ELSIF p_source_table = 'papic_guest_captures' THEN
    SELECT gc.event_id INTO v_anchor_event FROM public.papic_guest_captures gc WHERE gc.capture_id = p_source_id;
  ELSE
    RAISE EXCEPTION 'kwento:invalid_anchor';
  END IF;
  IF v_anchor_event IS NULL OR v_anchor_event <> v_event THEN
    RAISE EXCEPTION 'kwento:invalid_anchor';
  END IF;

  -- Serialize this guest's submissions (cap + burst are race-safe).
  PERFORM pg_advisory_xact_lock(hashtextextended('kwento:' || p_guest_id::text, 0));

  -- Burst: max 3 per rolling 60s.
  IF (SELECT count(*) FROM public.photo_messages m
      WHERE m.guest_id = p_guest_id AND m.submitted_at > NOW() - INTERVAL '60 seconds') >= 3 THEN
    RAISE EXCEPTION 'kwento:burst';
  END IF;

  SELECT * INTO v_existing FROM public.photo_messages m
    WHERE m.source_table = p_source_table AND m.source_id = p_source_id
      AND m.guest_id = p_guest_id;

  IF v_existing.id IS NULL THEN
    -- Cap: 10 per event per guest (rejected/user_deleted included by design).
    IF (SELECT count(*) FROM public.photo_messages m
        WHERE m.event_id = v_event AND m.guest_id = p_guest_id) >= 10 THEN
      RAISE EXCEPTION 'kwento:cap';
    END IF;
    RETURN QUERY
      INSERT INTO public.photo_messages
        (event_id, source_table, source_id, guest_id, body_text, prompt_text,
         status, moderation_state, moderation_labels, consent_captured_at, voice_depth)
      VALUES
        (v_event, p_source_table, p_source_id, p_guest_id, p_body, p_prompt,
         'pending', p_moderation_state, p_moderation_labels, NOW(), p_voice_depth)
      RETURNING *;
  ELSE
    -- Edit path: resets moderation + pulls wall eligibility (anti
    -- bait-and-switch); locked once baked into a render; max 3 edits.
    IF v_existing.baked_into_render THEN RAISE EXCEPTION 'kwento:baked'; END IF;
    IF v_existing.user_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'kwento:deleted'; END IF;
    IF v_existing.edit_count >= 3 THEN RAISE EXCEPTION 'kwento:edit_limit'; END IF;
    RETURN QUERY
      UPDATE public.photo_messages m SET
        body_text = p_body,
        prompt_text = p_prompt,
        status = 'pending',
        moderation_state = p_moderation_state,
        moderation_labels = p_moderation_labels,
        voice_depth = p_voice_depth,
        wall_eligible = FALSE,
        edited_at = NOW(),
        edit_count = m.edit_count + 1,
        reviewed_by_couple_at = NULL,
        reviewed_by_user_id = NULL,
        updated_at = NOW()
      WHERE m.id = v_existing.id
      RETURNING *;
    -- An edited caption must leave the projection until re-approved.
    UPDATE public.wall_feed wf SET caption_text = NULL, caption_message_id = NULL
      WHERE wf.caption_message_id = v_existing.message_id;
  END IF;
END;
$function$;

-- The DROP took the old grants with it. Restore exactly what prod had —
-- service_role only — and REVOKE the default PUBLIC execute in the same
-- migration, per the standing house rule. This RPC is SECURITY DEFINER and
-- owns the integrity rules, so anon/authenticated must never reach it.
REVOKE ALL ON FUNCTION public.submit_photo_message(uuid, text, uuid, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_photo_message(uuid, text, uuid, text, text, text, jsonb, text) TO service_role;

COMMENT ON FUNCTION public.submit_photo_message(uuid, text, uuid, text, text, text, jsonb, text) IS
  'Guest Kwento submit/edit. service_role only (called from the /api/papic/kwento route). p_voice_depth was added 2026-08-07: the route had been sending it since the Phase 1 Flash commit while the function did not accept it, so PostgREST matched no candidate and EVERY guest message save returned save_failed.';
