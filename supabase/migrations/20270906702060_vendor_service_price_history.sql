-- vendor service price history + capture trigger
-- ============================================================================
-- Global vendor-side price-change log (owner chose "build the missing guards"
-- via global vendor-side history, 2026-07-21). Every change to a vendor
-- service's couple-facing `starting_price_php` is logged here, so Setnayan AI's
-- GRD-03 price-rise guard can flag couples whose shortlisted/booked vendors got
-- more expensive — making the /setnayan-ai "a price that moved" promise true.
-- Reusable by Market Intel later (that's the point of a global history vs. an
-- event-scoped baseline).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_service_price_history (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_profile_id uuid NOT NULL,
  vendor_service_id uuid,
  category          text,
  old_price_php     integer,
  new_price_php     integer,
  changed_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_service_price_history ENABLE ROW LEVEL SECURITY;

-- The snapshot read path: recent changes for a set of vendors.
CREATE INDEX IF NOT EXISTS vsph_vendor_changed_idx
  ON public.vendor_service_price_history (vendor_profile_id, changed_at DESC);

-- RLS (canonical pattern): a vendor reads its OWN price history; admin reads
-- all. NO couple SELECT — the Setnayan AI snapshot reads this through the admin
-- (service-role) client on the notify sweep, so couples never touch it directly.
-- No write policy: rows are inserted ONLY by the SECURITY DEFINER trigger below.
DROP POLICY IF EXISTS vsph_owner_read ON public.vendor_service_price_history;
CREATE POLICY vsph_owner_read ON public.vendor_service_price_history
  FOR SELECT USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

-- Capture trigger: log every couple-facing price change on vendor_services.
CREATE OR REPLACE FUNCTION public.capture_vendor_service_price_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php THEN
    INSERT INTO public.vendor_service_price_history
      (vendor_profile_id, vendor_service_id, category, old_price_php, new_price_php)
    VALUES
      (NEW.vendor_profile_id, NEW.vendor_service_id, NEW.category,
       OLD.starting_price_php, NEW.starting_price_php);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_vendor_service_price ON public.vendor_services;
CREATE TRIGGER trg_capture_vendor_service_price
  AFTER UPDATE OF starting_price_php ON public.vendor_services
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_vendor_service_price_change();
