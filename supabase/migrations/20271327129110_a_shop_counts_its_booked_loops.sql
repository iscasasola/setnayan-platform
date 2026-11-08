-- a_shop_counts_its_booked_loops
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT.
-- ════════════════════════════════════════════════════════════════════════════
-- A SHOP COUNTS ITS BOOKED LOOPS — THE ONE BUILD, lane C2 (spec
-- plans/supplier_one_build_2026-11-08 §9 #11: "Booked Loop needs a counter:
-- C2 adds a read (shop_booked_loop_count(vendor) = distinct couples who booked
-- this shop on a 2nd event) in -data; C4 flips measured:true only when it
-- reads it. Without the counter the badge is HIDDEN").
-- Corpus definition (spec §4): Booked Loop = the same family books the shop
-- again.
--
-- WHAT COUNTS, exactly:
--   · A BOOKING of this shop = an event_vendors row linked to it
--     (marketplace_vendor_id — the booking-fee / badge-reward attribution —
--     or linked_vendor_profile_id — the completed-events attribution), in a
--     booked status ('contracted','deposit_paid','delivered','complete', the
--     same list every booking-fee function carries), not archived (a
--     cancelled booking is not a booking), not voided_by_fraud.
--   · A COUPLE = an event_members row with member_type = 'couple' on that
--     event — never the shop's own owner or a member of its team (the
--     self-booking exclusion vendor_completed_events already applies), and
--     never an event the shop comped to itself (comp_grants vendor_self_comp).
--   · A LOOP = a couple member who appears on TWO OR MORE distinct booked
--     events of this shop. Two partners of one wedding are ONE family, not
--     two: each repeating person is keyed by their FIRST booked event with
--     this shop, and the count is the number of distinct first events among
--     repeating people. (A family is identified by where it first met the
--     shop; partners share that event.)
--
-- service_role only: it is a badge fact, read by the server badge reader
-- with the admin client (readShopBadgeFacts / readBadgeRewardFacts take
-- createAdminClient()). No signed-in caller counts another shop's couples.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.shop_booked_loop_count(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH booked AS (
    SELECT DISTINCT ev.event_id
      FROM public.event_vendors ev
     WHERE (ev.marketplace_vendor_id = p_vendor_profile_id
            OR ev.linked_vendor_profile_id = p_vendor_profile_id)
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud IS NOT TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.comp_grants cg
          WHERE cg.vendor_profile_id = p_vendor_profile_id
            AND cg.source = 'vendor_self_comp'
            AND (cg.order_id = ev.vendor_id
                 OR EXISTS (SELECT 1 FROM public.event_members em3
                             WHERE em3.event_id = ev.event_id
                               AND em3.member_type = 'couple'
                               AND em3.user_id = cg.created_by_user_id)))
  ),
  people AS (
    SELECT em.user_id, b.event_id, e.event_date
      FROM booked b
      JOIN public.event_members em
        ON em.event_id = b.event_id AND em.member_type = 'couple' AND em.user_id IS NOT NULL
      LEFT JOIN public.events e ON e.event_id = b.event_id
     WHERE NOT EXISTS (SELECT 1 FROM public.vendor_profiles vp
                        WHERE vp.vendor_profile_id = p_vendor_profile_id
                          AND vp.user_id = em.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                        WHERE vtm.vendor_profile_id = p_vendor_profile_id
                          AND vtm.user_id = em.user_id)
  ),
  repeaters AS (
    SELECT p.user_id,
           (array_agg(p.event_id ORDER BY p.event_date NULLS LAST, p.event_id))[1] AS first_event_id
      FROM people p
     GROUP BY p.user_id
    HAVING count(DISTINCT p.event_id) >= 2
  )
  SELECT count(DISTINCT r.first_event_id)::INTEGER FROM repeaters r;
$$;

REVOKE ALL ON FUNCTION public.shop_booked_loop_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_booked_loop_count(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_booked_loop_count(UUID) IS
  'Booked Loop badge counter: how many families (couple members, keyed by their first booked event with this shop) booked this shop on 2+ distinct events. Booked = contracted/deposit_paid/delivered/complete, not archived, not voided_by_fraud, not a self-booking or self-comp. service_role only (badge reader, admin client).';

COMMIT;
