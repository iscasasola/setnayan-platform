-- a_guest_says_whether_to_be_tagged
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)



-- ─────────────────────────────────────────────────────────────────────────────
-- "WANT TO BE TAGGED IN THE PHOTOS?" — THE GUEST'S OWN ANSWER.
--
-- ⚖ Owner 2026-09-29, verbatim, about the RSVP's selfie step (it was shown to
-- every attending guest): *"only if the want tagging service. if the do not
-- click tagging service. no selfie needed"* → *"it should only depend if they
-- want to be tagged"*. So the selfie is asked ONLY of a guest who says yes to
-- one plain question first, and a guest who says no is asked nothing more —
-- not on the RSVP, and not again on the day (the day-of catch in the guest
-- camera reads this column and stays silent for a stored `false`).
--
-- 🔑 WHY A NEW COLUMN AND NOT AN EXISTING ONE. Three look close; none holds it:
--   • `face_recognition_excluded` is the HOST's minor safeguard (DPIA BV-8).
--     Writing a guest's "no" there would let a later guest "yes" clear a host's
--     exclusion of a child — two owners, one switch.
--   • `photo_consent` (NOT NULL DEFAULT TRUE) is the story's VETO: false drops
--     the person from shared photos entirely. "Don't ask me for a selfie" is not
--     "remove me from the celebration's pictures".
--   • `guest_face_enrollments` (+ `revoked_at`) records a selfie that WAS given
--     and possibly withdrawn. A guest who said "no thanks" never gave one, so
--     there is no row to mark — and "never asked" must stay distinguishable
--     from "said no", or the day-of catch cannot ask the one who never answered.
--
-- NULL = never answered (the day-of catch asks the one question) · TRUE = yes,
-- tag me (the selfie is offered) · FALSE = no thanks (nothing more is asked).
-- NULLABLE with NO default for exactly that reason: a default would be an
-- answer nobody gave.
--
-- ⚠ IT GOVERNS ONLY WHETHER WE ASK. It is not consent — enrolment still needs
-- the two ticks (biometric consent + 18+) on the selfie itself, and every
-- server-side refusal (host exclusion, known minor) stands unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS face_tagging_wanted boolean;

COMMENT ON COLUMN public.guests.face_tagging_wanted IS
  'The guest''s own answer to "Want to be tagged in the photos?" (owner 2026-09-29). NULL = never answered (the day-of catch asks once) · TRUE = yes (the selfie is offered) · FALSE = no thanks (no selfie is asked for, on the RSVP or on the day). Governs only WHETHER the selfie is asked — it is not biometric consent (the selfie''s own two ticks are) and never overrides face_recognition_excluded (the host''s) or photo_consent (the story veto). Written by submitRsvp and recordFaceTaggingWish, both via the service role.';

-- No GRANT is issued here on purpose: `public.guests` carries TABLE-level
-- grants (see 20271236109974_entourage_order_on_guests.sql), so a new column
-- inherits them and a column-level GRANT would be a no-op that reads like a
-- decision. Row access stays governed by the table's existing RLS policies,
-- and both writers use the service role.
