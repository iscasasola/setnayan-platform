-- ============================================================================
-- A DELETED WEDDING'S ADDRESS WAS FREE THE SAME SECOND — OWNER RULE 2026-08-12:
-- "a retired website address will only be usable again after 1 year."
--
-- Measured in prod before writing this: `bbgh` — the final address of a wedding
-- that has since been deleted — is claimable RIGHT NOW. Not held, not reserved,
-- not live anywhere. Anyone signing up could take it, and every invitation,
-- save-the-date and QR code carrying it would land a guest on a stranger's page.
--
-- Every OTHER retired address already satisfied the owner's rule:
--   · a renamed wedding / handle → held 24 months (the forwarding window)
--   · a closed shop              → held 12 months (owner-locked 2026-08-10)
--   · a corrected shop address   → held 24 months
-- Deletion was the one hole, and it is the case with the LEAST warning: a
-- rename at least tells the couple what is happening.
--
-- ── WHY A NEW ENTITY TYPE RATHER THAN REUSING 'event' ───────────────────────
-- A rename FORWARDS visitors to where the wedding went. A deletion forwards
-- NOBODY ANYWHERE — there is nothing left to forward to; the row exists only so
-- the word cannot be handed to someone else. Encoding a deletion as a rename
-- would work and would lie, and `resolveRenamedPath` would then try to resolve
-- an event that no longer exists. This mirrors `vendor_closed` exactly, which
-- was created for the same distinction and for the same reason.
--
-- 🔑 The forwarding resolver filters to ('event','vendor','user'), so
-- 'event_closed' is inert there by construction — while `findSlugConflict` and
-- `business_slug_is_available` both match on old_slug + redirect_until with NO
-- entity_type filter, so the hold blocks reuse everywhere a word is handed out.
-- That asymmetry is the whole design: holds nobody, blocks everybody.
-- ============================================================================

BEGIN;

ALTER TABLE public.slug_change_log
  DROP CONSTRAINT IF EXISTS slug_change_log_entity_type_check;

ALTER TABLE public.slug_change_log
  ADD CONSTRAINT slug_change_log_entity_type_check
  CHECK (entity_type IN (
    'event',          -- a wedding renamed; forwards
    'vendor',         -- a shop address corrected; forwards
    'user',           -- a person's handle renamed; forwards
    'vendor_closed',  -- a shop closed; holds the word, forwards nobody
    'event_closed'    -- a wedding deleted; holds the word, forwards nobody
  ));

COMMENT ON COLUMN public.slug_change_log.entity_type IS
  'What retired this address. The three bare types FORWARD (resolveRenamedPath '
  'reads them); the two _closed types hold the word and forward nobody, because '
  'there is nothing left to forward to. Every type blocks reuse until '
  'redirect_until — findSlugConflict and business_slug_is_available match on '
  'old_slug alone, deliberately without an entity_type filter.';

COMMIT;
