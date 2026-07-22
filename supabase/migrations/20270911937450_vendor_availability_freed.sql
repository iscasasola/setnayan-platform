-- vendor availability freed (block-removal capture)
-- ============================================================================
-- The GRD-09 availability guard flags a shortlisted/booked vendor who just got
-- BUSY on the couple's date (from vendor_calendar_blocks.created_at). This adds
-- the mirror signal — a vendor who just FREED UP (a block covering the date was
-- removed) → "good news, a top pick is available again." A deleted block leaves
-- no created_at to read, so this captures the removal into a small log via an
-- AFTER DELETE trigger. Same global-history shape as vendor_service_price_history.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_availability_freed (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_profile_id uuid NOT NULL,
  blocked_at        timestamptz,
  blocked_until     timestamptz,
  freed_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_availability_freed ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vaf_vendor_freed_idx
  ON public.vendor_availability_freed (vendor_profile_id, freed_at DESC);

-- RLS (canonical): vendor-owner + admin read; no couple SELECT (the AI snapshot
-- reads it via the admin/service-role client). No write policy — rows come only
-- from the SECURITY DEFINER trigger below.
DROP POLICY IF EXISTS vaf_owner_read ON public.vendor_availability_freed;
CREATE POLICY vaf_owner_read ON public.vendor_availability_freed
  FOR SELECT USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

-- Capture trigger: log every removed calendar block (its old date range).
CREATE OR REPLACE FUNCTION public.capture_vendor_calendar_block_freed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendor_availability_freed
    (vendor_profile_id, blocked_at, blocked_until)
  VALUES
    (OLD.vendor_profile_id, OLD.blocked_at, OLD.blocked_until);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_vendor_block_freed ON public.vendor_calendar_blocks;
CREATE TRIGGER trg_capture_vendor_block_freed
  AFTER DELETE ON public.vendor_calendar_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_vendor_calendar_block_freed();
