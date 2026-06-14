-- ============================================================================
-- 20261214000000_guard_pax_finalize_columns.sql
--
-- ADAPTIVE PAX PRICING — Phase 7 hardening (money-integrity guard).
--
-- Adversarial review (2026-06-13) flagged: events.guest_count_locked_at +
-- final_pax are couple-writable under the broad couple UPDATE RLS. A couple
-- could PATCH them directly (final_pax = 1 while keeping 300 guests) to dodge a
-- vendor surcharge — the binding count is money. ensureFinalized() now writes
-- them ONLY via the service-role admin client; this trigger enforces that at the
-- DB level: any non-service-role UPDATE that tries to change those two columns
-- has the change silently reverted to the old value (updates to OTHER event
-- columns still succeed, so the couple's normal edits are unaffected).
--
-- These columns are new (Phase 1/7) and written only by the finalize path, so
-- no existing flow is affected.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_pax_finalize_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only the service-role finalize path may move the binding-count lock fields.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.guest_count_locked_at := OLD.guest_count_locked_at;
    NEW.final_pax := OLD.final_pax;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_pax_finalize_columns_trg ON public.events;
CREATE TRIGGER guard_pax_finalize_columns_trg
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_pax_finalize_columns();

COMMIT;
