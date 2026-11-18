-- gift_cart_orders_and_the_payment_max
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- SUPPLIER GIFTS · THE STORE — ONE ORDER, MANY GIFTS, PAID ONCE (owner-approved
-- prototype gifts-interactive v16, 2026-11-17: "any mix of singles and bundles
-- in ONE order, paid once") · THE MOST IN ONE PAYMENT (owner 2026-11-17,
-- verbatim: "We do not allow transactions above 100,000.").
--
-- `shop_gift_purchases` is keyed on order_id — ONE line per order. A cart needs
-- N lines under one order, the shape every multi-line order in this repo uses
-- (one header row + N line rows keyed by order, each with its own quantity and
-- a unit price SNAPSHOT from the catalogue at mint time).
--
--   1. platform_settings.max_payment_php — the most one payment may be, an
--      ADMIN setting (Admin › Settings › Payment methods, savePaymentInstruments
--      intent 'max_payment_save', audited). Seeded 100000 from the owner's
--      ruling above. The buy action refuses an order above it, server-side.
--   2. shop_gift_order_lines — what one STORE order bought, line by line: the
--      gift (service_code), a bundle when it was one (bundle_code), how many,
--      packs per unit, credits per pack, the unit price read from the catalogue
--      and the line total. RLS at CREATE: the shop reads its own (the same
--      pattern as shop_gift_purchases), admin reads all; no session writes.
--   3. shop_gift_stock_entries.purchase_line_no — which line a 'bought' /
--      'reversal' row lands. 0 = a single-line order (every row before this
--      migration, and every order still minted through shop_gift_purchases).
--      The one-per-order unique index becomes one-per-(order, kind, line): a
--      3-line order lands 3 rows, a re-approval still lands nothing twice.
--   4. shop_gift_grant_order_lines(order, actor) — THE ONE DOOR that lands a
--      store order: every line once, in one transaction, and only when the
--      lines add up to exactly what the order charged. Idempotent.
--   5. shop_gift_reverse_order_lines(order, actor) — a refunded / un-approved
--      store order takes back exactly what each line landed, once.
--   Both doors are service_role only (lib/sku-activation.ts on admin approval);
--   the machine never approves money — approval stays the admin's.
--
-- Nothing applied before this is edited. The single-line path
-- (shop_gift_purchases → grantShopGiftPurchase) is untouched and keeps working.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

-- ── 1 · the most in one payment ─────────────────────────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS max_payment_php NUMERIC(12,2) NOT NULL DEFAULT 100000;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_max_payment_php_positive;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_max_payment_php_positive
  CHECK (max_payment_php > 0);

COMMENT ON COLUMN public.platform_settings.max_payment_php IS
  'The most one payment may be, in pesos (owner 2026-11-17, verbatim: "We do not allow transactions above 100,000."). '
  'Seeded 100000. Read by lib/max-payment.server.ts; the supplier gift store and its buy action refuse an order above it. '
  'Written only from Admin › Settings › Payment methods (savePaymentInstruments, audited as max_payment_php_edit).';

-- ── 2 · what one store order bought, line by line ───────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_gift_order_lines (
  line_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL
                      REFERENCES public.orders(order_id) ON DELETE CASCADE,
  line_no           SMALLINT NOT NULL
                      CONSTRAINT shop_gift_order_lines_line_no_range
                      CHECK (line_no BETWEEN 1 AND 50),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The couple product that lands in stock (a platform_retail_catalog_v2.service_code).
  service_code      TEXT NOT NULL
                      CONSTRAINT shop_gift_order_lines_service_code_shape
                      CHECK (length(btrim(service_code)) > 0),
  gift_kind         TEXT NOT NULL
                      CONSTRAINT shop_gift_order_lines_gift_kind_allowed
                      CHECK (gift_kind IN ('papic', 'event_plus', 'event_pro', 'event_ultra')),
  -- The bundle's own catalogue code when this line bought a 10 + 1 bundle.
  bundle_code       TEXT
                      CONSTRAINT shop_gift_order_lines_bundle_code_shape
                      CHECK (bundle_code IS NULL OR bundle_code ~ '^GIFT_BUNDLE_[A-Z0-9_]+$'),
  quantity          INTEGER NOT NULL
                      CONSTRAINT shop_gift_order_lines_quantity_range
                      CHECK (quantity BETWEEN 1 AND 100),
  -- Packs ONE unit lands: 1 for a single gift, the bundle's bundle_quantity (11) for a bundle.
  packs_each        INTEGER NOT NULL
                      CONSTRAINT shop_gift_order_lines_packs_each_range
                      CHECK (packs_each BETWEEN 1 AND 1000),
  -- Papic credits ONE pack carries (papic_pass_tiers.points at mint), or 1 for an unlock.
  credits_per_pack  INTEGER NOT NULL
                      CONSTRAINT shop_gift_order_lines_credits_per_pack_positive
                      CHECK (credits_per_pack > 0),
  -- What ONE unit cost, read from the catalogue at mint (retail_price_php, or the bundle's own price).
  unit_price_php    NUMERIC(12,2) NOT NULL
                      CONSTRAINT shop_gift_order_lines_unit_price_positive
                      CHECK (unit_price_php > 0),
  price_basis       TEXT NOT NULL
                      CONSTRAINT shop_gift_order_lines_price_basis_allowed
                      CHECK (price_basis IN ('list', 'bundle')),
  line_total_php    NUMERIC(12,2) GENERATED ALWAYS AS (unit_price_php * quantity) STORED,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shop_gift_order_lines_order_line_unique UNIQUE (order_id, line_no),
  -- A bundle line says so twice (its code and its basis); a single line says neither.
  CONSTRAINT shop_gift_order_lines_bundle_matches_basis CHECK (
    (bundle_code IS NULL AND price_basis = 'list' AND packs_each = 1)
    OR (bundle_code IS NOT NULL AND price_basis = 'bundle')
  ),
  -- An unlock is one per pack.
  CONSTRAINT shop_gift_order_lines_unlock_is_one CHECK (gift_kind = 'papic' OR credits_per_pack = 1)
);

CREATE INDEX IF NOT EXISTS shop_gift_order_lines_shop_idx
  ON public.shop_gift_order_lines (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.shop_gift_order_lines IS
  'One line of a supplier GIFT STORE order (owner-approved prototype 2026-11-17: any mix of singles and 10 + 1 bundles '
  'in ONE order, paid once). One orders row (service_key vendor_gift__GIFT_CART) + N lines. Each line snapshots the '
  'catalogue price at mint. Approval lands every line once through shop_gift_grant_order_lines. Written only by the '
  'buy action (buyVendorPapicPortfolioPack, for=gift_cart).';

ALTER TABLE public.shop_gift_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_gift_order_lines_vendor_read ON public.shop_gift_order_lines;
CREATE POLICY shop_gift_order_lines_vendor_read
  ON public.shop_gift_order_lines
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.shop_gift_order_lines FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.shop_gift_order_lines FROM authenticated;

-- ── 3 · which line a stock row lands ────────────────────────────────────────
ALTER TABLE public.shop_gift_stock_entries
  ADD COLUMN IF NOT EXISTS purchase_line_no SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.shop_gift_stock_entries
  DROP CONSTRAINT IF EXISTS shop_gift_stock_entries_purchase_line_no_range;
ALTER TABLE public.shop_gift_stock_entries
  ADD CONSTRAINT shop_gift_stock_entries_purchase_line_no_range
  CHECK (purchase_line_no BETWEEN 0 AND 50);

COMMENT ON COLUMN public.shop_gift_stock_entries.purchase_line_no IS
  'On a bought / reversal row: the shop_gift_order_lines.line_no it lands (1..50), or 0 for a single-line order '
  '(shop_gift_purchases). Part of the one-per-(order, kind, line) unique index.';

-- One bought (or reversal) row per (order, kind, line). Every row before this
-- migration is line 0, so the old one-per-order rule holds for them unchanged.
CREATE UNIQUE INDEX IF NOT EXISTS shop_gift_stock_entries_order_kind_line_unique
  ON public.shop_gift_stock_entries (order_id, kind, purchase_line_no)
  WHERE order_id IS NOT NULL;
DROP INDEX IF EXISTS public.shop_gift_stock_entries_order_kind_unique;

-- ── 4 · the one door that lands a store order ───────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_gift_grant_order_lines(p_order_id UUID, p_actor UUID)
 RETURNS TABLE (lines_total INTEGER, lines_landed INTEGER)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_shop   UUID;
  v_total  NUMERIC(12,2);
  v_n      INTEGER;
  v_sum    NUMERIC(12,2);
  v_landed INTEGER := 0;
  v_rows   INTEGER;
  r        RECORD;
BEGIN
  -- The order row is locked so two approvals at once land in turn, never twice.
  SELECT o.vendor_profile_id, o.requested_total_php
    INTO v_shop, v_total
    FROM public.orders o
   WHERE o.order_id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shop_gift_grant_order_lines: order % not found', p_order_id;
  END IF;

  SELECT count(*)::INTEGER, COALESCE(sum(l.line_total_php), 0)
    INTO v_n, v_sum
    FROM public.shop_gift_order_lines l
   WHERE l.order_id = p_order_id;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'shop_gift_grant_order_lines: order % has no lines', p_order_id;
  END IF;
  -- The money check: the lines must add up to exactly what the order charged.
  IF v_sum IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'shop_gift_grant_order_lines: order % lines add up to % but the order is %', p_order_id, v_sum, v_total;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shop_gift_order_lines l
     WHERE l.order_id = p_order_id AND l.vendor_profile_id IS DISTINCT FROM v_shop
  ) THEN
    RAISE EXCEPTION 'shop_gift_grant_order_lines: order % has a line for another shop', p_order_id;
  END IF;

  FOR r IN
    SELECT l.* FROM public.shop_gift_order_lines l WHERE l.order_id = p_order_id ORDER BY l.line_no
  LOOP
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, order_id, purchase_line_no, pack_code, packs, note, created_by)
    VALUES (
      r.vendor_profile_id,
      r.gift_kind,
      r.quantity * r.packs_each * r.credits_per_pack,
      'bought',
      p_order_id,
      r.line_no,
      CASE WHEN r.gift_kind = 'papic' THEN r.service_code END,
      CASE WHEN r.gift_kind = 'papic' THEN r.quantity * r.packs_each END,
      'Gifts bought · line ' || r.line_no || ' · ' || r.quantity || ' × ' || COALESCE(r.bundle_code, r.service_code),
      p_actor
    )
    ON CONFLICT (order_id, kind, purchase_line_no) WHERE order_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_landed := v_landed + v_rows;
  END LOOP;

  RETURN QUERY SELECT v_n, v_landed;
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_grant_order_lines(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_grant_order_lines(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.shop_gift_grant_order_lines(UUID, UUID) IS
  'Lands every line of a gift STORE order in the shop''s gift stock, once (one bought row per line, '
  'purchase_line_no = line_no). Refuses when the lines do not add up to orders.requested_total_php. Returns '
  '(lines on the order, lines landed by THIS call) — a re-approval lands 0. service_role only (lib/sku-activation.ts).';

-- ── 5 · a refunded store order takes back exactly what each line landed ─────
CREATE OR REPLACE FUNCTION public.shop_gift_reverse_order_lines(p_order_id UUID, p_actor UUID)
 RETURNS INTEGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_back INTEGER := 0;
  v_rows INTEGER;
  b      RECORD;
BEGIN
  PERFORM 1 FROM public.orders o WHERE o.order_id = p_order_id FOR UPDATE;
  FOR b IN
    SELECT e.* FROM public.shop_gift_stock_entries e
     WHERE e.order_id = p_order_id AND e.kind = 'bought' AND e.purchase_line_no > 0 AND e.delta > 0
     ORDER BY e.purchase_line_no
  LOOP
    INSERT INTO public.shop_gift_stock_entries
      (vendor_profile_id, gift_kind, delta, kind, order_id, purchase_line_no, pack_code, packs, note, created_by)
    VALUES (
      b.vendor_profile_id,
      b.gift_kind,
      -b.delta,
      'reversal',
      p_order_id,
      b.purchase_line_no,
      CASE WHEN b.pack_code IS NOT NULL AND b.packs IS NOT NULL THEN b.pack_code END,
      CASE WHEN b.pack_code IS NOT NULL AND b.packs IS NOT NULL THEN -b.packs END,
      'Gift order refunded or un-approved · line ' || b.purchase_line_no,
      p_actor
    )
    ON CONFLICT (order_id, kind, purchase_line_no) WHERE order_id IS NOT NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_back := v_back + v_rows;
  END LOOP;
  RETURN v_back;
END;
$function$;

REVOKE ALL ON FUNCTION public.shop_gift_reverse_order_lines(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_gift_reverse_order_lines(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.shop_gift_reverse_order_lines(UUID, UUID) IS
  'Takes back, once, every line a gift STORE order landed (one reversal row per landed line). Returns the rows taken '
  'back by THIS call. service_role only (lib/sku-activation.ts on refund / un-approval).';

COMMIT;
