## 2026-11-01 · feat(memories): Memories by chapter — Who + When enforced in the read, a chapter dropdown, Add to Chapter

Owner 1 Nov (DECISION_LOG "A CHAPTER'S PHOTOS: WHO + WHEN; ADD TO OTHER CHAPTERS" · "SCHEDULE PLAN §9: EIGHT OPEN ITEMS
RULED" (3); plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 Photos, §4 "Memories by chapter" + "Add to other
chapters"): *"A chapter is exclusive to 1. the people part of that initially or tagged only or to everybody 2. show
instantly for everybody or will only show once event is done"* · *"We can add media files inside other chapters on
memories directly."*

- **Migration `20271301555513_memories_by_chapter`** (no new table): `papic_chapter_person_in` is the ONE answer to
  "who is in this chapter" — the shoot rule (`papic_chapter_person_may_shoot`) now calls it, same answers. The read
  rule, from the approved prototype's `seesMedia`: own photos always · hosts see every chapter once the event is done
  (`papic_event_is_done` mirrors `getMenuLifecyclePhase`) · "after the event" hides from everybody, hosts included,
  until then · Everybody = the guest list · People in this chapter — a face tag never overrides it · Only people
  tagged = the photos you are in. `papic_memories_chapters` / `papic_memories_photo_chapters` answer for `auth.uid()`;
  `papic_memories_set_chapter` is the one writer of `how = 'added'` (hosts and a chapter's people; a shot's own
  chapter never leaves). `papic_chapter_capture_visible(link, user)` is the per-photo seam for the next slice.
- **`readEventMemories`** drops every photo the viewer sees in no chapter before the page draws; a refused chapter read
  fails closed ("couldn't load"); the measured count leaves the withheld out.
- **Memories tab**: Chapter ▾ (one `PickMenu`) — All chapters, only the chapters the server listed, Unsorted. **Add to
  Chapter** in the viewer acts: the shared dropdown with checkmarks, "More people will see this" before an Everybody
  chapter. Rides the existing `memoriesPhotoTags` action as op `chapter` (the server-action budget is at its ceiling).
- **`groupIntoChapters`: two copies → one.** The engine is `lib/papic-chapters.ts` (countdown, trip, and now the run of
  show); `lib/alaala-chapters.ts` keeps only the schedule's window rules; `chapterDays` is the day split.
- Prices, credits and ceilings untouched.
- **DB replay harness:** `max_stack_depth` 2MB → 6MB in `tests/db/replay-migrations.ts`. PGlite does not hand back its
  stack after an ERROR, and the audited replay (~1,600 deliberate errors) ran out the moment the corpus grew by one
  file — a one-line placeholder migration reproduced it. Runaway recursion ends the same way at both limits.
- Guards: `tests/db/memories-by-chapter.db.test.ts` (an outsider cannot read a chapter's photos, even face-tagged; the
  dropdown read lists only visible chapters; When; Add to Chapter), `lib/memories-chapters.test.ts`.
- ⏭ NOT built (next Step 7 slice): the server check on every photo URL, signed links included — the papic tables' RLS
  still lets the couple read every capture row. Seam: `papic_chapter_capture_visible`.

SPEC IMPACT: None in the corpus (read-only for this builder) — builds plan §4's two rows as written. Controller's
readings to confirm: before the event is done a host is judged like everyone else (the prototype's `seesMedia`), so a
host on no task of a "People in this chapter" chapter sees only their own shots in it until the morning after;
"Everybody" also lets in the chapter's own people (a booked supplier on it).
