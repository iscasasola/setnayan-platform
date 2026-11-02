## 2026-11-02 · feat(schedule): the Schedule is its own page from Home; Suppliers › Booked is just the team

Owner 2026-11-02, live (DECISION_LOG "BOOKED IS JUST THE TEAM"): *"the schedule still jumped to the booked-schedule"* ·
*"no just schedule"* · *"and booked-team will just be booked."* Stacked on #7174 (Budget page from Home).

- `schedule/page.tsx` no longer redirects — not into Suppliers › Booked (`?part=schedule`), not into the Maker's
  Details. Its only redirect is signed-out → /login. Home's Schedule card, its doors (`?sheet=requests`,
  `?announce=1`), the bottom nav and every old link land on `/dashboard/[eventId]/schedule`.
- ONE address: `schedulePageHref(eventId, query)` in `lib/pillar-parts.ts`. The old `/vendors?part=schedule` forwards
  there with view · ros · note · host_answers · sheet · filter · announce. `/schedule` lights Home in the menu.
- Deleted the Booked wrappers: `booked-part-page.tsx`, `booked-part-row.tsx` (and its row-count portal), the unused
  `pillar-part-picker.tsx`, `yourTeamParts` / `bookedParts` / `bookedScheduleHref` / `bookedTeamHref`, and the lab's
  Booked › Schedule. Suppliers' one dropdown reads Find · Build · Booked, Booked with its count.
- ⚠ Controller's call, flagged: `booked-schedule-frame.tsx` was not only a wrapper — it is the owner-approved one-line
  Schedule layout (frames 19 · 19b · 20, 31 Oct). It is RENAMED `schedule-one-line.tsx` (`ScheduleOneLine`, slot
  `SCHEDULE_TOOLS_SLOT`) and is now the Schedule page's look; the old seven-row header remains only inside the Maker.
- Guards: new `schedule/the-schedule-is-its-own-page.test.ts` (no redirect · every Home door · no `?part=schedule`
  builder and the forward carries every param · neither page drawn inside Suppliers, wrappers stay deleted);
  `suppliers-one-dropdown.test.ts` rewritten (exactly Find · Build · Booked); `booked-is-team-budget-schedule` →
  `booked-is-the-team.test.ts`; `the-schedule-under-booked-is-one-line` → `the-schedule-page-is-one-line.test.ts`.
  Regenerated screens map, port baseline, root-map baselines.

SPEC IMPACT: None — implements the 2026-11-02 ruling (a DECISION_LOG "as built" row only).
