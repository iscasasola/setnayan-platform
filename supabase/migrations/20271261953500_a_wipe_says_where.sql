-- a_wipe_says_where — three rebuilds that the API connection refused.
--
-- ── WHAT PRODUCTION SAID ────────────────────────────────────────────────────
-- The Problems log (`app_fault_issues`, kind DB_WRITE_REFUSED) holds, open:
--
--   POST rpc/refresh_demand_radar_rollups   "DELETE requires a WHERE clause"
--   POST rpc/recompute_market_price_bands   "DELETE requires a WHERE clause"
--
-- Supabase loads the `safeupdate` library for every connection the API
-- (PostgREST) makes, and it refuses any DELETE or UPDATE with no WHERE — even
-- one inside a SECURITY DEFINER function, even in a CTE. Each of these
-- functions rebuilds a derived table by wiping it first with a bare
-- `DELETE FROM <table>`, so EVERY call through `supabase.rpc(...)` — the
-- background refill job, the vendor-side throttled refresh, the admin "Run
-- now" button — threw before writing a row. The tables stayed empty and looked
-- like "no data yet".
--
-- The local replay (PGlite) has no `safeupdate`, so every db test of these
-- functions passed while production refused them. The guard for this lives
-- in apps/web/tests/db/a-wipe-says-where.db.test.ts, which reads every
-- function body the replay ends with and fails on any unqualified write.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- Each function is re-created from its LATEST definition with ONE change: the
-- wipe reads `DELETE FROM <table> WHERE true`. Same rows deleted (all of
-- them), same transaction, same gate, same return value — `WHERE true` is the
-- spelling safeupdate itself documents for "yes, every row". Every other line
-- is byte-identical to the source named above each function. CREATE OR
-- REPLACE keeps each function's grants and comment.
--
--   refresh_demand_radar_rollups  ← 20270324631500_demand_radar_rollups.sql
--   recompute_market_price_bands  ← 20271240583196_the_band_refill_may_run_without_a_person.sql
--   recompute_market_funnel_bands ← 20270414231500_market_funnel_bands_per_metric_minn_fix.sql
--
-- The third has not reached the Problems log only because nobody has pressed
-- its admin "Run now" since; it carries the identical bare wipe and would be
-- refused identically. A scan of every public function body after the full
-- replay found no other unqualified DELETE or UPDATE.

-- ← 20270324631500_demand_radar_rollups.sql
CREATE OR REPLACE FUNCTION public.refresh_demand_radar_rollups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  -- Gate: admin console OR the service role (the vendor-side throttled refresh
  -- runs through a service-role client; the admin "Run now" runs as an admin).
  IF NOT (
    public.is_console_admin()
    OR (SELECT auth.role()) = 'service_role'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Rebuild atomically. The three demand surfaces each anchor on the host
  -- event's (region, month, event_type, style) so the rollup dimensions are
  -- consistent across all counts. created_at is the fallback month anchor when
  -- the couple hasn't set a date yet.
  WITH ev AS (
    SELECT
      e.event_id,
      COALESCE(NULLIF(btrim(e.region), ''), '')                                AS region,
      date_trunc('month', COALESCE(e.event_date, e.created_at::date))::date     AS month_bucket,
      COALESCE(NULLIF(btrim(e.event_type), ''), 'unspecified')                  AS event_type,
      COALESCE(NULLIF(btrim(e.papic_style), ''), 'ORIG')                        AS style
    FROM public.events e
  ),
  inq AS (  -- inquiries: a couple opened a thread to a vendor
    SELECT ev.region, ev.month_bucket, ev.event_type, ev.style, COUNT(*)::INTEGER AS c
    FROM public.chat_threads ct
    JOIN ev ON ev.event_id = ct.event_id
    GROUP BY 1,2,3,4
  ),
  unl AS (  -- unlocks: a vendor paid to answer this event (strong demand proxy)
    SELECT ev.region, ev.month_bucket, ev.event_type, ev.style, COUNT(*)::INTEGER AS c
    FROM public.vendor_event_unlocks veu
    JOIN ev ON ev.event_id = veu.event_id
    GROUP BY 1,2,3,4
  ),
  bok AS (  -- bookings: couple committed (contracted and beyond)
    SELECT ev.region, ev.month_bucket, ev.event_type, ev.style, COUNT(*)::INTEGER AS c
    FROM public.event_vendors evd
    JOIN ev ON ev.event_id = evd.event_id
    WHERE evd.status IN ('contracted','deposit_paid','delivered','complete')
    GROUP BY 1,2,3,4
  ),
  keys AS (  -- the union of every (dim) that any surface saw
    SELECT region, month_bucket, event_type, style FROM inq
    UNION SELECT region, month_bucket, event_type, style FROM unl
    UNION SELECT region, month_bucket, event_type, style FROM bok
  ),
  rolled AS (
    SELECT
      k.region, k.month_bucket, k.event_type, k.style,
      COALESCE(inq.c, 0) AS inquiry_count,
      COALESCE(unl.c, 0) AS unlock_count,
      COALESCE(bok.c, 0) AS booking_count
    FROM keys k
    LEFT JOIN inq USING (region, month_bucket, event_type, style)
    LEFT JOIN unl USING (region, month_bucket, event_type, style)
    LEFT JOIN bok USING (region, month_bucket, event_type, style)
  ),
  wiped AS (
    -- 2026-10-03: `WHERE true` — the same full wipe, said out loud, because
    -- the API connection refuses an unqualified DELETE (see header).
    DELETE FROM public.demand_radar_rollups WHERE true RETURNING 1
  ),
  inserted AS (
    INSERT INTO public.demand_radar_rollups
      (region, month_bucket, event_type, style, inquiry_count, unlock_count, booking_count, refreshed_at)
    SELECT region, month_bucket, event_type, style, inquiry_count, unlock_count, booking_count, now()
    FROM rolled
    -- Reference `wiped` so the DELETE CTE is guaranteed to run before the INSERT.
    WHERE (SELECT COUNT(*) FROM wiped) >= 0
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM inserted)::INTEGER INTO v_rows;

  RETURN COALESCE(v_rows, 0);
END;
$$;

-- ← 20271240583196_the_band_refill_may_run_without_a_person.sql
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
  -- 2026-10-03: `WHERE true` — the same full wipe, said out loud, because
  -- the API connection refuses an unqualified DELETE (see header).
  DELETE FROM public.market_price_bands WHERE true;

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

-- ← 20270414231500_market_funnel_bands_per_metric_minn_fix.sql
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

  -- 2026-10-03: `WHERE true` — the same full wipe, said out loud, because
  -- the API connection refuses an unqualified DELETE (see header).
  DELETE FROM public.market_funnel_bands WHERE true;

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
