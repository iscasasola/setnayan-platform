-- vendor price history: skip demo services
-- ============================================================================
-- Gap fix for the price-change capture trigger (20270906702060): it logged a
-- history row for EVERY vendor_services price change, including seeded demo
-- services (is_demo = true). The couple-side guard join filters demo vendors
-- out, but the global vendor_service_price_history table itself accumulated
-- demo noise. Re-define the function to skip demo rows. Idempotent (CREATE OR
-- REPLACE; the trigger itself is unchanged).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.capture_vendor_service_price_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php
     AND NEW.is_demo IS NOT TRUE THEN
    INSERT INTO public.vendor_service_price_history
      (vendor_profile_id, vendor_service_id, category, old_price_php, new_price_php)
    VALUES
      (NEW.vendor_profile_id, NEW.vendor_service_id, NEW.category,
       OLD.starting_price_php, NEW.starting_price_php);
  END IF;
  RETURN NEW;
END;
$$;
