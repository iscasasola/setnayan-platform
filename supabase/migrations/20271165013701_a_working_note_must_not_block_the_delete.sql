-- ═══════════════════════════════════════════════════════════════════════════
-- A PRIVATE NOTE MUST NOT LOCK A COUPLE OUT OF DELETING THEIR CELEBRATION
--
-- Reproduced against PRODUCTION 2026-08-24 in a rolled-back transaction: book a
-- real marketplace supplier, write ONE private working note on that booking,
-- press delete —
--
--     DELETE REFUSED :: 23503 :: update or delete on table "event_vendors"
--     violates foreign key constraint "event_vendor_working_notes_vendor_event_fk"
--
-- Not a wrong answer. A HARD FAILURE: the couple can never delete their event.
--
-- 🔑 IT IS THE SLICE-4 TRAP, STILL OPEN ON THE TABLE SLICE 2 ITSELF TOUCHES.
-- `event_vendor_working_notes` carries a COMPOSITE FK (event_vendor_id, event_id)
-- → event_vendors, with **ON UPDATE NO ACTION**. Slice 2's preserve is an UPDATE
-- of a referenced column (`event_id` → NULL), so Postgres refuses it, and inside
-- a BEFORE DELETE trigger that takes the whole deletion down with it.
--
-- Slice 4 found and fixed exactly this on `event_vendor_payments` (ON UPDATE
-- CASCADE) and wrote the rule: "AN FK'S `ON DELETE` RULE SAYS NOTHING ABOUT
-- UPDATES. Before nulling any referenced column, list the children whose FK
-- SPANS it." Measured now across the whole schema: there are SIX composite FKs
-- in `public`, and this is the ONLY one that both spans a column a preserve
-- trigger nulls and still says NO ACTION. The other four span `guests` /
-- `panood_camera_operators`, which nothing preserves.
--
-- ⛔ THE OBVIOUS FIX — MIRROR SLICE 4 AND SET `ON UPDATE CASCADE` — IS THE ONE
-- FIX THAT MUST NOT BE MADE, AND IT FAILS SILENTLY IN THE WORST DIRECTION.
-- CASCADE would carry the note's `event_id` to NULL alongside the booking. The
-- note's OWN `event_id → events` FK is ON DELETE CASCADE, so with a NULL
-- event_id it no longer matches the event being deleted and **the note would
-- SURVIVE** — permanently, attached to a preserved supplier booking.
--
-- `event_vendor_working_notes` is the single most dangerous couple-owned table
-- in the schema: up to 4,000 characters per row of candid assessment of a
-- supplier — late, rude, overpriced, avoid — written by people who were promised
-- the supplier would never see it, on rows a supplier can never read. The
-- classification is unambiguous: CASCADE is correct and MUST STAY.
--
-- ⚖ SO THE NOTES ARE DELETED A MOMENT EARLIER, NOT PRESERVED A MOMENT LONGER.
-- They already die with the event (their own FK to `events` is ON DELETE
-- CASCADE); removing them before the preserve changes NOTHING about what
-- survives — it only removes the FK's standing to refuse. This is the same shape
-- the function already opens with, where an unconfirmed payment is deleted
-- before the preserve for exactly the same structural reason.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.keep_supplier_bookings_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    🔒 THE COUPLE'S PRIVATE WORKING NOTES GO FIRST, AND THEY GO ENTIRELY.

    Same structural reason as the payments above, opposite FK rule. This table's
    composite FK (event_vendor_id, event_id) → event_vendors is ON UPDATE NO
    ACTION, so the preserve below is REFUSED while any note still points at the
    pair — taking the couple's entire deletion with it (23503, reproduced in
    prod). They cascade with the event anyway; this only moves them ahead of the
    UPDATE so the FK has nothing left to object to.

    ⛔ Do NOT "fix" this by giving that FK ON UPDATE CASCADE. The note would
    follow the booking into orphanhood, stop matching the event being deleted,
    and SURVIVE — handing a preserved supplier record 4,000 characters of the
    couple's candid assessment of that same supplier.
  */
  DELETE FROM public.event_vendor_working_notes
   WHERE event_id = OLD.event_id;

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
    private note and a PHOTOGRAPH OF THEIR BANK SCREEN.
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
$function$;
