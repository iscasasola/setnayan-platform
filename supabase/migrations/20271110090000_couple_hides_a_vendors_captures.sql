-- Let a couple take ONE supplier's photos out of their own gallery.
--
-- ── WHAT THIS FIXES ─────────────────────────────────────────────────────────
-- Everything a booked supplier shoots on the day lands in the couple's gallery.
-- Until now the couple's only levers were the platform-wide privacy control
-- (which is not theirs, and is all-or-nothing across every event on Setnayan)
-- and hiding photos ONE AT A TIME. A couple who did not want their caterer's
-- shots mixed into their wedding album was facing two hundred individual taps.
--
-- This is the missing middle: "not this supplier", said once.
--
-- ── WHY A COLUMN ON event_vendors, NOT A NEW TABLE ──────────────────────────
-- `event_vendors` is already the couple's own row about one supplier at one
-- event, and `event_vendors_couple_write` already grants them FOR ALL on it. So
-- the couple can set this with their OWN client — no service-role write, no new
-- policy, and it disappears with the booking if they remove the vendor.
--
-- ── IT ONLY EVER REMOVES ────────────────────────────────────────────────────
-- Default FALSE = nothing changes for anyone. Setting it TRUE only ever takes
-- photos OUT of a view. It cannot expose anything, which is why it needs no
-- consent step of its own.
--
-- ⚠ THE PHOTOS ARE NOT DELETED, and this column must never be read as if they
-- were. The supplier keeps their own copies (that is the whole point of their
-- documentation shots) and the rows stay for the retention clock. This hides
-- them from the couple's gallery, nothing more. A future "delete the supplier's
-- captures" feature is a DIFFERENT thing and must not reuse this flag.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS papic_captures_hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.event_vendors.papic_captures_hidden IS
  'The couple has taken this supplier''s Papic captures out of their gallery. '
  'HIDES ONLY — the captures still exist, the supplier keeps their own view, '
  'and nothing is deleted. Written by the couple through their own client '
  '(event_vendors_couple_write). Read in lib/papic-gallery.ts. '
  'Added 2026-08-05: the couple previously had no lever between the '
  'platform-wide control and hiding photos one at a time.';
