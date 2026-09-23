-- ============================================================================
-- 20271244482831_venue_setting_events_place.sql
--
-- A host can finally say their reception is at an EVENTS PLACE.
--
-- Owner, 2026-09-23, on a supplier's "Venues you work" card: *"Venues here are
-- different from our options. Where is the event place. this means the data is
-- wrong."* Measured the same day: the couple's onboarding offers seven
-- reception settings (Hotel ballroom · Events place · Heritage · Restaurant ·
-- Garden · Beach · Resort/destination) and `lib/vendor-venue-type.ts` matches
-- them key for key — but `events.venue_setting` had no `events_place`, so the
-- onboarding write map collapsed BOTH "Events place" AND "Restaurant" onto
-- `banquet_hall` (restaurant needlessly: it has been a legal value since
-- 20271114090000). A couple who chose an events place was stored as a hotel
-- ballroom, and no supplier could ever be matched to what they actually chose.
-- Nothing errored at any layer. It simply could not be expressed.
--
-- ── THIS IS A WIDENING, SO NO EXISTING ROW CAN FAIL IT ──────────────────────
-- Every current value stays allowed and no row is rewritten. DROP + ADD inside
-- one transaction, the shape 20271114090000 and 20271197508087 used.
--
-- ⚠ FORWARD-ONLY, ON PURPOSE. The 9 rows measured at `banquet_hall` on
-- 2026-09-23 are ambiguous BY CONSTRUCTION — the old write map put an events
-- place, a restaurant and a hotel ballroom on the same bytes — so no backfill
-- can know what each couple chose. Rewriting them would be guessing at a real
-- wedding's venue. Those rows are reported to the owner, not touched here.
--
-- ⚠ The application-side list is `apps/web/lib/venue-settings.ts`
-- (VENUE_SETTINGS); `venue-settings.test.ts` pins THIS file for the reception
-- constraint and fails if the two disagree. The ceremony constraint
-- (`events_ceremony_venue_setting_check`) is NOT restated here — it is
-- unchanged and stays pinned to 20271197508087.
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
      'events_place'::text,
      'restaurant'::text,
      'garden'::text,
      'beach'::text,
      'destination'::text,
      'heritage'::text,
      'outdoor_tent'::text
    ])
  );

COMMENT ON CONSTRAINT events_venue_setting_check ON public.events IS
  'Reception settings a host may choose. Mirrored in apps/web/lib/venue-settings.ts '
  '(VENUE_SETTINGS) and guarded by venue-settings.test.ts. restaurant added '
  '2026-08-05; events_place added 2026-09-23 per owner ("Where is the event place").';

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
    RAISE EXCEPTION 'events_venue_setting_check is missing — the reception column is now unconstrained';
  END IF;
  IF v_def NOT LIKE '%''events_place''%' THEN
    RAISE EXCEPTION 'events_venue_setting_check does not allow events_place: %', v_def;
  END IF;
  IF v_def NOT LIKE '%''restaurant''%' OR v_def NOT LIKE '%''outdoor_tent''%' THEN
    RAISE EXCEPTION 'events_venue_setting_check lost a value it must keep: %', v_def;
  END IF;
  IF v_def LIKE '%''civil_registrar''%' THEN
    RAISE EXCEPTION 'events_venue_setting_check re-admitted civil_registrar (a CEREMONY venue, removed 2026-09-03): %', v_def;
  END IF;
END
$postcondition$;

COMMIT;
