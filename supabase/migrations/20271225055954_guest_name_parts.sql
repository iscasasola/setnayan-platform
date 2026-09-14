-- guest_name_parts
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- WHY. `guests` has only `first_name` / `last_name`, and every write path split
-- a typed line with `words[0] = first, rest = last`. On a Philippine legal
-- roster that stores the HONORIFIC as the given name. Measured on prod
-- 2026-09-14: 30 of 100 guests carried a bare title ("Mr.", "Atty.", "Judge")
-- in `first_name`, and multi-word titles were torn in half — "Associate Dean
-- Cecilio Duka" was stored as first="Associate", last="Dean Cecilio Duka".
--
-- This adds the three parts that had nowhere to live. `lib/person-name-parse.ts`
-- is the single parser that fills them, on all five write paths.
--
-- DELIBERATELY NOT NULL-FREE: these three are NULLABLE with no default. An
-- absent title is genuinely absent — defaulting them to '' would make "never
-- set" and "explicitly cleared" indistinguishable, and the backfill below has
-- to be able to tell those apart to stay re-runnable.
--
-- NO BACKFILL HERE. The 40 rows this parser would rewrite are live guests on a
-- real event; they are reviewed and applied as a separate, owner-approved step
-- rather than silently inside a schema migration. See the PR body.
--
-- GRANTS: `guests` is granted at TABLE level to anon/authenticated/service_role
-- (verified against prod 2026-09-14), so these columns inherit exactly the
-- exposure `first_name`/`last_name` already carry — no new surface, and a
-- column-level REVOKE against a table grant would be a silent no-op anyway.
-- RLS is unchanged and remains the row-level control.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS name_prefix TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix TEXT;

COMMENT ON COLUMN public.guests.name_prefix IS
  'Honorific(s) preceding the name — "Atty.", "Associate Dean", "ED Atty.". '
  'Filled by lib/person-name-parse.ts. NULL when the guest has none.';
COMMENT ON COLUMN public.guests.middle_name IS
  'Name between first and last, usually an initial ("M."). NULL when absent. '
  'Never holds a surname particle — "dela Pena" belongs to last_name.';
COMMENT ON COLUMN public.guests.name_suffix IS
  'Generational or post-nominal — "Jr.", "III", "CPA". NULL when absent. '
  'A LEADING "Sr." is Sister/Senor and lands in name_prefix instead.';

-- Length parity with the existing name fields (MAX_GUEST_NAME_LEN = 80 in
-- lib/guest-name.ts), so a pasted blob cannot blow out seating cards, QR
-- labels or the print pack through the new columns either. Added NOT VALID
-- then validated, so the ALTER takes no long table lock on a growing roster.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_name_parts_len_chk'
      AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_name_parts_len_chk CHECK (
        COALESCE(length(name_prefix), 0) <= 80
        AND COALESCE(length(middle_name), 0) <= 80
        AND COALESCE(length(name_suffix), 0) <= 80
      ) NOT VALID;
    ALTER TABLE public.guests VALIDATE CONSTRAINT guests_name_parts_len_chk;
  END IF;
END $$;
