-- shop_publishes_before_verified
-- ============================================================================
-- 🏪 A SHOP CAN PUT ITS PAGE UP BEFORE IT IS VERIFIED, WHILE BOOKINGS ARE CLOSED
-- (owner 2026-11-02: "for suppliers that are not linked to us, we offer them space to create their website … and
-- apply for verified account"; controller brief: "A shop can publish WITHOUT being verified while bookings are
-- closed, so the website can go live; verified stays a badge"). Supplier gate audit G2, publish half.
--
-- ONE column, written only by the shop's own manager through the app (`setShopPublished`,
-- app/vendor-dashboard/website/actions.ts, service role after the ownership check):
--   self_published_at — when the shop chose to show its page; NULL = not shown.
--
-- 🔒 WHAT THIS DOES NOT DO — deliberately: it does NOT widen `vendor_profiles_public_read` or any RLS. The shop
-- page (`/v/[slug]`) reads with the service role and decides who may open it in ONE rule (`shopPageGate`,
-- lib/own-shop-preview.ts); that rule now also opens a self-published, unarchived, non-demo shop while bookings
-- are closed (`platform_settings.bookings_open`, 20271302310560). The marketplace, search and every PostgREST
-- door stay verified-only, so an unverified shop is reachable at its own address but never listed, and no column
-- becomes anon-readable. No grant: anon/authenticated hold no table SELECT on vendor_profiles, and none is added.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS self_published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.self_published_at IS
  'Owner 2026-11-02: the shop chose to show its page before it is verified. Opens /v/[slug] (shopPageGate) only while platform_settings.bookings_open is not TRUE, never for an archived or demo shop, never in the marketplace. NULL = not shown. Written by setShopPublished (service role, after the manager check).';
