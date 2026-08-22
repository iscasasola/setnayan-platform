-- ═══════════════════════════════════════════════════════════════════════════
-- A QUOTE OUTLIVES THE EVENT — slice 5 of "vendors get to keep it"
--
-- A proposal is a QUOTE THE SUPPLIER WROTE AND SENT. `vendor_profile_id` is NOT
-- NULL, the supplier authored every word of it, and there is no such thing as a
-- proposal the supplier did not take part in — so, exactly like a contract in
-- slice 3, every row survives with no status test. A draft they never sent is
-- still their own document.
--
-- ✅ THIS ALSO CLOSES THE HALF-WIN SLICE 4 NAMED. `booking_fee_charges` requires
-- `proposal_id` OR `event_vendor_id` to be non-null (`booking_fee_charges_anchor_ck`)
-- and BOTH cascaded. Slice 2 made the `event_vendor_id` anchor survive; this
-- makes the `proposal_id` anchor survive, so a fee raised at the QUOTE stage
-- (`source='send'`) no longer disappears when a couple deletes their event.
-- That was money owed to Setnayan, and the couple is not a party to it.
--
-- 🔑 CHECKED FOR THE SLICE-4 TRAP FIRST, NOT AFTER. Every child FK pointing at
-- `vendor_proposals` is SINGLE-COLUMN (`booking_fee_charges` · `chat_messages` ·
-- `inquiry_outcomes` · `proposal_amendments`), so nothing here spans the column
-- being nulled and no `ON UPDATE` clause is required. That is the check slice 2
-- skipped and slice 4 had to repair.
--
-- ⚠ AND THE ANONYMITY TRAP DOES NOT APPLY EITHER — measured, not assumed. The
-- proposal page renders from `merge_snapshot` / `rendered_body` /
-- `rendered_terms`, which the proposal already carries, and the supplier's list
-- shows only the proposal's own fields. It never displays a client name pulled
-- from the event, so there is nothing to stamp. Do not add a snapshot column
-- here out of symmetry with slice 3.
--
-- Prod: 0 proposals. Nothing is migrated.
-- ═══════════════════════════════════════════════════════════════════════════

-- ⚠ THE OTHER HALF OF THE FEE FIX LIVES IN SLICE 4 (`20271153200818`), WHICH
-- MERGED WHILE THIS WAS IN PROGRESS. Closing the quote-stage fee gap needs BOTH:
-- `booking_fee_charges.event_id` must stop cascading (slice 4, now in main) AND
-- `proposal_id` must survive (below). This migration briefly carried a
-- duplicate, idempotent copy of slice 4's statements so the two PRs could merge
-- in either order without a stacked auto-merge; slice 4 landing first made that
-- unnecessary and it was removed rather than left as a confusing second copy.
-- The tests prove BOTH halves are load-bearing: reverting either one reds the
-- two fee tests.

ALTER TABLE public.vendor_proposals
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_proposals
  DROP CONSTRAINT IF EXISTS vendor_proposals_event_id_fkey;

ALTER TABLE public.vendor_proposals
  ADD CONSTRAINT vendor_proposals_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_proposals.event_id IS
  'The celebration this quote was written for, or NULL once the couple deleted '
  'it (owner 2026-08-21, "vendors get to keep it"). NULL is a real expected '
  'value. The supplier keeps full access — their policies key on '
  '`vendor_profile_id` — while the couple''s read policy keys on event_id, so '
  'an orphaned quote correctly leaves the couple''s view and stays in the '
  'supplier''s. Anything building a URL from this column must handle NULL.';
