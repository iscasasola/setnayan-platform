-- =============================================================================
-- 20260631000000_v2_pricing_table_alignment.sql
-- Align V2 catalogs to the owner-supplied canonical pricing table 2026-05-28.
-- =============================================================================
--
-- Two parts:
--
--   PART A · Customer catalog corrections to platform_retail_catalog_v2
--   - Pakanta price 3499 → 1499 (owner directive · supersedes the 2026-05-17
--     ₱3,499 lock + the 2026-05-28 "pakanta 3499 - i just forgot but let us
--     keep it" framing · latest spec wins)
--   - 8 is_token_able flips per the screenshot's "Token Worthy" column:
--       ANIMATED_MONOGRAM: FALSE → TRUE
--       PRO_WEBSITE:       FALSE → TRUE
--       PABATI:            TRUE  → FALSE
--       PAPIC_GUEST:       FALSE → TRUE
--       PAPIC_GUEST_STORIES: FALSE → TRUE
--       PAPIC_MEDIA_PACK:  FALSE → TRUE
--       CAMERA_BRIDGE:     TRUE  → FALSE
--       PAKANTA:           TRUE  → FALSE
--
--   PART B · New vendor_billing_catalog table + 7 SKUs
--   Per blueprint Part 2 § 1 + § 2 owner-supplied screenshot:
--   - 2 subscription tiers (Pro Vendor / Enterprise · monthly)
--   - 5 bidding token packs (4 / 10 / 25 / 50 / 100 tokens)
--
-- NON-DESTRUCTIVE · zero V1 surface touched. Pilot 2026-06-01 unaffected.
-- /pricing page rewrite + V1 service_catalog customer-side retirement +
-- setnayan_pay_methods retirement are explicitly DEFERRED to the next
-- session per V2_REPLACEMENT_NEXT_SESSION_2026-05-28.md (they have to
-- ship coordinated to not break the live V1 booking checkout).
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A · platform_retail_catalog_v2 corrections
-- =============================================================================

-- Pakanta price + is_token_able correction
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 1499.00,
       is_token_able    = FALSE
 WHERE service_code = 'PAKANTA';

-- Flip is_token_able TRUE for items the owner marked Token Worthy
UPDATE public.platform_retail_catalog_v2
   SET is_token_able = TRUE
 WHERE service_code IN (
   'ANIMATED_MONOGRAM',
   'PRO_WEBSITE',
   'PAPIC_GUEST',
   'PAPIC_GUEST_STORIES',
   'PAPIC_MEDIA_PACK'
 );

-- Flip is_token_able FALSE for items NOT marked Token Worthy
UPDATE public.platform_retail_catalog_v2
   SET is_token_able = FALSE
 WHERE service_code IN (
   'PABATI',
   'CAMERA_BRIDGE'
 );

-- =============================================================================
-- PART B · vendor_billing_catalog (new V2 table for vendor-side SKUs)
-- =============================================================================
-- Mirrors platform_retail_catalog_v2's shape but adds vendor-specific
-- columns: offering_type discriminates subscription vs token_pack,
-- token_grant_count captures pack size, max_categories + max_sub_seats
-- enforce the Pro / Enterprise tier limits at the application layer.

CREATE TABLE IF NOT EXISTS public.vendor_billing_catalog (
  sku_code           TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  price_php          NUMERIC(10, 2) NOT NULL CHECK (price_php > 0),
  offering_type      TEXT NOT NULL CHECK (offering_type IN ('subscription_monthly', 'token_pack')),
  token_grant_count  INT CHECK (token_grant_count IS NULL OR token_grant_count > 0),
  max_categories     INT CHECK (max_categories IS NULL OR max_categories > 0),
  max_sub_seats      INT CHECK (max_sub_seats IS NULL OR max_sub_seats >= 0),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  display_order      INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Shape invariants:
  --   subscription_monthly → max_categories + max_sub_seats meaningful · token_grant_count NULL
  --   token_pack           → token_grant_count meaningful · max_categories + max_sub_seats NULL
  CONSTRAINT vendor_billing_shape CHECK (
    (offering_type = 'subscription_monthly' AND token_grant_count IS NULL)
    OR
    (offering_type = 'token_pack' AND max_categories IS NULL AND max_sub_seats IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS vendor_billing_catalog_active_idx
  ON public.vendor_billing_catalog(is_active, display_order)
  WHERE is_active = TRUE;

COMMENT ON TABLE public.vendor_billing_catalog IS
  'V2 vendor-side billing catalog · subscription tiers + bidding token packs. Per blueprint Part 2 § 1-2 + owner-supplied canonical pricing 2026-05-28. Pro / Enterprise tier caps + token-pack grant counts enforced at the application layer (read this table at purchase time and gate the resulting vendor_wallets / subscription updates accordingly).';

-- Seed the 7 V2 vendor SKUs
INSERT INTO public.vendor_billing_catalog
  (sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order)
VALUES
  -- Subscription tiers (max_categories NULL on Enterprise = unlimited multi-category)
  -- (max_sub_seats NULL on Enterprise = unlimited sub-accounts)
  ('pro_vendor_monthly',        'Pro Vendor (Monthly)',        1999.00, 'subscription_monthly', NULL, 1,    5,    10),
  ('enterprise_vendor_monthly', 'Enterprise Vendor (Monthly)', 5499.00, 'subscription_monthly', NULL, NULL, NULL, 20),
  -- Bidding token packs · token_grant_count = # tokens deposited into vendor_wallets.purchased_tokens
  ('vendor_token_pack_4',       '4 Bidding Tokens',            1000.00, 'token_pack',   4,   NULL, NULL, 30),
  ('vendor_token_pack_10',      '10 Bidding Tokens',           2400.00, 'token_pack',   10,  NULL, NULL, 40),
  ('vendor_token_pack_25',      '25 Bidding Tokens',           5500.00, 'token_pack',   25,  NULL, NULL, 50),
  ('vendor_token_pack_50',      '50 Bidding Tokens',          10000.00, 'token_pack',   50,  NULL, NULL, 60),
  ('vendor_token_pack_100',     '100 Bidding Tokens',         18000.00, 'token_pack',   100, NULL, NULL, 70)
ON CONFLICT (sku_code) DO UPDATE SET
  title             = EXCLUDED.title,
  price_php         = EXCLUDED.price_php,
  offering_type     = EXCLUDED.offering_type,
  token_grant_count = EXCLUDED.token_grant_count,
  max_categories    = EXCLUDED.max_categories,
  max_sub_seats     = EXCLUDED.max_sub_seats,
  display_order     = EXCLUDED.display_order,
  updated_at        = NOW();

-- RLS · public read (vendor pricing is non-secret) · admin write only
ALTER TABLE public.vendor_billing_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_billing_catalog_public_read ON public.vendor_billing_catalog;
CREATE POLICY vendor_billing_catalog_public_read
  ON public.vendor_billing_catalog FOR SELECT
  USING (TRUE);

-- Service role bypasses RLS for admin writes · no explicit INSERT/UPDATE policy
-- needed for client-side (no client writes this table directly).

COMMIT;

-- =============================================================================
-- VERIFICATION:
--
-- -- (1) Pakanta is now ₱1,499 + is_token_able=FALSE:
-- SELECT service_code, retail_price_php, is_token_able
--   FROM platform_retail_catalog_v2 WHERE service_code='PAKANTA';
--
-- -- (2) Token Worthy column matches the canonical screenshot:
-- SELECT service_code, is_token_able FROM platform_retail_catalog_v2
--  ORDER BY is_token_able DESC, service_code;
-- -- 8 TRUE rows expected: ANIMATED_MONOGRAM · PRO_WEBSITE · PATIKTOK_COMPILER ·
-- -- PAPIC_GUEST · PAPIC_GUEST_STORIES · PAPIC_MEDIA_PACK · PAPIC_SEATS · PANOOD_SYSTEM ·
-- -- SDE · LIVE_WALL = 10 rows. (Per the screenshot: 11 Token Worthy items
-- -- counting Guided Pack + Media Pack which live in platform_package_catalog.)
--
-- -- (3) vendor_billing_catalog has 7 rows:
-- SELECT sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats
--   FROM vendor_billing_catalog ORDER BY display_order;
-- =============================================================================
