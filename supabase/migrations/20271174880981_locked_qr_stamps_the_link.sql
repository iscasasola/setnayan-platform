-- ============================================================================
-- A LOCKED-QR BOOKING FINALLY STAMPS THE LINK TO THE SHOP
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
-- `event_vendors` carries TWO columns that answer one question — which Setnayan
-- shop is this booking? — and three readers split across them:
--
--   · `marketplace_vendor_id`  → get_vendor_event_brief, the booked-supplier
--                                schedule policy, the vendor capture policy;
--   · `linked_vendor_profile_id` → the supplier doorway and desk on `/{slug}`,
--                                editorial first-pick credit, Real Stories
--                                credit, Papic attribution, stage-note
--                                recipients, showcase credits, chapter
--                                participation, the plausibility scanner.
--
-- Read out of PRODUCTION with `pg_get_functiondef` — not from a migration —
-- every booking path stamps BOTH: `acquire_service_time_slot`,
-- `vendor_agree_to_lock` (since #4488), and the wizard's own lock action, which
-- writes `linked_vendor_profile_id: targetVendor.marketplace_vendor_id`.
--
-- 🔴 `vendor_claim_locked_qr` DID NOT. It set `marketplace_vendor_id` and never
-- mentioned the other column anywhere in its body — and it is the path where
-- MONEY HAS ALREADY CHANGED HANDS. A supplier booked by scanning the couple's
-- locked QR was therefore invisible to all nine of the surfaces above: no
-- doorway and no desk on the celebration's own page, no photo credit, no story
-- credit, no stage notes.
--
-- 🔑 THIS IS THE SAME DEFECT PR #4488 FIXED IN ITS TWIN, SURVIVING IN THE
-- CLONE. `vendor_agree_to_lock` had exactly this hole; it was found, fixed and
-- written up, and the Locked-QR sibling was never swept. Fourth instance of
-- that shape in this repo.
--
-- ── WHY THIS NEEDS NO OWNER DECISION ────────────────────────────────────────
-- It does not widen anything. It makes a booking that has already taken a
-- downpayment equal to every other booking, which is what the other three
-- writers already do, and it is monotone: the UPDATE arm COALESCEs, so an
-- existing link is never overwritten.
--
-- ── SAFE BY ARITHMETIC ──────────────────────────────────────────────────────
-- Production holds ZERO locked-QR tokens, ever — none claimed, none pending —
-- and zero `event_vendors` rows sourced `vendor_locked_qr`. Nothing is
-- backfilled because there is nothing to backfill.
--
-- ── REPRODUCED WHOLE, AND TWO INVARIANTS CHECKED EXPLICITLY ─────────────────
-- `CREATE OR REPLACE` restates the entire body, so a rewrite can silently drop
-- somebody else's rule. Both of this function's are verified present in the new
-- body and pinned by the accompanying db test:
--   1. `COALESCE(source, 'vendor_locked_qr')` — the 2026-08-09 owner rule that
--      a lock is a status change, never a rewrite of how the couple found them.
--   2. Step (e), the schedule acquire, still sits AFTER the block that narrows
--      `event_date_precision` to 'day'. Hoisted above it, every claim reserves
--      nothing while reporting success.
--
-- ⛔ `selection_match_rank` is deliberately NOT written here. #4488 set it on
-- the agree path because an agreed lock resolves a marketplace SUGGESTION; a
-- Locked QR is a shop bringing its own couple in, so asserting a perfect match
-- rank would be a claim about a suggestion that never happened.
-- ============================================================================

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
      event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name,
      status, source, total_cost_php, notes
    ) VALUES (
      p_event_id, t.vendor_profile_id, t.vendor_profile_id, t.category::public.vendor_category, v_vendor.business_name,
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
           linked_vendor_profile_id =
             COALESCE(linked_vendor_profile_id, t.vendor_profile_id),
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

COMMENT ON FUNCTION public.vendor_claim_locked_qr(text, uuid) IS
  'Claim a vendor Locked-QR token onto an event the caller hosts. Single-use and '
  'race-safe. Writes BOTH marketplace_vendor_id and linked_vendor_profile_id — the '
  'second was missing for the whole life of this function, which made a paid '
  'Locked-QR booking invisible to the supplier doorway and desk on the event page, '
  'to editorial and photo credit, and to stage-note delivery; the same hole '
  '#4488 closed on vendor_agree_to_lock. The UPDATE arm COALESCEs, so an existing '
  'link is never overwritten. event_vendors.source is still written ONLY when '
  'inserting a new row (owner rule 2026-08-09). The schedule acquire is step (e), '
  'still after the date-precision narrowing, and still degrades OPEN: the token is '
  'single-use and the money has already moved, so a refusal would strand a couple '
  'who has paid.';
