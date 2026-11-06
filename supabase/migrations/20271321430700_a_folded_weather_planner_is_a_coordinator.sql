-- A FOLDED WEATHER PLANNER IS A COORDINATOR (taxonomy v2, owner-approved 2026-11-06).
--
-- Taxonomy v2 folds `wedding_day_weather_forecaster` into the Coordinator / planner
-- service (`wedding_coordination`) as its "Weather / outdoor planning" specialty. The
-- coordinator trade is that service and every key folded into it, so the SQL copy of
-- `COORDINATOR_TRADE_SERVICES` (apps/web/lib/coordinator-trade.ts) gains that one name.
-- `coordinator-trade-is-one-list.test.ts` derives the list from
-- supabase/data/taxonomy-v2-2026-11-06.json and fails if the two copies differ.
--
-- In practice this widens nothing: `merge_canonical_service` (run by the v2 migration
-- 20271320461004) rewrites every shop's services[] from the folded key to
-- `wedding_coordination`, which this function already accepted. It keeps a legacy
-- name answering the same as its new home.
--
-- The Date & feng-shui consultant is NOT added: v2 files it on the coordinator tile but
-- as its OWN service, and putting it on the day-of gates would be an access change.
--
-- Body otherwise identical to 20271280303462; grants unchanged.

CREATE OR REPLACE FUNCTION public.services_make_a_coordinator(p_services text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE(p_services, ARRAY[]::text[]) && ARRAY[
    'coordinator',
    'planner_coordinator',
    'wedding_coordination',
    'wedding_planner_partial',
    'day_of_coordinator',
    'destination_wedding_specialist',
    'pamamanhikan_coordinator',
    'despedida_planner',
    'sponsor_coordinator',
    'gender_separated_reception_coordinator',
    'religious_venue_coordinator',
    'inc_wedding_coordinator',
    'mahr_coordination',
    'wedding_day_weather_forecaster',
    'setnayan_concierge'
  ]::text[];
$$;

COMMENT ON FUNCTION public.services_make_a_coordinator(text[]) IS
  'Is this services[] the coordinator trade, under any of its names (tile, coarse '
  'category, canonical leaves)? SQL copy of COORDINATOR_TRADE_SERVICES '
  '(apps/web/lib/coordinator-trade.ts); a unit test holds the two equal.';

REVOKE ALL ON FUNCTION public.services_make_a_coordinator(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.services_make_a_coordinator(text[]) TO service_role;
