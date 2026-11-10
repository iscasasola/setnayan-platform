-- social lane s badge posts and real milestone counts
-- Created via `pnpm migration:new`. KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND — the pipeline pushes this file.
-- ============================================================================
-- BUILD 6 · LANE S — SOCIAL AUTO-POST, THE BACKEND (owner 2026-11-10).
--
--   (1) post when a supplier earns a badge,
--   (2) post user-count milestones,
--   (3) keep test and sample data out of EVERY milestone count.
--
-- Everything rides the EXISTING pipeline — social_posts → cadence governor →
-- lib/social/flush.ts dispatch. No parallel posting path. Four deltas:
--
--   1. social_posts.source_type gains 'supplier_badge'. A badge post is composed
--      with a deterministic source_ref = '<vendor_profile_id>:<reward_key>'
--      (reward_key is the badge-and-step key `shop_badge_reward_grant` already
--      holds UNIQUE per shop), so the partial-unique index (source_type,
--      source_ref) makes it compose-ONCE per (supplier, badge).
--      The user-count milestone needs NO new source_type: it is one more metric
--      ('users_joined') on the existing 'milestone' type and the existing
--      social_milestones (metric, threshold) watermark.
--
--   2. social_publish_settings gains two per-TYPE switches, default ON, mirroring
--      recap_autopost_enabled (20270518711402): badge_autopost_enabled gates the
--      badge composer, milestone_autopost_enabled gates the milestone sweep. Data
--      only — the admin screen that flips them waits on an approved prototype.
--      Dispatch still obeys the master autopublish_enabled switch.
--
--   3. public.social_milestone_real_counts() — the four milestone numbers with
--      test and sample data LEFT OUT, in one round trip:
--        • a REAL EVENT is not `is_sample` and has no internal / team / admin
--          couple-member (the owner's own test events are not milestones);
--        • a REAL USER is not internal, not team, not admin, does not own a demo
--          shop, and is not a couple on a sample event;
--        • a REAL SUPPLIER is live (listed + verified — `isShopLive`), not
--          `is_demo`, and its owner is not internal;
--        • a REAL GUEST is a guest on a real event.
--      Before this the events and guests milestones counted every row,
--      sample and test events included.
--      SECURITY INVOKER: it reads with the caller's rights, and only service_role
--      may call it (the flush runs on the service-role client).
--
-- RLS: untouched. social_posts / social_publish_settings stay admin-only under
-- the policies from 20261204000000_social_autopublish.sql; this adds no table.
-- ============================================================================

BEGIN;

-- ── 1 · the new source_type ─────────────────────────────────────────────────
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_source_type_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_source_type_check
  CHECK (source_type IN
    ('couple_creation', 'vendor_feature', 'milestone',
     'announcement', 'evergreen', 'event_recap', 'supplier_badge'));

-- ── 2 · per-type switches (default ON) ──────────────────────────────────────
ALTER TABLE public.social_publish_settings
  ADD COLUMN IF NOT EXISTS badge_autopost_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.social_publish_settings
  ADD COLUMN IF NOT EXISTS milestone_autopost_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.social_publish_settings.badge_autopost_enabled IS
  'Lane S (2026-11-10). When TRUE (default), a supplier newly earning a badge composes ONE social_posts row (source_type=supplier_badge, source_ref=<vendor_profile_id>:<reward_key>). Live, non-demo, non-internal, not-opted-out shops only. Independent of the master autopublish_enabled switch, which still gates dispatch.';

COMMENT ON COLUMN public.social_publish_settings.milestone_autopost_enabled IS
  'Lane S (2026-11-10). When TRUE (default), the flush''s milestone sweep composes milestone posts (events_created · vendors_verified · guests_invited · users_joined), counted by social_milestone_real_counts() with test and sample data left out. Independent of the master autopublish_enabled switch, which still gates dispatch.';

-- ── 3 · the real counts ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.social_milestone_real_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH test_people AS (
    -- Setnayan's own accounts: internal, team, admin.
    SELECT u.user_id
      FROM public.users u
     WHERE u.is_internal IS TRUE
        OR u.is_team_member IS TRUE
        OR u.account_type = 'admin'
  ),
  real_events AS (
    SELECT e.event_id
      FROM public.events e
     WHERE e.is_sample IS FALSE
       AND NOT EXISTS (
             SELECT 1
               FROM public.event_members em
               JOIN test_people tp ON tp.user_id = em.user_id
              WHERE em.event_id = e.event_id
                AND em.member_type = 'couple'
           )
  )
  SELECT jsonb_build_object(
    'events_created',
      (SELECT count(*) FROM real_events),
    'vendors_verified',
      (SELECT count(*)
         FROM public.vendor_profiles vp
        WHERE vp.public_visibility = 'verified'
          AND vp.verification_state = 'verified'
          AND vp.is_demo IS FALSE
          AND NOT EXISTS (SELECT 1 FROM test_people tp WHERE tp.user_id = vp.user_id)),
    'guests_invited',
      (SELECT count(*)
         FROM public.guests g
         JOIN real_events re ON re.event_id = g.event_id),
    'users_joined',
      (SELECT count(*)
         FROM public.users u
        WHERE NOT EXISTS (SELECT 1 FROM test_people tp WHERE tp.user_id = u.user_id)
          AND NOT EXISTS (
                SELECT 1 FROM public.vendor_profiles vp
                 WHERE vp.user_id = u.user_id AND vp.is_demo IS TRUE)
          AND NOT EXISTS (
                SELECT 1
                  FROM public.event_members em
                  JOIN public.events e ON e.event_id = em.event_id
                 WHERE em.user_id = u.user_id
                   AND em.member_type = 'couple'
                   AND e.is_sample IS TRUE))
  );
$$;

COMMENT ON FUNCTION public.social_milestone_real_counts() IS
  'Lane S (2026-11-10). The social milestone numbers with test and sample data left out: events (not is_sample, no internal/team/admin couple), live non-demo suppliers whose owner is not internal, guests on real events, and real users (not internal/team/admin, no demo shop, not a sample-event couple). Aggregate counts only, never names. service_role only.';

REVOKE ALL ON FUNCTION public.social_milestone_real_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_milestone_real_counts() TO service_role;

COMMIT;
