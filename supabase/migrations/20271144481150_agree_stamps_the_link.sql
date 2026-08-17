-- agree_stamps_the_link — the agree RPC finally writes the link it was said to write
--
-- WHAT A PERSON WOULD HAVE EXPERIENCED WITHOUT THIS: the owner flips the
-- ask-and-agree booking flag; a supplier presses Agree; they are booked — and
-- then their own "you are booked here" doorway does not appear on the couple's
-- page, their photos are credited to nobody, and they are not offered as a
-- recipient for the run-of-show. Booked and invisible.
--
-- INERT TODAY, WHICH IS WHY IT IS BEING DONE TODAY. Verified in prod at the time
-- of writing: 0 rows carry any lock_request marker, 0 asks are in flight, 0 rows
-- carry a linked_vendor_profile_id, and NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED is
-- off. So there is nothing to migrate and nothing to strand — the only window in
-- which this change costs nothing.
--
-- THE ONLY DELTA vs 20271144258091 is inside the single flip UPDATE. Everything
-- else in this body is reproduced verbatim from that migration, deliberately:
-- retyping a 280-line SECURITY DEFINER function from memory is how a lock
-- handshake acquires a second, quieter bug.
--
-- ⚠ COVERED PACKAGE ROWS ARE DELIBERATELY NOT STAMPED. Nothing anywhere stamps
-- them — not this path, not the couple's own lock, not the chat lock. Matching
-- the anchor-only behaviour keeps the two booking paths identical. Whether a
-- covered line should carry the link is a real question and a SEPARATE change.

CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(
  p_event_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_agreed_at   TIMESTAMPTZ;
  v_event_id    UUID;
  v_group       TEXT;
  v_status      TEXT;
  v_mvid        UUID;
  v_slot        UUID;
  v_rows        INTEGER;
  v_msg         TEXT;
  v_date        DATE;
  v_prec        TEXT;
  v_event_ids   UUID[];
  v_capacity    INT;
  v_used        INT;
  v_competing   INT;
  v_pkg_id      UUID;
  v_covered     INT;
BEGIN
  -- ── OWNERSHIP ──────────────────────────────────────────────────────────────
  -- NARROWED from the shipped gate, deliberately. current_vendor_event_vendor_ids()
  -- has a second arm matching on event_vendors.service_id via
  -- agent_assigned_service_ids() — and service_id is a column the COUPLE can
  -- write (authenticated holds UPDATE on it; no constraint ties it to
  -- marketplace_vendor_id). That was harmless while this RPC wrote an inert
  -- marker nobody read. It is NOT harmless now that this RPC is the only thing
  -- that creates a booking.
  -- 🔑 RULE: when an RPC becomes the sole authority for a booking, its ownership
  -- predicate may not key on a column the counterparty controls.
  -- The agent arm is kept — staff seats legitimately answer for their org — but
  -- re-anchored so the service must belong to the org that was actually ASKED.
  IF NOT EXISTS (
    SELECT 1
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id
       AND (
         ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
         OR EXISTS (
           SELECT 1
             FROM public.vendor_services vs
            WHERE vs.vendor_service_id = ev.service_id
              AND vs.vendor_profile_id = ev.marketplace_vendor_id
              AND vs.vendor_service_id IN (SELECT public.agent_assigned_service_ids())
         )
       )
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_agreed_at,
         event_id, hard_single_group, status::TEXT, marketplace_vendor_id,
         service_time_slot_id, event_vendor_package_id
    INTO v_state, v_expires_at, v_agreed_at,
         v_event_id, v_group, v_status, v_mvid, v_slot, v_pkg_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  IF v_state IN ('declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  -- LAZY EXPIRY. Kept even though a sweep now exists: the sweep fires on request
  -- traffic, so a vendor can still open a lapsed request between two passes.
  -- Flipping (rather than merely refusing) releases both pending indexes so the
  -- couple can ask again.
  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'expired', 'expired_at', v_expires_at, 'event_id', v_event_id);
  END IF;

  -- ── A CONFIRMED RIVAL IN THE COUPLE'S OWN CATEGORY ─────────────────────────
  -- The couple booked someone else for this hard-single category while the ask
  -- was outstanding. Close the request rather than leaving it to rot in the
  -- pending index. 'cancelled' is the honest value — every path that can confirm
  -- a hard-single sibling is couple-initiated, so the couple did withdraw it, by
  -- booking elsewhere — but the ACTOR IS STAMPED so the record does not lose the
  -- fact that the vendor was here and answered.
  IF v_group IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_vendors ev
     WHERE ev.event_id = v_event_id
       AND ev.hard_single_group = v_group
       AND ev.vendor_id <> p_event_vendor_id
       AND ev.archived_at IS NULL
       AND ev.package_role IS DISTINCT FROM 'covered'
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  ) THEN
    UPDATE public.event_vendors
       SET lock_request_state        = 'cancelled',
           lock_request_cancelled_at = NOW(),
           lock_answered_by_user_id  = auth.uid(),
           updated_at                = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'group_taken', 'event_id', v_event_id);
  END IF;

  -- ── OWNER DECISION 3 · DECLINE THE OTHERS FIRST ───────────────────────────
  -- Service_Schedule_and_Quotation_Flow_2026-06-02.md §T1.4. A vendor may not
  -- take one couple while other couples are still waiting on them for the same
  -- date: they must answer the others first, so nobody loses silently.
  -- Capacity is the owner's documented default of 1 (daily_booking_capacity was
  -- never built — see the header). A vendor with no date on the event has no
  -- date to compete on, so the rule does not apply.
  SELECT e.event_date, e.event_date_precision
    INTO v_date, v_prec
    FROM public.events e
   WHERE e.event_id = v_event_id;

  IF v_mvid IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT count(*) INTO v_competing
      FROM public.event_vendors ev
      JOIN public.events e2 ON e2.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = v_mvid
       AND ev.lock_request_state = 'pending'
       AND ev.archived_at IS NULL
       AND ev.vendor_id <> p_event_vendor_id
       AND e2.event_date = v_date
       AND e2.event_date_precision = 'day';

    IF COALESCE(v_competing, 0) > 0 THEN
      RETURN jsonb_build_object(
        'status', 'resolve_others_first',
        'competing', v_competing,
        'event_date', v_date,
        'event_id', v_event_id);
    END IF;
  END IF;

  -- ── TIME-SLOT CAPACITY ────────────────────────────────────────────────────
  -- Capacity is consumed HERE, not at the couple's ask, because the ask no
  -- longer books anything. The predicate mirrors acquire_service_time_slot's
  -- occupancy count (read from the live function, not retyped from memory).
  IF v_slot IS NOT NULL AND v_date IS NOT NULL AND v_prec = 'day' THEN
    SELECT slot_capacity INTO v_capacity
      FROM public.vendor_service_time_slots
     WHERE slot_id = v_slot
       AND is_active
     FOR UPDATE;

    IF v_capacity IS NOT NULL THEN
      SELECT array_agg(event_id) INTO v_event_ids
        FROM public.events
       WHERE event_date = v_date
         AND event_date_precision = 'day';

      SELECT count(*) INTO v_used
        FROM public.event_vendors
       WHERE service_time_slot_id = v_slot
         AND status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND archived_at IS NULL
         AND event_id = ANY (v_event_ids)
         AND vendor_id <> p_event_vendor_id;

      IF v_used >= v_capacity THEN
        RETURN jsonb_build_object(
          'status', 'slot_full', 'event_id', v_event_id);
      END IF;
    END IF;
  END IF;

  -- ── THE FLIP ──────────────────────────────────────────────────────────────
  -- One statement. state='agreed' AND status='contracted' land together or not
  -- at all. The status half is MONOTONE (see the header): a row that is already
  -- further up the ladder keeps its status, so agreeing can never demote a paid
  -- booking or release the vendor's held date.
  BEGIN
    UPDATE public.event_vendors
       SET lock_request_state       = 'agreed',
           lock_agreed_at           = NOW(),
           lock_answered_by_user_id = auth.uid(),
           lock_declined_at         = NULL,
           lock_decline_reason      = NULL,
           -- ── THE STAMPS THIS FUNCTION HAS ALWAYS BEEN SAID TO WRITE ────────
           -- Added 2026-08-17. `vendors/actions.ts` has asserted since slice A
           -- that "the agree RPC stamps both alongside 'contracted', exactly as
           -- acquire_service_time_slot already does". Half of that was true:
           -- acquire_service_time_slot DOES stamp both (read out of prod, not
           -- retyped); this function stamped NEITHER.
           --
           -- 🔑 A SENTENCE IS NOT A MECHANISM. The comment was written on the
           -- couple's side, describing what a different object would do, and
           -- nothing ever checked. Read the function body, not the prose about
           -- it.
           --
           -- WHY IT MATTERS THE INSTANT THE FLAG GOES ON: this becomes the main
           -- booking path, and ~10 features key off linked_vendor_profile_id —
           -- the supplier doorway on /{slug}, editorial first-pick credit, Real
           -- Stories credit, Papic attribution, stage-note recipients, showcase
           -- credits, the verified median, fraud detection, the plausibility
           -- scanner, venue-room-size. Every handshake booking would have been
           -- a 'contracted' row with a NULL link, i.e. invisible to all of them.
           --
           -- SHAPE COPIED FROM acquire_service_time_slot, which is the only
           -- other RPC that books: rank 1, link taken from the row's OWN
           -- marketplace_vendor_id.
           --
           -- COALESCE is DEFENCE IN DEPTH, NOT A LIVE SAFEGUARD — and I only know
           -- that because writing the test disproved my own reasoning. I added it
           -- believing the `OR is_admin()` arm of the ownership gate could reach a
           -- row whose marketplace_vendor_id is NULL, where a bare assignment
           -- would blank an existing link. It cannot:
           --   event_vendors_lock_request_marketplace_chk
           --     CHECK (lock_request_state IS DISTINCT FROM 'pending'
           --            OR marketplace_vendor_id IS NOT NULL)
           -- and this UPDATE only ever matches lock_request_state='pending'. So
           -- the row it guards against cannot exist today. Kept because it costs
           -- nothing and the constraint is one migration away from being relaxed;
           -- the constraint itself is now pinned by a test, so whoever relaxes it
           -- is told.
           -- 🔑 VERIFY YOUR OWN CONCLUSIONS TOO. This comment was going to assert
           -- a live hazard that the schema already forbids.
           selection_match_rank     = 1,
           linked_vendor_profile_id =
             COALESCE(marketplace_vendor_id, linked_vendor_profile_id),
           status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at               = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    -- ⚠ TWO TRIGGERS RAISE check_violation ON THIS TABLE AND THE FLIP MAKES BOTH
    -- NEWLY REACHABLE — they used to fire on the couple's write, where
    -- finalizeVendor handled them. The shipped RPC had NO exception block at
    -- all, so a vendor pressing Agree would have met a raw Postgres string.
    -- Discriminate on the message; a blanket handler would tell a fully verified
    -- vendor to finish their verification, which is how a real defect gets
    -- triaged as a user error and never investigated.
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg LIKE 'vendor_not_verified%' THEN
        RETURN jsonb_build_object('status', 'not_verified', 'event_id', v_event_id);
      ELSIF v_msg LIKE 'free_tier_booking_cap%' THEN
        RETURN jsonb_build_object('status', 'fully_booked', 'event_id', v_event_id);
      END IF;
      RAISE;  -- anything else is a real defect and must fail loudly.
    WHEN unique_violation THEN
      -- Raced a rival into the confirmed hard-single index between the
      -- pre-check above and this statement. Defence in depth, not the design.
      RETURN jsonb_build_object('status', 'group_taken', 'event_id', v_event_id);
  END;

  IF v_rows = 0 THEN
    SELECT lock_request_state, lock_agreed_at INTO v_state, v_agreed_at
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state,
      'agreed_at', v_agreed_at, 'event_id', v_event_id);
  END IF;

  -- ── A PACKAGE IS ONE ANSWER, N ROWS (PR-H slice B) ──────────────────────
  -- The package lock path cascades one ANCHOR row plus a COVERED row per kept
  -- line, all pointing at one event_vendor_packages booking. Only the anchor
  -- carries the request — the pending index's own predicate says so
  -- (package_role IS DISTINCT FROM 'covered'), and a covered line is not a
  -- separate question anybody could answer.
  --
  -- 🔑 SO AGREEING TO THE ANCHOR MUST BOOK THE WHOLE PACKAGE. Without this the
  -- supplier's yes would confirm ONE line and leave every other line of the
  -- package they just agreed to sitting at 'considering' — a half-booked
  -- package, which is not a state the product has copy for, a price for, or a
  -- way out of.
  --
  -- Same MONOTONE shape as the anchor's own flip: a covered row already further
  -- up the ladder keeps its status, so this can never demote a paid line. The
  -- booking row moves 'considering' → 'locked' and takes its locked_at receipt
  -- at the moment the receipt becomes true, not seven days earlier.
  IF v_pkg_id IS NOT NULL THEN
    UPDATE public.event_vendors
       SET status = CASE
                      WHEN status IN ('contracted', 'deposit_paid',
                                      'delivered', 'complete')
                        THEN status
                      ELSE 'contracted'::public.vendor_status
                    END,
           updated_at = NOW()
     WHERE event_vendor_package_id = v_pkg_id
       AND package_role = 'covered'
       AND archived_at IS NULL;
    GET DIAGNOSTICS v_covered = ROW_COUNT;

    UPDATE public.event_vendor_packages
       SET status    = 'locked',
           locked_at = COALESCE(locked_at, NOW())
     WHERE booking_id = v_pkg_id
       AND status = 'considering';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'agreed_at', NOW(), 'event_id', v_event_id,
    'package_lines_booked', COALESCE(v_covered, 0));
END;
$$

