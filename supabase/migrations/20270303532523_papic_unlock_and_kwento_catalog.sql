-- 20270303532523_papic_unlock_and_kwento_catalog.sql
--
-- WHY (owner-locked 2026-06-26): a Papic "Unlock all" bundle at ₱15,000 that
-- grants EVERY Papic add-on (Kwento · Photo Wall/LIVE_WALL · Thank You ·
-- Stories · Pabati · Camera Bridge) PLUS free, uncapped Unli cameras. À-la-carte
-- the add-ons + a maxed Unli camera spend run higher, so ₱15,000 is a discount
-- and the hard ceiling on Papic spend.
--
-- This migration lands the two catalog rows + the Kwento grandfather column the
-- app code (PR same branch) reads. Two follow-on concerns handled in code, not
-- here:
--   • bundle→child membership for PAPIC_UNLOCK lives in the 3-way mirror
--     (lib/entitlements.ts BUNDLE_CHILD_SKUS · onboarding-pricing.ts
--     BUNDLE_MEMBERS · bundles_granting_sku() in the companion migration
--     20270303010000_papic_unlock_bundle_aware.sql) — enforced by
--     scripts/lint-entitlement-gates.mjs.
--   • the uncapped-Unli capture grant is an entitlement bypass in the per-camera
--     capture gate (owns PAPIC_UNLOCK ⇒ every Unli-tier seat shoots free), not a
--     provisioned-seat row here.
--
-- ⚠ PRICING NOTE (owner sign-off · provisional per the standing "all prices
-- provisional, holistic pass later" rule): PAPIC_UNLOCK ₱15,000 is owner-set.
-- KWENTO ₱1,499 is a PROVISIONAL standalone price chosen here so the SKU is a
-- real, sellable, admin-editable row — adjust in /admin/pricing during the
-- holistic pass. Kwento was a FREE feature; turning it paid is owner-authorized
-- (2026-06-26) and rolls out NEW-EVENTS-ONLY (existing events grandfathered free
-- via events.kwento_free_grandfathered below) so no current couple loses it.
--
-- Idempotent (ON CONFLICT / ADD COLUMN IF NOT EXISTS). Additive — no row delete,
-- no behavior change for à-la-carte buyers. NOT AUTO-APPLIED: owner runs
-- `supabase db push --db-url "$SUPABASE_DB_URL"`.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PAPIC_UNLOCK — the ₱15,000 "Unlock all" bundle. Lives in the bundle table
--    (platform_package_catalog · keyed by package_code, flat-priced), same as
--    GUIDED_PACK / MEDIA_PACK. The checkout path re-prices ANY package_code
--    authoritatively (resolveBundleChargeCentavos → retail_price_php × 100), so
--    no checkout-code change is needed — an InlineCheckoutDrawer keyed
--    service_key='PAPIC_UNLOCK' charges ₱15,000 from this row.
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_package_catalog (package_code, title, retail_price_php, description)
VALUES (
  'PAPIC_UNLOCK',
  'Papic Unlock All',
  15000.00,
  'Every Papic add-on — Kwento, Photo Wall, Thank You film, Guest Stories, Pabati, Camera Bridge — plus unlimited Unli cameras, bundled at one price. The hard ceiling on your Papic spend.'
)
ON CONFLICT (package_code) DO UPDATE SET
  title            = EXCLUDED.title,
  retail_price_php = EXCLUDED.retail_price_php,
  description      = EXCLUDED.description,
  is_active        = TRUE,
  updated_at       = now();

-- ---------------------------------------------------------------------------
-- 2. KWENTO — Kwento becomes a real, sellable customer SKU so the bundle can
--    grant it and (new events) can buy it. Provisional ₱1,499 (admin-editable).
--    is_pax_priced defaults FALSE (flat) · is_token_able FALSE. saas overhead ~0
--    (text feature · the only marginal cost is the message rows it stores).
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, is_active, description)
VALUES (
  'KWENTO',
  'Kwento — Guest Stories Wall',
  1499.00,
  0.00,
  FALSE,
  TRUE,
  'Your guests write the story behind every photo — a living wedding gazette of captions and columns, couple-approved, woven into your gallery and recap.'
)
ON CONFLICT (service_code) DO UPDATE SET
  title            = EXCLUDED.title,
  retail_price_php = EXCLUDED.retail_price_php,
  description      = EXCLUDED.description,
  is_active        = TRUE,
  updated_at       = now();

-- ---------------------------------------------------------------------------
-- 3. Kwento grandfather flag — Kwento was FREE for every couple. Making it paid
--    rolls out NEW-EVENTS-ONLY (owner 2026-06-26): every event that EXISTS at
--    migration time keeps Kwento free forever; events created AFTER need the
--    KWENTO entitlement (direct order, or a bundle that grants it — incl.
--    PAPIC_UNLOCK). The gate (apps/web/app/api/papic/kwento/route.ts) reads
--    this column: kwento_free_grandfathered OR eventSkuActive(KWENTO).
--
--    New events default FALSE; existing events are flipped TRUE by the backfill
--    below, keyed to a FIXED cutover timestamp so a manual re-apply (ledger
--    drift) can NEVER wrongly grandfather an event created after the cutover.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kwento_free_grandfathered BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.kwento_free_grandfathered IS
  'TRUE = this event keeps Kwento free (grandfathered: created before the 2026-06-27 cutover when Kwento became a paid SKU). New events default FALSE and need the KWENTO entitlement (direct or via a bundle, e.g. PAPIC_UNLOCK).';

-- One-time backfill, re-run-safe: grandfather every event created before the
-- FIXED cutover literal. A fixed timestamp (not now()) means re-applying this
-- migration is idempotent — events created after the cutover stay FALSE no
-- matter how many times it runs. 2026-06-27 00:00 Manila = just past authoring,
-- so every couple live when the gate ships keeps Kwento free.
UPDATE public.events SET kwento_free_grandfathered = TRUE
WHERE created_at < TIMESTAMPTZ '2026-06-27 00:00:00+08'
  AND kwento_free_grandfathered = FALSE;

COMMIT;
