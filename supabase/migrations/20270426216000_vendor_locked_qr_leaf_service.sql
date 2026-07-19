-- vendor_locked_qr_leaf_service
-- ============================================================================
-- PR5 of the My Shop rework (owner 2026-07). The Locked-QR "Service" picker was
-- the coarse VendorCategory enum (hardcoded in lib/vendors.ts) rolled up from the
-- vendor's coverage — it violated the "menus come from the taxonomy DB, never
-- hardcoded" rule and hid the vendor's actual leaf offerings. It now lists the
-- vendor's real `vendor_services` rows (leaf, DB-driven). This column records
-- WHICH leaf offering was locked; the coarse `category` stays populated (derived
-- from the chosen service) because event_vendors.category is a required enum.
--
-- NULLABLE + ON DELETE SET NULL: a legacy token has none; deleting a service
-- later must not cascade-delete the historical lock. Additive, idempotent.
-- ============================================================================

ALTER TABLE public.vendor_locked_qr_tokens
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_locked_qr_tokens.vendor_service_id IS
  'The specific leaf offering (vendor_services row) the vendor locked, chosen from a DB-driven picker of their own services. category is derived from this row''s category for event_vendors. NULL for legacy tokens or the coverage-category fallback (vendor with no published services).';
