-- MB26 · retire the ten media.setnayan.com pilot rows — owner ruling
-- 2026-09-05: "media.setnayan.com is not being set up now."
--
-- The 2026-09-03 decor-layers pilot (migration 20271194970382) seeded ten
-- `venue_scene` rows pointing at `https://media.setnayan.com/...` — five
-- `backdrop` and five `ceiling`. That host does not resolve
-- (`dig +short media.setnayan.com` is empty), and the objects also 404 on
-- the working `pub-…r2.dev` host — they were never uploaded anywhere. All
-- ten are `approved_at IS NULL`, so no customer has ever seen one; nothing
-- here should ever become approvable by accident now that the owner has
-- ruled the domain is not being set up.
--
-- RETIRE, never DELETE — a seeded photo is never deleted (owner decisions,
-- 2026-09-04; see [[inspiration-gallery-owner-decisions-2026-09-04]]). The
-- row is the record that we once seeded a pilot here; `retired_at` is the
-- same visibility gate every other couple-facing query already reads.
--
-- Guarded by a row-count check: a predicate that matched more or fewer than
-- the ten rows measured on 2026-09-05 means the world changed under this
-- migration (a new pilot row landed, or one of these ten was already
-- retired/deleted/re-pointed by another session) and a human should look,
-- not have the migration silently retire a different set.
--
-- Extended in tests/db/no-placeholder-photo-is-ever-live.db.test.ts: no LIVE
-- row's storage_path is ever on media.setnayan.com. Deliberately NOT
-- enforced as a host allowlist or DNS check in
-- lib/moodboard-library-placeholder.ts — the owner may set the domain up
-- later, and a guard that has to be undone is a guard that gets deleted in
-- a hurry.

DO $$
DECLARE
  n int;
BEGIN
  -- Counted WITHOUT a retired_at filter, on purpose: retiring never deletes,
  -- so this predicate must keep matching all ten rows forever, including on
  -- a re-Apply of this migration. Filtering on retired_at IS NULL here would
  -- make the count 0 (and this RAISE fire) the second time it ran.
  SELECT count(*) INTO n
    FROM public.moodboard_library_assets
   WHERE asset_type = 'venue_scene'
     AND storage_path LIKE 'https://media.setnayan.com/%';

  IF n <> 10 THEN
    RAISE EXCEPTION
      'MB26: expected exactly 10 media.setnayan.com venue_scene rows, found %. The world '
      'changed under this migration — a new pilot row landed, or one of the original ten '
      'was deleted or re-pointed. Look before retiring.', n;
  END IF;

  UPDATE public.moodboard_library_assets
     SET retired_at = NOW()
   WHERE asset_type = 'venue_scene'
     AND storage_path LIKE 'https://media.setnayan.com/%'
     AND retired_at IS NULL;
END $$;
