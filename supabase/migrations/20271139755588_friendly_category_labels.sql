-- ============================================================================
-- Say the words people actually type — the 15 marketplace category labels
-- (redesign Session 3, owner-approved 2026-08-12).
--
-- WHY THIS MIGRATION EXISTS AT ALL — the part that is easy to get wrong.
-- The customer-facing category words render from TWO places that must agree:
--
--   1. `apps/web/lib/taxonomy.ts` — WEDDING_FOLDER_LABEL / _SHORT_LABEL.
--      Read DIRECTLY by the icon-tile strip and the search autocomplete.
--   2. THIS TABLE — read by the live marketplace catalog headings through
--      `getTaxonomy()` (apps/web/lib/taxonomy-db.ts), which only falls back to
--      the constant when this read is EMPTY or ERRORS.
--
-- Editing the code alone leaves the catalog headings on the old internal words
-- while the chips directly above them show the new ones: one page, two
-- vocabularies, and NOTHING throws. That is the same "rejected/absent, never
-- thrown" family as the phantom column, the phantom enum value and the phantom
-- RPC argument. So: change one, change both — in the same PR.
-- `apps/web/tests/db/taxonomy-labels-match-code.db.test.ts` now fails if they
-- ever disagree again.
--
-- WHAT THIS IS NOT: no schema change, no new column, and `slug` is UNTOUCHED —
-- every `?folder=` link, anchor and saved/printed URL resolves exactly as
-- before. This is a display rename with no address cost.
--
-- IDEMPOTENT + NON-CLOBBERING: each row is updated only while it still carries
-- the exact OLD word, so re-running is a no-op and an admin's own later edit
-- via the Taxonomy Studio is never overwritten.
-- ============================================================================

BEGIN;

-- ── The rename, old → new. `id` is the folder key and never changes. ────────
WITH renames(id, old_label_en, new_label_en, old_label_short, new_label_short) AS (
  VALUES
    ('venue',            'Venue',                  'Venues & churches',          'Venue',        'Venues'),
    ('planning',         'Planning',               'Coordinators & planners',    'Planning',     'Planners'),
    ('feast',            'Feast',                  'Catering & cake',            'Feast',        'Catering'),
    ('design',           'Design',                 'Styling, flowers & lights',  'Design',       'Styling'),
    ('program',          'Program',                'Hosts, music & program',     'Program',      'Hosts & music'),
    ('documentary',      'Documentary',            'Photo & video',              'Documentary',  'Photo & video'),
    ('look',             'Look',                   'Attire, hair & make-up',     'Look',         'Attire & make-up'),
    ('booths',           'Booths',                 'Booths, carts & bars',       'Booths',       'Booths & carts'),
    ('prints',           'Prints',                 'Invites, prints & souvenirs','Prints',       'Invites & prints'),
    ('transport',        'Transport',              'Cars & transport',           'Transport',    'Cars'),
    ('experience',       'Experience',             'Guest experiences',          'Experience',   'Experiences'),
    ('dining',           'Dining',                 'Dining extras',              'Dining',       'Dining'),
    ('logistics_safety', 'Logistics & Safety',     'Logistics & safety',         'Logistics',    'Logistics'),
    ('insurance',        'Insurance & Protection', 'Insurance & protection',     'Insurance',    'Insurance'),
    ('specialty',        'Specialty',              'Specialty',                  'Specialty',    'Specialty')
)
UPDATE service_categories AS sc
SET
  -- Only move a field that still holds the retired word. A field an admin has
  -- since changed to something of their own keeps their value.
  label_en    = CASE WHEN sc.label_en    = r.old_label_en    THEN r.new_label_en    ELSE sc.label_en    END,
  label_short = CASE WHEN sc.label_short = r.old_label_short THEN r.new_label_short ELSE sc.label_short END
FROM renames AS r
WHERE sc.id = r.id
  AND sc.tier = 1
  AND (sc.label_en = r.old_label_en OR sc.label_short = r.old_label_short);

-- ── Assert the retired words are actually gone. ─────────────────────────────
-- A migration that silently matched nothing looks exactly like one that worked,
-- so this fails loudly rather than leaving a stale internal word on the page.
-- 'Specialty' is deliberately absent: its label is unchanged by this rename.
DO $$
DECLARE
  stale_count integer;
  stale_list  text;
BEGIN
  SELECT count(*), string_agg(id || '=' || label_en, ', ')
    INTO stale_count, stale_list
  FROM service_categories
  WHERE tier = 1
    AND label_en IN (
      'Venue', 'Planning', 'Feast', 'Design', 'Program', 'Documentary',
      'Look', 'Booths', 'Prints', 'Transport', 'Experience', 'Dining',
      'Logistics & Safety', 'Insurance & Protection'
    );

  IF stale_count > 0 THEN
    RAISE EXCEPTION
      'friendly_category_labels: % tier-1 folder(s) still carry a retired internal label: %',
      stale_count, stale_list;
  END IF;

  RAISE NOTICE 'friendly_category_labels: all tier-1 folder labels are customer-facing.';
END $$;

COMMIT;
