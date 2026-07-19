-- std_stays_wedding_only
-- Follow-up correction to 20270804110223_unlock_nonwedding_guest_surfaces.sql.
--
-- That migration unlocked website + save_the_date + rsvp for all non-wedding
-- event types. But the Save-the-Date is a wedding-SIGNATURE feature — the STD
-- studio builds a cinematic reveal (veil / four-flap / church-doors openings) over
-- a wedding content film. That's CONTENT, not a noun swap, so it would look broken
-- surfaced inside a birthday/anniversary dashboard. So keep it wedding-only for
-- now: remove `save_the_date` from every non-wedding profile it was added to.
-- `website` + `rsvp` (the core guest experience) stay unlocked.
--
-- Weddings keep save_the_date (WEDDING_PROFILE = ALL_SURFACES; scoped
-- `WHERE event_type <> 'wedding'`). Idempotent — array_remove is a no-op when the
-- element is absent. Unlocking STD for non-weddings is a separate later call once
-- its reveal content is generalized.

UPDATE public.event_type_profiles
SET enabled_surfaces = array_remove(enabled_surfaces, 'save_the_date')
WHERE event_type <> 'wedding';
