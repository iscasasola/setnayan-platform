-- locked_qr_preserves_how_they_found_you
--
-- THE BUG: the Locked QR erased the record of how the couple found the vendor.
--
-- Owner rule (2026-08-09), verbatim: "we have a rule. to check the user first if
-- they found each other first on the website or not." That answer lives in
-- `event_vendors.source`, and it is the axis the whole free-vs-billable model
-- turns on — a client the VENDOR brought is free forever, a client SETNAYAN
-- sourced is billable.
--
-- `vendor_claim_locked_qr()` upserts the couple↔vendor row. On the INSERT branch
-- (no prior relationship) stamping 'vendor_locked_qr' is correct — the vendor
-- brought them. On the UPDATE branch it was stamping the SAME value over a row
-- that already existed, which is precisely the case where the couple had ALREADY
-- found the vendor on Setnayan and shortlisted them. One scan and
-- 'host_marketplace_search' became 'vendor_locked_qr'.
--
-- WHAT THAT ACTUALLY COST, measured against the live classifier
-- `vendor_source_attribution()`: it buckets 'host_marketplace_search' +
-- 'auto_cascade_from_finalize' as **setnayan**, 'host_manual' + 'admin' as
-- **off_platform**, and EVERYTHING ELSE — including 'vendor_locked_qr' — as
-- **unattributed**. So a booking Setnayan genuinely sourced silently left the
-- "Setnayan sourced" column on the vendor's own My Performance page and landed
-- in "unattributed". The vendor is under-credited to Setnayan and the platform
-- loses the evidence that it earned the introduction.
--
-- ⚠ NOT A BILLING BUG TODAY, and this migration must not be sold as fixing one.
-- The booking fee reads a THREAD's `inquiry_source` (`booking_fee_is_sourced_surface`),
-- not this column, and `bookingFeeSendGate` has no live caller — production holds
-- zero fee charges. The harm today is attribution. The harm LATER is that the fee
-- is scoped to "sourced clients only", and this is the column whose name answers
-- that question — so the destroyed value is the one a future wiring will reach
-- for. Fixing it now costs one line; reconstructing it afterwards is impossible.
--
-- THE FIX: COALESCE instead of overwrite. An existing row keeps the source it was
-- created with; a legacy row that somehow carries none still gets stamped, so the
-- column never goes back to NULL. Nothing else in the function changes — the body
-- below is prod's own definition, read out with pg_get_functiondef, with that one
-- assignment altered.
--
-- No backfill: production has zero claimed Locked-QR tokens, so there is no
-- overwritten row to restore. Verified before writing this migration; a backfill
-- would be guesswork dressed as a repair, because the original value is gone.

CREATE OR REPLACE FUNCTION public.vendor_claim_locked_qr(p_token text, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  --
  --      /!\ THE PRECISION MOVES WITH THE DATE (fixed 2026-08-02). The token's
  --      date is a single contracted calendar day — the generator offers only
  --      `<input type="date">`, the issue action validates it against the
  --      vendor's calendar for that ONE day, and a downpayment has already been
  --      taken against it — so 'day' is the honest precision, and leaving the
  --      column at its 'year' creation default made every countdown skip a date
  --      the couple had signed a contract on. 'day' is also the narrowest rung,
  --      so this can only narrow precision, never widen it. date_status is
  --      deliberately NOT written here: sync_event_date_status_trg promotes it
  --      to 'locked' off this very UPDATE, and an explicit write would suppress
  --      that invariant.
  IF t.event_date IS NOT NULL THEN
    UPDATE public.events
       SET event_date           = t.event_date,
           event_date_precision = 'day',
           date_candidates      = NULL,
           date_window_start    = NULL,
           date_window_end      = NULL,
           date_mode            = NULL,
           updated_at           = NOW()
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
    -- No prior relationship: the vendor genuinely brought this couple in, so the
    -- QR IS how they found each other. Stamping it here is the correct answer.
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, category, vendor_name,
      status, source, total_cost_php, notes
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php, t.service_description
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    -- A row ALREADY EXISTS — they found each other before this scan, and how
    -- they did is recorded in `source`. Locking a booking is a change of STATUS,
    -- never a rewrite of history: COALESCE preserves the original and only
    -- stamps a legacy row that carries no source at all, so the column can never
    -- fall back to NULL. Removing this COALESCE re-opens the bug in the header.
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = COALESCE(source, 'vendor_locked_qr'),
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
$function$;

COMMENT ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) IS
  'Consumes a single-use Locked-QR token: locks event_vendors to deposit_paid, '
  'freezes the payment plan, records the downpayment, finalizes the agreed date. '
  'event_vendors.source is written ONLY when inserting a new row — an existing '
  'row keeps how the couple originally found the vendor (owner rule 2026-08-09), '
  'because that column is the free-vs-billable axis and a lock is a status change, '
  'not a rewrite of history.';
