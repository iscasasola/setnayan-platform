-- the_send_fee_outlives_its_proposal — CTRL-B1 build 8.
--
-- ── THE SLICE 20271153200818 NAMED AND LEFT ─────────────────────────────────
-- `the_money_outlives_the_event` made a charge survive its celebration, and its
-- own comment says exactly what it did not do:
--
--     "a charge anchored on `proposal_id` (source='send') still dies with
--      `vendor_proposals`, which is its own slice. Named here rather than
--      silently half-fixed."
--
-- This is that slice. A supplier's debt to Setnayan is not the couple's data and
-- must not be deletable by whoever can delete the record that introduced it.
--
-- ── WHY THIS IS NOT JUST "FLIP THE FK TO SET NULL" ─────────────────────────
-- 🔑 `booking_fee_charges_anchor_ck` requires `proposal_id IS NOT NULL OR
-- event_vendor_id IS NOT NULL`, and a SEND-sourced charge has NO
-- `event_vendor_id`. So SET NULL on its own would make the FK's own write
-- violate the table's CHECK — and a constraint violation inside a cascade takes
-- the whole DELETE down with it, which is a worse failure than the one being
-- fixed: the couple's delete button would start erroring instead of quietly
-- destroying money.
--
-- That is the SAME SHAPE as the bug slice 4 shipped and regression-tested:
-- "a composite FK turns 'preserve the parent' into an UPDATE of a referenced
-- column, and an FK's ON DELETE rule says nothing about UPDATEs." Here it is a
-- CHECK rather than an FK, and it is caught before shipping rather than after.
--
-- ── THE SHAPE ──────────────────────────────────────────────────────────────
-- Record the detachment instead of widening the rule into meaninglessness:
--   · `proposal_detached_at` marks a charge whose proposal was deleted;
--   · the anchor CHECK accepts that third state — and ONLY that state, so an
--     anchorless charge still cannot be INSERTed (the column is NULL at insert);
--   · a BEFORE UPDATE trigger stamps it exactly when the FK nulls the anchor,
--     so the marker cannot drift from the fact it records.
--
-- ⚠ The LOCK half is already correct — `event_vendor_id` survives because slice 2
-- preserves booked rows. This does not touch it, and does not weaken any of the
-- three preserve conditions in `keep_supplier_bookings_on_event_delete`.

-- ── A · the marker ──────────────────────────────────────────────────────────
ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS proposal_detached_at TIMESTAMPTZ;

COMMENT ON COLUMN public.booking_fee_charges.proposal_detached_at IS
  'Set when this charge''s vendor_proposals row was deleted and proposal_id was '
  'nulled by the FK. Its presence is what lets booking_fee_charges_anchor_ck '
  'accept an anchorless row WITHOUT letting one be inserted.';

-- ── B · stamp it at the moment the anchor is lost ──────────────────────────
-- BEFORE UPDATE, so the stamp lands in the same write the FK is performing.
-- Fires only on the NOT NULL -> NULL transition: a charge that never had a
-- proposal (the lock path) is untouched, and a re-run cannot re-stamp.
CREATE OR REPLACE FUNCTION public.booking_fee_charge_mark_proposal_detached()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.proposal_id IS NOT NULL AND NEW.proposal_id IS NULL
     AND NEW.proposal_detached_at IS NULL THEN
    NEW.proposal_detached_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_fee_charge_mark_proposal_detached ON public.booking_fee_charges;
CREATE TRIGGER booking_fee_charge_mark_proposal_detached
  BEFORE UPDATE OF proposal_id ON public.booking_fee_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.booking_fee_charge_mark_proposal_detached();

-- ── C · widen the anchor by exactly one state ──────────────────────────────
-- 🔑 RE-LISTED DELIBERATELY AND IN FULL. A re-listed vocabulary silently drops
-- whatever was added since; both original arms are carried over verbatim from
-- 20270927120000 and only the third is new. The PGlite replay checks this
-- against real rows.
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_anchor_ck;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_anchor_ck
    CHECK (
      proposal_id IS NOT NULL
      OR event_vendor_id IS NOT NULL
      OR proposal_detached_at IS NOT NULL
    );

COMMENT ON CONSTRAINT booking_fee_charges_anchor_ck ON public.booking_fee_charges IS
  'A charge anchors to a proposal (send) or an event_vendor (lock). The third '
  'arm is not a loophole: proposal_detached_at is NULL at INSERT and is written '
  'only by the trigger, so an anchorless charge still cannot be created — only '
  'orphaned by a deletion it did not choose.';

-- ── D · the FK ─────────────────────────────────────────────────────────────
-- `proposal_id` already dropped NOT NULL in 20270927120000 (the lock path needs
-- it nullable), so only the ON DELETE rule changes here.
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_proposal_id_fkey;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES public.vendor_proposals(proposal_id)
    ON DELETE SET NULL;
