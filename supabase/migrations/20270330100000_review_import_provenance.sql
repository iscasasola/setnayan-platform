-- ============================================================================
-- 20270330100000_review_import_provenance.sql
-- Vendor import → CRM polish — split the receipt-backed review provenance into
-- two flavors so the public review pill can distinguish:
--
--   • "Verified wedding"  (on-platform) — the couple found + booked this vendor
--      through Setnayan themselves (marketplace save / search / cascade).
--   • "Verified booking"  (import)      — the vendor brought the couple onto
--      Setnayan via their invite QR (event_vendors.source = 'vendor_invite').
--
-- Owner spec (project_setnayan_vendor_import_crm_workstream):
--   "Optional 'Verified booking' (import) vs 'Verified wedding' (on-platform)
--    badge." This migration is the data half; the UI reads the new column.
--
-- Builds DIRECTLY on 20270321252758_receipt_backed_reviews.sql:
--   • That migration added vendor_reviews.booked_through_setnayan (TRUE when the
--     review's source booking links to the vendor's marketplace profile) and the
--     stamp_review_provenance() BEFORE trigger that re-derives it on every write.
--   • Here we add a SECOND platform-derived column, via_vendor_import, that is a
--     STRICT SUBSET of booked_through_setnayan: it's only ever TRUE when the
--     linking booking ALSO carries source='vendor_invite'. So the three states a
--     review can be in are:
--        via_vendor_import = TRUE                      → "Verified booking"
--        booked_through_setnayan = TRUE (import FALSE) → "Verified wedding"
--        booked_through_setnayan = FALSE               → no pill (off-platform)
--
-- Like booked_through_setnayan this is PLATFORM-DERIVED — couples can never set
-- it. The trigger overwrites whatever the client passes with the derived truth,
-- and a couple forging it would only DOWNGRADE their own review's pill (import
-- is the narrower claim), so there is no abuse incentive either way.
--
-- Idempotent. No prices. The existing public SELECT on vendor_reviews stays
-- untouched (the new column is covered by the same row-level read policy).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_reviews.via_vendor_import — server-populated provenance subset.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS via_vendor_import BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_reviews.via_vendor_import IS
  'Receipt-backed provenance SUBSET of booked_through_setnayan: TRUE only when '
  'this review''s source event_vendors booking links to the reviewed vendor '
  '(linked_vendor_profile_id OR marketplace_vendor_id) AND that booking''s '
  'source = ''vendor_invite'' — i.e. the vendor brought the couple onto Setnayan '
  'via their invite QR. Drives the "Verified booking" (import) pill vs the '
  '"Verified wedding" (on-platform) pill. PLATFORM-DERIVED — re-derived by the '
  'stamp_review_provenance BEFORE trigger on every write; couples can never set it.';

-- Helper: did the event_vendors booking on (event_id) that links to
-- (vendor_profile_id) originate from the vendor's invite QR? Mirrors
-- review_is_booked_through_setnayan's linkage predicate + the source filter.
-- SECURITY DEFINER + locked search_path so the derivation is authoritative and
-- uniform across the lib path, the action path, and the trigger.
CREATE OR REPLACE FUNCTION public.review_via_vendor_import(
  p_event_id UUID,
  p_vendor_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND (
        ev.linked_vendor_profile_id = p_vendor_profile_id
        OR ev.marketplace_vendor_id = p_vendor_profile_id
      )
      AND ev.source = 'vendor_invite'
  );
$$;

GRANT EXECUTE ON FUNCTION public.review_via_vendor_import(UUID, UUID)
  TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Extend the existing provenance trigger to stamp BOTH columns.
--    CREATE OR REPLACE keeps the same trigger wiring; we just also derive
--    via_vendor_import. Recreate the trigger so via_vendor_import joins the
--    UPDATE OF column list (symmetry with booked_through_setnayan — a direct
--    write to it re-fires the re-derivation, so it can't be smuggled either).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stamp_review_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.booked_through_setnayan :=
    public.review_is_booked_through_setnayan(NEW.event_id, NEW.vendor_profile_id);
  NEW.via_vendor_import :=
    public.review_via_vendor_import(NEW.event_id, NEW.vendor_profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reviews_stamp_provenance ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_stamp_provenance
  BEFORE INSERT OR UPDATE OF
    event_id, vendor_profile_id, booked_through_setnayan, via_vendor_import
  ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.stamp_review_provenance();

-- ----------------------------------------------------------------------------
-- 3. Backfill existing rows from the current linkage + source.
-- ----------------------------------------------------------------------------

UPDATE public.vendor_reviews vr
SET via_vendor_import =
  public.review_via_vendor_import(vr.event_id, vr.vendor_profile_id)
WHERE vr.via_vendor_import IS DISTINCT FROM
  public.review_via_vendor_import(vr.event_id, vr.vendor_profile_id);

COMMIT;
