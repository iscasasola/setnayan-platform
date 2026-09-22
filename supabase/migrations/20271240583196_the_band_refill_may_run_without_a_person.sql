-- the_band_refill_may_run_without_a_person — CTRL-B3 build 5, second half.
--
-- ── WHAT THE GUARD CAUGHT ──────────────────────────────────────────────────
-- `admin-gated-rpc-needs-a-session.test.ts` refused the new
-- `market-price-band-refill` job, and it was exactly right:
--
--   "These call an admin-gated function through the service-role client, which
--    has no auth.uid() and is REFUSED by the database — the call can never
--    succeed."
--
-- `recompute_market_price_bands()` opens with `IF NOT is_console_admin() THEN
-- RAISE EXCEPTION`, and is granted to `authenticated` only. A background job has
-- no session, so `is_console_admin()` is false and the RPC would have thrown on
-- every single run — **silently, forever**, with `cron_job_runs` recording a
-- claim each time. A job that can never succeed is worse than no job: it looks
-- like coverage.
--
-- ── THE FIX, AND WHY IT IS ONE CONDITION AND NOT A SECOND FUNCTION ─────────
-- 🔑 A sibling `..._job()` with a copied body would be TWO MECHANISMS FOR ONE
-- COMPUTATION — the defect this repo keeps meeting — and the copy would drift
-- the first time the band maths changed. So the existing function is re-created
-- with its body byte-identical and its gate widened by the repo's own
-- precedent: `IF NOT (public.is_admin() OR auth.role() = 'service_role')`,
-- the shape `admin_intelligence_analytics` has used since 2026-12.
--
-- ⚠ `service_role` is the platform's own key. It is never in a page, never in a
-- browser, and already runs `claim_periodic_job` itself. Admin console callers
-- still need `is_console_admin()`; nothing else gains reach.

CREATE OR REPLACE FUNCTION public.recompute_market_price_bands()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor   INT;
  v_written INT;
BEGIN
  -- ⚠ ONE CONDITION ADDED, 2026-09-22 (CTRL-B3 build 5). Everything else in
  -- this body is byte-identical to 20270324043850 — re-created in full
  -- because Postgres has no way to patch a function, NOT rewritten.
  IF NOT (public.is_console_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;

  -- Min-N sample floor — admin-managed via platform_settings (default 3 when
  -- the column is unset; never below 3). We hold the suppression floor at >=3
  -- so a band always reflects a real spread, even though radar_min_n_floor
  -- itself defaults to 1.
  SELECT GREATEST(COALESCE(ps.radar_min_n_floor, 3), 3)
    INTO v_floor
    FROM public.platform_settings ps
   WHERE ps.id = 1;
  v_floor := GREATEST(COALESCE(v_floor, 3), 3);

  -- Wipe + rebuild (the table is a derived cache; a full recompute is cheapest
  -- and avoids stale buckets that have dropped below the floor since last run).
  DELETE FROM public.market_price_bands;

  WITH priced AS (
    -- vendor_services: base price, no pax dimension.
    SELECT
      vs.category                                    AS category,
      COALESCE(
        (SELECT r.slug FROM public.regions r
          WHERE LOWER(r.psgc_code) = LOWER(vp.hq_region)
             OR LOWER(r.slug)      = LOWER(vp.hq_region)
          LIMIT 1),
        NULLIF(vp.hq_region, '')
      )                                              AS region_slug,
      public.price_band_pax_bucket(NULL)             AS pax_bucket,
      vs.starting_price_php::NUMERIC                 AS price_php,
      vp.vendor_profile_id                           AS vendor_profile_id
    FROM public.vendor_services vs
    JOIN public.vendor_profiles vp
      ON vp.vendor_profile_id = vs.vendor_profile_id
    WHERE vs.is_active = TRUE
      AND vs.starting_price_php IS NOT NULL
      AND vs.starting_price_php > 0
      AND vs.category IS NOT NULL

    UNION ALL

    -- vendor_packages: total price; pax = venue capacity when present.
    SELECT
      pk.primary_canonical_service                   AS category,
      COALESCE(
        (SELECT r.slug FROM public.regions r
          WHERE LOWER(r.psgc_code) = LOWER(vp.hq_region)
             OR LOWER(r.slug)      = LOWER(vp.hq_region)
          LIMIT 1),
        NULLIF(vp.hq_region, '')
      )                                              AS region_slug,
      public.price_band_pax_bucket(vp.capacity_max)  AS pax_bucket,
      (pk.total_price_centavos::NUMERIC / 100)       AS price_php,
      vp.vendor_profile_id                           AS vendor_profile_id
    FROM public.vendor_packages pk
    JOIN public.vendor_profiles vp
      ON vp.vendor_profile_id = pk.vendor_profile_id
    WHERE pk.is_active = TRUE
      AND pk.total_price_centavos > 0
      AND pk.primary_canonical_service IS NOT NULL
  ),
  scoped AS (
    SELECT * FROM priced
    WHERE category IS NOT NULL
      AND region_slug IS NOT NULL
      AND price_php > 0
  ),
  bands AS (
    SELECT
      category,
      region_slug,
      pax_bucket,
      MIN(price_php)                                              AS low_php,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price_php)      AS median_php,
      MAX(price_php)                                              AS high_php,
      COUNT(DISTINCT vendor_profile_id)                          AS sample_n
    FROM scoped
    GROUP BY category, region_slug, pax_bucket
  )
  INSERT INTO public.market_price_bands
    (category, region_slug, pax_bucket, low_php, median_php, high_php, sample_n, computed_at)
  SELECT
    category, region_slug, pax_bucket,
    ROUND(low_php),
    ROUND(median_php),
    ROUND(high_php),
    sample_n,
    NOW()
  FROM bands
  -- Behavioral min-N: only surface a band that clears the floor of distinct peers.
  WHERE public.min_n_ok(sample_n::INT, v_floor);

  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_market_price_bands() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_market_price_bands() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_market_price_bands() TO service_role;

COMMENT ON FUNCTION public.recompute_market_price_bands() IS
  'Rebuilds market_price_bands. Callable by a console admin OR by service_role, '
  'so the cron-free market-price-band-refill job can run without a person — the '
  'table was 0 rows in production because the only caller was a human pressing '
  'Recompute. Gate widened 2026-09-22; body unchanged.';
