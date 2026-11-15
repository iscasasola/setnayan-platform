-- shop_seals_the_yearly_and_lifetime_seals
-- ============================================================================
-- THE SEALS (the badge build, J2 — the seals engine). Owner-approved prototypes
-- 15 Nov (DECISION_LOG 7d6c8129; contract prototypes/supplier_badges_2026-11-15/
-- badge-milestones_v86). The seals are: Setnayan Verified · Verified Partner ·
-- Most In-Demand · Top 10 Supplier · No. 1 Supplier of the Year · Clients' Choice.
-- They REPLACE the monthly Spotlight awards (4b8cc3a3); `vendor_spotlight_awards`
-- is left exactly as it is (its rows are history, nothing here reads or drops it).
--
-- ADDS ONLY. Nothing existing is changed or dropped.
--
--   1. `shop_seals` — one row per seal a shop was GIVEN.
--        · yearly seals (no1 · top10 · most_in_demand · clients_choice): once per
--          shop + seal + year — UNIQUE (vendor_profile_id, seal, award_year);
--        · No. 1 and Clients' Choice are one shop a year — partial UNIQUEs;
--        · Verified Partner is kept for life (3077c9b3) — once per shop, ever, a
--          partial UNIQUE; its award_year is the year it was earned.
--      Setnayan Verified is NOT a row here: it is the shop's own verification
--      (`vendor_profiles.verification_state` + its deadline, lib/verified-badge.ts),
--      read live; a stored copy would be a second source of truth for one fact.
--      `facts` freezes the numbers the plaque speaks with (6451: "filled per shop
--      by the server"), as they stood when the seal was given.
--      `plan_gift_state` — No. 1's prize (7fbff0cd (6)): the seal, its full screen
--      and ONE FREE YEAR of the shop's current supplier plan, given through the
--      existing Setnayan gift-to-shop flow (G3, #7674). No money path here: the
--      row only records the year as 'owed' until that flow gives it ('given').
--      RLS at create: the shop's own members read their rows; admins read and
--      write; nobody writes from a session — the engine writes with the service
--      role. The public page reads what it shows through the server (admin
--      client), never the `facts`.
--
--   2. `shop_seal_year_facts(from, to)` — per shop, for one SEAL YEAR (18 Dec →
--      17 Dec, 11d044c0): events completed through Setnayan, how many of those
--      were refunded, cancellations recorded against the shop, inquiries received,
--      and clients' second bookings. One read for the whole platform (the yearly
--      run), service_role only.
--
--   3. `shop_verified_partner_facts(shop)` — the Verified Partner counters
--      (3077c9b3 rules 2–6 and 9): completed-booking value minus refunds (11d044c0), bookings by how the couple found
--      the shop, Booking QR events, and recommending suppliers. service_role only.
--
-- A "real booking" here is EXACTLY shop_booked_loop_count's (20271327129110):
-- booked status, not archived, not voided_by_fraud, not a self-comp, and never
-- the shop's own owner or team as the couple — copied, not re-invented.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · shop_seals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_seals (
  seal_award_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  seal              TEXT NOT NULL
                    CHECK (seal IN ('no1', 'top10', 'most_in_demand', 'clients_choice', 'verified_partner')),
  award_year        INTEGER NOT NULL CHECK (award_year >= 2000),
  awarded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  awarded_by        TEXT NOT NULL DEFAULT 'auto' CHECK (awarded_by IN ('auto', 'admin')),
  facts             JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_gift_state   TEXT CHECK (plan_gift_state IN ('owed', 'given')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_seals_once_per_year UNIQUE (vendor_profile_id, seal, award_year),
  -- Only No. 1 carries the free plan year.
  CONSTRAINT shop_seals_plan_gift_is_no1s CHECK (plan_gift_state IS NULL OR seal = 'no1')
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_seals_partner_for_life
  ON public.shop_seals (vendor_profile_id) WHERE seal = 'verified_partner';
CREATE UNIQUE INDEX IF NOT EXISTS shop_seals_one_no1_a_year
  ON public.shop_seals (award_year) WHERE seal = 'no1';
-- Clients' Choice is ONE shop a year too ("the shop with the most second bookings", 11d044c0 (2)).
CREATE UNIQUE INDEX IF NOT EXISTS shop_seals_one_clients_choice_a_year
  ON public.shop_seals (award_year) WHERE seal = 'clients_choice';
CREATE INDEX IF NOT EXISTS shop_seals_year_idx
  ON public.shop_seals (award_year DESC, seal);

ALTER TABLE public.shop_seals ENABLE ROW LEVEL SECURITY;

-- Least reach: a stranger reads nothing; a signed-in session may only READ (and RLS narrows that to its own shop or an
-- admin). Every write is the engine's, on the service role.
REVOKE ALL ON public.shop_seals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.shop_seals FROM authenticated;

DROP POLICY IF EXISTS shop_seals_own_read ON public.shop_seals;
CREATE POLICY shop_seals_own_read ON public.shop_seals
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()) OR vendor_profile_id IN (SELECT public.current_vendor_ids()));

DROP POLICY IF EXISTS shop_seals_admin_write ON public.shop_seals;
CREATE POLICY shop_seals_admin_write ON public.shop_seals
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.shop_seals IS
  'Seals given to a shop (badge build J2, owner 15 Nov): yearly no1/top10/most_in_demand/clients_choice once per shop+seal+year; verified_partner once per shop for life (3077c9b3). Setnayan Verified is read live from vendor_profiles, never stored here. Written by the service role (lib/shop-seals.server.ts).';

-- ── 1b · an IMPORT never counts as a completed booking ──────────────────────
-- Owner, 16 Nov (DECISION_LOG fd5814dc (3)), applied by the controller to every badge, seal and Most Booked count:
-- a booking the supplier brought in themselves — QR import ('vendor_invite'), the Booking QR ('vendor_locked_qr', or
-- any booking a locked-QR token was claimed onto, since that claim keeps an earlier source), a reused booking
-- ('reuse_accept'), or an own-link arrival ('website', the ?src=own door) — is never a completed booking for a seal.
-- ONE definition, read by both counting functions below; lib/shop-seals.ts IMPORT_SOURCES mirrors the list (guarded).
CREATE OR REPLACE FUNCTION public.shop_booking_is_import(p_event_vendor_id UUID, p_source TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_source IN ('vendor_invite', 'vendor_locked_qr', 'reuse_accept', 'website'), false)
      OR EXISTS (SELECT 1 FROM public.vendor_locked_qr_tokens t WHERE t.claimed_event_vendor_id = p_event_vendor_id);
$$;

REVOKE ALL ON FUNCTION public.shop_booking_is_import(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_booking_is_import(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.shop_booking_is_import(UUID, TEXT) IS
  'Seals engine (J2): true when a booking was brought in by the supplier (QR import, Booking QR — by source or a claimed locked-QR token — reuse, or an own-link arrival). Imports never count as completed bookings for any badge or seal (owner 16 Nov, fd5814dc). service_role only.';

-- ── 2 · the yearly facts, one read for every shop ───────────────────────────
-- The seal year (owner, 11d044c0 (1)): 18 Dec last year → 17 Dec this year, given on 18 Dec; the first year runs
-- from launch. The caller passes the window: p_from (inclusive, NULL = from launch) and p_to (exclusive, the 18 Dec
-- the seals are given). Event dates are DATEs and compare directly; timestamps compare at Manila midnight.
CREATE OR REPLACE FUNCTION public.shop_seal_year_facts(p_from DATE, p_to DATE)
RETURNS TABLE (
  vendor_profile_id  UUID,
  completed_events   INTEGER,
  refunded_events    INTEGER,
  shop_cancellations INTEGER,
  inquiries          INTEGER,
  second_bookings    INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH win AS (
    SELECT p_from AS d0,
           p_to   AS d1,
           CASE WHEN p_from IS NULL THEN NULL ELSE (p_from::timestamp AT TIME ZONE 'Asia/Manila') END AS t0,
           (p_to::timestamp AT TIME ZONE 'Asia/Manila') AS t1
  ),
  real_booking AS (
    -- A real booking of a shop: shop_booked_loop_count's rule (booked status, not archived, not fraud, not a
    -- self-comp), with the event's date kept even after the couple deletes the event.
    SELECT COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id) AS vpid,
           ev.vendor_id,
           ev.event_id,
           ev.status,
           public.shop_booking_is_import(ev.vendor_id, ev.source) AS is_import,
           COALESCE(e.event_date, ev.event_date_at_delete) AS d
      FROM public.event_vendors ev
      LEFT JOIN public.events e ON e.event_id = ev.event_id
     WHERE COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id) IS NOT NULL
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud IS NOT TRUE
       AND NOT EXISTS (
         SELECT 1 FROM public.comp_grants cg
          WHERE cg.vendor_profile_id = COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id)
            AND cg.source = 'vendor_self_comp'
            AND (cg.order_id = ev.vendor_id
                 OR EXISTS (SELECT 1 FROM public.event_members em3
                             WHERE em3.event_id = ev.event_id
                               AND em3.member_type = 'couple'
                               AND em3.user_id = cg.created_by_user_id)))
  ),
  not_self AS (
    -- Never the shop's own owner or team as the couple.
    SELECT rb.*
      FROM real_booking rb
     WHERE NOT EXISTS (
       SELECT 1 FROM public.event_members em
        WHERE em.event_id = rb.event_id
          AND em.member_type = 'couple'
          AND (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = rb.vpid AND vp.user_id = em.user_id)
               OR EXISTS (SELECT 1 FROM public.vendor_team_members vtm WHERE vtm.vendor_profile_id = rb.vpid AND vtm.user_id = em.user_id)))
  ),
  done AS (
    -- Completed through Setnayan in the seal year: delivered/complete, on an event dated in the window.
    SELECT n.vpid, n.vendor_id, n.event_id
      FROM not_self n CROSS JOIN win
     WHERE n.status IN ('delivered', 'complete')
       AND NOT n.is_import
       AND n.d IS NOT NULL
       AND (win.d0 IS NULL OR n.d >= win.d0)
       AND n.d < win.d1
  ),
  completed AS (
    SELECT d.vpid,
           count(DISTINCT d.event_id)::INTEGER AS completed_events,
           count(DISTINCT d.event_id) FILTER (WHERE EXISTS (
             SELECT 1 FROM public.event_vendor_refunds r
              WHERE r.event_vendor_id = d.vendor_id AND r.removed_at IS NULL))::INTEGER AS refunded_events
      FROM done d
     GROUP BY d.vpid
  ),
  family_events AS (
    -- Each couple member's distinct booked events with the shop, ordered by event date (the Trusted by family rule).
    SELECT b.vpid, em.user_id, b.event_id, b.d,
           row_number() OVER (PARTITION BY b.vpid, em.user_id ORDER BY b.d NULLS LAST, b.event_id) AS nth
      FROM (SELECT DISTINCT vpid, event_id, d FROM real_booking WHERE NOT is_import) b
      JOIN public.event_members em
        ON em.event_id = b.event_id AND em.member_type = 'couple' AND em.user_id IS NOT NULL
     WHERE NOT EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = b.vpid AND vp.user_id = em.user_id)
       AND NOT EXISTS (SELECT 1 FROM public.vendor_team_members vtm WHERE vtm.vendor_profile_id = b.vpid AND vtm.user_id = em.user_id)
  ),
  seconds AS (
    -- Clients' Choice (6451 (2) · 11d044c0 (2)): a client's SECOND booking with the shop counts in the seal year its
    -- event falls in, even when the first was in an earlier year; a third or later never counts. Two partners of one
    -- wedding are one client (keyed by their first event, as shop_booked_loop_count does).
    SELECT f2.vpid, count(DISTINCT f1.event_id)::INTEGER AS n
      FROM family_events f2
      JOIN family_events f1 ON f1.vpid = f2.vpid AND f1.user_id = f2.user_id AND f1.nth = 1
      CROSS JOIN win
     WHERE f2.nth = 2
       AND f2.d IS NOT NULL
       AND (win.d0 IS NULL OR f2.d >= win.d0)
       AND f2.d < win.d1
     GROUP BY f2.vpid
  ),
  cancelled AS (
    -- The one place the platform RECORDS that the shop cancelled: a schedule-pool booking released with
    -- 'vendor_cancelled'. (A couple's force-majeure flag of type vendor_cancellation is a claim, not a record —
    -- it is not counted here; lib/shop-seals.ts names this as a partial source.)
    SELECT pb.vendor_profile_id AS vpid, count(*)::INTEGER AS n
      FROM public.vendor_schedule_pool_bookings pb CROSS JOIN win
     WHERE pb.release_reason = 'vendor_cancelled'
       AND (win.t0 IS NULL OR pb.released_at >= win.t0) AND pb.released_at < win.t1
     GROUP BY pb.vendor_profile_id
  ),
  asked AS (
    SELECT ct.vendor_profile_id AS vpid, count(*)::INTEGER AS n
      FROM public.chat_threads ct CROSS JOIN win
     WHERE ct.vendor_profile_id IS NOT NULL
       AND (win.t0 IS NULL OR ct.created_at >= win.t0) AND ct.created_at < win.t1
     GROUP BY ct.vendor_profile_id
  )
  SELECT vp.vendor_profile_id,
         COALESCE(c.completed_events, 0),
         COALESCE(c.refunded_events, 0),
         COALESCE(x.n, 0),
         COALESCE(a.n, 0),
         COALESCE(s2.n, 0)
    FROM public.vendor_profiles vp
    LEFT JOIN completed c ON c.vpid = vp.vendor_profile_id
    LEFT JOIN cancelled x ON x.vpid = vp.vendor_profile_id
    LEFT JOIN asked a     ON a.vpid = vp.vendor_profile_id
    LEFT JOIN seconds s2  ON s2.vpid = vp.vendor_profile_id
   WHERE vp.is_demo IS NOT TRUE
     AND (c.vpid IS NOT NULL OR x.vpid IS NOT NULL OR a.vpid IS NOT NULL OR s2.vpid IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.shop_seal_year_facts(DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_seal_year_facts(DATE, DATE) TO service_role;

COMMENT ON FUNCTION public.shop_seal_year_facts(DATE, DATE) IS
  'Seals engine (J2): per non-demo shop, for one seal year [p_from, p_to) (18 Dec → 17 Dec, p_from NULL = from launch) — events completed through Setnayan (real bookings, event dated in the window), how many carry an unremoved refund, schedule-pool releases recorded as vendor_cancelled, inquiries (chat threads opened), and second bookings (a client''s 2nd booked event with the shop dated in the window). service_role only.';

-- ── 3 · the Verified Partner counters, one shop ─────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_verified_partner_facts(p_vendor_profile_id UUID)
RETURNS TABLE (
  booked_total_php    NUMERIC,
  bookings_unpriced   INTEGER,
  find_bookings       INTEGER,
  website_bookings    INTEGER,
  qr_import_bookings  INTEGER,
  booking_qr_events   INTEGER,
  recommenders        INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH booked AS (
    SELECT ev.vendor_id, ev.event_id, ev.source, ev.status, ev.total_cost_php,
           public.shop_booking_is_import(ev.vendor_id, ev.source) AS is_import
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
       AND NOT EXISTS (
         SELECT 1 FROM public.event_members em
          WHERE em.event_id = ev.event_id
            AND em.member_type = 'couple'
            AND (EXISTS (SELECT 1 FROM public.vendor_profiles vp
                          WHERE vp.vendor_profile_id = p_vendor_profile_id AND vp.user_id = em.user_id)
                 OR EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                             WHERE vtm.vendor_profile_id = p_vendor_profile_id AND vtm.user_id = em.user_id)))
  )
  SELECT
    -- Rule 2 (11d044c0 (4)): the contract value of COMPLETED bookings, all years, minus refunded amounts. Cancelled
    -- bookings are already out (archived / never reached delivered·complete).
    -- Imports never count (fd5814dc): rules 3–6 still COUNT the channels below, but their bookings add no value here.
    (COALESCE((SELECT sum(b.total_cost_php) FROM booked b WHERE b.status IN ('delivered', 'complete') AND NOT b.is_import), 0)
     - COALESCE((SELECT sum(r.amount_php)
                   FROM booked b
                   JOIN public.event_vendor_refunds r ON r.event_vendor_id = b.vendor_id AND r.removed_at IS NULL
                  WHERE b.status IN ('delivered', 'complete') AND NOT b.is_import), 0))::NUMERIC,
    (SELECT count(*) FROM booked b WHERE b.status IN ('delivered', 'complete') AND NOT b.is_import AND b.total_cost_php IS NULL)::INTEGER,
    -- Suppliers › Find: the marketplace save, or an Explore/search inquiry copied onto the booking (RW-22).
    (SELECT count(*) FROM booked b WHERE b.source IN ('host_marketplace_search', 'explore', 'search'))::INTEGER,
    -- The shop's website: its own link / personal QR ('website') or its Setnayan page ('shop_page').
    (SELECT count(*) FROM booked b WHERE b.source IN ('website', 'shop_page'))::INTEGER,
    -- QR import: the shop's shortlist QR (importVendorToEventShortlist).
    (SELECT count(*) FROM booked b WHERE b.source = 'vendor_invite')::INTEGER,
    -- Booking QR: a claimed locked-QR token whose booking is a real booking of this shop — read from the token,
    -- not from `source` (the claim keeps an earlier source with COALESCE).
    (SELECT count(DISTINCT b.event_id)
       FROM booked b
       JOIN public.vendor_locked_qr_tokens t
         ON t.claimed_event_vendor_id = b.vendor_id AND t.vendor_profile_id = p_vendor_profile_id)::INTEGER,
    (SELECT count(DISTINCT vp.recommending_vendor_id)
       FROM public.vendor_partnerships vp
      WHERE vp.recommended_vendor_id = p_vendor_profile_id
        AND vp.recommending_vendor_id <> p_vendor_profile_id
        AND vp.status = 'accepted'
        AND vp.is_active = true)::INTEGER;
$$;

REVOKE ALL ON FUNCTION public.shop_verified_partner_facts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_verified_partner_facts(UUID) TO service_role;

COMMENT ON FUNCTION public.shop_verified_partner_facts(UUID) IS
  'Verified Partner (3077c9b3) counters for one shop over its real bookings: completed bookings'' total_cost_php minus unremoved refunds (11d044c0 (4)) and how many completed bookings carry no price, bookings found via Find (host_marketplace_search/explore/search), via its website (website/shop_page), via QR import (vendor_invite), events booked by Booking QR (claimed vendor_locked_qr_tokens), and distinct suppliers with an accepted, active partnership recommending it. service_role only.';

COMMIT;
