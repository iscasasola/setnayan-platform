-- vendor_package_item_pricing_basis
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CHECK constraints inline on the ADD COLUMN (no bare ALTER … ADD CONSTRAINT).
--
-- ============================================================================
-- VENDOR PROPOSAL MAKER — PR 2 (schema). See
-- Vendor_Proposal_Maker_2026-07-10.md § "PR 2 · Schema + resolver".
--
-- Today `vendor_packages` / `vendor_package_items` are FLAT: the package carries
-- one `total_price_centavos` and each line item carries a single
-- `replacement_value_centavos` — there is no per-line pricing basis, so a bundle
-- can't say "catering is per-pax, coverage is per-hour, bridal car is flat".
--
-- This migration brings the SAME pricing bases that already exist on
-- `vendor_services` (pricing_basis fixed|per_pax|per_hour, per-pax rate + min,
-- per-hour base/min/extra, crew-meal + transport handling — see migration
-- 20270502342558) down onto the package LINE ITEMS, so the bundle maker's
-- resolver can price each line against the event's real pax + hours.
--
-- Naming note: vendor_services stores its per-pax / per-hour money in *whole
-- pesos* (per_pax_price_php, hour_base_php, …). vendor_package_items already
-- stores money in *centavos* (replacement_value_centavos), so the new money
-- columns here follow the package convention and are named *_centavos.
--
-- ADDITIVE + DEFAULTED — every existing row keeps behaving EXACTLY as before:
--   • pricing_basis DEFAULT 'fixed'  → the flat replacement_value_centavos path,
--     unchanged.
--   • crew_meal_mode DEFAULT 'included' / transport_mode DEFAULT 'included'
--     → no crew credit, no transport add — the existing flat total is untouched.
--   • all money columns nullable → no backfill required.
--
-- This PR is SCHEMA ONLY. The pure resolver helpers land alongside in
-- apps/web/lib/package-line-pricing.ts, but the REWIRING of the existing
-- customization / cascade-lock call sites (computeCustomization,
-- resolvePackageLineItems, the bundle maker) to consume these columns is a
-- LATER PR — nothing in this migration or its sibling helper file changes any
-- existing flat call site.
-- ============================================================================

ALTER TABLE public.vendor_package_items
  -- How this line is priced. Existing rows = 'fixed' (their
  -- replacement_value_centavos IS the line total; the resolver returns it as-is).
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'fixed'
    CHECK (pricing_basis IN ('fixed', 'per_pax', 'per_hour')),

  -- Per-pax basis: rate per guest (centavos) + the minimum pax floor. Line total
  -- = per_pax_price_centavos × max(pax, min_pax).
  ADD COLUMN IF NOT EXISTS per_pax_price_centavos INTEGER
    CHECK (per_pax_price_centavos IS NULL OR per_pax_price_centavos >= 0),
  ADD COLUMN IF NOT EXISTS min_pax INTEGER
    CHECK (min_pax IS NULL OR min_pax > 0),

  -- Per-hour basis: hour_base_centavos covers min_hours; each hour beyond
  -- min_hours bills extra_hour_centavos. Line total = hour_base_centavos +
  -- max(0, hours − min_hours) × extra_hour_centavos.
  ADD COLUMN IF NOT EXISTS hour_base_centavos INTEGER
    CHECK (hour_base_centavos IS NULL OR hour_base_centavos >= 0),
  ADD COLUMN IF NOT EXISTS min_hours INTEGER
    CHECK (min_hours IS NULL OR min_hours > 0),
  ADD COLUMN IF NOT EXISTS extra_hour_centavos INTEGER
    CHECK (extra_hour_centavos IS NULL OR extra_hour_centavos >= 0),

  -- Crew-meal handling for this line (mirrors vendor_services.crew_meal_included,
  -- expanded to three modes):
  --   'included' (default) → crew meal is in the line price; no adjustment.
  --   'charge'             → crew meal billed on top: + crew_size × crew_per_head_centavos.
  --   'offset'             → couple provides the crew meal → a CREDIT of
  --                          crew_size × crew_per_head_centavos, applied by the
  --                          resolver against the FINAL payment first.
  ADD COLUMN IF NOT EXISTS crew_meal_mode TEXT NOT NULL DEFAULT 'included'
    CHECK (crew_meal_mode IN ('included', 'charge', 'offset')),
  ADD COLUMN IF NOT EXISTS crew_size INTEGER
    CHECK (crew_size IS NULL OR crew_size >= 0),
  ADD COLUMN IF NOT EXISTS crew_per_head_centavos INTEGER
    CHECK (crew_per_head_centavos IS NULL OR crew_per_head_centavos >= 0),

  -- Transport handling for this line (mirrors vendor_services.transport_included
  -- / transport_flat_fee_php):
  --   'included' (default) → transport is in the line price.
  --   'flat'               → add transport_flat_centavos on top.
  --   'distance'           → quote-by-distance (no fixed figure; resolver adds ₱0).
  ADD COLUMN IF NOT EXISTS transport_mode TEXT NOT NULL DEFAULT 'included'
    CHECK (transport_mode IN ('included', 'flat', 'distance')),
  ADD COLUMN IF NOT EXISTS transport_flat_centavos INTEGER
    CHECK (transport_flat_centavos IS NULL OR transport_flat_centavos >= 0);

-- ── Column documentation ────────────────────────────────────────────────────
COMMENT ON COLUMN public.vendor_package_items.pricing_basis IS
  'How this package line is priced: fixed (replacement_value_centavos as-is) | per_pax (per_pax_price_centavos × max(pax, min_pax)) | per_hour (hour_base_centavos + max(0, hours − min_hours) × extra_hour_centavos). Mirrors vendor_services.pricing_basis. Additive — existing rows = fixed. Vendor Proposal Maker PR 2.';
COMMENT ON COLUMN public.vendor_package_items.crew_meal_mode IS
  'Crew-meal handling: included (default, in the line price) | charge (add crew_size × crew_per_head_centavos) | offset (couple provides → a credit of the same amount, applied against the final payment first). Mirrors vendor_services.crew_meal_included, expanded.';
COMMENT ON COLUMN public.vendor_package_items.transport_mode IS
  'Transport handling: included (default) | flat (add transport_flat_centavos) | distance (quote-by-distance, adds ₱0). Mirrors vendor_services.transport_included / transport_flat_fee_php.';
