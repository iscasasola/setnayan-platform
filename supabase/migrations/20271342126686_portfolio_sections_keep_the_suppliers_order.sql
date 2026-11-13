-- portfolio_sections_keep_the_suppliers_order
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 🖼 THE PORTFOLIO'S SECTIONS KEEP THE SUPPLIER'S ORDER (ruling 5940; approved
-- prototype `prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html`
-- v3, the "Reorder · NEW" closing row: "Drag sections into your order — NEW, no
-- order is stored today").
--
-- `vendor_profiles.portfolio_section_order` — the section keys the supplier put
-- first, in their order ('best', 'page', 'cards', …, `lib/portfolio-section-order.ts`).
-- An empty list = the shipped order. A key the app no longer draws is ignored on
-- read, and a section the list does not name keeps its shipped place after the
-- named ones — so this column can never hide a section.
--
-- Written only by the shop's own session (`updateVendorProfileField`,
-- field = 'portfolio_order'); row-level policy still decides WHICH row.
-- NEVER APPLIED BY HAND — the pipeline pushes it.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS portfolio_section_order TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_portfolio_section_order_shape;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_portfolio_section_order_shape
  CHECK (
    cardinality(portfolio_section_order) <= 24
    AND array_position(portfolio_section_order, NULL) IS NULL
  );

COMMENT ON COLUMN public.vendor_profiles.portfolio_section_order IS
  'The Portfolio tab''s section keys in the supplier''s order (Reorder, ruling 5940). Empty = the shipped order; unknown keys are ignored on read and unnamed sections keep their shipped place after the named ones (lib/portfolio-section-order.ts). Written by the shop''s own session only.';

-- Born readable by the shop (and the console) the way every post-lockdown column is (20271217955839's column
-- allowlist — lint-vendor-profiles-column-grants.mjs): its own SELECT grant to `authenticated`, none to anon (the
-- public shop page never reads it), and `vendor_profiles_self` rebuilt so its frozen projection carries it. The
-- block below is 20271334860034's, word for word, with this column in the anti-vacuity check.
GRANT SELECT (portfolio_section_order) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (portfolio_section_order) ON public.vendor_profiles FROM anon;
-- Written by the shop's own session (Portfolio › Reorder). Row-level policy still decides WHICH row.
GRANT UPDATE (portfolio_section_order) ON public.vendor_profiles TO authenticated;

DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0 OR position('portfolio_section_order' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title or section-order columns';
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

COMMIT;
