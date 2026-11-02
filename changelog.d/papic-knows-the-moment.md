## 2026-11-02 · feat(papic): captures know their moment — deleting a moment deletes its Papic items, and the warning names the count

Owner 2026-11-01 (plan `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3): *"When there are photos on that moment and they try to delete it, you have to ask them deleting this moment will also delete the papic photos and videos."* The warning names the count. Controller's calls: Papic items only (not uploads or supplier shots); a photo also added to another chapter stays there. Ruled 1 Nov: a CHAPTER delete keeps its photos under Unsorted.

- **Migration `20271302139013_papic_knows_the_moment`** (ALTER first, no top-level DML):
  - `papic_chapter_captures.moment_block_id` is the moment of the link's chapter that was on at the shutter (the later-starting one if two overlap; NULL if none; always NULL for an `added` link). It is derived by the link's trigger, so no capture route changed.
  - A BEFORE DELETE trigger on a moment hides that moment's own Papic items (`hidden_at`, which every gallery already leaves out) and takes them out of the chapter. One also in another chapter just leaves this chapter.
  - A chapter delete, or the whole event's, removes nothing.
- **Credits untouched:** a guest's spend is SUM(`points_cost`) over her capture rows, so erasing a row would hand credits back. "Are spent credits returned?" is still open (plan §3), so the row, its files and its points stay. If the owner says yes, erasure is the shipped `deletePhotoForever` path.
- **Delete moment warning** (`moment-sheets.tsx`, on #7159): "This also deletes the N Papic photos and videos taken during it. M also in another chapter stay there." It is counted from this moment's tagged links (`countMomentPapic`). An unreadable count is said, never shown as 0. The old chapter-wide count (`countChapterPapic`) is gone.
- Guards: `tests/db/papic-knows-the-moment.db.test.ts` (each part fails when sabotaged) · `a-moment-holds-its-tasks.test.ts` test 3 updated to the new ruling. Exposure baseline regenerated (one column, authenticated SELECT).

SPEC IMPACT: `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 "Deleting a moment deletes its Papic photos" — the photo-to-moment link now exists. Delete = hide (out of every gallery), pending the owner's credits answer.
