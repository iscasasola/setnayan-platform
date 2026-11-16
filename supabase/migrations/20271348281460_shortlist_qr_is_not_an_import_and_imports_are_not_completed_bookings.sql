-- ═══════════════════════════════════════════════════════════════════════════
-- THE SHORTLIST QR IS NOT AN IMPORT · AN IMPORTED CLIENT IS NOT A COMPLETED BOOKING
--
-- Two owner rulings of 2026-11-16 (specs DECISION_LOG), no UI:
--
-- 1 · d7f4b97f — "THE SHORTLIST QR STAYS FREE BUT IS NOT AN IMPORT — A BOOKING
--     FROM IT PAYS THE NORMAL BOOKING FEE." The app now writes
--     event_vendors.source = 'vendor_shortlist_qr' for it (it wrote 'vendor_invite',
--     an own client). `source` is free text, so no column changes; the fee rule
--     learns the value as a save on Setnayan, in BOTH functions that list the
--     save sources. Carried over from 20271267252894 (the only and latest
--     definition of each); the ONLY change is the third value in each save list.
--     Rows already written as 'vendor_invite' are left as they are — no data
--     is rewritten here.
--
-- 2 · fd5814dc (3) — "An imported client's booking does NOT count toward the
--     Completed bookings badge." The badge reads
--     vendor_public_completed_events_stats.public_completed_count
--     (lib/badge-rewards.ts `completedEvents`, lib/vendor-badges.ts
--     fetchCompletedBookingCounts). Rebuilt from 20271164950523 (its latest
--     definition) with ONE added predicate. Grants and the unique index are
--     restored exactly as that migration restores them (anon/authenticated
--     SELECT, service_role ALL). The supplier's own count,
--     vendor_full_completed_events_stats, is NOT changed — the ruling names the
--     badge.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the fee rule: a Shortlist QR row is a save on Setnayan ──────────────
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.chat_threads t
       WHERE t.event_id = p_event_id
         AND t.vendor_profile_id = p_vendor_profile_id
         AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    ) THEN 'sourced'
    WHEN EXISTS (
      SELECT 1
        FROM public.event_vendors ev
        LEFT JOIN public.event_manual_vendors emv
          ON emv.manual_vendor_id = ev.manual_vendor_id
       WHERE ev.event_id = p_event_id
         AND (ev.marketplace_vendor_id = p_vendor_profile_id
              OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
         AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
         AND (
           ev.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
           OR EXISTS (
             SELECT 1
               FROM public.event_vendors p
              WHERE p.event_id = p_event_id
                AND p.marketplace_vendor_id = p_vendor_profile_id
                AND p.vendor_id <> ev.vendor_id
                AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
                AND p.created_at < COALESCE(emv.created_at, ev.created_at)
           )
           OR EXISTS (
             SELECT 1
               FROM public.vendor_profile_views v
              WHERE v.event_id = p_event_id
                AND v.vendor_profile_id = p_vendor_profile_id
                AND v.viewed_at < COALESCE(emv.created_at, ev.created_at)
                AND public.booking_fee_is_sourced_surface(v.source)
           )
         )
    ) THEN 'sourced'
    ELSE 'import'
  END;
$$;

COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). SOURCED when a chat thread for the pair carries a marketplace-discovery '
  'inquiry_source, OR (owner 2026-10-12 answer 8; rule B 2026-10-10) a booking row tied to the shop - a marketplace '
  'row, or the couple''s hand-typed record claimed by or matched to it - that the supplier did not bring, and that is '
  'itself a save from Setnayan or comes after an earlier save of the shop or a profile view for this event. Fails SAFE '
  'to import. A Shortlist QR row (vendor_shortlist_qr) is a save on Setnayan, not an import (owner 2026-11-16, d7f4b97f). '
  'Mirrors bookingFeeAttributionFromFacts + SOURCED_INQUIRY_SOURCES + SETNAYAN_SAVE_SOURCES in apps/web/lib/booking-fee-gate.ts.';

-- CREATE OR REPLACE keeps the existing ACL; restated so this file alone shows who may call it.
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;

-- ── 1b · the bill's "introduced on" date reads the same save list ───────────
CREATE OR REPLACE FUNCTION public.booking_fee_introduced_on(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rec AS (
    SELECT emv.created_at AS rec_at
      FROM public.event_vendors ev
      JOIN public.event_manual_vendors emv
        ON emv.manual_vendor_id = ev.manual_vendor_id
     WHERE ev.event_id = p_event_id
       AND (ev.marketplace_vendor_id = p_vendor_profile_id
            OR emv.leak_match_vendor_profile_id = p_vendor_profile_id)
       AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
  ),
  facts AS (
    SELECT t.created_at AS at
      FROM public.chat_threads t
     WHERE t.event_id = p_event_id
       AND t.vendor_profile_id = p_vendor_profile_id
       AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    UNION ALL
    SELECT p.created_at
      FROM public.event_vendors p
     WHERE p.event_id = p_event_id
       AND p.marketplace_vendor_id = p_vendor_profile_id
       AND p.source IN ('host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr')
    UNION ALL
    SELECT v.viewed_at
      FROM public.vendor_profile_views v
     WHERE v.event_id = p_event_id
       AND v.vendor_profile_id = p_vendor_profile_id
       AND public.booking_fee_is_sourced_surface(v.source)
  )
  SELECT (min(f.at) AT TIME ZONE 'Asia/Manila')::date
    FROM facts f
   WHERE f.at < (SELECT max(r.rec_at) FROM rec r);
$$;

COMMENT ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) IS
  'The day Setnayan first showed this couple this shop, when their booking is the couple''s hand-typed record of it '
  '(owner 2026-10-12 answer 11: the supplier is told why on their bill only). NULL otherwise. Service role only.';

REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_introduced_on(UUID, UUID) TO service_role;

-- ── 2 · Completed bookings counts only clients Setnayan or the couple brought ─
DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
 SELECT vp.vendor_profile_id,
    count(ev.vendor_id)::integer AS public_completed_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND ev.voided_by_fraud = false
      -- ⬇ THE CHANGE (owner 2026-11-16, fd5814dc (3)): a client the SUPPLIER brought in — their invite, their
      --   booked one-use code, a reused booking — does not count toward Completed bookings. Same three values as
      --   SUPPLIER_BROUGHT_SOURCES (apps/web/lib/booking-fee-gate.ts) and booking_fee_attribution_for.
      AND COALESCE(ev.source, '') NOT IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept')
      -- ⬇ THE CHANGE. Slice 2 only ever orphans a booking that passed its own
      --   self-dealing test, so an orphan here is arm's-length by construction.
      AND (ev.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = ev.event_id))
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND (cg.order_id = ev.vendor_id OR EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id)))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats USING btree (vendor_profile_id);
REVOKE ALL ON public.vendor_public_completed_events_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_public_completed_events_stats TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_public_completed_events_stats IS
  'The public finished-jobs count behind the experience tier. Counts a booking '
  'whose event still exists OR that slice 2 preserved — and slice 2 only ever '
  'preserves an arm''s-length, really-booked, marketplace-linked row. A client the supplier brought in (vendor_invite · '
  'vendor_locked_qr · reuse_accept) is not counted (owner 2026-11-16, fd5814dc (3)).';
