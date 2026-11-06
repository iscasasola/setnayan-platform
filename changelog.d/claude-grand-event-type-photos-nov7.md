## 2026-11-07 · feat(photos): grand event-type and category photos — 17 event types, 4 category tiles (owner 7 Nov)

Owner, 7 Nov: "update the photos", in create event, the front page and everywhere else they appear.

- **Event types**: 17 files in `apps/web/public/event-types/`, all 880×1100 WebP. 14 replace the 4 Nov set
  (wedding, debut, gender_reveal, birthday, celebration, corporate, christening, anniversary, graduation,
  reunion, gala_night, date, hangout, wake). `concert`, `open_house` and `grand_opening` are new: those three
  vocab rows were drawing the gradient placeholder tile. `travel`, `tournament` and `simple_event` are
  unchanged. Repo weight of the set: 1,607 KB → 2,915 KB. Pages get `next/image` resizes, not these files.
- **Cache version**: `EVENT_TYPE_PHOTO_VERSION` + `eventTypeRepoPhotoSrc(key)` in
  `create-event/_components/event-types.ts` is now the one place that builds the repo path
  (`/event-types/<key>.webp?v=20261107`). next/image caches optimised copies for 31 days by source URL,
  so without this, a file overwritten under the same name would keep showing the old photo.
  `eventTypePhotoSrc` and the two fallbacks (launcher `heroFor`, event-dashboard `typeHeroRead`) use it.
  `faceSpanForTypePhoto` accepts the versioned path and the bare one.
- **Face spans**: every replaced or new row in `EVENT_TYPE_PHOTO_FACES` was re-measured on the new files.
  In crowd shots the span covers the focal people. The new photos are wide rooms, so faces now sit around
  40–65 % of the height instead of 10–35 %.
- **Category tiles** (900×676 WebP q82, centre-cropped from 2048×1536): `lights_sound` and
  `wellness_fitness` are overwritten, and prod already points those rows at these paths. `event_staffing`
  and `prayers` are added as files only, because their `service_categories` rows only exist after #7355.
  Tiles have no single path builder: the path is the DB value, drawn as a CSS background. Public files
  are served `max-age=0, must-revalidate`, so no version token is needed.
- **Guards**: `lib/event-type-photo-faces.test.ts` now uses the made-up `no_photo_yet` key for its
  "no file, no span" check, because concert has a file now. It also asserts that the versioned path gets the span.
  `the-event-card-carries-a-photograph.test.ts` now expects the floor through `eventTypeRepoPhotoSrc(eventType)`.
  `the-wake-never-celebrates.test.ts` used to check wake.webp against a hard-coded 33–77 KB copied from the
  1 Oct siblings. It now checks it against the real sibling range, plus a 20 KB floor (sabotage-checked: a 993 KB file fails).

SPEC IMPACT: None. This swaps the photo assets with no product decision. A follow-up sets
`service_categories.sample_photo_r2_key` for event_staffing and prayers after #7355.
- 7 Nov (later): travel.webp replaced too (owner's round-6 keeper, family in linen on a limestone-cliff beach; face span [0.48, 0.60]). Tournament still waits for a clean keeper.
