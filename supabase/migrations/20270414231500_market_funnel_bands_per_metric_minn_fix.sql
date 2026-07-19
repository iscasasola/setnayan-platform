-- Fix-forward for #2511 (Category Benchmarks vs Peers): per-metric min-N guard.
--
-- BUG (adversarial review 2026-07-01, HIGH · RA 10173 / de-identification):
-- recompute_market_funnel_bands() gated the bucket on its DISTINCT-vendor
-- sample_n only. Each metric's percentile has its own FILTER (WHERE m IS NOT
-- NULL), so a bucket could clear the >=3-vendor floor while a single metric had
-- just ONE non-null peer — percentile_cont over one value returns
-- p25=p50=p75 = that vendor's EXACT raw number, surfaced to every other Pro+
-- vendor as the "peer median", de-anonymizing a single competitor.
--
-- FIX: guard EACH metric's percentiles on its OWN distinct-vendor non-null
-- count (>= v_floor); below the floor the metric's edges are NULL and the TS
-- reader already renders "not enough peer data yet". Also wipe any already-
-- materialized bands so a previously-leaked single-peer edge cannot linger
-- (the table is admin-recompute-populated and typically empty at this stage).
-- Everything else (peers CTE, region resolve, pax bucket, bucket-level
-- min_n_ok on sample_n, admin gate, pinned search_path) is byte-identical.

CREATE OR REPLACE FUNCTION public.recompute_market_funnel_bands()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor   INT;
  v_written INT;
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;

  SELECT GREATEST(COALESCE(ps.radar_min_n_floor, 3), 3)
    INTO v_floor
    FROM public.platform_settings ps
   WHERE ps.id = 1;
  v_floor := GREATEST(COALESCE(v_floor, 3), 3);

  DELETE FROM public.market_funnel_bands;

  WITH peers AS (
    SELECT DISTINCT
      vs.category                                    AS category,
      COALESCE(
        (SELECT r.slug FROM public.regions r
          WHERE LOWER(r.psgc_code) = LOWER(vp.hq_region)
             OR LOWER(r.slug)      = LOWER(vp.hq_region)
          LIMIT 1),
        NULLIF(vp.hq_region, '')
      )                                              AS region_slug,
      public.price_band_pax_bucket(vp.capacity_max)  AS pax_bucket,
      vp.vendor_profile_id                           AS vendor_profile_id,
      vas.response_rate_pct::NUMERIC                 AS reply_rate,
      NULLIF(vas.avg_response_minutes, 0)::NUMERIC   AS reply_mins,
      vas.inquiry_to_booking_pct::NUMERIC            AS conversion
    FROM public.vendor_services vs
    JOIN public.vendor_profiles vp
      ON vp.vendor_profile_id = vs.vendor_profile_id
    JOIN public.vendor_activity_stats vas
      ON vas.vendor_profile_id = vp.vendor_profile_id
    WHERE vs.is_active = TRUE
      AND vs.category IS NOT NULL
  ),
  scoped AS (
    SELECT * FROM peers
    WHERE category IS NOT NULL
      AND region_slug IS NOT NULL
  ),
  bands AS (
    SELECT
      category,
      region_slug,
      pax_bucket,
      -- Per-metric min-N: only emit a percentile when >= v_floor DISTINCT peers
      -- have that metric; otherwise NULL (renders as "not enough peer data").
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_rate IS NOT NULL) >= v_floor
           THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY reply_rate) FILTER (WHERE reply_rate IS NOT NULL) END AS reply_rate_p25,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_rate IS NOT NULL) >= v_floor
           THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY reply_rate) FILTER (WHERE reply_rate IS NOT NULL) END AS reply_rate_p50,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_rate IS NOT NULL) >= v_floor
           THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY reply_rate) FILTER (WHERE reply_rate IS NOT NULL) END AS reply_rate_p75,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_mins IS NOT NULL) >= v_floor
           THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY reply_mins) FILTER (WHERE reply_mins IS NOT NULL) END AS reply_mins_p25,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_mins IS NOT NULL) >= v_floor
           THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY reply_mins) FILTER (WHERE reply_mins IS NOT NULL) END AS reply_mins_p50,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE reply_mins IS NOT NULL) >= v_floor
           THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY reply_mins) FILTER (WHERE reply_mins IS NOT NULL) END AS reply_mins_p75,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE conversion IS NOT NULL) >= v_floor
           THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY conversion) FILTER (WHERE conversion IS NOT NULL) END AS conversion_p25,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE conversion IS NOT NULL) >= v_floor
           THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY conversion) FILTER (WHERE conversion IS NOT NULL) END AS conversion_p50,
      CASE WHEN COUNT(DISTINCT vendor_profile_id) FILTER (WHERE conversion IS NOT NULL) >= v_floor
           THEN percentile_cont(0.75) WITHIN GROUP (ORDER BY conversion) FILTER (WHERE conversion IS NOT NULL) END AS conversion_p75,
      COUNT(DISTINCT vendor_profile_id) AS sample_n
    FROM scoped
    GROUP BY category, region_slug, pax_bucket
  )
  INSERT INTO public.market_funnel_bands
    (category, region_slug, pax_bucket,
     reply_rate_p25, reply_rate_p50, reply_rate_p75,
     reply_mins_p25, reply_mins_p50, reply_mins_p75,
     conversion_p25, conversion_p50, conversion_p75,
     sample_n, computed_at)
  SELECT
    category, region_slug, pax_bucket,
    ROUND(reply_rate_p25), ROUND(reply_rate_p50), ROUND(reply_rate_p75),
    ROUND(reply_mins_p25), ROUND(reply_mins_p50), ROUND(reply_mins_p75),
    ROUND(conversion_p25), ROUND(conversion_p50), ROUND(conversion_p75),
    sample_n,
    NOW()
  FROM bands
  WHERE public.min_n_ok(sample_n::INT, v_floor);

  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$$;

-- Clear any bands already materialized under the leaky function so a
-- single-peer edge can't persist; the next admin recompute rebuilds safely.
DELETE FROM public.market_funnel_bands;
