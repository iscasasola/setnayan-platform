-- Panood gets its OWN camera bridge SKU (owner 2026-06-26): "we will also add
-- camera bridge here [Panood] 200/camera". Separate from Papic's existing
-- CAMERA_BRIDGE (which stays ₱100/seat/day) — the two verticals price the bridge
-- independently.
--
-- PANOOD_CAMERA_BRIDGE = connect a DSLR / external camera into the Panood multicam
-- control room, ₱200 per camera, per day. (The phone-camera QR join inside the
-- ₱4,999/day controller stays free; this is the extra-cost path for a non-phone
-- camera.)
--
-- Applied live to platform_retail_catalog_v2 via SQL (db push creds stale); this
-- mirrors it for rebuild/push parity. Idempotent upsert.

BEGIN;

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES
  ('PANOOD_CAMERA_BRIDGE', 'Panood Camera Bridge (per camera, per day)', 200, 0, false, true,
   'Connect a DSLR / external camera into the Panood multicam control room — ₱200 per camera, per day. Separate from the free phone-camera QR join and from Papic''s own camera bridge.')
ON CONFLICT (service_code) DO UPDATE
  SET title            = EXCLUDED.title,
      retail_price_php = EXCLUDED.retail_price_php,
      is_active        = EXCLUDED.is_active,
      description      = EXCLUDED.description;

COMMIT;
