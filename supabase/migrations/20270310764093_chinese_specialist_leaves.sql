-- ============================================================================
-- 20270310764093_chinese_specialist_leaves.sql
--
-- Chinese (Tsinoy) specialist vendor leaves — closes the gap so a couple with
-- ceremony_type='chinese' (or secondary_ceremony_type='chinese' under the 0043
-- overlay model) discovers the right specialists, and so the date-selection
-- "Consult a date specialist" CTA has a real deep-link target.
--
-- 2 of the 7 spec leaves already shipped in 20261120000100_faith_journey_
-- content_seeds.sql (double_happiness_decor, qipao_cheongsam_attire) — NOT
-- touched here. This adds the 5 NET-NEW leaves.
--
-- Pattern (mirrors 20261120000100): each canonical = a canonical_service_schemas
-- stub (vendor onboarding + admin tree) + a canonical_service_taxonomy placement
-- (marketplace bucketing, faith tag, event scope). lib/taxonomy.ts gets parity
-- entries in the SAME PR (fallback + typecheck source). Idempotent (ON CONFLICT
-- DO NOTHING). Fail-loud DO block preserved.
--
-- FAITH-TAGGING DECISION (food de-faith lock, 2026-06-11):
--   • chinese_lauriat_caterer is a FOOD/catering service. The locked de-faith
--     rule forbids faith-tagging food/dietary services — a faith tag would HIDE
--     a Chinese-banquet caterer from every non-Chinese couple who might want
--     one. So it is seeded faith=NULL (universally discoverable via the
--     INCLUDE-only filter) and marked is_tradition=TRUE so it still reads as a
--     Chinese tradition service in the marketplace. dietary is left NULL (the
--     DO-block guard aborts the migration if any dietary row is faith-tagged).
--   • The other 4 leaves are genuine Chinese specialists → faith='Chinese'
--     (Title-case, matching faith_vocab) so the INCLUDE-only filter surfaces
--     them to Chinese couples (primary or secondary rite) and to no one else.
--   • dietary is NULL on ALL 5 (no faith+dietary collision possible).
--
-- A new tier-2 tile `date_specialist` is minted under the `planning` parent for
-- date_fengshui_consultant — a BaZi/feng-shui date advisor is NOT a coordinator/
-- planner, and the date-specialist CTA needs a clean, semantically correct
-- target. The tile is INSERTed BEFORE the canonical row (tile_id FK, SET NULL on
-- the canonical side but the tile must exist for the placement to bucket).
-- ============================================================================

BEGIN;

-- 1. New tile: Date Specialist under Planning — the deep-link target for the
-- date-selection "Consult a date specialist" CTA. Universal across event types
-- (a date/feng-shui advisor applies wherever a couple wants one); faith routing
-- happens at the canonical (date_fengshui_consultant) grain, not the tile grain.
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, marketplace_hidden)
VALUES
  ('date_specialist', 'planning', 2, 'leaf', 'Date & Feng-shui Specialist', NULL,
   'date-specialist', 3, 'global', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Schema stubs (vendor-onboarding 'add a service' picker + admin tree presence).
--    display_name_en is PUBLIC marketplace copy — culture-facing, never jargon.
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  ('chinese_lauriat_caterer',    1, 'Lauriat / Chinese Banquet Caterer',     '{}', '{}', '[]', '{}', '{}'),
  ('date_fengshui_consultant',   1, 'Chinese Date & Feng-shui Consultant',   '{}', '{}', '[]', '{}', '{}'),
  ('tea_set_styling',            1, 'Tea Ceremony Set & Styling',            '{}', '{}', '[]', '{}', '{}'),
  ('angpao_betrothal_supplier',  1, 'Ang Pao & Betrothal Gifts',             '{}', '{}', '[]', '{}', '{}'),
  ('lion_dance_troupe',          1, 'Lion & Dragon Dance',                   '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

-- 3. Taxonomy placements. Column list mirrors 20261120000100 exactly (dietary is
--    OMITTED → defaults NULL). is_tradition=TRUE on all 5 (Chinese cultural
--    services); marketplace_hidden=FALSE (visible); phase V1.1.1 (live tiles).
--    chinese_lauriat_caterer = faith NULL (food de-faith lock); the other 4 =
--    faith 'Chinese'. is_ph=TRUE on the caterer + the date/feng-shui consultant
--    (PH-Tsinoy-specific categories WedMeGood structurally lacks).
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental,
   is_tradition, marketplace_hidden, secondary_tiles, applicable_event_types)
VALUES
  -- FOOD: faith NULL (de-faith lock) + is_tradition so it stays universal yet Chinese-discoverable.
  ('chinese_lauriat_caterer',   'feast',   'catering',           'V1.1.1', NULL,      TRUE,  FALSE, FALSE, TRUE, FALSE, '{}', NULL),
  -- Genuine Chinese specialists: faith-tagged 'Chinese' (INCLUDE-only filter routes to Chinese couples).
  ('date_fengshui_consultant',  'planning', 'date_specialist',   'V1.1.1', 'Chinese', TRUE,  FALSE, FALSE, TRUE, FALSE, '{}', NULL),
  ('tea_set_styling',           'design',  'stylist_decorator',  'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, TRUE, FALSE, '{}', NULL),
  ('angpao_betrothal_supplier', 'prints',  'souvenir_giveaways', 'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, TRUE, FALSE, '{}', NULL),
  ('lion_dance_troupe',         'program', 'performers',         'V1.1.1', 'Chinese', FALSE, FALSE, FALSE, TRUE, FALSE, '{}', NULL)
ON CONFLICT (canonical_service) DO NOTHING;

-- 4. Fail loud: every non-civil faith key must keep >=1 tagged service, and no
-- dietary row may be faith-tagged (the de-faith lock). Mirrors 20261120000100.
DO $$
DECLARE missing TEXT; bad TEXT;
BEGIN
  SELECT string_agg(v.faith_key, ', ') INTO missing
    FROM public.faith_vocab v
   WHERE v.faith_key NOT IN ('Civil')
     AND NOT EXISTS (SELECT 1 FROM public.canonical_service_taxonomy t WHERE t.faith = v.faith_key);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'faith keys with zero tagged services: %', missing;
  END IF;
  SELECT string_agg(canonical_service, ', ') INTO bad
    FROM public.canonical_service_taxonomy WHERE dietary IS NOT NULL AND faith IS NOT NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'dietary rows must never be faith-tagged: %', bad;
  END IF;
END $$;

COMMIT;
