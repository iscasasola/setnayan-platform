-- ============================================================================
-- 20271120090000_vendor_venue_dimensions.sql
--
-- A venue can state its own size, so a couple stops guessing at a room they
-- have already booked.
--
-- Owner, 2026-08-07: "allowing vendors to set the sizes of their venues so
-- customers can fillup the space."
--
-- WHAT A COUPLE DOES TODAY. They open their seating plan and pick a room from
-- six generic presets — Intimate 14×10 · Standard 20×30 · Grand 30×20 · Garden
-- 60×40 · Estate 120×90 · Field 200×200 — defaulting to Standard. They have
-- already booked a real venue with real walls. Every table they place, every
-- aisle they leave, and the whole 3D walk-through their guests explore is built
-- on that guess.
--
-- `event_floor_plan.venue_width_m` / `venue_length_m` already exist and already
-- drive both the editor and `public_venue_scene`. The only missing piece is a
-- venue ever being asked.
--
-- ── NULLABLE ON PURPOSE ─────────────────────────────────────────────────────
-- Most vendors are not venues. A florist has no room size, and a NOT NULL
-- column with a default would put a fictional room on every shop in the
-- marketplace.
--
-- ── WHY THE CHECK IS PAIRWISE ───────────────────────────────────────────────
-- Both present or both absent. A one-sided pair (a width with no length) is a
-- half-answer the couple-side seeding cannot use, and it would arrive silently:
-- the seeding would either skip a venue that believes it answered, or invent
-- the missing side. The 500 m ceiling mirrors `parseDim` in the seating action,
-- which already clamps the couple's own input to 500 — the two ends of the same
-- number must not disagree about what is sane.
--
-- ⚠ `vendor_profiles.capacity_min` / `capacity_max` already exist and have NO
-- WRITER anywhere in the app. They are picked up by the same form in the same
-- change — same audience, same screen — rather than left as one more setting
-- nobody can reach.
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS venue_width_m  numeric,
  ADD COLUMN IF NOT EXISTS venue_length_m numeric;

COMMENT ON COLUMN public.vendor_profiles.venue_width_m IS
  'Venue room width in metres, set by the vendor. Seeds event_floor_plan.venue_width_m '
  'for a couple who books this venue and has not sized their own room yet. NULL for '
  'every vendor that is not a venue. Rectangle-only, matching the seating editor.';
COMMENT ON COLUMN public.vendor_profiles.venue_length_m IS
  'Venue room length in metres — see venue_width_m. Both or neither.';

ALTER TABLE public.vendor_profiles
  DROP CONSTRAINT IF EXISTS vendor_profiles_venue_dimensions_check;

ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_venue_dimensions_check
  CHECK (
    (venue_width_m IS NULL AND venue_length_m IS NULL)
    OR (
      venue_width_m IS NOT NULL AND venue_length_m IS NOT NULL
      AND venue_width_m  > 0 AND venue_width_m  <= 500
      AND venue_length_m > 0 AND venue_length_m <= 500
    )
  );

-- ── COLUMN PRIVILEGES ───────────────────────────────────────────────────────
-- A new column on a `public` table ships OPEN unless privileges are stated —
-- the standing rule from the default-ACL work. These are vendor-owned profile
-- fields written through the vendor's own authenticated session (the inline
-- profile editor), so they get the same UPDATE grant the rest of the editable
-- profile columns carry. Row-level policy still decides WHICH row.
GRANT UPDATE (venue_width_m, venue_length_m) ON public.vendor_profiles TO authenticated;

-- ── POST-CONDITIONS ─────────────────────────────────────────────────────────
-- Asserted against the catalog, never against this file. A migration that
-- silently did not apply looks exactly like one that did, until a vendor saves.
--
-- ⚠ These assert the constraint's SHAPE rather than firing a probe INSERT.
-- `vendor_profiles` has other NOT NULL columns, so a probe row would trip one
-- of those first and the exception handler would swallow it — proving nothing
-- while looking rigorous. Checking the definition is the honest check available
-- here; a true rejection test belongs in the db-test layer with a real row.
DO $postcondition$
DECLARE
  v_def TEXT;
  v_cols INT;
BEGIN
  SELECT count(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='vendor_profiles'
    AND column_name IN ('venue_width_m','venue_length_m');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION 'expected both venue dimension columns, found %', v_cols;
  END IF;

  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid='public.vendor_profiles'::regclass
    AND c.conname='vendor_profiles_venue_dimensions_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'the pairwise CHECK did not land — a one-sided pair could be saved';
  END IF;
  -- Both halves of "both or neither" must be in it. A CHECK that only bounds
  -- the numbers would accept a width with no length.
  IF position('IS NULL' IN v_def) = 0 OR position('IS NOT NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the CHECK lost its both-or-neither half: %', v_def;
  END IF;
  IF position('500' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the CHECK lost its upper bound, which the couple-side input still clamps to';
  END IF;
END
$postcondition$;

COMMIT;
