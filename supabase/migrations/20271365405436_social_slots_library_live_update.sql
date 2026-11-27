-- ============================================================================
-- 20271365405436_social_slots_library_live_update.sql
--
-- The automatic posting engine (owner, 28 Nov 2026, specs DECISION_LOG
-- "FACEBOOK POSTING IS AUTOMATIC, IN THREE DAILY SLOTS" · "WHAT EACH FACEBOOK
-- SLOT CARRIES" · "THE FACEBOOK DAILY CAP COUNTS THE PLANNED POSTS TOO").
--
--   1. social_posts.source_type gains:
--        • 'library'     — a planned post from the library CSV, imported by
--                          apps/web/scripts/social/import-library.ts into a
--                          later migration. source_ref is a stable hash of its
--                          date + slot, so one planned post per slot, ever.
--        • 'live_update' — the 2 PM live composer's post
--                          (lib/social/live-update.server.ts), source_ref
--                          'live:<YYYY-MM-DD>', at most one a day.
--   2. social_posts.slot — which daily slot the row holds: morning (08:00),
--      afternoon (14:00), evening (20:00) or holiday (12:00, the extra).
--      NULL on rows from before this migration; the flush re-slots those.
--   3. social_posts.first_comment — the text posted as the first comment
--      right after the Facebook post goes out (the library's "Pinned first
--      comment"). The Graph API cannot pin a comment, so the flush records
--      "pin by hand" in platform_results.facebook.first_comment.
--   4. public.social_live_week_facts(p_from_day, p_to_day, p_since) — the
--      real news of one week for the 2 PM composer: events held in the window
--      and suppliers verified since p_since, with test and sample data left
--      out by the SAME rules as social_milestone_real_counts() (20271336072378):
--      no is_sample event, no event with an internal / team / admin couple,
--      no demo shop, no shop owned by one of Setnayan's own accounts, and no
--      shop that opted out of social features. service_role only.
--
-- Writers: the library import migration (controller) and the live composer
-- insert rows; the flush (lib/social/flush.ts) sets slot on every post it
-- schedules. Readers: the flush (dispatch, first comment, slot verdicts).
--
-- RLS: untouched. social_posts stays admin-only under the policies from
-- 20261204000000_social_autopublish.sql; this adds no table.
-- ============================================================================

BEGIN;

-- ── 1 · the new source types ───────────────────────────────────────────────
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_source_type_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_source_type_check
  CHECK (source_type IN
    ('couple_creation', 'vendor_feature', 'milestone',
     'announcement', 'evergreen', 'event_recap', 'supplier_badge',
     'library', 'live_update'));

-- ── 2 · the slot a row holds ───────────────────────────────────────────────
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS slot TEXT;

ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_slot_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_slot_check
  CHECK (slot IS NULL OR slot IN ('morning', 'afternoon', 'evening', 'holiday'));

COMMENT ON COLUMN public.social_posts.slot IS
  'Owner 2026-11-28: the daily slot this post holds — morning 08:00, afternoon 14:00, evening 20:00 Manila, or holiday 12:00 (an extra, only on planned holiday rows). One post per slot instant; the flush never publishes outside a slot (lib/social/governor.ts).';

-- ── 3 · the first comment ──────────────────────────────────────────────────
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS first_comment TEXT;

COMMENT ON COLUMN public.social_posts.first_comment IS
  'Owner 2026-11-28: posted as the first comment right after the Facebook post goes out (the library''s "Pinned first comment"). The Graph API has no pin call, so platform_results.facebook.first_comment records the comment and "pin by hand".';

-- ── 4 · one week of real news for the 2 PM composer ───────────────────────
CREATE OR REPLACE FUNCTION public.social_live_week_facts(
  p_from_day date,
  p_to_day date,
  p_since timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH test_people AS (
    -- Setnayan's own accounts: internal, team, admin (as in social_milestone_real_counts).
    SELECT u.user_id
      FROM public.users u
     WHERE u.is_internal IS TRUE
        OR u.is_team_member IS TRUE
        OR u.account_type = 'admin'
  ),
  events_held AS (
    SELECT e.event_id
      FROM public.events e
     WHERE e.is_sample IS FALSE
       AND e.event_date >= p_from_day
       AND e.event_date < p_to_day
       AND NOT EXISTS (
             SELECT 1
               FROM public.event_members em
               JOIN test_people tp ON tp.user_id = em.user_id
              WHERE em.event_id = e.event_id
                AND em.member_type = 'couple'
           )
  ),
  shops_verified AS (
    SELECT vp.vendor_profile_id, vp.business_name, vp.services, vp.hq_region,
           vp.location_city, vp.tier_state, vp.tier_expires_at, vp.last_verified_at
      FROM public.vendor_profiles vp
     WHERE vp.public_visibility = 'verified'
       AND vp.verification_state = 'verified'
       AND vp.is_demo IS FALSE
       AND vp.social_feature_opt_out IS FALSE
       AND vp.last_verified_at >= p_since
       AND NOT EXISTS (SELECT 1 FROM test_people tp WHERE tp.user_id = vp.user_id)
     ORDER BY vp.last_verified_at ASC
     LIMIT 10
  )
  SELECT jsonb_build_object(
    'events_held', (SELECT count(*) FROM events_held),
    'shops_verified', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'vendor_profile_id', s.vendor_profile_id,
                'business_name', s.business_name,
                'services', s.services,
                'hq_region', s.hq_region,
                'location_city', s.location_city,
                'tier_state', s.tier_state,
                'tier_expires_at', s.tier_expires_at)
              ORDER BY s.last_verified_at)
         FROM shops_verified s),
      '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.social_live_week_facts(date, date, timestamptz) IS
  'Owner 2026-11-28: the real news for the 2 PM live post — events held in [p_from_day, p_to_day) and up to 10 suppliers verified since p_since, with test and sample data left out by the rules of social_milestone_real_counts(). service_role only.';

REVOKE ALL ON FUNCTION public.social_live_week_facts(date, date, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_live_week_facts(date, date, timestamptz) TO service_role;

COMMIT;
