-- the_fee_is_made_at_the_yes
-- ============================================================================
-- THE BOOKING FEE IS MADE AT THE SUPPLIER'S YES — the SQL half.
--
-- ⚖ OWNER, 2026-10-12 ("APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)", corpus
-- DECISION_LOG, commit 81292dc), answering
-- `controller-2026-10-12/BOOKING_FEE_RULES_AUDIT_2026-10-12.md` § 4:
--   (1) the fee is CREATED at the supplier's YES ("no handshake, no access");
--   (7) no fee, no couple gift — the quote stops promising it while waived;
--   (9) an unpaid fee for a cancelled booking expires unbilled; a paid fee
--       stays paid.
-- and the audit's build list items 2 and 12.
--
-- The minting itself moves in TypeScript (`lib/booking-fee-mint.server.ts`
-- calls the UNCHANGED `booking_fee_open_lock_charge` at the yes). This file is
-- what the database must learn so that move is safe:
--
--   A · a new status, `cancelled_unbilled` — re-listed with EVERY existing one;
--   B · the date hold counts a promo waiver as settled (audit C15) — the hold,
--       the release check and the date-follow trigger, all three;
--   C · releasing a booking that held its day BY A SETTLED FEE reopens the day
--       (until now only a `deposit_paid`+ booking could release one — a waived
--       booking held at the yes would have stayed shut forever);
--   D · a booking cancelled before its event lets its UNPAID fee expire
--       unbilled, and voids the open bill (owner #9);
--   E · "no charge" stops counting as unlocked for a BOOKED shop (audit C3,
--       item 12): no handshake, no access;
--   F · the gift quote stops promising a gift on a fee that is waived — a free
--       window, or a charge already waived (audit C14, owner #7).
--
-- Every function below is re-created from its LATEST prior definition (named
-- at each one) with only the marked change. Grants are re-stated as they were.
-- Idempotent.
-- ============================================================================

BEGIN;

-- ── A · THE STATUS ──────────────────────────────────────────────────────────
-- ⚠ RE-LISTED IN FULL. A re-listed CHECK that forgets a value fails only when a
-- real row of that value exists — CI passes and production breaks. Every
-- member of 20271240512825's list is here, plus the new one.
--
-- `cancelled_unbilled` and NOT `expired`: `expired` is in
-- FEE_UNSETTLED_STATUSES (lib/event-access-stage.ts) and in the SQL gate's
-- lock list, because it means "the window closed and it is STILL OWED". A
-- cancelled booking owes nothing. Re-using `expired` would have said the
-- opposite of the ruling and would lock a supplier the couple later re-books.
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_status_check;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'expired',
                    'waived_import', 'waived_free5', 'waived_promo',
                    'cancelled_unbilled'));

COMMENT ON COLUMN public.booking_fee_charges.status IS
  'pending = billed, unpaid · paid · failed · expired (window closed, still owed) · '
  'waived_import (the supplier brought the client) · waived_free5 (one of the shop''s '
  'first five sourced bookings) · waived_promo (a free-fee window) · cancelled_unbilled '
  '(owner 2026-10-12 #9: the booking was cancelled before its event while the fee was '
  'unpaid — nothing is owed and the bill was voided). A paid fee is never moved by a '
  'cancellation.';

-- ── B · THE DATE HOLD COUNTS A PROMO WAIVER (audit C15) ─────────────────────
-- From 20271239789106 (the only prior definition). Two changes, both marked:
--   · `waived_promo` joins the settled set — FEE_SETTLED_STATUSES and the SQL
--     gate already count it; this was the one place that did not;
--   · the booking must still be BOOKED. A paid fee stays paid when a booking is
--     cancelled (owner #9), so "a settled charge exists" alone would let a
--     cancelled booking close a date.
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
         ev.status                AS booking_status,
         ev.archived_at           AS archived_at,
         e.event_date             AS event_date
    INTO v
    FROM public.booking_fee_charges c
    JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
    JOIN public.events e         ON e.event_id   = ev.event_id
   WHERE c.charge_id = p_charge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'no_booking');
  END IF;
  IF v.vpid IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'not_marketplace');
  END IF;
  IF v.event_date IS NULL THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'no_date');
  END IF;
  -- ⟵ CHANGED: a cancelled booking holds nothing, whatever its fee says.
  IF v.archived_at IS NOT NULL
     OR v.booking_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'not_booked');
  END IF;
  -- ⟵ CHANGED: `waived_promo` is settled.
  IF v.charge_status NOT IN ('paid', 'waived_free5', 'waived_import', 'waived_promo') THEN
    RETURN jsonb_build_object('held', false, 'skipped', 'fee_unsettled',
                              'status', v.charge_status);
  END IF;

  PERFORM public.vendor_block_booked_date(v.vpid, v.event_date, 'Booked');
  RETURN jsonb_build_object('held', true, 'date', v.event_date);
END;
$$;

-- From 20271239789106 (the latest definition). Changes marked: the settled set
-- learns `waived_promo`, and a fee-held day counts only while that booking is
-- still booked.
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

  -- (2) another booking holds this day by a SETTLED FEE.
  IF EXISTS (
    SELECT 1
      FROM public.booking_fee_charges c
      JOIN public.event_vendors ev ON ev.vendor_id = c.event_vendor_id
      JOIN public.events e         ON e.event_id   = ev.event_id
     WHERE ev.marketplace_vendor_id = p_vendor_profile_id
       -- ⟵ CHANGED: `waived_promo` is settled.
       AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo')
       -- ⟵ CHANGED: only while that booking is still booked — a paid fee
       -- outlives a cancellation (owner #9) and must not hold a day forever.
       AND ev.archived_at IS NULL
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
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

-- From 20271259875335 (the latest definition). One change: `waived_promo` in
-- the fee-held set, and the held booking must not be archived.
CREATE OR REPLACE FUNCTION public.events_booked_dates_follow_the_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.event_date IS NULL OR NEW.event_date IS NULL OR OLD.event_date = NEW.event_date THEN
    RETURN NULL;
  END IF;

  FOR r IN
    SELECT ev.vendor_id, ev.marketplace_vendor_id
      FROM public.event_vendors ev
     WHERE ev.event_id = NEW.event_id
       AND ev.marketplace_vendor_id IS NOT NULL
       AND (
         ev.status IN ('deposit_paid', 'delivered', 'complete')
         OR (
           -- ⟵ CHANGED: a fee-held day belongs to a booking still booked.
           ev.archived_at IS NULL
           AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
           AND EXISTS (
             SELECT 1 FROM public.booking_fee_charges c
              WHERE c.event_vendor_id = ev.vendor_id
                -- ⟵ CHANGED: `waived_promo` is settled.
                AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo')
           )
         )
       )
  LOOP
    BEGIN
      PERFORM public.vendor_unblock_booked_date(r.marketplace_vendor_id, OLD.event_date, r.vendor_id);
      PERFORM public.vendor_block_booked_date(r.marketplace_vendor_id, NEW.event_date, 'Booked');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'events_booked_dates_follow_the_event: % from % to %: %',
        r.marketplace_vendor_id, OLD.event_date, NEW.event_date, SQLERRM;
    END;
  END LOOP;

  BEGIN
    UPDATE public.vendor_schedule_pool_bookings
       SET booked_date = NEW.event_date
     WHERE event_id = NEW.event_id
       AND released_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'events_booked_dates_follow_the_event: pools for %: %', NEW.event_id, SQLERRM;
  END;

  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.events_booked_dates_follow_the_event() FROM PUBLIC, anon, authenticated;

-- ── C · A DAY HELD BY A SETTLED FEE IS GIVEN BACK WHEN THE BOOKING ENDS ─────
-- From 20271121865976 (the only definition). Before: the trigger released only
-- a row leaving {deposit_paid, delivered, complete}. Since the fee is made at
-- the yes and a waiver settles at that same instant, a `contracted` booking now
-- holds its day by its fee — and cancelling it (contracted → considering) left
-- that day shut forever. "Held" is now: the status set, OR a booked row with a
-- settled fee. The release itself is unchanged.
CREATE OR REPLACE FUNCTION public.event_vendor_reopen_on_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date      DATE;
  v_row       public.event_vendors%ROWTYPE;
  v_was       BOOLEAN;
  v_is_now    BOOLEAN;
  v_fee_held  BOOLEAN;
BEGIN
  v_row := OLD;

  IF v_row.marketplace_vendor_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ⟵ NEW: does this booking's own fee hold its day?
  v_fee_held := EXISTS (
    SELECT 1 FROM public.booking_fee_charges c
     WHERE c.event_vendor_id = v_row.vendor_id
       AND c.status IN ('paid', 'waived_free5', 'waived_import', 'waived_promo')
  );

  v_was := OLD.status IN (
    'deposit_paid'::public.vendor_status,
    'delivered'::public.vendor_status,
    'complete'::public.vendor_status
  ) OR (v_fee_held AND OLD.status = 'contracted'::public.vendor_status);
  IF NOT v_was THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_is_now := NEW.status IN (
      'deposit_paid'::public.vendor_status,
      'delivered'::public.vendor_status,
      'complete'::public.vendor_status
    ) OR (v_fee_held AND NEW.status = 'contracted'::public.vendor_status);
    IF v_is_now THEN
      RETURN NULL;  -- contracted → deposit_paid → delivered is not a release.
    END IF;
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = v_row.event_id;
  IF v_date IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM public.vendor_unblock_booked_date(
      v_row.marketplace_vendor_id, v_date, v_row.vendor_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'event_vendor_reopen_on_release: reopen failed for vendor % date %: %',
      v_row.marketplace_vendor_id, v_date, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

-- ── D · A CANCELLED BOOKING'S UNPAID FEE EXPIRES UNBILLED (owner #9) ────────
-- "an unpaid fee for a cancelled booking expires unbilled; a paid fee stays
--  paid." Since the fee is made at the yes, a couple who backs out before
-- paying anybody would otherwise leave the supplier owing Setnayan for an
-- event that will never happen.
--
-- WHEN: a row that WAS booked (status in the booked set and not archived) stops
-- being booked — a status walk-back, a cancel, or an archive — and its event
-- has not happened yet (no date, or a date after today in Manila). A booking
-- that ends ON or AFTER its day keeps its bill: the service was the day.
--
-- WHAT: every `pending` charge on that booking (the primary and any pending
-- amendment delta) becomes `cancelled_unbilled`, and
-- `booking_fee_upsert_vendor_order` — the existing SQL order writer, unchanged
-- — cancels its open order and voids its pending payment row, exactly as it
-- does when an amendment takes a bill to ₱0. A `paid` or waived charge is NOT
-- touched.
--
-- ⚠ NOT ON EVENT DELETION. Deleting an event preserves its booked supplier rows
-- (`keep_supplier_bookings_on_event_delete`, status unchanged), so this does
-- not fire, and SUP-103 ("a shop's booking-fee bill is not cancelled when the
-- couple deletes") stands as written. Named for the owner, not decided here.
--
-- Exception-safe: a fee hiccup must never roll back the couple's or the
-- supplier's cancellation. It warns instead.
CREATE OR REPLACE FUNCTION public.booking_fee_expires_when_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date  DATE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Manila')::date;
  r       RECORD;
BEGIN
  IF NOT (OLD.archived_at IS NULL
          AND OLD.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')) THEN
    RETURN NULL;  -- it was not booked; there is no fee to let go.
  END IF;
  IF NEW.archived_at IS NULL
     AND NEW.status IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN NULL;  -- still booked (contracted → deposit_paid is not a cancel).
  END IF;

  SELECT event_date INTO v_date FROM public.events WHERE event_id = NEW.event_id;
  IF v_date IS NOT NULL AND v_date <= v_today THEN
    RETURN NULL;  -- the day has come; the bill stands.
  END IF;

  BEGIN
    FOR r IN
      SELECT charge_id FROM public.booking_fee_charges
       WHERE event_vendor_id = NEW.vendor_id
         AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
         SET status = 'cancelled_unbilled', expires_at = NOW(), updated_at = NOW()
       WHERE charge_id = r.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(r.charge_id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'booking_fee_expires_when_booking_cancelled: booking %: %',
      NEW.vendor_id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_fee_expires_when_booking_cancelled() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS booking_fee_expires_when_booking_cancelled ON public.event_vendors;
CREATE TRIGGER booking_fee_expires_when_booking_cancelled
  AFTER UPDATE OF status, archived_at ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_expires_when_booking_cancelled();

COMMENT ON FUNCTION public.booking_fee_expires_when_booking_cancelled() IS
  'Owner 2026-10-12 #9: a booking cancelled before its event lets its UNPAID booking fee expire unbilled (pending -> cancelled_unbilled, open order cancelled via booking_fee_upsert_vendor_order). Paid and waived charges are untouched. Not fired by event deletion (booked rows are preserved; SUP-103).';

-- ── E · NO CHARGE IS NOT UNLOCKED (audit C3, build item 12) ─────────────────
-- From 20271236283573 (the only definition). Owner 2026-10-07: "no handshake,
-- no access"; and 2026-10-12 #1: the fee is made at the yes, so a booked shop
-- that holds NO charge has had no handshake. Two changes, marked:
--   · no live charge and BOOKED ⇒ 'booked_fee_due' (was 'unlocked');
--   · a `cancelled_unbilled` row is a former booking's, not this one's — it is
--     read as "no charge", never as a settled one.
-- Not booked + no charge stays 'quoting', exactly as before.
-- ⚠ The switch (`fee_unlocks_event_enforced`) is still the only key: with it
-- off this returns 'unlocked' for everyone, unchanged. With it ON, minting must
-- be on too (NEXT_PUBLIC_BOOKING_FEE_ENABLED) — a shop can only leave this
-- stage by a charge being made.
CREATE OR REPLACE FUNCTION public.vendor_event_fee_gate_stage(
  p_event_id UUID,
  p_booked   BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_enforced BOOLEAN;
  v_profile  UUID;
  v_status   TEXT;
  v_open     TEXT;
BEGIN
  v_open := CASE WHEN COALESCE(p_booked, TRUE) THEN 'unlocked' ELSE 'quoting' END;

  BEGIN
    SELECT ps.fee_unlocks_event_enforced INTO v_enforced
    FROM public.platform_settings ps
    WHERE ps.id = 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unlocked';
  END;
  IF COALESCE(v_enforced, FALSE) IS NOT TRUE THEN
    RETURN 'unlocked';
  END IF;

  BEGIN
    SELECT vp.vendor_profile_id INTO v_profile
    FROM public.vendor_profiles vp
    WHERE vp.user_id = auth.uid()
    LIMIT 1;

    IF v_profile IS NULL THEN
      SELECT tm.vendor_profile_id INTO v_profile
      FROM public.vendor_team_members tm
      WHERE tm.user_id = auth.uid()
      ORDER BY tm.created_at
      LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'unlocked';
  END;
  IF v_profile IS NULL THEN
    RETURN 'unlocked';
  END IF;

  BEGIN
    SELECT c.status INTO v_status
    FROM public.booking_fee_charges c
    WHERE c.vendor_profile_id = v_profile
      AND c.event_id = p_event_id
      -- ⟵ CHANGED: a voided former booking's charge decides nothing.
      AND c.status <> 'cancelled_unbilled'
      -- ⟵ CHANGED (owner 2026-10-13): neither does a STALE amendment top-up.
      -- `booking_fee_rederive_lock_fee` is the only writer of `expired`, and it
      -- writes it to a pending amendment delta it is VOIDING (the total moved
      -- again). Read as "still owed" it locked a booking over a bill that no
      -- longer exists.
      AND NOT (c.kind = 'amendment_delta' AND c.status = 'expired')
    ORDER BY (c.status IN ('pending', 'failed', 'expired')) DESC, c.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RETURN v_open;
  END;

  -- ⟵ CHANGED: no charge at all. Not booked ⇒ still quoting (nothing is owed
  -- and nothing beyond a quote is theirs). BOOKED ⇒ no handshake has made the
  -- fee, so the rest of the event waits for it (`{ kind: 'none' }` in the TS
  -- rule, which now answers the same).
  IF v_status IS NULL THEN
    RETURN CASE WHEN COALESCE(p_booked, TRUE) THEN 'booked_fee_due' ELSE 'quoting' END;
  END IF;

  IF v_status NOT IN ('pending', 'failed', 'expired') THEN
    RETURN v_open;
  END IF;

  RETURN 'booked_fee_due';
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) FROM authenticated;

COMMENT ON FUNCTION public.vendor_event_fee_gate_stage(UUID, BOOLEAN) IS
  'THE BOOKING FEE UNLOCKS THE EVENT, in SQL — `resolveEventAccessStage` from apps/web/lib/event-access-stage.ts. Returns ''unlocked'' | ''booked_fee_due'' | ''quoting''. Switched by platform_settings.fee_unlocks_event_enforced: NULL/FALSE returns ''unlocked'' always. Picks the deciding booking_fee_charges row (unsettled beating settled; cancelled_unbilled ignored). Since 20271268087628 (owner 2026-10-12: the fee is made at the yes; "no handshake, no access") a BOOKED shop with no charge is ''booked_fee_due'', no longer ''unlocked''. FAILS OPEN on every read error and on no resolvable shop. INTERNAL: no role holds EXECUTE.';

-- ── F · NO FEE, NO GIFT — THE QUOTE STOPS PROMISING ONE WHILE WAIVED ────────
-- From 20271222508050 (the only definition). Owner #7: "no fee, no couple gift
-- — the quote stops promising it while waived". Two changes:
--   · a charge that ALREADY EXISTS for this booking decides: waived_free5 →
--     'free_booking', waived_import → 'not_sourced', any other waiver (a free
--     window, and the launch offer once it lands) → 'fee_waived', a ₱0 paid
--     charge → 'fee_waived'. Before a charge exists, the ordinal rule is
--     unchanged and a running free-fee window answers 'fee_waived' (audit C14 —
--     this function did not know the window existed);
--   · ⟵ ORDER: the card's yes/no is asked LAST, after every "is there a fee at
--     all" arm. It used to be asked first, so a FREE booking whose card said no
--     answered 'card_says_no' — the one arm the quote's own switch can turn
--     into a promise. A quote switched on then promised the couple photos on a
--     booking that would never be billed for them.
-- Signature, STABLE, SECURITY DEFINER and grants unchanged.
CREATE OR REPLACE FUNCTION public.setnayan_gift_quote_applies(
  p_event_id UUID, p_vendor_profile_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev          RECORD;
  v_ledger      RECORD;
  v_charge      RECORD;
  v_attribution TEXT;
  v_ordinal     INTEGER;
BEGIN
  SELECT vendor_id, package_role INTO v_ev
    FROM public.event_vendors
   WHERE event_id = p_event_id
     AND marketplace_vendor_id = p_vendor_profile_id
     AND archived_at IS NULL
     AND package_role IS DISTINCT FROM 'covered'
   ORDER BY created_at
   LIMIT 1;
  IF NOT FOUND THEN RETURN 'no_booking'; END IF;

  SELECT ledger_id, attribution, booking_ordinal, is_free_booking, created_at, source
    INTO v_ledger
    FROM public.booking_fee_ledger
   WHERE vendor_profile_id = p_vendor_profile_id AND event_id = p_event_id;

  v_attribution := COALESCE(v_ledger.attribution,
                            public.booking_fee_attribution_for(p_vendor_profile_id, p_event_id));
  IF v_attribution = 'import' THEN RETURN 'not_sourced'; END IF;

  -- ⟵ NEW: the booking's own live primary charge, when one already exists,
  -- is the answer — it is what the bill (and so the gift) will actually be.
  SELECT status, amount_charged_centavos INTO v_charge
    FROM public.booking_fee_charges
   WHERE event_vendor_id = v_ev.vendor_id
     AND kind = 'primary'
     AND status NOT IN ('failed', 'expired', 'cancelled_unbilled')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    IF v_charge.status = 'waived_free5' THEN RETURN 'free_booking'; END IF;
    IF v_charge.status = 'waived_import' THEN RETURN 'not_sourced'; END IF;
    IF v_charge.status LIKE 'waived\_%' THEN RETURN 'fee_waived'; END IF;
    IF COALESCE(v_charge.amount_charged_centavos, 0) <= 0 THEN RETURN 'fee_waived'; END IF;
    IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
    RETURN 'applies';
  END IF;

  IF v_ledger.booking_ordinal IS NOT NULL THEN
    IF v_ledger.is_free_booking THEN RETURN 'free_booking'; END IF;
  ELSE
    IF v_ledger.ledger_id IS NOT NULL AND v_ledger.source = 'lock' THEN
      SELECT count(*) INTO v_ordinal
        FROM public.booking_fee_ledger l2
       WHERE l2.vendor_profile_id = p_vendor_profile_id
         AND l2.source = 'lock'
         AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    ELSE
      SELECT count(*) + 1 INTO v_ordinal
        FROM public.booking_fee_ledger l2
       WHERE l2.vendor_profile_id = p_vendor_profile_id
         AND l2.source = 'lock';
    END IF;
    IF GREATEST(v_ordinal, 1) <= 5 THEN RETURN 'free_booking'; END IF;
  END IF;

  -- ⟵ NEW (audit C14): the same arm `booking_fee_open_lock_charge` takes,
  -- below free-5 — a booking made now would be waived by the window.
  IF public.booking_fee_free_window_active() THEN RETURN 'fee_waived'; END IF;

  -- ⟵ MOVED: the card is asked only once a fee is actually coming.
  IF NOT public.setnayan_gift_offered_on(v_ev.vendor_id) THEN RETURN 'card_says_no'; END IF;
  RETURN 'applies';
END;
$$;

REVOKE ALL ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.setnayan_gift_quote_applies(UUID, UUID) TO service_role;

-- ── G · A DELETED EVENT'S UNPAID FEE EXPIRES TOO (owner 2026-10-13) ─────────
-- ⚖ DECISION_LOG 2026-10-13: "an UNPAID fee EXPIRES when its event is deleted
-- (a paid fee stays)". Deleting an event keeps its booked supplier rows
-- (`keep_supplier_bookings_on_event_delete`, status unchanged), so trigger D
-- never sees it; this is the event's own door. Same outcome as a cancelled
-- booking: every `pending` charge on the event → `cancelled_unbilled`, and its
-- open bill cancelled through the unchanged SQL order writer. Paid and waived
-- charges are untouched. No date test: the owner's rule is the deletion itself.
-- BEFORE DELETE so the charges still carry `event_id` (it is ON DELETE SET
-- NULL). Exception-safe: a fee hiccup must never block deleting an event.
CREATE OR REPLACE FUNCTION public.booking_fee_expires_when_event_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  BEGIN
    FOR r IN
      SELECT charge_id FROM public.booking_fee_charges
       WHERE event_id = OLD.event_id
         AND status = 'pending'
    LOOP
      UPDATE public.booking_fee_charges
         SET status = 'cancelled_unbilled', expires_at = NOW(), updated_at = NOW()
       WHERE charge_id = r.charge_id;
      PERFORM public.booking_fee_upsert_vendor_order(r.charge_id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'booking_fee_expires_when_event_deleted: event %: %', OLD.event_id, SQLERRM;
  END;
  RETURN OLD;  -- BEFORE DELETE: returning NULL would silently cancel the delete.
END;
$$;

REVOKE ALL ON FUNCTION public.booking_fee_expires_when_event_deleted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_fee_expires_on_delete ON public.events;
CREATE TRIGGER events_fee_expires_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.booking_fee_expires_when_event_deleted();

-- ── I · THE EVENT LOCK CANNOT BE ON WHILE NO FEE IS BEING MADE ──────────────
-- ⚖ OWNER 2026-10-13: refuse `fee_unlocks_event_enforced = true` while
-- NEXT_PUBLIC_BOOKING_FEE_ENABLED is off. Since E above, a booked shop with no
-- charge is locked; with minting off no charge can ever be made, so every booked
-- shop would be locked with nothing to pay. SQL cannot read an env flag, so the
-- PRODUCTION app stamps what it is running with into `booking_fee_minting_live`
-- at server start (`stampBookingFeeMinting`, apps/web/instrumentation.ts), and
-- this trigger refuses the switch unless that stamp says TRUE.
--   · setting the switch TRUE with the stamp not TRUE → refused (raises);
--   · the stamp turning FALSE while the switch is on → the switch stands down
--     to FALSE (the safe direction: suppliers unlock, nothing is withheld).
-- Column-scoped (UPDATE OF the two columns), so no other platform_settings save
-- — a price edit, a seed — can move the switch.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS booking_fee_minting_live BOOLEAN;

COMMENT ON COLUMN public.platform_settings.booking_fee_minting_live IS
  'Stamped by the PRODUCTION app at server start: is NEXT_PUBLIC_BOOKING_FEE_ENABLED on? NULL = never stamped. fee_unlocks_event_enforced cannot be TRUE unless this is TRUE (owner 2026-10-13).';

CREATE OR REPLACE FUNCTION public.platform_settings_fee_lock_needs_minting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.fee_unlocks_event_enforced IS TRUE AND NEW.booking_fee_minting_live IS NOT TRUE THEN
    IF TG_OP = 'UPDATE' AND OLD.fee_unlocks_event_enforced IS TRUE
       AND NEW.booking_fee_minting_live IS DISTINCT FROM OLD.booking_fee_minting_live THEN
      -- Minting was switched off under a live lock: the lock stands down.
      NEW.fee_unlocks_event_enforced := FALSE;
      RAISE WARNING 'fee_unlocks_event_enforced turned OFF: the booking fee is not being made (NEXT_PUBLIC_BOOKING_FEE_ENABLED is off in production)';
    ELSE
      RAISE EXCEPTION 'fee_unlocks_event_enforced needs the booking fee on: NEXT_PUBLIC_BOOKING_FEE_ENABLED is not on in production (platform_settings.booking_fee_minting_live is %), so every booked supplier would be locked with nothing to pay', COALESCE(NEW.booking_fee_minting_live::text, 'unset')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_settings_fee_lock_needs_minting() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS platform_settings_fee_lock_needs_minting ON public.platform_settings;
CREATE TRIGGER platform_settings_fee_lock_needs_minting
  BEFORE INSERT OR UPDATE OF fee_unlocks_event_enforced, booking_fee_minting_live
  ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_settings_fee_lock_needs_minting();

-- Re-stated after the ADD COLUMN, as every platform_settings migration since
-- 20271014400000 does: anon holds nothing on this table.
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
