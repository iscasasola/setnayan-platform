-- ═══════════════════════════════════════════════════════════════════════════
-- AN AMENDED DEAL KEEPS ITS TERMS — slice 6 of "vendors get to keep it"
--
-- 🚨 THIS ONE IS NOT ABOUT A MISSING RECORD. IT IS ABOUT A MISLEADING ONE.
--
-- Slice 5 made the supplier's QUOTE survive. Slice 3 made their CONTRACT
-- survive. But the things that CHANGE those terms — a bundled amendment
-- (discount / add-on / freebie / special request) and a change order — still
-- cascaded. So a supplier was left holding a quote showing the ORIGINAL price
-- with no record of the discount both sides agreed, and a contract with no
-- record of the change orders against it.
--
-- A record that survives showing terms nobody agreed to is WORSE than one that
-- is simply gone: the supplier reads it as fact. "Vendors get to keep it" has
-- to mean keeping what was actually agreed.
--
-- ✅ SLICE-4 TRAP CHECKED FIRST, AS IT NOW ALWAYS IS: every FK on these three
-- tables is SINGLE-COLUMN (`cardinality(conkey) = 1` on all of them), so nothing
-- spans the column being nulled and no `ON UPDATE` clause is needed.
--
-- ⚖ NO STATUS TEST, and the reason is the same as contracts and quotes. An
-- amendment has no draft state — the state machine starts at 'proposed', which
-- means it was SENT — so both parties saw every row here, including the ones
-- that were declined. A declined request is part of the record of the
-- negotiation both sides took part in.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The amendment itself ────────────────────────────────────────────────────
ALTER TABLE public.proposal_amendments
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.proposal_amendments
  DROP CONSTRAINT IF EXISTS proposal_amendments_event_id_fkey;

ALTER TABLE public.proposal_amendments
  ADD CONSTRAINT proposal_amendments_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ── …and its ITEMS, which are where the money actually is ───────────────────
-- ⚠ THE PARENT SURVIVING IS NOT ENOUGH, AND THIS IS THE WHOLE POINT OF THE
-- SLICE. `proposal_amendments` carries the note and the status; the amounts live
-- one table down in `proposal_amendment_items.amount_php`, one row per line.
-- Preserving only the parent leaves an amendment that says "accepted" and
-- cannot say WHAT was accepted — the exact misleading-record failure this slice
-- exists to prevent, reproduced inside the fix.
--
-- `amendment_id` stays CASCADE deliberately: an item genuinely belongs to its
-- amendment, and with the amendment now surviving, that cascade never fires on
-- a deletion.
ALTER TABLE public.proposal_amendment_items
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.proposal_amendment_items
  DROP CONSTRAINT IF EXISTS proposal_amendment_items_event_id_fkey;

ALTER TABLE public.proposal_amendment_items
  ADD CONSTRAINT proposal_amendment_items_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

-- ── The contract's equivalent ───────────────────────────────────────────────
-- `vendor_change_orders.event_vendor_id` is NOT NULL + CASCADE and is LEFT
-- ALONE: slice 2 preserves a booked row rather than deleting it, so that FK
-- never fires for a supplier who took part. For a booking that is NOT preserved
-- — a name the couple typed, a shortlisted row — the change order correctly
-- goes with it, because there is no supplier account to keep it for.
ALTER TABLE public.vendor_change_orders
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_change_orders
  DROP CONSTRAINT IF EXISTS vendor_change_orders_event_id_fkey;

ALTER TABLE public.vendor_change_orders
  ADD CONSTRAINT vendor_change_orders_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.proposal_amendments.event_id IS
  'NULL once the couple deleted the celebration (owner 2026-08-21, "vendors get '
  'to keep it"). The amendment records what BOTH sides agreed to change about '
  'the quote — without it the surviving quote shows a price nobody agreed to.';

COMMENT ON COLUMN public.proposal_amendment_items.event_id IS
  'NULL once the couple deleted the celebration. These rows carry the AMOUNTS; '
  'the parent amendment carries only the note and status, so preserving the '
  'parent alone leaves a record that says "accepted" and cannot say what.';

COMMENT ON COLUMN public.vendor_change_orders.event_id IS
  'NULL once the couple deleted the celebration. A change order is the agreed '
  'delta against a signed contract; the contract survives (slice 3) and would '
  'otherwise state superseded terms as fact.';
