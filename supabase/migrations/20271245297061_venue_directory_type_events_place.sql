-- ============================================================================
-- 20271245297061_venue_directory_type_events_place.sql
--
-- The venue DIRECTORY learns the word "events place".
--
-- Follow-up to 20271244482831 (which let a couple choose `events_place` as
-- their reception setting). Owner, 2026-09-23: "Where is the event place."
-- Until now the directory had no such type, so an events-place couple was
-- recommended hotel ballrooms (the mapping in lib/venue-settings.ts said so
-- out loud). This adds the type so an admin can file an events place as one.
--
-- ⚠ NOT an alias of `multi_purpose_hall`: 20260604000000 defines that value as
-- church halls, school auditoriums and sports halls — budget civic rooms, not a
-- commercial events place. A near-synonym with a documented different meaning
-- is how two admins file the same venue under different types.
--
-- ── ENUM ADD VALUE ONLY, NOTHING THAT USES IT ──────────────────────────────
-- A value added by ALTER TYPE … ADD VALUE cannot be referenced in the same
-- transaction (the shape 20260604000000 documents). So this file adds it and
-- verifies it in the catalog; no row, default, index or CHECK references it.
-- Forward-only: no row is rewritten.
--
-- ⚠ ORDERING, for whoever reads prod later: `deploy-prod` applies migrations
-- BEFORE it triggers the Vercel build. If that build fails, prod carries this
-- enum value (and 20271244482831's widened CHECK) with no deployed UI behind
-- either. That is schema-ahead-of-code, the safe direction, and additive both
-- times — not a half-applied migration.
-- ============================================================================

ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'events_place';

DO $postcondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'venue_directory_type' AND e.enumlabel = 'events_place'
  ) THEN
    RAISE EXCEPTION 'venue_directory_type does not carry events_place after ADD VALUE';
  END IF;
END
$postcondition$;
