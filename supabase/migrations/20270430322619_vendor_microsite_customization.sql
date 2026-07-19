-- Vendor microsite customization (My Shop → Website editor).
--
-- Additive columns on vendor_profiles that let a vendor curate their public
-- /v/[slug] microsite ON TOP OF the auto-composed page. Every column is
-- nullable / defaulted so an un-curated vendor renders exactly as before.
-- RLS already lives on vendor_profiles (vendor-org write · public read) — these
-- columns inherit the row's existing grants, so no policy changes are needed.
--
-- FREE controls wired in this PR: microsite_about, microsite_sections,
-- microsite_featured_service_ids.
-- PRO controls (columns land now so the schema is stable; wired in a follow-up
-- PR, gated on tierCaps.customWebsiteName): hero photo, accent, featured
-- editorials, pinned review. Id-shaped columns are text/text[] to stay
-- id-representation-agnostic until those features are built.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS microsite_about text,
  ADD COLUMN IF NOT EXISTS microsite_sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS microsite_featured_service_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS microsite_hero_photo_key text,
  ADD COLUMN IF NOT EXISTS microsite_accent text,
  ADD COLUMN IF NOT EXISTS microsite_featured_editorial_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS microsite_pinned_review_id text;

-- Keep the public About copy to a sane length (an intro, not a document).
ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_microsite_about_len;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_microsite_about_len
    CHECK (microsite_about IS NULL OR char_length(microsite_about) <= 600);

COMMENT ON COLUMN public.vendor_profiles.microsite_about IS
  'Vendor microsite: 2-3 sentence About/intro shown under the hero on /v/[slug]. FREE control. <=600 chars.';
COMMENT ON COLUMN public.vendor_profiles.microsite_sections IS
  'Vendor microsite: JSONB visibility map for public sections, e.g. {"portfolio":false,"trusted_by":true,"editorials":true}. Missing key = visible (default true). FREE control. Reviews are deliberately NOT toggleable (event-bound zero-fakes trust pillar).';
COMMENT ON COLUMN public.vendor_profiles.microsite_featured_service_ids IS
  'Vendor microsite: up to 3 service leaf keys (subset of vendor_profiles.services) floated to the front of the Services list on /v/[slug]. FREE control.';
COMMENT ON COLUMN public.vendor_profiles.microsite_hero_photo_key IS
  'Vendor microsite: chosen hero photo (R2 key from portfolio, or dedicated upload). PRO control (tierCaps.customWebsiteName). Column lands here; wired in a follow-up PR.';
COMMENT ON COLUMN public.vendor_profiles.microsite_accent IS
  'Vendor microsite: accent/theme preset key (curated set, not free hex). PRO control. Column lands here; wired in a follow-up PR.';
COMMENT ON COLUMN public.vendor_profiles.microsite_featured_editorial_ids IS
  'Vendor microsite: up to 2 editorial/story ids to headline (needs the net-new editorials section). PRO control. Column lands here; wired in a follow-up PR.';
COMMENT ON COLUMN public.vendor_profiles.microsite_pinned_review_id IS
  'Vendor microsite: one review id pinned to the top of the Reviews section. PRO control. Column lands here; wired in a follow-up PR.';
