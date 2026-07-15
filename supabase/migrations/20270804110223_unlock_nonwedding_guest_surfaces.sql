-- unlock_nonwedding_guest_surfaces
-- Owner-decided 2026-07-12 ("no not wedding first at v1, we unlock all now").
--
-- Enable the GUEST-FACING surfaces — website / save_the_date / rsvp — for EVERY
-- non-wedding event type, reversing the weddings-first surface gating. Until now
-- non-wedding event_type_profiles enabled only the dashboard/day-of tools
-- (seating/budget/schedule/day_of/gallery), so app/[slug] never rendered their
-- public event site (surfaceEnabled(profile,'website') was false → vendor
-- fallback). `website` is the master flag: it drives the whole public lifecycle
-- (save_the_date → rsvp → event → editorial) in app/[slug]/page.tsx.
--
-- SAFE because the site copy was generalized FIRST (PR #3207, eventNounOf) so a
-- non-wedding no longer renders "wedding" text, and the render path is
-- null-guarded (ceremony_type ?? null, Array.isArray(our_photos), love_story
-- passed as a nullable prop — no crash). Wedding-only content SECTIONS (love
-- story, entourage) may render empty for non-weddings until the Stage-3 polish;
-- that's cosmetic, not a break.
--
-- Weddings are untouched: WEDDING_PROFILE already carries ALL_SURFACES, and this
-- UPDATE is scoped `WHERE event_type <> 'wedding'`. `monogram` stays OFF for
-- non-weddings (couple-initials-shaped; a later call). IDEMPOTENT —
-- array_agg(DISTINCT …) de-dupes, so re-running adds nothing.

UPDATE public.event_type_profiles
SET enabled_surfaces = (
  SELECT array_agg(DISTINCT s ORDER BY s)
  FROM unnest(enabled_surfaces || ARRAY['website', 'save_the_date', 'rsvp']) AS s
)
WHERE event_type <> 'wedding';
