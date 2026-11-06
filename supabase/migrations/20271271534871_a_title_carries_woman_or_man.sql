-- a_title_carries_woman_or_man
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (ADD COLUMN IF NOT EXISTS · guarded CHECK ·
-- CREATE OR REPLACE · DROP TRIGGER IF EXISTS · a backfill that touches only NULLs).
--
-- ⚖ OWNER 2026-10-17, verbatim: *"Find a different approach on how to fix this
-- issue on prefixes which are neutral gender"* → *"or let them choose Atty
-- (Female) or Atty (Male). something like this"* → *"so no need to choose"*.
-- The TITLE PICK carries the gender: the guest card's Title dropdown offers
-- "Atty. (Woman)" · "Atty. (Man)", and the pick writes TWO columns —
-- `name_prefix` (the title that prints: "Atty.") and this one. Guests and every
-- printed or public surface show only the title; "(Woman)" never prints.
--
-- WHY A COLUMN: on cale-ice, a parent titled "Atty." printed "Parent of the
-- Groom" beside "Mr. … — Father of the Groom" — nothing the couple had entered
-- said which. `guests.attire` (Gown/Suit) is CLOTHING for the 3D seat plan, not
-- a gender. The one resolver (`lib/entourage.ts` `parentWordOf`) now reads
-- this column FIRST.
--
-- ⚠ NO GUESSING. The backfill maps ONLY the four titles that already say it —
-- Mr. → man · Ms. / Mrs. / Miss → woman. A neutral title (Atty., Dr., Hon. …),
-- a typed one ("Regional Prosecutor") and a missing one all stay NULL: the
-- couple re-picks the title from the same dropdown. Never a first name.
-- `apps/web/lib/guest-title.ts` `GENDERED_TITLES` is the same four;
-- `the-title-carries-woman-or-man.test.ts` holds the two lists equal.
--
-- 🔁 THE TITLE WINS WHEN IT SAYS IT (trigger below). Every writer of
-- `name_prefix` — the card, /guests/new, quick add, the bulk paste, the import,
-- the join request, a plus-one's own door — gets the gender of a "Mr." or a
-- "Mrs." for free, with no code of its own. A title that says nothing leaves
-- whatever gender the row already had: changing "Mrs." to "Atty." does not
-- forget she is a woman.
--
-- 🔒 GRANTS: measured on prod 2026-10-17 — `public.guests` holds TABLE-level
-- SELECT/INSERT/UPDATE for anon, authenticated and service_role
-- (`has_table_privilege` true for all nine), so this column inherits exactly
-- what its sibling `name_prefix` has. Restated explicitly below and PROVEN by
-- the post-condition (column privilege == name_prefix's, every role and
-- privilege), so a later narrowing of the table cannot strand it unread.
-- RLS on guests is unchanged (the same policies that admit name_prefix).

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_gender_chk' AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_gender_chk CHECK (gender IS NULL OR gender IN ('woman', 'man'));
  END IF;
END $$;

COMMENT ON COLUMN public.guests.gender IS
  'Woman or man, as picked WITH the title on the guest card ("Atty. (Woman)"). '
  'Decides Mother/Father, Grandmother/Grandfather, a legacy principal sponsor''s Ninong/Ninang column '
  'and the seat-plan figure. Never printed. NULL = not said (a neutral or missing title). '
  'Mr. → man and Ms./Mrs./Miss → woman are kept by guests_title_says_gender_trg.';

-- ── The title wins when it says it ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guests_title_says_gender()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  said text;
BEGIN
  said := CASE lower(rtrim(btrim(coalesce(NEW.name_prefix, '')), '.'))
    WHEN 'mr'   THEN 'man'
    WHEN 'ms'   THEN 'woman'
    WHEN 'mrs'  THEN 'woman'
    WHEN 'miss' THEN 'woman'
    ELSE NULL
  END;
  IF said IS NOT NULL THEN
    NEW.gender := said;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guests_title_says_gender_trg ON public.guests;
CREATE TRIGGER guests_title_says_gender_trg
  BEFORE INSERT OR UPDATE OF name_prefix, gender ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.guests_title_says_gender();

-- A trigger function is not an API: nobody calls it directly.
REVOKE ALL ON FUNCTION public.guests_title_says_gender() FROM PUBLIC, anon, authenticated;

-- ── Backfill: ONLY the four titles that already say it ─────────────────────
UPDATE public.guests
   SET gender = CASE lower(rtrim(btrim(name_prefix), '.'))
                  WHEN 'mr' THEN 'man'
                  ELSE 'woman'
                END
 WHERE gender IS NULL
   AND lower(rtrim(btrim(name_prefix), '.')) IN ('mr', 'ms', 'mrs', 'miss');

-- ── Grants: the same as name_prefix, for every role that reads guests ──────
GRANT SELECT (gender), INSERT (gender), UPDATE (gender) ON public.guests TO anon, authenticated;
GRANT ALL ON public.guests TO service_role;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  rle  text;
  priv text;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      IF has_column_privilege(rle, 'public.guests', 'gender', priv)
         IS DISTINCT FROM has_column_privilege(rle, 'public.guests', 'name_prefix', priv) THEN
        RAISE EXCEPTION 'post-condition failed: guests.gender % for % differs from name_prefix', priv, rle;
      END IF;
    END LOOP;
  END LOOP;

  -- Nothing neutral was guessed by THIS backfill: every gender it could have set comes from one of the four.
  IF EXISTS (
    SELECT 1 FROM public.guests
     WHERE gender IS NULL
       AND lower(rtrim(btrim(name_prefix), '.')) IN ('mr', 'ms', 'mrs', 'miss')
  ) THEN
    RAISE EXCEPTION 'post-condition failed: a Mr./Ms./Mrs./Miss row was left without its gender';
  END IF;
END $$;
