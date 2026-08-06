-- guest_note_is_not_the_couples_private_note
-- ============================================================================
-- 🔴 PRIVACY: the couple's PRIVATE note about a guest was shown TO that guest,
-- and the guest's reply ERASED it.
-- ============================================================================
-- `guests.notes` was one column serving two contradictory purposes:
--
--   couple's screen  (dashboard/[eventId]/guests/[guestId])  label: "Notes (private)"
--   guest's screen   ([slug] rsvp-widget)                    label: "A note to the couple"
--
-- Both rendered `defaultValue={guest.notes}` and both wrote back to `notes`.
-- So whatever a couple wrote about a guest — "ex-girlfriend, seat far from
-- Tita", "still owes us money", "do not seat near the bar" — appeared in that
-- guest's own textarea on their invitation page, pre-filled, as though they had
-- drafted it. And the moment they submitted their RSVP it was overwritten.
--
-- Guests imported from a spreadsheet hit the same edge from the other side:
-- the importer writes "Household: <name>" into `notes`, so an imported guest
-- opens their invitation and finds that already typed into their reply box.
--
-- THE FIX IS A SECOND COLUMN, not a relabelling. One field cannot be both
-- private-to-the-couple and authored-by-the-guest; that is the defect itself.
--   guests.notes       -> stays COUPLE-PRIVATE. Never rendered to a guest again.
--   guests.guest_note  -> NEW. The guest's own message to the couple.
--
-- NO BACKFILL, and that is verified rather than assumed: queried prod
-- 2026-08-06 — 35 live guests, 28 of whom have RSVP'd, and **0 rows have a
-- non-empty `notes`**. There is no existing text whose authorship would have to
-- be guessed. Had there been, splitting would have needed a human decision per
-- row, because the column cannot tell you who wrote it.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS guest_note TEXT;

COMMENT ON COLUMN public.guests.guest_note IS
  'The GUEST''s own optional message to the couple, written on their invitation '
  'page. Added 2026-08-06 to split apart from guests.notes, which is the '
  'COUPLE''s private note ABOUT the guest and must never be rendered on a '
  'guest-facing surface. If you are about to show a note to a guest, it is this '
  'column — never `notes`.';

COMMENT ON COLUMN public.guests.notes IS
  'COUPLE-PRIVATE note about this guest. NEVER render on a guest-facing surface '
  'and never accept a write from one — until 2026-08-06 this column was both '
  'shown to and overwritten by the guest via the RSVP form. The guest''s own '
  'message is `guest_note`.';

COMMIT;
