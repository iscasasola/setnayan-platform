## 2026-08-19 · feat(alaala): albums across the top, the library underneath

**SPEC IMPACT:** None — a re-presentation of data Alaala already fetched.

Owner 2026-08-19: *"first row should be chronological albums of each event. then
under it can be all the photos in grid."* — the Apple Photos shape.

**One cover per event, oldest first, above the whole-library grid.** Each cover
is the event's newest frame, with a play badge when that frame is a clip, its
name, and its count.

**Every event, including the empty ones** — owner, asked twice: *"show all eight
events."* Production holds 8 events and 14 photos, **all 14 on one of them**, so
7 covers are empty today. An empty cover reads as *"nothing yet"*; a missing one
makes an event somebody is actively planning vanish from their own gallery.
Empty covers carry the event's own monogram, so launch day reads as your events
waiting rather than blank tiles.

**This is not the thing that was demoted.** Per-event albums were pushed down on
2026-08-13 for a reason still worth keeping: that version answered with **event
names and counts**, which made Alaala a second events board. This shelf answers
with **photographs** — you read it by looking. Named here so the old decision is
not cited against the new one.

**Almost nothing was built.** `getPhotosAlbums` already returned every event
including zero-count ones, already collected up to four presigned thumbnails per
album, and already flagged which are clips. The shelf sorts **its own copy** —
the `?tab=albums` grid still depends on the owned-then-attended order, and
mutating the shared array would have silently reordered it.

⚠ `event_date` is a DATE, not an instant — `new Date('2026-12-12')` is the 11th
west of Greenwich, the documented defect that printed the wrong day on 41
screens. Sorting only compares these values to each other, so it is kept as a
plain string key and never turned into a Date.

⏭ **Next, not in this PR:** opening an album breaks it into chapters (by day,
then by the run of show), and the per-event Life-Flash. The hazard there is
already identified — **the schedule stores the venue's wall clock while photos
store real instants**, eight hours apart in Manila, which would file dinner
photos under hair & make-up.

🛡 `album-shelf.test.ts` — 5 assertions, **all four sabotages measured by
occurrence count as having landed** (0→1 · 3→1 · 1→0 · 1→0) and each confirmed
RED: no empty-album filter, sorts by date, sorts a copy, undated events kept,
clip covers badged, and the shelf actually **mounted above** the lens row.

Verified: `tsc` clean (`--version` first) · 841 app tests green ·
lost-controls ✅ 402 routes · masthead lint ✓.
