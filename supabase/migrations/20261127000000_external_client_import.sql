-- ============================================================================
-- 20261127000000_external_client_import.sql
--
-- EXTERNAL CLIENT IMPORT — PR 3 of the schedule-pool program.
-- Canonical: Customer_Vendor_Marketplace_Architecture_2026-06-04.md § 4
-- (block-scoping bullet, 2026-06-12) + Vendor_Tier_Capability_Matrix
-- (importCustomerTokenCost = 1, ALL tiers).
--
-- A vendor imports an off-app client into their book: a named,
-- category-pool-scoped, capacity-consuming calendar block. NOT an app
-- client — no thread, no funnel stats, no review eligibility; couples only
-- ever see "unavailable" (privacy lock). The tier matrix prices the import
-- at 1 token for every tier, so the block insert and the token burn must
-- COMMIT OR ROLL BACK TOGETHER — hence this SECURITY DEFINER RPC instead of
-- two app-side writes (same atomicity reasoning as unlock_vendor_event).
--
-- Returns:
--   { status:'ok', block_id, tokens_burned }
--   { status:'invalid', reason }    -> bad input (dates/name/pool)
-- RAISES on insufficient balance (INSUFFICIENT_WALLET_BALANCES from
-- consume_vendor_assets_per_voucher) — the whole tx rolls back, no
-- phantom block; the app maps the message to a top-up nudge.
-- ============================================================================

BEGIN;

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
  v_block_id UUID;
  v_name     TEXT := NULLIF(trim(p_client_name), '');
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

  -- Day-grain block in PH civil time: 00:00 → 23:30 (the 30-min granularity
  -- CHECK on vendor_calendar_blocks allows :00/:30 only; 23:30 keeps the
  -- ::date overlap math in acquire_schedule_pools on the same civil day —
  -- next-day 00:00 would bleed the block into the following date).
  INSERT INTO public.vendor_calendar_blocks
    (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label,
     block_source, is_private, client_name, client_contact, client_note)
  VALUES (
    p_vendor_profile_id,
    p_pool_id,
    (p_start_date::text || ' 00:00:00+08')::timestamptz,
    (p_end_date::text   || ' 23:30:00+08')::timestamptz,
    v_name,
    'external_client',
    TRUE,
    v_name,
    NULLIF(trim(p_client_contact), ''),
    NULLIF(trim(p_client_note), '')
  )
  RETURNING block_id INTO v_block_id;

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
  'Import an off-app client as a category-pool-scoped, capacity-consuming external_client calendar block + burn the tier-matrix 1-token import fee atomically. NOT an app client (no thread/stats/reviews); couples see only "unavailable". Owner locks 2026-06-12 + importCustomerTokenCost.';

COMMIT;
