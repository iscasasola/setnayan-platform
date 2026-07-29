-- Papic TWO-TYPE MODEL — Papic Pool (shared, unlimited cameras) + Papic One
-- (a dedicated camera with its OWN, unshared point balance).
-- Owner-locked 2026-07-29 (DECISION_LOG.md, rows dated 2026-07-29).
--
-- ── THE MODEL, VERBATIM ───────────────────────────────────────────────────
--   Papic Pool — unlimited cameras, SHARED shots.
--     free  : 50 pts (already armed in prod — 20271017567807 + the seed trigger)
--     paid  : +3,000 pts ₱1,000 · +6,000 pts ₱2,000 · +10,000 pts ₱3,000
--             ADDITIVE and REPEATABLE (every rung is a top-up; buying twice
--             adds twice). ≈ ₱0.30–0.33 per photo.
--   Papic One — ONE dedicated camera, its own QR, its own UNSHARED balance.
--     free  : ONE free One camera per event, 5 dedicated pts (new mechanic)
--     paid  : 50 pts ₱50 · 100 pts ₱100, PER CAMERA, no cap on how many an
--             event buys. RELOADABLE — the same rungs top up an EXISTING
--             camera (including the free one), so no new QR mid-event.
--             ₱1.00 per photo, flat.
--   Currency: 1 photo = 1 pt · one 10-second clip = 8 pts (was 7).
--
-- ── WHAT WAS SHIPPED, AND WHY IT CANNOT EXPRESS THIS ──────────────────────
-- Everything drew ONE shared pool. `papic_event_point_grants` rows carry
-- event_id + order_id only, and usage is a single per-event counter
-- (`papic_event_pool_usage`) with no seat attribution — so "this camera has its
-- own 50 points" was underivable. lib/papic-pool-meter.ts says so in as many
-- words ("Modelling dedication is a ledger change owned by a later, supervised
-- PR — do not bolt it on here"). THIS is that ledger change.
--
-- The shape: `papic_event_point_grants.seat_id`.
--   • seat_id IS NULL  -> a SHARED grant (Free pool · Pool top-ups · admin/comp)
--   • seat_id NOT NULL -> DEDICATED to that one camera, invisible to the pool
-- `papic_event_pool_status` now sums only the NULL-seat rows, so a dedicated
-- camera's points can never inflate the shared pool, and per-seat lifetime spend
-- lands in the new `papic_seat_point_usage`.
--
-- ── WHY NO NEW CAPTURE-PATH RPC NAMES FOR THE SEAT GATE ───────────────────
-- `papic_reserve_camera_points` / `papic_camera_points_remaining` /
-- `papic_release_camera_points` are ALREADY the per-seat gate on both
-- enforcement seams (app/papic/actions.ts record + app/api/upload presign).
-- Teaching them the dedicated branch means the hot path keeps its exact call
-- shape and fail-CLOSED posture. Only the EVENT-pool half needed new names
-- (`*_for_seat`), because a dedicated capture must NOT also spend the shared
-- pool and the shipped signature has no seat to branch on. Adding a parameter
-- to a live function would create a PostgREST-ambiguous overload; a new name
-- does not.
--
-- ── 250 IS GONE ───────────────────────────────────────────────────────────
-- `papic_event_pool_config.camera_grant_points` (₱100 -> 250 pts) is the old
-- Papic One conversion. It is neutralised to 0 and no longer read: One rung
-- points now come from `papic_one_tiers`, the ONE place a One rung's grant may
-- live (same posture as `papic_pass_tiers` for Pool rungs). The column is kept
-- rather than dropped so `tests/db/schema-drift.db.test.ts` does not see a
-- PROD_NOT_DECLARED divergence for a column production still has.
--
-- ── DEFAULT-ACL DISCIPLINE ────────────────────────────────────────────────
-- Every table in `public` ships OPEN (the default ACL grants arwdDxtm to anon +
-- authenticated). All three new tables get RLS at CREATE TABLE time AND an
-- explicit REVOKE ALL, and every new function is granted to service_role ONLY.
-- `papic_event_point_grants` + `papic_event_pool_config` are additionally
-- REVOKEd here: both are service-role/SECURITY-DEFINER-only by design (the
-- grants ledger carries no read policy on purpose — "a host granting themselves
-- points is exactly what the fence exists to stop") yet both still carried the
-- default SIUD to anon. That is a NARROWING, so the committed exposure baseline
-- (supabase/security/exposure-surface.baseline.txt) needs no regeneration; the
-- new seat_id column is likewise invisible to anon/authenticated.
--
-- Idempotent throughout (IF NOT EXISTS / IS DISTINCT FROM / ON CONFLICT).

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CATALOG — Papic Pool top-up rungs (reactivate + reprice)
-- ═══════════════════════════════════════════════════════════════════════════
-- The three rungs shipped INACTIVE at ₱999 / ₱1,999 / ₱2,999 (20270830568357)
-- as one-shot "passes". They are now ADDITIVE TOP-UPS at the owner's numbers,
-- and titled as top-ups so a card cannot read as a one-time purchase.
-- Titles stay unique among ACTIVE rows (20270828150000 asserts that, because
-- /pricing emits every active SKU as a schema.org Offer verbatim).

UPDATE public.platform_retail_catalog_v2
   SET title = 'Papic Pool — add 3,000 shots', retail_price_php = 1000,
       is_active = TRUE, updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST'
   AND (title IS DISTINCT FROM 'Papic Pool — add 3,000 shots'
        OR retail_price_php IS DISTINCT FROM 1000
        OR is_active IS DISTINCT FROM TRUE);

UPDATE public.platform_retail_catalog_v2
   SET title = 'Papic Pool — add 6,000 shots', retail_price_php = 2000,
       is_active = TRUE, updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST_6K'
   AND (title IS DISTINCT FROM 'Papic Pool — add 6,000 shots'
        OR retail_price_php IS DISTINCT FROM 2000
        OR is_active IS DISTINCT FROM TRUE);

UPDATE public.platform_retail_catalog_v2
   SET title = 'Papic Pool — add 10,000 shots', retail_price_php = 3000,
       is_active = TRUE, updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST_10K'
   AND (title IS DISTINCT FROM 'Papic Pool — add 10,000 shots'
        OR retail_price_php IS DISTINCT FROM 3000
        OR is_active IS DISTINCT FROM TRUE);

-- PAPIC_GUEST_TOPUP stays INACTIVE, deliberately.
-- It existed because the old rungs were one-shot passes, so a separate
-- repeatable "+10,000" SKU was the only way to buy more. Now that EVERY rung is
-- additive and repeatable, a fourth rung selling exactly what PAPIC_GUEST_10K
-- sells is a duplicate — two cards, one product, at two prices. It is retitled
-- only so it can never collide with the live 10,000 rung's title, and its
-- papic_pass_tiers row is deactivated below so the trap in
-- resolveRetailChargeCentavos() (which prices by service_code WITHOUT filtering
-- is_active) cannot resurrect it: even if an order for it were somehow minted,
-- the grant lookup returns nothing and it converts to ZERO points.
UPDATE public.platform_retail_catalog_v2
   SET title = 'Papic Pool — add 10,000 shots (superseded)', updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST_TOPUP'
   AND title IS DISTINCT FROM 'Papic Pool — add 10,000 shots (superseded)';

UPDATE public.platform_retail_catalog_v2
   SET is_active = FALSE, updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST_TOPUP' AND is_active IS DISTINCT FROM FALSE;

-- Pool rung -> points. The buckets themselves are unchanged (3,000 / 6,000 /
-- 10,000); what changes is that NONE of them is a gated "top-up" any more —
-- is_topup held the old rung behind PAPIC_TOPUP_UNLOCK_POINTS (10,000 already
-- held). Every rung is now freely repeatable, so the gate is cleared.
UPDATE public.papic_pass_tiers
   SET is_topup = FALSE, updated_at = NOW()
 WHERE service_code IN ('PAPIC_GUEST', 'PAPIC_GUEST_6K', 'PAPIC_GUEST_10K')
   AND is_topup IS DISTINCT FROM FALSE;

UPDATE public.papic_pass_tiers
   SET is_active = FALSE, updated_at = NOW()
 WHERE service_code = 'PAPIC_GUEST_TOPUP' AND is_active IS DISTINCT FROM FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CATALOG — Papic One rungs (50 pts ₱50 · 100 pts ₱100, per camera)
-- ═══════════════════════════════════════════════════════════════════════════
-- PAPIC_CAMERA_MINI_DAY IS "Papic One" — it is the tier 'mini' rate row
-- (papic_tier_config.rate_service_code), the code lib/papic-cameras.ts prices
-- the buy flow from, and the never-rename lock holds on it. So the ₱50 rung
-- REPRICES it (₱100 -> ₱50) rather than minting a replacement and orphaning the
-- doorway; only the ₱100 rung is a new code. That also closes the retired-code
-- trap by construction: there is no retired One code left for the charge path to
-- price at the old 250-point value.
--
-- The "per camera, per day" framing is gone: One is a bucket of shots for one
-- camera, not a day rate — the day meter was already switched off for tier
-- 'mini' (points_per_day -> NULL, 20270901123354).

UPDATE public.platform_retail_catalog_v2
   SET title = 'Papic One — 50 shots (one camera)', retail_price_php = 50,
       is_active = TRUE, updated_at = NOW()
 WHERE service_code = 'PAPIC_CAMERA_MINI_DAY'
   AND (title IS DISTINCT FROM 'Papic One — 50 shots (one camera)'
        OR retail_price_php IS DISTINCT FROM 50
        OR is_active IS DISTINCT FROM TRUE);

INSERT INTO public.platform_retail_catalog_v2
  (service_code, title, retail_price_php, saas_overhead_cost_php, is_active,
   billing_period, is_pax_priced, description)
VALUES
  ('PAPIC_ONE_100', 'Papic One — 100 shots (one camera)', 100, 10, TRUE,
   'one_time', FALSE,
   'One dedicated camera with its own QR and its own 100 shots. Those shots are '
   'that camera''s alone — nobody else can spend them. Reloadable any time.')
ON CONFLICT (service_code) DO UPDATE
   SET title            = EXCLUDED.title,
       retail_price_php = EXCLUDED.retail_price_php,
       is_active        = EXCLUDED.is_active,
       updated_at       = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. papic_one_tiers — the ONE place a Papic One rung's point grant may live
-- ═══════════════════════════════════════════════════════════════════════════
-- Mirrors papic_pass_tiers (Pool) exactly, and for the same reason: a rung's
-- point value is admin-editable data, never a literal in app code. Kept as a
-- sibling table rather than a column on papic_pass_tiers because that table's
-- columns are anon-readable in the committed exposure baseline — a new column
-- there would be a WIDENING; a new fully-revoked table is not.

CREATE TABLE IF NOT EXISTS public.papic_one_tiers (
  service_code TEXT PRIMARY KEY
                 REFERENCES public.platform_retail_catalog_v2(service_code) ON DELETE CASCADE,
  points       INTEGER NOT NULL CHECK (points > 0),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.papic_one_tiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papic_one_tiers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papic_one_tiers TO service_role;

COMMENT ON TABLE public.papic_one_tiers IS
  'Papic One purchased point buckets: service_code -> points granted on payment, '
  'DEDICATED to one camera (papic_event_point_grants.seat_id). Sibling of '
  'papic_pass_tiers, which does the same job for the SHARED Papic Pool rungs. '
  'Owner-locked 2026-07-29: 50 pts / 100 pts, ₱1 per photo flat, no cap on how '
  'many cameras an event buys, and the same rungs RELOAD an existing camera.';

INSERT INTO public.papic_one_tiers (service_code, points, sort_order)
VALUES ('PAPIC_CAMERA_MINI_DAY', 50, 10),
       ('PAPIC_ONE_100', 100, 20)
ON CONFLICT (service_code) DO UPDATE
   SET points     = EXCLUDED.points,
       sort_order = EXCLUDED.sort_order,
       is_active  = TRUE,
       updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. pool config — the free One allowance, and the death of 250
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.papic_event_pool_config
  ADD COLUMN IF NOT EXISTS free_one_camera_points INTEGER NOT NULL DEFAULT 5
    CHECK (free_one_camera_points >= 0);

COMMENT ON COLUMN public.papic_event_pool_config.free_one_camera_points IS
  'Dedicated points on the ONE free Papic One camera every event gets '
  '(owner-locked 2026-07-29 · 5). Admin-editable, exactly like free_grant_points '
  '— the app reads it through a single reader so the number the meter hands out '
  'and the number the copy quotes can never drift apart.';

-- The old ₱100 -> 250 pts conversion. Neutralised rather than dropped (see the
-- header): nothing reads it any more, and 0 means a stale reader grants nothing
-- instead of silently minting the retired value.
UPDATE public.papic_event_pool_config
   SET camera_grant_points = 0, updated_at = NOW()
 WHERE camera_grant_points IS DISTINCT FROM 0;

ALTER TABLE public.papic_event_pool_config
  ALTER COLUMN camera_grant_points SET DEFAULT 0;

COMMENT ON COLUMN public.papic_event_pool_config.camera_grant_points IS
  'RETIRED 2026-07-29. Was the flat ₱100 -> 250 pts Papic One conversion into '
  'the SHARED pool. Papic One points are now DEDICATED per camera and come from '
  'papic_one_tiers. Held at 0 so no stale reader can resurrect 250.';

REVOKE ALL ON public.papic_event_pool_config FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. the ledger learns about seats
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.papic_event_point_grants
  ADD COLUMN IF NOT EXISTS seat_id UUID
    REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.papic_event_point_grants.seat_id IS
  'NULL = a SHARED grant, summed into the event pool (Free pool · Pool top-ups '
  '· admin/comp). NOT NULL = DEDICATED to that one Papic One camera and '
  'deliberately invisible to papic_event_pool_status, so a camera''s own shots '
  'can never be spent by anybody else. Owner-locked 2026-07-29.';

CREATE INDEX IF NOT EXISTS papic_event_point_grants_seat_idx
  ON public.papic_event_point_grants(seat_id)
  WHERE seat_id IS NOT NULL;

-- Idempotency backstop for the FREE One camera: at most one un-ordered
-- ('camera_grant' with no order_id) grant per seat, ever. Paid reloads carry an
-- order_id and are therefore excluded — they legitimately stack, which is the
-- whole point of "reloadable".
CREATE UNIQUE INDEX IF NOT EXISTS papic_event_point_grants_one_free_camera_per_seat
  ON public.papic_event_point_grants (seat_id)
  WHERE source = 'camera_grant' AND order_id IS NULL AND seat_id IS NOT NULL;

REVOKE ALL ON public.papic_event_point_grants FROM anon, authenticated;

-- Per-camera LIFETIME spend. Sibling of papic_event_pool_usage (one row per
-- event); this is one row per seat. Not per-day: a Papic One bucket is a bucket,
-- not a daily treadmill — the per-day ledger (papic_seat_day_usage) is untouched
-- and still governs the tiers that really do have a daily budget.
CREATE TABLE IF NOT EXISTS public.papic_seat_point_usage (
  seat_id      UUID PRIMARY KEY REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  points_used  INTEGER NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.papic_seat_point_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papic_seat_point_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papic_seat_point_usage TO service_role;

COMMENT ON TABLE public.papic_seat_point_usage IS
  'Capture POINTS spent against a Papic One camera''s DEDICATED balance. '
  '1 photo = 1 pt · one 10-second clip = 8 pts. Seat-LIFETIME, one row per seat, '
  'bumped atomically by papic_reserve_camera_points and unwound by '
  'papic_release_camera_points. No policies: service-role / SECURITY DEFINER '
  'only, same posture as the grants ledger.';

-- What a Papic One order is FOR. An order alone cannot say "reload camera #3" —
-- orders carry no seat — so this is the order -> (camera, rung, points) map the
-- approval hook resolves. One row per order. Points are SNAPSHOTTED at order
-- time so an admin editing a rung later never silently reprices an order already
-- in reconciliation.
CREATE TABLE IF NOT EXISTS public.papic_one_orders (
  order_id     UUID PRIMARY KEY REFERENCES public.orders(order_id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  seat_id      UUID NOT NULL REFERENCES public.paparazzi_seats(seat_id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  points       INTEGER NOT NULL CHECK (points > 0),
  is_reload    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS papic_one_orders_event_idx ON public.papic_one_orders(event_id);
CREATE INDEX IF NOT EXISTS papic_one_orders_seat_idx  ON public.papic_one_orders(seat_id);

ALTER TABLE public.papic_one_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papic_one_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papic_one_orders TO service_role;

COMMENT ON TABLE public.papic_one_orders IS
  'Papic One order -> target camera. is_reload FALSE = the order created that '
  'camera; TRUE = the order tops up a camera that already exists (including the '
  'free one), which is what lets a couple add shots mid-event without reissuing '
  'a QR. Read by papic_grant_camera_points on approval.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. the pool stops counting dedicated points
-- ═══════════════════════════════════════════════════════════════════════════
-- Byte-identical to 20270902148488 § 3a except the granted_points sum now
-- excludes seat-scoped rows. Without this, buying a dedicated camera would ALSO
-- raise everybody else's shared ceiling — the exact "unshared" promise broken.

CREATE OR REPLACE FUNCTION public.papic_event_pool_status(
  p_event_id UUID
) RETURNS TABLE (
  applies          BOOLEAN,
  guest_count      INTEGER,
  base_points      INTEGER,
  granted_points   INTEGER,
  total_points     INTEGER,
  used_points      INTEGER,
  remaining_points INTEGER,
  soft_stop_at     INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_guest INTEGER;
  v_floor     INTEGER;
  v_ceiling   INTEGER;
  v_soft_pct  INTEGER;
  v_guests    INTEGER;
  v_base      INTEGER;
  v_granted   INTEGER;
  v_total     INTEGER;
  v_used      INTEGER;
  v_has_flat  BOOLEAN;
BEGIN
  v_has_flat := public.papic_event_has_flat_pass(p_event_id);

  -- SHARED grants only. seat_id NOT NULL is a Papic One camera's own balance.
  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id
     AND seat_id IS NULL;

  IF NOT v_has_flat AND COALESCE(v_granted, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT points_per_guest, floor_points, ceiling_points, soft_stop_pct
    INTO v_per_guest, v_floor, v_ceiling, v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  IF v_has_flat THEN
    SELECT GREATEST(
             COALESCE(e.final_pax, 0),
             COALESCE(e.estimated_pax, 0),
             COALESCE((
               SELECT COUNT(*) FROM public.guests g
                WHERE g.event_id = p_event_id
                  AND g.deleted_at IS NULL
                  AND g.rsvp_status::text <> 'declined'
             ), 0)
           )::INTEGER
      INTO v_guests
      FROM public.events e
     WHERE e.event_id = p_event_id;
    v_guests := COALESCE(v_guests, 0);
    v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest));
  ELSE
    v_guests := 0;
    v_base := 0;
  END IF;

  v_total := v_base + COALESCE(v_granted, 0);

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_event_pool_usage
   WHERE event_id = p_event_id;
  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    TRUE,
    v_guests,
    v_base,
    COALESCE(v_granted, 0),
    v_total,
    v_used,
    GREATEST(0, v_total - v_used),
    (v_total * v_soft_pct) / 100;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. the per-seat gate learns the dedicated branch
-- ═══════════════════════════════════════════════════════════════════════════
-- The three shipped per-seat functions keep their names and signatures, so
-- neither enforcement seam changes its call shape. A seat holding ANY
-- seat-scoped grant meters against THAT balance, event-lifetime; every other
-- seat falls through to the untouched per-day tier budget.

CREATE OR REPLACE FUNCTION public.papic_seat_dedicated_points(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
    FROM public.papic_event_point_grants
   WHERE seat_id = p_seat_id;
$$;

COMMENT ON FUNCTION public.papic_seat_dedicated_points(UUID) IS
  'Total points DEDICATED to one Papic One camera. 0 means "not a dedicated '
  'camera" — the caller then falls through to the shared pool. Every rung the '
  'camera has ever been loaded or reloaded with sums here.';

CREATE OR REPLACE FUNCTION public.papic_camera_points_remaining(
  p_seat_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ded    INTEGER;
  v_budget INTEGER;
  v_used   INTEGER;
BEGIN
  -- DEDICATED (Papic One): a lifetime bucket, not a daily one.
  v_ded := public.papic_seat_dedicated_points(p_seat_id);
  IF v_ded > 0 THEN
    SELECT COALESCE(points_used, 0) INTO v_used
      FROM public.papic_seat_point_usage WHERE seat_id = p_seat_id;
    RETURN GREATEST(0, v_ded - COALESCE(v_used, 0));
  END IF;

  SELECT tc.points_per_day
    INTO v_budget
    FROM public.paparazzi_seats ps
    JOIN public.papic_tier_config tc ON tc.tier_code = ps.tier
   WHERE ps.seat_id = p_seat_id;

  IF NOT FOUND OR v_budget IS NULL THEN
    RETURN 2147483647;
  END IF;

  SELECT COALESCE(points_used, 0)
    INTO v_used
    FROM public.papic_seat_day_usage
   WHERE seat_id = p_seat_id AND usage_date = CURRENT_DATE;

  RETURN GREATEST(0, v_budget - COALESCE(v_used, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.papic_reserve_camera_points(
  p_seat_id  UUID,
  p_event_id UUID,
  p_cost     INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ded    INTEGER;
  v_budget INTEGER;
  v_used   INTEGER;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;  -- defensive: a capture always costs >= 1 point
  END IF;

  -- DEDICATED (Papic One). Same atomic conditional-add shape as the per-day
  -- ledger: UPDATE ... WHERE used + cost <= budget RETURNING is atomic under row
  -- lock, so the capture that would breach the camera's own bucket can never
  -- persist, even with the phone firing concurrently.
  v_ded := public.papic_seat_dedicated_points(p_seat_id);
  IF v_ded > 0 THEN
    INSERT INTO public.papic_seat_point_usage (seat_id)
    VALUES (p_seat_id)
    ON CONFLICT (seat_id) DO NOTHING;

    UPDATE public.papic_seat_point_usage
       SET points_used = points_used + p_cost, updated_at = NOW()
     WHERE seat_id = p_seat_id
       AND points_used + p_cost <= v_ded
    RETURNING points_used INTO v_used;

    RETURN v_used IS NOT NULL;
  END IF;

  SELECT tc.points_per_day
    INTO v_budget
    FROM public.paparazzi_seats ps
    JOIN public.papic_tier_config tc ON tc.tier_code = ps.tier
   WHERE ps.seat_id = p_seat_id;

  IF NOT FOUND THEN
    RETURN FALSE;  -- unknown seat -> fail-CLOSED
  END IF;
  IF v_budget IS NULL THEN
    RETURN TRUE;   -- no per-day budget -> the event pool is the sole gate
  END IF;

  INSERT INTO public.papic_seat_day_usage (event_id, seat_id, usage_date)
  VALUES (p_event_id, p_seat_id, CURRENT_DATE)
  ON CONFLICT (seat_id, usage_date) DO NOTHING;

  UPDATE public.papic_seat_day_usage
     SET points_used = points_used + p_cost, updated_at = NOW()
   WHERE seat_id = p_seat_id
     AND usage_date = CURRENT_DATE
     AND points_used + p_cost <= v_budget
  RETURNING points_used INTO v_used;

  RETURN v_used IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.papic_release_camera_points(
  p_seat_id UUID,
  p_cost    INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_seat_id IS NULL OR p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Unwind whichever ledger the reserve actually booked against.
  IF public.papic_seat_dedicated_points(p_seat_id) > 0 THEN
    UPDATE public.papic_seat_point_usage
       SET points_used = GREATEST(0, points_used - p_cost), updated_at = NOW()
     WHERE seat_id = p_seat_id;
    RETURN TRUE;
  END IF;

  UPDATE public.papic_seat_day_usage
     SET points_used = GREATEST(0, points_used - p_cost), updated_at = NOW()
   WHERE seat_id = p_seat_id
     AND usage_date = CURRENT_DATE;
  RETURN TRUE;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. the event pool learns to stand down for a dedicated camera
-- ═══════════════════════════════════════════════════════════════════════════
-- A dedicated capture spends the camera's OWN points. If the shared pool also
-- charged for it the couple would pay twice for one photo — and a Papic One
-- camera would stop shooting the moment the free 50-pt pool ran dry, which is
-- precisely the coupling "unshared" exists to remove. New names (not extra
-- parameters) because an overload makes the PostgREST call ambiguous.

-- TRI-STATE on purpose, and this is the load-bearing detail:
--    1 = booked against the shared pool
--    0 = refused (pool exhausted)
--   -1 = not applicable — a dedicated camera, nothing was booked
-- A plain BOOLEAN would collapse 1 and -1 into "true", and the caller uses that
-- distinction to decide whether a LATER failure has pool points to unwind.
-- Releasing points that were never booked would silently refund the couple's
-- shared pool every time a dedicated camera's upload aborted.
CREATE OR REPLACE FUNCTION public.papic_reserve_event_points_for_seat(
  p_event_id UUID,
  p_seat_id  UUID,
  p_cost     INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_seat_id IS NOT NULL AND public.papic_seat_dedicated_points(p_seat_id) > 0 THEN
    RETURN -1;  -- dedicated: already metered by the seat gate, pool untouched
  END IF;
  RETURN CASE
    WHEN public.papic_reserve_event_points(p_event_id, p_cost) THEN 1
    ELSE 0
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.papic_event_points_remaining_for_seat(
  p_event_id UUID,
  p_seat_id  UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_seat_id IS NOT NULL AND public.papic_seat_dedicated_points(p_seat_id) > 0 THEN
    RETURN 2147483647;  -- the shared pool does not bound this camera
  END IF;
  RETURN public.papic_event_points_remaining(p_event_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. order -> dedicated points
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces the "count this order's mini seats × camera_grant_points(250) into
-- ONE shared grant" engine. Two shapes, one function, because
-- lib/sku-activation.ts must keep exactly one hook for "a paid Papic One order
-- became points":
--   (A) a papic_one_orders row -> grant its snapshotted points to ITS camera.
--       This is both the new-camera buy AND the reload; they differ only in
--       whether the seat already existed.
--   (B) no such row -> a legacy PAPIC_CAMERAS multi-camera order. Grants the ₱50
--       rung's points to EACH mini seat of that order, seat-scoped. Same
--       economics as buying those cameras one at a time, so the shipped picker
--       keeps working at the new prices instead of silently granting nothing.
-- Idempotent by order_id under an advisory lock, exactly as before.

CREATE OR REPLACE FUNCTION public.papic_grant_camera_points(
  p_event_id UUID,
  p_order_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seat  UUID;
  v_pts   INTEGER;
  v_per   INTEGER;
  v_n     INTEGER;
BEGIN
  IF p_event_id IS NULL OR p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE order_id = p_order_id AND source = 'camera_grant'
  ) THEN
    RETURN 0;  -- a re-approved order must never double-grant
  END IF;

  -- (A) a Papic One rung aimed at one camera (new OR reload)
  SELECT o.seat_id, o.points INTO v_seat, v_pts
    FROM public.papic_one_orders o
   WHERE o.order_id = p_order_id;

  IF v_seat IS NOT NULL AND COALESCE(v_pts, 0) > 0 THEN
    INSERT INTO public.papic_event_point_grants
      (event_id, seat_id, points, source, order_id, note)
    VALUES (p_event_id, v_seat, v_pts, 'camera_grant', p_order_id,
            format('Papic One · %s pts dedicated to one camera', v_pts));
    RETURN v_pts;
  END IF;

  -- (B) legacy multi-camera PAPIC_CAMERAS order
  SELECT t.points INTO v_per
    FROM public.papic_one_tiers t
   WHERE t.service_code = 'PAPIC_CAMERA_MINI_DAY' AND t.is_active;
  v_per := COALESCE(v_per, 50);
  IF v_per <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.papic_event_point_grants
    (event_id, seat_id, points, source, order_id, note)
  SELECT p_event_id, ps.seat_id, v_per, 'camera_grant', p_order_id,
         format('Papic One · %s pts dedicated to camera #%s', v_per, ps.seat_index)
    FROM public.paparazzi_seats ps
   WHERE ps.paid_order_id = p_order_id
     AND ps.tier = 'mini';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN COALESCE(v_n, 0) * v_per;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. the free Papic One camera — one per event, 5 dedicated points
-- ═══════════════════════════════════════════════════════════════════════════
-- Everybody gets one real dedicated camera to feel the product with. It lives at
-- a FIXED seat_index (110) — above the 3 free SHARED seats (100..102), below the
-- paid range (200+) — so "does this event already have one?" is a unique-key
-- question, not a heuristic. Idempotent twice over: (event_id, seat_index) UNIQUE
-- stops a second seat, and papic_event_point_grants_one_free_camera_per_seat
-- stops a second free grant. Called from every event-commit path AND lazily from
-- the Papic studio as a self-heal, so it WILL run more than once per event.
--
-- tier stays 'free': the paid gate on both capture seams refuses any seat whose
-- tier is paid and whose order is not settled, and this camera has no order to
-- settle. Its budget comes from its dedicated grant, not from its tier, so
-- 'free' costs it nothing.

CREATE OR REPLACE FUNCTION public.papic_ensure_free_one_camera(
  p_event_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pts   INTEGER;
  v_seat  UUID;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT free_one_camera_points INTO v_pts
    FROM public.papic_event_pool_config WHERE config_key = 'default';
  v_pts := COALESCE(v_pts, 5);
  IF v_pts <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT seat_id INTO v_seat
    FROM public.paparazzi_seats
   WHERE event_id = p_event_id AND seat_index = 110;

  IF v_seat IS NULL THEN
    INSERT INTO public.paparazzi_seats
      (event_id, seat_index, sku_code, tier, claim_qr_token)
    VALUES (p_event_id, 110, 'PAPIC_CAMERA_ONE_FREE', 'free',
            translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'))
    ON CONFLICT (event_id, seat_index) DO NOTHING;

    SELECT seat_id INTO v_seat
      FROM public.paparazzi_seats
     WHERE event_id = p_event_id AND seat_index = 110;
  END IF;

  IF v_seat IS NULL THEN
    RETURN NULL;  -- seat unavailable; the next call retries
  END IF;

  INSERT INTO public.papic_event_point_grants
    (event_id, seat_id, points, source, note)
  VALUES (p_event_id, v_seat, v_pts, 'camera_grant',
          'Free Papic One — one dedicated camera per event (owner-locked 2026-07-29).')
  ON CONFLICT DO NOTHING;

  RETURN v_seat;
END;
$$;

-- Backfill every event that exists today, so the free One camera is not a
-- new-signups-only perk. Safe to re-run — both idempotency guards apply.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT event_id FROM public.events LOOP
    PERFORM public.papic_ensure_free_one_camera(r.event_id);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. no cap on Papic One
-- ═══════════════════════════════════════════════════════════════════════════
-- tier 'mini' carried a ₱6,000 wedding-day order-total cap from the days when
-- One was a per-camera-per-day rate. The owner locked "NO cap on how many One
-- cameras an event can buy" on 2026-07-29, and a ₱6,000 ceiling silently caps it
-- at 60 cameras — so the cap goes rather than being left to contradict the
-- promise the card makes.
UPDATE public.papic_tier_config
   SET wedding_day_cap_php = NULL, updated_at = NOW()
 WHERE tier_code = 'mini' AND wedding_day_cap_php IS DISTINCT FROM NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. grants — service_role ONLY on everything new
-- ═══════════════════════════════════════════════════════════════════════════
-- Every one of these is called from a server action / route handler holding the
-- service-role key. Granting anon/authenticated would both widen the committed
-- exposure surface and hand a claimer session a direct line to the money ledger:
-- these are SECURITY DEFINER, PostgREST publishes anything executable at
-- /rest/v1/rpc/, and papic_ensure_free_one_camera MINTS POINTS — a self-service
-- endpoint for that is exactly the fence this whole line of work exists to build.
--
-- The REVOKE is not optional and not redundant: a new function grants EXECUTE to
-- PUBLIC by default, so creating it is already publishing it. Revoke first, then
-- grant the one role that may call it.

REVOKE ALL ON FUNCTION public.papic_seat_dedicated_points(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papic_reserve_event_points_for_seat(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papic_event_points_remaining_for_seat(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.papic_ensure_free_one_camera(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.papic_seat_dedicated_points(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.papic_reserve_event_points_for_seat(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.papic_event_points_remaining_for_seat(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.papic_ensure_free_one_camera(UUID) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. post-conditions — fail loudly rather than half-apply
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_price  NUMERIC;
  v_pts    INTEGER;
  v_dupes  INTEGER;
  v_n      INTEGER;
BEGIN
  -- Pool rungs, at the owner's numbers, live.
  SELECT retail_price_php INTO v_price FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST';
  IF v_price IS DISTINCT FROM 1000 THEN RAISE EXCEPTION 'PAPIC_GUEST price is % (want 1000)', v_price; END IF;
  SELECT retail_price_php INTO v_price FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST_6K';
  IF v_price IS DISTINCT FROM 2000 THEN RAISE EXCEPTION 'PAPIC_GUEST_6K price is % (want 2000)', v_price; END IF;
  SELECT retail_price_php INTO v_price FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST_10K';
  IF v_price IS DISTINCT FROM 3000 THEN RAISE EXCEPTION 'PAPIC_GUEST_10K price is % (want 3000)', v_price; END IF;

  SELECT COUNT(*) INTO v_n
    FROM public.platform_retail_catalog_v2
   WHERE service_code IN ('PAPIC_GUEST', 'PAPIC_GUEST_6K', 'PAPIC_GUEST_10K')
     AND is_active;
  IF v_n <> 3 THEN RAISE EXCEPTION 'expected 3 ACTIVE Papic Pool rungs, found %', v_n; END IF;

  -- Every Pool rung must be freely repeatable now.
  SELECT COUNT(*) INTO v_n FROM public.papic_pass_tiers WHERE is_active AND is_topup;
  IF v_n <> 0 THEN RAISE EXCEPTION '% Pool rung(s) are still gated as top-ups', v_n; END IF;

  -- One rungs: ₱1 per photo, flat, both live.
  SELECT c.retail_price_php, t.points INTO v_price, v_pts
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_one_tiers t ON t.service_code = c.service_code
   WHERE c.service_code = 'PAPIC_CAMERA_MINI_DAY';
  IF v_price IS DISTINCT FROM 50 OR v_pts IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'Papic One ₱50 rung failed to settle (price % pts %)', v_price, v_pts;
  END IF;

  SELECT c.retail_price_php, t.points INTO v_price, v_pts
    FROM public.platform_retail_catalog_v2 c
    JOIN public.papic_one_tiers t ON t.service_code = c.service_code
   WHERE c.service_code = 'PAPIC_ONE_100';
  IF v_price IS DISTINCT FROM 100 OR v_pts IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'Papic One ₱100 rung failed to settle (price % pts %)', v_price, v_pts;
  END IF;

  -- 250 must not survive.
  SELECT camera_grant_points INTO v_pts FROM public.papic_event_pool_config WHERE config_key = 'default';
  IF COALESCE(v_pts, 0) <> 0 THEN
    RAISE EXCEPTION 'camera_grant_points is still % — the retired 250-pt conversion survived', v_pts;
  END IF;

  -- Every event holds its free One camera + its 5 dedicated points.
  SELECT COUNT(*) INTO v_n
    FROM public.events e
   WHERE NOT EXISTS (
     SELECT 1 FROM public.paparazzi_seats ps
      WHERE ps.event_id = e.event_id AND ps.seat_index = 110
   );
  IF v_n > 0 THEN RAISE EXCEPTION '% event(s) missing their free Papic One camera', v_n; END IF;

  -- /pricing emits every ACTIVE SKU as a schema.org Offer using its title
  -- verbatim, so two active rows may never share one.
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT title FROM public.platform_retail_catalog_v2
     WHERE is_active GROUP BY title HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'duplicate titles among ACTIVE catalog SKUs (% group(s))', v_dupes;
  END IF;
END $$;

COMMIT;
