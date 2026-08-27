-- locked_qr_claim_reserves_its_date
--
-- WHAT A PERSON GETS: a supplier booked by scanning the couple's Locked QR —
-- where money has already changed hands — finally holds the date on their own
-- calendar, so their daily capacity and their bookings agree.
--
-- ⚠ THIS IS DEFENCE-IN-DEPTH, NOT A LIVE BUG, AND MUST NOT BE SOLD AS ONE.
-- Measured against production before writing this file: `vendor_locked_qr_tokens`
-- holds ZERO rows — not one claimed, not one pending, ever — and zero
-- `event_vendors` rows carry source 'vendor_locked_qr'. Nobody has been
-- double-sold a date through this path because nobody has used this path.
--
-- THE GAP
-- -------
-- `vendor_claim_locked_qr()` writes `status = 'deposit_paid'` — the strongest
-- status the enum has, and one of the three the pool doctrine counts as BOOKED
-- (lib/schedule-pools.ts) — and acquires no schedule pool. It is the only
-- booking path that does not. Every other route to a booked status reserves:
-- the couple's lock and the wizard lock via `acquire_schedule_pools`, the slot
-- path via `acquire_service_time_slot`, the vendor's deposit acknowledgement via
-- `acquireSchedulePoolsForBooking`. So a Locked-QR booking was invisible to
-- capacity: the vendor's own calendar would keep offering a day they had already
-- taken a downpayment for.
--
-- WHERE THE ACQUIRE GOES, AND WHY THE ORDER IS LOAD-BEARING
-- ---------------------------------------------------------
-- It runs LAST, as step (e). It must come after (d0), because
-- `acquire_schedule_pools` degrades open on any event whose date is not
-- day-precise, and (d0) is what finalises the agreed date and narrows the
-- precision to 'day'. Acquiring before that would return 'no_date' on every
-- single claim — a reservation that never happens, with every test green.
-- It must come after (a) because the reservation is held against `v_ev_id`, the
-- booking row that upsert creates. Running it after (b)/(c) as well means no
-- payment-plan or downpayment write can ever be skipped on its account.
--
-- ⛔ EVERY NON-OK OUTCOME DEGRADES **OPEN** AND WARNS. IT MUST NEVER ABORT.
-- Aborting reads like correctness and is the worst thing this function could do:
-- the token is SINGLE-USE and the money has ALREADY MOVED, so a refusal strands
-- a couple who has paid, holding a QR that can never be scanned again. One stale
-- manual block on the vendor's calendar is enough to trigger it. The plpgsql
-- EXCEPTION block below is the other half of that promise — it runs the acquire
-- in a subtransaction so that even an UNEXPECTED error inside the RPC rolls back
-- the reservation alone and never the claim. A bare call would let one bad row
-- take the whole booking down with it.
--
-- AUTHORIZATION — no widening, deliberately.
-- `acquire_schedule_pools` admits the couple on the event, the booked vendor, or
-- an admin, all resolved from `auth.uid()`. This function is SECURITY DEFINER,
-- but `auth.uid()` reads the request's own JWT, so the CLAIMER's identity is
-- what the acquire sees — the couple who just scanned. A claimer who hosts the
-- event under some other member_type is not in `current_couple_event_ids()` and
-- gets 'not_authorized', which degrades open and warns like any other refusal.
-- That is the correct trade: no reservation is a capacity gap, a refused claim
-- is a person who paid and cannot book.
--
-- POOL RESOLUTION IS BY CATEGORY, and that is not a shortcut. The claim writes
-- `category = t.category` on BOTH the insert and the update branch and writes no
-- `service_id` at all, so the category is the only thing the finished row names.
-- `resolve_schedule_pool` is the shared category resolver and carries its own
-- junk-pool guard: it returns NULL unless the vendor genuinely sells that
-- category, and NULL means no pools, which means degrade open. Bundle "comes
-- with" legs are keyed on `vendor_service_id`, which this row does not have, so
-- they are out of reach here by construction rather than by omission.
--
-- The body below is prod's own definition, read out with `pg_get_functiondef`
-- on 2026-08-27 (md5 a882fdb69c806ce58e8fb5ee1929f15a, 8204 bytes, verified to
-- carry the source COALESCE and the 'day' precision write and to contain no
-- acquire), with step (e) and its two DECLAREs added and nothing else changed.

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
  v_pool_id    UUID;
  v_acq        JSONB;
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
  --
  --      /!\ STEP (e) DEPENDS ON THIS ONE. The acquire degrades open unless the
  --      event carries a 'day'-precise date, so moving (e) above this block, or
  --      relaxing what this block writes, silently turns the reservation into a
  --      no-op that still reports success.
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

  -- (e) Reserve the date on the vendor's schedule, so this booking consumes
  --     daily capacity like every other booked status. THE ONE RULE HERE: this
  --     step may never refuse the claim. The token is single-use and the money
  --     has already moved, so an abort strands a couple who has paid. Every
  --     outcome other than 'ok' — full, blocked, locked, whitelist, no_date,
  --     no_pools, not_authorized, or an unexpected error — warns and continues.
  --
  --     The EXCEPTION block is not defensive noise: it opens a subtransaction,
  --     so an error raised anywhere inside the acquire rolls back the
  --     reservation and NOTHING ELSE. Delete it and one bad calendar row takes
  --     the whole booking with it.
  BEGIN
    v_pool_id := public.resolve_schedule_pool(t.vendor_profile_id, t.category);
    IF v_pool_id IS NOT NULL THEN
      v_acq := public.acquire_schedule_pools(p_event_id, v_ev_id, ARRAY[v_pool_id]);
      IF COALESCE(v_acq->>'status', 'error') <> 'ok' THEN
        RAISE WARNING '[locked-qr] schedule NOT reserved (degrading open): status=% event_vendor_id=% pool_id=% event_id=%',
          COALESCE(v_acq->>'status', 'error'), v_ev_id, v_pool_id, p_event_id;
      END IF;
    ELSE
      RAISE WARNING '[locked-qr] no schedule pool for category % on vendor % — booking holds no date (degrading open): event_vendor_id=%',
        t.category, t.vendor_profile_id, v_ev_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[locked-qr] schedule reservation errored (degrading open): % — event_vendor_id=% event_id=%',
      SQLERRM, v_ev_id, p_event_id;
  END;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', p_event_id,
    'event_vendor_id', v_ev_id
  );
END;
$function$;

COMMENT ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) IS
  'Consumes a single-use Locked-QR token: locks event_vendors to deposit_paid, '
  'freezes the payment plan, records the downpayment, finalizes the agreed date, '
  'and reserves the vendor schedule pool for that date so the booking consumes '
  'daily capacity like every other booked status. The reservation ALWAYS degrades '
  'OPEN and warns — never aborts — because the token is single-use and the money '
  'has already moved, so a refusal would strand a couple who has paid. '
  'event_vendors.source is written ONLY when inserting a new row — an existing '
  'row keeps how the couple originally found the vendor (owner rule 2026-08-09), '
  'because that column is the free-vs-billable axis and a lock is a status change, '
  'not a rewrite of history.';
