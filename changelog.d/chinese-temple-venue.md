## 2026-06-28 · feat(venues): add temple ceremonial venue type

Adds a `temple` value to the `public.venue_directory_type` Postgres ENUM and
threads it through every hardcoded TS mirror of that enum, so admins can create
+ filter **temple** venues and the platform treats a temple as a religious /
ceremonial venue. This closes the onboarding 🛕 **Temple** promise — the
ceremony-venue picker already renders a Temple card for Chinese-faith couples
(`onboarding-shell.tsx` `WORSHIP_OPT`), but the platform had no `venue_type` a
temple could BE, so the card was undeliverable. `ceremony_type='chinese'` has
been active since `20260804000000` and `venue_directory.compatible_ceremony_types[]`
already accepts `'chinese'` (free-text array), so the only missing piece was
the ceremonial venue type itself.

- Migration `20270309000000_add_temple_venue_type.sql` (NEW):
  `ALTER TYPE public.venue_directory_type ADD VALUE IF NOT EXISTS 'temple';`.
  The ALTER is kept outside any explicit BEGIN/COMMIT block (a freshly-added
  enum value is not usable in the same transaction that adds it), and the
  migration seeds **no** temple row — real temple venues are admin-created via
  `/admin/venues`; a fake marketplace row is undesirable. `'ancestral_hall'`
  was deferred by the owner and is NOT added.
- `app/admin/venues/_constants.ts` — `'temple'` added to the `VENUE_TYPES`
  tuple (the `VenueType` type + `parseForm` validation in `actions.ts` ride it,
  so the admin form now accepts temple).
- `app/admin/venues/_components/venue-form.tsx` — `temple: 'Temple'` added to
  the exhaustive `VENUE_TYPE_LABEL` record (required — a missing key is a TS
  error / blank `<select>` option).
- `app/admin/venues/page.tsx` — `'temple'` added to the second, independent
  hardcoded `VENUE_TYPE_FILTERS` list (drives the stats strip + type filter) so
  temple venues are listable/filterable.
- `lib/venue-recommendations.ts` — `'temple'` added to `CEREMONY_VENUE_TYPES`
  (surfaces temple in the Ceremony folder / `findCeremonyVenuesByFaith`) and a
  `temple → 'Temple'` case added to `displayVenueType()` so the chip shows a
  human label instead of the raw key.
- `lib/religion-readiness.ts` — `'temple'` added to `CEREMONIAL_VENUE_TYPES`
  (without it the Chinese / Buddhist / Taoist venue-readiness count is
  structurally always 0).
- `app/explore/actions.ts` — `case 'temple': return 'religious_venue';` added
  to `venueDirectoryTypeToCategory()` (else a temple added to a plan is
  miscategorized as a generic reception `'venue'`).

SPEC IMPACT: Additive only — every existing `venue_directory_type` value is
preserved; only `'temple'` is added. Delivers the onboarding 🛕 Temple promise
(0043 ceremony-venue picker / Chinese faith) and unblocks Chinese / Buddhist /
Taoist venue-readiness counts in the /admin launch-readiness surface. The ENUM
`ADD VALUE` is **IRREVERSIBLE** — PostgreSQL cannot DROP an enum value and there
is no down-migration; surface to the owner before applying. No temple venue is
seeded; admins create real temple rows (tagged `compatible_ceremony_types`
including `'chinese'`) via `/admin/venues` to make the promise resolve
end-to-end. Recorded at the bottom of `DECISION_LOG.md` per the relaxed sync
mandate (not edited here).
