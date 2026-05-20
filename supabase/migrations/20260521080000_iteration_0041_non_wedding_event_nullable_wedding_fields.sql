-- ============================================================================
-- 20260521080000_iteration_0041_non_wedding_event_nullable_wedding_fields.sql
--
-- Iteration 0041 — Multi-event support. Eliminates the wedding-themed
-- leakage on non-wedding events: when V1.1 enabled `gender_reveal` and
-- `debut` as creatable event_types (PRs #177 / #178), every non-wedding
-- row landed with `ceremony_type='catholic'` and `venue_setting='banquet_hall'`
-- because the 0043 columns are `NOT NULL DEFAULT 'catholic'/'banquet_hall'`.
-- The UI hid those columns for non-wedding events but the DB still carried
-- semantically wrong values.
--
-- This migration:
--   1. Drops NOT NULL + DEFAULT on `ceremony_type` and `venue_setting`.
--   2. Backfills NULL into both columns for every non-wedding row that
--      currently carries the wedding defaults.
--   3. Replaces the domain-check constraints so they tolerate NULL.
--   4. Adds a new biconditional CHECK enforcing:
--        event_type = 'wedding'  ↔  ceremony_type IS NOT NULL
--                                AND venue_setting IS NOT NULL
--      i.e. wedding rows require both; non-wedding rows require both to be
--      NULL. The form-side actions enforce the same rule client-side; this
--      DB CHECK is the last line of defense against ad-hoc SQL inserts.
--
-- The two conditional CHECK constraints from 0043
-- (`events_sub_type_required_when_muslim_or_cultural` +
-- `events_secondary_required_when_mixed`) tolerate NULL ceremony_type
-- naturally: in Postgres, a CHECK that evaluates to NULL is treated as
-- satisfied. `ceremony_type NOT IN ('muslim','cultural')` with NULL
-- ceremony_type evaluates NULL → constraint not violated.
-- `is_mixed_ceremony = FALSE` (the default for non-wedding) makes the
-- secondary-required check vacuous. No changes needed there.
--
-- Idempotent — DROP IF EXISTS + ADD CONSTRAINT pattern; re-run is a no-op
-- once the new state is in place.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop NOT NULL + DEFAULT on the two wedding-specific columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.events ALTER COLUMN ceremony_type DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN venue_setting DROP NOT NULL;
ALTER TABLE public.events ALTER COLUMN ceremony_type DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN venue_setting DROP DEFAULT;

-- ----------------------------------------------------------------------------
-- 2. Backfill — NULL out wedding-specific fields on non-wedding rows
--
-- The brief window debut + gender_reveal were enabled created rows that
-- carry the silent defaults. We also NULL out ceremony_sub_type +
-- secondary_ceremony_type + force is_mixed_ceremony=FALSE so the row's
-- wedding-flavored state matches the new ceremony_type=NULL.
-- ----------------------------------------------------------------------------

UPDATE public.events
SET
  ceremony_type            = NULL,
  venue_setting            = NULL,
  ceremony_sub_type        = NULL,
  is_mixed_ceremony        = FALSE,
  secondary_ceremony_type  = NULL
WHERE event_type::text != 'wedding'
  AND (ceremony_type IS NOT NULL OR venue_setting IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 3. Replace domain-check constraints to allow NULL
-- ----------------------------------------------------------------------------

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_type_check
  CHECK (
    ceremony_type IS NULL
    OR ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','mixed')
  );

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_setting_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_venue_setting_check
  CHECK (
    venue_setting IS NULL
    OR venue_setting IN ('banquet_hall','garden','beach','destination','heritage','outdoor_tent','civil_registrar')
  );

-- ----------------------------------------------------------------------------
-- 4. New biconditional — wedding-only fields are populated iff event_type='wedding'
-- ----------------------------------------------------------------------------

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_wedding_fields_consistency;
ALTER TABLE public.events
  ADD CONSTRAINT events_wedding_fields_consistency
  CHECK (
    (event_type::text =  'wedding' AND ceremony_type IS NOT NULL AND venue_setting IS NOT NULL)
    OR
    (event_type::text <> 'wedding' AND ceremony_type IS NULL     AND venue_setting IS NULL)
  );

COMMIT;
