-- ═══════════════════════════════════════════════════════════════════════════
-- A REVIEW KEEPS ITS RECEIPT WHEN THE CELEBRATION GOES
--
-- Slice 1 (20271153093180) made a review OUTLIVE its event. Measured in
-- production 2026-08-24 in a rolled-back transaction, it also SILENTLY STRIPPED
-- THE REVIEW'S RECEIPT in the very same statement:
--
--     booked_through_setnayan:  at-insert = TRUE  →  after-event-delete = FALSE
--
-- 🔑 THE FK'S OWN `ON DELETE SET NULL` IS AN UPDATE, AND AN UPDATE FIRES YOUR
-- TRIGGERS. `vendor_reviews_stamp_provenance` is BEFORE INSERT **OR UPDATE**,
-- so when the FK nulls `event_id`, the trigger re-derives provenance from an
-- event that no longer exists. `review_is_booked_through_setnayan(NULL, …)`
-- asks `WHERE ev.event_id = NULL`, which matches nothing, so a genuine
-- Setnayan booking is re-labelled "not booked through Setnayan".
--
-- ⚠ THE ROW SURVIVED AND THE RECORD DID NOT. `vendor_trusted_review_stats`
-- filters `booked_through_setnayan = true`, and the public review card renders
-- the "Verified booking" pill off the same column — so the supplier kept a row
-- nobody counts and nobody trusts. That is worse than the cascade it replaced:
-- a review that says it was NOT a real booking is a claim, not an absence.
--
-- THE FIX IS THE ONE THE CLASSIFICATION PRESCRIBED AND NOBODY BUILT
-- (VENDOR_DATA_SURVIVES_DELETION_2026-08-21.md, `vendor_reviews.
-- booked_through_setnayan / via_vendor_import`): an orphaned review's receipt
-- is FROZEN at what it was proven to be, never re-derived from an absence.
--
-- 🔒 IT IS A NARROWING, NOT A NEW CAPABILITY. Every review whose event still
-- exists is stamped exactly as before, byte for byte. The guard can only be
-- reached by a row whose event is already gone — and for such a row there is
-- no honest answer to re-derive, only a wrong one.
--
-- ⚠ IT ALSO CLOSES A SECOND DOOR ONTO THE SAME COLUMN. `vendor_reviews_vendor_
-- reply` lets the SUPPLIER update the review to add their reply, and (unlike
-- the couple's policy) carries no `event_id IS NOT NULL` clause. Without this
-- guard a supplier replying to their own preserved review would re-run the
-- same false derivation. Measured: with the guard, insert → delete → reply all
-- read TRUE.
--
-- Latent, not live: prod holds 0 reviews, so nothing is migrated or backfilled.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.stamp_review_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- ── THE ORPHAN'S RECEIPT IS FROZEN, NEVER RE-DERIVED ─────────────────────
  -- Reached only when the celebration is already gone. `event_id` is nullable
  -- solely because slice 1 made it so, and the only thing that nulls it is the
  -- FK firing on the event's deletion (the couple's UPDATE policy requires
  -- `event_id IS NOT NULL`, so a couple cannot orphan a review by hand).
  IF NEW.event_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.booked_through_setnayan :=
    public.review_is_booked_through_setnayan(NEW.event_id, NEW.vendor_profile_id);
  NEW.via_vendor_import :=
    public.review_via_vendor_import(NEW.event_id, NEW.vendor_profile_id);
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.stamp_review_provenance() IS
  'Stamps a review''s provenance from its event. Returns EARLY and unchanged '
  'when event_id IS NULL: an orphaned review (slice 1, 20271153093180) keeps '
  'the receipt it was proven to have. Re-deriving from a deleted event answers '
  'FALSE for every genuine booking — measured in prod 2026-08-24.';
