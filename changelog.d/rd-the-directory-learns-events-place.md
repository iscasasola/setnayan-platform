## 2026-09-23 · fix(venues): the venue directory learns "events place"

Follow-up to #5926, stacked on it. Owner, 2026-09-23: *"Where is the event place."* — then *"build it"*. #5926 let a couple choose `events_place` as their reception; the venue directory (`venue_directory_type`) still had no such type, so an events-place couple was recommended hotel ballrooms, recorded in the map as a temporary lie. This removes it.

- **Migration `20271245297061_venue_directory_type_events_place.sql`** — `ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'events_place'`, and nothing that uses the value (an added enum value cannot be referenced in its own transaction). Post-condition reads `pg_enum`. Forward-only.
- `VENUE_SETTING_TO_DIRECTORY_TYPE.events_place` and `venueSettingToDirectoryType` now say `events_place`; `venueTypeToSetting` carries the inverse; `RECEPTION_VENUE_TYPES` includes it so the Reception folder lists events places with no facet chosen; `displayVenueType` labels it "Events Place"; Explore's classifier names it as a reception venue.
- Admin: offered in `VENUE_TYPES` with its label on both surfaces (`venue-form.tsx`, `venues-surface.tsx`); `venue-types-have-a-home.test.ts` enum list updated.
- ⛔ **Not an alias of `multi_purpose_hall`** — its migration (20260604000000) defines that as church halls, school auditoriums and sports halls.
- Test: every reception setting round-trips setting → directory type → setting, `events_place` included; `multi_purpose_hall` maps to no setting. Sabotages watched red: the inverse case removed; the label removed from one admin surface.
- ⚠ **Ordering:** this and #5926's CHECK widening are both queued ahead of a deploy path that has failed today. `deploy-prod` applies migrations before triggering Vercel, so prod may carry the enum value and the widened CHECK with no deployed UI behind either — schema ahead of code, additive both times, not a half-applied migration.
- Noticed, not changed: `RECEPTION_VENUE_TYPES` also omits `restaurant`, so restaurants only appear in the Reception folder when the couple's own setting is restaurant.

SPEC IMPACT: None beyond the 2026-09-23 DECISION_LOG row (reception vocabulary is the couple's).
