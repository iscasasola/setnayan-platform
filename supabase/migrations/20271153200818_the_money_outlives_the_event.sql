-- ═══════════════════════════════════════════════════════════════════════════
-- THE MONEY OUTLIVES THE EVENT — slice 4 of "vendors get to keep it"
--
-- Two things the owner named, plus one defect slice 2 introduced.
--
-- 🚨 PART A IS A BUG FIX, AND IT IS THE URGENT HALF. Slice 2's trigger UPDATEs
-- `event_vendors.event_id` to NULL. `event_vendor_payments` carries a COMPOSITE
-- foreign key — (event_id, vendor_id) REFERENCES event_vendors(event_id,
-- vendor_id) — with NO `ON UPDATE` clause, so it defaults to NO ACTION. The
-- moment a supplier records a payment against a booked marketplace job, that
-- UPDATE is refused and, because it runs inside a BEFORE DELETE trigger, THE
-- WHOLE DELETION FAILS: the couple can never delete their celebration again.
--
-- Proved in the replay, not reasoned about:
--   "update or delete on table event_vendors violates foreign key constraint
--    event_vendor_payments_event_vendor_fk on table event_vendor_payments"
--
-- Latent today by arithmetic — prod has 3 payments and 0 of them sit on a
-- marketplace-linked booking — which is exactly the window to fix it in.
--
-- 🔑 THE LESSON: A COMPOSITE FK TURNS "PRESERVE THE PARENT" INTO AN *UPDATE* OF
-- A REFERENCED COLUMN, AND AN FK'S `ON DELETE` RULE SAYS NOTHING ABOUT UPDATES.
-- Every later slice that nulls a referenced column must check for children
-- whose FK spans it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A · The payment follows its booking instead of blocking the delete ──────
ALTER TABLE public.event_vendor_payments
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.event_vendor_payments
  DROP CONSTRAINT IF EXISTS event_vendor_payments_event_vendor_fk;

ALTER TABLE public.event_vendor_payments
  ADD CONSTRAINT event_vendor_payments_event_vendor_fk
  FOREIGN KEY (event_id, vendor_id)
  REFERENCES public.event_vendors(event_id, vendor_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- ⚠ `event_vendor_payments_event_id_fkey` (to `events`) is LEFT AS CASCADE on
-- purpose. By the time the row cascade runs, the ON UPDATE above has already
-- nulled `event_id` for every payment whose booking was preserved, so nothing
-- matches it. A payment whose booking was NOT preserved — a name the couple
-- typed, a shortlisted row — still cascades away with the celebration, which is
-- correct: there is no supplier record to keep.

-- ── B · Setnayan's own money survives ───────────────────────────────────────
-- `booking_fee_ledger` and `booking_fee_charges` are what a SUPPLIER OWES
-- SETNAYAN for the introduction. They are not the couple's data in any sense —
-- the couple is not a party to this debt — yet both cascaded, so a couple
-- pressing delete quietly erased money owed to us. `/admin/booking-fees` is the
-- only screen that lists it.
ALTER TABLE public.booking_fee_ledger
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.booking_fee_ledger
  DROP CONSTRAINT IF EXISTS booking_fee_ledger_event_id_fkey;

ALTER TABLE public.booking_fee_ledger
  ADD CONSTRAINT booking_fee_ledger_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

ALTER TABLE public.booking_fee_charges
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_event_id_fkey;

ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ⚠ `booking_fee_charges_anchor_ck` requires `proposal_id` OR `event_vendor_id`
-- to be non-null, and BOTH still CASCADE. That is deliberate and only half a
-- win: a charge anchored on `event_vendor_id` now survives, because slice 2
-- preserves booked rows. A charge anchored on `proposal_id` (source='send')
-- still dies with `vendor_proposals`, which is its own slice. Named here rather
-- than silently half-fixed — a test asserts the half that works.

-- ── C · The supplier keeps the receipt; the couple keeps their bank rail ────
-- Extends slice 2's trigger rather than adding a third to `events`. Ordering is
-- the reason, not tidiness: BEFORE DELETE triggers fire in NAME order, the ON
-- UPDATE CASCADE above nulls the payment's `event_id` the instant slice 2's
-- UPDATE runs, and a separate trigger sorting after it would be looking for
-- rows by an `event_id` that is already NULL. Doing both inside one statement
-- removes the ordering question entirely.
CREATE OR REPLACE FUNCTION public.keep_supplier_bookings_on_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  /*
    A payment the supplier NEVER CONFIRMED is the couple's claim that they paid,
    not the supplier's record of being paid. There is no supplier-side fact to
    keep, so it goes with the celebration. Deleted BEFORE the preserve below, or
    the ON UPDATE CASCADE would carry it into orphanhood.
  */
  DELETE FROM public.event_vendor_payments p
   USING public.event_vendors ev
   WHERE ev.vendor_id = p.vendor_id
     AND ev.event_id = OLD.event_id
     AND p.vendor_confirmed_at IS NULL;

  /*
    The preserve from slice 2, UNCHANGED — same three conditions, same reasons
    (really-booked status · a marketplace link the couple cannot stamp itself ·
    not self-dealt, evaluated now because `event_members` cascades). It is a CTE
    only so the surviving bookings can be handed straight to the scrub below.
  */
  WITH preserved AS (
    UPDATE public.event_vendors ev
       SET event_id             = NULL,
           event_type_at_delete = OLD.event_type,
           event_date_at_delete = OLD.event_date
     WHERE ev.event_id = OLD.event_id
       AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
       AND ev.marketplace_vendor_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM public.event_members em
           JOIN public.vendor_profiles vp
             ON vp.vendor_profile_id = ev.marketplace_vendor_id
          WHERE em.event_id = OLD.event_id
            AND em.member_type = 'couple'
            AND (
              em.user_id = vp.user_id
              OR EXISTS (
                SELECT 1 FROM public.vendor_team_members vtm
                 WHERE vtm.vendor_profile_id = vp.vendor_profile_id
                   AND vtm.user_id = em.user_id
              )
            )
       )
    RETURNING ev.vendor_id
  )
  /*
    🔒 WHAT SURVIVES IS THE RECEIPT, NOT THE BANK DETAILS. `amount_php`,
    `paid_at`, `schedule_instance_seq` and `vendor_confirmed_at` are the
    supplier's record of money they received. `method`, `reference`, `notes` and
    `proof_r2_key` are the couple's own rail, their transfer reference, their
    private note and a PHOTOGRAPH OF THEIR BANK SCREEN. Keeping those would hand
    a supplier the couple's banking trail under cover of "vendors get to keep
    it", which is precisely the harm the ruling excludes.
  */
  UPDATE public.event_vendor_payments p
     SET method       = NULL,
         reference    = NULL,
         notes        = NULL,
         proof_r2_key = NULL
    FROM preserved
   WHERE p.vendor_id = preserved.vendor_id;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM authenticated;

COMMENT ON FUNCTION public.keep_supplier_bookings_on_event_delete() IS
  'BEFORE DELETE on events: drops payments the supplier never confirmed, '
  'detaches the bookings a supplier genuinely took part in so they outlive the '
  'celebration, and scrubs the couple''s bank rail from the receipts that '
  'survive (owner 2026-08-21, "vendors get to keep it"). Everything else '
  'cascades — `event_vendors` also holds the couple''s private shortlist.';

COMMENT ON COLUMN public.event_vendor_payments.event_id IS
  'NULL once the celebration was deleted and this payment''s booking was '
  'preserved. The composite FK to event_vendors carries it here via ON UPDATE '
  'CASCADE — without that clause the preserve is REFUSED and the couple cannot '
  'delete their celebration at all.';

COMMENT ON COLUMN public.booking_fee_ledger.event_id IS
  'NULL once the couple deleted the celebration. What a supplier owes Setnayan '
  'is not the couple''s data and does not leave with them.';
