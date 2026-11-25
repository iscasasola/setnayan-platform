## 2026-11-24 · feat(hub-tools): the seven live timelines and the Wellness plan on the supplier's Hub

DECISION_LOG "Seven open calls settled" item 3 (the free rest, part 2 of 2; controller OK 24 Nov). Same shape as part 1 and the first ten: ONE table `vendor_hub_tool_entries`, ONE reader `readHubToolEntries`, ONE writer `hubToolEntry`. No new table, no new server action, no migration. Drawing `prototypes/hub_tools_working_2026-10-28/` (③ Live timeline).

- **Live timeline (new template):** Pick-up times & routes · Itinerary · Serving times · Remembrance schedule · March cue sheet · Rehearsal & cues · Reveal cue.
  - Rows run in time order, with the time on the left. The NOW row is the first one not yet done. **Next ›** ticks it, and the next row becomes NOW. **Back** un-ticks the last one done. Done rows fade.
  - A row's time is the minute of the day in `qty`, the clock as typed. It is written and read ONLY through `minuteQty` / `rowMinute` / `hhmmOf` in `lib/hub-tool-entries.ts` (controller, 24 Nov).
  - A row with no time is refused ("Pick a time first.").
- **Wellness plan (Plan template, dated):** sessions in the weeks before. Each is a date and the activity in plain words, ticked when done; the first not done is marked NEXT.
  - **No note and no health field** (controller, 24 Nov).
  - The day is the calendar day in `qty`, through `dayQty` / `rowDay`.
  - Other Plan tools (Floor plan, Tables & seating) keep no rows here.
- The live timelines that run on the couple's own program (Run of show, Floor Command, March, Emcee script) are refused by the one writer; they are read, never typed here.
- Each tool is a day-of module any shop may switch on, ON for nobody by family; Admin › Categories › Hub tools suggests them per booking.
- Part 1's Chair schedule and Reservation slots blurbs no longer say "ticked" (an ordered row has no tick).
- **Held, with reason (controller 24 Nov):**
  - Insured people list and Incident log: privacy picks, waiting on the owner.
  - Photo upload and Photo delivery: a later batch.
- Lab: `/dev/supplier-hub-tools-lab?s=timelines` (with `timelines-empty` and `timelines-unread`).
- Guard: `lib/the-free-hub-timelines-work.test.ts`.

SPEC IMPACT: None. This builds the ruled item 3 on the templates `hub_tools` already holds (seven `live_timeline` rows and `wellness_plan` on `plan`, as read on prod).
