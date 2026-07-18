-- ============================================================================
-- 20270815042234_creator_user_native_drop_applications_and_is_creator.sql
-- Creator "Adventure Chapter" — creator is now USER-NATIVE (owner 2026-07-16).
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Adventure_Chapter_Build_Plan_2026-07-16.md
--       (the GATED apply→approve model in that plan is SUPERSEDED by this refactor)
--
-- The model change (owner-locked 2026-07-16):
--   "creator = user." Any authenticated user may author + publish Adventure
--   Chapters. A user "is a creator" now simply means they've made their story
--   public — i.e. they have >=1 PUBLISHED chapter on a public profile. The
--   apply/approve gate and the `users.is_creator` permission flag are retired.
--
-- This migration owns the DB half of that refactor, in dependency order:
--   1. Rewrite creator_chapters' public-read policy to drop the is_creator
--      condition (must run BEFORE we can drop the column it references).
--   2. DROP the creator_applications table (self-apply→approve pipe, retired).
--   3. DROP the users.is_creator column (no longer a gate; nothing references
--      it once (1) lands + the app edits ship).
--
-- Note: the users-privilege guard trigger (20270814328403) deliberately does
-- NOT guard is_creator — its comment already anticipates user-native creators —
-- so dropping the column here does not touch that trigger.
--
-- creator_chapters itself (the rows, the owner-write + admin RLS), the embed
-- allowlist/sandbox, timeline/detail rendering, and teaser render are all
-- UNCHANGED. Only the gating + the apply/approve machinery change.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. creator_chapters public-read policy → user-native gate.
--    Was: status='published' AND owner is_creator AND public_profile_enabled.
--    Now: status='published' AND owner public_profile_enabled  (the published
--    chapter itself is the "creator" signal; is_creator is gone). Still Pattern
--    D (public-read to anon/authenticated), still errs CLOSED for anon/non-owner
--    under users' own RLS — never leaks a draft or a hidden profile.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_can_read_published_chapter ON public.creator_chapters;
CREATE POLICY public_can_read_published_chapter ON public.creator_chapters
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = creator_chapters.user_id
        AND u.public_profile_enabled = TRUE
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Retire the apply/approve pipe — drop creator_applications entirely.
--    Added earlier the same day (20270813536704) and never carried real data;
--    the whole self-apply→admin-approve flow is gone. CASCADE clears its
--    policies + indexes with it.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.creator_applications CASCADE;

-- ----------------------------------------------------------------------------
-- 3. Retire the permission flag — drop users.is_creator.
--    No policy, trigger, or app path references it after step 1 + the app edits.
--    "Is a creator" is now derived (>=1 published chapter on a public profile),
--    not stored.
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  DROP COLUMN IF EXISTS is_creator;

COMMIT;
