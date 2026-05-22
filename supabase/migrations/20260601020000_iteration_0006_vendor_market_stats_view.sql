-- Iteration 0006 — marketplace read-path consolidation.
--
-- Pre-2026-05-21 the public /vendors page issued three sequential reads:
--   1) SELECT up to 2000 vendor_profiles rows (for the default sort)
--   2) SELECT vendor_review_stats for all 2000
--   3) SELECT vendor_active_ads for all 2000
-- ...then sorted them in JS and sliced the 24 visible cards. On a cold edge
-- this added ~700ms of pure server work versus a single SQL-sorted query.
--
-- vendor_market_stats joins the three sources into one read-only surface and
-- exposes a precomputed `ad_rank` so the marketplace can do its full sort
-- (Sponsored > Boosted > unboosted, then review_count or avg rating depending
-- on user-selected sort) in PostgREST with normal `.order().range()` calls.
--
-- security_invoker = true so RLS on vendor_profiles still applies when anon
-- or authenticated roles query the view directly via PostgREST; the runtime
-- marketplace uses the service-role admin client which bypasses RLS anyway.
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
  vaa.tier        AS ad_tier,
  vaa.sku_code    AS ad_sku_code,
  vaa.radius_km   AS ad_radius_km,
  vaa.expires_at  AS ad_expires_at
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_review_stats vrs USING (vendor_profile_id)
LEFT JOIN public.vendor_active_ads   vaa USING (vendor_profile_id);

GRANT SELECT ON public.vendor_market_stats TO anon, authenticated, service_role;

COMMENT ON VIEW public.vendor_market_stats IS
  'Marketplace read-path consolidation: vendor_profiles + vendor_review_stats + vendor_active_ads with precomputed ad_rank for SQL-side sort. Used by /vendors. Iteration 0006, 2026-05-21.';
