-- award_flow_gift_points_and_auto_claim
-- ============================================================================
-- THE BADGE BUILD · J0 — server side (owner-approved prototypes 15 Nov; DECISION_LOG
-- 2026-11-15 e5ec685d "THE WHOLE BADGE + SEAL FLOW", the gift-points rows, 3cbf12c1,
-- bc148e4e). ADDS ONLY — nothing existing is changed or dropped.
--
--   1. `gift_points_for_price(price)` — a gift's points: its REGULAR price rounded off
--      to a round figure (one significant figure), then one point per ₱10. Reproduces
--      every ruled value: ₱99 → 10 · ₱499 → 50 · ₱999 → 100 · ₱2,990 → 300 ·
--      ₱5,690 → 600 · ₱9,990 → 1,000. NULL for a price that is missing or ≤ 0 — never a
--      guessed number. Mirrored by lib/gift-points.ts (the db test holds them equal).
--   2. `shop_gift_points(shop)` — the Gifts given badge's counter: points for every gift
--      the shop GAVE (a 'given' stock row) on an event whose booking with that shop is
--      COMPLETE (delivered / complete — the Completed bookings test), prices read from
--      `platform_retail_catalog_v2` only:
--        · Event Plus / Pro / Ultra: one 'given' row per unit, priced by the kind the
--          shop gave (a second Plus that became Pro still counts as the Plus it was);
--        · Papic: each pack line of a quote whose Papic gift was given, priced by the
--          line's catalogue code.
--      service_role only (the badge reader uses the admin client).
--   3. `shop_award_flow_progress` — where a shop is in an award flow (badge full screen →
--      gift → "You unlocked" → … → Done), so "Later" resumes at the exact step and the
--      Today line can turn from News to To do (pick 8). One row per (shop, flow). RLS at
--      create: the shop's own members read it; nobody writes it from a session — the
--      route writes after its own-shop gate (POST /api/vendor/badges).
--   4. `shop_badge_rewards_auto_claim(shop)` — a badge or seal reward is CLAIMED
--      AUTOMATICALLY (pick 2): every reward of the shop gets its claim through the SAME
--      once-only key (`gift_moment_claims_once`, source 'badge_reward'), so it can never
--      count twice. Grants nothing (the reward already landed); only ends the waiting
--      line. service_role only.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · points for one price ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.gift_points_for_price(p_price NUMERIC)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_price IS NULL OR p_price <= 0 THEN NULL
           ELSE (round(p_price / power(10::numeric, floor(log(p_price))))
                 * power(10::numeric, floor(log(p_price))) / 10)::INTEGER
         END;
$$;

COMMENT ON FUNCTION public.gift_points_for_price(NUMERIC) IS
  'Gift points for one gift: its regular price rounded off to one significant figure, then one point per ₱10 '
  '(owner 15 Nov: ₱99→10 · ₱499→50 · ₱999→100 · ₱2,990→300 · ₱5,690→600 · ₱9,990→1,000). NULL when no price.';

-- ── 2 · the Gifts given counter ─────────────────────────────────────────────
-- Counted per QUOTE LINE (every kind: Papic packs and Event Plus / Pro / Ultra), on a quote whose gifts of that
-- kind were GIVEN (a 'given' stock entry) on an event whose booking with the shop is delivered/complete.
-- ⛔ A line paid from BADGE-REWARD stock (`from_badge_reward`) never counts (owner 16 Nov, controller's
-- "owner-approved badge rules" 1): a reward paying for a gift that earns the next reward is a loop.
-- ✅ Imported / own-client events DO count (owner 16 Nov rule 3: their Setnayan gift was paid for by the supplier).
CREATE OR REPLACE FUNCTION public.shop_gift_points(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH done_events AS (
    SELECT DISTINCT ev.event_id
      FROM public.event_vendors ev
     WHERE (ev.linked_vendor_profile_id = p_vendor_profile_id
            OR ev.marketplace_vendor_id = p_vendor_profile_id)
       AND ev.status IN ('delivered', 'complete')
       AND ev.voided_by_fraud IS NOT TRUE
       AND ev.event_id IS NOT NULL
       AND ev.created_at >= public.badge_counts_start()
  )
  SELECT COALESCE(SUM(public.gift_points_for_price(c.retail_price_php)), 0)::INTEGER
    FROM public.vendor_proposal_shop_gifts l
    JOIN public.platform_retail_catalog_v2 c ON c.service_code = l.service_code
   WHERE l.vendor_profile_id = p_vendor_profile_id
     AND l.from_badge_reward IS NOT TRUE
     AND EXISTS (
       SELECT 1
         FROM public.shop_gift_stock_entries e
        WHERE e.vendor_profile_id = p_vendor_profile_id
          AND e.kind = 'given'
          AND e.created_at >= public.badge_counts_start()
          AND e.proposal_id = l.proposal_id
          AND e.gift_kind = l.gift_kind
          AND e.event_id IN (SELECT d.event_id FROM done_events d)
     );
$$;

REVOKE ALL ON FUNCTION public.shop_gift_points(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_points(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_gift_points(UUID) IS
  'Gifts given badge counter (owner 15 Nov): gift points for every quote-line gift this shop gave on an event whose '
  'booking with it is delivered/complete — one point per ₱10 of the gift''s regular price, rounded off '
  '(gift_points_for_price), prices from platform_retail_catalog_v2 only. A line paid from badge-reward stock '
  '(from_badge_reward) never counts (owner 16 Nov). Imported clients'' events count. service_role only.';

-- ── 2b · imports never count toward a booking badge (owner 16 Nov, controller's rule 2 / DECISION_LOG fd5814dc) ──
-- An import is a booking the supplier brought: event_vendors.source vendor_invite · vendor_locked_qr · reuse_accept,
-- or the couple's chat with the shop arrived through the supplier's OWN link (`?src=own` → inquiry_source 'website',
-- lib/supplier-qr-codes.ts arrivalInquirySourceOf), or the source says 'website', or a Booking QR token of this shop
-- was claimed onto the booking (the claim keeps the booking's earlier source, so `source` alone misses it).
-- Not booking_fee_attribution_for: that fails SAFE to 'import' for the fee, which would drop real bookings from a badge.
-- ONE definition for every badge AND seal (the seals engine, PR #7825, calls this — it must never redefine it);
-- lib/shop-seals.ts IMPORT_SOURCES mirrors the source list below and a test holds them equal.
CREATE OR REPLACE FUNCTION public.shop_booking_is_import(
  p_vendor_profile_id UUID,
  p_event_id UUID,
  p_source TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'website'), false)
      OR EXISTS (
           SELECT 1 FROM public.vendor_locked_qr_tokens q
             JOIN public.event_vendors ev ON ev.vendor_id = q.claimed_event_vendor_id
            WHERE q.vendor_profile_id = p_vendor_profile_id
              AND ev.event_id = p_event_id
         )
      OR EXISTS (
           SELECT 1 FROM public.chat_threads t
            WHERE t.event_id = p_event_id
              AND t.vendor_profile_id = p_vendor_profile_id
              AND t.inquiry_source = 'website'
         );
$$;

REVOKE ALL ON FUNCTION public.shop_booking_is_import(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_booking_is_import(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.shop_booking_is_import(UUID, UUID, TEXT) IS
  'TRUE when a shop''s booking on an event is an IMPORT (owner 16 Nov: imports never count toward Completed bookings — '
  'DECISION_LOG fd5814dc; Trusted by counts them, as no 16 Nov row rules them out): source vendor_invite / vendor_locked_qr / reuse_accept / website, a Booking QR '
  'token of this shop claimed onto the booking, or the couple''s chat with the shop arrived through the shop''s own '
  'link (inquiry_source ''website''). The one definition for every badge and seal. service_role only.';

-- ── 2c · Completed bookings, for the badge: the public completed-events rules, minus imports ──
-- `vendor_public_completed_events_stats` (the shop page's public number) is untouched; this is the badge's own count.
CREATE OR REPLACE FUNCTION public.shop_completed_bookings_count(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(ev.vendor_id)::INTEGER
    FROM public.vendor_profiles vp
    JOIN public.event_vendors ev ON ev.linked_vendor_profile_id = vp.vendor_profile_id
   WHERE vp.vendor_profile_id = p_vendor_profile_id
     AND ev.status IN ('delivered', 'complete')
     AND ev.voided_by_fraud IS NOT TRUE
     AND ev.created_at >= public.badge_counts_start()
     AND (ev.event_id IS NULL OR EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = ev.event_id))
     AND NOT public.shop_booking_is_import(vp.vendor_profile_id, ev.event_id, ev.source)
     AND NOT EXISTS (
           SELECT 1 FROM public.event_members em
            WHERE em.event_id = ev.event_id AND em.member_type = 'couple' AND em.user_id = vp.user_id)
     AND NOT EXISTS (
           SELECT 1 FROM public.event_members em
             JOIN public.vendor_team_members vtm
               ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
            WHERE em.event_id = ev.event_id AND em.member_type = 'couple')
     AND NOT EXISTS (
           SELECT 1 FROM public.comp_grants cg
            WHERE cg.vendor_profile_id = vp.vendor_profile_id
              AND cg.source = 'vendor_self_comp'
              AND (cg.order_id = ev.vendor_id OR EXISTS (
                    SELECT 1 FROM public.event_members em3
                     WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'
                       AND em3.user_id = cg.created_by_user_id)));
$$;

REVOKE ALL ON FUNCTION public.shop_completed_bookings_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_completed_bookings_count(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_completed_bookings_count(UUID) IS
  'Completed bookings badge counter (owner 15/16 Nov): the shop''s delivered/complete bookings under the public '
  'completed-events rules (no fraud, no self-dealing, no self-comp), WITHOUT imports (shop_booking_is_import). '
  'service_role only.';

-- ── 2d · Trusted by, for the badge: clients who booked the shop a second time, counted from 18 Dec 2026 ──
-- `shop_booked_loop_count` (C2, shared) is untouched; this is its body with the badge cut-off. Imports COUNT here:
-- the 16 Nov rows rule imports out of Completed bookings only (controller's audit of 923f981994).
CREATE OR REPLACE FUNCTION public.shop_trusted_by_count(p_vendor_profile_id UUID)
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
       AND ev.created_at >= public.badge_counts_start()
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
    -- One per FAMILY: two partners of one couple share their first event, so it counts once.
    SELECT p.user_id,
           (array_agg(p.event_id ORDER BY p.event_date NULLS LAST, p.event_id))[1] AS first_event_id
      FROM people p
     GROUP BY p.user_id
    HAVING count(DISTINCT p.event_id) >= 2
  )
  SELECT count(DISTINCT r.first_event_id)::INTEGER FROM repeaters r;
$$;

REVOKE ALL ON FUNCTION public.shop_trusted_by_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_trusted_by_count(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_trusted_by_count(UUID) IS
  'Trusted by badge counter (owner 15 Nov 50566f42): clients who booked the shop on a second event, each counted '
  'once, imports included, bookings from badge_counts_start() (18 Dec 2026). shop_booked_loop_count is untouched. '
  'service_role only.';

-- ── 3 · where a shop is in an award flow ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_award_flow_progress (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The flow: a reward key ('completed_bookings:tier2') or a seal's key.
  flow_key          TEXT NOT NULL
                      CONSTRAINT shop_award_flow_progress_key_shape
                      CHECK (length(btrim(flow_key)) > 0 AND length(flow_key) <= 120),
  -- The exact screen the shop left on (0 = not opened yet).
  step              INTEGER NOT NULL
                      CONSTRAINT shop_award_flow_progress_step_range
                      CHECK (step >= 0 AND step <= 200),
  total_steps       INTEGER
                      CONSTRAINT shop_award_flow_progress_total_range
                      CHECK (total_steps IS NULL OR (total_steps BETWEEN 1 AND 200 AND step <= total_steps)),
  opened_at         TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, flow_key)
);

COMMENT ON TABLE public.shop_award_flow_progress IS
  'Where a shop is in an award flow (owner 15 Nov, e5ec685d pick 8): the exact step it left on, so Later resumes '
  'there and the Today line reads News until opened, To do when left mid-flow. Written only by the route '
  '(POST /api/vendor/badges) after its own-shop gate; the shop reads its own.';

ALTER TABLE public.shop_award_flow_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_award_flow_progress_read ON public.shop_award_flow_progress;
CREATE POLICY shop_award_flow_progress_read
  ON public.shop_award_flow_progress
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_award_flow_progress FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_award_flow_progress FROM authenticated;
GRANT SELECT ON TABLE public.shop_award_flow_progress TO authenticated;

-- ── 4 · a badge reward is claimed automatically ─────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_badge_rewards_auto_claim(p_vendor_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  IF p_vendor_profile_id IS NULL THEN
    RETURN 0;
  END IF;
  INSERT INTO public.gift_moment_claims (source, ref_id, vendor_profile_id, claimed_by)
  SELECT 'badge_reward', r.reward_id, r.vendor_profile_id, NULL
    FROM public.shop_badge_rewards r
   WHERE r.vendor_profile_id = p_vendor_profile_id
     AND r.revoked_at IS NULL
  ON CONFLICT (source, ref_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.shop_badge_rewards_auto_claim(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_badge_rewards_auto_claim(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_badge_rewards_auto_claim(UUID) IS
  'A badge or seal reward is claimed automatically (owner 15 Nov, e5ec685d pick 2): every unrevoked reward of the '
  'shop gets its gift_moment_claims row through the same once-only key, so it never counts twice. Grants nothing. '
  'service_role only; run by the grant sweep.';

COMMIT;
