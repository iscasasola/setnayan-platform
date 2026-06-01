-- ============================================================================
-- 20260718000000_papic_guest_seats_provisioning.sql
--
-- Closes the two partial Papic SKUs in one pass:
--
--   • PAPIC_SEATS (₱2,999 · "Turn five friends into your photo crew") —
--     v2-catalog.ts marks it 'partial' because "seat provisioning not wired".
--     The paparazzi_seats table (migration 20260520015000) and its RLS already
--     exist, but nothing ever materialized seat rows or let a friend claim one.
--     This migration adds:
--       - papic_provision_seats(p_event_id) — couple-gated SECURITY DEFINER fn
--         that idempotently materializes PAPIC_SEAT_COUNT (5) seat rows for an
--         event that owns a paid PAPIC_SEATS order, each with a fresh claim
--         token. Safe to call repeatedly — only tops up missing indexes.
--       - papic_claim_seat(p_token) — SECURITY DEFINER fn the public claim
--         route (/papic/claim/[token]) calls to bind the signed-in user to the
--         seat the token points at. paparazzi_seats RLS is strict couple-only,
--         so the public claim flow MUST go through this fn (auth.uid() is the
--         claimer; the token is the access gate).
--
--   • PAPIC_GUEST (₱2,999 · "Every guest's phone, a candid camera" — the
--     Premium Guest Camera Pack) — v2-catalog.ts marks it 'partial' because
--     "quota enforcement not wired". The web-capture surface is scaffolded but
--     there was no per-guest capture limit and no guest-camera table. This adds:
--       - papic_guest_captures — one row per guest capture, keyed by guest_id.
--         Separate from papic_photos (which is SEAT-bound: NOT NULL FK to
--         paparazzi_seats, governed by PAPIC_SEATS). Guest cameras are a
--         different actor (the guest, via their guests.qr_token link) and a
--         different SKU, so their per-guest 150-credit pool lives in its own
--         table.
--       - papic_record_guest_capture(p_guest_id, p_r2_object_key) —
--         SECURITY DEFINER fn the guest-capture route handler calls. It
--         verifies the event owns PAPIC_GUEST, counts the guest's existing
--         captures, REJECTS the insert once the 150-credit pool is exhausted
--         (the authoritative server-side quota gate), inserts, and returns the
--         remaining credit count. The guest camera is a public surface (no RLS
--         session — the guest is identified by their qr_token, not auth), so
--         this fn is how the quota is enforced under the same transaction as
--         the insert.
--
-- WHY a SECURITY DEFINER quota fn (not an RLS WITH CHECK count) — RLS WITH
-- CHECK can't reliably express "fewer than N existing rows for this guest"
-- without a subquery that races under concurrent inserts. A SECURITY DEFINER
-- fn counts + inserts in one statement, advisory-locked per guest, so two
-- simultaneous captures from the same phone can't both slip past 150.
--
-- SAFETY (pilot day) — purely additive: one new table + three new functions.
-- No drops, no column changes to existing tables, no behavior change for any
-- event that doesn't own these SKUs. Idempotent (CREATE TABLE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS + CREATE). Safe to apply to
-- a live database with no backfill.
--
-- NOTE — until this migration is applied to prod, every app query that touches
-- papic_guest_captures / the new RPCs runs ONLY behind the owned-SKU Papic
-- gate (the couple's auth-bound add-on page, the token-gated claim route, and
-- the guest-token-gated capture route). The always-rendered public landing
-- page never references any of it. App-side helpers also graceful-degrade on
-- 42P01 (undefined_table) / 42883 (undefined_function) so a pre-migration
-- database surfaces the upgrade/empty state rather than throwing.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. papic_guest_captures — per-guest capture ledger for PAPIC_GUEST.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.papic_guest_captures (
  id              BIGSERIAL PRIMARY KEY,
  capture_id      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  guest_id        UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  r2_object_key   TEXT,
    -- Canonical R2 path for the captured frame, e.g.
    -- 'event-<event_id>/papic-guest/<guest_id>/<capture_id>.jpg'. Nullable so a
    -- capture still counts against the quota even if R2 is unconfigured in a
    -- given environment (the count is the credit-pool gate; the bytes are a
    -- best-effort archive).
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hidden_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS papic_guest_captures_event_id_idx
  ON public.papic_guest_captures(event_id);
CREATE INDEX IF NOT EXISTS papic_guest_captures_guest_id_idx
  ON public.papic_guest_captures(guest_id);
CREATE INDEX IF NOT EXISTS papic_guest_captures_captured_at_idx
  ON public.papic_guest_captures(captured_at);

ALTER TABLE public.papic_guest_captures ENABLE ROW LEVEL SECURITY;

-- RLS — couple (member_type='couple') reads their event's guest captures so the
-- couple-facing "Guest cameras" card can show the running total; admin full.
-- Guests DO NOT write here directly — inserts go through the SECURITY DEFINER
-- papic_record_guest_capture() fn (the guest camera is a public, RLS-less
-- surface). No public/anon policy: the guest path is the fn, not a table grant.
DROP POLICY IF EXISTS papic_guest_captures_couple_read ON public.papic_guest_captures;
CREATE POLICY papic_guest_captures_couple_read ON public.papic_guest_captures
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = papic_guest_captures.event_id
        AND em.user_id = auth.uid()
        AND em.member_type = 'couple'
    )
  );

DROP POLICY IF EXISTS papic_guest_captures_admin_all ON public.papic_guest_captures;
CREATE POLICY papic_guest_captures_admin_all ON public.papic_guest_captures
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Ownership helper — does an event own a live (non-cancelled/refunded/
--    lapsed) paid order for a given service_key? Mirrors the app-side
--    eventOwnsProWebsite() / eventOwnsPapicGuest() / eventOwnsPapicSeats()
--    logic so the gate is consistent on both sides.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_event_owns_service(
  p_event_id   UUID,
  p_service_key TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.event_id = p_event_id
      AND o.service_key = p_service_key
      AND COALESCE(o.status, '') NOT IN ('cancelled', 'refunded', 'lapsed')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. papic_provision_seats — couple-gated idempotent seat provisioning.
--
--    Materializes 5 paparazzi_seats rows (dense seat_index 1..5) for an event
--    that owns a paid PAPIC_SEATS order. Idempotent: only inserts the seat
--    indexes that don't already exist, so re-calling never duplicates and
--    never disturbs already-claimed seats. Returns the number of seats that
--    now exist (always 5 on success).
--
--    Authorization — the caller (auth.uid()) MUST be a couple on the event AND
--    the event MUST own PAPIC_SEATS. Raises otherwise. Even though the couple
--    add-on page checks membership before calling, the fn re-checks so a forged
--    call can't provision seats on someone else's event.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_provision_seats(
  p_event_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_couple  BOOLEAN;
  v_owns       BOOLEAN;
  v_seat_count CONSTANT INTEGER := 5;
  i            INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'papic_provision_seats: not authenticated'
      USING ERRCODE = '28000';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = p_event_id
      AND em.user_id = auth.uid()
      AND em.member_type = 'couple'
  ) INTO v_is_couple;

  IF NOT (v_is_couple OR public.is_admin()) THEN
    RAISE EXCEPTION 'papic_provision_seats: caller is not a couple on this event'
      USING ERRCODE = '42501';
  END IF;

  v_owns := public.papic_event_owns_service(p_event_id, 'PAPIC_SEATS');
  IF NOT v_owns THEN
    RAISE EXCEPTION 'papic_provision_seats: event does not own PAPIC_SEATS'
      USING ERRCODE = '42501';
  END IF;

  -- Insert any missing seat_index 1..5. Each new row gets a fresh claim token.
  -- ON CONFLICT (event_id, seat_index) DO NOTHING keeps already-provisioned /
  -- claimed seats untouched.
  FOR i IN 1..v_seat_count LOOP
    INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
    VALUES (
      p_event_id,
      i,
      'PAPIC_SEATS',
      encode(gen_random_bytes(18), 'hex')
    )
    ON CONFLICT (event_id, seat_index) DO NOTHING;
  END LOOP;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.paparazzi_seats
    WHERE event_id = p_event_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. papic_claim_seat — token-gated claim for the public claim route.
--
--    The friend opens /papic/claim/[token], signs in, and this fn binds their
--    auth.uid() to the seat the token points at. Returns a small JSON payload
--    the route uses to confirm + show seat context.
--
--    Rules:
--      • token must match a live (revoked_at IS NULL) seat → else 'invalid'.
--      • seat already claimed by this same user → idempotent 'claimed' (re-open
--        the link, no error).
--      • seat already claimed by someone else → 'taken'.
--      • otherwise bind claimer_user_id + claimed_at → 'claimed'.
--
--    SECURITY DEFINER because paparazzi_seats RLS is couple-only; the claimer
--    is not a couple, so a direct UPDATE under their session would be blocked.
--    auth.uid() is the claimer identity; p_token is the capability.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_claim_seat(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_seat       public.paparazzi_seats%ROWTYPE;
  v_event_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT * INTO v_seat
  FROM public.paparazzi_seats
  WHERE claim_qr_token = p_token
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Already claimed?
  IF v_seat.claimer_user_id IS NOT NULL THEN
    IF v_seat.claimer_user_id = v_uid THEN
      SELECT display_name INTO v_event_name
      FROM public.events WHERE event_id = v_seat.event_id;
      RETURN jsonb_build_object(
        'status', 'claimed',
        'seat_index', v_seat.seat_index,
        'event_id', v_seat.event_id,
        'event_name', v_event_name
      );
    END IF;
    RETURN jsonb_build_object('status', 'taken', 'seat_index', v_seat.seat_index);
  END IF;

  UPDATE public.paparazzi_seats
  SET claimer_user_id = v_uid,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE seat_id = v_seat.seat_id
    AND claimer_user_id IS NULL
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    -- Lost a race — someone claimed it between our SELECT and UPDATE.
    RETURN jsonb_build_object('status', 'taken', 'seat_index', v_seat.seat_index);
  END IF;

  SELECT display_name INTO v_event_name
  FROM public.events WHERE event_id = v_seat.event_id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'seat_index', v_seat.seat_index,
    'event_id', v_seat.event_id,
    'event_name', v_event_name
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. papic_record_guest_capture — quota-enforcing guest capture insert.
--
--    Called by the guest-capture route handler (POST /api/papic/guest-capture)
--    AFTER it has validated the guest's qr_token. Verifies the event owns
--    PAPIC_GUEST, advisory-locks per guest, counts existing captures, REJECTS
--    once the 150-credit pool is exhausted, inserts, and returns
--    {status, remaining, total, used}.
--
--    150 = iteration 0012 Papic spec § 8: "Each guest receives 150 captured-
--    photo credits, bundled free in the Premium Guest Camera Pack."
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.papic_record_guest_capture(
  p_guest_id      UUID,
  p_r2_object_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits CONSTANT INTEGER := 150;
  v_event_id UUID;
  v_owns     BOOLEAN;
  v_used     INTEGER;
BEGIN
  -- Resolve the guest's event. A deleted guest cannot capture.
  SELECT event_id INTO v_event_id
  FROM public.guests
  WHERE guest_id = p_guest_id
    AND deleted_at IS NULL;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_guest');
  END IF;

  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST');
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  -- Advisory lock keyed on the guest so two simultaneous captures from the
  -- same phone serialize through the count check. hashtextextended → bigint
  -- lock key scoped to this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.papic_guest_captures
  WHERE guest_id = p_guest_id;

  IF v_used >= v_credits THEN
    RETURN jsonb_build_object(
      'status', 'quota_exhausted',
      'total', v_credits,
      'used', v_used,
      'remaining', 0
    );
  END IF;

  INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key)
  VALUES (v_event_id, p_guest_id, p_r2_object_key);

  RETURN jsonb_build_object(
    'status', 'ok',
    'total', v_credits,
    'used', v_used + 1,
    'remaining', GREATEST(0, v_credits - (v_used + 1))
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants — the route handlers + claim route call these RPCs through the
--    anon/authenticated roles. SECURITY DEFINER means the fn body runs as the
--    owner; EXECUTE just lets the role invoke it.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.papic_event_owns_service(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.papic_provision_seats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.papic_claim_seat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.papic_record_guest_capture(UUID, TEXT) TO authenticated, anon;

COMMIT;
