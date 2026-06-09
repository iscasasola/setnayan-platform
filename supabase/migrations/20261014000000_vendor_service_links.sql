-- ============================================================================
-- 20261014000000_vendor_service_links.sql
--
-- Formal "linked-services-on-card" model (owner-locked concept; first schema).
--
-- LOCKED SPEC (corpus)
-- --------------------
--   Customer_Vendor_Marketplace_Architecture_2026-06-04.md (L22-26):
--     "LINKED SERVICES — other tiles bundled, auto-tagged '✓ included with
--      {vendor}'; card shows 'comes with [X][Y][Z].'"
--   Service_Specifications_2026-06-02.md (L27-29):
--     "LINKED SERVICES (other full categories bundled in — auto-cover those
--      tiles) … auto-tags that tile '✓ included with {vendor}' in the plan."
--   Budget_Planner_Allocation_Engine_2026-06-05.md (L30-37) forward-flag:
--     linked-services-on-card "is not a schema field yet"; when it ships a
--     "solo-vs-linked marker on vendor_services" is needed so budget medians
--     drop linked-only rows.
--
-- WHAT THIS IS (and is NOT)
-- -------------------------
-- A linked service is a LIGHTWEIGHT display/association marker on a REGULAR
-- vendor_services row: "this Photo & Video service also comes with Editorial +
-- Livestream" — same vendor, included in the listing's price, auto-tags those
-- leaf tiles on the couple's card. It is DISTINCT from:
--   • vendor_packages / vendor_package_items (the BUNDLE SKU — one aggregate
--     price, cascade-lock, consumable budget). Bundles are their own product;
--     linked-on-card is metadata on one ordinary service. Do not conflate.
--   • package_inclusions (row-by-row sub-items WITHIN one service).
--
-- Single-vendor only: a link points from one of a vendor's services to another
-- category that SAME vendor covers. Enforced by the denormalized
-- vendor_profile_id + owner-write RLS (a vendor can only write links under
-- their own profile).
--
-- RLS mirrors the existing conventions: public read gated on the parent
-- service being active + vendor published (same as vendor_services_public_read,
-- 20260514010000); owner + admin write (same as vendor_packages_owner_write,
-- 20260604110000).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_service_links — one row per (anchor service → auto-covered tile)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_service_links (
  link_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The anchor/primary listing whose card shows "comes with …".
  vendor_service_id        UUID NOT NULL
                           REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- Denormalized owner — keeps the same-vendor invariant cheap and makes the
  -- owner/public RLS a single-table subquery (no join through vendor_services).
  vendor_profile_id        UUID NOT NULL
                           REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The auto-covered category. canonical_service taxonomy string OR a
  -- service_categories leaf id — TEXT, no FK (same convention as
  -- vendor_package_items.canonical_service; the taxonomy keys aren't a single
  -- unique column we can FK into).
  linked_canonical_service TEXT NOT NULL,
  -- Display name rendered on the card ("Editorial Coverage", "Livestream").
  linked_label             TEXT,
  display_order            INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A given anchor service auto-covers a given tile at most once.
  UNIQUE (vendor_service_id, linked_canonical_service)
);

CREATE INDEX IF NOT EXISTS vendor_service_links_service_idx
  ON public.vendor_service_links (vendor_service_id, display_order);

CREATE INDEX IF NOT EXISTS vendor_service_links_vendor_idx
  ON public.vendor_service_links (vendor_profile_id);

ALTER TABLE public.vendor_service_links ENABLE ROW LEVEL SECURITY;

-- Public read — couples browsing a vendor's card see the linked tiles. Gated
-- exactly like vendor_services_public_read: the anchor service must be active
-- AND its vendor published.
DROP POLICY IF EXISTS vendor_service_links_public_read ON public.vendor_service_links;
CREATE POLICY vendor_service_links_public_read
  ON public.vendor_service_links FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE is_published = TRUE
    )
    AND vendor_service_id IN (
      SELECT vendor_service_id FROM public.vendor_services
      WHERE is_active = TRUE
    )
  );

-- Owner + admin write (mirrors vendor_packages_owner_write). A vendor can only
-- create/edit/delete links under a service they own; admins can manage any.
DROP POLICY IF EXISTS vendor_service_links_owner_write ON public.vendor_service_links;
CREATE POLICY vendor_service_links_owner_write
  ON public.vendor_service_links FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid() AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. vendor_services.is_linked_only — the locked forward-flag marker
--
-- TRUE = this listing exists ONLY as an auto-covered linked component (it has
-- no standalone market price of its own). The budget-allocation median filter
-- (Budget_Planner_Allocation_Engine_2026-06-05.md) will exclude these so a
-- linked-only row doesn't depress a leaf's "solo price" median. Defaults FALSE;
-- every existing row stays a normal standalone service. Wiring the median
-- consumer to read it is a follow-up — the column lands now so it exists when
-- linked cards go live.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS is_linked_only BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
