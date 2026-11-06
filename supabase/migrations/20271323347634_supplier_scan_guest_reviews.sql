-- supplier scan guest reviews
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟⭐ THE SUPPLIER CLAIM SCANNER — slice 5: A GUEST'S OPTIONAL REVIEW AFTER "RECEIVED".
--
-- Owner ruling (DECISION_LOG 2026-09-25 "AFTER A GUEST RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON
-- THEIR EVENT HUB"): *"after they receive the product, a review can pop up for the guest to fill up?"* → *"optional to
-- respond"*.
--
-- ⭐ ONE STORE (owner ruling 2026-11-06, PR #7337): guest reviews are ONE store, ONE writer and ONE "From guests"
-- section. The scanner's pop-up is a second DOOR into it — the review itself is written by
-- `vendor_guest_review_submit` (migration 20271316933967), which already admits a guest whose `supplier_scan_claims`
-- row for that shop is RECEIVED. Public at once; Setnayan admin can Hide/Show it (Admin › Reviews › Guest reviews).
-- So this migration creates NO review table and NO review writer.
--
-- What is left here is the one thing that is not a review: "Not now". A guest who taps it is not asked about that
-- shop again at that event (the pop-up never asks twice).
--
--   · supplier_scan_review_skips: one row per (event, guest, shop) — written by the scanner action with the SERVICE
--     ROLE (a guest is not an RLS user; the guest id comes from their verified pass, never the request);
--   · RLS at CREATE: Setnayan admin reads. No supplier, couple, guest or anon access. Nothing public.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_scan_review_skips (
  event_id           UUID NOT NULL,
  guest_id           UUID NOT NULL,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  skipped_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, guest_id, vendor_profile_id),
  FOREIGN KEY (event_id, guest_id) REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS supplier_scan_review_skips_vendor_idx ON public.supplier_scan_review_skips (vendor_profile_id);

ALTER TABLE public.supplier_scan_review_skips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_review_skips FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.supplier_scan_review_skips FROM authenticated;

DROP POLICY IF EXISTS supplier_scan_review_skips_admin_read ON public.supplier_scan_review_skips;
CREATE POLICY supplier_scan_review_skips_admin_read ON public.supplier_scan_review_skips
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.supplier_scan_review_skips IS
  'A guest''s "Not now" to the scanner''s optional review pop-up: one row per event · guest · shop, so the pop-up never asks twice. Not a review — reviews live in vendor_guest_reviews (one store, one writer vendor_guest_review_submit; owner 2026-11-06). Written by the scanner action with the service role; Setnayan admin reads.';

COMMIT;
