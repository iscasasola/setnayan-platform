-- ════════════════════════════════════════════════════════════════════════════
-- Retire 4 customer SKUs — owner-decided 2026-06-08.
-- Resolves the "confirm" flag from the 2026-06-08 canonical reprice: the owner
-- confirmed these 4 are retired customer-facing (Papic Guests STAYS pax-priced
-- ₱2,999 — NOT changed here).
--
-- Targets the live V2 customer catalog (platform_retail_catalog_v2). is_active
-- only (rows preserved — event_software_activations_v2 FK-references service_code;
-- verified 0 orders reference these). Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.platform_retail_catalog_v2 SET is_active = false, updated_at = now()
WHERE service_code IN ('HIGH_RES_ARCHIVE', 'CALL_TIME_ESCALATOR', 'INDOOR_BLUEPRINT', 'PAKULAY')
  AND is_active = true;

COMMIT;
