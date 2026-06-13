-- ============================================================================
-- 20261209000000_concurrency_guards.sql
--
-- CONCURRENCY GUARDS — closes the two genuinely-open races surfaced by the
-- 2026-06-13 re-audit of the 2026-06-04 conflict-architecture findings. The
-- schedule-pool layer (PRs #1288/#1290/#1292) already DB-serialized the
-- booking/capacity races via acquire_schedule_pools() FOR UPDATE + the
-- partial-unique live-booking index; the unlock burn is guarded by
-- unlock_vendor_event()'s UNIQUE(vendor_profile_id,event_id) + ON CONFLICT.
-- Two writers were still un-serialized:
--
--   A) import_external_client() — INSERT-then-burn with NO idempotency key.
--      A vendor double-clicking "Import client" (or a retry after a slow 200)
--      creates two external_client blocks and BURNS TWO TOKENS. This is the
--      only un-guarded money/token double-spend the recent two-way features
--      introduced. Fix: a partial-unique natural key on the block +
--      ON CONFLICT DO NOTHING, and only burn when a NEW row was inserted
--      (rowcount-gated) — the exact pattern unlock_vendor_event() already uses.
--
--   B) respond_vendor_proposal() — SELECT (no lock) → guard → UPDATE (no
--      status precondition). Two concurrent accepts, or accept-vs-decline,
--      both pass the in-memory guard and last-writer-wins. Blast radius is
--      cosmetic (accepting is a signal, not a payment) but trivially fixable.
--      Fix: SELECT ... FOR UPDATE to serialize, plus a status precondition on
--      the UPDATE WHERE + rowcount → already_resolved (defense in depth).
--
-- Both functions are CREATE OR REPLACE of the live bodies with ONLY the guard
-- changes; signatures, grants, ownership checks, and return contracts are
-- preserved.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- A · External-client import idempotency
-- ----------------------------------------------------------------------------

-- Defensive pre-dedupe: collapse any pre-existing duplicate external_client
-- blocks (same vendor · pool · day · name) down to the earliest row so the
-- unique index can build. external_client is a brand-new (2026-06-12) feature
-- on the founder-only marketplace, so this is expected to affect ~0 rows; the
-- duplicates it would remove ARE the bug this migration prevents.
WITH ranked AS (
  SELECT block_id,
         row_number() OVER (
           PARTITION BY vendor_profile_id, pool_id, blocked_at, client_name
           ORDER BY block_id
         ) AS rn
  FROM public.vendor_calendar_blocks
  WHERE block_source = 'external_client'
)
DELETE FROM public.vendor_calendar_blocks vcb
USING ranked
WHERE vcb.block_id = ranked.block_id
  AND ranked.rn > 1;

-- Natural-key uniqueness for external_client blocks only. blocked_at is
-- deterministic from the import's start_date (00:00:00+08), so a true
-- double-submit collides; legitimately different dates do not.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_calendar_blocks_external_client_uniq
  ON public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, client_name)
  WHERE block_source = 'external_client';

CREATE OR REPLACE FUNCTION public.import_external_client(
  p_vendor_profile_id UUID,
  p_pool_id           UUID,
  p_client_name       TEXT,
  p_client_contact    TEXT,
  p_client_note       TEXT,
  p_start_date        DATE,
  p_end_date          DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block_id   UUID;
  v_name       TEXT := NULLIF(trim(p_client_name), '');
  v_blocked_at TIMESTAMPTZ;
BEGIN
  -- Ownership — DEFINER + granted to authenticated, so gate explicitly
  -- (mirrors unlock_vendor_event).
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles vp
     WHERE vp.vendor_profile_id = p_vendor_profile_id
       AND vp.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'not_owner');
  END IF;

  -- External clients are category-scoped by definition: the pool must be
  -- the vendor's own, active pool.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_schedule_pools sp
     WHERE sp.pool_id = p_pool_id
       AND sp.vendor_profile_id = p_vendor_profile_id
       AND sp.is_active
  ) THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
  END IF;

  IF v_name IS NULL OR length(v_name) > 120 THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'name');
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date
     OR p_end_date - p_start_date > 31 THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'dates');
  END IF;

  v_blocked_at := (p_start_date::text || ' 00:00:00+08')::timestamptz;

  -- Day-grain block in PH civil time: 00:00 → 23:30 (the 30-min granularity
  -- CHECK on vendor_calendar_blocks allows :00/:30 only; 23:30 keeps the
  -- ::date overlap math in acquire_schedule_pools on the same civil day —
  -- next-day 00:00 would bleed the block into the following date).
  --
  -- IDEMPOTENCY: a double-submit (same vendor · pool · start day · name)
  -- collides on vendor_calendar_blocks_external_client_uniq and DOES NOTHING,
  -- leaving v_block_id NULL → we return the existing block WITHOUT burning a
  -- second token. Only a genuinely new block reaches the burn below.
  INSERT INTO public.vendor_calendar_blocks
    (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label,
     block_source, is_private, client_name, client_contact, client_note)
  VALUES (
    p_vendor_profile_id,
    p_pool_id,
    v_blocked_at,
    (p_end_date::text || ' 23:30:00+08')::timestamptz,
    v_name,
    'external_client',
    TRUE,
    v_name,
    NULLIF(trim(p_client_contact), ''),
    NULLIF(trim(p_client_note), '')
  )
  ON CONFLICT (vendor_profile_id, pool_id, blocked_at, client_name)
    WHERE block_source = 'external_client'
    DO NOTHING
  RETURNING block_id INTO v_block_id;

  IF v_block_id IS NULL THEN
    -- Duplicate import (double-click / retry): the block already exists; no
    -- second token is burned. Report success with the existing block so the
    -- caller's "client_imported" UX still fires (the client IS in the book).
    SELECT block_id INTO v_block_id
    FROM public.vendor_calendar_blocks
    WHERE vendor_profile_id = p_vendor_profile_id
      AND pool_id = p_pool_id
      AND blocked_at = v_blocked_at
      AND client_name = v_name
      AND block_source = 'external_client'
    LIMIT 1;
    RETURN jsonb_build_object(
      'status', 'ok', 'block_id', v_block_id, 'tokens_burned', 0, 'already', TRUE);
  END IF;

  -- Tier matrix: importing/syncing an outside customer costs 1 token on
  -- EVERY tier. Insufficient balance RAISES → the block insert above rolls
  -- back with it (no phantom external client).
  PERFORM public.consume_vendor_assets_per_voucher(
    p_vendor_profile_id,
    1,
    'EXTERNAL_CLIENT_IMPORT',
    NULL,
    jsonb_build_object('block_id', v_block_id, 'pool_id', p_pool_id)
  );

  RETURN jsonb_build_object('status', 'ok', 'block_id', v_block_id, 'tokens_burned', 1);
END;
$$;

REVOKE ALL ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) IS
  'Import an off-app client as a category-pool-scoped, capacity-consuming external_client calendar block + burn the tier-matrix 1-token import fee atomically. Idempotent: a double-submit (same vendor/pool/day/name) collides on the partial-unique index and burns no second token. NOT an app client (no thread/stats/reviews); couples see only "unavailable".';

-- ----------------------------------------------------------------------------
-- B · Proposal accept/decline serialization
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.respond_vendor_proposal(
  p_proposal_id UUID,
  p_response    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_status   TEXT;
  v_rows     INTEGER;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'bad_response' USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE serializes concurrent responders (two accepts, or
  -- accept-vs-decline): the second waits, then re-reads the now-resolved
  -- status and is rejected by the guard below.
  SELECT event_id, status INTO v_event_id, v_status
  FROM public.vendor_proposals WHERE proposal_id = p_proposal_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_event_id NOT IN (SELECT public.current_couple_event_ids())
     AND v_event_id NOT IN (SELECT public.current_moderator_event_ids()) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('sent', 'viewed') THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock above is ever
  -- removed.
  UPDATE public.vendor_proposals
  SET status = p_response,
      resolved_at = NOW(),
      resolved_by_user_id = auth.uid(),
      updated_at = NOW()
  WHERE proposal_id = p_proposal_id
    AND status IN ('sent', 'viewed');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) IS
  'Couple/delegate accepts or declines a sent vendor proposal (data-link program ③). Serialized via SELECT FOR UPDATE + status-precondition UPDATE so concurrent accept/decline is single-winner. Status-flip-never-delete; accepting is a signal, not a payment.';

COMMIT;
