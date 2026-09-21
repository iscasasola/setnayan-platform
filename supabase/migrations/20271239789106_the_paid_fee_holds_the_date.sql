-- the_paid_fee_holds_the_date — CTRL-B2 build 7.
--
-- ── THE OWNER'S RULING, 2026-09-18 ──────────────────────────────────────────
-- A lock on the supplier's schedule happens *upon the vendor paying their
-- booking fee.* Today a supplier completes the whole handshake, the couple's
-- deposit is acknowledged, the supplier pays Setnayan to hold the date — and
-- every other couple searching that date is still told he is free, as is his
-- own calendar. `vendor_calendar_blocks` is 0 rows in production.
--
-- ── WHAT WAS ACTUALLY STOPPING IT — re-measured 2026-09-22 ─────────────────
-- 🛑 The CTRL-B2 brief blames `event_vendor_autoblock_on_booking`'s
-- `deposit_paid` condition. That is NOT what the live rows fail on. The trigger
-- has THREE guards, in order:
--     1. marketplace_vendor_id IS NULL        → return
--     2. status <> 'deposit_paid'             → return
--     3. on UPDATE, OLD.status = 'deposit_paid' → return
-- Production has 3 rows at `deposit_paid`, and ALL THREE carry
-- `marketplace_vendor_id IS NULL` — manual, host-added suppliers with no shop
-- and no calendar. They fail guard 1, entirely correctly. The two marketplace
-- bookings that matter sit at `contracted` and fail guard 2.
--
-- 🔑 So the trigger's happy path has NEVER ONCE RUN in production. No row has
-- ever satisfied guards 1 and 2 together.
--
-- ── WHY THIS DOES NOT RE-POINT THAT TRIGGER ────────────────────────────────
-- Its `deposit_paid` condition is a deliberate split, not an oversight:
-- `recordDeposit`'s docblock says the HOST advances that status separately,
-- when they are ready. Re-pointing the trigger at a different status would move
-- a status the host owns, as a side effect of a fee payment. This is ADDITIVE
-- instead: a second, independent reason for a date to be held, which leaves the
-- trigger and the host's status exactly as they are.
--
-- ── BOTH ENDS, OR NEITHER ──────────────────────────────────────────────────
-- ⚠ A new reason to CLOSE a date is a defect on its own unless the release side
-- learns it too. `vendor_unblock_booked_date` refuses to reopen a day another
-- live booking holds — and "live" was `deposit_paid/delivered/complete` only.
-- Adding a blocking reason without widening that check means releasing booking A
-- reopens a date booking B has PAID to hold. Part B below widens it.
--
-- ⚠ `waived_free5` and `waived_import` count as settled here, exactly as they do
-- in `event-access-stage.ts`. Reading "settled" as `paid` alone would mean a
-- supplier's FIRST FIVE bookings never hold their date — the window in which a
-- new supplier is most exposed to being double-booked.

-- ── A · close the date when the fee settles ────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_hold_date_on_fee_settled(p_charge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT c.status                AS charge_status,
         ev.marketplace_vendor_id AS vpid,
         e.event_date             AS event_date
    INTO v
    FROM public.booking_fee_charges c
    JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
    JOIN public.events e         ON e.event_id   = ev.event_id
   WHERE c.charge_id = p_charge_id;

  IF NOT FOUND THEN
    -- A send-sourced charge has no event_vendor anchor and therefore no booked
    -- date to hold. Not a fault — there is nothing to close.
    RETURN jsonb_build_object('held', false, 'skipped', 'no_booking');
  END IF;
  IF v.vpid IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'not_marketplace');
  END IF;
  IF v.event_date IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'no_date');
  END IF;
  IF v.charge_status NOT IN ('paid', 'waived_free5', 'waived_import') THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'fee_unsettled',
                              'status', v.charge_status);
  END IF;

  -- Idempotent inside `vendor_block_booked_date` itself (it skips when a booked
  -- block already covers that civil day), so a re-approval cannot double-write.
  PERFORM public.vendor_block_booked_date(v.vpid, v.event_date, 'Booked');
  RETURN jsonb_build_object('held', true, 'date', v.event_date);
END;
$$;

COMMENT ON FUNCTION public.vendor_hold_date_on_fee_settled(UUID) IS
  'Owner 2026-09-18: the supplier''s date is held once their booking fee is '
  'settled. Additive to event_vendor_autoblock_on_booking, which is left alone '
  'because its deposit_paid condition guards a status the HOST owns. Waived '
  'charges count as settled, or a supplier''s first five bookings would never '
  'hold a date.';

-- ── B · teach the release side about the new reason ────────────────────────
-- Re-created in full. The only change is the second EXISTS: a booking whose fee
-- is settled now holds its day just as a deposit_paid one does. Everything else
-- — the PH civil-day pinning, the `p_except_event_vendor_id` exclusion, the
-- refusal to touch manual/synced blocks — is carried over verbatim from
-- 20271121865976, whose header explains why each is load-bearing.
CREATE OR REPLACE FUNCTION public.vendor_unblock_booked_date(
  p_vendor_profile_id uuid,
  p_date              date,
  p_except_event_vendor_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_date IS NULL THEN
    RETURN FALSE;
  END IF;

  -- (1) UNCHANGED — another live booking still holds this day by STATUS.
  IF EXISTS (
    SELECT 1
      FROM public.event_vendors ev
      JOIN public.events e ON e.event_id = ev.event_id
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       AND ev.status IN (
             'deposit_paid'::public.vendor_status,
             'delivered'::public.vendor_status,
             'complete'::public.vendor_status
           )
       AND e.event_date = p_date
       AND (p_except_event_vendor_id IS NULL
            OR ev.vendor_id <> p_except_event_vendor_id)
  ) THEN
    RETURN FALSE;
  END IF;

  -- (2) NEW — another booking holds this day by a SETTLED FEE. Without this,
  -- releasing booking A reopens a date booking B has already paid to hold, and
  -- the supplier is double-booked by the very mechanism meant to protect him.
  IF EXISTS (
    SELECT 1
      FROM public.booking_fee_charges c
      JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
      JOIN public.events e         ON e.event_id   = ev.event_id
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       AND c.status IN ('paid', 'waived_free5', 'waived_import')
       AND e.event_date = p_date
       AND (p_except_event_vendor_id IS NULL
            OR ev.vendor_id <> p_except_event_vendor_id)
  ) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.vendor_calendar_blocks
   WHERE vendor_profile_id = p_vendor_profile_id
     AND pool_id IS NULL
     AND block_source = 'setnayan_booking'
     AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = p_date;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- ── C · release the date when the fee is reversed ──────────────────────────
-- The mirror of A, for the refund path added in the same bundle
-- (`booking_fee_reverse_charge`). A hold with no release is the mirror defect:
-- a refunded supplier whose calendar stays shut.
CREATE OR REPLACE FUNCTION public.vendor_release_date_on_fee_reversed(p_charge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v RECORD;
  v_reopened BOOLEAN;
BEGIN
  SELECT ev.vendor_id              AS event_vendor_id,
         ev.marketplace_vendor_id  AS vpid,
         e.event_date              AS event_date
    INTO v
    FROM public.booking_fee_charges c
    JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
    JOIN public.events e         ON e.event_id   = ev.event_id
   WHERE c.charge_id = p_charge_id;

  IF NOT FOUND OR v.vpid IS NULL OR v.event_date IS NULL THEN
    RETURN jsonb_build_object('reopened', false, 'skipped', 'no_booking');
  END IF;

  -- Exclude THIS booking, or its own (now-reversed) charge would still be found
  -- by check (2) above and keep the date shut against itself.
  v_reopened := public.vendor_unblock_booked_date(v.vpid, v.event_date, v.event_vendor_id);
  RETURN jsonb_build_object('reopened', v_reopened, 'date', v.event_date);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_hold_date_on_fee_settled(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_hold_date_on_fee_settled(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.vendor_release_date_on_fee_reversed(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_release_date_on_fee_reversed(UUID) TO service_role;
