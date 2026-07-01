-- user slug column and slug_change_log user entity
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ============================================================================
-- PR1 of the three-tier slug routing change:
--     vendor  ->  setnayan.com/[vendor-slug]        (bare root, was /v/[slug])
--     user    ->  setnayan.com/u/[user-slug]        (NEW public profile)
--     event   ->  setnayan.com/u/[user-slug]/[event-slug]   (nested)
--
-- This migration is ADDITIVE ONLY. Nothing reads `users.slug` yet (the /u/
-- routes land in a later PR), so it is safe to deploy well ahead of the routing
-- cutover. It: (1) adds users.slug mirroring the events.slug contract, (2)
-- backfills every existing account, (3) widens slug_change_log to log user-slug
-- renames too. `slug` stays NULLABLE here — a follow-up migration flips it
-- NOT NULL only after live slug-generation for NEW accounts is wired in the
-- routing PR and every row is confirmed populated.
-- ============================================================================

-- 1. users.slug ---------------------------------------------------------------
-- Public handle for the account profile at /u/[slug]. Mirrors events.slug
-- exactly: 3-32 chars of lowercase/digit/hyphen, unique case-insensitively.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Format constraint mirrors events_slug_format. DROP-then-ADD is the idempotent
-- pattern (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_slug_format;
ALTER TABLE public.users
  ADD CONSTRAINT users_slug_format
  CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]{3,32}$');

-- Case-insensitive uniqueness, only when set (matches events_slug_lower_idx).
CREATE UNIQUE INDEX IF NOT EXISTS users_slug_lower_idx
  ON public.users (LOWER(slug)) WHERE slug IS NOT NULL;

-- No RLS change: the existing `user_owns_row` policy on public.users is
-- FOR ALL … USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()), so
-- an account can already read + set its own slug; admins are covered by
-- admin_full_access_users. `slug` is just another self-owned column.

-- 2. Backfill existing accounts ----------------------------------------------
-- One-time, idempotent via `WHERE slug IS NULL`. Derives from display_name;
-- falls back to the (already-UNIQUE) public_id when the name yields nothing
-- usable. Diacritics common in PH/Spanish names are folded BEFORE the
-- non-alphanumeric->hyphen pass — so "Niño"->"nino" and "José"->"jose", NOT
-- "ni-o"/"jos" — matching the NFKD diacritic strip in apps/web/lib/slugs.ts
-- slugify(). Case-insensitive collisions get a -2, -3, … suffix. Every value
-- produced satisfies users_slug_format (added above), which validates the run.
DO $$
DECLARE
  r          RECORD;
  base_slug  TEXT;
  cand       TEXT;
  n          INT;
BEGIN
  FOR r IN
    SELECT user_id, display_name, public_id
    FROM public.users
    WHERE slug IS NULL
  LOOP
    base_slug := lower(coalesce(r.display_name, ''));
    -- Fold common lowercase Latin-1/Spanish/Filipino diacritics (from/to are
    -- equal-length, char-for-char, UTF-8 single codepoints each).
    base_slug := translate(
      base_slug,
      'àáâãäèéêëìíîïòóôõöùúûüñç',
      'aaaaaeeeeiiiiooooouuuunc'
    );
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g'); -- non-alnum -> hyphen
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');         -- collapse runs
    base_slug := trim(both '-' from base_slug);                     -- trim ends
    base_slug := left(base_slug, 32);                              -- cap length
    base_slug := trim(both '-' from base_slug);                    -- re-trim if cut mid-hyphen

    -- Name yielded nothing usable -> use the already-unique public_id.
    IF length(base_slug) < 3 THEN
      base_slug := left(lower(regexp_replace(r.public_id, '[^a-zA-Z0-9]+', '-', 'g')), 32);
    END IF;

    -- Reserve room for a numeric suffix (so "-2".."-99" never overflows 32).
    IF length(base_slug) > 28 THEN
      base_slug := trim(both '-' from left(base_slug, 28));
    END IF;

    -- First free candidate, case-insensitive. Compares against rows already
    -- updated earlier in this same loop, so within-batch dupes are handled.
    cand := base_slug;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE LOWER(slug) = LOWER(cand)) LOOP
      n := n + 1;
      cand := base_slug || '-' || n::TEXT;
    END LOOP;

    UPDATE public.users SET slug = cand WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- 3. slug_change_log — allow entity_type = 'user' ----------------------------
-- The redirect ledger already covers 'event'|'vendor'; user-slug renames need
-- the same 90-day redirect treatment later. Widen the CHECK. The inline CHECK
-- in the original table gets Postgres' auto name slug_change_log_entity_type_check.
ALTER TABLE public.slug_change_log
  DROP CONSTRAINT IF EXISTS slug_change_log_entity_type_check;
ALTER TABLE public.slug_change_log
  ADD CONSTRAINT slug_change_log_entity_type_check
  CHECK (entity_type IN ('event', 'vendor', 'user'));
