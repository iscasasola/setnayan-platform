## 2026-07-23 · fix(papic): tag cap counts LIVE tags only + raised 10 → 20

Owner decisions 2026-07-23 (corpus DECISION_LOG). Two changes, in lockstep across
the `enforce_photo_tag_cap` trigger and both tag RPCs (`papic_tag_capture`,
`papic_tag_guest_capture`) via migration `20270916200000`:

1. **Ghost fix:** the cap now counts `removed_at IS NULL` only. Previously every
   "Not me" tombstone permanently burned a cap slot — a photo with 10 removals
   silently rejected ALL future tags (QR, face, manual). Found by the
   pool-gallery build study (`OnTheDay_App_Build_Studies_2026-07-23.md`).
2. **Cap 10 → 20** ("maximum generosity") — kills the 12-seat-table alphabetical
   silent-drop and covers king/long tables + big group shots.

App side: `MAX_TAGS_PER_PHOTO` 10→20 in `lib/face-match-core.ts`; `planAutoTags`
gains `liveTagCount` so tombstoned guests still never re-tag (gravestone rule)
while no longer filling the cap; `lib/face-match.ts` fetches `removed_at` and
passes both. New DB test `tests/db/photo-tag-cap.db.test.ts` proves: 20 live
land / 21st skipped · tombstones free slots · gravestones survive re-tag
attempts. Unit test added for the liveTagCount path.

SPEC IMPACT: corpus `CLAUDE.md` hard-constraint line updated (Max 10 → Max 20
live, 2026-07-23); DECISION_LOG rows appended.
