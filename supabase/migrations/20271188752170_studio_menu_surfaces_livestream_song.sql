-- 20271188752170_studio_menu_surfaces_livestream_song.sql
--
-- S1 (owner-ruled 2026-09-01): "when we click the event, the studio should
-- adapt to the event itself, and only show the services that works for that
-- event." The Studio sidebar's Live Studio and Pakanta rows have no
-- `ProfileSurface` of their own yet, so `lib/add-on-event-scope.ts`'s ONE
-- event-type gate cannot hide them anywhere they don't belong. Two new
-- surfaces close that:
--
--   livestream — hidden on date · hangout · travel
--   song       — hidden on date · hangout · travel · simple_event
--
-- (Logo Maker/monogram and 3D Plan/seating already ride EXISTING surfaces —
-- nothing to add for those two.)
--
-- Measured live 2026-09-01 (17 seeded rows): date/hangout/travel already lack
-- `seating`, and simple_event already lacks `budget` and has
-- `marketplace_enabled = false` — this migration only ADDS the two new
-- surfaces to the rows the ruling says should keep Live Studio / Pakanta, and
-- touches nothing else. IDEMPOTENT: re-running never duplicates an entry
-- already present, and never adds to a row the ruling excludes.
--
-- 'livestream' / 'song' are also added to the `ProfileSurface` union in
-- apps/web/lib/event-type-profile.ts in the same PR — a value in this column
-- that the TS union doesn't know is filtered out by `toProfile()`'s
-- `ALL_SURFACES` check, so the code change must land together with this data
-- change for either to have effect.

UPDATE public.event_type_profiles
SET enabled_surfaces = enabled_surfaces || ARRAY['livestream']::text[]
WHERE event_type NOT IN ('date', 'hangout', 'travel')
  AND NOT ('livestream' = ANY(enabled_surfaces));

UPDATE public.event_type_profiles
SET enabled_surfaces = enabled_surfaces || ARRAY['song']::text[]
WHERE event_type NOT IN ('date', 'hangout', 'travel', 'simple_event')
  AND NOT ('song' = ANY(enabled_surfaces));

-- ── Post-conditions ─────────────────────────────────────────────────────────
DO $$
DECLARE
  bad TEXT;
BEGIN
  -- (a) livestream is on everything except date/hangout/travel.
  SELECT string_agg(event_type, ', ') INTO bad
  FROM public.event_type_profiles
  WHERE event_type NOT IN ('date', 'hangout', 'travel')
    AND NOT ('livestream' = ANY(enabled_surfaces));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'expected livestream surface on: %', bad;
  END IF;

  SELECT string_agg(event_type, ', ') INTO bad
  FROM public.event_type_profiles
  WHERE event_type IN ('date', 'hangout', 'travel')
    AND 'livestream' = ANY(enabled_surfaces);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'livestream surface must stay OFF for: %', bad;
  END IF;

  -- (b) song is on everything except date/hangout/travel/simple_event.
  SELECT string_agg(event_type, ', ') INTO bad
  FROM public.event_type_profiles
  WHERE event_type NOT IN ('date', 'hangout', 'travel', 'simple_event')
    AND NOT ('song' = ANY(enabled_surfaces));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'expected song surface on: %', bad;
  END IF;

  SELECT string_agg(event_type, ', ') INTO bad
  FROM public.event_type_profiles
  WHERE event_type IN ('date', 'hangout', 'travel', 'simple_event')
    AND 'song' = ANY(enabled_surfaces);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'song surface must stay OFF for: %', bad;
  END IF;

  -- (c) monogram stays wedding-only — this migration must not have widened it.
  SELECT string_agg(event_type, ', ') INTO bad
  FROM public.event_type_profiles
  WHERE event_type <> 'wedding'
    AND 'monogram' = ANY(enabled_surfaces);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'monogram surface leaked to: %', bad;
  END IF;
END $$;
