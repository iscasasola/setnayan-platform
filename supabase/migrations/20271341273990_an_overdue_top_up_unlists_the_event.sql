-- an_overdue_top_up_unlists_the_event
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 💸 "UNLISTED AND UNCOUNTED UNTIL THE TOP-UP IS SETTLED" — made true on the PUBLIC side (owner 2026-11-12, booking-fee
-- top-up prototype; recommendation 1 approved the same day). From the DAY AFTER an event, while that event's
-- booking-fee top-up (`amendment_delta`) is unsettled, the supplier's review FROM that event is not counted in their
-- public stars — the shop's headline (`vendor_trusted_review_stats`) and each service card's
-- (`vendor_service_trusted_review_stats`). Settled → counted again. The public review LIST, the shop page's photos
-- from that event and its featured story are filtered in the app (apps/web/lib/booking-fee-top-up.server.ts).
--
-- One predicate, `booking_fee_top_up_overdue(shop, event)`, decides it everywhere. Same switch as the event gate
-- (`platform_settings.fee_unlocks_event_enforced`): with the lock off, nothing is unlisted.
--
-- ⏱ A MATVIEW IS A SNAPSHOT. It is re-read when a review is written (the shipped `vendor_reviews_refresh_stats`
-- trigger), when a top-up's status changes (the new trigger below — settling counts the review again at once), and
-- once a day by the app's request-driven periodic job (`booking_fee_top_up_unlist`), which is what catches the day a
-- held top-up becomes overdue — no event in the database marks that moment.
--
-- The matview is copied from 20271164950523 (its latest definition) with ONE added line marked ⟵ TOP-UP, and its
-- index, grants and comment restored exactly; the card view from 20271316933967 with the SAME line (the two filters
-- are held word for word by apps/web/lib/card-review-stats-mirror-the-shop.test.ts).

BEGIN;

-- ── 1 · The one predicate ───────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_overdue(p_vendor_profile_id UUID, p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_vendor_profile_id IS NOT NULL
     AND p_event_id IS NOT NULL
     AND COALESCE((SELECT ps.fee_unlocks_event_enforced FROM public.platform_settings ps WHERE ps.id = 1), FALSE)
     AND EXISTS (
           SELECT 1 FROM public.booking_fee_charges c
            WHERE c.vendor_profile_id = p_vendor_profile_id
              AND c.event_id = p_event_id
              AND c.kind = 'amendment_delta'
              AND c.status IN ('pending', 'failed')
              AND NOT public.booking_fee_top_up_is_held(c.kind, c.status, c.expires_at));
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_overdue(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_top_up_overdue(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.booking_fee_top_up_overdue(UUID, UUID) IS
  'Owner 2026-11-12 (BOOKING-FEE TOP-UP): TRUE while this shop''s top-up on this event is past its event day and unsettled (and the fee lock is switched on). Unlists that event''s review from the public stars. TS twin: readOverdueTopUpEventIds in apps/web/lib/booking-fee-top-up.server.ts. Migration 20271341273990.';

-- ── 2 · The shop's headline stars ──────────────────────────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
 SELECT vp.vendor_profile_id,
    COALESCE(avg(vr.rating_overall)::numeric(3,2), 0::numeric) AS trusted_avg_rating,
    count(vr.review_id)::integer AS trusted_review_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      AND vr.booked_through_setnayan = true
      AND vr.voided_by_fraud = false
      AND (vr.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
      -- ⟵ TOP-UP (owner 2026-11-12): a review from an event whose booking-fee top-up is OVERDUE is uncounted until settled.
      AND NOT public.booking_fee_top_up_overdue(vr.vendor_profile_id, vr.event_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = vr.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats USING btree (vendor_profile_id);

REVOKE ALL ON public.vendor_trusted_review_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_trusted_review_stats TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_trusted_review_stats IS
  'THE public headline rating. Counts a review whose event still exists OR that '
  'was orphaned by the couple deleting their celebration (slice 1). Orphans are '
  'arm''s-length by construction: keep_only_arms_length_reviews_on_event_delete() '
  'destroys a self-dealt review before the FK can orphan it. Since 20271341273990 '
  'a review from an event whose booking-fee top-up is overdue is uncounted until settled.';

-- ── 3 · Each service card's stars ──────────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.vendor_service_trusted_review_stats;
CREATE VIEW public.vendor_service_trusted_review_stats AS
SELECT vr.vendor_profile_id,
       vr.service_id,
       COALESCE(avg(vr.rating_overall)::numeric(3,2), 0::numeric) AS trusted_avg_rating,
       count(vr.review_id)::integer AS trusted_review_count
  FROM public.vendor_profiles vp
  JOIN public.vendor_reviews vr
    ON vr.vendor_profile_id = vp.vendor_profile_id
   AND vr.service_id IS NOT NULL
      AND vr.booked_through_setnayan = true
      AND vr.voided_by_fraud = false
      AND (vr.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
      -- ⟵ TOP-UP (owner 2026-11-12): a review from an event whose booking-fee top-up is OVERDUE is uncounted until settled.
      AND NOT public.booking_fee_top_up_overdue(vr.vendor_profile_id, vr.event_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = vr.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id))
 GROUP BY vr.vendor_profile_id, vr.service_id;

REVOKE ALL ON public.vendor_service_trusted_review_stats FROM PUBLIC;
REVOKE ALL ON public.vendor_service_trusted_review_stats FROM anon, authenticated;
GRANT SELECT ON public.vendor_service_trusted_review_stats TO service_role;

COMMENT ON VIEW public.vendor_service_trusted_review_stats IS
  'The hosts'' trusted average and count PER SERVICE CARD — the card''s own review line (prototype 6 Nov § 4). Same arm''s-length filter as vendor_trusted_review_stats (held by card-review-stats-mirror-the-shop.test.ts), including the overdue-top-up line (20271341273990). Server-only.';

-- ── 4 · Re-read the stars now (callable — the shipped refresh_vendor_review_stats() is a TRIGGER function) ──────────
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_refresh_stars()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_trusted_review_stats;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'booking_fee_top_up_refresh_stars: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_refresh_stars() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_top_up_refresh_stars() TO service_role;

-- ── 5 · Settling (or voiding) a top-up re-reads the stars at once ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_fee_top_up_status_refreshes_stars()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind = 'amendment_delta' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.booking_fee_top_up_refresh_stars();
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_fee_top_up_status_refreshes_stars() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_fee_top_up_status_refreshes_stars ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_top_up_status_refreshes_stars
  AFTER UPDATE OF status ON public.booking_fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_top_up_status_refreshes_stars();

REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats;

COMMIT;
