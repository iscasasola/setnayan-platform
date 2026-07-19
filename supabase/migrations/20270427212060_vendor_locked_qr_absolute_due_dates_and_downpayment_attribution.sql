-- vendor_claim_locked_qr — absolute due-dates + downpayment attribution
-- ============================================================================
-- The Locked-QR generator moved to a concrete "Name · Date · Amount" schedule:
-- each installment now carries an ABSOLUTE `due_date` (a calendar date the
-- vendor picks) and a FIXED peso `amount_value`. Row 1 (seq 1) is always the
-- downpayment and equals the token's initial_paid_php.
--
-- CREATE OR REPLACE on top of 20270426215000 (keeps its d0 event-date finalize +
-- service_description scope freeze byte-for-byte). Two deltas only:
--
--   1. DUE DATE — prefer the row's absolute `due_date`; fall back to the legacy
--      on_lock / before_event anchor+offset resolution so previously-issued
--      tokens still freeze correctly. amount_kind is COALESCEd to 'fixed' (the
--      new rows omit it — they're always fixed pesos).
--
--   2. DOWNPAYMENT ATTRIBUTION — the recorded initial_paid_php payment is now
--      linked to installment seq 1 AND stamped vendor_confirmed_at/by (the
--      vendor took it off-platform, with proof). Previously it was recorded
--      unattributed, so the couple's stepper showed the seq-1 "Downpayment"
--      installment as still DUE while a separate confirmed payment sat beside it
--      — a double-count. Attributing + confirming it settles that installment.
--
-- Idempotent CREATE OR REPLACE — re-runnable, no signature/RLS change.
-- ============================================================================

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

  -- (d0) Finalize the agreed wedding date (owner 2026-07). A Locked QR implies a
  --      settled date; the scan page already got the couple's consent to
  --      finalize/change. Clear the candidate set + window so the date is now
  --      resolved. No-op for legacy tokens (event_date NULL).
  IF t.event_date IS NOT NULL THEN
    UPDATE public.events
       SET event_date        = t.event_date,
           date_candidates   = NULL,
           date_window_start = NULL,
           date_window_end   = NULL,
           date_mode         = NULL,
           updated_at        = NOW()
     WHERE event_id = p_event_id;
  END IF;

  -- (a) Lock the vendor onto the event. Upsert on (event_id, marketplace
  --     vendor): a considering/shortlisted row is promoted to deposit_paid;
  --     otherwise a fresh locked row is inserted. `notes` carries the frozen
  --     "what the couple availed" scope of work.
  SELECT vendor_id INTO v_ev_id
    FROM public.event_vendors
   WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
   LIMIT 1;

  IF v_ev_id IS NULL THEN
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, category, vendor_name,
      status, source, total_cost_php, notes
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php, t.service_description
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = 'vendor_locked_qr',
           total_cost_php = COALESCE(t.total_php, total_cost_php),
           category       = t.category::public.vendor_category,
           notes          = COALESCE(t.service_description, notes)
     WHERE vendor_id = v_ev_id;
  END IF;

  -- (b) Freeze the payment plan from the schedule template. amount_php resolves
  --     percent-of-total (legacy) or fixed; due_date prefers the row's ABSOLUTE
  --     `due_date`, else falls back to on_lock (today) / before_event
  --     (event date - offset), NULL when unanchored. v_event_date reflects the
  --     just-finalized agreed date.
  SELECT event_date INTO v_event_date FROM public.events WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'seq',         (item->>'seq')::INT,
             'label',       item->>'label',
             'amount_kind', COALESCE(item->>'amount_kind', 'fixed'),
             'amount_php',  CASE
               WHEN item->>'amount_kind' = 'percent'
                 THEN ROUND(COALESCE(t.total_php, 0) * (item->>'amount_value')::NUMERIC / 100.0, 2)
               ELSE ROUND((item->>'amount_value')::NUMERIC, 2)
             END,
             'due_date',    CASE
               WHEN NULLIF(item->>'due_date', '') IS NOT NULL
                 THEN item->>'due_date'
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
  --     token). Attributed to installment seq 1 (the downpayment row) and
  --     stamped vendor-confirmed so the couple's stepper shows it PAID rather
  --     than double-counting a separate unattributed payment. Skipped when zero.
  IF COALESCE(t.initial_paid_php, 0) > 0 THEN
    INSERT INTO public.event_vendor_payments (
      event_id, vendor_id, amount_php, method, reference, notes,
      schedule_instance_seq, vendor_confirmed_at, vendor_confirmed_by
    ) VALUES (
      p_event_id, v_ev_id, t.initial_paid_php, 'qr_lock', t.public_id,
      'Downpayment recorded from Locked QR',
      1, NOW(), t.created_by_user_id
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

COMMENT ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) IS
  'Single-use Locked-QR claim. SECURITY DEFINER, race-safe. Finalizes the agreed event_date, freezes event_vendors (scope in notes) + event_vendor_payment_plan from the schedule template (absolute due_date preferred, legacy on_lock/before_event anchor fallback), records the initial_paid_php downpayment into event_vendor_payments attributed to installment seq 1 + vendor-confirmed. Idempotent re-scan by same claimer returns already_claimed. Verdicts: unauthenticated|invalid|void|taken|already_claimed|not_your_event|ok.';
