## 2026-08-19 · feat(papic): the gallery reads as the day it was

**SPEC IMPACT:** None — a re-presentation of frames and a schedule the event
already had.

The second half of the owner's 2026-08-19 design: *"opening an event will
categorize each part by chapter. (by day, then event day can be by schedule if
available)."* [#4573](https://github.com/iscasasola/setnayan-platform/pull/4573)
shipped the engine, unmounted and said so. **This mounts it.**

Opening an album now shows the day in order under its own headings — *Hair &
make-up · Cocktails · Grand Entrance · Dinner · First Dance · Send-off* — taken
straight from the couple's run of show.

### Nothing was added to the database

The capture time was **already selected, already sorted on, and already exposed**
on `GalleryPhoto` — I tried to add it and `tsc` told me it was there. The schedule
was already fetchable. This is arrangement, not collection.

### Four rules, each a decision rather than an accident

**Chapters set the order, and that reverses the gallery.** The flat grid is
newest-first, which is right for *"what just came in"*. A story is not: the day
reads forward. When chapters are absent, nothing moves.

**A chapter is assigned from the VISIBLE frames.** The filter bar still rules, so
filtering to Videos shows only the chapters that contain one — never a column of
empty headings.

**A frame in no chapter sorts last, never vanishes.** Nothing in this gallery is
ever silently dropped.

**One chapter over everything is not offered.** A single heading spanning the whole
gallery tells the couple nothing they cannot already see.

### It fails to the old gallery, on purpose

A schedule that cannot be read leaves `chapters` undefined and the grid renders
**exactly as it always has**. The prop is optional, so every existing caller is
untouched. *A gallery is somebody's wedding; it must never be a blank page because
a heading could not be computed.*

🛡 **7 wiring assertions**, all four sabotages measured by occurrence count as
landed (1→0 · 1→0 · 1→0 · 2→0) and each confirmed RED. They cover the half this
repo keeps losing: the engine passes 11 tests whether or not a single photograph
ever reaches it — so these assert the engine is CALLED, the result REACHES the
grid, the venue zone is passed, and no raw time comparison was reintroduced.

🪤 **The suite printed "# tests 0 … # fail 0" and exited green** on first run: an
explicit `app/[eventId]/…` path is a glob character class matching nothing. It runs
from inside the directory — and CI's `app/**/*.test.ts` picks it up either way,
**verified by count: 841 → 848, exactly the 7 added.**
