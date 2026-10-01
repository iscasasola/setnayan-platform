-- walking_pair_is_a_couple
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (ADD COLUMN IF NOT EXISTS + guarded FK).
--
-- ⚖ OWNER 2026-09-30 (DECISION_LOG "WALKING TOGETHER IS NOT BEING A COUPLE"):
-- *"sometimes the principal sponsor are not couples. Or the entourage are also
-- not couples."* Walking beside someone in the Wedding March
-- (`pair_with_guest_id`) says NOTHING about a relationship. The couple-style
-- short line ("Hon. Ricardo & Mrs. Jessica Villahermosa") is printed ONLY for a
-- real couple: one is the other's +1, or the hosts ticked "They're a couple"
-- on that pair in the Maker's Wedding March. A shared surname alone never
-- shortens.
--
-- ── WHY A PARTNER ID AND NOT A BOOLEAN ────────────────────────────────────
-- A boolean "this pair is a couple" goes STALE the moment the pair changes:
-- `swap_entourage_places` re-points four `pair_with_guest_id`s in one statement
-- and would carry a ticked flag onto a stranger, so every pair writer (three
-- SQL functions) would have to learn to clear it. A pointer at the PERSON
-- cannot go stale that way: being a couple is a fact about two people, read as
-- MUTUAL (A → B and B → A) and only while they also walk together. Re-pair
-- them with somebody else and the short line simply stops; put them back
-- together and it returns — no writer has to remember anything.
--
-- Written ONLY by `setWalkingPairCouple` (pair-actions.ts), which writes both
-- halves in ONE statement. Read by `lib/entourage.ts` `isCouple`.
--
-- ⚠ FK is single-column ON DELETE SET NULL, exactly like `pair_with_guest_id`
-- (see 20271226099791_guest_pairing.sql for why a composite FK would turn the
-- SET NULL into a refused delete). No CHECK on this column, so SET NULL can
-- never be refused.
--
-- 🔒 GRANTS: `public.guests` holds TABLE-LEVEL grants, so this column inherits
-- the same SIU exposure as its sibling `pair_with_guest_id` and reveals nothing
-- a row's RLS-admitted reader cannot already see (who is paired with whom).
-- RLS on guests is unchanged (Pattern B). Accepted in the exposure baseline.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS couple_with_guest_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_couple_with_guest_id_fkey' AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_couple_with_guest_id_fkey
      FOREIGN KEY (couple_with_guest_id) REFERENCES public.guests(guest_id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.guests.couple_with_guest_id IS
  'The guest this one is a COUPLE with, as ticked in the Wedding March ("They''re a couple"). '
  'Read as MUTUAL and only while the two also walk together (pair_with_guest_id). '
  'Walking together alone never makes a couple; a shared surname never does. NULL = not ticked.';
