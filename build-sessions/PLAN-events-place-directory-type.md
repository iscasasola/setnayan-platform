# PLAN — `events_place` joins the venue DIRECTORY (follow-up to PR #5926) · 2026-09-23

**Status: PLAN ONLY. Not launched. Owner said "stop adding new builds" (2026-09-23).**

## Why it exists
PR #5926 made `events_place` a reception setting a couple can choose and a supplier can match on. The venue **directory** (`public.venue_directory_type`, the admin-seeded venue list that Explore recommends from) still has no such word, so an events-place couple is recommended `hotel_ballroom` venues — recorded as a temporary lie in `VENUE_SETTING_TO_DIRECTORY_TYPE` (lib/venue-settings.ts) and in `venueSettingToDirectoryType` (lib/venue-recommendations.ts). This plan removes that lie. Its own 3D look is a separate, optional drawing task.

## What exists (measured, do not rebuild)
- `venue_directory_type` is a Postgres **ENUM** (migration `20260604000000_venue_directory_reception_support.sql`, `ALTER TYPE … ADD VALUE IF NOT EXISTS`). Current reception values: hotel_ballroom · garden · beach · destination_resort · heritage · outdoor_tent · restaurant · multi_purpose_hall (+ four era-2 duplicates deliberately unoffered).
- Admin pickers re-type the list: `app/admin/venues/_constants.ts` (`VENUE_TYPES`), `app/admin/venues/_components/venue-form.tsx` (labels), `app/admin/accounts/_surfaces/venues-surface.tsx` (labels).
- Guard `app/admin/venues/venue-types-have-a-home.test.ts`: every enum value is either offered on both admin surfaces or in `DELIBERATELY_EXCLUDED` with a reason.
- Guard `lib/venue-settings.test.ts` "BOTH directions of the mapping are wired, separately": `venueSettingToDirectoryType` AND `venueTypeToSetting` must each carry a `case` for every pair in `VENUE_SETTING_TO_DIRECTORY_TYPE`.
- `app/(shell)/explore/actions.ts` classifies directory types into `religious_venue | venue` in a switch (`default → 'venue'`, so a new value is safe there).
- `multi_purpose_hall` is NOT an events place (its migration comment: church halls, school auditoriums) — do not alias.

## The delta (one PR, forward-only)
1. **Migration** (`pnpm migration:new venue_directory_type_events_place`): `ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'events_place';` — ⚠ a new enum value cannot be USED in the same transaction that adds it; keep the migration to the ADD (plus a post-condition reading `pg_enum`), exactly as 20260604000000 does. No row rewritten.
2. `VENUE_SETTING_TO_DIRECTORY_TYPE.events_place: 'events_place'` and delete the "temporary lie" comment; `venueSettingToDirectoryType` case → `'events_place'`; `venueTypeToSetting` gains `case 'events_place': return 'events_place'`.
3. Admin: add `events_place` to `VENUE_TYPES` with label **"Events place"** on both surfaces (the owner's word; not "Events Venue").
4. Guards: `venue-types-have-a-home.test.ts` passes by construction once both labels exist; `venue-settings.test.ts` both-directions test passes once both cases exist. Add one executing assertion: `venueTypeToSetting('events_place') === 'events_place'` and the round-trip.
5. Ugat: the enum change may trip `ugat-schema-claims` if the map states the enum's members — run both Ugat db tests; add the value to the claim, never weaken the check.

## Sabotages to watch red
- Remove the `venueTypeToSetting` case → "BOTH directions" test red.
- Drop the label from one admin surface → venue-types-have-a-home red.

## Not in this plan
- A 3D look of its own (`archetypeFor('events_place')` stays the hall; `venue-archetype-coverage.test.ts` carries the exemption with the reason).
- Backfill of the 9 ambiguous `banquet_hall` events — owner's call, separate.
- Seeding directory rows of type `events_place` — content, admin's job via /admin/venues.

Effort: ~1 hour incl. db tests. Model: any; no design decisions inside.
