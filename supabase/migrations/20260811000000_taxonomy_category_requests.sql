-- ============================================================================
-- 20260811000000_taxonomy_category_requests.sql
--
-- Phase 4 of the DB-backed-taxonomy build — vendor "request a category"
-- governance (spec 0023 §3.2c · §3.15 ghost-card review). A vendor who can't
-- find a category for what they do proposes one; it lands here as a PENDING
-- request (a "ghost card") for an admin to resolve with one of four outcomes:
--
--   promoted     → admin minted a real canonical leaf for it (createCanonicalLeaf
--                  path); mapped_to_canonical = the new leaf. Vendor keeps
--                  "first-vendor" credit.
--   mapped       → "your X is our existing Y" — mapped_to_canonical = the
--                  existing leaf the vendor should use instead. The COUNT of
--                  requests mapped to the same target is the DEMAND SIGNAL that
--                  the requested node has earned its own promotion later.
--   kept_private → valid but niche; acknowledged, no global node.
--   rejected     → mis-scoped, with a reason in resolution_note.
--
-- Decoupled from the live tree (service_categories / canonical_service_taxonomy)
-- on purpose: a proposal is just an inbox row until an admin acts, so the live
-- catalog is never polluted by un-reviewed vendor input. RLS: a vendor manages
-- only their OWN requests; admins see + resolve all. Enabled at CREATE TABLE.
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.taxonomy_category_requests (
  request_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_by_vendor_id  UUID NOT NULL
                         REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- What the vendor typed + where they think it belongs. tile_id is the tier-2
  -- tile they proposed it under (nullable — admin can re-home on promote).
  proposed_label         TEXT NOT NULL CHECK (char_length(btrim(proposed_label)) BETWEEN 2 AND 80),
  tile_id                TEXT REFERENCES public.service_categories(id) ON DELETE SET NULL,
  proposed_note          TEXT,
  -- Lifecycle.
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','promoted','mapped','kept_private','rejected')),
  -- On promote: the new canonical leaf key. On map: the existing leaf the
  -- vendor should use. NULL while pending / kept_private / rejected.
  mapped_to_canonical    TEXT,
  resolution_note        TEXT,
  reviewed_by_admin_id   UUID,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin queue reads pending-first; the demand-signal groups by mapped_to_canonical.
CREATE INDEX IF NOT EXISTS taxonomy_category_requests_status_idx
  ON public.taxonomy_category_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS taxonomy_category_requests_vendor_idx
  ON public.taxonomy_category_requests (proposed_by_vendor_id);
CREATE INDEX IF NOT EXISTS taxonomy_category_requests_mapped_idx
  ON public.taxonomy_category_requests (mapped_to_canonical)
  WHERE mapped_to_canonical IS NOT NULL;

ALTER TABLE public.taxonomy_category_requests ENABLE ROW LEVEL SECURITY;

-- A vendor may CREATE a request only for a vendor_profile they own. The
-- ownership check resolves through vendor_profiles.user_id rather than caching
-- the user_id here (same pattern as vendor_service_attributes, iteration 0044).
DROP POLICY IF EXISTS taxonomy_category_requests_vendor_insert ON public.taxonomy_category_requests;
CREATE POLICY taxonomy_category_requests_vendor_insert
  ON public.taxonomy_category_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = taxonomy_category_requests.proposed_by_vendor_id
        AND vp.user_id = auth.uid()
    )
  );

-- A vendor sees their OWN requests (to track resolution); admins see all.
DROP POLICY IF EXISTS taxonomy_category_requests_read ON public.taxonomy_category_requests;
CREATE POLICY taxonomy_category_requests_read
  ON public.taxonomy_category_requests FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = taxonomy_category_requests.proposed_by_vendor_id
        AND vp.user_id = auth.uid()
    )
  );

-- Only admins resolve (update) or delete requests. Vendors can't edit after
-- submit — the review is the admin's; the vendor tracks status read-only.
DROP POLICY IF EXISTS taxonomy_category_requests_admin_write ON public.taxonomy_category_requests;
CREATE POLICY taxonomy_category_requests_admin_write
  ON public.taxonomy_category_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS taxonomy_category_requests_admin_delete ON public.taxonomy_category_requests;
CREATE POLICY taxonomy_category_requests_admin_delete
  ON public.taxonomy_category_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

COMMIT;
