-- ============================================================================
-- Demand Radar (Wave 6 vendor "Soon" benefit) — de-identified demand rollups
-- ============================================================================
-- "Where should I focus?" — a first-party, min-N de-identified read of couple
-- demand bucketed ONLY by (region, month-bucket, event_type, style). It tells a
-- vendor which months/areas/looks are heating up WITHOUT ever exposing a single
-- couple: no user_id, no event_id, no names, no single identifiable plan leaves
-- these surfaces.
--
-- LOCKS honored (behavioral-data lock is load-bearing here):
--   • De-identified, min-N suppressed. Every emitted bucket is a (region,
--     month, event_type, style) → COUNTS triple, and it only surfaces if it
--     clears the admin-managed floor via public.min_n_ok(count, floor). The
--     floor comes from platform_settings.radar_min_n_floor (id=1), COALESCE-
--     defended to 1 so a NULL/absent value can never disable suppression.
--   • The master radar_enabled toggle (platform_settings) gates the whole feed.
--   • Cron-free. The rollup is a materialized table refreshed by the SECURITY
--     DEFINER refresh_demand_radar_rollups() — invoked on demand from Next 15
--     after() on dashboard load (throttled by refreshed_at) and an admin
--     "run now" action. NO poller, NO pg_cron.
--   • Admin-managed thresholds, never hardcoded — no literal floor/enable flag
--     appears in the read fns; they read platform_settings live.
--   • RLS at CREATE TABLE time. The rollup table denies ALL direct client
--     access; the ONLY way in is the two SECURITY DEFINER read fns, so the
--     min-N gate is the single, un-bypassable door. (A direct table read would
--     skip suppression — so we forbid it outright.)
--   • Ownership gate: the vendor read fn is scoped to the caller's OWN
--     vendor_profile (current_vendor_profile_ids()); the admin fn to
--     is_console_admin(). The refresh fn is admin/service-role only.
--
-- A BOOKING = a couple committed to a vendor: event_vendors.status in
-- (contracted, deposit_paid, delivered, complete). considering/shortlisted are
-- pre-commitment and excluded from booking_count.
--
-- MONTH-BUCKET = the EVENT's month (date_trunc('month', events.event_date)) —
-- "demand for events happening in month X" is the signal vendors plan around,
-- not when the row was written. Rows with no event_date fall back to created_at
-- so early-stage demand still registers.
--
-- REGION/STYLE are stored as the raw events.region slug + events.papic_style
-- code; the TS layer (lib/demand-radar.ts) resolves friendly labels via the
-- canonical region-source + papic-photo-styles. event_type is the raw slug.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE FUNCTION. Additive.
-- ----------------------------------------------------------------------------

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. demand_radar_rollups — the materialized de-identified rollup.
--    One row per (region, month_bucket, event_type, style). COUNTS ONLY — there
--    is, by construction, no column that can carry a couple identity.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demand_radar_rollups (
  region        TEXT        NOT NULL,           -- events.region slug ('ncr'); '' = unknown/blank
  month_bucket  DATE        NOT NULL,           -- date_trunc('month', event_date|created_at)
  event_type    TEXT        NOT NULL,           -- events.event_type slug ('wedding')
  style         TEXT        NOT NULL,           -- events.papic_style code ('ORIG')
  inquiry_count  INTEGER    NOT NULL DEFAULT 0, -- chat_threads opened to vendors
  unlock_count   INTEGER    NOT NULL DEFAULT 0, -- vendor_event_unlocks (paid-to-answer; strong demand proxy)
  booking_count  INTEGER    NOT NULL DEFAULT 0, -- event_vendors committed (contracted+)
  refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (region, month_bucket, event_type, style)
);

COMMENT ON TABLE public.demand_radar_rollups IS
  'Demand Radar (Wave 6): de-identified demand rollup, one row per (region, month_bucket, event_type, style) → inquiry/unlock/booking COUNTS. No couple identity by construction. Direct client access is denied via RLS — read ONLY through demand_radar_for_vendor()/demand_radar_admin(), which apply the platform_settings.radar_min_n_floor min-N gate. Refreshed cron-free by refresh_demand_radar_rollups().';

-- RLS at CREATE: deny everyone direct access. The rollup is counts-only and
-- already identity-free, but we still forbid raw reads so min-N suppression
-- (which lives in the read fns) can never be side-stepped. SECURITY DEFINER fns
-- bypass RLS as the table owner, so they keep working with zero policies.
ALTER TABLE public.demand_radar_rollups ENABLE ROW LEVEL SECURITY;
-- No policy => no row is selectable/writable by authenticated/anon. Intentional.

-- Helpful read index for the admin fn's region/month ordering.
CREATE INDEX IF NOT EXISTS demand_radar_rollups_region_month_idx
  ON public.demand_radar_rollups (region, month_bucket DESC);

-- ----------------------------------------------------------------------------
-- 2. refresh_demand_radar_rollups — cron-free recompute.
--    Full rebuild (the universe is tiny at this stage; a DELETE+INSERT is
--    cheaper and simpler than incremental upserts and can't drift). SECURITY
--    DEFINER so it can write the RLS-locked table; gated to admin OR
--    service_role so a random authenticated caller can't trigger a rebuild.
--    Returns the number of rollup rows written.
--
--    Called from Next 15 after() (throttled by max(refreshed_at)) and the admin
--    "Run now" action. NOT a poller.
-- ----------------------------------------------------------------------------
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
    DELETE FROM public.demand_radar_rollups RETURNING 1
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

REVOKE ALL ON FUNCTION public.refresh_demand_radar_rollups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_demand_radar_rollups() TO authenticated, service_role;

COMMENT ON FUNCTION public.refresh_demand_radar_rollups() IS
  'Demand Radar (Wave 6): cron-free full rebuild of demand_radar_rollups. SECURITY DEFINER, gated to admin OR service_role. Invoked from Next after() (throttled) + the admin Run-now action. Returns rows written.';

-- ----------------------------------------------------------------------------
-- 3. demand_radar_for_vendor — vendor-scoped, OWN region, min-N.
--    Scoped to the caller's own vendor_profile (ownership gate). Region scope =
--    the vendor's hq_region (their home market). Output is counts-only buckets,
--    each cleared by min_n_ok against the admin-managed floor; the master
--    radar_enabled toggle zeroes the whole feed.
--
--    REGION-SCOPED, not category-scoped (intentional, same as Shortlist Radar):
--    vendor_profiles.services is a free-form TEXT[] with no sound join key onto
--    event_vendors' vendor_category enum, so a precise per-category cross-
--    surface match isn't reliable. We scope by hq_region and surface every
--    event_type/style in that market — correct + de-identified. Category
--    narrowing can layer on once the taxonomy key is dual-written both sides.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demand_radar_for_vendor(p_vendor_profile_id UUID)
RETURNS TABLE(
  region        TEXT,
  month_bucket  DATE,
  event_type    TEXT,
  style         TEXT,
  inquiry_count INTEGER,
  unlock_count  INTEGER,
  booking_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_floor   INTEGER;
  v_region  TEXT;
BEGIN
  -- Ownership gate.
  IF NOT (
    p_vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_console_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Admin-managed config (defensive COALESCE → enabled, floor=1 on absent row).
  SELECT COALESCE(ps.radar_enabled, TRUE),
         COALESCE(ps.radar_min_n_floor, 1)
    INTO v_enabled, v_floor
  FROM public.platform_settings ps
  WHERE ps.id = 1;
  v_floor := COALESCE(v_floor, 1);

  IF NOT COALESCE(v_enabled, TRUE) THEN
    RETURN;  -- master switch off
  END IF;

  -- Caller's home market, derived server-side from their own profile row.
  SELECT vp.hq_region INTO v_region
  FROM public.vendor_profiles vp
  WHERE vp.vendor_profile_id = p_vendor_profile_id;

  IF v_region IS NULL OR btrim(v_region) = '' THEN
    RETURN;  -- no region on file → nothing region-scoped to surface
  END IF;

  RETURN QUERY
  SELECT r.region, r.month_bucket, r.event_type, r.style,
         r.inquiry_count, r.unlock_count, r.booking_count
  FROM public.demand_radar_rollups r
  WHERE r.region = v_region
    -- min-N: a bucket surfaces only if its TOTAL demand signal clears the floor,
    -- so a single small cell can't re-identify a couple.
    AND public.min_n_ok(r.inquiry_count + r.unlock_count + r.booking_count, v_floor)
  ORDER BY r.month_bucket DESC, r.event_type, r.style;
END;
$$;

REVOKE ALL ON FUNCTION public.demand_radar_for_vendor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demand_radar_for_vendor(UUID) TO authenticated;

COMMENT ON FUNCTION public.demand_radar_for_vendor(UUID) IS
  'Demand Radar (Wave 6): de-identified (region, month, event_type, style) → counts rollup scoped to the caller vendor''s hq_region. SECURITY DEFINER + owner/admin gate. Respects platform_settings.radar_enabled and suppresses buckets below radar_min_n_floor via min_n_ok(). No couple identity in the output. Region-scoped (not category-scoped) — services TEXT[] has no sound join onto the event_vendors category enum.';

-- ----------------------------------------------------------------------------
-- 4. demand_radar_admin — all regions/types, min-N (admin console).
--    Same min-N suppression — even an admin never sees a below-floor cell, so
--    the de-identification contract holds uniformly. is_console_admin() gate.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demand_radar_admin()
RETURNS TABLE(
  region        TEXT,
  month_bucket  DATE,
  event_type    TEXT,
  style         TEXT,
  inquiry_count INTEGER,
  unlock_count  INTEGER,
  booking_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_floor INTEGER;
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(ps.radar_min_n_floor, 1) INTO v_floor
  FROM public.platform_settings ps WHERE ps.id = 1;
  v_floor := COALESCE(v_floor, 1);

  -- Note: the admin view intentionally does NOT honor radar_enabled — the toggle
  -- governs the vendor-facing FEED; the operator console can always inspect the
  -- (still min-N suppressed) demand picture to tune the floor / decide on the
  -- toggle.
  RETURN QUERY
  SELECT r.region, r.month_bucket, r.event_type, r.style,
         r.inquiry_count, r.unlock_count, r.booking_count
  FROM public.demand_radar_rollups r
  WHERE public.min_n_ok(r.inquiry_count + r.unlock_count + r.booking_count, v_floor)
  ORDER BY r.month_bucket DESC, r.region, r.event_type, r.style;
END;
$$;

REVOKE ALL ON FUNCTION public.demand_radar_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demand_radar_admin() TO authenticated;

COMMENT ON FUNCTION public.demand_radar_admin() IS
  'Demand Radar (Wave 6): de-identified (region, month, event_type, style) → counts rollup across ALL markets, for the admin console. SECURITY DEFINER + is_console_admin() gate. Min-N suppressed via radar_min_n_floor (admin sees no below-floor cell either). Counts only — no couple identity.';

COMMIT;
