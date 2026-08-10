-- preserve_picks — WHICH captures keep their full resolution.
--
-- 🔒 OWNER-LOCKED 2026-08-10. ₱500/year preserves 5,000 Papic points of
-- ORIGINALS (1 photo = 1 pt · 1 ten-second clip = 8 pts). The couple PICKS which
-- captures those are — "they can pick which one to preserve" — and **if nothing
-- is picked, everything is picked**: paying protects you from the moment you
-- pay, not from the moment you remember to tick boxes.
--
-- ## Why this column records the DECLINE, not the pick
--
-- `preserve_declined_at` is the odd one out on purpose: it records that the
-- couple took a capture OUT of preservation, not that they put one in.
--
-- The obvious design — a `preserved_at` opt-in — cannot express "pick all by
-- default" without a backfill, and that backfill would have to re-run for every
-- capture taken afterwards, forever. Storing the DECLINE inverts it: absent
-- means preserved, which is exactly the owner's rule, needs no backfill, and is
-- automatically right for captures that do not exist yet.
--
-- ⚠ IT IS NOT A DELETE FLAG AND MUST NEVER BE READ AS ONE. Declining only lets
-- the normal sweep replace that original with its compressed copy at the point
-- already locked (6 months from first capture, floored at 3 months after the
-- event). The photo itself is never deleted — the compressed copy is kept for
-- five years for everyone, paid or not. Say "compressed", not "deleted": the
-- owner has corrected that vocabulary twice.
--
-- 🪤 AND DECLINING IS IRREVERSIBLE ONCE THE SWEEP HAS RUN. Re-including a
-- capture after its original has been replaced cannot bring the resolution back,
-- because the file is gone. This is the one place in the product where a couple
-- can quietly destroy something by changing their mind, so the surface that
-- writes this column must say so plainly rather than imply an undo that cannot
-- exist.

ALTER TABLE public.papic_photos
  ADD COLUMN IF NOT EXISTS preserve_declined_at timestamptz;

ALTER TABLE public.papic_guest_captures
  ADD COLUMN IF NOT EXISTS preserve_declined_at timestamptz;

COMMENT ON COLUMN public.papic_photos.preserve_declined_at IS
  'Set when the couple removed this capture from full-resolution preservation. NULL = preserved (the default — "if nothing is picked, pick all"). Never a delete flag: the compressed copy is kept for everyone regardless.';

COMMENT ON COLUMN public.papic_guest_captures.preserve_declined_at IS
  'Set when the couple removed this capture from full-resolution preservation. NULL = preserved (the default — "if nothing is picked, pick all"). Never a delete flag: the compressed copy is kept for everyone regardless.';

-- The sweep asks "which captures on this event may I replace?", so the useful
-- index is the DECLINED ones per event. Partial: the overwhelming majority of
-- rows are NULL (preserved) and do not belong in it.
CREATE INDEX IF NOT EXISTS papic_photos_preserve_declined_idx
  ON public.papic_photos (event_id)
  WHERE preserve_declined_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS papic_guest_captures_preserve_declined_idx
  ON public.papic_guest_captures (event_id)
  WHERE preserve_declined_at IS NOT NULL;

-- No RLS change. Both tables already carry their policies, and this column is
-- read and written through the same event-scoped paths as every other column on
-- them — a new column on an existing table inherits that table's policies, so a
-- policy here would be a second, divergent rule rather than a protection.
