-- ============================================================================
-- the_suppliers_yes_and_the_hold_limit_really_refuse — LOCK-PATH 2 (register).
--
-- Two gaps LOCK-PATH CAPACITY (20271222330608, PR #5441) found and left:
--
-- ── 1 · THE SUPPLIER'S YES IGNORED THE CARD'S DAILY LIMIT ──────────────────
-- With the lock handshake on, a couple's Lock is an ASK and the supplier's
-- `vendor_agree_to_lock` is what BOOKS. The ask is checked against the card's
-- "Bookings per day" (`vendor_services.daily_capacity`, vendors/actions.ts #2);
-- the yes checked time slots and nothing else. Anything that grew the card's
-- count between the ask and the yes — a Locked-QR claim, a booking made while
-- the handshake was off, a limit the supplier lowered — let a yes book past the
-- limit. (Two asks on one date cannot both be agreed: `resolve_others_first`
-- already makes the supplier answer the others first. The gap is the count
-- growing by any OTHER door.)
-- ⇒ The yes now refuses with `daily_limit_reached` using the SAME count the ask
--    and the bench search use, `service_card_bookings_on` — never a second one.
--
-- ⚖ THE BODY IS PRODUCTION'S, BYTE FOR BYTE, PLUS ADDED LINES ONLY. It is the
-- live `pg_get_functiondef` (read-only, 2026-09-11: 325 lines, line-hash equal
-- to the replay of 20271144481150), with two DECLAREd variables and one block
-- inserted between the TIME-SLOT CAPACITY check and THE FLIP. No existing line
-- is changed or removed. CREATE OR REPLACE keeps the grants exactly as they are
-- (postgres · service_role · authenticated; not anon, not PUBLIC) — asserted
-- below.
--
-- ── 2 · THE SHOP'S HOLD LIMIT PER DATE COUNTED THROUGH THE COUPLE'S EYES ────
-- Rule 3 of the lock/delete/overlap architecture (owner Q2, 2026-05-24: "Vendor
-- sets a hold limit · e.g., max 3 per date"): a couple's Lock is refused with
-- `soft_hold_limit_reached` once the shop already has `max_soft_holds_per_date`
-- couples holding that date at status `contracted` (agreed, not yet paid). The
-- column has no writer, so every shop sits on its DEFAULT 3 (2026-08-17 row).
-- The gate counted those holds by reading `events` + `event_vendors` through the
-- COUPLE'S session — RLS shows a couple only their own events — so it always
-- counted 0 and never refused. It also ignored `event_date_precision`, so a
-- month-only event stored as the 1st was a hold ON the 1st.
-- ⇒ `vendor_soft_holds_on(shop, day, exclude_event)` — SECURITY DEFINER,
--    read-only, service_role only — answers ONE number: the OTHER couples (one
--    per event, however many of the shop's services they booked) holding that
--    shop at `contracted`, not archived, on a DAY-PRECISE event that day. The
--    gate calls it with the admin client, scoped by the shop on the couple's own
--    booking row and the date on the couple's own event, only when that event
--    is day-precise. Status set and limit are the gate's own (`contracted`;
--    `max_soft_holds_per_date`) — unchanged.
-- ⚠ NOT the per-PLAN "customers per date" ceiling (Free 1 · Verified 2 · Solo 3
--    · Pro 5 · Enterprise 10): that one is `enforce_vendor_whitelist_per_date`,
--    a SECURITY DEFINER trigger on the supplier's own accept, which already sees
--    every couple (measured as a real `authenticated` supplier in
--    apps/web/tests/db/the-suppliers-yes-and-the-hold-limit-really-refuse.db.test.ts).
--
-- Production when written (read-only, 2026-09-11): 0 cards with a daily limit,
-- 0 pending asks, 1 `contracted` booking (on a year-precision event), every shop
-- on the default hold limit 3 — nothing accepted yesterday is refused today.
--
-- Guards: apps/web/tests/db/the-suppliers-yes-and-the-hold-limit-really-refuse.db.test.ts
-- · apps/web/tests/db/every-lock-answer-has-a-sentence.db.test.ts
-- · apps/web/lib/h6-mirrors-the-booking-path.test.ts
-- ============================================================================

BEGIN;

-- ── 2 · the hold count ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_soft_holds_on(
  p_vendor_profile_id uuid,
  p_day               date,
  p_exclude_event_id  uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(DISTINCT ev.event_id)::integer
    FROM public.event_vendors ev
    JOIN public.events e ON e.event_id = ev.event_id
   WHERE ev.marketplace_vendor_id = p_vendor_profile_id
     AND ev.status = 'contracted'
     AND ev.archived_at IS NULL
     AND e.event_date = p_day
     AND e.event_date_precision = 'day'
     AND (p_exclude_event_id IS NULL OR ev.event_id <> p_exclude_event_id);
$function$;

COMMENT ON FUNCTION public.vendor_soft_holds_on(uuid, date, uuid) IS
  'Read-only: how many OTHER couples (one per event) hold this shop at status '
  'contracted (agreed, not yet paid), not archived, on a DAY-PRECISE event that '
  'day, optionally excluding the asking couple''s own event. The one count behind '
  'the shop''s hold limit per date (max_soft_holds_per_date · Rule 3, owner '
  '2026-05-24) — the lock''s soft-hold gate in vendors/actions.ts. Server-only '
  '(service_role): it answers about any shop. NOT the per-plan customers-per-date '
  'ceiling (enforce_vendor_whitelist_per_date). LOCK-PATH 2, 20271223386305.';

-- Server-only. Name every role: Supabase's default privileges give anon and
-- authenticated their own EXECUTE entries, which REVOKE ... FROM PUBLIC misses.
REVOKE ALL ON FUNCTION public.vendor_soft_holds_on(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_soft_holds_on(uuid, date, uuid) TO service_role;

-- ── 1 · the supplier's yes — production's live body + the daily-limit block ──
CREATE OR REPLACE FUNCTION public.vendor_agree_to_lock(p_event_vendor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_service     UUID;
  v_daily_cap   INT;
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

  -- ── PER-CARD DAILY LIMIT (LOCK-PATH 2 · 20271223386305) ────────────────────
  -- The couple's ASK is checked against the card's "Bookings per day"
  -- (vendors/actions.ts #2), but it is THIS yes that books — and it did not
  -- check the limit at all. Whatever grew the count between the ask and the
  -- yes (a Locked-QR claim, a booking made while the handshake was off, a limit
  -- the supplier lowered) let the yes go past it.
  -- Same rule as the ask and the bench search, and the SAME count — never a
  -- second one: a card with NO active time slot (a slotted card is judged by
  -- its slot, above), a daily_capacity above zero, a day-precise date, and
  -- service_card_bookings_on (booked statuses, not archived, day-precise
  -- events). A row that is already booked is not a new booking, so its yes is
  -- never refused here. The card row is locked first, so two yeses on one card
  -- cannot both read the last free place (NO KEY: bookings that merely
  -- reference the card are not blocked).
  IF v_date IS NOT NULL AND v_prec = 'day'
     AND v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    SELECT ev.service_id INTO v_service
      FROM public.event_vendors ev
     WHERE ev.vendor_id = p_event_vendor_id;

    IF v_service IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_service_time_slots t
       WHERE t.vendor_service_id = v_service
         AND t.is_active
    ) THEN
      SELECT vs.daily_capacity INTO v_daily_cap
        FROM public.vendor_services vs
       WHERE vs.vendor_service_id = v_service
       FOR NO KEY UPDATE;

      IF v_daily_cap IS NOT NULL AND v_daily_cap > 0
         AND public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap THEN
        RETURN jsonb_build_object(
          'status', 'daily_limit_reached', 'daily_limit', v_daily_cap, 'event_id', v_event_id);
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
$function$;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  f   RECORD;
  def TEXT;
BEGIN
  -- the new count: definer, read-only, pinned, server-only
  SELECT p.oid, p.prosecdef, p.provolatile, p.proconfig INTO f
    FROM pg_proc p
   WHERE p.oid = 'public.vendor_soft_holds_on(uuid, date, uuid)'::regprocedure;
  IF NOT f.prosecdef THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_soft_holds_on is not SECURITY DEFINER — under the couple it would count 0 again';
  END IF;
  IF f.provolatile <> 's' THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_soft_holds_on is not STABLE — it must never write';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(coalesce(f.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_soft_holds_on has no pinned search_path';
  END IF;
  IF has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_soft_holds_on is callable from a browser';
  END IF;
  IF NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the server cannot call vendor_soft_holds_on';
  END IF;
  IF position('event_date_precision = ''day''' IN pg_get_functiondef(f.oid)) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the hold count is not day-precision-only';
  END IF;

  -- the supplier's yes: still definer + pinned, grants unchanged, asks the ONE count
  SELECT p.oid, p.prosecdef, p.proconfig INTO f
    FROM pg_proc p
   WHERE p.oid = 'public.vendor_agree_to_lock(uuid)'::regprocedure;
  def := pg_get_functiondef(f.oid);
  IF NOT f.prosecdef THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_agree_to_lock is no longer SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(coalesce(f.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_agree_to_lock lost its pinned search_path';
  END IF;
  IF NOT has_function_privilege('authenticated', f.oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', f.oid, 'EXECUTE')
     OR has_function_privilege('anon', f.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_agree_to_lock grants moved (want authenticated + service_role, not anon)';
  END IF;
  IF position('public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap' IN def) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the supplier''s yes does not ask the daily-limit count';
  END IF;
  IF position('''status'', ''slot_full''' IN def) = 0 OR position('''status'', ''resolve_others_first''' IN def) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: an existing refusal of vendor_agree_to_lock went missing';
  END IF;
END $$;

COMMIT;
