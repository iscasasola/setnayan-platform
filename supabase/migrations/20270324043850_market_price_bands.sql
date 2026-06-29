-- ============================================================================
-- 20270324043850_market_price_bands.sql
-- Price-Position Meter (Wave 6 vendor benefit · the last "Soon" one).
--
-- Gives a vendor an honest read on where their own price sits inside the
-- market for the same (category, region, pax_bucket): low / median / high of
-- the published peers, and the vendor's percentile inside that band.
--
-- WHY A PRE-COMPUTED BAND TABLE (not a live aggregate per page-load)
-- -----------------------------------------------------------------
-- The aggregation scans every PUBLISHED vendor_packages + vendor_services row,
-- joins region + category + (for venues) capacity, and computes 3 quantiles per
-- bucket. That's an admin-cadence rollup, not a per-request query. We CACHE it
-- in market_price_bands and recompute on an admin "run now" (cron-free, per
-- [[project_setnayan_cron_free]] — no polling cron). A vendor card reads ONE
-- row.
--
-- BEHAVIORAL MIN-N (the "honesty floor")
-- --------------------------------------
-- A band is only stored / surfaced when it has at least the platform min-N
-- sample floor of distinct peers (public.min_n_ok(count, floor); floor from
-- platform_settings.radar_min_n_floor, else a sane default). Below the floor we
-- do NOT write the band → the vendor sees "not enough market data yet" rather
-- than a fabricated range built from one or two peers. Founder-only today, so
-- nearly every bucket is below the floor and suppressed — that is the EXPECTED
-- correct behavior, not a bug.
--
-- ADMIN-MANAGED, NEVER HARDCODED
-- ------------------------------
-- Mirrors token_burn_bands: the numbers live in a table, recomputed from real
-- vendor prices and reviewed/triggered at /admin/price-bands. No band value is
-- hardcoded in code; the meter reads the table.
--
-- WHAT THIS MIGRATION ADDS:
--   1. price_band_pax_bucket(INT)        — the canonical pax-bucket function
--                                          (pax lock: 100 floor + per-50 → '500+'),
--                                          '__all__' for the no-pax-dimension bucket.
--   2. market_price_bands (table)        — the cached low/median/high per
--                                          (category, region_slug, pax_bucket) + sample_n.
--                                          RLS at CREATE: authenticated SELECT, admin WRITE.
--   3. recompute_market_price_bands()    — SECURITY DEFINER admin-gated rollup
--                                          that rebuilds the table from PUBLISHED
--                                          prices, suppressing sub-floor buckets.
-- KEEP IDEMPOTENT (CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE · DROP POLICY
-- IF EXISTS then CREATE).
-- ============================================================================

BEGIN;

-- ── 1 · Canonical pax-bucket function ───────────────────────────────────────
-- Per the pax-based-pricing lock (owner 2026-06-01): a 100-pax FLOOR (nothing
-- lower) + buckets per additional 50 up to a '500+' ceiling. Anything below 100
-- floors to '100'. NULL pax (a price with no guest-count dimension — most
-- categories' base price) lands in the '__all__' bucket so it still bands by
-- (category, region). IMMUTABLE so it can be used in expressions/indexes.
CREATE OR REPLACE FUNCTION public.price_band_pax_bucket(p_pax INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_pax IS NULL  THEN '__all__'
    WHEN p_pax >= 500   THEN '500+'
    WHEN p_pax <= 100   THEN '100'
    -- snap UP to the next 50-step above the 100 floor: 101-150 → '150', etc.
    ELSE (CEIL(p_pax::NUMERIC / 50) * 50)::INT::TEXT
  END;
$$;

COMMENT ON FUNCTION public.price_band_pax_bucket(INT) IS
  'Canonical Price-Position pax bucket (pax lock 2026-06-01): 100 floor (anything <=100 → "100"), then per-50 steps (150,200,…,450) up to the "500+" ceiling. NULL pax → "__all__" (no guest-count dimension). IMMUTABLE.';

-- ── 2 · The cached band table ───────────────────────────────────────────────
-- One row per (category, region_slug, pax_bucket) that cleared the min-N floor.
-- Prices are PHP (not centavos) to match starting_price_php; package totals are
-- normalised from centavos at recompute time.
CREATE TABLE IF NOT EXISTS public.market_price_bands (
  category     TEXT        NOT NULL,
  region_slug  TEXT        NOT NULL,
  pax_bucket   TEXT        NOT NULL,
  low_php      NUMERIC     NOT NULL CHECK (low_php >= 0),
  median_php   NUMERIC     NOT NULL CHECK (median_php >= 0),
  high_php     NUMERIC     NOT NULL CHECK (high_php >= 0),
  sample_n     INT         NOT NULL CHECK (sample_n >= 0),
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, region_slug, pax_bucket)
);

CREATE INDEX IF NOT EXISTS market_price_bands_cat_region_idx
  ON public.market_price_bands (category, region_slug);

ALTER TABLE public.market_price_bands ENABLE ROW LEVEL SECURITY;

-- Public read for any authenticated user — a vendor's meter (and a couple-side
-- read, if ever wired) reads their (category, region, bucket) band. Bands are
-- de-identified aggregates (low/median/high + a count), no peer identity, and
-- only surface above the min-N floor, so the read is safe.
DROP POLICY IF EXISTS market_price_bands_read ON public.market_price_bands;
CREATE POLICY market_price_bands_read
  ON public.market_price_bands FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin-only write (mirror token_burn_bands_admin_write). The recompute RPC is
-- SECURITY DEFINER and bypasses RLS, but this also lets an admin correct a row
-- by hand if ever needed.
DROP POLICY IF EXISTS market_price_bands_admin_write ON public.market_price_bands;
CREATE POLICY market_price_bands_admin_write
  ON public.market_price_bands FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid()
      AND (u.is_internal OR u.is_team_member OR u.account_type = 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid()
      AND (u.is_internal OR u.is_team_member OR u.account_type = 'admin')
  ));

-- ── 3 · The recompute rollup ────────────────────────────────────────────────
-- Rebuilds market_price_bands from PUBLISHED vendor prices. Aggregates two price
-- sources into one normalised (category, region, pax, price_php, vendor) set:
--   • vendor_services  — category = vendor_services.category, price =
--     starting_price_php (PHP), pax = NULL (base price, no guest dimension) →
--     '__all__' bucket.
--   • vendor_packages  — category = primary_canonical_service, price =
--     total_price_centavos / 100, pax = vendor_profiles.capacity_max (venues
--     carry it; NULL for everyone else → '__all__').
-- region_slug = canonical region of vendor_profiles.hq_region (resolved to the
-- onboarding slug via public.regions when present, else the raw hq_region).
-- Only active vendors with a positive price count.
--
-- sample_n = DISTINCT vendors in the bucket (so one vendor with 5 packages is
-- ONE sample, not 5 — the band measures market breadth, not catalog size). A
-- bucket is written only when min_n_ok(distinct_vendors, floor); sub-floor
-- buckets are skipped → "not enough market data yet" downstream.
--
-- Returns the number of bands written. Admin-gated (is_console_admin) so a
-- vendor can never trigger a platform-wide recompute.
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
  IF NOT public.is_console_admin() THEN
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

COMMENT ON FUNCTION public.recompute_market_price_bands() IS
  'Price-Position Meter rollup (Wave 6): rebuilds market_price_bands (low/median/high + distinct-vendor sample_n) from PUBLISHED vendor_services + vendor_packages prices per (category, region_slug, pax_bucket). Suppresses buckets below the admin-managed min-N floor (platform_settings.radar_min_n_floor, >=3) via min_n_ok — so a thin market reads "not enough market data yet" rather than a fabricated range. is_console_admin-gated. Cron-free (admin run-now / after()). Returns bands written.';

REVOKE ALL ON FUNCTION public.recompute_market_price_bands() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_market_price_bands() TO authenticated;

COMMIT;
