-- ============================================================================
-- a_free_shop_holds_any_number_of_bookings — the free-tier 3-concurrent-booking
-- cap is REMOVED, for every tier.
--
-- ⚖ OWNER 2026-10-28 (DECISION_LOG, money rule), verbatim: "Remove the limit."
-- Asked because the cap contradicted his 2026-10-23 ruling — free gets every
-- work tool; paid is reach · scale · time. A booking is what earns Setnayan the
-- booking fee, so no plan may ration it.
--
-- WHAT THE CAP WAS (20271001120000, rewritten 20271009160000):
--   • trigger `enforce_free_tier_booking_cap_trg` — BEFORE INSERT OR UPDATE on
--     public.event_vendors, calling `enforce_free_tier_booking_cap()`;
--   • which refused (check_violation, message 'free_tier_booking_cap: …') a
--     free/verified shop's NEW move into contracted · deposit_paid · delivered
--     when it already held 3 other such events;
--   • gated on `platform_settings.free_tier_booking_cap_enabled`, DEFAULT FALSE.
--     No migration and no app code ever wrote TRUE (gates-have-handles listed it
--     as "parked on purpose"); the last production reading on record
--     (DECISION_LOG 2026-09-15) was FALSE. So the cap was INERT — this removes a
--     loaded switch, not a live refusal.
--   • `vendor_agree_to_lock` translated that message into status 'fully_booked'
--     (20271143289546 → 20271223386305), which lib/lock-answer-notice.ts worded
--     as "as many live bookings at once as a free shop can … move to a paid plan".
--
-- WHAT THIS DROPS: the trigger, the function, the switch column, and the
-- 'fully_booked' branch of `vendor_agree_to_lock` (nothing can raise it now).
-- Plain DROPs, no CASCADE: if anything unexpected depends on the function or the
-- column, this fails loudly instead of taking it along.
--
-- ⚠ WHAT THIS DOES NOT TOUCH — every other limit is a different rule:
--   • the shop's own hold limit per date (`max_soft_holds_per_date`, the
--     couple's `soft_hold_limit_reached`, `vendor_soft_holds_on`) — the shop sets
--     it, every plan the same;
--   • a card's "Bookings per day" (`daily_capacity`, `daily_limit_reached`) and
--     time-slot capacity (`slot_full`) — the shop's own capacity;
--   • `enforce_vendor_whitelist_per_date` / `vendor_tier_limit` and every reach
--     / scale cap (service area, categories, seats, branches).
--
-- `vendor_agree_to_lock` below is the body of 20271223386305 (the latest
-- definition, which production replays to) with exactly two lines removed —
--     ELSIF v_msg LIKE 'free_tier_booking_cap%' THEN
--       RETURN jsonb_build_object('status', 'fully_booked', …);
-- — and the comment above the handler re-worded. No other line changes.
-- CREATE OR REPLACE keeps its grants (authenticated + service_role, not anon);
-- asserted below.
--
-- Guards: apps/web/tests/db/a-free-shop-holds-any-number-of-bookings.db.test.ts
-- · apps/web/tests/db/every-lock-answer-has-a-sentence.db.test.ts
-- Idempotent: DROP … IF EXISTS · CREATE OR REPLACE.
-- ============================================================================

BEGIN;

-- ── 1 · the cap itself ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS enforce_free_tier_booking_cap_trg ON public.event_vendors;
DROP FUNCTION IF EXISTS public.enforce_free_tier_booking_cap();

-- ── 2 · the switch that would have turned it on ─────────────────────────────
ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS free_tier_booking_cap_enabled;

-- ── 3 · the supplier's yes — no 'fully_booked' answer any more ──────────────
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
    -- ⚠ THE VERIFIED-SHOP TRIGGER RAISES check_violation ON THIS TABLE AND THE
    -- FLIP MAKES IT NEWLY REACHABLE — it used to fire on the couple's write,
    -- where finalizeVendor handled it. (A second one, the free-tier booking cap,
    -- was dropped 2026-10-28 — owner: "Remove the limit." — and its
    -- "fully booked" answer went with it.) The shipped RPC had NO exception block at
    -- all, so a vendor pressing Agree would have met a raw Postgres string.
    -- Discriminate on the message; a blanket handler would tell a fully verified
    -- vendor to finish their verification, which is how a real defect gets
    -- triaged as a user error and never investigated.
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF v_msg LIKE 'vendor_not_verified%' THEN
        RETURN jsonb_build_object('status', 'not_verified', 'event_id', v_event_id);
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
  IF EXISTS (SELECT 1 FROM pg_trigger
              WHERE tgrelid = 'public.event_vendors'::regclass
                AND tgname = 'enforce_free_tier_booking_cap_trg') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: the free-tier booking cap trigger is still on event_vendors';
  END IF;
  IF to_regprocedure('public.enforce_free_tier_booking_cap()') IS NOT NULL THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: enforce_free_tier_booking_cap() still exists';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'platform_settings'
                AND column_name = 'free_tier_booking_cap_enabled') THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: platform_settings.free_tier_booking_cap_enabled still exists';
  END IF;

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
  IF position('fully_booked' IN def) > 0 OR position('free_tier_booking_cap%' IN def) > 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: vendor_agree_to_lock still answers fully_booked';
  END IF;
  IF position('''status'', ''not_verified''' IN def) = 0
     OR position('''status'', ''slot_full''' IN def) = 0
     OR position('''status'', ''resolve_others_first''' IN def) = 0
     OR position('public.service_card_bookings_on(v_service, v_date, p_event_vendor_id) >= v_daily_cap' IN def) = 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: an existing refusal of vendor_agree_to_lock went missing';
  END IF;
END $$;

COMMIT;
