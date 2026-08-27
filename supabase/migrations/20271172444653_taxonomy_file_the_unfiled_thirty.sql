-- taxonomy_file_the_unfiled_thirty
-- ============================================================================
-- FILE THE 30 SERVICES THE ADMIN TAXONOMY HAS BEEN CALLING "UNFILED", INTO THE
-- FOUR BRANCHES THAT ALREADY CARRY THEIR EXACT NAMES.
--
-- Owner, 2026-08-27, looking at `/admin/taxonomy?view=unfiled`: *"there are so
-- many that are not added on the taxonomy. or not categorized properly."*
--
-- MEASURED IN PRODUCTION BEFORE WRITING A LINE (not read off a doc):
--   275 canonical_service_schemas · 276 canonical_service_taxonomy rows
--   30 rows carry a folder_id and a NULL tile_id  → the Unfiled tray
--   6 tier-2 branches hold ZERO leaves
-- Four of those empty branches are the exact homes of all 30, one for one:
--   officiants (20) · counseling_seminars (5) · wedding_paperwork (3) ·
--   travel_honeymoon (2).  20 + 5 + 3 + 2 = 30.  Not a subset — the whole tray.
--
-- 🔑 HIDDEN IS NOT UNFILED, AND CONFLATING THEM IS WHAT PRODUCED THIS.
-- `lib/taxonomy.ts` (2026-05-31 lock) pulls officiants and pre-marriage
-- paperwork OUT OF THE MARKETPLACE — the priest auto-resolves from the ceremony
-- venue, the paperwork lives in the Setnayan AI wizard — and it implemented
-- that by ALSO leaving `tile` off the entry ("Omitted when marketplaceHidden is
-- true"). Two different facts, one field. The visibility half is untouched
-- here; only the filing half changes.
--
-- ⚠ NOTHING BECOMES VISIBLE. Every one of the 30 keeps marketplace_hidden, and
-- so do the four branches. Verified by reading the consumers, not by assuming:
--   • lib/vendor-counts.ts deriveBuckets  → `if (meta.marketplaceHidden) continue;`
--     so /explore never sees these leaves, and the four tiles stay empty there
--     (a tile with zero canonicals is skipped by the /explore loop).
--   • lib/vendor-coverages.ts             → `if (cs.marketplace_hidden === true
--     || !cs.tile_id) continue;` — feeds the /open-shop picker AND the coverage
--     editor, both of which also drop a hidden BRANCH.
--   • lib/vendor-service-vocab.ts         → `if (meta.marketplaceHidden) return false;`
-- Every gate reads the hidden flag BEFORE it looks at the tile. Filing is
-- bookkeeping; it is not a door.
--
-- 🚨 AND THE FOUR BRANCHES HAVE NEVER EXISTED OUTSIDE PRODUCTION.
-- They were created through the admin console on 2026-07-03 20:49:27Z (all four
-- in the same second) and NO migration has ever named them in a CREATE or an
-- INSERT — `grep -rn "'officiants'" supabase/migrations` returns exactly one
-- hit, an UPDATE in 20270832295038 that has been matching ZERO ROWS in every
-- replay and every fresh database since the day it merged. So section 1 below
-- is not defensive boilerplate: without it the UPDATEs in section 2 would fail
-- the `canonical_service_taxonomy.tile_id → service_categories(id)` foreign key
-- everywhere except prod. The INSERT reproduces prod's own values (labels,
-- slugs, sort_order, hidden flag, event scoping) so the replay and prod agree.
--
-- ⚖ ONE JUDGEMENT CALL, STATED: `visa_wedding_logistics` was foldered
-- `planning` while its two obvious siblings (apostille/DFA, marriage-licence
-- expediting) were foldered `venue`. It moves to `venue` with them, because
-- Paperwork & Government hangs off `venue` and this table's own invariant is
-- folder_id = the tile's parent_id — measured clean across all 245 filed rows
-- today, and pinned by the new db test. Filing it under Travel & Honeymoon
-- instead would have kept the folder and been wrong about the thing itself.
--
-- Idempotent: INSERT … ON CONFLICT DO NOTHING, then UPDATE by explicit key.
-- The UPDATE is guarded on `tile_id IS NULL` so a later admin decision to file
-- one of these somewhere else is never silently reverted by a re-run.
-- ============================================================================

BEGIN;

-- ---- 1. the four admin-only branches, as production already has them --------
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, slug, sort_order, scope, marketplace_hidden, applicable_event_types)
VALUES
  ('officiants',          'venue',    2, 'leaf', 'Officiants',             'officiants',          2, 'global', TRUE, ARRAY['wedding','christening']::TEXT[]),
  ('counseling_seminars', 'venue',    2, 'leaf', 'Counseling & Seminars',  'counseling-seminars', 3, 'global', TRUE, ARRAY['wedding','christening']::TEXT[]),
  ('wedding_paperwork',   'venue',    2, 'leaf', 'Paperwork & Government', 'wedding-paperwork',   4, 'global', TRUE, ARRAY['wedding']::TEXT[]),
  ('travel_honeymoon',    'planning', 2, 'leaf', 'Travel & Honeymoon',     'travel-honeymoon',    4, 'global', TRUE, ARRAY['wedding']::TEXT[])
ON CONFLICT (id) DO NOTHING;

-- ---- 2. file the 30 ---------------------------------------------------------
-- 20 celebrants of every rite the product knows, plus the three civil ones.
UPDATE public.canonical_service_taxonomy
   SET tile_id = 'officiants', folder_id = 'venue', updated_at = now()
 WHERE tile_id IS NULL
   AND canonical_service IN (
     'officiant_priest_minister','catholic_priest','aglipayan_priest','orthodox_priest',
     'mainline_protestant_pastor','born_again_pastor','charismatic_pastor','sda_pastor',
     'inc_minister','jw_elder','lds_officiant','jewish_rabbi','muslim_imam','hindu_pandit',
     'sikh_granthi','buddhist_monk','cultural_tribal_elder',
     'civil_judge','civil_mayor','civil_justice_of_peace'
   );

-- The seminars and counselling a couple must sit through before the rite.
UPDATE public.canonical_service_taxonomy
   SET tile_id = 'counseling_seminars', folder_id = 'venue', updated_at = now()
 WHERE tile_id IS NULL
   AND canonical_service IN (
     'pre_cana_seminar','christian_premarital_counseling','inc_counseling',
     'muslim_pre_wedding_counseling','cfo_seminar'
   );

-- The government paperwork. `visa_wedding_logistics` also changes folder — see
-- the judgement call in the header.
UPDATE public.canonical_service_taxonomy
   SET tile_id = 'wedding_paperwork', folder_id = 'venue', updated_at = now()
 WHERE tile_id IS NULL
   AND canonical_service IN (
     'marriage_license_expediting','apostille_dfa_authentication','visa_wedding_logistics'
   );

-- After the day.
UPDATE public.canonical_service_taxonomy
   SET tile_id = 'travel_honeymoon', folder_id = 'planning', updated_at = now()
 WHERE tile_id IS NULL
   AND canonical_service IN (
     'honeymoon_planner','destination_wedding_travel_coordinator'
   );

-- ---- 3. the one service the admin console could not show at all -------------
-- `crew_meal_supply` is the ONLY leaf under Feast › Crew Meals, it is
-- marketplace-VISIBLE, and it has no `canonical_service_schemas` row — the
-- 2026-07-08 migration that created the tile re-emitted the taxonomy seed and
-- never added the schema. Consequences, both silent: it is absent from the
-- admin Services list (that list is built from the schemas table), so nobody
-- can edit its name or attributes; and the /open-shop picker falls through to
-- `humanize(canonical_service)` for its label. The display name below is
-- byte-identical to what `humanize` already renders, so NOTHING a person reads
-- changes — the row exists so the name becomes editable and the service becomes
-- visible to the admin that owns it.
INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES ('crew_meal_supply', 'Crew Meal Supply')
ON CONFLICT (canonical_service) DO NOTHING;

COMMIT;
