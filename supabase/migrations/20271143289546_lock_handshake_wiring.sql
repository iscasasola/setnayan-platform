-- lock_handshake_wiring
-- ============================================================================
-- PR-H SLICE A · WIRING THE STEP THAT ALREADY SHIPPED.
--
-- 20271107090000_vendor_agrees_to_lock.sql put the whole data layer in prod on
-- 2026-08-05 — nine lock_* columns, a five-value lock_request_state machine, a
-- forgery trigger covering INSERT and UPDATE, two indexes and three SECDEF RPCs
-- — and NOTHING HAS EVER CALLED IT. Verified 2026-08-15: a repo-wide grep finds
-- zero functional callers and lock_request_state is NULL on all 45 prod rows.
-- The SIXTH "gate with no handle". 🔑 A shipped table is not a shipped feature.
--
-- This migration does the four things that data layer deliberately left open,
-- and nothing else. Every function here is CREATE OR REPLACE over the shipped
-- body — grants and REVOKEs survive replacement, and the post-condition block
-- re-asserts them anyway.
--
-- ── 1 · THE AGREEMENT IS WHAT MAKES THE BOOKING ──────────────────────────────
-- None of the three shipped RPCs reads or writes event_vendors.status; the
-- migration's own comment reserves "whether step 1 keeps writing 'contracted'"
-- as an app-layer call. That left a fork with no middle: either the couple's
-- Lock keeps booking outright (the bug PR-H exists to kill) or a booking never
-- becomes real and all 20 CONFIRMED_VENDOR_STATUSES consumers (lib/events.ts)
-- answer "not booked" forever — including get_vendor_event_brief, which would
-- keep refusing the vendor even AFTER they agreed.
--
-- So vendor_agree_to_lock now flips status IN THE SAME UPDATE as state='agreed'.
--   · ATOMIC against event_vendors_hard_single_lock_uniq (which covers CONFIRMED
--     rows): an app-side second write could land 'agreed' and then fail the
--     status write on 23505, leaving a row that says the vendor agreed to a
--     booking that does not exist. One UPDATE cannot half-land.
--   · PRECEDENTED: vendor_claim_locked_qr is already a vendor-side SECDEF RPC
--     that writes status='deposit_paid' directly.
--   · MONOTONE, and that is not decoration. The flip carries a CASE so agreeing
--     can only ever move a row UP the ladder. (status ∈ confirmed, state =
--     'pending') is reachable — e.g. the printed Locked QR promotes a row to
--     deposit_paid without touching any lock_* column — and an unconditional
--     write would roll a PAID booking back to 'contracted', which fires the
--     shipped release trigger and hands the vendor's blocked date back to
--     everyone else. The couple's own lock write already carries exactly this
--     guard (`.not('status','in','("deposit_paid","delivered","complete")')`);
--     dropping it here would have been a regression against shipped code.
--
-- ── 2 · OWNER DECISION 3 (2026-06-02) — DECLINE THE OTHERS FIRST ─────────────
-- Service_Schedule_and_Quotation_Flow_2026-06-02.md, the owner's own strongest
-- rule: "a vendor cannot approve a lock while competing lock-requests are still
-- pending. They must explicitly decline the non-chosen requests first."
-- Verbatim reason: "a proper and respectful way to make sure no customer just
-- loses the lock with no reason" — a loss must always be a deliberate,
-- acknowledged decline, never a passive slot-fill.
--
-- 🔑 THIS IS VENDOR-SIDE COMPETITION (one supplier, several couples) and it is a
-- DIFFERENT AXIS from the hard-single group (one couple, several venues). A plan
-- can be complete on the second and totally silent on the first while looking
-- finished; that is exactly what happened, and the owner caught it in one line.
--
-- CAPACITY = 1, from the owner's own default ("vendor_profiles.
-- daily_booking_capacity (default 1)", §T1.2). That column was never built, so
-- there is no per-vendor number to read and none is invented here. When it
-- lands, this check reads it and the rule becomes "decline everyone beyond the N
-- you are taking". ⚠ max_soft_holds_per_date is NOT used: it has one reader and
-- ZERO writers app-wide (the seventh gate with no handle) — keying a refusal on
-- a number nobody can set would make this rule unexplainable to the vendor.
--
-- ── 3 · A NUDGE THAT CAN FIRE MORE THAN ONCE ────────────────────────────────
-- Owner 2026-08-04 §6.3 ordered a day-5 nudge; the shipped schema has no stamp
-- for it. lock_request_nudged_at is added here — and RESET inside the same
-- trigger branch that re-materializes the deadline, so a SECOND ask on the same
-- booking is nudgeable. Without the reset it is a per-row stamp checked with
-- IS NULL, so every re-ask after the first would be silently un-nudgeable and
-- the owner's instruction would hold for exactly one round per booking.
--
-- ── 4 · AN EXPIRY THAT CAN ACTUALLY FIRE ────────────────────────────────────
-- The shipped expiry is LAZY — only vendor_agree_to_lock / vendor_decline_lock
-- flip a lapsed row — and BOTH require the vendor to act, which is precisely the
-- thing expiry exists to handle when they do not. A vendor who ignores the ask
-- leaves the row 'pending' forever, holding the pending-unique index, with the
-- couple's Cancel as the only inverse. A forward primitive with no inverse.
-- Two bounded sweep RPCs land here; the cron-free driver calls nudge-then-expire.
-- Both carry a STATUS FLOOR so nothing already confirmed is ever nudged or
-- expired (the Locked-QR row above is exactly that case).
--
-- Idempotent + re-runnable throughout.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1 · The nudge stamp.
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS lock_request_nudged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.event_vendors.lock_request_nudged_at IS
  'Day-5 reminder stamp for a pending lock request (owner 2026-08-04 §6.3; echoes the 2026-06-02 lock "the vendor is nudged not to drag it"). Set ONLY by nudge_stale_lock_requests, which selects on lock_request_nudged_at IS NULL so it fires once per request round, never daily from day 5 to day 7. RESET TO NULL by event_vendors_guard_lock_handshake on every transition INTO pending, beside the lock_request_expires_at materialization — the two per-round stamps move together or a re-ask inherits a spent nudge and can never be reminded again. Trigger-guarded against authenticated/anon: a couple must not be able to stamp "already nudged" and mute their own supplier''s reminder.';

-- ----------------------------------------------------------------------------
-- 2 · ONE PENDING REQUEST PER HARD-SINGLE CATEGORY.
--
--     The shipped index (event_vendors_one_pending_lock_request_uniq) is keyed
--     on (event_id, marketplace_vendor_id) — it stops two pending asks to the
--     SAME vendor. It does NOT stop a couple opening pending requests to two
--     different VENUES, because those are different vendors. The 2026-06-02
--     lock says "one active lock request per category" (§T1.4a).
--
--     Disjoint from event_vendors_hard_single_lock_uniq by construction: that
--     one covers CONFIRMED rows, this one covers PENDING requests, and a row at
--     lock_request_state='pending' whose status is confirmed is excluded from
--     BOTH by the status term below — which is deliberate, because the Locked-QR
--     path can produce exactly that shape.
--
--     package_role IS DISTINCT FROM 'covered' and archived_at IS NULL are copied
--     from the shipped hard-single index: a package cascade writes N rows
--     sharing a category and only the ANCHOR carries the request.
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_one_pending_lock_request_per_group_uniq
  ON public.event_vendors (event_id, hard_single_group)
  WHERE lock_request_state = 'pending'
    AND hard_single_group IS NOT NULL
    AND archived_at IS NULL
    AND package_role IS DISTINCT FROM 'covered'
    AND status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete');

COMMENT ON INDEX public.event_vendors_one_pending_lock_request_per_group_uniq IS
  'ONE live lock REQUEST per hard-single category per event (venue / ceremony venue / officiant / coordinator / host-MC / LED) — the 2026-06-02 lock''s "one active lock request per category" (§T1.4a). Complements event_vendors_one_pending_lock_request_uniq, which is keyed on (event_id, marketplace_vendor_id) and therefore cannot see two pending asks to two DIFFERENT venues. Deliberately excludes rows already at a confirmed status so the Locked-QR shape (confirmed + a stale pending marker) collides with neither this index nor the confirmed one.';

-- ----------------------------------------------------------------------------
-- 3 · The guard trigger — three changes, one unchanged.
--
--     ADDED (a): lock_request_nudged_at joins the vendor-set column list, so a
--       couple cannot mute their supplier's reminder through the FOR ALL policy.
--     ADDED (b): the nudge stamp RESETS on every transition into pending,
--       beside the deadline it must stay in step with.
--     ADDED (c): a COHERENCE rule — authenticated/anon may not move status INTO
--       a confirmed value while OLD.lock_request_state = 'pending'.
--
--     ⚠ (c) IS A COHERENCE RULE, NOT A FORGERY GUARD, AND IT IS LABELLED THAT
--     WAY ON PURPOSE. It stops a row being self-booked while a genuine request
--     to that vendor is outstanding — a real state-machine invariant. It does
--     NOT stop forgery: the shipped trigger deliberately lets a couple write
--     lock_request_state='cancelled' ("a couple may open (pending) or withdraw
--     (cancelled) their own request"), so a two-step PATCH — cancel, then set
--     status='contracted' — walks straight past it. That bypass is asserted in
--     the db tests rather than hidden.
--     🔑 Calling this a forgery guard would be the decorative-guard failure this
--     codebase keeps recording. Forgery on event_vendors.status is OPEN and
--     stays open while the flag-OFF path needs the couple to write 'contracted'
--     directly; it closes when that path is retired at the flag flip, by making
--     the transition into a confirmed status RPC/service-role-only.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_event_vendor_lock_handshake()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- ⚠ INSERT IS GUARDED TOO, AND THAT IS THE WHOLE POINT.
  -- event_vendors_couple_write is FOR ALL with no column list, so a couple's own
  -- client could INSERT a row BORN 'agreed' and manufacture a vendor's consent.
  -- On INSERT there is no OLD row, so the test differs in shape but not intent:
  -- a NEW row may not arrive already carrying the vendor's answer.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.lock_agreed_at IS NOT NULL
         OR NEW.lock_declined_at IS NOT NULL
         OR NEW.lock_decline_reason IS NOT NULL
         OR NEW.lock_answered_by_user_id IS NOT NULL
         OR NEW.lock_request_nudged_at IS NOT NULL
         OR NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'a booking cannot be created already carrying the vendor''s lock answer'
          USING ERRCODE = '42501';
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.lock_agreed_at           IS DISTINCT FROM OLD.lock_agreed_at
         OR NEW.lock_declined_at      IS DISTINCT FROM OLD.lock_declined_at
         OR NEW.lock_decline_reason   IS DISTINCT FROM OLD.lock_decline_reason
         OR NEW.lock_answered_by_user_id
                                      IS DISTINCT FROM OLD.lock_answered_by_user_id
         OR NEW.lock_request_nudged_at
                                      IS DISTINCT FROM OLD.lock_request_nudged_at
      THEN
        RAISE EXCEPTION
          'the vendor''s lock answer is vendor-set only (via vendor_agree_to_lock / vendor_decline_lock)'
          USING ERRCODE = '42501';
      END IF;

      -- The state machine itself: a couple may open (pending) or withdraw
      -- (cancelled) their own request, but may not declare the vendor's verdict.
      IF NEW.lock_request_state IS DISTINCT FROM OLD.lock_request_state
         AND NEW.lock_request_state IN ('agreed', 'declined', 'expired')
      THEN
        RAISE EXCEPTION
          'lock_request_state ''%'' is set only by the vendor lock-handshake RPCs',
          NEW.lock_request_state
          USING ERRCODE = '42501';
      END IF;

      -- COHERENCE (see the header): no self-booking while a request is live.
      IF OLD.lock_request_state = 'pending'
         AND NEW.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
         AND OLD.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      THEN
        RAISE EXCEPTION
          'this booking has a live lock request — the vendor''s answer books it (vendor_agree_to_lock), or withdraw the request first'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Materialize the ~7-day deadline the moment a row becomes pending, so the TTL
  -- is stored ONCE here rather than hand-typed into every reader. Fires on INSERT
  -- too. Keyed on the TRANSITION (was not pending, is now) so a later touch of an
  -- already-pending row never silently extends the vendor's window — and so a
  -- SECOND ask does not inherit the dead deadline of the first.
  IF NEW.lock_request_state = 'pending'
     AND (TG_OP = 'INSERT' OR OLD.lock_request_state IS DISTINCT FROM 'pending')
  THEN
    NEW.lock_request_expires_at :=
      COALESCE(NEW.lock_requested_at, NOW()) + INTERVAL '7 days';
    -- ⚠ THE NUDGE STAMP RESETS HERE, BESIDE THE DEADLINE, ON PURPOSE.
    -- nudge_stale_lock_requests selects on IS NULL. Without this line the stamp
    -- survives the round that set it, and every re-ask on the same booking is
    -- permanently un-nudgeable — the owner's day-5 instruction would hold for
    -- exactly one round per booking and fail silently thereafter.
    NEW.lock_request_nudged_at := NULL;
  END IF;

  RETURN NEW;
END;
$guard$;

COMMENT ON FUNCTION public.guard_event_vendor_lock_handshake() IS
  'BEFORE INSERT OR UPDATE guard on event_vendors. (1) Rejects any authenticated/anon write to the VENDOR''s lock answer (lock_agreed_at, lock_declined_at, lock_decline_reason, lock_answered_by_user_id, lock_request_nudged_at) or any direct flip of lock_request_state to agreed/declined/expired. (2) COHERENCE, not forgery-proofing: refuses a move INTO a confirmed status while lock_request_state = ''pending'' — the vendor''s answer books it, or the couple withdraws first. This is NOT a forgery guard and must not be described as one: the shipped machine deliberately lets a couple write ''cancelled'', so cancel-then-book walks past it. Forgery on status stays OPEN until the flag-OFF lock path is retired and the transition into a confirmed status becomes RPC-only. (3) Materializes lock_request_expires_at AND resets lock_request_nudged_at on every transition into pending, so a second ask gets a fresh deadline and a fresh reminder.';

-- ----------------------------------------------------------------------------
-- 4 · vendor_agree_to_lock — the vendor says yes, and that is what books it.
-- ----------------------------------------------------------------------------

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
         service_time_slot_id
    INTO v_state, v_expires_at, v_agreed_at,
         v_event_id, v_group, v_status, v_mvid, v_slot
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

  RETURN jsonb_build_object(
    'status', 'ok', 'agreed_at', NOW(), 'event_id', v_event_id);
END;
$$;

COMMENT ON FUNCTION public.vendor_agree_to_lock(UUID) IS
  'PR-H step 2: the VENDOR agrees, AND THAT IS WHAT MAKES THE BOOKING — the same single UPDATE writes lock_request_state=''agreed'' and status=''contracted'', so the two can never disagree. The status half is MONOTONE (a CASE): agreeing can only move a row UP the ladder, never demote an already deposit_paid/delivered/complete booking, which would fire the release trigger and free the vendor''s held date. Refuses with ''resolve_others_first'' while other couples have pending requests on the same date (owner 2026-06-02 §T1.4 — no customer loses a lock silently; capacity is the owner''s documented default of 1 because daily_booking_capacity was never built). Consumes time-slot capacity here, since the couple''s ask no longer books anything. Ownership is NARROWER than the shipped gate: the agent arm is re-anchored so the service must belong to the org that was asked, because event_vendors.service_id is couple-writable and this RPC is now the sole authority for a booking. Money still moves at step 5 — this bills nothing and reserves no schedule pool.';

-- ----------------------------------------------------------------------------
-- 5 · decline + cancel — unchanged except that the envelope now carries the
--     event_id READ OFF THE AUTHORIZED ROW.
--
--     Why that matters: the vendor's server action needs an event id to notify
--     the couple and to revalidate, and the only other source is the FormData
--     the VENDOR submitted. The shipped vendorAcknowledgeDeposit takes exactly
--     that path and aims an admin-client schedule write at a vendor-supplied
--     event id. Returning the authorized value removes the temptation.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_decline_lock(
  p_event_vendor_id UUID,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state       TEXT;
  v_expires_at  TIMESTAMPTZ;
  v_declined_at TIMESTAMPTZ;
  v_reason      TEXT;
  v_event_id    UUID;
  v_rows        INTEGER;
BEGIN
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

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NOT NULL THEN
    v_reason := left(v_reason, 240);
  END IF;

  SELECT lock_request_state, lock_request_expires_at, lock_declined_at, event_id
    INTO v_state, v_expires_at, v_declined_at, v_event_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'declined' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'declined_at', v_declined_at, 'event_id', v_event_id);
  END IF;

  -- An agreement already given is final on this rung. Under this migration that
  -- reasoning is STRONGER, not weaker, than when it shipped: agreeing now
  -- creates a real booking, so walking it back is cancelling a live booking —
  -- the couple's revert path, deliberately not the vendor's.
  IF v_state = 'agreed' THEN
    RETURN jsonb_build_object('status', 'already_agreed', 'event_id', v_event_id);
  END IF;

  IF v_state IN ('cancelled', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    UPDATE public.event_vendors
       SET lock_request_state = 'expired',
           updated_at         = NOW()
     WHERE vendor_id = p_event_vendor_id
       AND lock_request_state = 'pending';
    RETURN jsonb_build_object(
      'status', 'expired', 'expired_at', v_expires_at, 'event_id', v_event_id);
  END IF;

  UPDATE public.event_vendors
     SET lock_request_state       = 'declined',
         lock_declined_at         = NOW(),
         lock_decline_reason      = v_reason,
         lock_answered_by_user_id = auth.uid(),
         updated_at               = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND lock_request_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('status', 'already', 'event_id', v_event_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'declined_at', NOW(), 'event_id', v_event_id);
END;
$$;

COMMENT ON FUNCTION public.vendor_decline_lock(UUID, TEXT) IS
  'PR-H step 2 (the no): the VENDOR declines, with an optional reason that IS PERSISTED to lock_decline_reason — unlike reject_vendor_deposit''s p_reason, which is accepted and never stored. A refusal that cannot be re-read six months later is not a record. Declining is also how a vendor clears the ''resolve_others_first'' refusal on vendor_agree_to_lock: the 2026-06-02 lock requires the non-chosen couples to be told no explicitly, never dropped silently. The envelope carries event_id read off the authorized row so a caller never has to trust a vendor-supplied one. Ownership gate narrowed to match vendor_agree_to_lock.';

CREATE OR REPLACE FUNCTION public.cancel_vendor_lock_request(
  p_event_vendor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state        TEXT;
  v_cancelled_at TIMESTAMPTZ;
  v_event_id     UUID;
  v_rows         INTEGER;
BEGIN
  -- Couple-only, deliberately NOT couple-or-coordinator: 20271016300000 narrowed
  -- six host policies for exactly this reason — a coordinator must not be able
  -- to answer, or erase, their own request.
  IF NOT EXISTS (
       SELECT 1
         FROM public.event_vendors ev
        WHERE ev.vendor_id = p_event_vendor_id
          AND ev.event_id IN (SELECT public.current_couple_event_ids())
     )
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  SELECT lock_request_state, lock_request_cancelled_at, event_id
    INTO v_state, v_cancelled_at, v_event_id
    FROM public.event_vendors
   WHERE vendor_id = p_event_vendor_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_state IS NULL THEN
    RETURN jsonb_build_object('status', 'not_requested', 'event_id', v_event_id);
  END IF;

  IF v_state = 'cancelled' THEN
    RETURN jsonb_build_object(
      'status', 'already', 'cancelled_at', v_cancelled_at, 'event_id', v_event_id);
  END IF;

  IF v_state IN ('agreed', 'declined', 'expired') THEN
    RETURN jsonb_build_object(
      'status', 'not_pending', 'current', v_state, 'event_id', v_event_id);
  END IF;

  UPDATE public.event_vendors
     SET lock_request_state        = 'cancelled',
         lock_request_cancelled_at = NOW(),
         updated_at                = NOW()
   WHERE vendor_id = p_event_vendor_id
     AND lock_request_state = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    SELECT lock_request_state INTO v_state
      FROM public.event_vendors WHERE vendor_id = p_event_vendor_id;
    RETURN jsonb_build_object(
      'status', 'already', 'current', v_state, 'event_id', v_event_id);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok', 'cancelled_at', NOW(), 'event_id', v_event_id);
END;
$$;

COMMENT ON FUNCTION public.cancel_vendor_lock_request(UUID) IS
  'PR-H Undo: the COUPLE withdraws their own still-pending lock request. This is the inverse that makes a pending request safe to create — the 2026-06-02 lock''s "a pending lock is non-binding, the customer can withdraw anytime and pursue another vendor". Gated to current_couple_event_ids() or admin, deliberately NOT couple-or-coordinator. Once the vendor has answered this refuses; unwinding a live booking is the separate revert path. Envelope carries event_id read off the authorized row.';

-- ----------------------------------------------------------------------------
-- 6 · The sweep — nudge at day 5, expire at day 7. Service-role only.
--
--     Both are BOUNDED (p_limit) and use FOR UPDATE SKIP LOCKED so one wedged
--     row cannot block the batch, and both carry a STATUS FLOOR: a row that is
--     already confirmed is never nudged and never expired. That floor is not
--     hypothetical — vendor_claim_locked_qr promotes a row to deposit_paid
--     without touching any lock_* column, so a printed-QR booking can carry a
--     stale 'pending' marker forever. Without the floor the sweep would nudge a
--     vendor about a booking they have already been paid for, then "expire" it.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nudge_stale_lock_requests(
  p_days  INT DEFAULT 5,
  p_limit INT DEFAULT 200
)
RETURNS TABLE (event_vendor_id UUID, event_id UUID, marketplace_vendor_id UUID,
               requested_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT ev.vendor_id
      FROM public.event_vendors ev
     WHERE ev.lock_request_state = 'pending'
       AND ev.lock_request_nudged_at IS NULL
       AND ev.archived_at IS NULL
       AND ev.lock_requested_at IS NOT NULL
       AND ev.lock_requested_at <= NOW() - make_interval(days => p_days)
       AND (ev.lock_request_expires_at IS NULL OR ev.lock_request_expires_at > NOW())
       AND ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     ORDER BY ev.lock_requested_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_vendors t
     SET lock_request_nudged_at = NOW(),
         updated_at             = NOW()
    FROM due
   WHERE t.vendor_id = due.vendor_id
  RETURNING t.vendor_id, t.event_id, t.marketplace_vendor_id,
            t.lock_requested_at, t.lock_request_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.nudge_stale_lock_requests(INT, INT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.nudge_stale_lock_requests(INT, INT) IS
  'Day-5 reminder pass (owner 2026-08-04 §6.3). Stamps lock_request_nudged_at on live requests older than p_days and RETURNS them so the caller can notify the vendor. Fires ONCE per request round — the IS NULL predicate plus the trigger''s reset-on-re-entry are what make that true in both directions. Carries a status floor so a confirmed booking carrying a stale pending marker (the Locked-QR shape) is never nudged. service_role only.';

CREATE OR REPLACE FUNCTION public.expire_stale_lock_requests(
  p_limit INT DEFAULT 200
)
RETURNS TABLE (event_vendor_id UUID, event_id UUID, marketplace_vendor_id UUID,
               requested_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT ev.vendor_id
      FROM public.event_vendors ev
     WHERE ev.lock_request_state = 'pending'
       AND ev.lock_request_expires_at IS NOT NULL
       AND ev.lock_request_expires_at <= NOW()
       AND ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     ORDER BY ev.lock_request_expires_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.event_vendors t
     SET lock_request_state = 'expired',
         updated_at         = NOW()
    FROM due
   WHERE t.vendor_id = due.vendor_id
  RETURNING t.vendor_id, t.event_id, t.marketplace_vendor_id,
            t.lock_requested_at, t.lock_request_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_lock_requests(INT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.expire_stale_lock_requests(INT) IS
  'The 7-day fuse, as a WRITE. The shipped expiry was lazy-only — flipped by vendor_agree_to_lock / vendor_decline_lock — and BOTH of those need the vendor to act, which is exactly what expiry exists to handle when they do not: a vendor who simply ignores the ask left the row pending forever, holding both pending indexes. Reads the MATERIALIZED lock_request_expires_at rather than recomputing a window, so the deadline the vendor was shown is the deadline enforced. Status floor as above. Must run AFTER nudge_stale_lock_requests in the same pass, or a request that crossed both thresholds between two sweeps is closed having never warned the vendor. service_role only.';

-- ----------------------------------------------------------------------------
-- 7 · Correct the shipped COMMENTs that this migration falsifies.
--
--     CREATE OR REPLACE FUNCTION does not touch an existing comment, and applied
--     migrations are never edited — so without this block the live database
--     would keep describing agreeing as something that "moves no money and no
--     status" and expiry as having "NO SWEEPER". A stale comment on a live object
--     is the thing a future reader queries.
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.event_vendors.lock_request_state IS
  'PR-H step 2 of the lock handshake (owner ruling 2026-07-27): NULL = the couple never asked; pending = asked, awaiting the vendor; agreed = the vendor said yes (vendor_agree_to_lock) AND the booking became real in the same statement; declined = the vendor said no (vendor_decline_lock); cancelled = the couple withdrew (cancel_vendor_lock_request), or a rival was already confirmed in the same hard-single category; expired = the ~7-day window lapsed, flipped by expire_stale_lock_requests and also lazily on the answer path. ⚠ NO LONGER ORTHOGONAL TO status: since 20271143289546 the agree transition writes both in one UPDATE, so ''agreed'' and a confirmed status are set together. The status half is monotone — agreeing never demotes a row that is already further up the ladder.';

COMMENT ON COLUMN public.event_vendors.lock_request_expires_at IS
  'MATERIALIZED ~7-day deadline, stamped by event_vendors_guard_lock_handshake on every transition INTO pending (so a re-ask gets a fresh window and never inherits a dead one). Materialized rather than derived because a partial-index predicate must be IMMUTABLE — now() cannot appear in one — and because the deadline shown to the vendor must be the deadline enforced. ⚠ A SWEEPER NOW EXISTS: expire_stale_lock_requests, driven cron-free from request traffic, after nudge_stale_lock_requests in the same pass. The lazy flip inside the answer RPCs is kept as the between-passes fallback, not as the mechanism.';

COMMENT ON COLUMN public.event_vendors.lock_agreed_at IS
  'Set by the VENDOR via vendor_agree_to_lock() — "yes, book me" — in the SAME UPDATE that writes status=''contracted''. Agreeing is what makes the booking (owner 2026-07-27); it is no longer a signal that moves no status. It still moves NO MONEY: the syncing fee and the schedule reservation stay at step 5 (vendor accepts payment). DEFINER-only: the guard trigger rejects any authenticated/anon write, or a couple could forge their own vendor''s agreement through the column-unrestricted FOR ALL couple-write policy.';

-- ----------------------------------------------------------------------------
-- 8 · Post-conditions.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  fn     TEXT;
  leaked TEXT;
  txt    TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND column_name = 'lock_request_nudged_at'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: lock_request_nudged_at was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'event_vendors_one_pending_lock_request_per_group_uniq'
       AND i.indisunique AND i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: the per-group pending index is missing, not unique, or not partial';
  END IF;

  -- The shipped index must SURVIVE — the two answer different questions.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'event_vendors_one_pending_lock_request_uniq'
  ) THEN
    RAISE EXCEPTION
      'post-condition failed: the shipped per-(event,vendor) pending index is gone';
  END IF;

  -- Both triggers still attached.
  FOREACH fn IN ARRAY ARRAY['event_vendors_guard_lock_handshake',
                            'event_vendors_guard_deposit_ack'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'event_vendors' AND t.tgname = fn AND NOT t.tgisinternal
    ) THEN
      RAISE EXCEPTION 'post-condition failed: trigger % is missing', fn;
    END IF;
  END LOOP;

  -- The status ladder was NOT widened.
  IF (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'vendor_status') <> 6 THEN
    RAISE EXCEPTION
      'post-condition failed: vendor_status no longer has exactly 6 labels';
  END IF;

  -- Every function still SECDEF with a pinned search_path.
  FOREACH fn IN ARRAY ARRAY['vendor_agree_to_lock', 'vendor_decline_lock',
                            'cancel_vendor_lock_request',
                            'nudge_stale_lock_requests', 'expire_stale_lock_requests'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = fn AND p.prosecdef
         AND EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
                      WHERE cfg = 'search_path=public')
    ) THEN
      RAISE EXCEPTION
        'post-condition failed: public.%() is missing, not SECURITY DEFINER, or does not pin search_path', fn;
    END IF;
  END LOOP;

  -- Nothing leaked to anon/PUBLIC.
  SELECT string_agg(p.proname, ', ') INTO leaked
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('vendor_agree_to_lock', 'vendor_decline_lock',
                       'cancel_vendor_lock_request', 'nudge_stale_lock_requests',
                       'expire_stale_lock_requests')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('public', p.oid, 'EXECUTE'));
  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'post-condition failed: anon/PUBLIC hold EXECUTE on: %', leaked;
  END IF;

  -- The three user RPCs stay callable (a REVOKE that over-reached ships a dead
  -- feature, silently) and the two sweeps stay OUT of reach.
  FOREACH fn IN ARRAY ARRAY['vendor_agree_to_lock', 'vendor_decline_lock',
                            'cancel_vendor_lock_request'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = fn
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION 'post-condition failed: authenticated cannot EXECUTE public.%()', fn;
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY ARRAY['nudge_stale_lock_requests', 'expire_stale_lock_requests'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = fn
         AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION
        'post-condition failed: authenticated can EXECUTE public.%() — the sweep is service-role only', fn;
    END IF;
  END LOOP;

  -- ⚠ THE COMMENTS THIS MIGRATION FALSIFIED MUST BE GONE. A future
  -- CREATE OR REPLACE that drops them fails here rather than leaving the live
  -- database describing the opposite of what it does.
  SELECT col_description('public.event_vendors'::regclass,
           (SELECT attnum FROM pg_attribute
             WHERE attrelid = 'public.event_vendors'::regclass
               AND attname = 'lock_request_expires_at')) INTO txt;
  IF txt IS NULL OR txt LIKE '%NO SWEEPER EXISTS%' THEN
    RAISE EXCEPTION
      'post-condition failed: lock_request_expires_at still claims no sweeper exists';
  END IF;

  SELECT obj_description('public.vendor_agree_to_lock(UUID)'::regprocedure) INTO txt;
  IF txt IS NULL OR txt LIKE '%moves no money and no status%' THEN
    RAISE EXCEPTION
      'post-condition failed: vendor_agree_to_lock still claims it moves no status';
  END IF;
END;
$$;

COMMIT;
