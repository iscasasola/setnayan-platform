-- =============================================================================
-- 20261117000000_cipher_monogram_config.sql
--
-- Cipher Monogram editor — persist the couple's editable design (Phase 3 of
-- the monogram overhaul · owner-designed 2026-06-11/12).
--
-- The cipher editor lets the couple POSITION two initials (drag · size ·
-- rotate · mirror) and combine them as a smooth restroked pen ribbon
-- (single-line fonts), an over/under weave with adjustable knockout gap
-- (filled fonts), or a plain overlap. Fully deterministic SVG — no AI, no
-- per-use cost.
--
-- The RENDERED mark reuses events.monogram_custom_svg (20261112000000) — the
-- landing hero, maker preview and downstream surfaces already consume that
-- column. This migration adds only the EDITABLE SOURCE: the editor config,
-- so the couple can reopen + adjust their design instead of starting over.
--
-- Schema philosophy: ADDITIVE + NULLABLE + idempotent — the exact pattern of
-- 20260817000000_event_monogram_style.sql. NULL = no cipher design (the
-- typographic lockup or a bespoke-studio mark may still occupy
-- monogram_custom_svg). Zero rollback risk.
-- =============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_cipher_config JSONB
    CHECK (monogram_cipher_config IS NULL OR length(monogram_cipher_config::text) <= 8192);

COMMENT ON COLUMN public.events.monogram_cipher_config IS
  'Cipher Monogram editor state (Phase 3 monogram overhaul): {v, initials, fontKey, ink, mode overlap|restroke|weave, gap, tension, front, letters[2]{x,y,scale,rot,fx,fy}}. Validated by sanitizeCipherConfig (lib/cipher-shared.ts) before write. The rendered SVG lives on monogram_custom_svg; this column is the re-editable source. NULL = no cipher design.';

COMMIT;

-- Verification:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='events' AND column_name='monogram_cipher_config';
--   -- Expect 1 row, jsonb.
