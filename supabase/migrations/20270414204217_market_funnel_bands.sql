-- ============================================================================
-- 20270414204217_market_funnel_bands.sql
-- Category Benchmarks vs Peers — de-identified FUNNEL percentile bands.
--
-- Companion to market_price_bands (20270324043850): the price meter answers
-- "where does my PRICE sit?"; this answers "where does my FUNNEL sit?" against
-- anonymized peers in the vendor's EXACT (category, region, pax_bucket):
--   • reply-rate       (response_rate_pct — higher is better)
--   • avg reply time   (avg_response_minutes — LOWER is better)
--   • inquiry→booking  (inquiry_to_booking_pct — higher is better)
--
-- WHY A PRE-COMPUTED BAND TABLE (not a live aggregate per page-load)
-- -----------------------------------------------------------------
-- Same rationale as market_price_bands: quantiles over every peer's
-- vendor_activity_stats row, joined to region + category + capacity, is an
-- admin-cadence rollup — not a per-request query. We CACHE p25/p50/p75 per
-- bucket in market_funnel_bands and recompute on an admin "run now" (cron-free,
-- per the cron-free lock). A vendor card reads ONE row.
--
-- BEHAVIORAL MIN-N (the "honesty floor")
-- --------------------------------------
-- A band is only stored / surfaced when it has at least the platform min-N
-- sample floor of DISTINCT peers (public.min_n_ok(count, floor); floor from
-- platform_settings.radar_min_n_floor, held >= 3). Below the floor we do NOT
-- write the band → the vendor sees "not enough peer data yet" rather than a
-- fabricated ranking built from one or two peers. Founder-only today, so nearly
-- every bucket is below the floor and suppressed — that is the EXPECTED correct
-- behavior, not a bug.
--
-- PRIVACY: never expose a single peer. The band is ONLY quantiles + a distinct-
-- peer sample_n; there is, by construction, no column that can carry a peer
-- identity. Below the min-N floor nothing is written at all.
--
-- ADMIN-MANAGED, NEVER HARDCODED. Mirrors market_price_bands / token_burn_bands:
-- the numbers live in a table, recomputed from real vendor stats and reviewed/
-- triggered at admin cadence. No band value is hardcoded in code.
--
-- WHAT THIS MIGRATION ADDS:
--   1. market_funnel_bands (table)        — cached p25/p50/p75 for the three
--                                           funnel metrics per (category,
--                                           region_slug, pax_bucket) + sample_n.
--                                           RLS at CREATE: deny-all direct
--                                           access (read ONLY via the RPC, so
--                                           min-N can never be side-stepped).
--   2. recompute_market_funnel_bands()    — SECURITY DEFINER admin-gated rollup
--                                           that rebuilds the table from
--                                           vendor_activity_stats, suppressing
--                                           sub-floor buckets.
--   3. funnel_benchmark_for_vendor(uuid)  — SECURITY DEFINER, owner/admin-gated
--                                           reader: returns the caller's OWN
--                                           metrics + the peer band + the
--                                           computed percentile position, min-N
--                                           enforced. no_data below the floor.
--
-- Reuses the canonical public.price_band_pax_bucket(INT) from market_price_bands
-- (same pax lock). KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · The cached funnel-band table ────────────────────────────────────────
-- One row per (category, region_slug, pax_bucket) that cleared the min-N floor.
-- p25/p50/p75 for each of the three funnel metrics; NULL when a metric had no
-- non-null peer value in the bucket (e.g. every peer still has a null reply
-- time). Percentages are 0-100; reply-time is whole minutes.
CREATE TABLE IF NOT EXISTS public.market_funnel_bands (
  category            TEXT        NOT NULL,
  region_slug         TEXT        NOT NULL,
  pax_bucket          TEXT        NOT NULL,
  -- reply-rate (response_rate_pct · higher = better)
  reply_rate_p25      NUMERIC,
  reply_rate_p50      NUMERIC,
  reply_rate_p75      NUMERIC,
  -- avg reply time in minutes (avg_response_minutes · LOWER = better)
  reply_mins_p25      NUMERIC,
  reply_mins_p50      NUMERIC,
  reply_mins_p75      NUMERIC,
  -- inquiry→booking conversion (inquiry_to_booking_pct · higher = better)
  conversion_p25      NUMERIC,
  conversion_p50      NUMERIC,
  conversion_p75      NUMERIC,
  sample_n            INT         NOT NULL CHECK (sample_n >= 0),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, region_slug, pax_bucket)
);

CREATE INDEX IF NOT EXISTS market_funnel_bands_cat_region_idx
  ON public.market_funnel_bands (category, region_slug);

-- RLS at CREATE: deny everyone direct access. The band is quantiles-only and
-- already identity-free, but we still forbid raw reads so the min-N gate (which
-- lives in the read fn) can never be side-stepped. The SECURITY DEFINER fns
-- bypass RLS as the table owner, so they keep working with zero policies.
-- (Mirrors demand_radar_rollups, which is stricter than market_price_bands'
-- open read — the funnel band per (cat,region,pax) is a thinner slice, so we
-- take the tighter door.)
ALTER TABLE public.market_funnel_bands ENABLE ROW LEVEL SECURITY;
-- No policy => no row is selectable/writable by authenticated/anon. Intentional.

-- ── 2 · The recompute rollup ────────────────────────────────────────────────
-- Rebuilds market_funnel_bands from every active vendor's vendor_activity_stats
-- row, bucketed by (category, region_slug, pax_bucket):
--   • category   — each active vendor_services.category the vendor lists under
--                  (a vendor spanning N categories contributes to N buckets),
--                  matching market_price_bands' vendor_services source.
--   • region     — canonical slug of vendor_profiles.hq_region (via
--                  public.regions when present, else the raw hq_region).
--   • pax_bucket — price_band_pax_bucket(capacity_max) (venues carry capacity;
--                  everyone else → '__all__').
--
-- sample_n = DISTINCT vendors in the bucket (one vendor is ONE sample even if it
-- lists several services in the same category). A bucket is written only when
-- min_n_ok(distinct_vendors, floor); sub-floor buckets are skipped → "not enough
-- peer data yet" downstream. Per-metric quantiles ignore NULLs (a peer whose
-- reply time isn't computed yet doesn't drag the reply-time band), so a metric
-- can be NULL in the row while others are populated.
--
-- Returns the number of bands written. Admin-gated (is_console_admin) so a
-- vendor can never trigger a platform-wide recompute.
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

  -- Min-N sample floor — admin-managed via platform_settings, held >= 3 (same
  -- as market_price_bands) so a band always reflects a real spread of peers.
  SELECT GREATEST(COALESCE(ps.radar_min_n_floor, 3), 3)
    INTO v_floor
    FROM public.platform_settings ps
   WHERE ps.id = 1;
  v_floor := GREATEST(COALESCE(v_floor, 3), 3);

  -- Wipe + rebuild (derived cache; a full recompute is cheapest and avoids
  -- stale buckets that have dropped below the floor since last run).
  DELETE FROM public.market_funnel_bands;

  WITH peers AS (
    -- One row per (vendor, category): the vendor's funnel stats attached to each
    -- active category it lists under, with its region + pax bucket.
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
      -- treat a 0/NULL reply time as "not computed yet" (same convention the
      -- vendor panel uses) so it never pins the p25 to 0.
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
      percentile_cont(0.25) WITHIN GROUP (ORDER BY reply_rate)  FILTER (WHERE reply_rate  IS NOT NULL) AS reply_rate_p25,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY reply_rate)  FILTER (WHERE reply_rate  IS NOT NULL) AS reply_rate_p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY reply_rate)  FILTER (WHERE reply_rate  IS NOT NULL) AS reply_rate_p75,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY reply_mins)  FILTER (WHERE reply_mins  IS NOT NULL) AS reply_mins_p25,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY reply_mins)  FILTER (WHERE reply_mins  IS NOT NULL) AS reply_mins_p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY reply_mins)  FILTER (WHERE reply_mins  IS NOT NULL) AS reply_mins_p75,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY conversion)  FILTER (WHERE conversion  IS NOT NULL) AS conversion_p25,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY conversion)  FILTER (WHERE conversion  IS NOT NULL) AS conversion_p50,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY conversion)  FILTER (WHERE conversion  IS NOT NULL) AS conversion_p75,
      COUNT(DISTINCT vendor_profile_id)                                                                AS sample_n
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
  -- Behavioral min-N: only surface a band that clears the floor of distinct peers.
  WHERE public.min_n_ok(sample_n::INT, v_floor);

  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$$;

COMMENT ON FUNCTION public.recompute_market_funnel_bands() IS
  'Category Benchmarks rollup: rebuilds market_funnel_bands (p25/p50/p75 for reply-rate, avg reply-time, inquiry->booking + distinct-vendor sample_n) from vendor_activity_stats per (category, region_slug, pax_bucket). Suppresses buckets below the admin-managed min-N floor (platform_settings.radar_min_n_floor, >=3) via min_n_ok — a thin peer set reads "not enough peer data yet" rather than a fabricated ranking. is_console_admin-gated. Cron-free (admin run-now / after()). Returns bands written.';

REVOKE ALL ON FUNCTION public.recompute_market_funnel_bands() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_market_funnel_bands() TO authenticated;

-- ── 3 · Vendor-scoped reader ────────────────────────────────────────────────
-- Returns, for the caller's OWN vendor profile, their funnel metrics alongside
-- the peer band for their (category, region, pax_bucket) and the computed
-- percentile position of each metric inside that band. Ownership-gated (own
-- profile OR admin), min-N enforced (the read TABLE is RLS-locked; this fn is
-- the only door, so min-N cannot be bypassed).
--
-- CATEGORY SELECTION: a vendor may list several categories; we benchmark the
-- vendor's PRIMARY category = the active vendor_services category with the most
-- listings (ties broken alphabetically for determinism). p_category may be
-- passed to benchmark a specific one of the vendor's categories; NULL = primary.
--
-- PERCENTILE POSITION (0-100, "you beat X% of peers"): computed in the TS reader
-- from the returned own value + p25/p50/p75 edges, so we return the raw band +
-- the caller's own metrics and let the client place the marker. has_band=false
-- (band below min-N or no category) → the reader renders the honest no_data
-- state. Only ONE row is ever returned.
CREATE OR REPLACE FUNCTION public.funnel_benchmark_for_vendor(
  p_vendor_profile_id UUID,
  p_category          TEXT DEFAULT NULL
)
RETURNS TABLE(
  has_band            BOOLEAN,
  category            TEXT,
  region_slug         TEXT,
  pax_bucket          TEXT,
  sample_n            INT,
  own_reply_rate      NUMERIC,
  own_reply_mins      NUMERIC,
  own_conversion      NUMERIC,
  reply_rate_p25      NUMERIC,
  reply_rate_p50      NUMERIC,
  reply_rate_p75      NUMERIC,
  reply_mins_p25      NUMERIC,
  reply_mins_p50      NUMERIC,
  reply_mins_p75      NUMERIC,
  conversion_p25      NUMERIC,
  conversion_p50      NUMERIC,
  conversion_p75      NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_region   TEXT;
  v_pax      TEXT;
  v_category TEXT;
BEGIN
  -- Ownership gate.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Caller's home market + pax bucket, derived server-side from their profile.
  SELECT
    COALESCE(
      (SELECT r.slug FROM public.regions r
        WHERE LOWER(r.psgc_code) = LOWER(vp.hq_region)
           OR LOWER(r.slug)      = LOWER(vp.hq_region)
        LIMIT 1),
      NULLIF(vp.hq_region, '')
    ),
    public.price_band_pax_bucket(vp.capacity_max)
  INTO v_region, v_pax
  FROM public.vendor_profiles vp
  WHERE vp.vendor_profile_id = p_vendor_profile_id;

  -- Chosen category: the requested one (if the vendor actually lists it) else
  -- the vendor's primary (most active listings, alphabetical tiebreak).
  SELECT vs.category
    INTO v_category
  FROM public.vendor_services vs
  WHERE vs.vendor_profile_id = p_vendor_profile_id
    AND vs.is_active = TRUE
    AND vs.category IS NOT NULL
    AND (p_category IS NULL OR vs.category = p_category)
  GROUP BY vs.category
  ORDER BY COUNT(*) DESC, vs.category ASC
  LIMIT 1;

  -- Nothing to benchmark against (no category / no region on file): one row,
  -- has_band = false, own metrics still surfaced so the card can show "you".
  IF v_category IS NULL OR v_region IS NULL OR btrim(v_region) = '' THEN
    RETURN QUERY
    SELECT
      FALSE, v_category, v_region, v_pax, 0::INT,
      vas.response_rate_pct::NUMERIC,
      NULLIF(vas.avg_response_minutes, 0)::NUMERIC,
      vas.inquiry_to_booking_pct::NUMERIC,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC
    FROM public.vendor_activity_stats vas
    WHERE vas.vendor_profile_id = p_vendor_profile_id;

    -- No stats row yet → still emit a single has_band=false row.
    IF NOT FOUND THEN
      RETURN QUERY SELECT
        FALSE, v_category, v_region, v_pax, 0::INT,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    END IF;
    RETURN;
  END IF;

  -- Join the caller's own metrics to the peer band. LEFT JOIN so a below-floor
  -- (absent) band still returns one row with has_band=false + own metrics.
  RETURN QUERY
  SELECT
    (b.category IS NOT NULL)                       AS has_band,
    v_category,
    v_region,
    v_pax,
    COALESCE(b.sample_n, 0)                        AS sample_n,
    vas.response_rate_pct::NUMERIC                 AS own_reply_rate,
    NULLIF(vas.avg_response_minutes, 0)::NUMERIC   AS own_reply_mins,
    vas.inquiry_to_booking_pct::NUMERIC            AS own_conversion,
    b.reply_rate_p25, b.reply_rate_p50, b.reply_rate_p75,
    b.reply_mins_p25, b.reply_mins_p50, b.reply_mins_p75,
    b.conversion_p25, b.conversion_p50, b.conversion_p75
  FROM public.vendor_activity_stats vas
  LEFT JOIN public.market_funnel_bands b
    ON b.category    = v_category
   AND b.region_slug = v_region
   AND b.pax_bucket  = v_pax
  WHERE vas.vendor_profile_id = p_vendor_profile_id;

  -- No stats row (new vendor) but a band exists: still surface the band with
  -- null own-metrics so the peer picture shows.
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      (b.category IS NOT NULL)                     AS has_band,
      v_category, v_region, v_pax,
      COALESCE(b.sample_n, 0)                      AS sample_n,
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      b.reply_rate_p25, b.reply_rate_p50, b.reply_rate_p75,
      b.reply_mins_p25, b.reply_mins_p50, b.reply_mins_p75,
      b.conversion_p25, b.conversion_p50, b.conversion_p75
    FROM public.market_funnel_bands b
    WHERE b.category    = v_category
      AND b.region_slug = v_region
      AND b.pax_bucket  = v_pax;

    -- Neither stats nor band: one honest empty row.
    IF NOT FOUND THEN
      RETURN QUERY SELECT
        FALSE, v_category, v_region, v_pax, 0::INT,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_benchmark_for_vendor(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.funnel_benchmark_for_vendor(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.funnel_benchmark_for_vendor(UUID, TEXT) IS
  'Category Benchmarks reader: for the caller''s OWN vendor profile, returns their funnel metrics + the de-identified peer band (p25/p50/p75 for reply-rate, avg reply-time, inquiry->booking) for their (category, region, pax_bucket), with sample_n. SECURITY DEFINER + owner/admin gate. Min-N enforced (market_funnel_bands is RLS-locked; this fn is the only door). has_band=false when the bucket is below the min-N floor or the vendor has no category/region — the client renders the honest no_data state. Never exposes a single peer.';

COMMIT;
