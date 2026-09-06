-- RV2 · A DISMISSED SUGGESTION STAYS DISMISSED — and it is not part of the room.
--
-- Owner ruling 2026-09-06 (Q9): when a couple has booked a supplier whose trade
-- reaches a reception zone, that zone SUGGESTS the treatment and one click makes
-- it theirs. `events.reception_design` is never written without that click.
-- Waving the offer away is the other half of that: it has to stick, per booking,
-- per zone, per couple, or the room nags forever.
--
-- ── WHY THIS IS A COLUMN AND NOT A KEY INSIDE `reception_design` ────────────
-- 🛑 THE BRIEF ASKED FOR `reception_design.dismissed_suggestions`, AND THAT
-- CANNOT WORK IN THIS CODEBASE. `sanitizeReceptionDesign`
-- (apps/web/lib/reception-scene.ts) is the single trust boundary every writer
-- and every 3D/SVG reader passes through, and it keeps ONLY known
-- part → attribute → valid-option-id triples, dropping everything else. A
-- `dismissed_suggestions` key would therefore be silently deleted on the next
-- save of the design — by `saveReceptionDesign` itself — and the chip would
-- come back. The type says the same thing: `ReceptionDesign` is
-- `Partial<Record<PartId, …>>`, and a key that is not a PartId does not belong
-- in it.
--
-- 🔑 AND A SEPARATE COLUMN MAKES THE RULING STRUCTURAL RATHER THAN CAREFUL.
-- The invariant RV2 exists to hold is "dismissing changes NOTHING about the
-- room". With the list in its own column, dismissing cannot touch
-- `reception_design` — not because the code is disciplined, but because it
-- writes a different column and never calls the design writer at all. Held in
-- the same object, that guarantee would have rested on a diff nobody re-reads.
--
-- ── WHAT IT HOLDS ──────────────────────────────────────────────────────────
-- A JSONB array of `<vendor_id>:<zone>` strings, e.g. `["a1b2…:program"]`.
-- Keyed on the BOOKING (`event_vendors.vendor_id`), never a flag on the booking
-- row: a booking is a fact about a supplier, and "this couple waved that chip
-- away" is a fact about this couple's room. A NEW booking — even of the same
-- trade — has a vendor_id nothing has dismissed, so it gets a fresh chip.
--
-- No FK and no CHECK on the contents on purpose: the keys are display state,
-- an entry naming a removed booking is inert (nothing renders it), and
-- `sanitizeDismissedSuggestions` is the reader's own total, never-throwing
-- boundary — the same contract `sanitizeReceptionDesign` keeps for its column.
--
-- RLS: none is added or needed. `events` already carries its policies, and this
-- column rides on the row's existing host-only write path — the SAME path
-- `reception_design` uses. No new grant, no new policy, no new surface.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dismissed_room_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.dismissed_room_suggestions IS
  'RV2 (owner ruling Q9, 2026-09-06). Reception-designer suggestion chips this '
  'couple has waved away, as a JSONB array of "<event_vendors.vendor_id>:<zone>" '
  'strings. Deliberately NOT a key inside reception_design: sanitizeReceptionDesign '
  'keeps only known part->attribute->option triples and would silently drop it, and '
  'a separate column makes "dismissing never changes the room" structural rather '
  'than a matter of care. Display state only — an entry naming a booking that has '
  'since been removed is inert.';
