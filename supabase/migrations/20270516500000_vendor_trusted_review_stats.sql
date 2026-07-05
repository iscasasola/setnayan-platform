-- ============================================================================
-- 20270516500000_vendor_trusted_review_stats.sql
-- Anti-fraud — "Couple Trusted" badge provenance gate (Phase 1).
--
-- Closes a fake-review hole in the `couple_trusted` vendor badge. Before this
-- migration the badge read `review_count` + `avg_rating_overall` off
-- `vendor_review_stats`, which counts EVERY review with NO provenance filter.
-- A crooked vendor could stand up sockpuppet couple accounts + self-created
-- "delivered" events, write fake 5★ reviews, and earn the trust badge.
--
-- The fix: a NEW materialized view `vendor_trusted_review_stats` that counts
-- ONLY receipt-backed, arm's-length reviews — i.e. reviews the platform can
-- vouch for. The trust predicate is:
--   • `vr.booked_through_setnayan = TRUE` — the review is receipt-backed
--     (platform-derived provenance flag from 20270321252758), AND
--   • the SAME self-dealing / arm's-length exclusions that
--     `vendor_public_completed_events_stats` applies in
--     20260515020000_public_stats_exclusion.sql, but keyed off the review's
--     `vr.event_id` instead of the booking's event. The exclusion subqueries
--     are replicated VERBATIM so the two stats stay consistent:
--       – archived events,
--       – the vendor OWNER on the event via event_members,
--       – any vendor TEAM member on the event,
--       – internal accounts tied to this vendor (owner or team) on the event,
--       – rows flagged by an active vendor_self_comp grant.
--
-- Shape mirrors `vendor_review_stats` (20260514100000): LEFT JOIN so every
-- vendor gets a row (0 when no trusted reviews), COALESCE avg → 0.
--
-- Refresh: the existing `refresh_vendor_review_stats` trigger function is
-- extended to refresh BOTH matviews CONCURRENTLY on vendor_reviews
-- INSERT/UPDATE/DELETE (idempotent CREATE OR REPLACE — the trigger itself is
-- unchanged and keeps pointing at the same function).
--
-- Idempotent. Applied by the `supabase-migrations` CI job on merge — do NOT
-- run db push by hand.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_trusted_review_stats — MATERIALIZED VIEW
--
--    One row per vendor_profile (LEFT JOIN → 0 when no trusted reviews).
--    A review counts toward the trusted stat only when it is receipt-backed
--    (booked_through_setnayan) AND passes the arm's-length exclusion set
--    replicated from vendor_public_completed_events_stats, keyed off
--    vr.event_id.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
SELECT
  vp.vendor_profile_id,
  COALESCE(AVG(vr.rating_overall)::NUMERIC(3,2), 0) AS trusted_avg_rating,
  COUNT(vr.review_id)::INT AS trusted_review_count
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      -- Receipt-backed: only reviews from a couple who actually booked this
      -- vendor through Setnayan (platform-derived flag; couples can't set it).
      AND vr.booked_through_setnayan = TRUE
      -- Exclude archived events from the count.
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = vr.event_id
          AND e.archived = FALSE
      )
      AND NOT EXISTS (
        -- Exclude reviews on events where the vendor's owner is on the
        -- event's couple roster.
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        -- Exclude reviews on events where any vendor team member sits on the
        -- event's couple roster.
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
        -- Exclude reviews on events where any internal account that owns or
        -- sits on this vendor's team is on the event's couple roster.
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
          AND u.is_internal = TRUE
          AND (
            u.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm2
              WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                AND vtm2.user_id = u.user_id
            )
          )
      )
      AND NOT EXISTS (
        -- Exclude reviews flagged by an active vendor_self_comp grant.
        -- The full self-comp table ships separately; until then this
        -- predicate is a stable no-op (no rows match) which is the
        -- correct conservative behaviour.
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            -- Either the grant references the review's event directly via a
            -- couple-member who created the grant ...
            EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = vr.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats(vendor_profile_id);

-- ----------------------------------------------------------------------------
-- 2. Refresh path — extend refresh_vendor_review_stats to refresh BOTH
--    matviews. The trigger `vendor_reviews_refresh_stats`
--    (20260514100000) already fires this function AFTER INSERT/UPDATE/DELETE
--    on vendor_reviews and stays pointed at the same function name, so
--    CREATE OR REPLACE is enough — no trigger re-wire needed. Kept idempotent
--    and fail-soft (a failing refresh never rolls back the review write).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_vendor_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_review_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- A failing refresh must not roll back the underlying review write.
  RAISE WARNING 'refresh_vendor_review_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Initial seed so the unique index has rows immediately and the first
-- application read returns 0-count rows rather than NULL.
REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats;

-- Public read — same grant pattern as vendor_review_stats /
-- vendor_public_completed_events_stats. Aggregate counts only, no PII.
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;

COMMIT;
