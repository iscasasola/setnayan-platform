-- ============================================================================
-- external_client_import_free
--
-- IMPORT IS FREE (owner lock 2026-06-30).
-- Supersedes the 1-token import fee from 20261127000000_external_client_import.
-- Canonical: project_setnayan_vendor_import_crm_workstream —
-- "Import is FREE — via QR Code (owner 2026-06-30)". Import is the free CRM
-- on-ramp + viral acquisition engine (maps the whole wedding's vendor roster
-- in; the couple gets free wedding-management), NOT a revenue line. The
-- 1-token import gate was the only Free-tier token sink — retired here.
--
-- Only change vs the prior definition: the
-- consume_vendor_assets_per_voucher(...) burn is removed. The block insert,
-- ownership/pool/date validation, and return shape are byte-identical, except
-- tokens_burned is now always 0. Because there is no longer a burn that can
-- RAISE on insufficient balance, the RPC can no longer fail with
-- INSUFFICIENT_WALLET_BALANCES — the app's `no_tokens` branch is dead.
-- Idempotent: CREATE OR REPLACE FUNCTION.
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

  -- Import is FREE (owner 2026-06-30). No token burn — this is the free CRM
  -- on-ramp + viral acquisition engine, not a revenue line.
  RETURN jsonb_build_object('status', 'ok', 'block_id', v_block_id, 'tokens_burned', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) TO authenticated;

COMMENT ON FUNCTION public.import_external_client(UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE) IS
  'Import an off-app client as a category-pool-scoped, capacity-consuming external_client calendar block. FREE (owner 2026-06-30 — the free CRM on-ramp + viral acquisition engine; the 1-token import fee is retired). NOT an app client (no thread/stats/reviews); couples see only "unavailable". Owner locks 2026-06-12 (block scoping) + 2026-06-30 (free).';

COMMIT;
