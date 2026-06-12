-- ============================================================================
-- 20261124000000_cultural_subtype_optional.sql
-- Cultural ceremony sub-type becomes OPTIONAL (owner batch 2026-06-12).
--
-- The 0043 CHECK required a non-null ceremony_sub_type for BOTH muslim and
-- cultural weddings. The events×faiths audit (2026-06-11) found the cultural
-- sub-type is collected then drives nothing downstream (no matching dimension,
-- no content fork), so mandating it is pure friction — and indigenous couples
-- whose tradition isn't on the list were forced into 'other'. Muslim stays
-- required: its sub-type (Maranao/Tausug/…) is a real matching + content
-- dimension. Data still flows when a cultural couple does pick one.
-- ============================================================================

BEGIN;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_sub_type_required_when_muslim_or_cultural;
ALTER TABLE public.events
  ADD CONSTRAINT events_sub_type_required_when_muslim_or_cultural
  CHECK (
    ceremony_type IS DISTINCT FROM 'muslim'
    OR ceremony_sub_type IS NOT NULL
  );

COMMENT ON CONSTRAINT events_sub_type_required_when_muslim_or_cultural ON public.events IS
  'Sub-type required for muslim only (2026-06-12 — cultural relaxed to optional. Constraint name kept so old migrations'' DROP IF EXISTS still match).';

-- ----------------------------------------------------------------------------
-- Wedding-only tile scoping (same owner batch). applicable_event_types is
-- FAIL-OPEN (NULL = every event type), so universal tiles need nothing —
-- the honest-browse work is scoping the tiles that ONLY make sense at a
-- wedding, now that anniversary/graduation/reunion gain picker cards.
-- Conservative set only (zero judgment calls): womens/mens attire,
-- filipiniana, choir etc. stay universal because debuts/graduations/church
-- events genuinely use them. Weddings see no change (fail-open includes
-- 'wedding' scoped tiles). Deeper per-event curation is a later owner pass.
-- ----------------------------------------------------------------------------
UPDATE public.service_categories
SET applicable_event_types = ARRAY['wedding']::text[]
WHERE id IN ('brides_attire', 'grooms_attire', 'wedding_singer', 'bridal_car')
  AND applicable_event_types IS NULL;

COMMIT;
