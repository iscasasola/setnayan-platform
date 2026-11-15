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
--        · No. 1 is one shop a year (v86: "One shop a year") — a partial UNIQUE;
--        · Verified Partner is kept for life (3077c9b3) — once per shop, ever, a
--          partial UNIQUE; its award_year is the year it was earned.
--      Setnayan Verified is NOT a row here: it is the shop's own verification
--      (`vendor_profiles.verification_state` + its deadline, lib/verified-badge.ts),
--      read live; a stored copy would be a second source of truth for one fact.
--      `facts` freezes the numbers the plaque speaks with (6451: "filled per shop
--      by the server"), as they stood when the seal was given.
--      RLS at create: the shop's own members read their rows; admins read and
--      write; nobody writes from a session — the engine writes with the service
--      role. The public page reads what it shows through the server (admin
--      client), never the `facts`.
--
--   2. `shop_seal_year_facts(year)` — per shop, for one calendar year: events
--      completed through Setnayan, how many of those were refunded, cancellations
--      recorded against the shop, and inquiries received. One read for the whole
--      platform (the yearly run), service_role only.
--
--   3. `shop_verified_partner_facts(shop)` — the Verified Partner counters
--      (3077c9b3 rules 2–6 and 9): booking total, bookings by how the couple found
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
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_seals_once_per_year UNIQUE (vendor_profile_id, seal, award_year)
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_seals_partner_for_life
  ON public.shop_seals (vendor_profile_id) WHERE seal = 'verified_partner';
CREATE UNIQUE INDEX IF NOT EXISTS shop_seals_one_no1_a_year
  ON public.shop_seals (award_year) WHERE seal = 'no1';
CREATE INDEX IF NOT EXISTS shop_seals_year_idx
  ON public.shop_seals (award_year DESC, seal);

ALTER TABLE public.shop_seals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_seals_own_read ON public.shop_seals;
CREATE POLICY shop_seals_own_read ON public.shop_seals
  FOR SELECT
  USING ((SELECT public.is_admin()) OR vendor_profile_id IN (SELECT public.current_vendor_ids()));

DROP POLICY IF EXISTS shop_seals_admin_write ON public.shop_seals;
CREATE POLICY shop_seals_admin_write ON public.shop_seals
  FOR ALL
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.shop_seals IS
  'Seals given to a shop (badge build J2, owner 15 Nov): yearly no1/top10/most_in_demand/clients_choice once per shop+seal+year; verified_partner once per shop for life (3077c9b3). Setnayan Verified is read live from vendor_profiles, never stored here. Written by the service role (lib/shop-seals.server.ts).';

-- ── 2 · the yearly facts, one read for every shop ───────────────────────────
CREATE OR REPLACE FUNCTION public.shop_seal_year_facts(p_year INTEGER)
RETURNS TABLE (
  vendor_profile_id  UUID,
  completed_events   INTEGER,
  refunded_events    INTEGER,
  shop_cancellations INTEGER,
  inquiries          INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH yr AS (
    SELECT make_date(p_year, 1, 1) AS d0, make_date(p_year + 1, 1, 1) AS d1
  ),
  done AS (
    -- Completed through Setnayan in the year: delivered/complete, on an event dated in the year (the couple's
    -- deleted event keeps its date in event_date_at_delete), with every real-booking guard.
    SELECT COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id) AS vpid,
           ev.vendor_id,
           ev.event_id
      FROM public.event_vendors ev
      LEFT JOIN public.events e ON e.event_id = ev.event_id
      CROSS JOIN yr
     WHERE COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id) IS NOT NULL
       AND ev.status IN ('delivered', 'complete')
       AND ev.archived_at IS NULL
       AND ev.voided_by_fraud IS NOT TRUE
       AND COALESCE(e.event_date, ev.event_date_at_delete) >= yr.d0
       AND COALESCE(e.event_date, ev.event_date_at_delete) <  yr.d1
       AND NOT EXISTS (
         SELECT 1 FROM public.comp_grants cg
          WHERE cg.vendor_profile_id = COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id)
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
                          WHERE vp.vendor_profile_id = COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id)
                            AND vp.user_id = em.user_id)
                 OR EXISTS (SELECT 1 FROM public.vendor_team_members vtm
                             WHERE vtm.vendor_profile_id = COALESCE(ev.linked_vendor_profile_id, ev.marketplace_vendor_id)
                               AND vtm.user_id = em.user_id)))
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
  cancelled AS (
    -- The one place the platform RECORDS that the shop cancelled: a schedule-pool booking released with
    -- 'vendor_cancelled'. (A couple's force-majeure flag of type vendor_cancellation is a claim, not a record —
    -- it is not counted here; lib/shop-seals.ts names this as a partial source.)
    SELECT pb.vendor_profile_id AS vpid, count(*)::INTEGER AS n
      FROM public.vendor_schedule_pool_bookings pb CROSS JOIN yr
     WHERE pb.release_reason = 'vendor_cancelled'
       AND pb.released_at >= yr.d0 AND pb.released_at < yr.d1
     GROUP BY pb.vendor_profile_id
  ),
  asked AS (
    SELECT ct.vendor_profile_id AS vpid, count(*)::INTEGER AS n
      FROM public.chat_threads ct CROSS JOIN yr
     WHERE ct.vendor_profile_id IS NOT NULL
       AND ct.created_at >= yr.d0 AND ct.created_at < yr.d1
     GROUP BY ct.vendor_profile_id
  )
  SELECT vp.vendor_profile_id,
         COALESCE(c.completed_events, 0),
         COALESCE(c.refunded_events, 0),
         COALESCE(x.n, 0),
         COALESCE(a.n, 0)
    FROM public.vendor_profiles vp
    LEFT JOIN completed c ON c.vpid = vp.vendor_profile_id
    LEFT JOIN cancelled x ON x.vpid = vp.vendor_profile_id
    LEFT JOIN asked a     ON a.vpid = vp.vendor_profile_id
   WHERE vp.is_demo IS NOT TRUE
     AND (c.vpid IS NOT NULL OR x.vpid IS NOT NULL OR a.vpid IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION public.shop_seal_year_facts(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_seal_year_facts(INTEGER) TO service_role;

COMMENT ON FUNCTION public.shop_seal_year_facts(INTEGER) IS
  'Seals engine (J2): per non-demo shop, for one calendar year — events completed through Setnayan (real bookings, event dated in the year), how many of those carry an unremoved refund, schedule-pool releases recorded as vendor_cancelled, and inquiries (chat threads opened). service_role only.';

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
    SELECT ev.vendor_id, ev.event_id, ev.source, ev.total_cost_php
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
    COALESCE((SELECT sum(b.total_cost_php) FROM booked b), 0)::NUMERIC,
    (SELECT count(*) FROM booked b WHERE b.total_cost_php IS NULL)::INTEGER,
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
  'Verified Partner (3077c9b3) counters for one shop over its real bookings: total of total_cost_php (and how many bookings carry no price), bookings found via Find (host_marketplace_search/explore/search), via its website (website/shop_page), via QR import (vendor_invite), events booked by Booking QR (claimed vendor_locked_qr_tokens), and distinct suppliers with an accepted, active partnership recommending it. service_role only.';

COMMIT;
