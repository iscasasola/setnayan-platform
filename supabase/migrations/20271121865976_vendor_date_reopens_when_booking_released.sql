-- vendor_date_reopens_when_booking_released
-- ============================================================================
-- THE AUTO-BLOCK HAD NO INVERSE. A booked date closed itself and stayed closed
-- forever, even after the couple backed out.
--
-- What shipped (20270428213000): reaching 'deposit_paid' fires
-- event_vendor_autoblock_on_booking → vendor_block_booked_date(), writing an
-- org-wide `setnayan_booking` calendar block. That block is what makes the date
-- vanish from getVendorAvailableDays / vendors_blocked_on_date, and it is what
-- surfaces the couple-side "Join the waitlist" CTA.
--
-- What was MISSING — measured on origin/main + prod 2026-08-09:
--   • No function, trigger or action anywhere deletes a `setnayan_booking`
--     block. `vendor_block_booked_date` had no counterpart.
--   • `removeBlock` (the vendor's only delete path) filters
--     `.in('block_source', ['manual','external_client'])` — it CANNOT delete
--     one, and the calendar surface additionally hides `setnayan_booking` rows
--     from the removable list (surface.tsx `b.source !== 'setnayan_booking'`).
--   • All SIX releaseSchedulePools() call sites free the POOL reservation and
--     leave the BLOCK standing.
-- ⇒ Couple cancels → the vendor's slot is free internally, and every other
--   couple is still told that vendor is busy that day. Permanently. The waitlist
--   built for exactly this moment can be emailed (the vendor's one-click "a slot
--   opened" button still works) but those couples arrive at a page that still
--   reads "unavailable" and cannot book.
--
-- 🔑 Same disease as the phantom column / enum / RPC arg family: nothing throws,
--    nothing logs, CI is green — the only symptom is an absence (a date that
--    never comes back).
--
-- THIS MIGRATION adds the inverse, as a trigger rather than app code so it
-- mirrors the auto-block's un-bypassable shape (the two halves cannot drift):
--
--   1. public.vendor_unblock_booked_date(vendor, date) RETURNS boolean
--      — deletes the org-wide `setnayan_booking` block for that day, but ONLY
--        when no OTHER live booking still holds it. Returns TRUE iff the date
--        actually reopened, so the caller knows whether to notify the waitlist.
--
--   2. event_vendor_reopen_on_release — AFTER UPDATE OF status / AFTER DELETE
--      on event_vendors. Fires when a row LEAVES the capacity-consuming set
--      (deposit_paid · delivered · complete), the mirror of the auto-block's
--      entry condition. Exception-safe: a failed reopen can never roll back the
--      cancel/downgrade that triggered it, exactly as the auto-block can never
--      roll back a booking.
--
-- ⚠ WHAT IT DELIBERATELY DOES NOT TOUCH: a vendor's own manual block, their
--   'locked' / 'whitelist' day states, or an external-client block. A vendor
--   who ALSO closed that date by hand keeps it closed — only Setnayan's own
--   automatic closure is undone, because only Setnayan wrote it.
--
-- The existing AFTER DELETE capture trigger (capture_vendor_calendar_block_freed)
-- fires on this delete too, so a reopened date correctly registers as
-- "a top pick freed up" in the couple's guidance signals. That is intended.
--
-- Idempotent: CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS then CREATE.
-- No RLS change (both functions are SECURITY DEFINER, like their counterparts).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_unblock_booked_date — the inverse primitive.
--
--    The pair must agree on WHICH ROW they mean, so this matches
--    vendor_block_booked_date's predicate (pool_id IS NULL · block_source
--    'setnayan_booking' · the civil day) — but NOT by copying it verbatim.
--
--    🚨 THE TWIN'S DAY TEST WAS TIMEZONE-DEPENDENT AND WRONG IN PROD, and
--    copying it verbatim is exactly what my first draft did. Blocks are written
--    at PH midnight (`…T00:00:00+08:00`); prod's session TimeZone is **UTC**
--    (measured, not assumed), so `blocked_at::date` renders 14 Mar as **13
--    Mar**. Effects: the twin's own idempotency check never matches, so calling
--    it twice inserts a DUPLICATE block; and this DELETE would have matched
--    NOTHING, meaning the reopen shipped doing nothing at all. Section 3 below
--    corrects the twin; both now say `AT TIME ZONE 'Asia/Manila'`.
--
--    🔑 Matching a twin means matching what it MEANS, not its characters. A
--    verbatim copy inherits its bugs — and this one was invisible on a +08
--    laptop and only appeared under CI's UTC clock.
-- ----------------------------------------------------------------------------
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

  -- Another live booking still holds this day → the date stays closed. The
  -- releasing row is excluded by id: on a status downgrade its OWN row is still
  -- present and would otherwise keep the date shut against itself.
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

  -- ⚠ `blocked_at::date` WOULD BE WRONG HERE. The block is written at PH
  -- midnight (`…T00:00:00+08:00`), prod's session TimeZone is UTC, and a bare
  -- ::date renders that instant as the PREVIOUS day — so this DELETE would have
  -- matched nothing in production and the date would never have reopened: the
  -- exact bug this migration exists to fix, reintroduced. Pin the civil day.
  DELETE FROM public.vendor_calendar_blocks
   WHERE vendor_profile_id = p_vendor_profile_id
     AND pool_id IS NULL
     AND block_source = 'setnayan_booking'
     AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = p_date;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

COMMENT ON FUNCTION public.vendor_unblock_booked_date(uuid, date, uuid) IS
  'Inverse of vendor_block_booked_date: reopens a date Setnayan auto-closed when the booking that closed it is released, unless another live booking (deposit_paid/delivered/complete) still holds that day. Never touches a manual, synced or external-client block — only Setnayan''s own closure. Returns TRUE iff the date actually reopened.';

-- Grants MIRROR the forward twin exactly: vendor_block_booked_date is
-- postgres + service_role only, never `authenticated`. Nothing in app code
-- calls either primitive directly — the SECURITY DEFINER trigger does, and it
-- runs as the owner, so no couple/vendor role needs EXECUTE. Granting
-- `authenticated` here would have let any signed-in account reopen any
-- vendor's date, and the exposure-freeze guard caught exactly that on the
-- first cut of this migration.
REVOKE ALL ON FUNCTION public.vendor_unblock_booked_date(uuid, date, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_unblock_booked_date(uuid, date, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. event_vendor_reopen_on_release — the mirror trigger.
--
--    Entry condition is the exact negation of the auto-block's: that one fires
--    when a marketplace row ARRIVES at deposit_paid; this one when a row LEAVES
--    the consuming set {deposit_paid, delivered, complete}, or is deleted while
--    inside it (a cascade from a deleted event — the app blocks a hand delete of
--    a booked row).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_vendor_reopen_on_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date   DATE;
  v_row    public.event_vendors%ROWTYPE;
  v_was    BOOLEAN;
  v_is_now BOOLEAN;
BEGIN
  v_row := OLD;

  -- Only marketplace vendors have a profile / calendar to reopen.
  IF v_row.marketplace_vendor_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_was := OLD.status IN (
    'deposit_paid'::public.vendor_status,
    'delivered'::public.vendor_status,
    'complete'::public.vendor_status
  );
  IF NOT v_was THEN
    RETURN NULL;  -- it never held the date; nothing to give back.
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_is_now := NEW.status IN (
      'deposit_paid'::public.vendor_status,
      'delivered'::public.vendor_status,
      'complete'::public.vendor_status
    );
    IF v_is_now THEN
      RETURN NULL;  -- deposit_paid → delivered is not a release.
    END IF;
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = v_row.event_id;
  IF v_date IS NULL THEN
    RETURN NULL;
  END IF;

  -- Exception-safe, exactly as the auto-block is: a failed reopen must never
  -- roll back the cancel / downgrade the couple or vendor just performed.
  BEGIN
    PERFORM public.vendor_unblock_booked_date(
      v_row.marketplace_vendor_id, v_date, v_row.vendor_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'event_vendor_reopen_on_release: reopen failed for vendor % date %: %',
      v_row.marketplace_vendor_id, v_date, SQLERRM;
  END;

  RETURN NULL;  -- AFTER trigger; return value is ignored.
END;
$$;

DROP TRIGGER IF EXISTS event_vendor_reopen_on_release ON public.event_vendors;
CREATE TRIGGER event_vendor_reopen_on_release
  AFTER UPDATE OF status OR DELETE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.event_vendor_reopen_on_release();

-- ----------------------------------------------------------------------------
-- 3. 🚨 CORRECT THE FORWARD TWIN'S DAY TEST TOO — it is wrong in prod today.
--
--    vendor_block_booked_date (20270428213000) decides "is this day already
--    blocked?" with `blocked_at::date = p_date`. It WRITES the block at PH
--    midnight and prod's session TimeZone is UTC, so that instant reads back as
--    the PREVIOUS day and the check NEVER matches. The function is documented
--    and relied upon as idempotent; in fact a second call for the same date
--    inserts a SECOND identical block.
--
--    Latent today (prod holds zero calendar blocks of any source), and harmless-
--    looking — duplicate closures still close the date. But it breaks the pair:
--    the inverse deletes by the same predicate, so a mismatched pair means the
--    date never reopens. Both sides now name the civil day explicitly.
--
--    Body is otherwise UNCHANGED from 20270428213000.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_block_booked_date(
  p_vendor_profile_id uuid,
  p_date date,
  p_label text DEFAULT 'Booked'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_vendor_profile_id IS NULL OR p_date IS NULL THEN
    RETURN;
  END IF;
  -- Idempotent: skip if an org-wide booked block already covers that day.
  -- `AT TIME ZONE 'Asia/Manila'` (was a bare ::date) — see this migration's
  -- header: under prod's UTC session a PH-midnight block reads as the day
  -- before, so the bare cast never matched and this was not idempotent at all.
  IF EXISTS (
    SELECT 1 FROM public.vendor_calendar_blocks
     WHERE vendor_profile_id = p_vendor_profile_id
       AND pool_id IS NULL
       AND block_source = 'setnayan_booking'
       AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = p_date
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.vendor_calendar_blocks
    (vendor_profile_id, pool_id, blocked_at, blocked_until,
     block_label, block_source, is_private)
  VALUES
    (p_vendor_profile_id, NULL,
     (p_date::text || 'T00:00:00+08:00')::timestamptz,
     (p_date::text || 'T23:30:00+08:00')::timestamptz,
     COALESCE(NULLIF(btrim(p_label), ''), 'Booked'), 'setnayan_booking', TRUE);
END;
$$;

COMMENT ON FUNCTION public.vendor_block_booked_date(uuid, date, text) IS
  'Closes a vendor date on a booking (20270428213000). Day test corrected 2026-08-09 to (blocked_at AT TIME ZONE ''Asia/Manila'')::date: blocks are written at PH midnight and prod runs a UTC session, so the original bare ::date read the day BEFORE and the documented idempotency never actually held. Paired with vendor_unblock_booked_date — both must name the civil day the same way or a released date never reopens.';

COMMENT ON FUNCTION public.event_vendor_reopen_on_release() IS
  'Mirror of event_vendor_autoblock_on_booking. When a marketplace booking leaves the capacity-consuming set (deposit_paid/delivered/complete) by downgrade, cancel or delete, the date Setnayan auto-closed is reopened — unless another live booking still holds it. Without this the auto-block was permanent and a cancelled date never came back.';

COMMIT;
