-- ============================================================================
-- 20270826385580_papic_event_capture_pool.sql
--
-- Papic — the EVENT-SCOPED capture fence for a FLAT PER-EVENT PASS (Phase 0c).
--
-- WHY THIS EXISTS
--   A flat per-event Papic pass (today: PAPIC_UNLOCK ₱15,000 · PAPIC_UNLOCK_LTD
--   ₱9,000; tomorrow: the ₱1,499 flat pass the monetization council proposed)
--   currently bypasses metering ENTIRELY — both enforcement seams do
--   `if (!unlocked) { …points gate… }`, so a pass event is an unbounded
--   capture free-for-all. At 300 pax that MODELS to ~24% gross margin against a
--   ₱1,499 pass (a model, not a measurement — Papic is pre-revenue). This adds
--   the missing fence: ONE event-level capture-points pool, consulted ALONGSIDE
--   the existing per-camera-per-day budget, with the TIGHTER of the two winning.
--
-- THE POOL FORMULA — DERIVED FROM GUEST COUNT, NOT A FLAT NUMBER
--   pool = clamp(guest_count × points_per_guest, floor_points, ceiling_points)
--   Seeded defaults (ADMIN-TUNABLE in papic_event_pool_config, never hardcoded
--   in app code):
--     points_per_guest = 150   ← EXACTLY the credits-per-guest already SHIPPED
--                                in apps/web/lib/papic-guest.ts
--                                (GUEST_CAPTURE_CREDITS = 150). So the pool
--                                REPRODUCES today's per-guest allowance as an
--                                event aggregate: at 150 pax → 22,500 pts,
--                                identical to 150 × 150 today. It is NOT a
--                                tightening. (A flat 10,000-pt pool WOULD have
--                                been a 3× tightening above 66 pax — that is
--                                the trap this formula avoids.)
--     floor_points     = 5,000 ← small events never feel poorer than a ~33-pax
--                                event. A 20-pax intimate wedding still gets
--                                5,000 captures, not 3,000.
--     ceiling_points   = 30,000← the fat-tail brake, set exactly at today's
--                                200-pax shipped equivalent (200 × 150). It
--                                binds ONLY above 200 pax, i.e. only where an
--                                unbounded pass would take the flat-pass margin
--                                under water.
--     soft_stop_pct    = 85    ← the UI warns here, before the hard stop.
--   Consequence: for every event at or below 200 pax the pool is >= what the
--   shipped per-guest model already granted. Nothing gets smaller.
--
-- POINT COSTS are unchanged and shared with the per-camera ladder:
--   1 photo = 1 point · 1 five-second clip = 3 points.
--
-- SCOPE FENCE — the pool applies ONLY to events holding an ACTIVE flat pass
--   (papic_event_pool_config.pass_service_codes). Every non-pass event returns
--   "unlimited" from every function here, so today's behaviour is byte-identical.
--
-- TOP-UP PLUMBING (no SKU, no price — owner action)
--   papic_event_point_grants is the additive ledger the pool total sums. A
--   top-up is one INSERT. This migration deliberately does NOT create or price
--   a top-up SKU.
--
-- ADDITIVE + IDEMPOTENT. Creates three tables + six functions. Nothing is
-- dropped, no existing function is altered, no existing row changes. Inert on
-- apply: until the app calls the new RPCs, nothing here runs.
--
-- ⚠ PRE-APPLY VERIFY ON PROD:
--   • SELECT max(version) FROM supabase_migrations.schema_migrations;
--     -- confirm 20270826385580 sorts after it.
--   • \d public.events  -- confirm estimated_pax + final_pax exist (they do:
--     migrations 20261213000000 / 20261214000000).
-- ============================================================================

BEGIN;

-- ---- 1. admin-editable pool parameters -----------------------------------
-- Pattern H (static reference, mirrors papic_tier_config): RLS ENABLED in the
-- same migration, public SELECT, NO write policy (service-role / admin only).

CREATE TABLE IF NOT EXISTS public.papic_event_pool_config (
  config_key         TEXT PRIMARY KEY DEFAULT 'default',
  points_per_guest   INTEGER NOT NULL DEFAULT 150
                       CHECK (points_per_guest >= 0),
  floor_points       INTEGER NOT NULL DEFAULT 5000
                       CHECK (floor_points >= 0),
  ceiling_points     INTEGER NOT NULL DEFAULT 30000
                       CHECK (ceiling_points >= 0),
  soft_stop_pct      INTEGER NOT NULL DEFAULT 85
                       CHECK (soft_stop_pct BETWEEN 1 AND 100),
  -- The flat per-event passes this fence governs. An event holding an ACTIVE
  -- order for ANY of these is a "pass event". Admin-editable so the ₱1,499 flat
  -- pass can be added without a deploy.
  pass_service_codes TEXT[] NOT NULL DEFAULT ARRAY['PAPIC_UNLOCK','PAPIC_UNLOCK_LTD'],
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT papic_event_pool_config_ceiling_ge_floor
    CHECK (ceiling_points >= floor_points)
);

COMMENT ON TABLE public.papic_event_pool_config IS
  'Papic event-scoped capture fence parameters (Phase 0c). pool = clamp('
  'guest_count * points_per_guest, floor_points, ceiling_points). Defaults '
  '150/5000/30000 mirror the SHIPPED per-guest 150-credit model (lib/'
  'papic-guest.ts) so the fence is not a tightening below 200 pax; the ceiling '
  'is the fat-tail margin brake. PRICING-RELEVANT — admin-editable on purpose, '
  'never hardcode these in app code. pass_service_codes lists the flat '
  'per-event passes this fence governs; an event with none is unaffected.';

ALTER TABLE public.papic_event_pool_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS papic_event_pool_config_public_read ON public.papic_event_pool_config;
CREATE POLICY papic_event_pool_config_public_read ON public.papic_event_pool_config
  FOR SELECT USING (TRUE);
-- No INSERT/UPDATE/DELETE policy: writes are service-role / admin only.

INSERT INTO public.papic_event_pool_config (config_key) VALUES ('default')
ON CONFLICT (config_key) DO NOTHING;

-- ---- 2. top-up grants ledger (plumbing only — no SKU, no price) -----------

CREATE TABLE IF NOT EXISTS public.papic_event_point_grants (
  grant_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  points       INTEGER NOT NULL CHECK (points > 0),
  source       TEXT NOT NULL DEFAULT 'admin'
                 CHECK (source IN ('admin', 'topup_order', 'comp', 'migration')),
  order_id     UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS papic_event_point_grants_event_idx
  ON public.papic_event_point_grants(event_id);

COMMENT ON TABLE public.papic_event_point_grants IS
  'Additive top-up ledger for the Papic event capture pool (Phase 0c). Summed '
  'into the pool total. A top-up is one INSERT — the top-up SKU itself is '
  'deliberately NOT created or priced here (owner action).';

ALTER TABLE public.papic_event_point_grants ENABLE ROW LEVEL SECURITY;
-- No policies: service-role / SECURITY DEFINER reads only. The pool functions
-- below are SECURITY DEFINER, so they see the ledger regardless.

-- ---- 3. per-event usage ledger -------------------------------------------
-- ONE row per event (not per day): the pass fence is an event-LIFETIME budget,
-- not a daily treadmill. The per-camera-per-day ledger (papic_seat_day_usage)
-- is untouched and keeps its own semantics.

CREATE TABLE IF NOT EXISTS public.papic_event_pool_usage (
  event_id     UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  points_used  INTEGER NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.papic_event_pool_usage IS
  'Capture POINTS spent against the event-scoped pass pool (Phase 0c). 1 photo '
  '= 1 pt · 1 five-second clip = 3 pts. Event-LIFETIME, one row per event. '
  'Bumped atomically by papic_reserve_event_points; unwound by '
  'papic_release_event_points when the co-enforced per-seat gate refuses.';

ALTER TABLE public.papic_event_pool_usage ENABLE ROW LEVEL SECURITY;
-- No policies: service-role / SECURITY DEFINER only (same posture as the grants
-- ledger — the fence must not be readable or writable from a claimer session).

-- ---- 4. helper: does this event hold an ACTIVE flat per-event pass? -------

CREATE OR REPLACE FUNCTION public.papic_event_has_flat_pass(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codes  TEXT[];
  v_active BOOLEAN;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT pass_service_codes, is_active
    INTO v_codes, v_active
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  -- No config row, fence switched off, or an empty pass list -> the fence does
  -- not apply anywhere (today's behaviour, byte-identical).
  IF NOT FOUND OR v_active IS NOT TRUE OR v_codes IS NULL
     OR array_length(v_codes, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.event_id = p_event_id
       AND o.service_key = ANY (v_codes)
       -- orders.status is the order_status ENUM — cast to text before compare.
       AND o.status::text IN ('paid', 'fulfilled')
  );
END;
$$;

-- ---- 5. pool status (drives the SOFT-STOP signal + admin views) -----------
-- Returns applies=FALSE for every non-pass event; the app then treats the pool
-- as absent. total = clamp(guests * per_guest, floor, ceiling) + granted top-ups.

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
BEGIN
  IF NOT public.papic_event_has_flat_pass(p_event_id) THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT points_per_guest, floor_points, ceiling_points, soft_stop_pct
    INTO v_per_guest, v_floor, v_ceiling, v_soft_pct
    FROM public.papic_event_pool_config
   WHERE config_key = 'default';

  -- Guest count = the most generous defensible number, so the fence never
  -- under-serves a couple whose RSVPs lag: the frozen final_pax, the couple's
  -- own estimate, and the live non-declined guest rows — whichever is largest.
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

  SELECT COALESCE(SUM(points), 0)::INTEGER
    INTO v_granted
    FROM public.papic_event_point_grants
   WHERE event_id = p_event_id;

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

-- ---- 6. read-only probe for the PRESIGN seam ------------------------------
-- MAXINT for a non-pass event (fence absent) so the presign gate is a no-op.

CREATE OR REPLACE FUNCTION public.papic_event_points_remaining(
  p_event_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applies   BOOLEAN;
  v_remaining INTEGER;
BEGIN
  SELECT s.applies, s.remaining_points
    INTO v_applies, v_remaining
    FROM public.papic_event_pool_status(p_event_id) s;

  IF NOT FOUND OR v_applies IS NOT TRUE THEN
    RETURN 2147483647;  -- no fence on this event
  END IF;

  RETURN GREATEST(0, COALESCE(v_remaining, 0));
END;
$$;

-- ---- 7. atomic conditional reserve (the RECORD-layer gate) ----------------
-- TRUE iff `cost` points were booked (or the fence doesn't apply). The
-- UPDATE ... WHERE points_used + cost <= total RETURNING is atomic under row
-- lock, so the capture that would breach the pool can never persist even under
-- concurrent cameras.

CREATE OR REPLACE FUNCTION public.papic_reserve_event_points(
  p_event_id UUID,
  p_cost     INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applies BOOLEAN;
  v_total   INTEGER;
  v_used    INTEGER;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;  -- defensive: a capture always costs >= 1 point
  END IF;
  IF p_event_id IS NULL THEN
    RETURN FALSE;  -- fail-CLOSED on a missing event
  END IF;

  SELECT s.applies, s.total_points
    INTO v_applies, v_total
    FROM public.papic_event_pool_status(p_event_id) s;

  -- Fence absent (non-pass event) -> allow, ledger untouched.
  IF NOT FOUND OR v_applies IS NOT TRUE THEN
    RETURN TRUE;
  END IF;

  INSERT INTO public.papic_event_pool_usage (event_id)
  VALUES (p_event_id)
  ON CONFLICT (event_id) DO NOTHING;

  UPDATE public.papic_event_pool_usage
     SET points_used = points_used + p_cost, updated_at = NOW()
   WHERE event_id = p_event_id
     AND points_used + p_cost <= v_total
  RETURNING points_used INTO v_used;

  RETURN v_used IS NOT NULL;
END;
$$;

-- ---- 8. release (unwind) --------------------------------------------------
-- Used when the two co-enforced gates disagree: whichever budget was booked
-- first is released when the other refuses, so a refused capture never leaves
-- points spent. Floored at 0; never throws.

CREATE OR REPLACE FUNCTION public.papic_release_event_points(
  p_event_id UUID,
  p_cost     INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL OR p_cost IS NULL OR p_cost <= 0 THEN
    RETURN FALSE;
  END IF;
  UPDATE public.papic_event_pool_usage
     SET points_used = GREATEST(0, points_used - p_cost), updated_at = NOW()
   WHERE event_id = p_event_id;
  RETURN TRUE;
END;
$$;

-- Per-CAMERA release twin — the per-seat ledger needs the same unwind so a
-- capture refused by the event fence doesn't burn a seat point.
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
  UPDATE public.papic_seat_day_usage
     SET points_used = GREATEST(0, points_used - p_cost), updated_at = NOW()
   WHERE seat_id = p_seat_id
     AND usage_date = CURRENT_DATE;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_event_has_flat_pass(UUID)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_event_pool_status(UUID)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_event_points_remaining(UUID)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_reserve_event_points(UUID, INTEGER)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_release_event_points(UUID, INTEGER)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.papic_release_camera_points(UUID, INTEGER)
  TO authenticated, anon, service_role;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase SQL editor):
--   SELECT * FROM public.papic_event_pool_config;            -- 1 row, 150/5000/30000/85
--   -- A NON-pass event: fence absent, everything unlimited.
--   SELECT * FROM public.papic_event_pool_status('<any_event>');   -- applies = f
--   SELECT public.papic_event_points_remaining('<any_event>');     -- 2147483647
--   SELECT public.papic_reserve_event_points('<any_event>', 1);    -- t, no ledger row
--   -- A PASS event (owns an ACTIVE PAPIC_UNLOCK order):
--   SELECT * FROM public.papic_event_pool_status('<pass_event>');
--     -- applies = t · base = clamp(guests*150, 5000, 30000) · soft_stop_at = 85%
--   SELECT public.papic_reserve_event_points('<pass_event>', 3);   -- t (clip = 3 pts)
--   SELECT public.papic_release_event_points('<pass_event>', 3);   -- unwinds it
-- ============================================================================
