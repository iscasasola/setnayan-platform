-- first_registered_booked_qr_wins_the_date · A6-71 · LAUNCH L9 (final check 25 Nov)
--
-- Owner ruling (25 Nov, LAUNCH-GATE.md L9): two booked/locked QR claims for one supplier date — the one REGISTERED
-- FIRST wins. Decided in ONE atomic database step: `vendor_claim_locked_qr` now counts the date under the house lock
-- order (booking → card → shop count lock → schedule row FOR UPDATE) and refuses a full date ('date_full') BEFORE the
-- token is flipped or anything is written. It honours the schedule's own number — counting the shop's booked bookings
-- that hold no seat too — and the code's service card limit (`service_card_daily_limit`: the card's own number per
-- date; the "+1 booking per date" add-on question is the owner's and is not changed here), with the seat's and the
-- yes's own exemptions (Always available, by the piece, slotted cards). Only a COUPLE of the event may claim
-- (`current_couple_event_ids`, was `current_event_ids`, which answered guests too). The booking now carries the
-- code's card (`event_vendors.service_id`) so that card count sees it. Every other step is the shipped body of
-- 20271328327292, unchanged. CREATE OR REPLACE keeps the grants. Idempotent.
--
-- Held by tests/db/the-first-booked-qr-wins-the-date.db.test.ts (two concurrent claims → exactly one books).

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
  v_cap        INT;
  v_card_cap   INT;
  v_existing   UUID;
  v_style      TEXT;
  v_seatless   INT := 0;
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

  -- Ownership: the target event must be one the claimer is a COUPLE of (A6-71 review, 25 Nov). `current_event_ids`
  -- also answers a guest member, who could then claim a code onto the host's event, rewrite its date and book the
  -- supplier; the couple check is the one the seat step (e) already uses.
  IF p_event_id NOT IN (SELECT public.current_couple_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_your_event');
  END IF;

  -- ── (0) THE DATE IS DECIDED HERE, ONCE (A6-71 · LAUNCH L9; owner 25 Nov: "the first registered wins") ──────────
  -- Two booked QRs for one supplier date used to both book it: the date was checked only when a code was MADE, and the
  -- seat was taken in step (e), after the claim was written, degrading OPEN. Now, before anything is written, the claim
  -- counts the date under the same locks the seat and the yes take, and refuses a full date. A refused claim writes
  -- NOTHING (the token stays pending — the supplier still sees it, and can void it or move the couple to another date).
  --
  -- 🔒 LOCK ORDER — the house order, so no two paths wait on each other: the BOOKING row (this event's existing one
  -- with the shop, if any) → the CARD row (NO KEY) → the shop's one count lock (`lock_shop_day_counts`) → the
  -- SCHEDULE row (FOR UPDATE). vendor_agree_to_lock and set_booked_quantity take booking → card → shop;
  -- the seat step (e) takes shop → schedule. A second claim on the same date waits on the first lock it shares
  -- with the first claim, then counts again on a fresh statement and sees that claim's booking.
  --
  -- WHAT IS COUNTED (each rule the one the seat or the yes already applies — never a stricter one):
  --   · an Always available card ('none') takes no seat and has no limit: nothing is checked;
  --   · a by-the-piece card is judged by its card number only (pieces never take a schedule seat), as the seat does;
  --   · any other card is judged by the schedule's own number (`daily_booking_capacity`): the seats taken
  --     (`schedule_pool_taken_on`) PLUS this shop's booked bookings on that date for the same schedule that hold NO
  --     seat — a booking whose seat step degraded open (a blocked, held or approve-first day) still took the date;
  --   · the card's own number per date (`service_card_daily_limit`, counted by `service_card_bookings_on`) — except a
  --     card with an active time slot that is not by the piece, which the yes judges by its slot alone.
  -- An event that already holds this shop is not counted against itself.
  IF t.event_date IS NOT NULL THEN
    SELECT vendor_id INTO v_existing
      FROM public.event_vendors
     WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
     LIMIT 1
       FOR UPDATE;

    IF t.vendor_service_id IS NOT NULL THEN
      SELECT vs.availability_style INTO v_style
        FROM public.vendor_services vs
       WHERE vs.vendor_service_id = t.vendor_service_id
         FOR NO KEY UPDATE;
      PERFORM public.lock_shop_day_counts(t.vendor_service_id);
    END IF;

    IF v_style IS DISTINCT FROM 'none' THEN
      -- The schedule's number (not for pieces). A read-only lookup: resolve_schedule_pool may CREATE a schedule, and
      -- a claim that is refused writes nothing.
      IF v_style IS DISTINCT FROM 'piece' THEN
        SELECT c.pool_id INTO v_pool_id
          FROM public.vendor_schedule_pool_categories c
         WHERE c.vendor_profile_id = t.vendor_profile_id AND c.category_key = t.category;
        IF v_pool_id IS NOT NULL THEN
          SELECT daily_booking_capacity INTO v_cap
            FROM public.vendor_schedule_pools
           WHERE pool_id = v_pool_id AND is_active
             FOR UPDATE;
          IF FOUND AND v_cap IS NOT NULL THEN
            v_seatless := (
              SELECT count(*)::int
                FROM public.event_vendors ev
                JOIN public.events e ON e.event_id = ev.event_id
                LEFT JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
               WHERE ev.marketplace_vendor_id = t.vendor_profile_id
                 AND ev.status::text = ANY (public.booked_event_vendor_statuses())
                 AND ev.archived_at IS NULL
                 AND e.event_date = t.event_date
                 AND 'day' = e.event_date_precision
                 AND ev.vendor_id IS DISTINCT FROM v_existing
                 AND vs.availability_style IS DISTINCT FROM 'none'
                 AND vs.availability_style IS DISTINCT FROM 'piece'
                 AND EXISTS (
                   SELECT 1 FROM public.vendor_schedule_pool_categories c
                    WHERE c.vendor_profile_id = t.vendor_profile_id
                      AND c.category_key = ev.category::text
                      AND c.pool_id = v_pool_id)
                 AND NOT EXISTS (
                   SELECT 1 FROM public.vendor_schedule_pool_bookings pb
                    WHERE pb.event_vendor_id = ev.vendor_id AND pb.released_at IS NULL));
            IF public.schedule_pool_taken_on(v_pool_id, t.event_date, v_existing) + v_seatless + 1 > v_cap THEN
              RETURN jsonb_build_object('status', 'date_full', 'event_date', t.event_date);
            END IF;
          END IF;
        END IF;
      END IF;

      -- The card's own number (a slotted card that is not by the piece is judged by its slot, as the yes does).
      IF t.vendor_service_id IS NOT NULL AND (v_style = 'piece' OR NOT EXISTS (
           SELECT 1 FROM public.vendor_service_time_slots ts
            WHERE ts.vendor_service_id = t.vendor_service_id AND ts.is_active)) THEN
        v_card_cap := public.service_card_daily_limit(t.vendor_service_id);
        IF v_card_cap IS NOT NULL AND v_card_cap > 0
           AND public.service_card_bookings_on(t.vendor_service_id, t.event_date, v_existing) + 1 > v_card_cap THEN
          RETURN jsonb_build_object('status', 'date_full', 'event_date', t.event_date);
        END IF;
      END IF;
    END IF;
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

  -- (d0) Finalize the agreed wedding date (owner 2026-07). The precision moves
  --      with the date ('day'); date_status is left to sync_event_date_status_trg.
  --      /!\ STEP (e) DEPENDS ON THIS ONE — see 20271174880981.
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

  -- (a) Lock the vendor onto the event (both shop columns stamped).
  SELECT vendor_id INTO v_ev_id
    FROM public.event_vendors
   WHERE event_id = p_event_id AND marketplace_vendor_id = t.vendor_profile_id
   LIMIT 1;

  IF v_ev_id IS NULL THEN
    INSERT INTO public.event_vendors (
      event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name,
      status, source, total_cost_php, notes, service_id
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
      'deposit_paid', 'vendor_locked_qr', t.total_php, t.service_description, t.vendor_service_id
    )
    RETURNING vendor_id INTO v_ev_id;
  ELSE
    -- A lock is a change of STATUS, never a rewrite of how they found each
    -- other: COALESCE keeps the original source (owner rule 2026-08-09).
    UPDATE public.event_vendors
       SET status         = 'deposit_paid',
           source         = COALESCE(source, 'vendor_locked_qr'),
           linked_vendor_profile_id =
             COALESCE(linked_vendor_profile_id, t.vendor_profile_id),
           total_cost_php = COALESCE(t.total_php, total_cost_php),
           category       = t.category::public.vendor_category,
           notes          = COALESCE(t.service_description, notes),
           -- A6-71: the booking carries the code's card, so the card's daily count (step 0) sees it.
           service_id     = COALESCE(service_id, t.vendor_service_id)
     WHERE vendor_id = v_ev_id;
  END IF;

  -- (b) Freeze the payment plan from the schedule template.
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

  -- (c) Record the downpayment already received off-platform.
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

  -- (c2) THE QUOTATION THE CODE CARRIES (Supplier Build 2 lane E; DECISION_LOG
  --      2026-11-03 "A BOOKED QR CARRIES THE WHOLE PURCHASE"). The token's lines
  --      are copied as stored — never computed, never priced here — into ONE
  --      accepted quote for this event × shop. A code without lines (issued
  --      before #34) writes nothing. The shop's earlier live quotes on this
  --      event are retired first, so exactly one accepted quote states the deal.
  --      `locked_qr_token_id` is UNIQUE: a re-run writes no second copy.
  IF t.quote_line_items IS NOT NULL
     AND jsonb_typeof(t.quote_line_items) = 'array'
     AND jsonb_array_length(t.quote_line_items) > 0
     AND t.total_php IS NOT NULL THEN
    UPDATE public.vendor_proposals
       SET status = 'superseded', updated_at = NOW()
     WHERE event_id = p_event_id
       AND vendor_profile_id = t.vendor_profile_id
       AND status IN ('sent', 'viewed', 'accepted')
       AND locked_qr_token_id IS DISTINCT FROM t.id;

    INSERT INTO public.vendor_proposals (
      vendor_profile_id, event_id, title, line_items, total_centavos,
      status, sent_at, resolved_at, resolved_by_user_id, locked_qr_token_id
    ) VALUES (
      t.vendor_profile_id, p_event_id,
      left(COALESCE(NULLIF(btrim(t.service_description), ''), 'Booked QR'), 160),
      t.quote_line_items, ROUND(t.total_php * 100)::BIGINT,
      'accepted', NOW(), NOW(), v_uid, t.id
    )
    ON CONFLICT (locked_qr_token_id) WHERE locked_qr_token_id IS NOT NULL DO NOTHING;
  END IF;

  -- (d) Backfill the resolved booking onto the token for the audit trail.
  UPDATE public.vendor_locked_qr_tokens
     SET claimed_event_vendor_id = v_ev_id
   WHERE id = t.id;

  -- (e) Reserve the date on the vendor's schedule. THE ONE RULE HERE: this
  --     step may never refuse the claim — the money has already moved. The
  --     EXCEPTION block opens a subtransaction so an error rolls back the
  --     reservation and NOTHING ELSE.
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

COMMENT ON FUNCTION public.vendor_claim_locked_qr(text, uuid) IS
  'Claim a vendor Locked-QR (Booked QR) token onto an event the caller is a couple of. Single-use and race-safe. Step (0) '
  '(A6-71, owner 25 Nov: the first registered wins): before anything is written, the date is counted under the house '
  'lock order (booking, card, shop count lock, schedule row FOR UPDATE) and a full date — the schedule''s own number '
  '(seats plus booked bookings that hold none), or the code''s service card limit per date — refuses with status '
  '''date_full'' and writes nothing (the token stays pending). Writes BOTH '
  'marketplace_vendor_id and linked_vendor_profile_id, and the code''s card as service_id. event_vendors.source is '
  'written ONLY when inserting a new row (owner rule 2026-08-09). Step (c2): the code''s stored quote lines are copied '
  'into ONE accepted vendor_proposals row. The schedule acquire is step (e), after the date-precision narrowing.';
