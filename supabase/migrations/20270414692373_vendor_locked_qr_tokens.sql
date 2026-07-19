-- vendor_locked_qr_tokens
-- ============================================================================
-- LOCKED QR (My Shop → "Locked QR"): a single-use, per-customer QR a vendor
-- issues after taking a downpayment off-platform. It carries the deal — event
-- type + service category + total value + initial paid + payment schedule +
-- a proof photo — and when the couple scans it, ATOMICALLY:
--   1. consumes the token (single-use, race-safe — mirrors papic_claim_seat),
--   2. locks the vendor onto the couple's event (event_vendors, deposit_paid),
--   3. freezes the payment plan (event_vendor_payment_plan.instances_json),
--   4. records the downpayment (event_vendor_payments).
--
-- WHY a SECURITY DEFINER claim fn (not RLS writes): the CLAIMER is the couple,
-- not the vendor, and event_vendors has no vendor-facing write path; doing all
-- four writes in ONE plpgsql function guarantees atomicity (a consumed token
-- always has its lock + plan + payment, never a half-state). Same posture as
-- papic_claim_seat / panood_claim_camera. The token is the capability;
-- auth.uid() is the claimer identity; the fn binds the two under owner rights
-- and re-gates event ownership via public.current_event_ids().
--
-- Money definition reuse (no divergence): the lock status, plan instances shape
-- ({seq,label,amount_kind,amount_php,due_date}) and payment row mirror the
-- couple-side lock flow (event_vendor_payment_plan 20270202160005, budget
-- 20260513110000). Peso amounts are computed from the frozen schedule template.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (+ RLS enabled in the SAME migration),
-- DROP POLICY IF EXISTS/CREATE POLICY, CREATE OR REPLACE FUNCTION. Re-runnable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The issued Locked-QR tokens.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_locked_qr_tokens (
  id                       BIGSERIAL PRIMARY KEY,
  public_id                TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Y'),
  -- The URL capability the QR encodes (high-entropy, unguessable).
  token                    TEXT NOT NULL UNIQUE
                           DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  -- Issuing vendor store + the member who issued it.
  vendor_profile_id        UUID NOT NULL
                           REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  created_by_user_id       UUID NOT NULL,
  -- The deal the vendor is locking in.
  event_type               TEXT,                 -- picked event-type (nullable)
  category                 TEXT NOT NULL,        -- VendorCategory to lock under
  total_php                NUMERIC(12,2),        -- total contract value (nullable)
  initial_paid_php         NUMERIC(12,2) NOT NULL DEFAULT 0
                           CHECK (initial_paid_php >= 0),
  -- Frozen schedule TEMPLATE the plan is computed from on claim. Array of
  -- {seq,label,amount_kind('percent'|'fixed'),amount_value,due_anchor
  -- ('on_lock'|'before_event'),due_offset_days}.
  schedule_json            JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof_r2_key             TEXT,                 -- uploaded downpayment proof
  -- Single-use lifecycle.
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'claimed', 'void')),
  claimed_by_user_id       UUID,
  claimed_event_id         UUID,
  claimed_event_vendor_id  UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vendor_locked_qr_tokens_vendor_idx
  ON public.vendor_locked_qr_tokens (vendor_profile_id, created_at DESC);

ALTER TABLE public.vendor_locked_qr_tokens ENABLE ROW LEVEL SECURITY;

-- The issuing vendor org manages its own tokens; console admins read all. The
-- claimer never needs an RLS read — the claim page reads via the admin client
-- (it only knows the opaque token) and the claim itself is SECURITY DEFINER.
DROP POLICY IF EXISTS vendor_locked_qr_vendor_all ON public.vendor_locked_qr_tokens;
CREATE POLICY vendor_locked_qr_vendor_all ON public.vendor_locked_qr_tokens
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_locked_qr_admin_read ON public.vendor_locked_qr_tokens;
CREATE POLICY vendor_locked_qr_admin_read ON public.vendor_locked_qr_tokens
  FOR SELECT
  USING (public.is_console_admin());

COMMENT ON TABLE public.vendor_locked_qr_tokens IS
  'Single-use Locked-QR tokens (My Shop -> Locked QR). A vendor issues one per customer after an off-platform downpayment; carries event_type + category + total + initial_paid + schedule template + proof. Consumed atomically by vendor_claim_locked_qr(): locks event_vendors (deposit_paid), freezes event_vendor_payment_plan, records event_vendor_payments. Vendor-org RLS + console-admin read.';

-- ----------------------------------------------------------------------------
-- 2. The atomic, race-safe claim.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_claim_locked_qr(
  p_token    TEXT,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  t            public.vendor_locked_qr_tokens%ROWTYPE;
  v_vendor     public.vendor_profiles%ROWTYPE;
  v_event_date DATE;
  v_ev_id      UUID;
  v_instances  JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthenticated');
  END IF;

  SELECT * INTO t FROM public.vendor_locked_qr_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF t.status = 'void' THEN
    RETURN jsonb_build_object('status', 'void');
  END IF;

  -- Idempotent re-scan by the same claimer -> report the existing lock, don't
  -- double-apply. A different user hitting a consumed token -> 'taken'.
  IF t.status = 'claimed' THEN
    IF t.claimed_by_user_id = v_uid THEN
      RETURN jsonb_build_object(
        'status', 'already_claimed',
        'event_id', t.claimed_event_id,
        'event_vendor_id', t.claimed_event_vendor_id
      );
    END IF;
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  -- Ownership: the target event must be one the claimer hosts.
  IF p_event_id NOT IN (SELECT public.current_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_your_event');
  END IF;

  -- Race-safe single-use bind: only one caller can flip pending->claimed.
  UPDATE public.vendor_locked_qr_tokens
     SET status             = 'claimed',
         claimed_by_user_id = v_uid,
         claimed_event_id   = p_event_id,
         claimed_at         = NOW()
   WHERE token = p_token AND status = 'pending'
  RETURNING * INTO t;
  IF NOT FOUND THEN
    -- Someone else won the race between our read and this update.
    RETURN jsonb_build_object('status', 'taken');
  END IF;

  SELECT * INTO v_vendor
    FROM public.vendor_profiles WHERE vendor_profile_id = t.vendor_profile_id;

  -- (a) Lock the vendor onto the event. Upsert on (event_id, marketplace
  --     vendor): a considering/shortlisted row is promoted to deposit_paid;
  --     otherwise a fresh locked row is inserted.
  SELECT vendor_id INTO v_ev_id
    FROM public.event_vendors
   WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
   LIMIT 1;

  IF v_ev_id IS NULL THEN
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, category, vendor_name,
      status, source, total_cost_php
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = 'vendor_locked_qr',
           total_cost_php = COALESCE(t.total_php, total_cost_php),
           category       = t.category::public.vendor_category
     WHERE vendor_id = v_ev_id;
  END IF;

  -- (b) Freeze the payment plan from the schedule template. amount_php resolves
  --     percent-of-total or fixed; due_date anchors on_lock (today) or
  --     before_event (event date - offset), NULL when unanchored.
  SELECT event_date INTO v_event_date FROM public.events WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'seq',         (item->>'seq')::INT,
             'label',       item->>'label',
             'amount_kind', item->>'amount_kind',
             'amount_php',  CASE
               WHEN item->>'amount_kind' = 'percent'
                 THEN ROUND(COALESCE(t.total_php, 0) * (item->>'amount_value')::NUMERIC / 100.0, 2)
               ELSE ROUND((item->>'amount_value')::NUMERIC, 2)
             END,
             'due_date',    CASE
               WHEN item->>'due_anchor' = 'on_lock'
                 THEN to_char(CURRENT_DATE + COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               WHEN item->>'due_anchor' = 'before_event' AND v_event_date IS NOT NULL
                 THEN to_char(v_event_date - COALESCE((item->>'due_offset_days')::INT, 0), 'YYYY-MM-DD')
               ELSE NULL
             END
           )
           ORDER BY (item->>'seq')::INT
         ), '[]'::jsonb)
    INTO v_instances
    FROM jsonb_array_elements(t.schedule_json) AS item;

  INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json)
  VALUES (p_event_id, v_ev_id, v_instances)
  ON CONFLICT (event_id, event_vendor_id)
  DO UPDATE SET instances_json = EXCLUDED.instances_json, updated_at = NOW();

  -- (c) Record the downpayment already received off-platform (proof on the
  --     token). Skipped when zero.
  IF COALESCE(t.initial_paid_php, 0) > 0 THEN
    INSERT INTO public.event_vendor_payments (
      event_id, vendor_id, amount_php, method, reference, notes
    ) VALUES (
      p_event_id, v_ev_id, t.initial_paid_php, 'qr_lock', t.public_id,
      'Downpayment recorded from Locked QR'
    );
  END IF;

  -- (d) Backfill the resolved booking onto the token for the audit trail.
  UPDATE public.vendor_locked_qr_tokens
     SET claimed_event_vendor_id = v_ev_id
   WHERE id = t.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', p_event_id,
    'event_vendor_id', v_ev_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) IS
  'Single-use Locked-QR claim. SECURITY DEFINER, race-safe (conditional pending->claimed UPDATE, mirrors papic_claim_seat). Re-gates event ownership via current_event_ids(). Atomically consumes the token, upserts the event_vendors lock (deposit_paid, source=vendor_locked_qr), freezes event_vendor_payment_plan from the schedule template, records the initial_paid_php downpayment into event_vendor_payments. Idempotent re-scan by same claimer returns already_claimed. Verdicts: unauthenticated|invalid|void|taken|already_claimed|not_your_event|ok.';
