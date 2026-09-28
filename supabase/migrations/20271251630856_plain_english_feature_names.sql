-- plain_english_feature_names
--
-- Owner, 2026-09-29: "Change pakanta to Music Maker." · "Only Papic is
-- customized and all other namings should be generic" · "Samahan - Group" ·
-- "Ala ala - Memories" · Alaga → "Loved ones" · Panood → "Watch Live" · Kwento →
-- "Photo Notes". Papic and Patiktok keep their names. (DECISION_LOG rows
-- "PAKANTA IS RENAMED 'MUSIC MAKER'", "ONLY PAPIC KEEPS A CUSTOM NAME",
-- "PATIKTOK KEEPS ITS NAME (WITH PAPIC); ALAGA → LOVED ONES",
-- "OWNER ANSWERS — NINE PENDING DECISIONS".)
--
-- DATA ONLY. This rewrites DISPLAY COPY that lives in the database — catalogue
-- titles/descriptions, taxonomy display names, admin nav/search labels, dock
-- labels. It renames NO identifier: service_code 'PAKANTA', canonical_service
-- 'setnayan_pakanta', every samahan_* table and every route stay exactly as they
-- are, so old links and history keep their keys. The app code carries the same
-- rename for its own strings, guarded by lib/retired-names-stay-off-screen.test.ts.
--
-- Word-bounded and glue-aware: a hit touching `_ / . -` or a letter/digit is
-- part of an identifier (`/pakanta`, `pakanta_song_r2_key`) and is left alone.
-- The WHERE filter makes a re-run a no-op, so this is idempotent.
--
-- ⚠ NOT touched on purpose: notifications.body and anything a PERSON wrote —
-- a group a user named "Samahan ng Batch 2010" keeps its name. Only the two
-- fixed notification TITLES the app itself emitted are rewritten, by exact match.

DO $$
DECLARE
  target  record;
  expr    text;
  n       bigint;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('platform_retail_catalog_v2', 'title'),
      ('platform_retail_catalog_v2', 'description'),
      ('platform_package_catalog',   'title'),
      ('platform_package_catalog',   'description'),
      ('service_catalog',            'display_name'),
      ('service_catalog',            'description'),
      ('vendor_billing_catalog',     'title'),
      ('vendor_billing_catalog',     'description'),
      ('canonical_service_schemas',  'display_name_en'),
      ('canonical_service_schemas',  'display_name_tl'),
      ('canonical_service_schemas',  'display_name_ceb'),
      ('nav_slot_override',          'label'),
      ('admin_search_phrases',       'label'),
      ('homepage_background_videos', 'label')
    ) AS t(tbl, col)
  LOOP
    -- Tolerate a table/column that a given environment does not have.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = target.tbl
         AND column_name  = target.col
    );

    expr := format($f$
      regexp_replace(regexp_replace(
      regexp_replace(regexp_replace(regexp_replace(regexp_replace(
      regexp_replace(regexp_replace(regexp_replace(%1$I,
        '(?<![A-Za-z0-9_/.-])[Pp]akanta(?![A-Za-z0-9_/-])',          'Music Maker', 'g'),
        '(?<![A-Za-z0-9_/.-])Samahan(s?)(?![A-Za-z0-9_/-])',         'Group\1',     'g'),
        '(?<![A-Za-z0-9_/.-])samahan(s?)(?![A-Za-z0-9_/-])',         'group\1',     'g'),
        '(?<![A-Za-z0-9_/.-])Ala[- ]?[Aa]la(?![A-Za-z0-9_/-])',      'Memories',    'g'),
        '(?<![A-Za-z0-9_/.-])ala[- ]?ala(?![A-Za-z0-9_/-])',         'memories',    'g'),
        '(?<![A-Za-z0-9_/.-])Alaga(?![A-Za-z0-9_/-])',               'Loved ones',  'g'),
        '(?<![A-Za-z0-9_/.-])alaga(?![A-Za-z0-9_/-])',               'loved ones',  'g'),
        '(?<![A-Za-z0-9_/.-])Panood(?![A-Za-z0-9_/-])',              'Watch Live',  'g'),
        -- "ang/inyong/aming kwento" is Tagalog for "the/your/our story" — a word,
        -- not the feature; every such determiner ends in "ng ".
        '(?<![A-Za-z0-9_/.-])(?<!ng )Kwento(?![A-Za-z0-9_/-])',      'Photo Notes', 'g')
    $f$, target.col);

    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = %3$s WHERE %2$I IS NOT NULL AND %2$I IS DISTINCT FROM %3$s',
      target.tbl, target.col, expr
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'plain_english_feature_names: %.% — % row(s)', target.tbl, target.col, n;
  END LOOP;
END
$$;

-- The two fixed notification titles the app emitted (lib/notifications.ts).
-- Exact match only — never a person's words.
UPDATE public.notifications SET title = 'New in your group'
 WHERE title = 'New in your samahan';
UPDATE public.notifications SET title = 'Someone joined your group'
 WHERE title = 'Someone joined your samahan';

-- Post-condition: the catalogue row a customer is charged under reads the new name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.platform_retail_catalog_v2
     WHERE service_code = 'PAKANTA' AND title ~ '\mPakanta\M'
  ) THEN
    RAISE EXCEPTION 'PAKANTA catalogue title still says Pakanta';
  END IF;
END
$$;
