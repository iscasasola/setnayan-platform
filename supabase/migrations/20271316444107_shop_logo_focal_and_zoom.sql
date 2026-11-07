-- shop_logo_focal_and_zoom
-- ============================================================================
-- 🖼 A SHOP'S LOGO KEEPS ITS ALIGN AND ZOOM (owner, the 2026-11-06 /open-shop gate walk: logo "zoom and align" —
-- reuse the Event Hub Maker photo's 9-point focal + zoom, `lib/hub-canvas.ts`). DECISION_LOG 2026-11-06
-- "OPEN YOUR SHOP — THE GATE-WALK FIXES"; plan `plans/open-shop-fixes-2026-11-06/PLAN.md` item A2.
--
-- TWO columns, beside `logo_url`, so moving the frame never needs a re-upload:
--   logo_focal — 1–9, a phone keypad (1 top-left · 5 centre · 9 bottom-right) = `HUB_FOCAL_POINTS`. NULL = 5.
--   logo_zoom  — 100 · 120 · 150 (= `HUB_ZOOMS`). NULL = 100 (as uploaded).
-- The CHECKs are the SAME closed sets the Maker's sanitiser accepts; a value outside them is refused at the
-- boundary rather than drawn as a guess.
--
-- Written only by the shop's manager through the app (`saveShopLogo`, app/open-shop/logo/actions.ts and My Shop's
-- logo row, service role after the ownership check).
--
-- 🔒 GRANTS: `authenticated` holds column-scoped SELECT on vendor_profiles (20271217955839), so both columns are
-- granted to it by name (rows stay RLS-scoped) and the shop's definer view `vendor_profiles_self` is rebuilt to
-- project them (`lint-vendor-profiles-column-grants`). NOT granted to anon: the public shop page reads with the
-- service role (`app/v/[slug]/page.tsx`), and widening the anon column set (20271014385411) is not this change.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS logo_focal SMALLINT,
  ADD COLUMN IF NOT EXISTS logo_zoom SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_logo_focal_chk') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_logo_focal_chk CHECK (logo_focal IS NULL OR logo_focal BETWEEN 1 AND 9);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_logo_zoom_chk') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_logo_zoom_chk CHECK (logo_zoom IS NULL OR logo_zoom IN (100, 120, 150));
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.logo_focal IS
  'Owner 2026-11-06 (open-shop gate walk, A2): which of the logo''s 9 areas stays in frame — 1 top-left, 5 centre, 9 bottom-right (HUB_FOCAL_POINTS, lib/hub-canvas.ts). NULL = centre. Rendered through focalToObjectPosition.';
COMMENT ON COLUMN public.vendor_profiles.logo_zoom IS
  'Owner 2026-11-06 (open-shop gate walk, A2): how far into the frame the logo is pushed — 100 as uploaded, 120, 150 (HUB_ZOOMS). NULL = 100.';

-- The shop reads its own frame (nothing private); a stranger reaches no row by RLS, anon no column.
GRANT SELECT (logo_focal) ON public.vendor_profiles TO authenticated;
GRANT SELECT (logo_zoom) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (logo_focal) ON public.vendor_profiles FROM anon;
REVOKE SELECT (logo_zoom) ON public.vendor_profiles FROM anon;

-- The shop's own definer view projects every column as of its CREATE — rebuilt so it carries the new ones
-- (`lint-vendor-profiles-column-grants`; block copied from 20271303245624, unchanged).
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
