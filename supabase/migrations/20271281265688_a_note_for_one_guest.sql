-- a_note_for_one_guest
-- ============================================================================
-- 💌 A NOTE FOR ONE GUEST — WRITTEN BY THE HOSTS, SEEN ONLY BY THAT GUEST
-- (owner 2026-10-20, DECISION_LOG row of the same name):
--   "we can also add a special note for each guests that will be customized
--    aside from their role notes."
-- ============================================================================
-- The guest row already holds TWO notes, and neither is this one:
--   guests.notes       the couple's PRIVATE note about the guest — never shown
--                      to the guest (20271114372958 split it from the next one)
--   guests.guest_note  the GUEST's own message to the couple (their RSVP box)
-- This is the third, and its direction is the one nobody had: from the hosts,
-- to this one guest. It is shown on that guest's own Me page (their pass or
-- their account), under Your role — never on the public page, a print, an OG
-- image, the Excel export or any other guest's view.
--
-- 🔒 WHO CAN READ IT, measured on prod (read-only) 2026-10-20 before writing:
--   · `guests` carries the table-level grant (anon + authenticated SIUD), so
--     this column inherits it — the same exposure as `notes` and `guest_note`.
--   · anon has NO policy on `guests` → zero rows.
--   · authenticated reads a row only through `event_member_can_read_guest` /
--     `guests_moderator_read` (the couple and their guest-list helpers — the
--     people who write it) or `guest_reads_own_row` (this guest themself — the
--     person it is FOR). No policy lets one guest read another guest's row.
--   · no view selects from `guests`; no function returns its row type.
--   · writes: `couple_writes_guest` / `guests_moderator_write` only — a guest
--     has no UPDATE policy, so they cannot change what the hosts wrote.
-- So the row-level rules already draw exactly the audience the ruling names;
-- no column grant is re-cut. The exposure baseline gains one accepted line.
--
-- Plain text, one per guest (a +1 has their own row, so their own note),
-- 500 characters at most (the controller's call, logged on the same row).
-- No backfill: nothing has ever been written in this direction.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS; the CHECK is dropped and re-added.

BEGIN;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS host_note_for_guest TEXT;

ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_host_note_for_guest_length;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_host_note_for_guest_length
  CHECK (host_note_for_guest IS NULL OR char_length(host_note_for_guest) <= 500);

COMMENT ON COLUMN public.guests.host_note_for_guest IS
  'The HOSTS'' note TO this one guest (owner 2026-10-20). Shown only on that '
  'guest''s own Me page, under Your role. Never on the public page, prints, '
  'OG images, exports or any other guest''s view. Not `notes` (the couple''s '
  'private note, never shown to the guest) and not `guest_note` (the guest''s '
  'own message to the couple).';

COMMIT;
