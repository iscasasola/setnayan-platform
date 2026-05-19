-- ============================================================================
-- 20260519220000_iteration_0018_pricing_resolver_fn.sql
--
-- PR 2 of 8 for V1 iteration 0018 Setnayan Supplies (curated reseller).
-- Spec corpus: 0018_supplies_marketplace/0018_supplies_marketplace.md
--   § "Pricing rule — lowest-available-wholesale wins (locked 2026-05-19)"
-- Engineering brief PR 2.
--
-- Ships the canonical Postgres resolver function for the supplies pricing
-- engine. The TS lib at apps/web/lib/supplies/pricing.ts is a thin
-- supabase.rpc() wrapper around this function.
--
-- Why a SQL function (vs all logic in TS):
--   • One SQL statement does the JOIN + filter + volume-tier resolution +
--     retail computation; no round-trip per candidate vendor.
--   • Indexable: the planner uses supplier_vendor_sku_pricing_lookup_idx
--     (sku_id, service_area_code, wholesale_centavos) for the candidate
--     filter and ORDER BY.
--   • Callable from anywhere — server actions, API routes, future cron jobs,
--     admin SQL diagnostics — without duplicating logic.
--   • Atomic snapshot semantics: the function reads supplier rows + pricing
--     + volume tiers in a single transaction, so concurrent vendor pricing
--     updates don't yield a partial view.
--
-- Behavior:
--   Input:  p_sku_code (logical, shared across vendors)
--           p_service_area_code
--           p_quantity
--   Output: 0 or 1 row. Empty result = no available supplier (UI shows
--           "Coming to your area soon"). 1 row = cheapest available vendor's
--           snapshot ready to lock into supplies_order_line_items.
--
--   Resolution rule (locked 2026-05-19):
--     1. Find all supplier_vendor_skus rows with sku_code=p_sku_code that
--        are active + vendor is_supplier_vendor=TRUE.
--     2. INNER JOIN supplier_vendor_sku_pricing on (sku_id, service_area_code)
--        where today is within effective_from/to AND min_order_quantity<=p_quantity.
--     3. For each candidate, compute effective_wholesale considering volume
--        tiers (cheapest tier with min_qty<=p_quantity wins; falls back to
--        base wholesale_centavos if no tier matches).
--     4. Order all candidates by effective_wholesale ASC.
--     5. Pick the first. Retail = round(wholesale × 1.5 / 100) × 100
--        (rounded to the nearest peso).
--
-- Quality floor mitigation (V1):
--   Per the spec's "Quality floor mitigation" section, V1 uses SLA enforcement
--   via the wholesale agreement (suspends vendor → vendor.status flips → SKU
--   becomes invisible to this resolver). Composite reliability ranking
--   (weighting wholesale × reliability) is a V1.5+ enhancement — when it
--   lands, only this function changes; the TS wrapper signature stays stable.
--
-- Pure additive migration: function only. No table changes. Reversible by:
--   DROP FUNCTION IF EXISTS public.resolve_supplies_pricing(text, text, integer);
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_supplies_pricing(
  p_sku_code TEXT,
  p_service_area_code TEXT,
  p_quantity INTEGER
)
RETURNS TABLE (
  sku_id UUID,
  vendor_profile_id UUID,
  category TEXT,
  display_name TEXT,
  unit_of_measure TEXT,
  base_wholesale_centavos INTEGER,
  effective_wholesale_centavos INTEGER,
  retail_centavos INTEGER,
  volume_tier_applied JSONB,
  service_area_code TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      svs.sku_id,
      svs.vendor_profile_id,
      svs.category,
      svs.display_name,
      svs.unit_of_measure,
      svsp.wholesale_centavos AS base_wholesale,
      svsp.volume_tiers,
      -- Resolve effective wholesale by finding the highest min_qty tier
      -- that p_quantity satisfies. Fall back to base if no tier matches.
      COALESCE(
        (
          SELECT (tier->>'wholesale_centavos')::INTEGER
          FROM jsonb_array_elements(COALESCE(svsp.volume_tiers, '[]'::jsonb)) tier
          WHERE (tier->>'min_qty')::INTEGER <= p_quantity
          ORDER BY (tier->>'min_qty')::INTEGER DESC
          LIMIT 1
        ),
        svsp.wholesale_centavos
      ) AS effective_wholesale,
      -- Snapshot of which tier (if any) was applied. NULL when fallback to base.
      (
        SELECT tier
        FROM jsonb_array_elements(COALESCE(svsp.volume_tiers, '[]'::jsonb)) tier
        WHERE (tier->>'min_qty')::INTEGER <= p_quantity
        ORDER BY (tier->>'min_qty')::INTEGER DESC
        LIMIT 1
      ) AS tier_applied
    FROM public.supplier_vendor_skus svs
    INNER JOIN public.vendor_profiles vp
      ON vp.vendor_profile_id = svs.vendor_profile_id
    INNER JOIN public.supplier_vendor_sku_pricing svsp
      ON svsp.sku_id = svs.sku_id
    WHERE svs.sku_code = p_sku_code
      AND svs.is_active = TRUE
      AND vp.is_supplier_vendor = TRUE
      AND svsp.service_area_code = p_service_area_code
      AND svsp.effective_from <= v_today
      AND (svsp.effective_to IS NULL OR svsp.effective_to >= v_today)
      AND svsp.min_order_quantity <= p_quantity
  )
  SELECT
    c.sku_id,
    c.vendor_profile_id,
    c.category,
    c.display_name,
    c.unit_of_measure,
    c.base_wholesale::INTEGER AS base_wholesale_centavos,
    c.effective_wholesale::INTEGER AS effective_wholesale_centavos,
    -- Retail = wholesale × 1.5 rounded to nearest peso (100 centavos).
    -- Casting via NUMERIC keeps the rounding deterministic across PG versions.
    ((ROUND((c.effective_wholesale::NUMERIC * 1.5) / 100) * 100))::INTEGER AS retail_centavos,
    c.tier_applied AS volume_tier_applied,
    p_service_area_code AS service_area_code
  FROM candidates c
  ORDER BY c.effective_wholesale ASC, c.sku_id ASC  -- stable tiebreak on identical wholesale
  LIMIT 1;
END;
$$;

-- Allow authenticated users to call the resolver. Reads are RLS-bounded by
-- the underlying tables' SELECT policies (vendors read their own rows; the
-- function runs as the calling user via STABLE + SECURITY INVOKER default).
-- Couples don't have direct SELECT on supplier_vendor_skus or
-- supplier_vendor_sku_pricing — server actions invoke this function via the
-- service-role client so couple-facing browse can compute retail without
-- exposing raw vendor data to client-side queries.
GRANT EXECUTE ON FUNCTION public.resolve_supplies_pricing(TEXT, TEXT, INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.resolve_supplies_pricing(TEXT, TEXT, INTEGER) IS
  '0018 Setnayan Supplies — lowest-available-wholesale resolver. Given (sku_code, service_area_code, quantity), returns 0 rows (no supplier available) or 1 row with the cheapest active supplier vendor''s sku_id + wholesale + computed retail (wholesale × 1.5 rounded to peso) + applied volume tier. TS wrapper at apps/web/lib/supplies/pricing.ts.';

COMMIT;
