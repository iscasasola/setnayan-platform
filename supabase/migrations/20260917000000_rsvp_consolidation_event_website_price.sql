-- ════════════════════════════════════════════════════════════════════════════
-- RSVP consolidation + Event Website price — owner-decided 2026-06-08.
--   (1) "RSVP Pro replaces RSVP" → retire RSVP_WEBSITE ("RSVP"), keep
--       RSVP_PRO_WEBSITE ("RSVP Pro").
--   (2) Event Website → ₱1,999.
-- Catalog-only (platform_retail_catalog_v2). is_active flip preserves the row for
-- the activations FK (verified 0 orders reference RSVP_WEBSITE). Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.platform_retail_catalog_v2 SET is_active = false, updated_at = now()
WHERE service_code = 'RSVP_WEBSITE' AND is_active = true;

UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 1999, updated_at = now()
WHERE service_code = 'EVENT_WEBSITE';

COMMIT;
