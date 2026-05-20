-- Iteration 0048 — V1 multi-host invite flow.
-- Promoted from V1.2 to V1 2026-05-20 per owner directive (CLAUDE.md decision log).
--
-- The 2026-05-19 foundation migration created event_moderators with
-- accepted_at NOT NULL DEFAULT NOW() because the only insert path then was
-- the backfill (all rows pre-accepted). Shipping the invite + accept UI
-- means we now have a "pending" state where the moderator row exists but
-- (a) the user hasn't signed up/in yet, and (b) hasn't clicked accept.
--
-- This migration relaxes two columns + adds an invitation token:
--
--   user_id              — relaxed to NULL so pending invites can sit with
--                          only email/phone resolved; UPDATE-fills on accept.
--   accepted_at          — relaxed to NULL; NULL = pending, non-NULL = accepted.
--   invitation_token     — opaque secret in the accept URL; rotated on accept.
--
-- State derivation (no enum column, just predicates):
--   pending  → invitation_token IS NOT NULL AND accepted_at IS NULL AND removed_at IS NULL
--   accepted → accepted_at IS NOT NULL AND removed_at IS NULL
--   expired  → invitation_expires_at < NOW() AND accepted_at IS NULL
--   revoked  → removed_at IS NOT NULL
--
-- Backwards compatibility:
--   The existing UNIQUE (event_id, user_id) constraint allows multiple
--   NULL user_id rows per event in Postgres (NULLs are distinct under
--   UNIQUE), so pending invites can stack without collision until accept.
--   Existing backfilled rows have NOT NULL user_id and accepted_at intact;
--   only the column-level constraint is relaxed, no row mutations.
--
-- Backwards-compatible idempotent. ALTER ... DROP NOT NULL is a no-op when
-- already nullable; IF NOT EXISTS guards the new column.

ALTER TABLE public.event_moderators
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN accepted_at DROP NOT NULL;

ALTER TABLE public.event_moderators
  ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;

COMMENT ON COLUMN public.event_moderators.invitation_token IS
  'Iteration 0048 (2026-05-20 V1 promotion): opaque secret in the accept URL /host/accept/[token]. NULL once accepted (rotated on accept). Set at invite-create time, cleared on accept.';

COMMENT ON COLUMN public.event_moderators.user_id IS
  'auth.users.id of the host. NULL while invitation is pending (the invitee has not yet signed up + accepted). Populated on accept.';

COMMENT ON COLUMN public.event_moderators.accepted_at IS
  'Timestamp the invitee clicked Accept. NULL while pending. Backfilled couple rows (PR #135) are pre-accepted with this stamped at backfill time.';

-- Index to make accept-by-token lookups O(1) without scanning the table.
CREATE INDEX IF NOT EXISTS event_moderators_invitation_token_idx
  ON public.event_moderators (invitation_token)
  WHERE invitation_token IS NOT NULL;
