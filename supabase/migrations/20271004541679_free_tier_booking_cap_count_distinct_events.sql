-- ============================================================================
-- 20271004541679_free_tier_booking_cap_count_distinct_events.sql
-- Free-tier booking cap counts EVENTS, not ROWS (defect fix, 2026-07-26).
--
-- 20271001120000 shipped `enforce_free_tier_booking_cap` with
--   SELECT COUNT(*) ... WHERE ev.event_id <> NEW.event_id AND ev.status = ANY(active)
-- but `event_vendors` carries ONE ROW PER SERVICE, not per booking, so COUNT(*)
-- counts ROWS where the model (Vendor_Monetization_Model_LOCKED_2026-07-25.md
-- § "Free-tier mechanics") counts BOOKINGS — and one booking is one EVENT.
--
-- HOW WIDE IS THE GAP, precisely: `event_vendors_unique_marketplace_pick_per_event`
-- (20260625050739) already forbids two ACTIVE, NON-ARCHIVED rows per
-- (event_id, marketplace_vendor_id), so a straight multi-service booking cannot
-- produce duplicate rows in the first place. The index is PARTIAL, though —
-- ARCHIVED rows are outside it, and an archived row keeps its
-- 'contracted'/'deposit_paid'/'delivered' status. So a couple who archives and
-- re-locks the same vendor leaves TWO active-status rows in ONE event, which
-- COUNT(*) read as two concurrent bookings and which burned a slot every other
-- couple was then refused. Covered end-to-end in
-- apps/web/tests/db/free-tier-booking-cap.db.test.ts.
--
-- Fix: COUNT(DISTINCT ev.event_id). Nothing else about the guard changes: still
-- BEFORE INSERT OR UPDATE on event_vendors, still gated on
-- platform_settings.free_tier_booking_cap_enabled (default FALSE = inert), still
-- only free tiers, still only the transition INTO an active status, still the
-- same 'free_tier_booking_cap:' exception token that
-- lib/vendor-free-tier-booking-cap-ui.ts detects (a test in
-- lib/vendor-free-tier-booking-cap-ui.test.ts reads THIS FILE and asserts the
-- token + the check_violation ERRCODE — reword the RAISE below and it goes red).
--
-- Mirrored in TypeScript by lib/vendor-free-tier-booking-cap.server.ts
-- (countDistinctBookedEvents).
--
-- Idempotent: CREATE OR REPLACE of the function body, then a DROP/CREATE of the
-- trigger that already points at it.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_free_tier_booking_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_active  CONSTANT public.vendor_status[] :=
    ARRAY['contracted','deposit_paid','delivered']::public.vendor_status[];
  v_cap     CONSTANT INTEGER := 3;
  v_tier    TEXT;
  v_count   INTEGER;
BEGIN
  -- Flag-dark: no-op unless the owner has switched the cap on.
  SELECT COALESCE(ps.free_tier_booking_cap_enabled, FALSE)
    INTO v_enabled
    FROM public.platform_settings ps
   WHERE ps.id = 1;
  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NEW;
  END IF;

  -- Only marketplace vendors carry a tier.
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only gate the TRANSITION into an active/concurrent status.
  IF NOT (NEW.status = ANY (v_active)) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = ANY (v_active) THEN
    RETURN NEW;  -- a lifecycle advance / edit of an already-active lock, not a new one
  END IF;

  -- Only FREE tiers ('free'/'verified') are capped; paid tiers are unlimited.
  SELECT vp.tier_state::text
    INTO v_tier
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = NEW.marketplace_vendor_id;
  IF v_tier IS DISTINCT FROM 'free' AND v_tier IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  -- Count this vendor's OTHER active EVENTS (concurrent bookings). DISTINCT is
  -- the whole point: one event with four service rows is ONE booking.
  SELECT COUNT(DISTINCT ev.event_id)
    INTO v_count
    FROM public.event_vendors ev
   WHERE ev.marketplace_vendor_id = NEW.marketplace_vendor_id
     AND ev.event_id <> NEW.event_id
     AND ev.status = ANY (v_active);

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'free_tier_booking_cap: free-tier vendor already holds % concurrent active bookings (cap %)',
      v_count, v_cap
      USING ERRCODE = 'check_violation',
            HINT = 'Free vendors hold 3 concurrent bookings. Finish an event to free a slot, or subscribe (Solo+) for unlimited.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_free_tier_booking_cap() IS
  'Free-tier 3-concurrent-booking cap (owner 2026-07-25; counts DISTINCT events, not rows, since 2026-07-26). Blocks a NEW lock when a free-tier ("free"/"verified") marketplace vendor already holds 3 active bookings (contracted/deposit_paid/delivered) across 3 DISTINCT other events. Gated on platform_settings.free_tier_booking_cap_enabled (default FALSE = inert). Mirrors lib/vendor-free-tier-booking-cap.server.ts.';

-- Re-attach (idempotent; unchanged from 20271001120000).
DROP TRIGGER IF EXISTS enforce_free_tier_booking_cap_trg ON public.event_vendors;
CREATE TRIGGER enforce_free_tier_booking_cap_trg
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_tier_booking_cap();
