## 2026-11-05 · feat(schedule): event chapters slice 9 — Side by side (the plan's "People by time")

The owner-approved brief `SCHEDULE_SLICES_8_10_BRIEF_2026-11-05.md`, slice 9. Owner: *"seeing all the schedules interlacing to the same time."*

- **One view, renamed.** View as › "Suppliers by time" is now **Side by side**. It is the same entry and the same key (`suptime`), and it stays Free (the 2 Nov ruling).
- **One shared time axis** (`lib/side-by-side.ts`, `_components/side-by-side.tsx`):
  - a column per supplier, then the coordinator, the Host/MC (a booked `host_mc` supplier) and the couple (each their own column: their own tasks and their role's);
  - times pinned left and column heads pinned on top;
  - chapter bands shaded behind every column;
  - a backstage block dashed;
  - a clash (one column in two places at once) outlined "Two places at once", with a count above the grid;
  - "Now" across every column on the day.
  - One day only: a chapter on another day is listed under the axis, never stretched onto it.
  - A Time-TBA chapter's suppliers are listed "Time TBA", never hidden (the 2 Nov ruling, item 4).
- **"By person · By chapter · By role"** is one PickMenu that regroups the columns. A second PickMenu (searchable) shows any ONE person or role alone, so their whole day reads top to bottom.
- **Columns fit the screen:** a phone shows about 2.5 and swipes sideways; a tablet about 5; a desktop every one (never thinner than 140 px). The grid scrolls in its own pane, so its heads and times stay pinned within it.
- **A column head opens that supplier's day** on Pro only (the per-person views are Pro); on Free the heads are not pressable.
- **View as data:** each supplier now carries its trade and whether it is the Host / MC (`readViewAsExtras`, one existing read).
- **Guards:**
  - new `app/dashboard/[eventId]/schedule/side-by-side-is-one-time-axis.test.ts` (5 tests);
  - `view-as-shows-only-whats-theirs.test.ts` now checks the Free/Pro rule on Side by side's column heads instead of the old list's lines.
- **Lab:** `/dev/chapters-lab` adds a made-up Host / MC (Ate Jen) and the bride (Ana Cruz) so their columns draw.

SPEC IMPACT: None beyond the approved brief. Not built from the prototype, because the brief does not list them: the Roles summary strip, role schedule sheets, "Handled by" crew picks and the crew pass.
