-- papic_per_tier_caps
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- Papic per-tier price caps + Ltd/Unli rename + add-on reprice (owner 2026-06-26).
--
-- The single per-event cost cap (events.papic_cost_cap_php · ₱6,999) is replaced
-- by TWO per-tier caps so each tier locks independently:
--   • Papic Ltd  (Roll tier)       locks at ₱6,000  (≈ 200 cameras × ₱30)
--   • Papic Unli (Unlimited tier)  locks at ₱10,000 (≈ 100 cameras × ₱100)
-- Beyond the cap the price is flat — 300 guests on Ltd still pay ₱6,000.
--
-- Caps are per-event columns (admin-adjustable, like the old single cap) so they
-- stay data, never hardcoded. Unit rates stay admin-managed in
-- platform_retail_catalog_v2. The old papic_cost_cap_php column is left in place
-- (deprecated · no longer read) to avoid a destructive drop.

alter table public.events
  add column if not exists papic_ltd_cap_php  integer not null default 6000,
  add column if not exists papic_unli_cap_php integer not null default 10000;

comment on column public.events.papic_ltd_cap_php is
  'Papic Ltd (Roll) per-event price cap in PHP — owner 2026-06-26 · default 6000 (~200 cameras x 30). Beyond the cap the Ltd subtotal is flat.';
comment on column public.events.papic_unli_cap_php is
  'Papic Unli (Unlimited) per-event price cap in PHP — owner 2026-06-26 · default 10000 (~100 cameras x 100). Beyond the cap the Unli subtotal is flat.';

-- ---------------------------------------------------------------------------
-- Catalog: rename the per-camera tiers to Ltd / Unli (DISPLAY title only — the
-- service_code + the `tier` enum value stay 'roll'/'unlimited' per the
-- never-rename-technical-ids lock).
-- ---------------------------------------------------------------------------
update public.platform_retail_catalog_v2
  set title = 'Papic Ltd (per camera, per day)', updated_at = now()
  where service_code = 'PAPIC_CAMERA_ROLL_DAY';

update public.platform_retail_catalog_v2
  set title = 'Papic Unli (per camera, per day)', updated_at = now()
  where service_code = 'PAPIC_CAMERA_UNLIMITED_DAY';

-- ---------------------------------------------------------------------------
-- Catalog: reprice + rename the à-la-carte Papic add-ons (owner 2026-06-26).
-- ---------------------------------------------------------------------------
update public.platform_retail_catalog_v2
  set retail_price_php = 1500, title = 'Thank You (Papic Add-on)', updated_at = now()
  where service_code = 'PAPIC_ADDON_THANK_YOU';

update public.platform_retail_catalog_v2
  set retail_price_php = 2000, title = 'Stories (Papic Add-on)', updated_at = now()
  where service_code = 'PAPIC_ADDON_STORIES';

-- Pabati (video guestbook · up to 300×5s clips) repriced to ₱500 (owner 2026-06-26).
update public.platform_retail_catalog_v2
  set retail_price_php = 500, updated_at = now()
  where service_code = 'PABATI';

-- Camera Bridge repriced to ₱200/seat/day (owner 2026-06-26 · reverses the
-- 2026-06-18 "included with Papic, no extra cost" decision). Per-seat/day billing
-- lands with the native pairing feature (V1.5); the catalog row carries the rate.
update public.platform_retail_catalog_v2
  set retail_price_php = 200, title = 'Camera Bridge (per seat, per day)', updated_at = now()
  where service_code = 'CAMERA_BRIDGE';

-- ---------------------------------------------------------------------------
-- Catalog: retire the ₱2,999 SKUs as couple buy paths (already applied live via
-- admin edit; encoded here so a fresh DB reproduces the same catalog state).
-- ---------------------------------------------------------------------------
update public.platform_retail_catalog_v2
  set is_active = false, updated_at = now()
  where service_code in ('PAPIC_SEATS', 'PAPIC_GUEST') and is_active = true;
