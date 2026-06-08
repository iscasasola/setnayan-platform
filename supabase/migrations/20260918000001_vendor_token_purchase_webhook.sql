-- ============================================================================
-- 20260918000001_vendor_token_purchase_webhook.sql
-- Payment-webhook auto-confirm path for vendor token-pack purchases.
--
-- The manual admin path (approve_vendor_token_purchase, migration
-- 20260916000000) gates on is_console_admin() which reads auth.uid() — so a
-- payment-provider WEBHOOK (service-role client, no auth.uid()) can't call it.
-- This adds a service-role-only confirm-by-reference entry point + extracts the
-- shared credit logic so both paths stay identical.
--
--   _apply_token_purchase_credit(id, reviewed_by) — shared, internal: locks the
--       row, credits never-expire purchased_tokens, flips to paid. Idempotent.
--   approve_vendor_token_purchase(id)             — admin path (gate + shared fn).
--   confirm_vendor_token_purchase_by_reference(ref) — webhook path (service-role
--       only): resolve order by TKN- reference, then shared fn. reviewed_by NULL
--       marks a system/automated confirmation.
-- ============================================================================

-- Shared credit core — the single source of truth for "mark a purchase paid +
-- credit the wallet." SECURITY DEFINER, REVOKEd from PUBLIC: only the two
-- wrapper functions below (which run as the owner) may call it.
CREATE OR REPLACE FUNCTION public._apply_token_purchase_credit(
  p_purchase_id UUID,
  p_reviewed_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_p public.vendor_token_purchases;
BEGIN
  SELECT * INTO v_p FROM public.vendor_token_purchases
    WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_p.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  -- Idempotent: a replayed webhook (or admin double-click) is a no-op.
  IF v_p.status = 'paid' THEN
    RETURN jsonb_build_object('already', true, 'tokens', v_p.token_count,
                              'vendor_id', v_p.vendor_id);
  END IF;
  IF v_p.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'NOT_PENDING: %', v_p.status;
  END IF;

  -- Never-expire purchased_tokens (the vendor paid pesos).
  INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
  VALUES (v_p.vendor_id, v_p.token_count, 0)
  ON CONFLICT (vendor_id) DO UPDATE
    SET purchased_tokens = vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
        updated_at = NOW();

  UPDATE public.vendor_token_purchases
    SET status = 'paid', paid_at = now(), reviewed_by = p_reviewed_by
    WHERE purchase_id = p_purchase_id;

  RETURN jsonb_build_object('paid', true, 'tokens', v_p.token_count,
                            'vendor_id', v_p.vendor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Lock it down hard: internal-only. Supabase's default privileges grant EXECUTE
-- on new functions to anon + authenticated, so REVOKE FROM PUBLIC alone leaves
-- those open — a vendor could otherwise call this with an arbitrary purchase_id
-- and credit it. Revoke every external role; only the SECURITY DEFINER wrappers
-- (running as the owner) call it.
REVOKE ALL ON FUNCTION public._apply_token_purchase_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Admin path — now delegates the credit to the shared core.
CREATE OR REPLACE FUNCTION public.approve_vendor_token_purchase(p_purchase_id UUID)
RETURNS JSONB AS $$
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;
  RETURN public._apply_token_purchase_credit(p_purchase_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.approve_vendor_token_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_vendor_token_purchase(UUID) TO authenticated;

-- Webhook path — resolve the order by its TKN- reference, then credit. NOT
-- granted to authenticated (a vendor must never self-confirm by reference) —
-- only service_role, i.e. the webhook route's admin client, may call it.
CREATE OR REPLACE FUNCTION public.confirm_vendor_token_purchase_by_reference(
  p_reference_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT purchase_id INTO v_id FROM public.vendor_token_purchases
    WHERE reference_code = p_reference_code;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: %', p_reference_code;
  END IF;
  RETURN public._apply_token_purchase_credit(v_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Service-role ONLY (the webhook's admin client). Explicitly strip anon +
-- authenticated (Supabase grants them by default) so a vendor can NEVER
-- self-confirm a purchase by reference without paying.
REVOKE ALL ON FUNCTION public.confirm_vendor_token_purchase_by_reference(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_vendor_token_purchase_by_reference(TEXT) TO service_role;

COMMENT ON FUNCTION public.confirm_vendor_token_purchase_by_reference(TEXT) IS
  'Webhook/service-role entry point: confirm a vendor token-pack purchase by its TKN- reference and credit purchased_tokens (idempotent). reviewed_by stays NULL = automated/system confirmation.';
