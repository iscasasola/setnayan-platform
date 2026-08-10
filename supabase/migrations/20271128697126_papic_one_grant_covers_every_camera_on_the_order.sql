-- ═══════════════════════════════════════════════════════════════════════════
-- Papic One — ONE order may fund MORE THAN ONE dedicated camera
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY: the onboarding Papic picker (owner 2026-08-11 — "pick how many Papic One
-- they want to add") lets a couple add N dedicated cameras at the end of
-- onboarding. That has to mint ONE order with ONE reference code: minting N
-- orders would hand a brand-new couple N separate bank transfers to make before
-- they have even seen their dashboard.
--
-- ── THE ACTUAL BLOCKER WAS THE PRIMARY KEY, NOT THE FUNCTION ───────────────
-- ⚠ An earlier draft of this migration claimed `papic_grant_camera_points` had
-- a silent multi-row bug, because branch (A) reads the order's camera with a
-- bare `SELECT o.seat_id, o.points INTO …` and plpgsql keeps an arbitrary row
-- rather than raising. That reasoning was WRONG and is recorded here so it is
-- not re-derived: `papic_one_orders.order_id` is the PRIMARY KEY, so the schema
-- has always permitted exactly ONE row per order and the single-row read was
-- correct for the table it was reading. The database was refusing the second
-- camera outright (23505 on papic_one_orders_pkey) — a REJECTION, not a silent
-- miscount. Caught by writing the test first; the assertion that would have
-- "proved" the bug never got to run.
--
-- So this migration changes TWO things, in the only order that works:
--
--   1. The identity of a mapping row becomes (order_id, seat_id). One row PER
--      CAMERA, many cameras per order. This is a WIDENING — every existing row
--      stays valid and unique, because a table that held at most one row per
--      order trivially holds at most one row per (order, seat).
--
--   2. Branch (A) of the grant function iterates instead of reading one row.
--      That is not optional once (1) lands: with several rows and a single-row
--      SELECT, the cameras after the first WOULD then be provisioned, paid for,
--      and funded with nothing — the silent failure the earlier draft imagined,
--      which step (1) would have created for real.
--
-- Each row keeps its OWN snapshotted `points`, so an order mixing sizes grants
-- each camera the bucket it was actually sold rather than a count × one rate.
--
-- IDEMPOTENCY IS UNCHANGED AND STILL ORDER-SCOPED: the `EXISTS … source =
-- 'camera_grant'` guard returns 0 before any insert, so a re-approval cannot
-- double-grant whether the order funded one camera or ten. It must keep coming
-- BEFORE the loop for that to hold — behind it, a re-approval would add a whole
-- second set of grants. Reversal is already symmetric: it deletes by order_id,
-- which covers N rows exactly as it covered one.

-- ── 1 · one mapping row PER CAMERA ─────────────────────────────────────────
-- Nothing references this key (no FK anywhere targets papic_one_orders), so the
-- swap is local to this table. Guarded so a re-run is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'papic_one_orders'
       AND c.conname = 'papic_one_orders_pkey'
       AND c.contype = 'p'
       AND (SELECT COUNT(*) FROM unnest(c.conkey)) = 1
  ) THEN
    ALTER TABLE public.papic_one_orders DROP CONSTRAINT papic_one_orders_pkey;
    ALTER TABLE public.papic_one_orders
      ADD CONSTRAINT papic_one_orders_pkey PRIMARY KEY (order_id, seat_id);
  END IF;
END $$;

-- The old PK doubled as the lookup index for "this order's rows". A composite
-- key leads on order_id, so that lookup is still covered — but the reversal and
-- grant paths both filter by order_id alone, so the leading column matters and
-- is asserted here rather than assumed.
COMMENT ON CONSTRAINT papic_one_orders_pkey ON public.papic_one_orders IS
  'One row PER CAMERA. An order may fund several dedicated cameras (the '
  'onboarding picker sells N in one go); order_id leads so order-scoped '
  'lookups keep their index.';

-- ── 2 · the grant covers every camera on the order ─────────────────────────
CREATE OR REPLACE FUNCTION public.papic_grant_camera_points(
  p_event_id UUID,
  p_order_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per   INTEGER;
  v_n     INTEGER;
  v_total INTEGER := 0;
  v_row   RECORD;
BEGIN
  IF p_event_id IS NULL OR p_order_id IS NULL THEN
    RETURN 0;
  END IF;

  -- ⚠ CARRIED FORWARD FROM 20271114597183 (2026-08-06) — DO NOT DROP IT AGAIN.
  -- p_event_id arrives from the CALLER; without this the points from one
  -- wedding's order could be minted onto another wedding. Fails CLOSED: an
  -- order we cannot tie to this event grants nothing.
  --
  -- 🔑 A `CREATE OR REPLACE FUNCTION` REPLACES THE WHOLE BODY. The first draft
  -- of this migration was written against the ORIGINAL definition in
  -- 20271019231590 and silently reverted this guard — a security fix undone by
  -- an unrelated feature change, with nothing but `papic-camera-grant-authz`'s
  -- source assertion to catch it. Before replacing any function, find the LAST
  -- migration that defines it, not the one that created it.
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.order_id = p_order_id
       AND o.event_id = p_event_id
  ) THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.papic_event_point_grants
     WHERE order_id = p_order_id AND source = 'camera_grant'
  ) THEN
    RETURN 0;  -- a re-approved order must never double-grant
  END IF;

  -- (A) Papic One rungs aimed at this order's cameras (new OR reload).
  -- ONE ROW PER CAMERA since the PK widened above. Each carries its own
  -- snapshotted `points`, so a mixed-size order stays correct — never
  -- count × one rate.
  FOR v_row IN
    SELECT o.seat_id, o.points
      FROM public.papic_one_orders o
     WHERE o.order_id = p_order_id
       AND o.seat_id IS NOT NULL
       AND COALESCE(o.points, 0) > 0
  LOOP
    INSERT INTO public.papic_event_point_grants
      (event_id, seat_id, points, source, order_id, note)
    VALUES (p_event_id, v_row.seat_id, v_row.points, 'camera_grant', p_order_id,
            format('Papic One · %s pts dedicated to one camera', v_row.points));
    v_total := v_total + v_row.points;
  END LOOP;

  IF v_total > 0 THEN
    RETURN v_total;
  END IF;

  -- (B) legacy multi-camera PAPIC_CAMERAS order — unchanged, and still reached
  -- because branch (A) only returns early when it actually granted something.
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

-- Re-asserted, not assumed. `CREATE OR REPLACE` does preserve an existing ACL,
-- so this is belt over brace — but the only caller is the admin activation hook
-- running as service_role, and restating it here means the closure travels with
-- the definition instead of living one migration away (20271114597183).
REVOKE EXECUTE ON FUNCTION public.papic_grant_camera_points(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.papic_grant_camera_points(UUID, UUID) IS
  'Grant a settled order''s dedicated Papic One points. Refuses an order that '
  'does not belong to p_event_id. (A) one grant per papic_one_orders row — an '
  'order may fund SEVERAL cameras, each with its own snapshotted points; '
  '(B) falls back to the legacy PAPIC_CAMERAS shape. Idempotent by order_id.';
