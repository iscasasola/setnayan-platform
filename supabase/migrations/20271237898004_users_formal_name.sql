-- ============================================================================
-- users_formal_name — a person's FORMAL name on their own profile.
--
-- ── THE OWNER'S ASK (2026-09-21) ───────────────────────────────────────────
-- *"on my event, my name is Indalecio Casasola II. with a Prefix, First,
-- middle, last, and suffix … on a user profile … when they are added, their
-- real profile name will show."* Profile fields, in his order: Account Name
-- (the @tag — that is the EXISTING `users.slug`, not a new column), Prefix,
-- First, Middle, Last, Suffix.
--
-- Rulings taken the same day:
--   · `display_name` STAYS — it is the nickname ("Ice Casasola"), shown around
--     the app. The five parts are the formal name for guest lists/invitations.
--   · A name search shows ALL THREE: nickname, full formal name and @tag.
--   · Added to a guest list from People, the parts are COPIED onto the guest
--     row; the host can still edit that row for their event.
--
-- ── WHY THE PARTS MIRROR `guests` EXACTLY ─────────────────────────────────
-- `guests` has carried name_prefix / first_name / middle_name / last_name /
-- name_suffix since 20271225055954_guest_name_parts. Same names, same 80-char
-- cap, so a copy from profile to guest row is column-for-column with nothing
-- to translate.
--
-- ── name_search: ONE HAYSTACK FOR THE FIND-BY-NAME BOX ────────────────────
-- `lib/people-search.ts` ANDs one ILIKE per typed word. Matching a word
-- against seven columns would need a PostgREST logic tree whose values must
-- be quoted by hand — the class of escaping bug that has already cost this
-- codebase once. A STORED generated column keeps the reader a single-column
-- filter per word. `||` + `coalesce` + `lower` are all IMMUTABLE (concat_ws
-- is not, which is why it is not used). Nothing writes whole `users` rows
-- (checked: no insert/upsert of a read-back row), so a generated column
-- cannot break a writer.
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS · constraint added only if missing.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name_prefix TEXT,
  ADD COLUMN IF NOT EXISTS first_name  TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name   TEXT,
  ADD COLUMN IF NOT EXISTS name_suffix TEXT;

COMMENT ON COLUMN public.users.name_prefix IS
  'Formal-name honorific ("Atty.", "Dr."). Copied to guests.name_prefix when a host adds this person from People. NULL when none.';
COMMENT ON COLUMN public.users.first_name IS
  'Formal first name ("Indalecio"). display_name stays the nickname; this is the name guest lists and invitations print.';
COMMENT ON COLUMN public.users.middle_name IS
  'Formal middle name or initial. Never a surname particle — "dela Cruz" belongs to last_name.';
COMMENT ON COLUMN public.users.last_name IS
  'Formal last name ("Casasola").';
COMMENT ON COLUMN public.users.name_suffix IS
  'Generational or post-nominal ("II", "Jr.", "CPA"). NULL when none.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_formal_name_len_chk'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_formal_name_len_chk CHECK (
        COALESCE(length(name_prefix), 0) <= 80
        AND COALESCE(length(first_name), 0) <= 80
        AND COALESCE(length(middle_name), 0) <= 80
        AND COALESCE(length(last_name), 0) <= 80
        AND COALESCE(length(name_suffix), 0) <= 80
      );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS name_search TEXT GENERATED ALWAYS AS (
    lower(
      coalesce(display_name, '') || ' ' ||
      coalesce(name_prefix, '')  || ' ' ||
      coalesce(first_name, '')   || ' ' ||
      coalesce(middle_name, '')  || ' ' ||
      coalesce(last_name, '')    || ' ' ||
      coalesce(name_suffix, '')  || ' ' ||
      coalesce(slug, '')
    )
  ) STORED;

COMMENT ON COLUMN public.users.name_search IS
  'Generated haystack for the People find-by-name box: nickname + formal name parts + slug (the @tag), lower-cased. Read by lib/people-search.ts, one ILIKE per typed word. Never written.';
