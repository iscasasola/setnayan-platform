-- ============================================================================
-- 20271114090000_venue_setting_restaurant.sql
--
-- A host can finally say their reception is at a RESTAURANT.
--
-- Owner, 2026-08-05: *"we should allow restaurants to be venues as well?"* —
-- asked after finding the product could not describe one at FOUR layers at once:
--
--   1. `events.venue_setting` allowed 7 values and `restaurant` was not one, so
--      a couple could not say it. The nearest choice was "banquet hall".
--   2. `venue_directory_type` DID have `restaurant` — the marketplace's
--      vocabulary already knew the concept the couple's did not.
--   3. …but the directory holds ZERO restaurant rows, so even that side had no
--      content behind the word.
--   4. Both mapping functions returned NULL for it, and the 3D plan drew a
--      hotel ballroom.
--
-- Nothing errored at any layer. It simply could not be expressed.
--
-- It matters most for the event types opened the same day (the seat pass,
-- #4139, and the 3D venue, #4140): a christening, birthday or debut reception
-- at a restaurant is arguably the commonest Philippine case, and it was the one
-- shape the product had no way to describe.
--
-- ── THIS IS A WIDENING, SO NO EXISTING ROW CAN FAIL IT ──────────────────────
-- Every current value stays allowed and no row is rewritten. A CHECK is
-- re-created rather than altered because Postgres has no ALTER CONSTRAINT for
-- the expression; DROP + ADD inside one transaction is the standard shape and
-- is what the constraint's original migration used.
--
-- ⚠ The application-side list is `apps/web/lib/venue-settings.ts`, and
-- `venue-settings.test.ts` fails if this constraint and that file disagree.
-- Before this change the same seven values were hand-written in SEVEN places
-- (this CHECK, three server-action allowlists, the couple's picker, and two
-- label maps on Explore) and missing any one of them fails differently and
-- silently: a rejected save, an unofferable option, or a chip rendering raw
-- snake_case.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_venue_setting_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_venue_setting_check
  CHECK (
    venue_setting IS NULL
    OR venue_setting = ANY (ARRAY[
      'banquet_hall'::text,
      'restaurant'::text,
      'garden'::text,
      'beach'::text,
      'destination'::text,
      'heritage'::text,
      'outdoor_tent'::text,
      'civil_registrar'::text
    ])
  );

COMMENT ON CONSTRAINT events_venue_setting_check ON public.events IS
  'Reception settings a host may choose. Mirrored in apps/web/lib/venue-settings.ts '
  '(VENUE_SETTINGS) and guarded by venue-settings.test.ts. restaurant added '
  '2026-08-05 per owner.';

-- ── POST-CONDITIONS ─────────────────────────────────────────────────────────
-- Against the catalog, not this file. A widening that silently did not apply
-- looks exactly like one that did until a host tries to save.
DO $postcondition$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.events'::regclass
    AND c.conname = 'events_venue_setting_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'events_venue_setting_check is missing — the table is now unconstrained';
  END IF;
  IF position('restaurant' IN v_def) = 0 THEN
    RAISE EXCEPTION 'restaurant did not land in the constraint';
  END IF;

  -- Every pre-existing value must still be allowed. A widening that quietly
  -- dropped one would reject saves for hosts who chose it months ago.
  FOR v_def IN
    SELECT unnest(ARRAY['banquet_hall','garden','beach','destination',
                        'heritage','outdoor_tent','civil_registrar'])
  LOOP
    IF position(v_def IN (
      SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
      WHERE c.conrelid = 'public.events'::regclass
        AND c.conname = 'events_venue_setting_check'
    )) = 0 THEN
      RAISE EXCEPTION 'the widening DROPPED an existing venue setting: %', v_def;
    END IF;
  END LOOP;

  -- And nothing already stored may now be illegal.
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.venue_setting IS NOT NULL
      AND e.venue_setting <> ALL (ARRAY['banquet_hall','restaurant','garden','beach',
                                        'destination','heritage','outdoor_tent','civil_registrar'])
  ) THEN
    RAISE EXCEPTION 'an existing event holds a venue_setting the new constraint forbids';
  END IF;
END
$postcondition$;

COMMIT;
