-- =============================================================================
-- 20261228000213_add_monogram_uploaded_svg_column.sql
--
-- "Upload your own monogram" — owner rule 2026-06-15: when a couple uploads
-- THEIR OWN monogram in the Monogram Maker, it OVERRULES every Setnayan mark
-- (the Cipher / Bespoke-AI `monogram_custom_svg` AND the lettered lockup).
--
-- One nullable column on `events`, holding the uploaded mark as sanitized,
-- render-ready SVG MARKUP — the exact same shape + storage model as
-- `monogram_custom_svg` (migration 20261112000000), so it renders inline
-- everywhere the custom mark already does (chrome icon, website hero, maker
-- preview, PDFs) with zero presigned-URL plumbing:
--   • a real SVG upload is stored sanitized (lib sanitizeBespokeSvg allowlist —
--     no scripts/handlers/foreignObject), and
--   • a raster upload (PNG/JPG/WEBP) is downscaled (sharp -> 512px webp) and
--     wrapped in `<svg><image href="data:image/webp;base64,..."/></svg>`,
--   so the stored value is ALWAYS inert SVG markup (~20-80KB, same magnitude as
--   the bespoke marks already stored inline + queried on every events read).
--
-- Render precedence (resolved in app code, NOT here): a non-null
-- monogram_uploaded_svg is fed into the existing custom-mark slot as
-- `monogram_uploaded_svg ?? monogram_custom_svg`, so it wins on every surface
-- the custom mark renders. Clearing it (Maker "Remove") falls back to the
-- bespoke/cipher mark, then the lettered lockup -- so there is never a second
-- monogram, only one active mark.
--
-- RLS: none needed -- `events` already has its couple-scoped policies; this is
-- one more nullable display column on an already-protected row. ON DELETE of
-- the event carries it away (RA 10173 erasure is intrinsic).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_uploaded_svg text;

COMMENT ON COLUMN public.events.monogram_uploaded_svg IS
  'Couple-uploaded monogram (sanitized inline SVG markup; raster uploads are sharp-downscaled + wrapped as <svg><image/>). Top-priority custom mark -- overrules monogram_custom_svg and the lettered lockup everywhere. NULL = no upload. Owner rule 2026-06-15.';
