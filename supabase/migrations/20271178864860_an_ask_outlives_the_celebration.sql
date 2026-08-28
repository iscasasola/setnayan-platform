-- an_ask_outlives_the_celebration
-- ============================================================================
-- A SHOP KEEPS THE RECORD OF MONEY IT ASKED FOR, EVEN AFTER THE COUPLE REMOVES
-- THE CELEBRATION.
--
-- ── HOW THIS WAS FOUND: BY DELETING, NOT BY READING THE CATALOGUE ──────────
-- `vendor_payment_asks` shipped yesterday (20271177403026) with
-- `event_id … ON DELETE CASCADE`. Measured in production the way this repo
-- requires — seed a throwaway celebration, DELETE it, observe, ROLL BACK:
--
--     before   asks 1   bookings 1
--     after    asks 0   bookings 1     ← the booking survives, the ask does not
--
-- The booking survives because `sever_event_connections` nulls its `event_id`
-- and preserves the row. The ask was cascaded away beside it.
--
-- ⚖ THAT BREAKS THE OWNER'S OWN RULE (2026-08-21): *on a SHARED record the
-- vendor keeps it — contracts, payments, completed bookings*, and *the test is
-- whether the supplier took part in it*. A shop WROTE this ask and sent it. It
-- is more the supplier's record than the couple's, and losing it means a shop
-- keeps a booking while losing the record of what it asked to be paid for it.
--
-- ── AND PRESERVING THE ROW IS ONLY HALF THE JOB ────────────────────────────
-- 🔑 STORED DOES NOT MEAN SURVIVES — the fifth costume of that defect is a
-- preserved row whose READERS were never taught to tolerate an orphan. The
-- vendor read policy is gated on `event_id IN current_vendor_booked_event_ids()`,
-- which a NULL `event_id` can never satisfy: flipping the FK alone would have
-- kept the row and made it invisible to the only party entitled to it. Both
-- halves ship here, in one migration.
--
-- ⛔ THE COUPLE'S SIDE IS DELIBERATELY NOT WIDENED. Their read stays gated on
-- `current_couple_event_ids()`, so an orphaned ask is invisible to them — which
-- is correct: they removed the celebration, and this is the supplier's business
-- record, not a way to hand somebody back a fragment of something they deleted.
--
-- 🔢 SAFE BY ARITHMETIC. `vendor_payment_asks` holds ZERO rows (measured
-- 2026-08-29) — the table is one day old and nothing has ever been asked. There
-- is no existing row whose fate this changes.
--
-- BARE migration: idempotent + re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · THE ROW SURVIVES. Same shape the booking beside it already uses: the
--     event link is released, the record is kept.
-- ----------------------------------------------------------------------------
ALTER TABLE public.vendor_payment_asks
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_payment_asks
  DROP CONSTRAINT IF EXISTS vendor_payment_asks_event_id_fkey;

ALTER TABLE public.vendor_payment_asks
  ADD CONSTRAINT vendor_payment_asks_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_payment_asks.event_id IS
  'The celebration this ask was about, NULL once the couple has removed it. SET NULL rather than CASCADE (changed 20271178864860) because the owner''s 2026-08-21 rule keeps a supplier''s shared records through a deletion and the test is whether the supplier took part in it -- a shop WROTE this ask. Measured by deleting a seeded celebration in a rolled-back transaction: under the original CASCADE the booking survived and the ask did not, so a shop kept a booking and lost the record of what it asked to be paid for it.';

-- ----------------------------------------------------------------------------
-- 2 · AND THE SHOP CAN STILL READ IT. Without this the row is preserved and
--     invisible, which is worse than deleting it: it looks handled.
--
--     The live gate is UNCHANGED — an ask on a celebration the shop is not
--     booked on is still refused. The only addition is the orphan arm, and it
--     is doubly bound: the ask must have NO event AND belong to a profile the
--     caller owns or administers.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS vendor_payment_asks_vendor_read ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_vendor_read
  ON public.vendor_payment_asks FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND (
      event_id IS NULL
      OR event_id IN (SELECT public.current_vendor_booked_event_ids())
    )
  );

-- ⛔ NO MATCHING ORPHAN ARM FOR THE COUPLE, AND NO NEW WRITE PATH. The insert
-- policy still requires `event_id IN current_vendor_booked_event_ids()`, so a
-- NULL event cannot be used to CREATE an ask that belongs to no celebration —
-- the orphan state is only ever reached by a deletion, never authored.

COMMENT ON POLICY vendor_payment_asks_vendor_read ON public.vendor_payment_asks IS
  'A shop reads its own payment asks: those on a celebration it is booked for, PLUS its own orphans (event_id IS NULL) left behind when a couple removed the celebration. The orphan arm exists because preserving a row without teaching its readers to tolerate a NULL event keeps the record and hides it -- worse than deleting it, because it looks handled. Both arms require the ask to belong to a profile the caller owns or administers.';
