-- ============================================================================
-- 20261103000000_onboarding_refinements_tile_fk.sql
--
-- Phase 0 of the taxonomy single-source unification (owner-approved 2026-06-10;
-- design doc Taxonomy_Event_Faith_Scoping_Design_2026-06-10.md).
--
-- Anchors every onboarding refinement leaf to the ONE taxonomy spine
-- (service_categories) via a tile_id FK, so the couple-facing "what kind of X?"
-- refinements can no longer drift from the marketplace tree, and event-type /
-- faith visibility can later inherit from the anchor tile.
--
-- NO destructive leaf_key rename: saved couple picks live in
-- events.style_preferences.refinements (JSONB keyed by leaf_key) and MUST keep
-- resolving. leaf_key stays the stable onboarding id; tile_id is the new link.
--
-- 27 of 38 leaf_keys already equal a tier-2 tile id; the other 11 are naming
-- aliases (bride_attire -> brides_attire, …) mapped explicitly below.
-- Additive + idempotent; FAILS LOUD if any leaf cannot be anchored.
-- ============================================================================

BEGIN;

-- 1. Additive nullable column (backfilled + constrained below).
ALTER TABLE public.onboarding_refinements
  ADD COLUMN IF NOT EXISTS tile_id TEXT;

-- 2a. Exact matches: leaf_key IS already a tier-2 tile id (27 leaves).
UPDATE public.onboarding_refinements o
   SET tile_id = o.leaf_key
  FROM public.service_categories sc
 WHERE sc.id = o.leaf_key
   AND sc.tier = 2
   AND o.tile_id IS DISTINCT FROM o.leaf_key;

-- 2b. Naming aliases: leaf_key -> real tier-2 tile id (11 leaves).
UPDATE public.onboarding_refinements o
   SET tile_id = m.tile
  FROM (VALUES
    ('bride_attire',  'brides_attire'),
    ('groom_attire',  'grooms_attire'),
    ('men_attire',    'mens_attire'),
    ('women_attire',  'womens_attire'),
    ('filipiniana',   'filipiniana_barongs'),
    ('jewelry',       'jewelleries_accessories'),
    ('henna',         'henna_tattoo'),
    ('coffee',        'coffee_espresso'),
    ('souvenirs',     'souvenir_giveaways'),
    ('stylist',       'stylist_decorator'),
    ('ceremony',      'ceremony_venue')
  ) AS m(leaf, tile)
 WHERE o.leaf_key = m.leaf
   AND o.tile_id IS NULL;

-- 3. Fail loud — never ship a silent anchoring gap.
DO $$
DECLARE
  bad TEXT;
BEGIN
  SELECT string_agg(leaf_key, ', ') INTO bad
    FROM public.onboarding_refinements WHERE tile_id IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'onboarding_refinements left unanchored (no tile_id): %', bad;
  END IF;

  SELECT string_agg(o.leaf_key, ', ') INTO bad
    FROM public.onboarding_refinements o
    LEFT JOIN public.service_categories sc
      ON sc.id = o.tile_id AND sc.tier = 2
   WHERE sc.id IS NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'onboarding_refinements.tile_id not a tier-2 tile: %', bad;
  END IF;
END $$;

-- 4. Constrain: FK to the spine (idempotent) + NOT NULL + index.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_refinements_tile_fk'
  ) THEN
    ALTER TABLE public.onboarding_refinements
      ADD CONSTRAINT onboarding_refinements_tile_fk
      FOREIGN KEY (tile_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.onboarding_refinements
  ALTER COLUMN tile_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS onboarding_refinements_tile_idx
  ON public.onboarding_refinements (tile_id);

COMMENT ON COLUMN public.onboarding_refinements.tile_id IS
  'FK -> service_categories.id (tier-2 tile). Single-source anchor for this refinement leaf (Phase 0 unification, 2026-06-10). leaf_key stays the stable onboarding id; tile_id is the taxonomy link.';

COMMIT;
