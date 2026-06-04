-- 20260808000000_add_jewish_bornagain_ceremony_types.sql
-- Owner-directed 2026-06-04: lock the wedding ceremony-tradition set at EIGHT and
-- ship Jewish + Born Again as FULLY SELECTABLE (not coming-soon), alongside
-- Catholic / Civil / INC / Christian / Muslim / Cultural / Chinese.
--
-- Jewish also resolves the dangling kosher tags already in the 0044
-- faith_compatibility group (which previously had no Jewish ceremony_type to
-- trigger them). Born Again is split out from the "Christian" umbrella into its
-- own selectable tradition per owner.
--
-- This migration widens the four ceremony_type CHECK constraints to permit the
-- two new values and seeds their wedding_type_launch_status rows as 'active'.
-- The matching code commit adds them to the onboarding picker chips (now a
-- fixed 4-col x 2-row grid of 8), the ALLOWED_* commit allow-lists (onboarding /
-- create-event / dashboard modal), the vendor-side compatible_ceremony_types
-- option list, and the /vendors marketplace faith filter.
--
-- Note: vendor_profiles.compatible_ceremony_types is a free TEXT[] (GIN-indexed,
-- no element CHECK), so the vendor-tagging side needs no constraint change.
--
-- The four constraints were given stable names by 20260804000000, so we
-- DROP IF EXISTS by name and re-ADD widened. Idempotent + re-runnable.

-- 1. events.ceremony_type (primary) — NULL allowance preserved (iteration 0041).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_type_check
  CHECK (
    ceremony_type IS NULL
    OR ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again','mixed')
  );

-- 2. events.secondary_ceremony_type — second rite of a Mixed/interfaith wedding
--    (e.g. Catholic primary + Jewish or Chinese secondary). 'mixed' is not a
--    valid secondary.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_ceremony_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_secondary_ceremony_check
  CHECK (
    secondary_ceremony_type IS NULL
    OR secondary_ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again')
  );

-- 3. wedding_type_launch_status.ceremony_type.
ALTER TABLE public.wedding_type_launch_status DROP CONSTRAINT IF EXISTS wedding_type_launch_status_ceremony_type_check;
ALTER TABLE public.wedding_type_launch_status
  ADD CONSTRAINT wedding_type_launch_status_ceremony_type_check
  CHECK (ceremony_type IN ('catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again'));

-- 4. couple_wedding_type_notify_signups.ceremony_type_interested.
ALTER TABLE public.couple_wedding_type_notify_signups DROP CONSTRAINT IF EXISTS couple_wedding_type_notify_signups_ceremony_interested_check;
ALTER TABLE public.couple_wedding_type_notify_signups
  ADD CONSTRAINT couple_wedding_type_notify_signups_ceremony_interested_check
  CHECK (ceremony_type_interested IN ('catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again'));

-- 5. Seed the two new launch-status rows as ACTIVE so the create-event picker
--    (data-driven by this table) renders them selectable immediately. Idempotent
--    — flips to active even if a row somehow pre-exists as coming_soon.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status, activated_at)
VALUES
  ('jewish',     'all', 'active', now()),
  ('born_again', 'all', 'active', now())
ON CONFLICT (ceremony_type, region) DO UPDATE
  SET status = 'active',
      activated_at = COALESCE(wedding_type_launch_status.activated_at, EXCLUDED.activated_at);
