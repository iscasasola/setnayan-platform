-- ============================================================================
-- 20270816100206_creator_audience_layer_views_and_follows.sql
-- Creator "Adventure Chapter" — AUDIENCE layer (owner 2026-07-16).
--
-- Spec: ~/Documents/Claude/Projects/Setnayan/
--         Creator_Adventure_Chapter_Build_Plan_2026-07-16.md   (audience layer)
--       + Creator_Program_Council_Verdict_2026-07-15.md
--
-- The differentiator of the user-native creator model is AUDIENCE:
-- viewers + followers. This migration owns the DB half:
--
--   1. AGGREGATE VIEW COUNTS (privacy-safe — no PII, no per-viewer row):
--        • creator_chapters.view_count   BIGINT DEFAULT 0
--        • users.profile_view_count      BIGINT DEFAULT 0
--      Bumped by two SECURITY DEFINER RPCs that ATOMICALLY increment and
--      self-gate to genuinely-public targets (published chapter / opted-in
--      profile) so a counter can never be inflated for a draft or a hidden
--      profile. Called from a lightweight client "view beacon" via the
--      service-role admin client (app-side cookie dedup avoids refresh-spam).
--      CRON-FREE — a plain per-view UPDATE, no scheduler.
--
--   2. LIGHTWEIGHT FOLLOW:
--        • user_follows(follower_user_id, followed_user_id) — the follow edges.
--          RLS Pattern A: the follower owns their rows (follower_user_id =
--          auth.uid()) for select/insert/delete. The follow GRAPH is therefore
--          PRIVATE — a caller only ever reads their OWN follows; who-follows-whom
--          is never publicly queryable.
--        • users.followers_count BIGINT DEFAULT 0 — the ONLY publicly-surfaced
--          audience number, maintained by an AFTER INSERT/DELETE trigger on
--          user_follows. The public /u page reads this aggregate WITHOUT ever
--          touching the graph (no way to enumerate a profile's followers).
--
-- RLS (canonical patterns ONLY — 02_Specifications/RLS_Policy_Pattern.md):
--   • user_follows → Pattern A (per-user private data) + admin override.
--   • The count columns live on existing tables (users / creator_chapters)
--     whose RLS is unchanged; the public read path is the service-role admin
--     client (lib/creator-public, lib/public-profile), exactly as today.
--
-- Canonical-ID note: user_follows is internal plumbing (an edge table that
-- never leaves the backend), so it carries only the hidden bigserial PK — no
-- S89… public_id (the generator is for entities surfaced to users).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1a. Aggregate view-count columns (no per-viewer PII stored).
-- ----------------------------------------------------------------------------

ALTER TABLE public.creator_chapters
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.creator_chapters.view_count IS
  'Aggregate public views of the chapter detail page. No PII — a single running total bumped by increment_chapter_view() (SECURITY DEFINER, self-gated to published+public). App-side cookie dedup avoids refresh-spam.';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_view_count BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.profile_view_count IS
  'Aggregate public views of this account''s /u profile. No PII — bumped by increment_profile_view() (SECURITY DEFINER, self-gated to public_profile_enabled).';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS followers_count BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.followers_count IS
  'Aggregate follower count, maintained by the user_follows AFTER INSERT/DELETE trigger. The ONLY publicly-surfaced audience number — lets /u show a follower total WITHOUT exposing the (private) follow graph.';

-- ----------------------------------------------------------------------------
-- 1b. Atomic, self-gated view-increment RPCs (SECURITY DEFINER).
--     Each errs on the side of NOT counting: it only bumps a target that is
--     genuinely public right now, so a draft chapter or a hidden profile can
--     never accrue views. Called by the app via the service-role admin client;
--     granted to service_role only (mirrors increment_discount_uses).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_chapter_view(p_public_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.creator_chapters c
     SET view_count = c.view_count + 1
   WHERE c.public_id = p_public_id
     AND c.status = 'published'
     AND EXISTS (
       SELECT 1 FROM public.users u
        WHERE u.user_id = c.user_id
          AND u.public_profile_enabled = TRUE
     );
$$;

COMMENT ON FUNCTION public.increment_chapter_view(TEXT) IS
  'Atomically +1 a PUBLISHED chapter''s view_count when its owner''s profile is public. No-op otherwise (never inflates a draft/hidden target). Called via the service-role admin client from a client view-beacon.';

REVOKE EXECUTE ON FUNCTION public.increment_chapter_view(TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.increment_chapter_view(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_profile_view(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users u
     SET profile_view_count = u.profile_view_count + 1
   WHERE u.user_id = p_user_id
     AND u.public_profile_enabled = TRUE;
$$;

COMMENT ON FUNCTION public.increment_profile_view(UUID) IS
  'Atomically +1 an account''s profile_view_count when its public profile is enabled. No-op otherwise. Called via the service-role admin client from a client view-beacon.';

REVOKE EXECUTE ON FUNCTION public.increment_profile_view(UUID) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.increment_profile_view(UUID) TO service_role;

-- ----------------------------------------------------------------------------
-- 2a. user_follows — the follow edges. RLS Pattern A (follower owns rows).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_follows (
  id                BIGSERIAL PRIMARY KEY,
  follower_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_follows_unique UNIQUE (follower_user_id, followed_user_id),
  CONSTRAINT user_follows_no_self CHECK (follower_user_id <> followed_user_id)
);

-- Fan-out read: "who follows user X" (the notify-on-publish query, run
-- service-role) walks this. followed_user_id first so the lookup is a range scan.
CREATE INDEX IF NOT EXISTS user_follows_followed_idx
  ON public.user_follows (followed_user_id);
-- "who does user X follow" (a future following-list surface, plus the
-- select-own RLS path).
CREATE INDEX IF NOT EXISTS user_follows_follower_idx
  ON public.user_follows (follower_user_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Pattern A — the follower owns their follow rows. select/insert/delete are all
-- scoped to follower_user_id = auth.uid(), so a caller can only see + manage
-- THEIR OWN follows. The follow GRAPH stays private (no one can read who follows
-- whom; only aggregate followers_count is public, via the trigger below).
DROP POLICY IF EXISTS follower_owns_follow ON public.user_follows;
CREATE POLICY follower_owns_follow ON public.user_follows
  FOR ALL TO authenticated
  USING (follower_user_id = auth.uid())
  WITH CHECK (follower_user_id = auth.uid());

-- Setnayan admin override (support / abuse review).
DROP POLICY IF EXISTS admin_full_access_user_follows ON public.user_follows;
CREATE POLICY admin_full_access_user_follows ON public.user_follows
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2b. followers_count trigger — keep the public aggregate in sync WITHOUT
--     exposing the graph. SECURITY DEFINER so the counter update on the
--     FOLLOWED user's row succeeds regardless of the follower's RLS (a follower
--     can't UPDATE another users row directly, by design). Guarded at >= 0.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_user_followers_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
       SET followers_count = followers_count + 1
     WHERE user_id = NEW.followed_user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
       SET followers_count = GREATEST(followers_count - 1, 0)
     WHERE user_id = OLD.followed_user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_user_followers_count() IS
  'Maintains users.followers_count from user_follows insert/delete. SECURITY DEFINER so the followed user''s counter updates despite Pattern A RLS on users. Clamped at >= 0.';

DROP TRIGGER IF EXISTS sync_user_followers_count_trg ON public.user_follows;
CREATE TRIGGER sync_user_followers_count_trg
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_followers_count();

COMMIT;
