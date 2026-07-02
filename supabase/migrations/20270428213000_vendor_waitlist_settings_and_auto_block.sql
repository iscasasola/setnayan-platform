-- vendor_waitlist_settings_and_auto_block
-- ============================================================================
-- Owner 2026-07-02: a booked date must auto-close, with an optional small
-- waitlist the vendor curates. This migration adds the DB substrate:
--
--   1. Vendor-level waitlist settings on vendor_profiles:
--        waitlist_enabled          BOOLEAN  (default FALSE)
--        max_waitlist_acceptances  INT 1-3  (default 1)
--      When enabled, a booked (therefore blocked) date still offers couples a
--      "Join the waitlist" CTA and lets the vendor PICK up to N of them.
--
--   2. vendor_date_waitlist.accepted_at — the vendor's "pick this couple" stamp
--      (the owner's "whitelist" pick). Capped at max_waitlist_acceptances per
--      (vendor, date); enforced in app code (the vendor pick action).
--
--   3. AUTO-BLOCK-ON-BOOKING. An AFTER trigger on event_vendors closes a
--      marketplace vendor's wedding date the moment their row reaches
--      'deposit_paid' (covers the Locked-QR claim + finalize/lock paths). The
--      block is UNCONDITIONAL: a booked date is taken, so it must leave
--      couple-side availability (getVendorAvailableDays) AND block a second
--      Locked QR for that date (owner rule #4). The waitlist is a layer ON TOP
--      of the blocked date — the block is exactly what surfaces the existing
--      "Join the waitlist" CTA. Mirrors addManualBlock's day-grain convention
--      (00:00 -> 23:30 +08, org-wide pool_id NULL, block_source
--      'setnayan_booking'). Idempotent, SECURITY DEFINER, and exception-safe so
--      an auto-block failure can NEVER roll back a booking.
--
--   4. public.vendor_block_booked_date(vendor, date, label) helper — the single
--      idempotent "close this date" primitive, reused by the trigger.
--
-- Additive; no RLS change (helper + trigger fn are SECURITY DEFINER).
-- ============================================================================

-- 1. Vendor waitlist settings ------------------------------------------------
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_waitlist_acceptances INT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_max_waitlist_1_3'
  ) THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_max_waitlist_1_3
      CHECK (max_waitlist_acceptances BETWEEN 1 AND 3);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.waitlist_enabled IS
  'When TRUE, a booked (blocked) date still offers couples the "Join the waitlist" CTA and lets the vendor pick up to max_waitlist_acceptances of them. When FALSE, a booked date is simply Unavailable to couples.';
COMMENT ON COLUMN public.vendor_profiles.max_waitlist_acceptances IS
  'Owner-set 1-3 cap on how many waitlisted couples the vendor may pick (accept) per date. Enforced in the vendor pick action; once reached the waitlist for that date is closed.';

-- 2. Vendor "pick this couple" stamp on the waitlist queue -------------------
ALTER TABLE public.vendor_date_waitlist
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_date_waitlist.accepted_at IS
  'Set when the vendor PICKS this couple onto the waitlist (the "whitelist" pick). Capped at vendor_profiles.max_waitlist_acceptances per (vendor_profile_id, requested_date).';

-- 3. Idempotent "close this date org-wide as booked" primitive ---------------
CREATE OR REPLACE FUNCTION public.vendor_block_booked_date(
  p_vendor_profile_id UUID,
  p_date              DATE,
  p_label            TEXT DEFAULT 'Booked'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_vendor_profile_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;
  -- Idempotent: skip if an org-wide booked block already covers that day.
  IF EXISTS (
    SELECT 1 FROM public.vendor_calendar_blocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND pool_id IS NULL
       AND block_source = 'setnayan_booking'
       AND blocked_at::date = p_date
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.vendor_calendar_blocks
    (vendor_profile_id, pool_id, blocked_at, blocked_until,
     block_label, block_source, is_private)
  VALUES
    (p_vendor_profile_id, NULL,
     (p_date::text || 'T00:00:00+08:00')::timestamptz,
     (p_date::text || 'T23:30:00+08:00')::timestamptz,
     COALESCE(NULLIF(btrim(p_label), ''), 'Booked'), 'setnayan_booking', TRUE);
END;
$$;

-- 4. Auto-block trigger on event_vendors -------------------------------------
CREATE OR REPLACE FUNCTION public.event_vendor_autoblock_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
BEGIN
  -- Only marketplace vendors (manual vendors have no profile / calendar).
  IF NEW.marketplace_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Only when the booking actually reaches deposit_paid.
  IF NEW.status <> 'deposit_paid'::public.vendor_status THEN
    RETURN NEW;
  END IF;
  -- On UPDATE, only fire on the considering/... -> deposit_paid transition.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'deposit_paid'::public.vendor_status THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = NEW.event_id;
  IF v_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Exception-safe: a failed auto-block must never roll back the booking.
  BEGIN
    PERFORM public.vendor_block_booked_date(NEW.marketplace_vendor_id, v_date, 'Booked');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'event_vendor_autoblock_on_booking: block failed for vendor % date %: %',
      NEW.marketplace_vendor_id, v_date, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_vendor_autoblock_on_booking ON public.event_vendors;
CREATE TRIGGER event_vendor_autoblock_on_booking
  AFTER INSERT OR UPDATE OF status ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.event_vendor_autoblock_on_booking();
