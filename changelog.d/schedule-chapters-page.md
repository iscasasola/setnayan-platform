## 2026-11-01 · feat(schedule): chapters live on the Schedule page — the rail, a chapter's page, Time TBA; out of Event Settings (Step 3a)

Owner 1 Nov (DECISION_LOG "CHAPTERS LIVE ON THE SCHEDULE PAGE, NOT EVENT SETTINGS"): *"Why is the chapters there? Shouldn't it be in schedules?"* — chapters are made and edited on the Schedule page only.

- **Event Day rail draws the chapters** with the time between them ("1h 30m between"); **+ Add a chapter** asks only a name and a time. A chapter with no time yet is listed under the rail as **Time TBA**; one dated before the day sits at the top of **Planning Stage**.
- **Tap a chapter → its page**: one top row (‹ back to Event Day or Planning Stage · the page's dropdown listing every chapter and + New chapter), its time and place line, **Ingress · Event · Egress** (one open at a time) with its moments as a list, **Edit** in the thumb row. Chapter details save on ✕ or a tap outside; **Delete chapter** warns (moments, photos stay under Unsorted) → Continue → deleting.
- **Time TBA** (owner ruled yes): migration `20271300482585` adds `event_schedule_blocks.time_tba`; the day stays in `start_at` at 00:00. The database refuses a TBA moment, a TBA chapter with an end, and a TBA chapter shown to guests — so no reader can put a guessed midnight on the Event Hub.
- **Event Settings' Chapters row is gone** (Step 2, #7143), with no link left behind. The chapter sheets moved, whole, into `schedule/_components/chapter-sheets.tsx`.
- The Maker's Details › Schedule is unchanged. Moment and task editing on a chapter's page is the next slice.
- Guards: `schedule/chapters-live-on-the-schedule.test.ts` (replaces `chapters-are-in-event-settings.test.ts`), `tests/db/a-chapter-time-can-be-tba.db.test.ts`.

SPEC IMPACT: corpus `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §7 — Time TBA is stored as a `time_tba` flag on the chapter (its day kept in `start_at`), not a nullable `start_at`; DECISION_LOG row added.
