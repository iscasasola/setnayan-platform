-- a_real_event_never_books_a_demo_shop
-- ============================================================================
-- 🧪 A REAL EVENT NEVER BOOKS, PAYS OR MESSAGES A DEMO SHOP — AND A DEMO EVENT NEVER BOOKS A REAL ONE.
--
-- Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS": demo shops (`vendor_profiles.is_demo`) and demo events
-- (`events.is_sample`) now show publicly beside real ones, marked "(DEMO ONLY)" — with the follow-up the build must
-- hold: *"a couple can never book or pay a demo shop"*. And "DEMO CATALOGUE — scope": *"The goal is the demo events
-- can only see demo suppliers to try to run suppliers as well."*
--
-- So the rule is ONE equality, the same one `lib/demo-scope.ts` (`eventMayMeetShop`) applies in the app:
--     an event and a shop may be paired only when  events.is_sample  =  vendor_profiles.is_demo
-- This trigger is the database half. Every server action that writes a pairing asks `demoBookingRefusal` first and
-- shows the couple a sentence; this is what holds when a path forgets to ask.
--
-- WHERE IT FIRES — every table that turns an (event, shop) pair into a booking, a payment, a quote or a conversation:
--   event_vendors        (event_id; marketplace_vendor_id AND linked_vendor_profile_id — both name the shop)
--   chat_threads         (event_id, vendor_profile_id)   — a conversation (event_id is NOT NULL here)
--   vendor_proposals     (event_id, vendor_profile_id)   — a quote
--   orders               (event_id, vendor_profile_id)
--   booking_fee_charges  (event_id, vendor_profile_id)
--   vendor_contracts     (event_id, vendor_profile_id)
--   vendor_payment_asks  (event_id, vendor_profile_id)
-- The column names are passed as trigger arguments (TG_ARGV[0] = the event column, TG_ARGV[1..] = shop columns) and
-- read through to_jsonb(NEW), so one function serves every table and a table cannot be covered with the wrong column.
--
-- WHEN IT FIRES:
--   · only when the event id AND a shop id are both present (an off-platform supplier, a shop-level order with no
--     event, a manual supplier — nothing to pair, never touched);
--   · on INSERT always; on UPDATE only when the event id or that shop id actually CHANGED. So a row that already
--     exists — e.g. the owner's old test bookings of Saysay on a real event, made while Saysay was a trial shop — can
--     still have its status, its archive stamp or its notes updated. Nothing is deleted or rewritten here; such legacy
--     rows simply cannot gain a new pairing, and the app refuses new writes on them (`demoBookingRefusal`).
--     `scripts/check-no-demo-cross-booking.mjs` lists them.
--
-- THE REFUSAL: `check_violation` (23514, the errcode `enforce_booking_requires_verified_vendor` already uses for the
-- sibling "unverified shop" refusal), with a message that starts `demo_cross_booking:` —
--   `demo_cross_booking: demo shop on a real event`   or   `demo_cross_booking: real shop on a demo event`
-- `demoRefusalFromDbError` (lib/demo-scope.ts) turns either into the couple's line. Do not reword them.
--
-- SECURITY DEFINER with a locked search_path: the writer may be a couple whose RLS cannot read the shop's row
-- (`vendor_profiles_public_read` is verified-only) and `is_demo` is not even anon-selectable (20271014385411). The
-- function only READS `events.is_sample` and `vendor_profiles.is_demo`. A missing event or shop row reads as "real"
-- (false); the foreign key refuses a dangling id on its own.
--
-- Idempotent: CREATE OR REPLACE + DROP TRIGGER IF EXISTS. Held by
-- apps/web/tests/db/a-real-event-never-books-a-demo-shop.db.test.ts.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refuse_demo_cross_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new       jsonb := to_jsonb(NEW);
  v_old       jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_event_col text  := TG_ARGV[0];
  v_shop_col  text;
  v_event_id  uuid;
  v_shop_id   uuid;
  v_is_sample boolean;
  v_is_demo   boolean;
  i           integer;
BEGIN
  v_event_id := NULLIF(v_new ->> v_event_col, '')::uuid;
  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR i IN 1 .. TG_NARGS - 1 LOOP
    v_shop_col := TG_ARGV[i];
    v_shop_id := NULLIF(v_new ->> v_shop_col, '')::uuid;
    CONTINUE WHEN v_shop_id IS NULL;

    -- An UPDATE that leaves this pairing as it was is never re-judged (legacy rows keep their lifecycle).
    CONTINUE WHEN TG_OP = 'UPDATE'
      AND (v_old ->> v_event_col) IS NOT DISTINCT FROM (v_new ->> v_event_col)
      AND (v_old ->> v_shop_col)  IS NOT DISTINCT FROM (v_new ->> v_shop_col);

    SELECT e.is_sample INTO v_is_sample FROM public.events e WHERE e.event_id = v_event_id;
    SELECT vp.is_demo INTO v_is_demo FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_shop_id;

    IF COALESCE(v_is_demo, false) AND NOT COALESCE(v_is_sample, false) THEN
      RAISE EXCEPTION 'demo_cross_booking: demo shop on a real event'
        USING ERRCODE = 'check_violation',
              DETAIL  = format('%s.%s=%s is a demo shop; %s=%s is a real event', TG_TABLE_NAME, v_shop_col, v_shop_id, v_event_col, v_event_id),
              HINT    = 'This is a demo shop — it can''t be booked. Demo shops are paired only with demo events (events.is_sample).';
    END IF;
    IF COALESCE(v_is_sample, false) AND NOT COALESCE(v_is_demo, false) THEN
      RAISE EXCEPTION 'demo_cross_booking: real shop on a demo event'
        USING ERRCODE = 'check_violation',
              DETAIL  = format('%s.%s=%s is a real shop; %s=%s is a demo event', TG_TABLE_NAME, v_shop_col, v_shop_id, v_event_col, v_event_id),
              HINT    = 'This is a demo event — it can only book demo shops (vendor_profiles.is_demo).';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.refuse_demo_cross_booking() IS
  'Owner 2026-11-06 (DEMO SHOPS + DEMO EVENTS): an event and a shop may be paired only when events.is_sample = vendor_profiles.is_demo. BEFORE INSERT OR UPDATE trigger; TG_ARGV[0] = event column, TG_ARGV[1..] = shop columns. Fires on INSERT, and on UPDATE only when the pairing changes (legacy rows keep their lifecycle). Raises check_violation "demo_cross_booking: demo shop on a real event" / "... real shop on a demo event" (lib/demo-scope.ts translates both).';

-- A trigger function is never an RPC: nobody may call it directly.
REVOKE ALL ON FUNCTION public.refuse_demo_cross_booking() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refuse_demo_cross_booking() FROM anon;
REVOKE ALL ON FUNCTION public.refuse_demo_cross_booking() FROM authenticated;

DROP TRIGGER IF EXISTS event_vendors_refuse_demo_cross_booking ON public.event_vendors;
CREATE TRIGGER event_vendors_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, marketplace_vendor_id, linked_vendor_profile_id ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'marketplace_vendor_id', 'linked_vendor_profile_id');

DROP TRIGGER IF EXISTS chat_threads_refuse_demo_cross_booking ON public.chat_threads;
CREATE TRIGGER chat_threads_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');

DROP TRIGGER IF EXISTS vendor_proposals_refuse_demo_cross_booking ON public.vendor_proposals;
CREATE TRIGGER vendor_proposals_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.vendor_proposals
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');

DROP TRIGGER IF EXISTS orders_refuse_demo_cross_booking ON public.orders;
CREATE TRIGGER orders_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');

DROP TRIGGER IF EXISTS booking_fee_charges_refuse_demo_cross_booking ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_charges_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.booking_fee_charges
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');

DROP TRIGGER IF EXISTS vendor_contracts_refuse_demo_cross_booking ON public.vendor_contracts;
CREATE TRIGGER vendor_contracts_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.vendor_contracts
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');

DROP TRIGGER IF EXISTS vendor_payment_asks_refuse_demo_cross_booking ON public.vendor_payment_asks;
CREATE TRIGGER vendor_payment_asks_refuse_demo_cross_booking
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id ON public.vendor_payment_asks
  FOR EACH ROW EXECUTE FUNCTION public.refuse_demo_cross_booking('event_id', 'vendor_profile_id');


-- ============================================================================
-- 🔢 PART 2 · DEMO NUMBERS NEVER COUNT IN REAL TOTALS — the four totals that live in SQL.
--
-- Same ruling, its second follow-up: *"demo numbers never count in real totals"*. Now that demo shops and demo events
-- are public and can be booked by each other, four database aggregates would start counting them. Each is re-created
-- from its LATEST definition with ONE kind of change — a demo filter — and every other line byte-identical to the
-- source named above it. CREATE OR REPLACE keeps each function's signature, SECURITY DEFINER, STABLE-ness,
-- search_path, grants and comment.
--
--   refresh_demand_radar_rollups   ← 20271261953500_a_wipe_says_where.sql            ev CTE: e.is_sample IS FALSE
--   recompute_market_price_bands   ← 20271261953500_a_wipe_says_where.sql            both branches: vp.is_demo = FALSE
--   recompute_market_funnel_bands  ← 20271261953500_a_wipe_says_where.sql            peers CTE: vp.is_demo = FALSE
--   admin_market_analytics         ← 20261202001000_admin_intelligence_analytics.sql every e.archived = FALSE: AND e.is_sample IS FALSE
--   (written `IS FALSE`, never `= FALSE`: gates-have-handles reads `col =` inside a function body as a WRITE, and
--    events.is_sample is writer-less by design — its baseline line in tests/db/gates-have-handles.baseline.txt stays true.)
--
-- The three rebuilds are NOT called here: they are admin-gated (is_console_admin / service_role), run by the periodic
-- job registry and the admin "Run now", and a migration has neither identity. The next scheduled refill drops whatever
-- demo rows the derived tables hold today. Both columns are NOT NULL DEFAULT false, so `= FALSE` is exact.
-- ============================================================================

-- ← 20271261953500_a_wipe_says_where.sql
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
    -- 🧪 2026-11-06: a demo event's inquiries, unlocks and bookings are never demand (owner: "demo numbers never
    -- count in real totals").
    WHERE e.is_sample IS FALSE
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

-- ← 20271261953500_a_wipe_says_where.sql
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
      AND vp.is_demo = FALSE  -- 🧪 2026-11-06: a demo shop's price is never a market price
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
      AND vp.is_demo = FALSE  -- 🧪 2026-11-06: a demo shop's package is never a market price
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

-- ← 20271261953500_a_wipe_says_where.sql
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
      AND vp.is_demo = FALSE  -- 🧪 2026-11-06: a demo shop is never a peer in a real benchmark
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

-- ← 20261202001000_admin_intelligence_analytics.sql
CREATE OR REPLACE FUNCTION public.admin_market_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'admin_market_analytics: admin only';
  END IF;

  -- 🧪 2026-11-06: every count below skips demo events (`e.is_sample`) — "demo numbers never count in real totals".
  SELECT jsonb_build_object(
    'budget', (
      SELECT jsonb_build_object(
        'events_total',       COUNT(*),
        'events_with_budget', COUNT(e.estimated_budget_centavos),
        'avg_centavos',       ROUND(AVG(e.estimated_budget_centavos)),
        'median_centavos',    ROUND((percentile_cont(0.5) WITHIN GROUP
                                (ORDER BY e.estimated_budget_centavos))::NUMERIC),
        'min_centavos',       MIN(e.estimated_budget_centavos),
        'max_centavos',       MAX(e.estimated_budget_centavos)
      )
      FROM public.events e
      WHERE e.archived = FALSE AND e.is_sample IS FALSE
    ),
    'top_regions', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('region', t.region, 'events', t.n)
                  ORDER BY t.n DESC, t.region ASC),
        '[]'::JSONB)
      FROM (
        SELECT e.region, COUNT(*) AS n
        FROM public.events e
        WHERE e.archived = FALSE AND e.is_sample IS FALSE AND e.region IS NOT NULL AND e.region <> ''
        GROUP BY e.region
        ORDER BY n DESC, e.region ASC
        LIMIT 5
      ) t
    ),
    'unlocated_events', (
      SELECT COUNT(*)
      FROM public.events e
      WHERE e.archived = FALSE AND e.is_sample IS FALSE AND (e.region IS NULL OR e.region = '')
    ),
    'event_types', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('event_type', t.event_type, 'events', t.n)
                  ORDER BY t.n DESC, t.event_type ASC),
        '[]'::JSONB)
      FROM (
        SELECT e.event_type::TEXT AS event_type, COUNT(*) AS n
        FROM public.events e
        WHERE e.archived = FALSE AND e.is_sample IS FALSE
        GROUP BY e.event_type
      ) t
    ),
    'generated_at', NOW()
  )
  INTO result;

  RETURN result;
END;
$$;
