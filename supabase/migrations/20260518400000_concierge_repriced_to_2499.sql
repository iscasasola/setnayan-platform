-- ============================================================================
-- 20260518400000_concierge_repriced_to_2499.sql
--
-- Reprice Setnayan Concierge from ₱4,999 → ₱2,499 per CLAUDE.md decision
-- log row 415 (2026-05-18, Sixth 2026-05-18 row — "Setnayan Concierge
-- wizard architecture locked + price drop ₱4,999 → ₱2,499"). The earlier
-- migration 20260518000000_v1_concierge_pay_flat_and_charm.sql seeded
-- concierge_complete at 499,900 centavos before the price-drop decision
-- was locked later the same day.
--
-- Idempotent. Only updates if the row exists and is currently at the old
-- price (so re-applying the migration is a no-op).
-- ============================================================================

BEGIN;

UPDATE public.service_catalog
SET
  price_centavos = 249900,
  updated_at = NOW()
WHERE sku_code = 'concierge_complete'
  AND price_centavos = 499900;

COMMIT;
