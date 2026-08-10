-- ⚠ PRESERVATION IS OPT-IN. THE DEFAULT IS NOW **NOTHING**.
--
-- Owner, 2026-08-10: "then start with nothing. they will pick which they want
-- to preserve."
--
-- This REVERSES the rule migration 20271125158531 was built on ("if nothing is
-- picked, pick all") and inverts the column that encoded it. The reversal is
-- correct, and it follows from the pricing decision made the same day:
-- preservation costs ₱500/year per 5,000 Papic credits' worth, and YOU DO NOT
-- AUTO-ENROL SOMEBODY INTO A BILL. Keeping-everything-by-default meant a couple
-- who never opened the picker was silently holding a paid selection they had
-- never made.
--
-- 🔑 THE COLUMN IS REPLACED, NOT REINTERPRETED. `preserve_declined_at` means
-- "the couple took this OUT of preservation"; under opt-in the stored fact is
-- the opposite — "the couple PUT this in". Keeping the old name and flipping its
-- meaning would leave every reader, every query result and every audit line
-- saying the reverse of the truth. When a stored value's NAME is what misleads,
-- rename the value.
--
-- ✅ SAFE TO DROP. Measured in production immediately before writing this:
-- papic_photos 14 rows / 0 with `preserve_declined_at` set; papic_guest_captures
-- 0 rows. Nobody has ever declined, so nothing is lost and no back-fill is owed.
-- (Were that not true, this would have to be a back-fill, not a drop.)
--
-- ⚠ WHAT THIS CHANGES FOR A COUPLE WHO DOES NOTHING. Their originals are still
-- kept until the locked floor — 6 months from first capture, never less than
-- 3 months after the event ends — and then replaced by the compressed copy.
-- NOTHING IS DELETED; the compressed copy is kept for five years for everyone,
-- paid or not. Say "compressed", never "deleted": the owner has corrected that
-- vocabulary twice.
--
-- 🪤 AND PICKING IS STILL IRREVERSIBLE IN ONE DIRECTION. Once the sweep has
-- replaced an original, adding that capture to preservation later cannot bring
-- the resolution back — the file is gone. The surface that writes this column
-- must say so plainly rather than imply an undo that cannot exist.

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS preserved_at timestamptz;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS preserved_at timestamptz;

COMMENT ON COLUMN public.papic_photos.preserved_at IS
  'Set when the couple CHOSE to keep this capture at full resolution (opt-in, owner 2026-08-10). NULL = not preserved, which is the default. Never a delete flag: the compressed copy is kept for everyone regardless.';

COMMENT ON COLUMN public.papic_guest_captures.preserved_at IS
  'Set when the couple CHOSE to keep this capture at full resolution (opt-in, owner 2026-08-10). NULL = not preserved, which is the default. Never a delete flag: the compressed copy is kept for everyone regardless.';

-- Partial indexes on the PICKED rows — the sweep asks "which of this event's
-- captures were chosen", and under opt-in the chosen set is the small one.
CREATE INDEX IF NOT EXISTS papic_photos_preserved_idx
  ON public.papic_photos (event_id)
  WHERE preserved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS papic_guest_captures_preserved_idx
  ON public.papic_guest_captures (event_id)
  WHERE preserved_at IS NOT NULL;

-- The opt-out column goes. Verified empty in production before writing this, so
-- there is no state to carry across; leaving it would guarantee that some later
-- reader consults a column that no longer decides anything.
DROP INDEX IF EXISTS public.papic_photos_preserve_declined_idx;
DROP INDEX IF EXISTS public.papic_guest_captures_preserve_declined_idx;

ALTER TABLE public.papic_photos DROP COLUMN IF EXISTS preserve_declined_at;
ALTER TABLE public.papic_guest_captures DROP COLUMN IF EXISTS preserve_declined_at;
