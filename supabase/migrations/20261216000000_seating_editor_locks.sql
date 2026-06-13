-- ============================================================================
-- 20261216000000_seating_editor_locks.sql
--
-- EXCLUSIVE SEATING-EDITOR LOCK — PR 2 of the seat-finding build
-- (corpus: project_setnayan_seatfinding_white_space). The build-order GATE
-- that must land before any live two-way seating editing (PR 5).
--
-- Owner-locked behavior (2026-06-13): ONE editor at a time, per event. This
-- applies to couple CO-OWNERS too — the second partner gets VIEW-ONLY while
-- the first holds the lock ("no other account editing it"). It is ALSO the
-- first enablement of coordinator seating WRITES: a delegated coordinator may
-- hold the lock only when they ALSO carry the existing seat_plan='edit'
-- moderator grant (20261129003000). Silent — peer notifications are PR 5.
--
-- Model:
--   * Lock is EVENT-SCOPED — UNIQUE(event_id). Row-exists = held; release =
--     DELETE; staleness = last_heartbeat_at < now() - 90s (SERVER now() ONLY,
--     never a client clock).
--   * App heartbeats every 30s; a peer may TAKE OVER a lock that has gone
--     stale (>90s since last heartbeat).
--   * Enforcement lives in the SERVER-ACTION layer (typed takeover error vs.
--     opaque RLS denial — better UX). assert_seating_lock_held() ships here
--     but DORMANT, as a belt-and-suspenders hook for a future RLS cutover.
--
-- Mirrors precedents:
--   * 20261126000000_schedule_pools.sql       (RPC envelope + FOR UPDATE idiom)
--   * 20261209000000_concurrency_guards.sql   (SELECT FOR UPDATE serialization)
--   * 20261129003000_coordinator_delegate_rls (moderator helper usage)
--
-- Helpers consumed (all CONFIRMED present): is_admin(),
-- current_couple_event_ids(), current_moderator_event_ids(),
-- moderator_area_level(UUID, TEXT).
--
-- Idempotent: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- Migrations stay UNAPPLIED to prod pending owner nod.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. seating_editor_locks — one LIVE row per event = the held lock.
--    UNIQUE(event_id) is the exclusivity invariant (co-owners included).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seating_editor_locks (
  lock_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL UNIQUE
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  holder_user_id    UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_label      TEXT NOT NULL DEFAULT ''
                    CHECK (length(holder_label) <= 120),
  acquired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stale-sweep / takeover hot path: find locks whose last heartbeat is old.
CREATE INDEX IF NOT EXISTS seating_editor_locks_heartbeat_idx
  ON public.seating_editor_locks(last_heartbeat_at);

ALTER TABLE public.seating_editor_locks ENABLE ROW LEVEL SECURITY;

-- READ policy: admins, the event's couple, and a coordinator carrying the
-- seat_plan='edit' grant may all SEE who holds the lock (so peers can render
-- the banner + compute staleness from last_heartbeat_at without polling an
-- RPC). NO direct write policies on purpose — every mutation flows through the
-- SECURITY DEFINER RPCs below (read-then-write cannot be made race-safe app
-- side; only the DB can serialize the UNIQUE(event_id) decision).
DROP POLICY IF EXISTS seating_editor_locks_read ON public.seating_editor_locks;
CREATE POLICY seating_editor_locks_read
  ON public.seating_editor_locks FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR (
      event_id IN (SELECT public.current_moderator_event_ids())
      AND public.moderator_area_level(event_id, 'seat_plan') = 'edit'
    )
  );

COMMENT ON TABLE public.seating_editor_locks IS
  'Exclusive seating-editor lock (owner lock 2026-06-13): one LIVE row per event = one editor at a time, co-owners included. Row-exists = held; DELETE = release; last_heartbeat_at < now()-90s = stale (takeover-eligible). UNIQUE(event_id) is the exclusivity invariant. Writes only via the SECURITY DEFINER acquire/refresh/release RPCs; SELECT exposed to admin/couple/seat-plan-edit-coordinator for banner + staleness rendering. App heartbeats every 30s.';

-- ----------------------------------------------------------------------------
-- 2. authorize helper — INLINE in the RPCs (kept private). A caller may hold
--    the seating lock iff they are the event's couple OR an active coordinator
--    with the seat_plan='edit' grant. Admins are intentionally NOT lock
--    holders (they observe, they don't edit a couple's seat plan via this
--    surface). This mirrors the moderator_write RLS gate from 20261129003000.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 3. acquire_seating_editor_lock — claim or refresh the exclusive lock.
--
-- Returns a JSONB envelope (same convention as acquire_schedule_pools):
--   { status:'acquired', lock_id, holder_label, last_heartbeat_at }
--   { status:'refreshed', lock_id, holder_label, last_heartbeat_at }  -> already mine
--   { status:'took_over', lock_id, holder_label, last_heartbeat_at }  -> peer stale, seized
--   { status:'held_by_other', holder_user_id, holder_label, last_heartbeat_at }
--   { status:'not_authorized' }
--
-- Strategy: fast-path INSERT ... ON CONFLICT(event_id) DO NOTHING (the common
-- uncontested case is a single round-trip). On conflict, take the row lock
-- (FOR UPDATE) and decide: mine → refresh; stale (>90s) → take over; else →
-- held_by_other. Staleness uses SERVER now() exclusively.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_seating_editor_lock(
  p_event_id UUID,
  p_label    TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_authorized BOOLEAN;
  v_label      TEXT := COALESCE(NULLIF(trim(p_label), ''), 'Editor');
  v_lock       RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  -- Couple member OR coordinator with the seat_plan='edit' grant.
  SELECT (
    p_event_id IN (SELECT public.current_couple_event_ids())
    OR (
      p_event_id IN (SELECT public.current_moderator_event_ids())
      AND public.moderator_area_level(p_event_id, 'seat_plan') = 'edit'
    )
  ) INTO v_authorized;
  IF NOT v_authorized THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  -- Fast path: uncontested claim in one statement.
  INSERT INTO public.seating_editor_locks
    (event_id, holder_user_id, holder_label)
  VALUES (p_event_id, v_uid, v_label)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING lock_id, holder_label, last_heartbeat_at INTO v_lock;

  IF v_lock.lock_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'acquired',
      'lock_id', v_lock.lock_id,
      'holder_label', v_lock.holder_label,
      'last_heartbeat_at', v_lock.last_heartbeat_at);
  END IF;

  -- Contested: serialize on the existing row and decide under the lock.
  SELECT lock_id, holder_user_id, holder_label, last_heartbeat_at
    INTO v_lock
    FROM public.seating_editor_locks
   WHERE event_id = p_event_id
     FOR UPDATE;

  -- Race: the holder released between our INSERT and this SELECT.
  IF v_lock.lock_id IS NULL THEN
    INSERT INTO public.seating_editor_locks
      (event_id, holder_user_id, holder_label)
    VALUES (p_event_id, v_uid, v_label)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING lock_id, holder_label, last_heartbeat_at INTO v_lock;
    IF v_lock.lock_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'acquired',
        'lock_id', v_lock.lock_id,
        'holder_label', v_lock.holder_label,
        'last_heartbeat_at', v_lock.last_heartbeat_at);
    END IF;
    -- Lost the re-race; fall through to re-read below.
    SELECT lock_id, holder_user_id, holder_label, last_heartbeat_at
      INTO v_lock
      FROM public.seating_editor_locks
     WHERE event_id = p_event_id
       FOR UPDATE;
  END IF;

  -- Already mine → refresh the heartbeat.
  IF v_lock.holder_user_id = v_uid THEN
    UPDATE public.seating_editor_locks
       SET last_heartbeat_at = NOW(),
           holder_label = v_label,
           updated_at = NOW()
     WHERE lock_id = v_lock.lock_id;
    RETURN jsonb_build_object(
      'status', 'refreshed',
      'lock_id', v_lock.lock_id,
      'holder_label', v_label,
      'last_heartbeat_at', NOW());
  END IF;

  -- Held by a peer whose heartbeat has gone stale (>90s) → take it over.
  IF v_lock.last_heartbeat_at < NOW() - INTERVAL '90 seconds' THEN
    UPDATE public.seating_editor_locks
       SET holder_user_id = v_uid,
           holder_label = v_label,
           acquired_at = NOW(),
           last_heartbeat_at = NOW(),
           updated_at = NOW()
     WHERE lock_id = v_lock.lock_id;
    RETURN jsonb_build_object(
      'status', 'took_over',
      'lock_id', v_lock.lock_id,
      'holder_label', v_label,
      'last_heartbeat_at', NOW());
  END IF;

  -- Held by a live peer → caller is view-only.
  RETURN jsonb_build_object(
    'status', 'held_by_other',
    'holder_user_id', v_lock.holder_user_id,
    'holder_label', v_lock.holder_label,
    'last_heartbeat_at', v_lock.last_heartbeat_at);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_seating_editor_lock(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_seating_editor_lock(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.acquire_seating_editor_lock(UUID, TEXT) IS
  'Claim/refresh/take-over the exclusive per-event seating-editor lock. Fast-path INSERT ON CONFLICT DO NOTHING; on conflict FOR UPDATE → mine=refresh / stale(>90s server-clock)=took_over / live peer=held_by_other. Authorizes couple members + seat_plan=edit coordinators only (admins observe). Returns a JSONB status envelope.';

-- ----------------------------------------------------------------------------
-- 4. refresh_seating_editor_lock — the 30s heartbeat.
--    Bumps last_heartbeat_at ONLY if the caller still holds a NON-stale lock.
--    Returns { status:'ok', last_heartbeat_at } | { status:'lost' }.
--    A 'lost' result tells the client a peer has taken over (or the lock was
--    released/expired) → it must drop to view-only. The hook treats 'lost'
--    best-effort and never throws on it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_seating_editor_lock(
  p_lock_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_rows INT;
  v_hb   TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR p_lock_id IS NULL THEN
    RETURN jsonb_build_object('status', 'lost');
  END IF;

  UPDATE public.seating_editor_locks
     SET last_heartbeat_at = NOW(),
         updated_at = NOW()
   WHERE lock_id = p_lock_id
     AND holder_user_id = v_uid
     AND last_heartbeat_at >= NOW() - INTERVAL '90 seconds'
  RETURNING last_heartbeat_at INTO v_hb;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'lost');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'last_heartbeat_at', v_hb);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_seating_editor_lock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_seating_editor_lock(UUID) TO authenticated;

COMMENT ON FUNCTION public.refresh_seating_editor_lock(UUID) IS
  'Heartbeat (called every 30s by the editor): bump last_heartbeat_at iff the caller still holds a non-stale lock (server clock). ROW_COUNT=0 → status:lost (a peer took over after a >90s gap, or the lock was released) → client drops to view-only. Idempotent / safe to over-call.';

-- ----------------------------------------------------------------------------
-- 5. release_seating_editor_lock — explicit release (unmount / pagehide).
--    DELETE WHERE holder = caller. Idempotent (already-gone → ok).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_seating_editor_lock(
  p_lock_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_rows INT;
BEGIN
  IF v_uid IS NULL OR p_lock_id IS NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'released', 0);
  END IF;

  DELETE FROM public.seating_editor_locks
   WHERE lock_id = p_lock_id
     AND holder_user_id = v_uid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object('status', 'ok', 'released', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.release_seating_editor_lock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_seating_editor_lock(UUID) TO authenticated;

COMMENT ON FUNCTION public.release_seating_editor_lock(UUID) IS
  'Release the seating-editor lock on editor unmount / pagehide (DELETE WHERE holder = caller). Idempotent — a stale-takeover or prior release leaves ROW_COUNT 0 and still returns ok. A non-holder cannot delete a peer''s lock.';

-- ----------------------------------------------------------------------------
-- 6. assert_seating_lock_held — DORMANT belt-and-suspenders.
--    RAISEs check_violation (23514) if the caller does NOT currently hold a
--    LIVE (non-stale) lock for the event. The optional p_lock_id pins it to a
--    specific lock so a silent stale-takeover by a peer is also caught. Server
--    clock only. The server-action layer calls this BEFORE every gated
--    mutation; it ships here so a future RLS cutover (open decision ①) has the
--    enforcement primitive ready.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_seating_lock_held(
  p_event_id UUID,
  p_lock_id  UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ok  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'seating_lock_not_held' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.seating_editor_locks
     WHERE event_id = p_event_id
       AND holder_user_id = v_uid
       AND last_heartbeat_at >= NOW() - INTERVAL '90 seconds'
       AND (p_lock_id IS NULL OR lock_id = p_lock_id)
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'seating_lock_not_held' USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_seating_lock_held(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_seating_lock_held(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.assert_seating_lock_held(UUID, UUID) IS
  'Guard (server-clock cutoff): RAISE check_violation (23514, error text seating_lock_not_held) unless auth.uid() currently holds a LIVE (non-stale, <=90s heartbeat) seating lock on the event — optionally pinned to p_lock_id so a silent peer takeover is also caught. Called by the seating server actions before every gated mutation; the SECURITY DEFINER body sees the lock row regardless of RLS.';

COMMIT;

-- =============================================================================
-- VERIFICATION (run via supabase db query):
--   \d public.seating_editor_locks
--   SELECT proname FROM pg_proc
--    WHERE proname IN ('acquire_seating_editor_lock','refresh_seating_editor_lock',
--                      'release_seating_editor_lock','assert_seating_lock_held');
--   -- two-session smoke test (psql A, then psql B as a co-owner):
--   --   A: SELECT acquire_seating_editor_lock('<event>','Partner A');  -> acquired
--   --   B: SELECT acquire_seating_editor_lock('<event>','Partner B');  -> held_by_other
--   --   A: SELECT refresh_seating_editor_lock('<lock>');               -> ok
--   --   (wait 91s, A stops heartbeating)
--   --   B: SELECT acquire_seating_editor_lock('<event>','Partner B');  -> took_over
--   --   A: SELECT refresh_seating_editor_lock('<lock>');               -> lost
--   --   B: SELECT release_seating_editor_lock('<lock>');               -> released 1
-- =============================================================================
