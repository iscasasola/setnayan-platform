-- a_shop_counts_its_five_star_reviews
-- ============================================================================
-- THE FIVE-STAR COUNT (owner 2026-11-15, DECISION_LOG "SUPPLIER BADGES, SEALS AND
-- REWARDS": "New counters: five-star count on vendor_reviews (none exists;
-- first_five_star is measured:false)").
--
-- `shop_trusted_five_star_count(shop)` = the shop's 5-star reviews (rating_overall
-- = 5) counted by EXACTLY the rule the public stars use — the predicates of
-- `vendor_trusted_review_stats` (latest: 20271341273990_an_overdue_top_up_
-- unlists_the_event.sql), copied line for line: booked through Setnayan, not
-- voided for fraud, its event still there (or orphaned by the couple), no
-- overdue booking-fee top-up, and never a self-review (the shop's own owner or a
-- team member as the couple, an internal account tied to the shop, a self-comp).
-- A 5★ that does not count in the public stars never pays a badge reward.
--
-- Reads only. service_role only (the badge reader, admin client) — the same
-- grant shape as shop_booked_loop_count (20271327129110).
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── THE BADGE COUNTERS START ON 18 DECEMBER 2026 (owner 16 Nov, DECISION_LOG "THE COUNTERS RESET ON 18 DECEMBER
-- 2026 — TEST BILLS AND TEST BOOKINGS BEFORE THEN DO NOT COUNT") ── the ONE cut-off every badge count reads: a
-- booking, review or gift recorded before it is a test and never counts. Midnight in Manila. No row is deleted.
CREATE OR REPLACE FUNCTION public.badge_counts_start()
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT TIMESTAMPTZ '2026-12-18 00:00:00+08' $$;

COMMENT ON FUNCTION public.badge_counts_start() IS
  'The day the badge counters start (owner 16 Nov: "we will reset our counter on december 18"): 2026-12-18 00:00 '
  'Manila. Every badge count reads it; anything recorded before is a test and never counts. Nothing is deleted.';

CREATE OR REPLACE FUNCTION public.shop_trusted_five_star_count(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(vr.review_id)::INTEGER
    FROM public.vendor_profiles vp
    JOIN public.vendor_reviews vr
      ON vr.vendor_profile_id = vp.vendor_profile_id
     AND vr.rating_overall = 5
     AND vr.booked_through_setnayan = true
     AND vr.voided_by_fraud = false
     AND vr.created_at >= public.badge_counts_start()
     AND (vr.event_id IS NULL OR EXISTS (
           SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
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
   WHERE vp.vendor_profile_id = p_vendor_profile_id;
$$;

REVOKE ALL ON FUNCTION public.shop_trusted_five_star_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_trusted_five_star_count(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_trusted_five_star_count(UUID) IS
  'First 5★ badge counter (owner 2026-11-15): the shop''s 5-star reviews under the SAME predicates as '
  'vendor_trusted_review_stats (booked through Setnayan, not fraud, event present or orphaned, no overdue '
  'booking-fee top-up, never a self-review or self-comp). service_role only (badge reader, admin client).';

COMMIT;
