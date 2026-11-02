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
-- becomes anon-readable. `authenticated` holds column-scoped SELECT on vendor_profiles (20271217955839), so the
-- new column is granted to it by name (rows stay RLS-scoped: the shop reads its own), never to anon, and the
-- shop's own definer view `vendor_profiles_self` is rebuilt so it projects the column
-- (`lint-vendor-profiles-column-grants`).
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS self_published_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_profiles.self_published_at IS
  'Owner 2026-11-02: the shop chose to show its page before it is verified. Opens /v/[slug] (shopPageGate) only while platform_settings.bookings_open is not TRUE, never for an archived or demo shop, never in the marketplace. NULL = not shown. Written by setShopPublished (service role, after the manager check).';

-- The shop may read its own choice (a timestamp, nothing private); a stranger reaches no row by RLS, anon no column.
GRANT SELECT (self_published_at) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (self_published_at) ON public.vendor_profiles FROM anon;

-- The shop's own definer view projects every column as of its CREATE — rebuilt so it carries the new one
-- (`lint-vendor-profiles-column-grants`; block copied from 20271286262047, unchanged).
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='vendor_profiles';

  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;

  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;

REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';
