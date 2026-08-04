-- ============================================================================
-- 20271001120000_free_tier_booking_cap_trigger.sql
-- Free-tier concurrent-booking cap — DB-level hard guard (owner 2026-07-25).
--
-- MODEL (Vendor_Monetization_Model_LOCKED_2026-07-25.md § "Free-tier mechanics"):
-- a FREE vendor (tier_state 'free' or 'verified') may hold at most 3 CONCURRENT
-- ACTIVE bookings (locked, event not yet complete). A 4th lock is blocked until
-- one completes (a slot frees) or the vendor subscribes (Solo+ = unlimited).
-- Mirrors the pure logic already merged in lib/vendor-free-tier-booking-cap.ts
-- (FREE_TIER_ACTIVE_BOOKING_CAP = 3).
--
-- SHIP-DARK: gated on platform_settings.free_tier_booking_cap_enabled (default
-- FALSE). While FALSE the trigger is a pure no-op → locking behaves EXACTLY as
-- today. ⚠ DO NOT flip it on until the lock paths (finalizeVendor /
-- chat-lock-booking) catch this check_violation and surface the friendly
-- "Fully booked" state + upsell (a follow-up PR) — otherwise a capped 4th lock
-- raises a raw error. Only the couple's Lock action is meant to be gated;
-- inbox/chat are NEVER gated by this.
--
-- WHY A DB TRIGGER (defense-in-depth · mirrors enforce_booking_requires_verified_vendor,
-- 20270927437859): several app paths flip an event_vendors row into a booked
-- status (finalizeVendor + slot-acquire RPC, wizard, package cascade); this
-- trigger is the ONE choke point none can bypass, and it lives entirely in SQL
-- so it needs no edit to the payment session's lock code.
--
-- ACTIVE (concurrent) = status ∈ ('contracted','deposit_paid','delivered') — the
-- confirmed set MINUS 'complete' (a completed event frees its slot). Only the
-- TRANSITION INTO an active status is checked (INSERT active, or UPDATE active
-- where OLD was not active), so lifecycle advances + edits of an already-active
-- row are never re-counted. Only MARKETPLACE vendors carry a tier; only FREE
-- tiers ('free'/'verified') are capped.
-- ============================================================================

-- 1) Master switch on the settings singleton (default FALSE = inert).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS free_tier_booking_cap_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.platform_settings.free_tier_booking_cap_enabled IS
  'Master switch for the free-tier 3-concurrent-booking cap (enforce_free_tier_booking_cap). FALSE = inert (default). Do NOT flip until the lock paths handle the check_violation + show the "Fully booked" UI.';

-- 2) The guard.
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

  -- Count this vendor's OTHER active bookings (concurrent, not-yet-complete).
  SELECT COUNT(*)
    INTO v_count
    FROM public.event_vendors ev
   WHERE ev.marketplace_vendor_id = NEW.marketplace_vendor_id
     AND ev.event_id <> NEW.event_id
     AND ev.status = ANY (v_active);

  IF v_count >= v_cap THEN
    RAISE EXCEPTION
      'free_tier_booking_cap: free-tier vendor already holds % concurrent active bookings (cap %) (marketplace_vendor_id=%)',
      v_count, v_cap, NEW.marketplace_vendor_id
      USING ERRCODE = 'check_violation',
            HINT = 'Free vendors hold 3 concurrent bookings. Finish an event to free a slot, or subscribe (Solo+) for unlimited.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_free_tier_booking_cap() IS
  'Free-tier 3-concurrent-booking cap (owner 2026-07-25). Blocks a NEW lock when a free-tier ("free"/"verified") marketplace vendor already holds 3 active bookings (contracted/deposit_paid/delivered). Gated on platform_settings.free_tier_booking_cap_enabled (default FALSE = inert). Mirrors lib/vendor-free-tier-booking-cap.ts.';

-- 3) Attach. Composes with enforce_booking_requires_verified_vendor (both BEFORE,
--    both validate-and-RETURN-NEW; order is irrelevant since both must pass).
DROP TRIGGER IF EXISTS enforce_free_tier_booking_cap_trg ON public.event_vendors;
CREATE TRIGGER enforce_free_tier_booking_cap_trg
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_free_tier_booking_cap();
