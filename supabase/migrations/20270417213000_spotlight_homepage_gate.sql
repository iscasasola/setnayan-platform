-- Spotlight Awards — public homepage strip owner gate.
--
--   spotlight_homepage_enabled — owner master switch for the PUBLIC marketing
--                                homepage Spotlight strip. OFF by default:
--                                featuring vendors on the live homepage needs
--                                explicit owner sign-off, so NOTHING renders on
--                                the homepage until the owner flips this TRUE
--                                (AND an admin has flagged at least one award
--                                row is_homepage_featured on
--                                vendor_spotlight_awards — migration
--                                20270321399479). Two independent locks:
--                                per-row curation (admin) + this global switch
--                                (owner).
--
-- This is a second, coarser gate ON TOP of the existing per-row
-- is_homepage_featured flag — the owner can dark the whole strip without
-- un-featuring individual vendors. Additive + defaulted; platform_settings
-- already enables RLS (public read of the single settings row is fine — this is
-- a non-secret display toggle; all writes stay admin-only via the existing
-- policies), so no policy change is required here.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS spotlight_homepage_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_settings.spotlight_homepage_enabled IS
  'Owner master switch for the PUBLIC homepage Spotlight strip. FALSE by '
  'default — the strip renders nothing until the owner flips this on AND an '
  'admin has flagged award rows is_homepage_featured. Featuring vendors '
  'publicly requires owner sign-off.';
