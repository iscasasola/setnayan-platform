-- ============================================================================
-- SECURITY FIX for the mutual-accept redesign (migration 20270403305164).
--
-- HOLE: RLS `WITH CHECK` validates only the NEW row, never OLD-vs-NEW. The
-- recipient accept/decline policy + the proposer withdraw policy each pin the
-- caller's own side + the allowed status, but leave the COUNTERPARTY id, the
-- relationship_type, and the commercial terms MUTABLE. Because public
-- visibility now hinges on status='accepted' (recipient-settable) instead of
-- the admin-only admin_verified flag, a recipient could PATCH a genuine incoming
-- proposal via the public PostgREST key — repointing recommending_vendor_id to
-- any prestige vendor Z + relationship_type='sponsored_included' + status=
-- 'accepted' — and self-publish a FORGED endorsement from Z in Explore, without
-- Z's consent. That regresses the whole integrity goal of mutual-accept (the old
-- model made vendor self-publication impossible).
--
-- FIX: a BEFORE UPDATE trigger that pins the immutable columns for non-admins.
-- After a partnership row is created, a non-admin may only move status /
-- accepted_at / is_active (their own party's transition, already gated by RLS);
-- the pair identity, relationship type, target, and terms cannot change. Admins
-- (who own the "admins manage" policy) may still correct anything.
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vendor_partnerships_lock_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Admins own the "admins manage vendor partnerships" policy; let them correct.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.recommending_vendor_id  IS DISTINCT FROM OLD.recommending_vendor_id
     OR NEW.recommended_vendor_id   IS DISTINCT FROM OLD.recommended_vendor_id
     OR NEW.relationship_type       IS DISTINCT FROM OLD.relationship_type
     OR NEW.target_id               IS DISTINCT FROM OLD.target_id
     OR NEW.additional_fee_centavos IS DISTINCT FROM OLD.additional_fee_centavos
     OR NEW.discount_pct            IS DISTINCT FROM OLD.discount_pct
     OR NEW.covered_plan_groups     IS DISTINCT FROM OLD.covered_plan_groups
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_PARTNERSHIP_FIELDS: only status may change after a partnership is created (the counterparty, relationship type, target, and terms are locked to prevent forged endorsements)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_partnerships_lock_immutable ON public.vendor_partnerships;
CREATE TRIGGER trg_vendor_partnerships_lock_immutable
  BEFORE UPDATE ON public.vendor_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_partnerships_lock_immutable_cols();
