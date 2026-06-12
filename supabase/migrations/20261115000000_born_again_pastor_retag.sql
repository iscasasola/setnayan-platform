-- ============================================================================
-- 20261115000000_born_again_pastor_retag.sql
--
-- Completeness-audit fix (2026-06-11): `born_again_pastor` was tagged
-- faith='Christian', but `born_again` is its own pickable ceremony_type — so a
-- Born Again couple's INCLUDE-only faith filter ({Born Again}) excluded their
-- OWN officiant (a pickable faith with a dead-end journey). Re-tag to
-- 'Born Again' (a seeded faith_vocab key). Christian couples keep their two
-- remaining pastors (charismatic_pastor, mainline_protestant_pastor).
-- The hardcoded lib/taxonomy.ts:577 tag is fixed in the SAME PR (it is the
-- fallback + a direct marketplace read — a DB-only change would leave stale TS
-- driving the filter, per the de-faith precedent).
-- ============================================================================

BEGIN;

UPDATE public.canonical_service_taxonomy
   SET faith = 'Born Again', updated_at = now()
 WHERE canonical_service = 'born_again_pastor'
   AND faith IS DISTINCT FROM 'Born Again';

DO $$
DECLARE f TEXT;
BEGIN
  SELECT faith INTO f FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'born_again_pastor';
  IF f IS DISTINCT FROM 'Born Again' THEN
    RAISE EXCEPTION 'born_again_pastor re-tag failed (faith=%)', f;
  END IF;
END $$;

COMMIT;
