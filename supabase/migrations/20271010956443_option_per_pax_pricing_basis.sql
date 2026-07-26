-- ════════════════════════════════════════════════════════════════════════════
-- CHOICE OPTIONS GAIN A PRICING BASIS — "+₱150/head", the normal PH upgrade.
--
-- From `Vendor_Package_Credit_BUILD_SPEC_2026-07-26.md` M2:
--   "Options now carry a pricing basis. A flat delta cannot express 'premium
--    delicacy, +₱150/head', the normal PH catering upgrade."
--
-- ⚠ M2 expresses this as `CREATE TABLE IF NOT EXISTS vendor_package_item_options`,
-- which is a SILENT NO-OP — the table shipped in 20271006413374, so the three
-- new columns would never have been created while the migration still reported
-- success. This is the ALTER form the spec's reconciliation block calls for, and
-- it keeps the SHIPPED column names (`option_label`, `is_available`).
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
-- M2 also marks the deltas SIGNED (negative = a downgrade credit). That is an
-- OPEN OWNER DECISION: 20271006413374 refused negative deltas on purpose — "a
-- downgrade credit … would let a REQUIRED line mint credit, so it is refused at
-- the DB until an owner explicitly asks for it" — and the owner has not asked.
-- Per-head upgrades do not need it, so both money columns are CHECKed >= 0,
-- exactly like the flat delta beside them.
--
-- Mirrors the basis convention already shipped for package LINES in
-- `lib/package-line-pricing.ts`: billable pax = max(event pax, min_pax).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_package_item_options
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS per_pax_delta_centavos BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_pax INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_pricing_basis_ck;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_pricing_basis_ck
  CHECK (pricing_basis IN ('fixed', 'per_pax'));

-- Same direction as the flat delta: no negative money until the owner rules on
-- downgrade credits.
ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_per_pax_delta_nonneg;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_per_pax_delta_nonneg
  CHECK (per_pax_delta_centavos >= 0);

ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_min_pax_nonneg;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_min_pax_nonneg
  CHECK (min_pax >= 0);

-- The DEFAULT option is the baseline the package price already pays for, so it
-- must cost nothing extra on EITHER basis. The shipped CHECK covered only the
-- flat delta; without this a vendor could mark "+₱150/head" as the standard
-- option and every couple would silently owe the uplift.
ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_default_is_free;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_default_is_free
  CHECK (is_default = FALSE
         OR (price_delta_centavos = 0 AND per_pax_delta_centavos = 0));

-- Keep the money on the basis that is actually in force, so a reader can never
-- pick the wrong column. A non-default per_pax option must carry a real rate:
-- a ₱0/head "upgrade" reads as an upgrade in the UI and charges nothing.
ALTER TABLE public.vendor_package_item_options
  DROP CONSTRAINT IF EXISTS vendor_package_item_options_basis_matches_money;
ALTER TABLE public.vendor_package_item_options
  ADD CONSTRAINT vendor_package_item_options_basis_matches_money
  CHECK (
    (pricing_basis = 'fixed'   AND per_pax_delta_centavos = 0)
    OR
    (pricing_basis = 'per_pax' AND price_delta_centavos = 0
       AND (per_pax_delta_centavos > 0 OR is_default))
  );

COMMENT ON COLUMN public.vendor_package_item_options.pricing_basis IS
  'fixed = price_delta_centavos is the whole uplift. per_pax = the uplift is '
  'per_pax_delta_centavos x max(event pax, min_pax). Mirrors the LINE basis '
  'convention in lib/package-line-pricing.ts.';

COMMENT ON COLUMN public.vendor_package_item_options.per_pax_delta_centavos IS
  'Per-head uplift in centavos when pricing_basis = per_pax. NON-NEGATIVE: '
  'negative (downgrade-credit) deltas remain refused until the owner asks, the '
  'same rule as price_delta_centavos.';

COMMENT ON COLUMN public.vendor_package_item_options.min_pax IS
  'Billing floor for a per_pax option: billable pax = max(event pax, min_pax).';
