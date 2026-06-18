-- add events monogram studio config column
--
-- Phase 5 of the monogram overhaul: the Vector Monogram Studio (real font
-- outlines · per-crossing boolean interlock · mirrored fountain-pen frame ·
-- stamped symbols). Like the Cipher editor it produces ONE designed mark and
-- saves the rendered SVG to events.monogram_custom_svg (the single canonical
-- mark every surface reads — chrome icon, QR centre, landing hero, save-the-
-- date, PDFs, social cards). This column is the re-editable SOURCE so the
-- couple can re-open the studio with their composition intact — the studio
-- sibling of events.monogram_cipher_config.
--
-- When the studio owns the mark it clears monogram_cipher_config +
-- monogram_custom_generation_id (one source owns monogram_custom_svg at a
-- time). RLS is already enabled on events (couple-membership policies); a new
-- nullable column inherits them, so no policy change is needed.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_studio_config jsonb;

COMMENT ON COLUMN public.events.monogram_studio_config IS
  'Re-editable source for the Vector Monogram Studio (Phase 5). When present alongside monogram_custom_svg, the saved mark came from the studio. Sibling of monogram_cipher_config; mutually exclusive with it and monogram_custom_generation_id.';
