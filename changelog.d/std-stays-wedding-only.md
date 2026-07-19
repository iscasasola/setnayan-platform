# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · fix(events): keep Save-the-Date wedding-only in the unlock (STD is wedding-signature content)

Follow-up to the Stage-2 unlock (#3210), which enabled `website` + `save_the_date` + `rsvp` for all non-wedding event types. On review, `save_the_date` shouldn't have been in that set: the STD studio builds a **cinematic reveal** (veil / four-flap / church-doors openings) over a wedding content film — that's wedding-*signature content*, not a noun swap, so surfacing it inside a birthday/anniversary dashboard (the studio cards gate on `surfaceEnabled`) would look broken. `website` + `rsvp` (the core guest experience — event site, schedule, RSVP, day-of) stay unlocked.

- **migration `20270804751948_std_stays_wedding_only.sql`** — `array_remove(enabled_surfaces, 'save_the_date')` for every non-wedding profile (idempotent; `WHERE event_type <> 'wedding'` so weddings keep it).
- **`lib/event-type-profile.ts`** — drop `save_the_date` from `GENERIC_PROFILE.enabledSurfaces` (the code fallback), matching the DB.

Guests still see a save-the-date *phase* on the public site — that's `website`-gated, not the STD surface. Unlocking the STD *studio* for non-weddings is a separate later call once its reveal content is generalized. `monogram` likewise stays off (couple-initials-shaped).

Verified: `tsc --noEmit` clean; migration doctor healthy.

SPEC IMPACT: The non-wedding unlock is `website` + `rsvp` only; Save-the-Date's cinematic reveal stays wedding-only pending content generalization. See `DECISION_LOG.md`.
