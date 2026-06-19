-- =============================================================================
-- 20270130320001_security_invoker_views.sql
-- Fix: vendor_active_tools + vendor_active_ads were created without
-- security_invoker = true, so they ran as the postgres superuser and bypassed
-- RLS on the underlying tables. Supabase Advisor flagged both as CRITICAL.
--
-- Fix: recreate both views WITH (security_invoker = true). This means calls
-- now run as the invoking role, so RLS on vendor_tool_bundles and
-- vendor_ad_subscriptions is enforced for authenticated users. The service
-- role (used by server-side code) bypasses RLS anyway, so no app impact.
-- =============================================================================

-- ---- vendor_active_tools ---------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_active_tools
  WITH (security_invoker = true)
AS
WITH bundle_expansions AS (
  SELECT
    vtb.vendor_profile_id,
    unnest(ARRAY[
      'tool_mood_board_weekly',
      'tool_seat_arrangement_weekly',
      'tool_palette_weekly',
      'tool_qr_reader_weekly',
      'tool_advanced_pricing_weekly'
    ]) AS tool_sku_code,
    vtb.expires_at,
    vtb.bundle_id AS source_bundle_id,
    'all_tools_unlock_annual'::TEXT AS source_sku_code
  FROM public.vendor_tool_bundles vtb
  WHERE vtb.sku_code = 'all_tools_unlock_annual'
    AND vtb.cancelled_at IS NULL
    AND vtb.expires_at > NOW()
),
individual_tools AS (
  SELECT
    vtb.vendor_profile_id,
    vtb.sku_code AS tool_sku_code,
    vtb.expires_at,
    vtb.bundle_id AS source_bundle_id,
    vtb.sku_code AS source_sku_code
  FROM public.vendor_tool_bundles vtb
  WHERE vtb.sku_code <> 'all_tools_unlock_annual'
    AND vtb.cancelled_at IS NULL
    AND vtb.expires_at > NOW()
)
SELECT * FROM bundle_expansions
UNION ALL
SELECT * FROM individual_tools;

-- ---- vendor_active_ads -----------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_active_ads
  WITH (security_invoker = true)
AS
WITH ranked AS (
  SELECT
    vas.vendor_profile_id,
    vas.ad_subscription_id,
    vas.sku_code,
    vas.radius_km,
    vas.expires_at,
    vas.started_at,
    CASE
      WHEN vas.sku_code IN (
        'sponsored_boost_quarterly_30km',
        'sponsored_boost_annual_30km'
      ) THEN 'sponsored'::TEXT
      ELSE 'boosted'::TEXT
    END AS tier,
    ROW_NUMBER() OVER (
      PARTITION BY vas.vendor_profile_id
      ORDER BY
        CASE
          WHEN vas.sku_code IN (
            'sponsored_boost_quarterly_30km',
            'sponsored_boost_annual_30km'
          ) THEN 2
          ELSE 1
        END DESC,
        vas.radius_km DESC,
        vas.expires_at DESC
    ) AS rn
  FROM public.vendor_ad_subscriptions vas
  WHERE vas.cancelled_at IS NULL
    AND vas.expires_at > NOW()
)
SELECT
  vendor_profile_id,
  ad_subscription_id,
  sku_code,
  tier,
  radius_km,
  started_at,
  expires_at
FROM ranked
WHERE rn = 1;
