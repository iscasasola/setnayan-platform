-- ═══════════════════════════════════════════════════════════════════════════
-- SETNAYAN'S OWN RECORD OF A MODERATION DECISION OUTLIVES THE EVENT
--
-- Applying the owner's STANDING rule (2026-08-21) rather than asking again:
-- *"did the supplier take part in it?"* A self-review appeal is a supplier
-- formally contesting a block on their own reputation, and OUR answer to it.
-- Both parties took part; the couple did not, and cannot see it.
--
-- 🚨 TODAY A COUPLE CAN ERASE OUR AUDIT TRAIL OF OUR OWN DECISION as a side
-- effect of tidying their events — including a DECIDED appeal carrying
-- `decided_by_admin`, `decision` and `decision_reason`. That is not the couple's
-- record in any sense: they are not a party to it and no couple-facing surface
-- reads it.
--
-- ✅ AND THE READER ALREADY SURVIVES, which is why this is one line and not a
-- feature. `/admin/reviews` selects appeals with NO event filter at all — an
-- orphaned appeal stays in the moderation queue exactly where it was. Checked
-- before writing this, because a preserved row nobody can reach is the shape
-- this repo has found five times, and TWO of its neighbours in this same sweep
-- have it: `event_vendor_policy_acknowledgements` is read only by `event_id`,
-- and `vendor_payday_installments` INNER JOINs `events`. Neither is included
-- here for that reason — each needs a reader change to mean anything, and that
-- is its own piece of work, not a line in this one.
--
-- 🔑 `reviewer_user_id` STILL CASCADES FROM `users`, DELIBERATELY UNTOUCHED. An
-- appeal is evidence ABOUT a person's account; when the account itself is erased
-- under RA 10173 the evidence goes with it. This migration is about the EVENT,
-- and widening it to the person would quietly reverse an erasure guarantee.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_review_appeals
  ALTER COLUMN event_id DROP NOT NULL;

ALTER TABLE public.vendor_review_appeals
  DROP CONSTRAINT IF EXISTS vendor_review_appeals_event_id_fkey;

ALTER TABLE public.vendor_review_appeals
  ADD CONSTRAINT vendor_review_appeals_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(event_id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.vendor_review_appeals.event_id IS
  'The celebration the contested review was about. NULL once the couple deleted '
  'it — the appeal and our decision on it survive, because they are the '
  'supplier''s and ours (owner rule 2026-08-21: did the supplier take part in '
  'it). `/admin/reviews` applies no event filter, so an orphan stays in the '
  'queue. ⚠ `overridePublishReview` inserts a review using this value; '
  'vendor_reviews.event_id has been nullable since 20271153093180, so an '
  'override on an orphaned appeal mints an orphaned review — which is coherent.';
