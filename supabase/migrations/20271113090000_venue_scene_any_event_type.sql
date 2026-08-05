-- ============================================================================
-- 20271113090000_venue_scene_any_event_type.sql
--
-- The 3D venue stops refusing every event that is not a wedding.
--
-- `public_venue_scene` resolves the event with:
--
--     WHERE e.slug ILIKE p_slug AND e.event_type = 'wedding'
--
-- and returns `{"published": false}` when that finds nothing. So a debut, a
-- birthday or a christening host could build a floor plan, publish it, and
-- their guests were told "The 3D venue isn't ready yet" forever. Nothing on the
-- couple's side gates the seating editor by event type — the same defect the
-- Custom QR seat pass had, and the same reasoning: if 3D venues were meant to
-- be wedding-only, the limit would belong at the point of sale, not in a
-- function that quietly answers "not published" to a host who published.
--
-- All 16 rows of `event_type_profiles` currently enable `seating`, so this
-- changes no existing behaviour for any event type in production today. What it
-- changes is WHERE the decision lives: in the profile table the rest of the
-- product already asks, instead of a string literal inside a SECURITY DEFINER
-- function nobody reads.
--
-- ── WHY `seating` AND NOT `website` ─────────────────────────────────────────
-- The guest ROUTE is a website surface and is gated as one at the page. This
-- function serves the SEATING PLAN specifically, so it asks whether the event
-- type has seating at all. A future type with a website but no seating must not
-- get a 3D seating view; asking `website` here would give it one.
--
-- ── A MISSING PROFILE ROW MEANS ENABLED ─────────────────────────────────────
-- `GENERIC_PROFILE` in lib/event-type-profile.ts treats an unknown event type
-- as having the full generic surface set, and the fallback contract everywhere
-- in this codebase is "degrade to yesterday". A new event type added to the
-- enum before its profile row lands must not silently lose its venue — so the
-- check is NOT EXISTS(disabled), not EXISTS(enabled).
--
-- ── WHAT IS DELIBERATELY UNCHANGED ──────────────────────────────────────────
-- Everything else in the function is byte-identical to what is deployed. It
-- stays STABLE SECURITY DEFINER with `SET search_path TO 'public'`; the
-- `published_at IS NOT NULL` gate, `venue_photo_visibility`, the `p_token`
-- personal-seat scoping and the whole booth payload are untouched. This
-- migration rewrites ONE predicate and asserts that it rewrote only that.
--
-- ── WHY IT EDITS THE DEPLOYED BODY RATHER THAN RESTATING IT ─────────────────
-- The function is ~200 lines and has been amended by several migrations. Its
-- own history is why: `schema_migrations` has lied here before, and a
-- hand-retyped CREATE OR REPLACE would silently revert any amendment that
-- landed after the file being copied from. Reading `pg_get_functiondef` and
-- replacing one predicate cannot revert anything — whatever is live stays live,
-- minus the wedding-only clause. The post-conditions below prove it.
-- ============================================================================

BEGIN;

DO $migration$
DECLARE
  v_def       TEXT;
  v_new       TEXT;
  v_old_pred  CONSTANT TEXT := 'WHERE e.slug ILIKE p_slug AND e.event_type = ''wedding''';
  v_new_pred  CONSTANT TEXT :=
    'WHERE e.slug ILIKE p_slug'
    || E'\n    AND NOT EXISTS ('
    || E'\n      SELECT 1 FROM public.event_type_profiles p'
    || E'\n      WHERE p.event_type = e.event_type'
    || E'\n        AND NOT (''seating'' = ANY(p.enabled_surfaces))'
    || E'\n    )';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'public_venue_scene'
    AND pg_get_function_identity_arguments(p.oid) = 'p_slug text, p_token text';

  IF v_def IS NULL THEN
    RAISE EXCEPTION
      'public_venue_scene(text, text) not found — refusing to guess at its body.';
  END IF;

  -- Idempotent: a re-run finds the predicate already gone and does nothing.
  IF position(v_old_pred IN v_def) = 0 THEN
    IF position('event_type_profiles' IN v_def) > 0 THEN
      RAISE NOTICE 'public_venue_scene already asks the event-type profile — nothing to do.';
      RETURN;
    END IF;
    RAISE EXCEPTION
      'public_venue_scene no longer contains the expected wedding-only predicate, '
      'and does not yet ask the profile either. Someone changed the event '
      'resolution by hand — read the live body before re-running this.';
  END IF;

  -- Exactly one occurrence, or we do not know what we are editing.
  IF (length(v_def) - length(replace(v_def, v_old_pred, ''))) / length(v_old_pred) <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one wedding-only predicate in public_venue_scene, found %.',
      (length(v_def) - length(replace(v_def, v_old_pred, ''))) / length(v_old_pred);
  END IF;

  v_new := replace(v_def, v_old_pred, v_new_pred);
  EXECUTE v_new;
END
$migration$;

-- ── POST-CONDITIONS ─────────────────────────────────────────────────────────
-- Asserted against the CATALOG, not against this file. `schema_migrations` has
-- reported this repo's migrations as applied when the object did not change, so
-- the only trustworthy evidence is what the function body actually says now.
DO $postcondition$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'public_venue_scene';

  IF position('e.event_type = ''wedding''' IN v_def) > 0 THEN
    RAISE EXCEPTION 'the wedding-only predicate is still there';
  END IF;
  IF position('event_type_profiles' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the profile check did not land';
  END IF;

  -- The guards that must have survived the edit. Each one is a thing a careless
  -- rewrite of this function would drop, and each protects a different person.
  IF position('SECURITY DEFINER' IN v_def) = 0 THEN
    RAISE EXCEPTION 'SECURITY DEFINER was lost — the function would stop working for anonymous guests';
  END IF;
  IF position('SET search_path TO ''public''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'search_path pinning was lost on a SECURITY DEFINER function';
  END IF;
  IF position('fp.published_at IS NOT NULL' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the published gate was lost — unpublished plans would leak';
  END IF;
  IF position('venue_photo_visibility' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the photo-visibility scoping was lost — guest faces would leak';
  END IF;
  IF position('g.qr_token = btrim(p_token)' IN v_def) = 0 THEN
    RAISE EXCEPTION 'the personal-seat token scoping was lost';
  END IF;
END
$postcondition$;

COMMIT;
