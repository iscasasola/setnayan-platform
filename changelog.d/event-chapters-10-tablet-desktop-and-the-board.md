## 2026-11-05 · feat(schedule): event chapters slice 10 — tablet and desktop layouts, and the desktop board

The owner-approved brief `SCHEDULE_SLICES_8_10_BRIEF_2026-11-05.md`, slice 10, which includes the plan's "desktop board". Tablet and desktop are real layouts, not a stretched phone.

- **iPad portrait:** one wide column. Each chapter's moments sit inline in two sub-columns (`day-list.tsx`, `md:`).
- **iPad landscape (`lg`):** the day beside the opened chapter (`chapters-host.tsx` panes). The day stays mounted, so opening a chapter is never a request. Before one is opened, the second pane says "Open a chapter to see it here."
- **Desktop (`xl`):** three columns — the day · the chapter · the people (`schedule-people.tsx`). The people column holds:
  - what needs you (the supplier requests, handed up by the rail);
  - every supplier and the chapters they serve, each a door into View as on Pro;
  - the coordinator and the Host / MC;
  - Release (opens ⚙).

  On desktop there is no floating pill and no thumb strip. "+ Add a chapter" is the last row of the day, and the chapter's Edit · Add a moment is a right-aligned bar at its foot. The rail's old desktop side panel steps aside where chapters are drawn. The Schedule section widens to 100rem at `xl`.
- **The desktop board (≥1280 with a fine pointer only):**
  - Drag a chapter row up or down to a new start. One pixel is one minute, snapped to 5, and the start shows where it will land.
  - It saves in place with Undo, and the page never resets.
  - It goes through the SAME server action and the same rule as the phone's time edit: `lib/chapter-move.ts` `chapterMove`, used by both the chapter sheet's `moveTo` and `moveChapter`, then `ChapterDoors.save` → `updateScheduleBlock`. No new write path, the same permission checks.
  - A drag never opens the chapter, and never selects text. No drag on a tablet or a phone.
- **Guard:** `lib/a-drag-and-the-phone-edit-make-one-row.test.ts` (4 tests), including the brief's own: a drag and the phone edit produce the identical row.
- **Lab:** `/dev/chapters-lab` is as wide as the page on a tablet (64rem) and a desktop (100rem).

SPEC IMPACT: None beyond the approved brief and prototype. Not built: the tablet's bottom tool strip at the right-thumb corner (the bottom tabs are already hidden from `lg` up, which is unchanged); the desktop's signed-in top-bar nav.
