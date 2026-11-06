## 2026-11-02 · fix(schedule): Suppliers by time is Free; a Time-TBA chapter reaches every supplier reader

Owner, 2 Nov (DECISION_LOG "TEN OWNER YESES" items 3 and 4).

- **Suppliers by time is FREE.** #7160 made the whole View as ▾ a Pro door on a Free event. Now a Free event's menu opens
  with Everyone · Suppliers by time, plus one ◆ PRO row ("A guest, a role or a supplier") that opens the upgrade (absent
  in a store shell that sells no Pro). A guest, role, supplier or crew view stays Pro: one question, `lensAllowed`
  (`lib/schedule-view-as.ts`), fences the menu, the body and the rail. On Free a supplier line in Suppliers by time is
  read, not tapped (tapping opens their day, which is Pro).
- **A Time-TBA chapter is never hidden from a supplier.** Suppliers by time lists a TBA chapter's suppliers "Time TBA"
  after the timed stretches (it used to leave them out). The supplier's Customer › Schedule view used to drop TBA
  chapters (`onlyTimedBlocks` on the page's read); it now reads every block, keeps the chapter, and its moments read
  "Time TBA" (`SupplierMoment.clock`), sorted after the day's timed chapters. The timeline, run of show and call time on
  that page take `blocksWithAClock` (a TBA chapter and its moments have no clock). A new moment in a TBA chapter is no
  longer prefilled 12:00 AM.
- **Found by the new guard:** a moment INSIDE a TBA chapter gave the Team row a 12:00 AM call time
  (`readBookedSchedule` only checked the block's own flag). It now inherits its chapter's.
- Where (Team row, quote) and the calendar file already kept TBA chapters; now held by the guard.
- Labs: `/dev/chapters-lab?free=1` (View as › Suppliers by time on a Free event, with a Time-TBA Send-off) and
  `/dev/supplier-lab?s=schedule` (Lumina's day with a Time-TBA Send-off).

Guards: `lib/a-supplier-reader-never-drops-a-tba-chapter.test.ts` (new — every supplier reader, plus every supplier-side
TBA fence must be a listed clock reader); `view-as-shows-only-whats-theirs.test.ts` tests 3 and 4 rewritten.

⚠ Flagged: a crew member's on-the-day run of show (`/join/crew/[token]`) still leaves TBA chapters out, as a clock
reader (listed in the guard with its reason).

SPEC IMPACT: `SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md` §3 (Call time: TBA never hidden) and §3b (View as row: Suppliers
by time Free); `Free_Pro_Tiering_2026-06-14.md` Timeline/Schedule row — both edited in the corpus (8ec18c8a).
