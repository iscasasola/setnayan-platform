-- ============================================================================
-- 20260607020000_vendor_market_stats_setnayan_first.sql
--
-- Owner directive 2026-05-22 PM (verbatim): "Setnayan will always be on top
-- of all services when there is a service of setnayan."
--
-- Adds a boolean `is_setnayan_service` column to `vendor_market_stats` so
-- PostgREST can ORDER BY it DESC ahead of `ad_rank` + the user's chosen
-- sort. First-party Setnayan services (Papic, Panood, Pailaw, Patiktok,
-- Pakanta, Concierge, Custom Monogram, Save-the-Date Video, AI Edited
-- Highlight) float to the top of every marketplace search where they
-- appear in the filtered set.
--
-- The 10 first-party canonical_service keys are listed in
-- apps/web/lib/taxonomy.ts with `setnayan: true`. We mirror that list
-- here as a hard-coded array; both surfaces must update in lockstep
-- if a new SETNAYAN service is added. Acceptable for V1 (10 canonicals
-- · stable list); V2 could move the source of truth into a
-- canonical_service_schemas column.
--
-- Idempotent — CREATE OR REPLACE VIEW so the column add is a single
-- recompute. No downstream materialized view depends on this view's
-- shape (it's read directly by the /vendors page query).
-- ============================================================================

CREATE OR REPLACE VIEW public.vendor_market_stats
WITH (security_invoker = true) AS
SELECT
  vp.vendor_profile_id,
  vp.public_id,
  vp.business_name,
  vp.business_slug,
  vp.tagline,
  vp.logo_url,
  vp.services,
  vp.location_city,
  vp.hq_latitude,
  vp.hq_longitude,
  vp.contact_email,
  vp.public_visibility,
  vp.event_types,
  vp.compatible_ceremony_types,
  vp.compatible_venue_settings,
  vp.created_at,
  COALESCE(vrs.avg_rating_overall, 0)::NUMERIC(3,2) AS avg_rating_overall,
  COALESCE(vrs.total_count, 0)::INT                 AS review_count,
  CASE
    WHEN vaa.tier = 'sponsored' THEN 2
    WHEN vaa.tier = 'boosted'   THEN 1
    ELSE 0
  END::INT                                           AS ad_rank,
  -- 2026-05-22 PM: Setnayan-first sort key. TRUE when the vendor carries
  -- any first-party Setnayan canonical_service in its services[] array.
  -- The marketplace query orders by this DESC ahead of ad_rank so SETNAYAN
  -- vendors float above paid sponsors when both are present.
  (vp.services && ARRAY[
    'setnayan_concierge',
    'setnayan_papic',
    'setnayan_panood',
    'setnayan_patiktok',
    'setnayan_pakanta',
    'setnayan_pailaw',
    'setnayan_custom_monogram',
    'setnayan_save_the_date_mp4',
    'setnayan_ai_edited_highlight',
    'setnayan_ai_video_highlight'
  ]::TEXT[]) AS is_setnayan_service,
  vaa.tier        AS ad_tier,
  vaa.sku_code    AS ad_sku_code,
  vaa.radius_km   AS ad_radius_km,
  vaa.expires_at  AS ad_expires_at
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

COMMENT ON COLUMN public.vendor_market_stats.is_setnayan_service IS
  'TRUE when vendor offers any first-party Setnayan canonical_service. Marketplace orders DESC so Setnayan floats above paid sponsors. Source of truth: apps/web/lib/taxonomy.ts entries with `setnayan: true`.';
