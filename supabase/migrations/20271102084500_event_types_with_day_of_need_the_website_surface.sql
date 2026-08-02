-- An event type that has a DAY-OF page must also have the WEBSITE surface.
--
-- Owner, 2026-08-02: "the host of the event cannot launch his on the day
-- website." Reproduced and traced: `simple_event` enabled `day_of` and `gallery`
-- but NOT `website`.
--
-- Those are not independent switches. `day_of` and `gallery` RENDER ON the
-- public event site; `website` is the surface that makes that site editable and
-- carries the ONLY "go live" control in the product. There are exactly two
-- launch buttons and both sit behind a surface check:
--
--   /dashboard/[id]/studio/save-the-date  -> requires 'save_the_date'
--   /dashboard/[id]/website/editor        -> requires 'website'
--
-- A simple-event host had neither, so both redirected them to the dashboard and
-- their site stayed PRIVATE FOREVER. Guests could never open it — which took the
-- guest camera, the personal QR and the gallery with it, since all three live on
-- that site. Enabling the day-of experience while disabling the only switch that
-- turns it on is a contradiction, not a scope choice.
--
-- ── WHY A MIGRATION AND NOT JUST THE CODE FALLBACK ─────────────────────────
-- `resolveProfile` prefers `event_type_profiles.enabled_surfaces` and only falls
-- back to the hardcoded profile when no row exists. Fixing the TypeScript alone
-- would leave any seeded row still broken — and the seeded row is what prod
-- reads. Both halves ship together.
--
-- ── SHAPE: DERIVED, NOT A LIST OF EVENT TYPES ─────────────────────────────
-- Written as "whoever has day_of or gallery and lacks website" rather than
-- "simple_event", so a type added later with the same combination is repaired
-- by this rule instead of reintroducing the dead end. Idempotent: re-running
-- changes nothing once every row satisfies it.
--
-- No ACL statements — this is a data UPDATE on an existing table; grants are
-- untouched.

UPDATE public.event_type_profiles
   SET enabled_surfaces = array_append(enabled_surfaces, 'website')
 WHERE enabled_surfaces IS NOT NULL
   AND NOT ('website' = ANY(enabled_surfaces))
   AND ('day_of' = ANY(enabled_surfaces) OR 'gallery' = ANY(enabled_surfaces));
