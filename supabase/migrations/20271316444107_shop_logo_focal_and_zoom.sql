-- shop_logo_focal_and_zoom
-- ============================================================================
-- 🖼 A SHOP'S LOGO KEEPS ITS FRAME (owner, the 2026-11-06 /open-shop gate walk: logo "zoom and align"; reshaped
-- 2026-11-07, prototype v21 `open_shop_redesign_2026-11-06/open-shop-redesign.html`, plan
-- PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07 track A3: "drag and pinch to zoom", "change and save automatically").
--
-- 🔁 RESHAPED BEFORE IT EVER SHIPPED. The first cut of this file (PR #7345 / #7351) stored the Maker's 9-point keypad
-- (`logo_focal` 1–9) and a 3-step zoom (`logo_zoom` 100 · 120 · 150). It was never on `main`, so it was never
-- applied to production; the keypad was replaced by drag + pinch in the same PR, and this file now says what ships.
--
-- THREE columns, beside `logo_url`, so moving the frame never needs a re-upload — `lib/photo-frame.ts`:
--   logo_focal_x — object-position x, 0–100 (%). NULL = 50 (centred).
--   logo_focal_y — object-position y, 0–100 (%). NULL = 50 (centred).
--   logo_zoom    — 100–300 (%): 100 = the picture just covers the circle, 300 = 3×. NULL = 100.
-- Whole numbers. With object-fit: cover and the zoom scaled about the same point, every value in these ranges
-- keeps the circle full, so the CHECKs are exactly the ranges: a value outside them is refused at the boundary
-- rather than drawn as a guess (the reader, `readLogoFrame`, drops it to the default too).
--
-- Written only by the shop's manager through the app (`updateVendorProfileField` field=logo — the "Add your logo"
-- screen's autosave and My Shop's logo row — service role after the ownership check).
--
-- 🔒 GRANTS: `authenticated` holds column-scoped SELECT on vendor_profiles (20271217955839), so the columns are
-- granted to it by name (rows stay RLS-scoped) and the shop's definer view `vendor_profiles_self` is rebuilt to
-- project them (`lint-vendor-profiles-column-grants`). NOT granted to anon: the public shop page reads with the
-- service role (`app/v/[slug]/page.tsx`), and widening the anon column set (20271014385411) is not this change.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS logo_focal_x SMALLINT,
  ADD COLUMN IF NOT EXISTS logo_focal_y SMALLINT,
  ADD COLUMN IF NOT EXISTS logo_zoom SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_logo_focal_x_chk') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_logo_focal_x_chk CHECK (logo_focal_x IS NULL OR logo_focal_x BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_logo_focal_y_chk') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_logo_focal_y_chk CHECK (logo_focal_y IS NULL OR logo_focal_y BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_profiles_logo_zoom_chk') THEN
    ALTER TABLE public.vendor_profiles
      ADD CONSTRAINT vendor_profiles_logo_zoom_chk CHECK (logo_zoom IS NULL OR logo_zoom BETWEEN 100 AND 300);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_profiles.logo_focal_x IS
  'Owner 2026-11-07 (prototype v21, A3 — drag + pinch): the logo''s object-position x, 0–100 %. NULL = 50 (centred). lib/photo-frame.ts; drawn through logoFrameStyle.';
COMMENT ON COLUMN public.vendor_profiles.logo_focal_y IS
  'Owner 2026-11-07 (prototype v21, A3 — drag + pinch): the logo''s object-position y, 0–100 %. NULL = 50 (centred). lib/photo-frame.ts; drawn through logoFrameStyle.';
COMMENT ON COLUMN public.vendor_profiles.logo_zoom IS
  'Owner 2026-11-07 (prototype v21, A3 — drag + pinch): the logo''s zoom, 100–300 % (100 = just covers the circle, 300 = 3×), scaled about its focal point. NULL = 100.';

-- The shop reads its own frame (nothing private); a stranger reaches no row by RLS, anon no column.
GRANT SELECT (logo_focal_x) ON public.vendor_profiles TO authenticated;
GRANT SELECT (logo_focal_y) ON public.vendor_profiles TO authenticated;
GRANT SELECT (logo_zoom) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (logo_focal_x) ON public.vendor_profiles FROM anon;
REVOKE SELECT (logo_focal_y) ON public.vendor_profiles FROM anon;
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
