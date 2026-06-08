-- ============================================================================
-- 20260916000000_vendor_token_purchase.sql
-- Vendor token-pack PURCHASE flow (owner 2026-06-08 "make purchasing available").
--
-- Apply-then-pay (manual reconcile) NOW, structured so a Maya/PayMongo payment
-- webhook can call approve_vendor_token_purchase() later with no rebuild:
--   1. create_vendor_token_purchase(sku) — vendor starts an order; price + token
--      count are read from vendor_billing_catalog (DB, never client-supplied).
--   2. vendor pays externally with the reference code in the note.
--   3. approve_vendor_token_purchase(id) — admin (or future webhook) confirms the
--      payment and credits the wallet's purchased_tokens (NEVER-expire bucket —
--      bought tokens, unlike earned/founder grants, don't sit in 45-day
--      vouchers). Idempotent per purchase (status guard + row lock).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_token_purchases (
  purchase_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  pack_sku_code      TEXT NOT NULL,
  token_count        INT  NOT NULL CHECK (token_count > 0),
  amount_php         NUMERIC(10,2) NOT NULL CHECK (amount_php >= 0),
  reference_code     TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending_payment'
                       CHECK (status IN ('pending_payment', 'paid', 'rejected')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at            TIMESTAMPTZ,
  reviewed_by        UUID,
  granted_voucher_id UUID,
  rejection_reason   TEXT
);

ALTER TABLE public.vendor_token_purchases ENABLE ROW LEVEL SECURITY;

-- Console-aligned admin gate. The rest of /admin gates on
-- (account_type='admin' OR is_internal OR is_team_member) — `is_admin()` alone
-- is stricter (account_type only) and would lock out internal/team reviewers.
-- We match the console so every admin who can SEE the queue can action it.
CREATE OR REPLACE FUNCTION public.is_console_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE user_id = auth.uid()
      AND (account_type = 'admin' OR is_internal = TRUE OR is_team_member = TRUE)
  );
$$;

CREATE INDEX IF NOT EXISTS idx_vtp_vendor
  ON public.vendor_token_purchases (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vtp_pending
  ON public.vendor_token_purchases (created_at)
  WHERE status = 'pending_payment';

-- RLS — a vendor reads their own purchases; admins read all. All WRITES go
-- through the SECURITY DEFINER functions below (no direct insert/update policy).
DROP POLICY IF EXISTS vtp_vendor_select ON public.vendor_token_purchases;
CREATE POLICY vtp_vendor_select ON public.vendor_token_purchases FOR SELECT
  USING (
    vendor_id IN (
      SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vtp_admin_select ON public.vendor_token_purchases;
CREATE POLICY vtp_admin_select ON public.vendor_token_purchases FOR SELECT
  USING (public.is_console_admin());

-- ── create: vendor starts a purchase ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_vendor_token_purchase(p_pack_sku_code TEXT)
RETURNS public.vendor_token_purchases AS $$
DECLARE
  v_vendor_id UUID;
  v_price     NUMERIC(10,2);
  v_tokens    INT;
  v_ref       TEXT;
  v_row       public.vendor_token_purchases;
BEGIN
  SELECT vendor_profile_id INTO v_vendor_id
    FROM public.vendor_profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'NO_VENDOR_PROFILE: caller has no vendor profile';
  END IF;

  -- Price + token count are DB-driven — never trust a client-supplied amount.
  SELECT price_php, token_grant_count INTO v_price, v_tokens
    FROM public.vendor_billing_catalog
    WHERE sku_code = p_pack_sku_code
      AND offering_type = 'token_pack'
      AND is_active = TRUE;
  IF v_tokens IS NULL OR v_tokens <= 0 THEN
    RAISE EXCEPTION 'INVALID_PACK: %', p_pack_sku_code;
  END IF;

  v_ref := 'TKN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.vendor_token_purchases
    (vendor_id, pack_sku_code, token_count, amount_php, reference_code)
  VALUES (v_vendor_id, p_pack_sku_code, v_tokens, v_price, v_ref)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_vendor_token_purchase(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vendor_token_purchase(TEXT) TO authenticated;

-- ── approve: admin / future webhook confirms payment + credits tokens ───────
CREATE OR REPLACE FUNCTION public.approve_vendor_token_purchase(p_purchase_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_p     public.vendor_token_purchases;
  v_admin UUID := auth.uid();
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;

  SELECT * INTO v_p FROM public.vendor_token_purchases
    WHERE purchase_id = p_purchase_id FOR UPDATE;
  IF v_p.purchase_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_p.status = 'paid' THEN
    RETURN jsonb_build_object('already', true, 'tokens', v_p.token_count);
  END IF;
  IF v_p.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'NOT_PENDING: %', v_p.status;
  END IF;

  -- Credit PURCHASED tokens — they NEVER expire (the vendor paid pesos for
  -- them, unlike earned/founder/referral tokens which sit in 45-day vouchers).
  -- The burn path consume_vendor_assets_per_voucher() spends earned vouchers
  -- FIFO and then drains purchased_tokens, so these are fully spendable.
  -- Idempotency is the status guard + the FOR UPDATE row lock above: the
  -- credit runs exactly once per purchase even if approve is called twice
  -- (e.g. admin double-click, or a payment webhook racing a manual confirm).
  -- The vendor_token_purchases row itself is the purchase audit trail.
  INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
  VALUES (v_p.vendor_id, v_p.token_count, 0)
  ON CONFLICT (vendor_id) DO UPDATE
    SET purchased_tokens = vendor_wallets.purchased_tokens + EXCLUDED.purchased_tokens,
        updated_at = NOW();

  UPDATE public.vendor_token_purchases
    SET status = 'paid', paid_at = now(), reviewed_by = v_admin
    WHERE purchase_id = p_purchase_id;

  RETURN jsonb_build_object('paid', true, 'tokens', v_p.token_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.approve_vendor_token_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_vendor_token_purchase(UUID) TO authenticated;

-- ── reject (admin) ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_vendor_token_purchase(p_purchase_id UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_console_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: admin only';
  END IF;
  UPDATE public.vendor_token_purchases
    SET status = 'rejected', reviewed_by = auth.uid(), rejection_reason = p_reason
    WHERE purchase_id = p_purchase_id AND status = 'pending_payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.reject_vendor_token_purchase(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_vendor_token_purchase(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.vendor_token_purchases IS
  'Apply-then-pay vendor token-pack orders. create_ → pending_payment · approve_ (admin/webhook) credits vendor_wallets.purchased_tokens (never-expire) + flips to paid (idempotent) · reject_ marks rejected. granted_voucher_id is reserved/unused (purchased tokens are not voucher-backed).';
